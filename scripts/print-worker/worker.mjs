// Local Print Worker for the GDG Jakarta Label Station.
//
// Listens on 127.0.0.1 and lets the dashboard (/dashboard/printers) print thermal badges
// without any browser print dialog: HTML -> headless Chrome PDF -> CUPS `lp`.
// With several printers configured it keeps a pool and assigns every job to an idle printer by itself,
// so the dashboard never has to pick one. Zero npm dependencies. Started through main.mjs (`run`).

import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir, hostname, platform, release, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONFIG_PATH = join(homedir(), ".gdg-print-worker", "config.json");
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_QUEUED_JOBS = 100;
const MAX_WAIT_MS = 120_000; // a job that finds no free printer for this long is rejected
const PRINTER_COOLDOWN_MS = 30_000; // a printer that just failed is skipped for this long
export const VERSION = "2.3.0";

async function loadConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  } catch {
    console.error(`No config found at ${CONFIG_PATH}. Run the setup first: gdg-print-worker setup`);
    process.exit(1);
  }
}

async function defaultPrinterName() {
  try {
    const { stdout } = await execFileAsync("lpstat", ["-d"], { timeout: 5_000 });
    return stdout.split(":")[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * Device address (CUPS device URI) of every queue: `{ "<queue>": "usb://Clabel-/CT221B?serial=..." }`.
 * Two identical printers often report the same USB serial and so get the same URI, which makes CUPS print on one of
 * them only. Exported for the setup, which warns about it.
 */
export async function readPrinterUris() {
  const uris = {};
  try {
    const { stdout } = await execFileAsync("lpstat", ["-v"], { timeout: 5_000 });
    for (const line of stdout.split("\n")) {
      const match = line.match(/^device for (.+?): (.+)$/);
      if (match) uris[match[1]] = match[2].trim();
    }
  } catch {
    // no CUPS queues: nothing to report
  }
  return uris;
}

/** Groups of queue names that share one device URI (they cannot be told apart by CUPS). */
export function findSharedDevices(names, uris) {
  const byUri = new Map();
  for (const name of names) {
    const uri = uris[name];
    if (!uri) continue;
    byUri.set(uri, [...(byUri.get(uri) ?? []), name]);
  }
  return [...byUri.entries()].filter(([, group]) => group.length > 1).map(([uri, group]) => ({ uri, printers: group }));
}

async function readCommand(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 5_000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

/** Which laptop this is, shown next to its printers in the dashboard (computer name, hardware model, OS). */
async function readDeviceInfo() {
  if (platform() === "darwin") {
    const [computerName, model, osVersion] = await Promise.all([
      readCommand("scutil", ["--get", "ComputerName"]),
      readCommand("sysctl", ["-n", "hw.model"]),
      readCommand("sw_vers", ["-productVersion"]),
    ]);
    return {
      computerName: computerName || hostname(),
      model: model || null,
      os: osVersion ? `macOS ${osVersion}` : `macOS ${release()}`,
    };
  }
  return { computerName: hostname(), model: null, os: `${platform()} ${release()}` };
}

// Filled in by startWorker().
let config;
let deviceInfo = { computerName: hostname(), model: null, os: platform() };
let allowedOrigins = new Set();
let slots = [];

async function initPool() {
  // `printers` is the pool; `printer` (single string) is the legacy config. Empty entry = system default.
  const configuredNames = Array.isArray(config.printers) ? config.printers : [config.printer ?? ""];
  const printerNames = [
    ...new Set(await Promise.all(configuredNames.map(async (name) => name || (await defaultPrinterName())))),
  ];
  if (printerNames.length === 0) printerNames.push("");

  const uris = await readPrinterUris();
  slots = printerNames.map((name) => ({
    name,
    uri: uris[name] ?? null,
    busy: false,
    lastUsedAt: 0,
    unavailableUntil: 0,
    lastError: null,
  }));
}

/** Failure that belongs to one printer (so the job may be retried on another one). */
class PrinterError extends Error {}

function isValidMm(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 10 && value <= 200;
}

// Headless Chrome can hang in teardown after the PDF is already written (slow exit, non-zero code),
// so resolve as soon as the PDF exists and stop the process instead of waiting for it to exit.
// Every render gets its own throwaway profile, which is what lets renders run in parallel.
async function renderPdf(html, pdfPath, workDir) {
  const htmlPath = join(workDir, "label.html");
  await writeFile(htmlPath, html, "utf8");

  await new Promise((resolve, reject) => {
    const chrome = spawn(
      config.chromePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        `--user-data-dir=${join(workDir, "chrome-profile")}`,
        "--virtual-time-budget=3000",
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );

    let stderr = "";
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.kill("SIGKILL");
      err ? reject(err) : resolve();
    };

    const timer = setTimeout(() => finish(new Error("Chrome timed out while rendering the label")), 30_000);
    chrome.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.includes("bytes written to file")) finish();
    });
    chrome.on("error", (err) => finish(err));
    chrome.on("exit", (code) => finish(code === 0 ? undefined : new Error(`Chrome exited with code ${code}`)));
  });
}

