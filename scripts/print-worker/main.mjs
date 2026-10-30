#!/usr/bin/env node
// GDG Print Worker command line entry (also the entry of the packaged executable, see build.mjs).
//   gdg-print-worker run                 start the local print service (keep the Terminal open; Ctrl+C stops it)
//   gdg-print-worker stop                stop a running print service
//   gdg-print-worker setup [--origin U]  choose printers and allowed dashboard origin(s), then start it
//   gdg-print-worker uninstall           remove the installed program (and any old auto-start agent)
//   gdg-print-worker version

import { normalizeOrigin, runSetup, runUninstall } from "./setup.mjs";
import { startWorker, stopWorker, VERSION } from "./worker.mjs";

const USAGE = `GDG Print Worker v${VERSION}

Usage: gdg-print-worker <command>

  run                        Start the local print service (Ctrl+C stops it)
  stop                       Stop a running print service
  setup [--origin <url>]     Choose printers and dashboard address (default https://gdgjakarta.com), then start the worker
                             --origin can be repeated to allow several addresses
  uninstall                  Remove the installed program
  version                    Show the version
`;

function readOrigins(args) {
  const origins = [];
  args.forEach((arg, i) => {
    if (arg === "--origin" && args[i + 1]) origins.push(args[i + 1]);
    if (arg.startsWith("--origin=")) origins.push(arg.slice("--origin=".length));
  });
  return origins.filter((o) => o.trim()).map(normalizeOrigin);
}

// Same layout for `node main.mjs <args>` and the packaged executable: user arguments start at index 2.
const [command = "help", ...rest] = process.argv.slice(2);

try {
  switch (command) {
    case "run":
      await startWorker();
      break;
    case "stop":
      await stopWorker();
      break;
    case "setup": {
      const { startNow } = await runSetup({ origins: readOrigins(rest) });
      if (startNow) {
        console.log("\nStarting the worker. Keep this window open while printing; press Ctrl+C to stop.\n");
        await startWorker();
      }
      break;
    }
    case "uninstall":
      await runUninstall();
      break;
    case "version":
    case "--version":
      console.log(VERSION);
      break;
    default:
      console.log(USAGE);
      process.exitCode = command === "help" || command === "--help" ? 0 : 1;
  }
} catch (err) {
  console.error(`\nFailed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
}
