---
name: print-station-diagnostics
description: >-
  Architectural invariants, multi-device queue rules, diagnostic runbook, weakness checklist (A-L),
  and pre-event go/no-go verification procedure for the GDG Jakarta Thermal Print Station and macOS
  Local Print Worker. Use whenever debugging badge printing issues, fixing duplicate laptop stations,
  wiring check-in auto-print to the queue, or modifying scripts/print-worker/, use-print-station.ts,
  printers-dashboard.tsx, registrants-tab.tsx, or qr-checkin-scanner-dialog.tsx.
---

# Print Station Architecture, Diagnostics & Verification Skill

Use this skill whenever modifying or debugging the badge printing pipeline (`Check-In` -> Firestore `print_jobs` -> `usePrintStation` -> Local Print Worker -> CUPS -> USB printer).

## 1. Core Architectural Invariants (Must Always Hold)

### A. One Physical Laptop = One `print_workers` Station (Never Per-Tab)
- **Bug to avoid**: Generating `stationId` in `sessionStorage` creates a new station document for every open tab on the same laptop, showing duplicate laptops in `Workers & Printers` and causing tabs on the same laptop to fight over the same local worker.
- **Required pattern**:
  1. Persist `stationId` in `localStorage` (`gdg_print_station_device_id`) and/or key by the worker's hardware identity (`health.device.computerName` + `model`).
  2. In `PrintStationsCard` and station sweeping, deduplicate stations from the same physical machine if stale tab IDs exist.
  3. Use `BroadcastChannel("gdg_print_station")` or a `localStorage` leader lock so only **one active tab per physical laptop** runs `drain()` and heartbeats `print_workers/{stationId}`.

### B. Universal Check-In Auto-Print Enqueue (Wherever Check-In Happens)
- **Bug to avoid**: Only enqueueing print jobs inside `QRCheckinScannerDialog` (`main_checkin` mode) while ignoring manual check-ins in `registrants-tab.tsx` (`handleToggleCheckIn`), `applicant-detail-dialog.tsx`, or when the Print Station is open on another screen.
- **Required pattern**:
  1. Extract a shared helper (e.g., `enqueueCheckInBadgePrintJob(eventId, registration, eventDoc, questions)`) that checks event-level `printer_config` (falling back to `system_settings/printer`), verifies `enabled && auto_print_on_checkin`, renders the template with registration answers, and writes to `print_jobs` with `paper_width_mm`, `paper_height_mm`, and `orientation`.
  2. Call this shared helper from **every** check-in entry point (`QRCheckinScannerDialog`, `RegistrantsTab.handleToggleCheckIn`, etc.) AND/OR have the active Print Station subscribe to `event_registrations` where `is_checked_in == true` and automatically enqueue any newly checked-in attendee not yet in `print_jobs`.
  3. Use deterministic job IDs (`job_${eventId}_${registrationId}`) so multiple listeners or double scans never create duplicate jobs for the same check-in.

### C. Device-Scoped Printer Identity (`deviceId::printerName`) & Fair Distribution
- **Rule**: Printer names (e.g., `Clabel_CT221B`) can be identical across different laptops.
- **Identity**: Every printer in the pool is uniquely addressed by `printerKey(stationId, printerName)` (`${stationId}::${printerName}`).
  - Same `printerName` + different `stationId` = **different physical printers** (can claim jobs concurrently).
  - Different `printerName` + same `stationId` = **different physical printers on the same laptop** (provided their `device_uri` has distinct USB `location=` ports).
- **Load Balancing**: When multiple jobs are `pending`, idle `(stationId, printerName)` slots claim jobs atomically via Firestore transactions (`claimPrintJob`), spreading work across all connected laptops and their idle printers.

### D. Cross-Browser Compatibility (Chromium & WebKit / Safari)
- **Dashboard (`local-worker.ts`, `printers-dashboard.tsx`)**: Must support both Chromium-based browsers (Chrome, Brave, Edge, Arc) and WebKit-based browsers (Safari, Orion).
  - Loopback requests must work on both `http://127.0.0.1:17777` and `http://localhost:17777`.
  - Browser print (`printInBrowser`) must wait for `iframeDoc.fonts?.ready` and layout settle before calling `iframe.contentWindow.print()` so Safari does not print blank/unstyled frames.
- **Worker PDF Rendering (`scripts/print-worker/`)**:
  - If a user supplies a `.app` bundle path (or uses a Safari-only Mac without Chrome), `setup.mjs` / `worker.mjs` must resolve `.app/Contents/MacOS/...` for any Chromium browser OR fall back to macOS native WebKit (`WKWebView`) PDF generation so the worker never fails on Safari-only Macs.

---

## 2. Quick Fault Isolation (5-Minute Venue Evidence Collection)

> **Quick Decider**:
> - **`[print] ... -> <printer>` lines appear in the worker terminal** = Dashboard & Firestore claim worked; the issue is CUPS or USB port mapping (`D`/`E`).
> - **No `[print]` lines in the worker terminal** = The job was never enqueued on check-in, or the station never claimed/sent it (`A`/`B`/`C`/`F`).

1. **Browser Console (`/dashboard/printers` with Start Print Station ON)**:
   Check for `[Print Station]`, `[Firestore]`, `permission-denied` (`B`), failed `fetch http://127.0.0.1:17777/health` (`F`), or rapidly repeating errors (`C`).
2. **Workers & Printers Card**:
   Verify each physical laptop appears **once**, shows `Online` + `"Taking jobs"`, and lists real worker printers (not `"Browser print dialog"`).
3. **CUPS & Worker Health (Terminal)**:
   ```bash
   lpstat -W not-completed -o
   lpstat -p
   lpstat -v
   tail -40 /var/log/cups/error_log | grep -E "^E "
   curl -s http://127.0.0.1:17777/health
   ```