async function printerStatusLine(name) {
  try {
    const { stdout } = await execFileAsync("lpstat", name ? ["-p", name] : ["-p"], { timeout: 5_000 });
    return stdout.trim().split("\n")[0] ?? "unknown";
  } catch {
    return "unavailable";
  }
}

async function sendToPrinter(name, pdfPath, { widthMm, heightMm, copies }) {
  // `lp` happily queues onto a disabled printer and the label never comes out, so check first.
  const status = await printerStatusLine(name);
  if (status === "unavailable" || /disabled/i.test(status)) {
    throw new PrinterError(
      `printer "${name || "default"}" is ${status === "unavailable" ? "unavailable" : "disabled"}`,
    );
  }

  const args = [
    "-n",
    String(copies),
    "-o",
    `media=Custom.${widthMm}x${heightMm}mm`,
    "-o",
    "scaling=100",
    ...(name ? ["-d", name] : []),
    pdfPath,
  ];
  try {
    const { stdout } = await execFileAsync("lp", args, { timeout: 15_000 });
    return stdout.trim();
  } catch (err) {
    throw new PrinterError(`lp failed on "${name || "default"}": ${(err.stderr ?? "").trim() || err.message}`);
  }
}

async function printJob(name, job) {
  const workDir = join(tmpdir(), `gdg-print-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });
  try {
    const pdfPath = join(workDir, "label.pdf");
    await renderPdf(job.html, pdfPath, workDir);
    return await sendToPrinter(name, pdfPath, job);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

// ---- Printer pool -------------------------------------------------------------------------------
// Jobs wait in `pending` (FIFO). Each free printer takes the next job, so N printers print N labels at
// once, a single printer stays strictly in order, and the least recently used idle printer goes first.

const pending = [];

function pickSlot(entry) {
  const now = Date.now();
  // A job pinned to one printer (the dashboard already decided where it goes) only ever runs on that printer.
  if (entry.only) return entry.only.busy ? undefined : entry.only;
  return slots
    .filter((slot) => !slot.busy && slot.unavailableUntil <= now && !entry.tried.has(slot))
    .sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];
}

function dispatch() {
  for (const entry of [...pending]) {
    const slot = pickSlot(entry);
    if (!slot) continue;
    pending.splice(pending.indexOf(entry), 1);
    void runOnSlot(slot, entry);
  }
}

async function runOnSlot(slot, entry) {
  slot.busy = true;
  try {
    const message = await printJob(slot.name, entry.job);
    slot.lastError = null;
    entry.resolve({ printer: slot.name || null, message });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Print failed";
    if (err instanceof PrinterError) {
      slot.lastError = message;
      slot.unavailableUntil = Date.now() + PRINTER_COOLDOWN_MS;
      entry.tried.add(slot);
      if (entry.only) {
        // Pinned job: never move it to another printer here, the dashboard decides what happens next.
        entry.reject(err);
      } else if (entry.tried.size < slots.length) {
        console.warn(`[pool] ${message}; retrying on another printer`);
        pending.unshift(entry);
      } else {
        entry.reject(new Error(slots.length > 1 ? `Every printer failed. Last error: ${message}` : message));
      }
    } else {
      entry.reject(err);
    }
  } finally {
    slot.lastUsedAt = Date.now();
    slot.busy = false;
    dispatch();
  }
}

function submitJob(job, printerName) {
  let only = null;
  if (typeof printerName === "string" && printerName) {
    only = slots.find((slot) => slot.name === printerName) ?? null;
    if (!only) return Promise.reject(new Error(`Unknown printer "${printerName}"`));
  }
  if (pending.length >= MAX_QUEUED_JOBS) return Promise.reject(new Error("Print queue is full"));
  return new Promise((resolve, reject) => {
    const waitTimer = setTimeout(() => {
      const index = pending.indexOf(entry);
      if (index === -1) return;
      pending.splice(index, 1);
      reject(new Error("No printer became available in time"));
    }, MAX_WAIT_MS);
    const entry = {
      job,
      only,
      tried: new Set(),
      resolve: (value) => {
        clearTimeout(waitTimer);
        resolve(value);
      },
      reject: (err) => {
        clearTimeout(waitTimer);
        reject(err);
      },
    };
    pending.push(entry);
    dispatch();
  });
}

async function poolStatus() {
  const now = Date.now();
  const printers = await Promise.all(
    slots.map(async (slot) => ({
      name: slot.name || null,
      uri: slot.uri,
      state: await printerStatusLine(slot.name),
      busy: slot.busy,
      available: slot.unavailableUntil <= now,
      lastError: slot.lastError,
    })),
  );
  return { printers, queued: pending.length };
}

// ---- HTTP ---------------------------------------------------------------------------------------

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body, headers) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  const originAllowed = !origin || allowedOrigins.has(origin);
  const cors = origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        // Chrome Private/Local Network Access preflight for https dashboard -> localhost worker.
        "Access-Control-Allow-Private-Network": "true",
        Vary: "Origin",
      }
    : {};

  if (!originAllowed) {
    send(res, 403, { ok: false, error: `Origin ${origin} is not allowed. Re-run print-worker:setup.` });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");

  if (req.method === "GET" && pathname === "/health") {
    send(res, 200, { ok: true, version: VERSION, device: deviceInfo, ...(await poolStatus()) }, cors);
    return;
  }

  if (req.method === "POST" && pathname === "/print") {
    try {
      const body = await readJsonBody(req);
      const { html, widthMm, heightMm } = body;
      const copies = Number.isInteger(body.copies) && body.copies > 0 && body.copies <= 10 ? body.copies : 1;
      if (typeof html !== "string" || html.length === 0) {
        send(res, 400, { ok: false, error: "`html` is required" }, cors);
        return;
      }
      if (!isValidMm(widthMm) || !isValidMm(heightMm)) {
        send(res, 400, { ok: false, error: "`widthMm` and `heightMm` must be numbers between 10 and 200" }, cors);
        return;
      }
      // Optional: print on this exact printer (the dashboard assigned it). Without it the pool picks an idle one.
      const printerName = typeof body.printer === "string" ? body.printer : undefined;
      const result = await submitJob({ html, widthMm, heightMm, copies }, printerName);
      console.log(`[print] ${widthMm}x${heightMm}mm x${copies} -> ${result.printer ?? "default"}: ${result.message}`);
      send(res, 200, { ok: true, printer: result.printer, message: result.message }, cors);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Print failed";
      console.error("[print] failed:", message);
      send(res, 500, { ok: false, error: message }, cors);
    }
    return;
  }

  send(res, 404, { ok: false, error: "Not found" }, cors);
});

export async function startWorker() {
  config = await loadConfig();
  allowedOrigins = new Set(config.allowedOrigins ?? []);
  await initPool();
  deviceInfo = await readDeviceInfo();

  // Wakes jobs that were waiting for a printer's cooldown to end.
  setInterval(dispatch, 2_000).unref();

  server.listen(config.port, "127.0.0.1", () => {
    console.log(`GDG Print Worker v${VERSION} listening on http://127.0.0.1:${config.port}`);
    console.log(`Device: ${deviceInfo.computerName}${deviceInfo.model ? ` (${deviceInfo.model})` : ""}, ${deviceInfo.os}`);
    console.log(`Printers (${slots.length}): ${slots.map((s) => s.name || "(system default)").join(", ")}`);
    for (const shared of findSharedDevices(
      slots.map((s) => s.name),
      Object.fromEntries(slots.map((s) => [s.name, s.uri])),
    )) {
      console.warn(
        `WARNING: ${shared.printers.join(" and ")} point to the same device (${shared.uri}), so labels may all print on one printer. Re-run setup for the fix.`,
      );
    }
    console.log(`Allowed origins: ${[...allowedOrigins].join(", ") || "(none)"}`);
  });
  server.on("error", (err) => {
    console.error(
      err.code === "EADDRINUSE" ? `Port ${config.port} is already in use (is the worker already running?)` : err,
    );
    process.exit(1);
  });
}

/** Stops a worker that is running elsewhere (another Terminal or the background) by finding its listening port. */
export async function stopWorker() {
  const stopConfig = await loadConfig();
  let pids = [];
  try {
    const { stdout } = await execFileAsync("lsof", ["-nP", `-iTCP:${stopConfig.port}`, "-sTCP:LISTEN", "-t"]);
    pids = stdout.split("\n").filter(Boolean).map(Number);
  } catch {
    // lsof exits non-zero when nothing listens on the port.
  }
  if (pids.length === 0) {
    console.log("The print worker is not running.");
    return;
  }
  for (const pid of pids) process.kill(pid, "SIGTERM");
  console.log("Print worker stopped.");
}
