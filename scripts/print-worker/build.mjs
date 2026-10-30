#!/usr/bin/env node
// Packages the print worker into one self-contained macOS (Apple Silicon) executable:
//   npm run print-worker:build   ->   scripts/print-worker/dist/gdg-print-worker-macos-arm64.tar.gz
//
// Steps: bundle main.mjs with esbuild -> inject into an official Node binary (Node single executable
// application) -> ad-hoc codesign (macOS kills a modified binary otherwise) -> tar.gz.
// The result is ~145 MB (~43 MB compressed), far over Cloudflare's 25 MiB static asset limit, so host it
// elsewhere (R2 / GitHub Release) and point NEXT_PUBLIC_PRINT_WORKER_DOWNLOAD_URL at it. Never put it in public/.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(ROOT, ".cache");
const DIST_DIR = join(ROOT, "dist");
const BINARY_NAME = "gdg-print-worker";
const ARCHIVE_NAME = "gdg-print-worker-macos-arm64.tar.gz";

if (process.platform !== "darwin" || process.arch !== "arm64") {
  console.error("The executable can only be built on an Apple Silicon Mac (darwin/arm64).");
  process.exit(1);
}

const run = async (cmd, args, options) => {
  const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...options });
  return stdout;
};

async function supportsSea(nodePath) {
  try {
    const help = await run(nodePath, ["--help"]);
    // Distro builds (e.g. Homebrew) list the flag but answer "Single executable application is disabled".
    await run(nodePath, ["--build-sea", join(CACHE_DIR, "__missing__.json")]).catch((err) => {
      if (String(err.stderr ?? err.message).includes("is disabled")) throw err;
    });
    return help.includes("--build-sea");
  } catch {
    return false;
  }
}

/** Official nodejs.org build of the same version as the running Node (distro builds lack SEA support). */
async function ensureSeaNode() {
  if (process.env.SEA_NODE) return process.env.SEA_NODE;
  await mkdir(CACHE_DIR, { recursive: true });
  if (await supportsSea(process.execPath)) return process.execPath;

  const version = process.version;
  const dirName = `node-${version}-darwin-arm64`;
  const cachedNode = join(CACHE_DIR, dirName, "bin", "node");
  if (existsSync(cachedNode)) return cachedNode;

  console.log(`Downloading official Node ${version} (this Node was built without SEA support)...`);
  const base = `https://nodejs.org/dist/${version}`;
  const tarball = join(CACHE_DIR, `${dirName}.tar.gz`);
  const archive = Buffer.from(await (await fetch(`${base}/${dirName}.tar.gz`)).arrayBuffer());
  const sums = await (await fetch(`${base}/SHASUMS256.txt`)).text();
  const expected = sums
    .split("\n")
    .find((line) => line.endsWith(`${dirName}.tar.gz`))
    ?.split(/\s+/)[0];
  const actual = createHash("sha256").update(archive).digest("hex");
  if (!expected || expected !== actual) throw new Error("Checksum mismatch for the downloaded Node archive.");
  await writeFile(tarball, archive);
  await run("tar", ["-xzf", tarball, "-C", CACHE_DIR]);
  await rm(tarball, { force: true });
  return cachedNode;
}

async function loadEsbuild() {
  try {
    // biome-ignore lint/correctness/noUndeclaredDependencies: esbuild ships with the OpenNext/Wrangler toolchain
    return await import("esbuild");
  } catch {
    throw new Error("esbuild not found. Run `npm install` in the project root first.");
  }
}

async function main() {
  const seaNode = await ensureSeaNode();
  const { build } = await loadEsbuild();

  const buildDir = join(CACHE_DIR, "build");
  await rm(buildDir, { recursive: true, force: true });
  await mkdir(buildDir, { recursive: true });
  await mkdir(DIST_DIR, { recursive: true });

  const bundlePath = join(buildDir, "bundle.mjs");
  await build({
    entryPoints: [join(ROOT, "main.mjs")],
    outfile: bundlePath,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    legalComments: "none",
  });

  const binaryPath = join(DIST_DIR, BINARY_NAME);
  const seaConfigPath = join(buildDir, "sea-config.json");
  await rm(binaryPath, { force: true });
  await writeFile(
    seaConfigPath,
    JSON.stringify({ main: bundlePath, mainFormat: "module", output: binaryPath, disableExperimentalSEAWarning: true }),
  );
  await run(seaNode, ["--build-sea", seaConfigPath]);

  // The injected binary's original signature is invalid; without a fresh one macOS kills it on launch.
  await run("codesign", ["--force", "--sign", "-", binaryPath]);

  const archivePath = join(DIST_DIR, ARCHIVE_NAME);
  await rm(archivePath, { force: true });
  await run("tar", ["-czf", archivePath, "-C", DIST_DIR, BINARY_NAME]);

  const version = (await run(binaryPath, ["version"])).trim();
  const sha = createHash("sha256")
    .update(await readFile(archivePath))
    .digest("hex");
  const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  console.log(`\nBuilt gdg-print-worker v${version}`);
  console.log(`  executable : ${binaryPath} (${mb((await stat(binaryPath)).size)})`);
  console.log(`  archive    : ${archivePath} (${mb((await stat(archivePath)).size)})`);
  console.log(`  sha256     : ${sha}`);
  console.log(`\nUpload the archive (R2 / GitHub Release) and set NEXT_PUBLIC_PRINT_WORKER_DOWNLOAD_URL to its URL.`);
}

try {
  await main();
} catch (err) {
  console.error(`\nBuild failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
}
