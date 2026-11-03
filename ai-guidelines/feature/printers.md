# Thermal Printers & Label Station Feature Guide

## Overview
The **Thermal Printers & Label Station** (`/dashboard/printers`) allows organizers and check-in staff to configure **Clabel 221B** thermal sticker rolls, customize high-contrast HTML badge templates, preview and configure sample attendee/event data in real time, and run a background print station listener that automatically prints attendee badges upon QR check-in without browser dialogs (via Chrome `--kiosk-printing`).

## Key Files
- **Route**: `src/app/(main)/dashboard/printers/page.tsx`
- **Dashboard Component**: `src/app/(main)/dashboard/printers/_components/printers-dashboard.tsx`
- **Monaco HTML Editor & Live Preview**: `src/app/(main)/dashboard/printers/_components/label-html-editor-preview.tsx`
- **Event-Specific Badge Printer Tab**: `src/app/(main)/dashboard/events/[eventId]/_components/event-printer-tab.tsx`
- **Types & Presets**: `src/lib/printers/types.ts`
- **Template Engine & Dynamic Sizing**: `src/lib/printers/templates.ts`
- **Name Fitting & Escaping**: `src/lib/printers/name-fit.ts`
- **Offline SVG QR Generator**: `src/lib/printers/qr-svg.ts`
- **Check-In Scanner Integration**: `src/app/(main)/dashboard/events/[eventId]/_components/qr-checkin-scanner-dialog.tsx`
- **Local Print Worker**: `scripts/print-worker/{main,worker,setup,build}.mjs`, client in `src/lib/printers/local-worker.ts`, install UI in `src/app/(main)/dashboard/printers/_components/{install-print-worker-dialog,print-worker-status}.tsx`
- **Firestore Persistence**: `src/lib/firestore/client.ts` (`system_settings/printer`, `events/{eventId}.printer_config`, and `system_settings/printer_queue`)

## Architecture & Patterns
1. **Per-Event Badge Printer & Form Question Tokens**:
   - Each event features a dedicated **Badge Printer** tab under `/dashboard/events/[eventId]`.
   - Organizers can drag and drop answered registration form questions (e.g. `[[company_or_institution]]`, `[[role_or_title]]`, `[[years_of_experience]]`, or custom question IDs) directly into the badge HTML template.
   - `renderLabelTemplate` resolves question tokens dynamically against `reg.answers` and provides live preview simulation with configurable sample data.
2. **Paper & Roll Sizing Sync (`syncTemplateDimensions`)**:
   - Changing the preset (`50×30mm`, `40×30mm`, `60×40mm`), orientation (`landscape` / `portrait`), or custom millimeter dimensions dynamically updates `@page`, `body`, `.ticket-badge`, typography pt sizes, and QR millimeter dimensions inside the HTML template.
3. **Offline SVG QR Code (`generateQrSvgDataUrl`)**:
   - Generates a crisp, self-contained SVG `data:image/svg+xml` QR code encoding `eventId:attendeeId` locally with zero external network dependencies.
4. **Interactive Sample Data Configurator**:
   - Organizers can select a live Bevy event or specific attendee and customize sample attendee/event/question fields directly from the Live Preview toolbar.
5. **Floating Save Bar (`FloatingSaveBar`)**:
   - Tracks unsaved changes across roll dimensions, orientation, auto-print preferences, HTML template, selected event, and sample data using `src/app/(main)/dashboard/_components/floating-save-bar.tsx`.
6. **Real-Time Print Queue (`print_jobs/{jobId}`, see item 11)**:
   - One Firestore document per print job in `print_jobs` (older jobs in `system_settings/printer_queue` are no longer read). When an attendee is checked in via `QRCheckinScannerDialog` with Auto-Print enabled, the scanner prioritizes event-level `printer_config` before falling back to system defaults, enqueuing a pending print job immediately rendered with all registration form answers.
