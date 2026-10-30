// Interactive installer for the GDG Print Worker (macOS).
//   gdg-print-worker setup [--origin https://dashboard.example.com]
//   gdg-print-worker uninstall
// There is no auto-start: the worker runs only while started by hand (setup offers to start it right away).
// Run as the packaged executable it copies itself to ~/.gdg-print-worker/bin, so it can be started later
// even if the downloaded file is moved or deleted.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { isSea } from "node:sea";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONFIG_DIR = join(homedir(), ".gdg-print-worker");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const INSTALLED_BINARY = join(CONFIG_DIR, "bin", "gdg-print-worker");
const LABEL = "org.gdgjakarta.print-worker";
const PLIST_PATH = join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

const uid = process.getuid?.() ?? 501;

/** Dashboard allowed to print when nothing else is configured. */
export const DEFAULT_ORIGINS = ["https://gdgjakarta.com"];

/**
 * Reduces "https://gdgjakarta.com/" or "https://gdgjakarta.com/dashboard" to the bare origin a browser sends in
 * its Origin header ("https://gdgjakarta.com"), so a pasted URL still matches.
 */
export function normalizeOrigin(value) {
  try {
    return new URL(value.trim()).origin;
  } catch {
    throw new Error(`"${value}" is not a valid URL. Use something like https://gdgjakarta.com`);
  }
}

/** Earlier versions installed a login auto-start agent; remove it so it cannot fight the manual worker. */
async function removeLegacyAgent() {
  if (!existsSync(PLIST_PATH)) return false;
  await execFileAsync("launchctl", ["bootout", `gui/${uid}/${LABEL}`]).catch(() => undefined);
  await rm(PLIST_PATH, { force: true });
  return true;
}

export async function runUninstall() {
  await removeLegacyAgent();
  await rm(join(CONFIG_DIR, "bin"), { recursive: true, force: true });
  console.log(
    `Removed the installed program. Settings in ${CONFIG_DIR} were kept (delete that folder to remove everything).`,
  );
}

async function listPrinters() {
  try {
    const { stdout } = await execFileAsync("lpstat", ["-e"]);
    return stdout.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// Returns the printer pool. Every selected printer prints in parallel; the worker assigns jobs itself.
async function pickPrinters(ask, previous) {
  const printers = await listPrinters();
  if (printers.length === 0) {
    console.log("No CUPS printers found. Install the Clabel driver first, or leave blank to use the system default.");
    const name = await ask("Printer name", "");
    return [name];
  }
  console.log("\nInstalled printers:");
  printers.forEach((name, i) => {
    console.log(`  ${i + 1}) ${name}`);
  });
  const remembered = printers.flatMap((name, i) => (previous.includes(name) ? [i + 1] : []));
  const clabels = printers.flatMap((name, i) => (/clabel|ct221/i.test(name) ? [i + 1] : []));
  const suggested = [remembered, clabels, [1]].find((list) => list.length > 0);
  const fallback = suggested.join(",");
  const choice = await ask("Select printer numbers, comma separated (0 = system default)", fallback);
  const picked = [
    ...new Set(
      choice
        .split(",")
        .map((n) => Number.parseInt(n.trim(), 10))
        .filter((n) => n === 0 || (n > 0 && n <= printers.length)),
    ),
  ].map((n) => (n === 0 ? "" : printers[n - 1]));
  if (picked.length === 0) throw new Error("No valid printer selected.");
  return picked;
}

/** Packaged executable only: keep a stable copy to start from later. Returns the command to start the worker. */
async function installBinaryCopy() {
  if (!isSea()) return "npm run print-worker";
  await mkdir(dirname(INSTALLED_BINARY), { recursive: true });
  if (process.execPath !== INSTALLED_BINARY) {
    await copyFile(process.execPath, INSTALLED_BINARY);
    await chmod(INSTALLED_BINARY, 0o755);
  }
  return `${INSTALLED_BINARY} run`;
}

async function loadPreviousConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

/**
 * @param {{ origins?: string[] }} [options] origins offered as the default for the allowed-origins question (default: https://gdgjakarta.com)
 * @returns {Promise<{ startNow: boolean }>}
 */
export async function runSetup(options = {}) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (question, fallback) => {
    const answer = (await rl.question(fallback ? `${question} [${fallback}]: ` : `${question}: `)).trim();
    return answer || fallback || "";
  };

  try {
    console.log("GDG Print Worker setup\n");
    const previous = await loadPreviousConfig();

    const printers = await pickPrinters(ask, previous.printers ?? (previous.printer ? [previous.printer] : []));

    const detectedChrome = previous.chromePath ?? CHROME_CANDIDATES.find((p) => existsSync(p));
    const chromePath = await ask("Chrome executable", detectedChrome);
    if (!chromePath || !existsSync(chromePath)) {
      throw new Error(`Chrome not found at "${chromePath}".`);
    }

    const port = Number.parseInt(await ask("Worker port", String(previous.port ?? 17777)), 10);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new Error("Port must be between 1024 and 65535.");
    }

    const defaultOrigins = options.origins?.length ? options.origins : (previous.allowedOrigins ?? DEFAULT_ORIGINS);
    const originsInput = await ask(
      "Dashboard address(es) allowed to print (comma separated)",
      defaultOrigins.join(","),
    );
    const allowedOrigins = [
      ...new Set(
        originsInput
          .split(",")
          .filter((o) => o.trim())
          .map(normalizeOrigin),
      ),
    ];
    if (allowedOrigins.length === 0) throw new Error("At least one dashboard address is required.");

    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(
      CONFIG_PATH,
      `${JSON.stringify({ printers, chromePath, port, allowedOrigins }, null, 2)}\n`,
      "utf8",
    );
    console.log(`\nSaved ${CONFIG_PATH}`);

    const startCommand = await installBinaryCopy();
    const stopCommand = isSea() ? `${INSTALLED_BINARY} stop` : "press Ctrl+C in the Terminal running it";
    if (await removeLegacyAgent()) console.log("Removed the old login auto-start agent.");

    console.log("\nThe worker does not start by itself. Start it when you set up the print station:");
    console.log(`  start: ${startCommand}`);
    console.log(`  stop : press Ctrl+C in the Terminal window it runs in, or run: ${stopCommand}`);

    const startNow = (await ask("\nStart the worker now? (y/n)", "y")).toLowerCase().startsWith("y");
    return { startNow };
  } finally {
    rl.close();
  }
}
