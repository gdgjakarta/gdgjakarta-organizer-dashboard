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
6. **Real-Time Print Queue (`system_settings/printer_queue`)**:
   - Stores up to 30 recent print jobs inside `system_settings/printer_queue`. When an attendee is checked in via `QRCheckinScannerDialog` with Auto-Print enabled, the scanner prioritizes event-level `printer_config` before falling back to system defaults, enqueuing a pending print job immediately rendered with all registration form answers.
7. **Local Print Worker (dialog-free printing)**:
   - A zero-dependency Node service on the check-in Mac (`npm run print-worker`, configured by `npm run print-worker:setup`) listens on `127.0.0.1:17777`. `POST /print` takes `{ html, widthMm, heightMm, copies? }`, renders a PDF with headless Chrome (resolves as soon as the PDF is written because Chrome can hang in teardown), and prints with `lp -o media=Custom.<W>x<H>mm -o scaling=100`. Jobs are serialized.
   - Security: loopback only, `Origin` allow-list from config (the dashboard origins entered during setup), `Access-Control-Allow-Private-Network` on preflight. Chrome may prompt once for local network access.
   - Dashboard: `executeSilentPrint` uses the worker when `GET /health` succeeds, otherwise falls back to the iframe + `--kiosk-printing` flow. A worker-side print error is surfaced (job marked `failed`) rather than silently falling back to a dialog. Override the URL with `localStorage["gdg_print_worker_url"]`.
   - The Firestore queue consumer is still the browser's Start Print Station listener, so the printers page must stay open. Paper size comes from the page's current config (not per-job/per-event).
8. **Printer pool & parallel printing**:
   - `config.json` holds `printers: [...]` (legacy `printer` string still accepted). The worker assigns every job to an idle printer on its own (least recently used first); the dashboard never sends a printer id. A single printer keeps strict FIFO order.
   - A printer that fails (`lp` error or CUPS `disabled`) is skipped for 30s and the job is retried on another printer; if all fail the job is rejected and marked `failed`. Jobs that find no free printer for 2 minutes are rejected.
   - `GET /health` → `{ printers: [{ name, state, busy, available, lastError }], queued }`, rendered by `print-worker-status.tsx` (header pill + popover).
   - Print Station listener (`printers-dashboard.tsx`) prints up to `printers.length` jobs at once and tracks handled job ids so a job is never printed twice. `enqueuePrintJob` / `updatePrintJobStatus` are Firestore transactions to avoid lost updates on the shared `jobs` array.
9. **Packaged worker & Install Worker button**:
   - `npm run print-worker:build` produces a self-contained Apple Silicon executable (Node SEA + ad-hoc codesign) as `scripts/print-worker/dist/gdg-print-worker-macos-arm64.tar.gz`. Build only works on darwin/arm64. The archive is ~42 MB and must be hosted outside the Worker bundle (R2 key `downloads/gdg-print-worker-macos-arm64.tar.gz`, or `NEXT_PUBLIC_PRINT_WORKER_DOWNLOAD_URL`).
   - Header **Install Worker** button: starts the download, then shows a dialog with copyable Terminal steps (extract, remove quarantine, `setup --origin <this dashboard origin>`) and a live "Worker connected" indicator (polls every 3s while open).
   - Executable CLI: `run`, `stop`, `setup [--origin]`, `uninstall`, `version`. There is **no auto-start**: the worker runs only while started by hand (setup offers to start it right away; it keeps running in that Terminal window, Ctrl+C or `stop` ends it). Setup remembers previous answers, keeps a stable copy at `~/.gdg-print-worker/bin/gdg-print-worker`, and removes any old launchd agent from earlier versions. The install dialog and the status popover both show the start/stop commands.
