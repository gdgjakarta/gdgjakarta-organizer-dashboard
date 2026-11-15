#!/usr/bin/env node
// Builds the Native macOS Menu Bar + Notch Dynamic Island Print Station (`GDG Print Station.app`):
//   npm run print-worker:build   ->   scripts/print-worker/dist/gdg-print-worker-macos-arm64.tar.gz
//
// Also installs `/Applications/GDG Print Station.app`, cleans up any legacy Node SEA CLI worker in
// `~/.gdg-print-worker/bin`, and creates a lightweight CLI wrapper `dist/gdg-print-worker` for compatibility.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(ROOT, "dist");
const SWIFT_SOURCE = join(ROOT, "macos-app", "GDGPrintStation.swift");
const APP_BUNDLE_NAME = "GDG Print Station.app";
const APP_EXECUTABLE_NAME = "GDGPrintStation";
const LEGACY_CLI_NAME = "gdg-print-worker";
const DMG_NAME = "GDG-Print-Station-macOS.dmg";
const ZIP_NAME = "GDG-Print-Station-macOS.zip";
const ARCHIVE_NAME = "gdg-print-worker-macos-arm64.tar.gz";

if (process.platform !== "darwin") {
  console.error("GDG Print Station.app can only be built on macOS (darwin).");
  process.exit(1);
}