7. **Local Print Worker (dialog-free printing)**:
   - A zero-dependency Node service on the check-in Mac (`npm run print-worker`, configured by `npm run print-worker:setup`) listens on `127.0.0.1:17777`. `POST /print` takes `{ html, widthMm, heightMm, copies? }`, renders a PDF with headless Chrome (resolves as soon as the PDF is written because Chrome can hang in teardown), and prints with `lp -o media=Custom.<W>x<H>mm -o scaling=100`. Jobs are serialized.
   - Security: loopback only, `Origin` allow-list from config (the dashboard origins entered during setup), `Access-Control-Allow-Private-Network` on preflight. Chrome may prompt once for local network access.
   - Dashboard: `executeSilentPrint` uses the worker when `GET /health` succeeds, otherwise falls back to the iframe + `--kiosk-printing` flow. A worker-side print error is surfaced (job marked `failed`) rather than silently falling back to a dialog. Override the URL with `localStorage["gdg_print_worker_url"]`.
   - The queue consumer is the open dashboard tab of each laptop (Start Print Station), so the printers page must stay open (see item 11). Paper size comes from the page's current config (not per-job/per-event).
8. **Printer pool & parallel printing**:
   - `config.json` holds `printers: [...]` (legacy `printer` string still accepted). Without a `printer` field, `POST /print` still picks an idle printer on its own (least recently used first). The dashboard (v2.3.0+) always sends `printer` so the printer recorded on the job is the one that prints. A single printer keeps strict FIFO order.
   - A printer that fails (`lp` error or CUPS `disabled`) is skipped for 30s and the job is retried on another printer; if all fail the job is rejected and marked `failed`. Jobs that find no free printer for 2 minutes are rejected.
   - `GET /health` → `{ printers: [{ name, state, busy, available, lastError }], queued }`, rendered by `print-worker-status.tsx` (header pill + popover).
   - Print Station (`use-print-station.ts`) prints up to one job per idle printer at once; jobs are claimed in Firestore transactions so a job is never printed twice (see item 11).
9. **Packaged worker & Install Worker button**:
   - `npm run print-worker:build` produces a self-contained Apple Silicon executable (Node SEA + ad-hoc codesign) as `scripts/print-worker/dist/gdg-print-worker-macos-arm64.tar.gz`. Build only works on darwin/arm64. The archive is ~42 MB and must be hosted outside the Worker bundle (uploaded via the Media page as `community-dashboard/app/gdg-print-worker-macos-arm64-tar.gz`, served at `https://gdgjakarta.com/api/media/community-dashboard/app/gdg-print-worker-macos-arm64-tar.gz`, or override with `NEXT_PUBLIC_PRINT_WORKER_DOWNLOAD_URL`). The default URL is the `PRINT_WORKER_DOWNLOAD_URL` constant in `local-worker.ts`, so the button never falls back to a relative path.
   - Header **Install Worker** button: starts the download, then shows a dialog with copyable Terminal steps (extract, remove quarantine, `setup --origin https://gdgjakarta.com` (plus the current origin when the page is open elsewhere, e.g. localhost)) and a live "Worker connected" indicator (polls every 3s while open).
   - Executable CLI: `run`, `stop`, `setup [--origin]`, `uninstall`, `version`. There is **no auto-start**: the worker runs only while started by hand (setup offers to start it right away; it keeps running in that Terminal window, Ctrl+C or `stop` ends it). Setup remembers previous answers, keeps a stable copy at `~/.gdg-print-worker/bin/gdg-print-worker`, and removes any old launchd agent from earlier versions. The install dialog and the status popover both show the start/stop commands.
10. **Name fitting & safe templating**:
   - Names that do not fit their box are handled by a script injected into the print document (`injectNameFit` in `name-fit.ts`, used by `buildPrintDocument` and the editor preview). Cascade: full name -> last word as initial (`Muhammad Fachridan T.`) -> one more word from the back each time (`Muhammad F. T.`) -> all initials (`M. F. T.`); the first that fits within 2 lines wins and the first name is only abbreviated in the last step. The font size is NOT changed by default; add `data-fit-min="6"` (pt) to an element to also allow shrinking (each variant is tried down to that size before moving to a shorter one). Single words are truncated with `…`. Other overrides: `data-fit-lines`; opt a custom element in with `data-fit-name`.
   - Tokens: `[[nameShort]]` (last word as initial) and `[[nameInitials]]`.
   - All token and answer values are HTML-escaped (brackets included) in `renderLabelTemplate`, so names containing `<`, `&`, `"` or `[[token]]` render as plain text and cannot break or inject into the label.
