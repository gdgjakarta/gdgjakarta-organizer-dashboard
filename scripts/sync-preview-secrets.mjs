#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_PREVIEW_SECRET_KEYS = ["OPS_AGENT_SECRET", "SHORTLINK_API_KEY", "SHORTLINK_COOKIE_SECRET"];

/**
 * Parses a `.env*` file into a key -> value map without mutating process.env.
 */
export function parseEnvFile(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (key) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Extracts secret names listed in `wrangler.jsonc` comment blocks under `vars` or `previews.vars`.
 */
export function extractSecretKeysFromWrangler(jsoncText, scope = "previews") {
  const keys = new Set();
  const blockMatch =
    scope === "previews"
      ? jsoncText.match(/"previews"\s*:\s*\{[\s\S]*?"vars"\s*:\s*\{([\s\S]*?)\}/)
      : jsoncText.match(/"vars"\s*:\s*\{([\s\S]*?)\}/);

  const section = blockMatch ? blockMatch[1] : "";
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(/^\s*\/\/\s*-\s*([A-Z0-9_]+)\b/);
    if (m) keys.add(m[1]);
  }
  return Array.from(keys);
}

/**
 * Resolves secret values from `process.env` first, then `.env.local` (or custom envFile).
 * Never returns or logs raw values in summary metadata.
 */
export function resolveSecrets({ keys, env = process.env, envFilePath = ".env.local" }) {
  const fileValues = existsSync(envFilePath) ? parseEnvFile(readFileSync(envFilePath, "utf8")) : {};
  const found = {};
  const missing = [];

  for (const key of keys) {
    const fromEnv = typeof env[key] === "string" && env[key].length > 0 ? env[key] : undefined;
    const fromFile = typeof fileValues[key] === "string" && fileValues[key].length > 0 ? fileValues[key] : undefined;
    const val = fromEnv ?? fromFile;
    if (val) {
      found[key] = val;
    } else {
      missing.push(key);
    }
  }

  return { found, missing };
}

export function parseArgs(argv) {
  const opts = {
    apply: false,
    all: false,
    config: "wrangler.jsonc",
    env: "",
    envFile: ".env.local",
    keys: [],
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--dry-run") opts.apply = false;
    else if (arg === "--all") opts.all = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--config" || arg === "-c") opts.config = argv[++i] ?? opts.config;
    else if (arg === "--env" || arg === "-e") opts.env = argv[++i] ?? "";
    else if (arg === "--env-file") opts.envFile = argv[++i] ?? opts.envFile;
    else if (arg === "--keys") {
      opts.keys = (argv[++i] ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    }
  }
  return opts;
}

function getRemoteSecretNames(config, envName) {
  const args = ["wrangler", "secret", "list", "--format", "json", "-c", config];
  if (envName) args.push("--env", envName);
  try {
    const out = execFileSync("npx", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const parsed = JSON.parse(out);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((item) => item.name).filter(Boolean));
    }
  } catch {
    // Fallback silently if offline or unauthenticated during dry-run
  }
  return null;
}

export function runSyncPreviewSecrets(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(`Usage: node scripts/sync-preview-secrets.mjs [options]

Syncs Cloudflare Worker secrets from process.env / .env.local using \`wrangler versions secret bulk\`.
Note: Cloudflare Workers Previews (\`wrangler.jsonc\` "previews") inherit Worker-level secrets;
use \`--env <name>\` only if you have defined an explicit \`env.<name>\` block.

Options:
  --dry-run            Inspect local + remote secrets without writing (default)
  --apply              Upload found secrets via \`npx wrangler versions secret bulk\`
  --all                Include all secret keys listed in wrangler.jsonc top-level vars
  --keys K1,K2         Explicit comma-separated secret keys to sync
  --env-file <path>    Path to env file (default: .env.local)
  -c, --config <path>  Wrangler config path (default: wrangler.jsonc)
  -e, --env <name>     Optional Wrangler environment name
  -h, --help           Show this help message`);
    return { ok: true, mode: "help" };
  }

  const configPath = resolve(opts.config);
  const wranglerText = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  let targetKeys;
  if (opts.keys.length > 0) {
    targetKeys = opts.keys;
  } else if (opts.all) {
    targetKeys = Array.from(
      new Set([...DEFAULT_PREVIEW_SECRET_KEYS, ...extractSecretKeysFromWrangler(wranglerText, "vars")]),
    );
  } else {
    targetKeys = Array.from(
      new Set([...DEFAULT_PREVIEW_SECRET_KEYS, ...extractSecretKeysFromWrangler(wranglerText, "previews")]),
    );
  }

  const { found, missing } = resolveSecrets({ keys: targetKeys, envFilePath: opts.envFile });
  const remoteKeys = getRemoteSecretNames(opts.config, opts.env);

  const report = targetKeys.map((key) => ({
    key,
    local: Boolean(found[key]),
    remote: remoteKeys ? remoteKeys.has(key) : "unknown",
  }));

  console.log(
    JSON.stringify(
      {
        mode: opts.apply ? "apply" : "dry-run",
        config: opts.config,
        env: opts.env || "(default/previews)",
        secrets: report,
        readyToUpload: Object.keys(found),
        missingLocally: missing,
      },
      null,
      2,
    ),
  );

  if (!opts.apply) {
    return { ok: true, mode: "dry-run", report, missing };
  }

  const foundEntries = Object.entries(found);
  if (foundEntries.length === 0) {
    throw new Error("No secret values found in environment or env file; aborting.");
  }

  const tempDir = mkdtempSync(join(tmpdir(), "cf-secrets-"));
  const secretFile = join(tempDir, "secrets.json");
  try {
    writeFileSync(secretFile, JSON.stringify(found), { encoding: "utf8", mode: 0o600 });
    chmodSync(secretFile, 0o600);
    const args = ["wrangler", "versions", "secret", "bulk", secretFile, "-c", opts.config];
    if (opts.env) args.push("--env", opts.env);
    execFileSync("npx", args, { stdio: "inherit" });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  return { ok: true, mode: "apply", uploaded: Object.keys(found), missing };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  runSyncPreviewSecrets();
}