4. **Installed Worker Binary & Config Check (`~/.gdg-print-worker/`)**:
   ```bash
   ~/.gdg-print-worker/bin/gdg-print-worker version
   cat ~/.gdg-print-worker/config.json
   ```
   - **Version check**: Must be `2.3.0` or newer (matching `https://gdgjakarta.com/api/media/community-dashboard/app/gdg-print-worker-macos-arm64-tar.gz`). If `2.1.0`, `GET /health` lacks `device` info (causing `"This laptop"` duplicates) and ignores `printer` pinning.
   - **`chromePath` check**: Must point to an actual Chromium executable file (e.g. `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`), NEVER a `.app` directory or non-browser app (e.g. `/Applications/yab.app`), which causes every `renderPdf` spawn to fail.
   - **Upgrade command**:
     ```bash
     curl -fL "https://gdgjakarta.com/api/media/community-dashboard/app/gdg-print-worker-macos-arm64-tar.gz" -o ~/Downloads/gdg-print-worker-macos-arm64-tar.gz
     cd ~/Downloads && tar -xzf gdg-print-worker-macos-arm64-tar.gz && xattr -d com.apple.quarantine gdg-print-worker 2>/dev/null && ./gdg-print-worker setup --origin https://gdgjakarta.com
     ```

---

## 3. The 12 Confirmed Code Weaknesses (`A`–`L`)

| ID | Weakness | Where in Code | Fix Requirement |
|---|---|---|---|
| **A** | Station only lives while `/dashboard/printers` is open and starts `OFF` | `printers-dashboard.tsx:133,447`, `qr-checkin-scanner-dialog.tsx:984` | Persist running state in `localStorage` (auto-resume), move station to layout provider or `/print-station` kiosk route, add scanner banner when jobs wait with no online station. |
| **B** | Firestore `permission-denied` silently treated as empty queue | `src/lib/firestore/client.ts:5621,5647,5692`, `firestore.rules:1747,1759` | Pass error callbacks to UI and display a red error banner + "Test Firestore connection" button. |
| **C** | Claim loop has no backoff and writes presence every round on error | `use-print-station.ts:268-275` | Add exponential per-job backoff, debounce `publishPresence()`, and pause station after consecutive errors. |
| **D** | "Printed" only means `lp` queued the file in CUPS, not physical print | `scripts/print-worker/worker.mjs:174,203` | Watch `lpstat -W not-completed -o <queue>` until completed/aborted, cancel stale jobs (`cancel -a <queue>`), return `queueDepth` in `/health`. |
| **E** | Worker v2.3.0 cannot detect which printer is on which USB port | `scripts/print-worker/worker.mjs` (stashed v2.4–2.6 in `git stash@{0}`) | Detect USB ports via `ioreg`, bind one queue per port (`location=`), and surface `"USB not connected"` in `/health`. Must test with real Clabel CT221B hardware. |
| **F** | "Browser print dialog" fallback marks jobs `Printed` after 0.6s without printing | `use-print-station.ts:130-143`, `printers-dashboard.tsx:413`, `local-worker.ts:12` | Never claim Firestore jobs in browser mode unless explicitly chosen; mark station offline on `/health` failure; cache `/health` in worker and increase client timeout. |
| **G** | 45s client timeout causes duplicate labels on retry | `local-worker.ts:13`, `client.ts:5481` | Send `jobId` to `POST /print` as an idempotency key so worker deduplicates in-progress/completed jobs. |
| **H** | Scanner creates random `job_<time>_<random>` IDs with no dedupe | `client.ts:5419`, `qr-checkin-scanner-dialog.tsx:984` | Use deterministic job IDs (`${eventId}_${registrationId}`) and ignore if already existing. |
| **I** | Cold headless Chrome spawn per label (1.5–3.3s software overhead) + no backpressure | `scripts/print-worker/worker.mjs:139` | Keep a persistent headless Chrome instance alive (or pre-render PDF) and show queue length warning on scanner. |
| **J** | Paper size comes from Printers page state instead of the job | `use-print-station.ts:198` | Store `paper_width_mm`, `paper_height_mm`, and `orientation` on the `print_jobs` document when enqueued. |
| **K** | Two tabs on the same laptop get separate `sessionStorage` station IDs | `use-print-station.ts:44-53` | Use `localStorage` device ID + hardware identity deduplication and tab leader election (`BroadcastChannel`) so one laptop = one station. |
| **L** | Background tab timer throttling triggers false 120s `PRINT_STATION_LOST_MS` | `use-print-station.ts` | Prevent false lost-station failures when tab is backgrounded or move heartbeat/polling off throttled timers. |

---

## 4. Pre-Event Go/No-Go Rehearsal Checklist

- [ ] **Duplicate tab test**: Open `/dashboard/printers` in 2 tabs on the same laptop -> `Workers & Printers` still shows only **1** entry for that laptop.
- [ ] **Universal check-in test**: Check in an attendee from the **QR Scanner** AND check in another attendee from the **Registrants table switch** (with Auto-Print enabled) -> both immediately appear in `print_jobs` and print.
- [ ] **Same printer name on 2 laptops**: Connect Laptop A (`CT221B`) and Laptop B (`CT221B`) -> enqueue 4 jobs -> both laptops claim and print jobs in parallel without collision.
- [ ] **Unplug one printer midway**: Job retries on another available `(stationId, printerName)` and records the attempt history.
- [ ] **Stop the worker midway**: Station shows `Offline` and never marks queued jobs as `Printed` via browser dialog fallback.
- [ ] **Zero stuck CUPS jobs**: `lpstat -W not-completed -o` is empty after 20 consecutive labels.