const run = async (cmd, args, options) => {
  const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...options });
  return stdout;
};

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>GDG Print Station</string>
  <key>CFBundleExecutable</key>
  <string>${APP_EXECUTABLE_NAME}</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIconName</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>org.gdgjakarta.print-station</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>GDG Print Station</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>2.4.0</string>
  <key>CFBundleVersion</key>
  <string>240</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`;

async function cleanupLegacyWorkerInstallation() {
  const home = homedir();
  const configPath = join(home, ".gdg-print-worker", "config.json");
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(await readFile(configPath, "utf8"));
      if (cfg.chromePath && !existsSync(cfg.chromePath)) {
        delete cfg.chromePath;
      }
      const defaultOrigins = ["https://gdgjakarta.com", "https://www.gdgjakarta.com", "http://localhost:3000"];
      cfg.allowedOrigins = [...new Set([...(cfg.allowedOrigins ?? []), ...defaultOrigins])];
      await writeFile(configPath, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
    } catch {
      // ignore malformed config
    }
  }

  // Remove obsolete ~145 MB Node SEA binary & LaunchAgent if present
  const legacyBinDir = join(home, ".gdg-print-worker", "bin");
  const legacyPlist = join(home, "Library", "LaunchAgents", "org.gdgjakarta.print-worker.plist");
  if (existsSync(legacyPlist)) {
    await run("launchctl", ["unload", legacyPlist]).catch(() => undefined);
    await rm(legacyPlist, { force: true });
  }
  if (existsSync(legacyBinDir)) {
    await rm(legacyBinDir, { recursive: true, force: true });
    console.log("Cleaned up legacy ~/.gdg-print-worker/bin installation.");
  }
}

async function main() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  const appBundleDir = join(DIST_DIR, APP_BUNDLE_NAME);
  const contentsDir = join(appBundleDir, "Contents");
  const macosDir = join(contentsDir, "MacOS");
  const resourcesDir = join(contentsDir, "Resources");
  await mkdir(macosDir, { recursive: true });
  await mkdir(resourcesDir, { recursive: true });

  await writeFile(join(contentsDir, "Info.plist"), INFO_PLIST, "utf8");

  // Build AppIcon.icns from public/favicon/favicon.ico (using sips + iconutil)
  const faviconIcoPath = join(ROOT, "..", "..", "public", "favicon", "favicon.ico");
  const faviconHiResPath = join(ROOT, "..", "..", "public", "favicon", "android-chrome-512x512.png");
  const iconSource = existsSync(faviconIcoPath) ? faviconIcoPath : faviconHiResPath;
  if (existsSync(iconSource)) {
    const iconsetDir = join(DIST_DIR, "AppIcon.iconset");
    await rm(iconsetDir, { recursive: true, force: true });
    await mkdir(iconsetDir, { recursive: true });
    // Convert favicon.ico -> base PNG via sips, using 512px PNG for high-res retina slots if available
    const basePng = join(iconsetDir, "_base.png");
    await run("sips", ["-s", "format", "png", iconSource, "--out", basePng]);
    const hiResPng = existsSync(faviconHiResPath) ? faviconHiResPath : basePng;
    const sizes = [
      ["icon_16x16.png", 16, basePng],
      ["icon_16x16@2x.png", 32, basePng],
      ["icon_32x32.png", 32, basePng],
      ["icon_32x32@2x.png", 64, hiResPng],
      ["icon_128x128.png", 128, hiResPng],
      ["icon_128x128@2x.png", 256, hiResPng],
      ["icon_256x256.png", 256, hiResPng],
      ["icon_256x256@2x.png", 512, hiResPng],
      ["icon_512x512.png", 512, hiResPng],
      ["icon_512x512@2x.png", 1024, hiResPng],
    ];
    for (const [name, px, src] of sizes) {
      await run("sips", ["-s", "format", "png", "-z", String(px), String(px), src, "--out", join(iconsetDir, name)]);
    }
    await rm(basePng, { force: true });
    await run("iconutil", ["-c", "icns", iconsetDir, "-o", join(resourcesDir, "AppIcon.icns")]);
    await cp(faviconIcoPath, join(resourcesDir, "favicon.ico"));
    await rm(iconsetDir, { recursive: true, force: true });
  }

  const compiledBinaryPath = join(macosDir, APP_EXECUTABLE_NAME);
  console.log("Compiling native macOS Menu Bar + Notch Dynamic Island app (GDG Print Station.app)...");
  await run("swiftc", [
    "-O",
    "-target",
    "arm64-apple-macosx13.0",
    "-framework",
    "AppKit",
    "-framework",
    "WebKit",
    "-framework",
    "Network",
    SWIFT_SOURCE,
    "-o",
    compiledBinaryPath,
  ]);
  await chmod(compiledBinaryPath, 0o755);

  // Also provide `gdg-print-worker` launcher in dist/ so existing CLI commands (`./gdg-print-worker setup`) launch the Menu Bar app seamlessly
  const cliLauncherPath = join(DIST_DIR, LEGACY_CLI_NAME);
  await cp(compiledBinaryPath, cliLauncherPath);
  await chmod(cliLauncherPath, 0o755);

  // Sign with Apple Development / Developer ID if available, falling back to ad-hoc codesign
  let signIdentity = "-";
  try {
    const identities = await run("security", ["find-identity", "-v", "-p", "codesigning"]);
    const devIdMatch = identities.match(/"(Developer ID Application:[^"]+)"/);
    const appleDevMatch = identities.match(/"(Apple Development:[^"]+)"/);
    if (devIdMatch?.[1]) signIdentity = devIdMatch[1];
    else if (appleDevMatch?.[1]) signIdentity = appleDevMatch[1];
  } catch {
    // fallback to ad-hoc "-"
  }
  console.log(`Signing with identity: ${signIdentity}`);
  await run("codesign", ["--force", "--deep", "--options", "runtime", "--sign", signIdentity, appBundleDir]);
  await run("codesign", ["--force", "--options", "runtime", "--sign", signIdentity, cliLauncherPath]);

  // 1. Build standard macOS Disk Image (.dmg) with GDG Print Station.app + Applications shortcut + Double-Click Installer
  const dmgStagingDir = join(DIST_DIR, ".dmg-staging");
  await rm(dmgStagingDir, { recursive: true, force: true });
  await mkdir(dmgStagingDir, { recursive: true });
  await cp(appBundleDir, join(dmgStagingDir, APP_BUNDLE_NAME), { recursive: true });
  await run("ln", ["-s", "/Applications", join(dmgStagingDir, "Applications")]);

  const installerCommandPath = join(dmgStagingDir, "Install & Open GDG Print Station.command");
  const installerScript = [
    "#!/bin/bash",
    'DIR="$(cd "$(dirname "$0")" && pwd)"',
    'echo "Cleaning up any legacy GDG Print Worker..."',
    "pkill -f gdg-print-worker 2>/dev/null || true",
    "pkill -f GDGPrintStation 2>/dev/null || true",
    "rm -rf ~/.gdg-print-worker/bin ~/Library/LaunchAgents/org.gdgjakarta.print-worker.plist 2>/dev/null || true",
    'echo "Installing GDG Print Station.app to /Applications..."',
    'rm -rf "/Applications/GDG Print Station.app"',
    'cp -R "$DIR/GDG Print Station.app" "/Applications/GDG Print Station.app"',
    'xattr -cr "/Applications/GDG Print Station.app" 2>/dev/null || true',
    'open -a "/Applications/GDG Print Station.app"',
    'echo "GDG Print Station is now running in your macOS Menu Bar!"',
    "sleep 1",
    "osascript -e 'tell application \"Terminal\" to close first window' &>/dev/null || true",
  ].join("\n");
  await writeFile(installerCommandPath, `${installerScript}\n`, "utf8");
  await chmod(installerCommandPath, 0o755);

  const dmgPath = join(DIST_DIR, DMG_NAME);
  await rm(dmgPath, { force: true });
  await run("hdiutil", [
    "create",
    "-volname",
    "GDG Print Station",
    "-srcfolder",
    dmgStagingDir,
    "-ov",
    "-format",
    "UDZO",
    dmgPath,
  ]);
  await rm(dmgStagingDir, { recursive: true, force: true });

  // 2. Build macOS .zip bundle (Finder / Safari auto-unzips directly into GDG Print Station.app)
  const zipPath = join(DIST_DIR, ZIP_NAME);
  await rm(zipPath, { force: true });
  await run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appBundleDir, zipPath]);

  // 3. Keep legacy .tar.gz for backward compatibility
  const archivePath = join(DIST_DIR, ARCHIVE_NAME);
  await run("tar", ["-czf", archivePath, "-C", DIST_DIR, APP_BUNDLE_NAME, LEGACY_CLI_NAME]);

  // 4. Write 1-line remote installer script (`install-macos.sh`) so organizers only run a single `curl | bash` command
  const installShPath = join(DIST_DIR, "install-macos.sh");
  const installShContent = [
    "#!/usr/bin/env bash",
    "set -e",
    'echo "1/3 Cleaning up legacy GDG Print Worker (if any)..."',
    "pkill -f gdg-print-worker 2>/dev/null || true",
    "pkill -f GDGPrintStation 2>/dev/null || true",
    "launchctl unload ~/Library/LaunchAgents/org.gdgjakarta.print-worker.plist 2>/dev/null || true",
    "rm -rf ~/.gdg-print-worker/bin ~/Library/LaunchAgents/org.gdgjakarta.print-worker.plist 2>/dev/null || true",
    'echo "2/3 Downloading GDG Print Station.app (v2.4.0)..."',
    'curl -fsSL "https://gdgjakarta.com/api/media/community-dashboard/app/GDG-Print-Station-macOS.dmg?v=2.4.0" -o /tmp/GDG-Print-Station.dmg',
    "hdiutil attach /tmp/GDG-Print-Station.dmg -nobrowse -quiet",
    'rm -rf "/Applications/GDG Print Station.app"',
    'cp -R "/Volumes/GDG Print Station/GDG Print Station.app" "/Applications/GDG Print Station.app"',
    'hdiutil detach "/Volumes/GDG Print Station" -quiet 2>/dev/null || true',
    "rm -f /tmp/GDG-Print-Station.dmg",
    'xattr -cr "/Applications/GDG Print Station.app" 2>/dev/null || true',
    'echo "3/3 Launching GDG Print Station.app in your macOS Menu Bar..."',
    'open -a "/Applications/GDG Print Station.app"',
    'echo "✅ Done! GDG Print Station.app is running in your top-right Menu Bar."',
  ].join("\n");
  await writeFile(installShPath, `${installShContent}\n`, "utf8");
  await chmod(installShPath, 0o755);

  // Clean up any legacy Node SEA CLI worker on this machine and install GDG Print Station.app to /Applications
  await cleanupLegacyWorkerInstallation();
  const applicationsDest = join("/Applications", APP_BUNDLE_NAME);
  try {
    await rm(applicationsDest, { recursive: true, force: true });
    await cp(appBundleDir, applicationsDest, { recursive: true });
    console.log(`Installed ${applicationsDest}`);
  } catch (err) {
    console.warn(`Could not copy to /Applications (${err.message}); bundle is ready in ${appBundleDir}`);
  }

  const version = (await run(compiledBinaryPath, ["version"])).trim();
  const dmgSha = createHash("sha256")
    .update(await readFile(dmgPath))
    .digest("hex");
  const kb = (bytes) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

  console.log(`\nBuilt GDG Print Station.app v${version}`);
  console.log(`  app bundle : ${appBundleDir} (${kb((await stat(compiledBinaryPath)).size)})`);
  console.log(`  macos dmg  : ${dmgPath} (${kb((await stat(dmgPath)).size)})`);
  console.log(`  macos zip  : ${zipPath} (${kb((await stat(zipPath)).size)})`);
  console.log(`  sha256     : ${dmgSha}`);
}

try {
  await main();
} catch (err) {
  console.error(`\nBuild failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
}