11. **Multi-laptop stations, job assignment & failures** (worker v2.3.0):
   - **One Station ID per Physical Laptop (Never per Tab)**: Each connected laptop reports to `print_workers/{deviceId}` using a **device-scoped** ID persisted in `localStorage` (or derived from the worker's `GET /health` `device` identity) with single-tab leader coordination (`BroadcastChannel` / lock), NEVER `sessionStorage` per tab. Opening multiple tabs on the same laptop must NEVER display duplicate laptops in `Workers & Printers` or double-claim jobs for the same USB printers.
   - **Device-Scoped Printer Identity (`deviceId::printerName`)**: A printer is uniquely identified by `printerKey(deviceId, printerName)`. Two printers with the **same name on different laptops** (e.g., `CT221B` on Laptop A and `CT221B` on Laptop B) are distinct physical printers and print queued jobs in parallel.
   - **Assignment (load balancing)**: while Start Print Station is on, each tab watches `print_jobs` with `status == "pending"` and, for every idle local printer (least recently used first, skipping printers that already failed that job), calls `claimPrintJob` — a Firestore transaction that flips `pending -> printing` and writes `assigned_station_id/name`, `assigned_printer`, `assigned_at` and an `attempts[]` entry. Only one claimant can win, so one job is held by exactly one printer on exactly one laptop. Busy printers do not claim, so load spreads over idle printers; with none idle, jobs wait in `pending`. The tab then calls `POST /print` with `printer: <name>` (pinned: the worker never moves a pinned job to another printer).
   - **Failures**: a failed print goes through `finishPrintJob`: if another online, running printer exists that is not in `excluded_printers` and `MAX_PRINT_ATTEMPTS` (3) is not used up, the job returns to `pending` with the failed printer excluded (each try stays in `attempts[]`); otherwise it becomes `failed` with `failed_at`, `error_message` and the attempt history. The Print Queue shows **Printed on** (printer + laptop), error text, attempt count and a **Retry** button (`retryPrintJob`, fresh budget, exclusions cleared). Reprint enqueues a new job.
   - **Lost laptops**: any online tab sweeps every 15s; a `printing` job whose holder has sent no heartbeat for 120s (`PRINT_STATION_LOST_MS`), or that this tab holds without working on it (reloaded mid-print, >30s), is failed with a "check whether the label came out" message. It is never auto-reassigned because the label may already be printed.
   - **Direct prints**: Test Print enqueues when this laptop's station runs; otherwise it prints directly and logs a `completed` job with `printedBy`. Laptops without a worker appear with a single "Browser print dialog" printer and print through the iframe.
   - **Rules** (`firestore.rules`): `print_jobs` and `print_workers` are readable/writable by team access only (organizers + check-in staff); `print_jobs` holds attendee names so it is never public. Old workers (<2.3.0) ignore `printer` and omit `device`: the real printer is recorded from the response, the laptop shows as "This laptop".
   - **Identical printers (same USB serial)**: two printers of one model (e.g. Clabel CT221B) usually report the same USB serial, so CUPS gives their queues the same device URI (`usb://Clabel-/CT221B?serial=000000000004`) and every label prints on one of them, whatever the queue names are. Fix: point each queue to its own USB port with `lpadmin -p <queue> -v "usb://<Make>/<Model>?location=<8 hex digits>"` (locationID from `ioreg -p IOUSB -l -w0`, converted to hex; **drop `serial=`**, CUPS ignores `location=` while a serial is present), then verify one label per queue. The worker reads queue URIs (`lpstat -v`), the setup prints them and warns about shared ones, `/health` returns `printers[].uri`, and the Workers & Printers card flags printers sharing a `device_uri`. The mapping is tied to the physical USB port: keep each printer in the same port.
   - The Install Worker dialog (`install-print-worker-dialog.tsx`, English) has two parts. **Part 1, set up the printers**: 1 install the driver (`https://ga.ctaiot.com/`), 2 connect the printers, 3 System Settings -> Printers & Scanners -> Add Printer, 4 add each printer with a unique name, 5 check they are listed. **Part 2, install the worker**: 6 download, 7 Terminal commands, 8 setup questions (incl. the shared-device warning), 9 local network access, Start Print Station, Test Print. Guide screenshots are served from the Media page (`community-dashboard/media/`, base `GUIDE_IMAGE_BASE_URL`): `printer-setup-3a-printers-and-scanners-empty.jpg`, `printer-setup-3b-add-printer-dialog.jpg`, `printer-setup-4-add-printer-select-and-name.jpg`, `printer-setup-5-printers-added.jpg`, `printer-setup-8a-terminal-printers.png`, `printer-setup-8b-terminal-start-worker.png`. `GuideImage` hides itself while a file is not uploaded yet.

## 12. Architectural Invariants & Post-Mortem Guardrails

Whenever modifying `use-print-station.ts`, `printers-dashboard.tsx`, `qr-checkin-scanner-dialog.tsx`, `registrants-tab.tsx`, `src/lib/firestore/client.ts`, or `scripts/print-worker/`, enforce these invariants:

### Core Multi-Device & Check-In Auto-Print Invariants
1. **Universal Check-In -> Print Queue Enqueue**:
   - Whenever an attendee's main check-in transitions to `is_checked_in: true` and `auto_print_on_checkin` is enabled (in event `printer_config` or system `system_settings/printer`), the attendee's rendered badge MUST be added to `print_jobs`—regardless of where the organizer triggered the check-in (QR Scanner `main_checkin`, Registrants table `handleToggleCheckIn`, Applicant Detail dialog, or a running Print Station listening to `event_registrations` check-in transitions).
   - Use a deterministic job ID (e.g., `job_${eventId}_${registrationId}`) or check-in dedupe guard so simultaneous listeners or repeated scans do not enqueue duplicate labels.
2. **One Station Entry Per Physical Device (Deduplicated Laptops)**:
   - Never use `sessionStorage` for `stationId`. Persist a single `gdg_print_station_device_id` in `localStorage` (and deduplicate by worker `device.computerName` / hardware identity) so one physical laptop always maps to exactly **one** `print_workers/{deviceId}` document, even if the organizer opens multiple dashboard tabs.
   - Coordinate tabs on the same laptop via `BroadcastChannel` or a `localStorage` leader lease so only one tab on that laptop runs the claim/drain loop for its local worker.
3. **Composite Printer Identity (`deviceId::printerName`) & Cross-Device Load Distribution**:
   - Always identify printers by the composite key `printerKey(stationId, printerName)` (`${stationId}::${printerName}`).
   - Printer names are only local to a laptop's CUPS instance. If Laptop 1 has `Clabel_CT221B` and Laptop 2 has `Clabel_CT221B`, they are two separate printers (`stn_laptop1::Clabel_CT221B` and `stn_laptop2::Clabel_CT221B`).
   - Queued jobs in `print_jobs` must distribute across all idle `(stationId, printerName)` units across all online stations.
4. **Persistent Station State Across Navigation (`A`)**:
   - Persist `isStationRunning` in `localStorage` and keep the Print Station active across dashboard route changes (or warn prominently on the scanner when no station is online).
5. **Never Swallow Firestore Errors (`B`)**:
   - In `subscribePendingPrintQueue`, `subscribeRecentPrintQueue`, and `subscribePrintStations`, never silently convert `permission-denied` into `onUpdate([])`. Surface a visible error banner.
6. **Claim Backoff & Presence Debounce (`C`)**:
   - Never call `drain()` and `publishPresence()` in an unthrottled `finally` loop when `claimPrintJob` fails or loses a transaction race. Apply per-job backoff and debounce presence writes.
7. **No Silent Browser-Dialog Claiming (`F`)**:
   - When `GET /health` fails, mark the station `offline` rather than silently claiming Firestore jobs into `"Browser print dialog"` (`setTimeout(resolve, 600)`).
8. **Track CUPS Job Completion (`D`) & Store Job Paper Size (`J`)**:
   - Verify CUPS completion (`lpstat -W not-completed -o <queue>`) rather than treating `lp` exit 0 as printed, and store `paper_width_mm`, `paper_height_mm`, and `orientation` on each `print_jobs` document at enqueue time.
9. **Test USB Port Detection on Real Hardware (`E`)**:
   - Never ship `ioreg` / `lpadmin` USB auto-detection without verifying on physical Clabel CT221B printers plugged into multiple USB ports.
10. **Hosted Worker Archive (`gdg-print-worker-macos-arm64-tar.gz`), Version Gate & `chromePath` Validation**:
   - Canonical download URL: `https://gdgjakarta.com/api/media/community-dashboard/app/gdg-print-worker-macos-arm64-tar.gz` (`PRINT_WORKER_DOWNLOAD_URL` in `src/lib/printers/local-worker.ts`; ~43.7 MB, never place in `public/`).
   - **Minimum Worker Version Gate**: Workers older than `2.3.0` (e.g. `2.1.0`) omit `health.device` and `printers[].uri` and ignore `POST /print` `printer` pinning, causing every laptop to appear as `"This laptop"`. The dashboard must warn when `health.version < "2.3.0"` and prompt to re-download and run `./gdg-print-worker setup`.
   - **`chromePath` Validation**: `setup.mjs` and `worker.mjs` must never accept a `.app` directory (e.g. `/Applications/yab.app`) as `chromePath` using `existsSync` alone; resolve `.app/Contents/MacOS/<Binary>`, verify `stat.isFile()`, and verify `--version` at setup/startup.
11. **Universal Browser Support (Chromium & WebKit / Safari)**:
   - **Dashboard UI & Loopback Client (`local-worker.ts`, `printers-dashboard.tsx`)**: Must work identically in Chromium (Chrome, Brave, Edge, Arc) and WebKit (Safari, Orion). Probe `http://127.0.0.1:17777` with automatic fallback to `http://localhost:17777` if WebKit blocks numeric IP loopback, and wait for `document.fonts.ready` + `requestAnimationFrame` before `iframe.contentWindow.print()` in browser-print mode.
   - **Label CSS (`templates.ts`)**: Include `-webkit-print-color-adjust: exact; print-color-adjust: exact;` and `-webkit-optimize-contrast` / `crisp-edges` alongside `pixelated` so QR codes and pills render sharply in both Blink and WebKit print engines.
   - **Worker PDF Renderer (`scripts/print-worker/`)**: Auto-detect all Chromium `.app` bundles (Chrome, Brave, Edge, Arc, Vivaldi, Chromium—automatically resolving `.app/Contents/MacOS/<Binary>`), and provide a native macOS WebKit (`WKWebView` / Swift) PDF render fallback so Safari-only Macs can run the print worker without installing Chrome.

### Prioritized Fix Order
| # | Fix | Closes |
|---|---|---|
| 1 | Status banners on scanner and printers pages: station online/offline, waiting job count, visible Firestore errors | A, B |
| 2 | Persistent station (`localStorage` auto-resume, single device ID per physical laptop, universal check-in auto-print enqueue) | A, K |
| 3 | Claim backoff, `publishPresence` debounce, pause on consecutive errors | C |
| 4 | Remove automatic browser fallback for queue claiming; unreachable worker = offline | F |
| 5 | Worker tracks CUPS job until completed/aborted, cancels stale jobs, returns `queueDepth` | D |
| 6 | `jobId` idempotency key in worker; deterministic job IDs in check-in enqueue | G, H |
| 7 | Per-USB-port printer detection (from `git stash@{0}` v2.4–2.6), tested with real printers | E |
| 8 | Paper size stored on job document; persistent Chrome instance for speed; queue-length indicator | I, J |
