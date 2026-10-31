# AGENTS.md

Welcome to the **GDG Jakarta Organizer Dashboard** repository. Follow these guidelines when reading, writing, and refactoring code across the application.

For in-depth architectural patterns, Bevy API session spoofing specifications, repository architecture, and feature guides, refer to the [AI Guidelines Index](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/INDEX.md):
- [1. Architectural Patterns & Data Models](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/1-architectural-patterns.md)
- [2. Design Tokens & Theming](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/2-design-tokens-theming.md)
- [3. Component Composition & UI Rules](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/3-component-composition-ui.md)
- [4. Code Style & Preferences](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/4-code-style-preferences.md)
- [5. Networking & Bevy API Session Spoofing](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/5-networking-and-bevy-api.md)
- [6. Repository & Data Layer Architecture](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/6-repository-and-data-layer.md)

Feature Guidelines:
- [Authentication](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/authentication.md) | [Events](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/events.md) | [Attendees](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/attendees.md) | [QR Scanner](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/scanner.md) | [Members](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/members.md) | [Profile](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/profile.md) | [Tickets](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/tickets.md) | [Printers](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/printers.md)

---

## Project overview

GDG Jakarta Dashboard is a responsive admin community management or event organizer dashboard built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, and shadcn/ui. 

The dashboard will have two roles: admin/organizer and member/user. 

Admin/organizer dashboard:
- Create, edit, delete events
- Create, edit, delete tickets
- Create, edit, delete event merchandises
- Configure thermal badge printers, label templates, and automated check-in print stations
- Manage users
- Manage news
- Manage community 

Member/user dashboard:
- View events
- Register for events
- View tickets
- View event merchandises
- View news
- View community

This repository uses the shadcn `radix-nova` style. The shadcn CLI reports `base: "radix"`, which refers to Radix UI. Always inspect the local components in `src/components/ui/` because individual wrappers may use different primitives.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Focuses

This project will be simultaneously building the members and organizer dashboard, all together with a same codebase according to the feature that the user requested.

## shadcn skill

Use the shadcn skill for all work involving shadcn/ui components, styling, composition, registries, presets, or `components.json`.

If the skill is not available, install it with:

```bash
npx skills add shadcn/ui
```

The skill contains the component, styling, composition, accessibility, and CLI rules. Do not duplicate those rules here. Always inspect the local component source before using it.

Do not modify files inside `src/components/ui/` or `src/components/calendar/`. Keep these components intact and apply styling or customization where they are used.

## Setup

This project uses npm.

```bash
npm install
npm run dev
```

Available commands:

```bash
npm run build
npm run lint
npm run format
npm run check
npm run check:fix
npm run generate:presets
```

There is currently no automated test command. Run build, lint, check, or other validation commands only when the user explicitly requests that validation.


## User authentication

This project uses Firebase auth with Google Sign In provider.
Login page is at `src/app/(main)/auth/login/page.tsx`. 

## Co-location-based structure

Keep feature code close to the route that owns it.

- Dashboard routes: `src/app/(main)/dashboard/<screen>/page.tsx`
- Screen-specific components, data, and schemas: `src/app/(main)/dashboard/<screen>/_components/`
- Shared dashboard components: `src/app/(main)/dashboard/_components/`
- Shared application components: `src/components/`
- Local shadcn components: `src/components/ui/`
- Shared hooks and utilities: `src/hooks/` and `src/lib/`
- Theme presets: `src/styles/presets/`

Keep a component inside its route until it is reused by another feature. Do not move screen-specific code into a shared directory preemptively.

## Creating or extending a screen

1. Inspect the closest current screen before writing code.
2. When reproducing a UI from a screenshot or image, follow its visual direction closely, including layout, hierarchy, spacing, component structure, and important details. Implement it with the project's existing components and semantic theme tokens rather than copying raw color values. If the design needs a color that is not available through the existing theme tokens, or the user explicitly requests a non-theme color, use a named color from Tailwind's default palette. Do not use arbitrary hex, RGB, HSL, or OKLCH values.
3. Reuse the existing dashboard shell, local components, layout controls, and theme tokens.
4. Break each new page into focused components inside the route's `_components/` directory. Keep `page.tsx` small and focused on composing those pieces.
5. Keep `page.tsx` as a Server Component by default. Move interactive or browser-dependent code into a dedicated Client Component.
6. Add the screen to `src/navigation/sidebar/sidebar-items.ts` when it should appear in the dashboard navigation.
7. Decide the information hierarchy before choosing widgets. Let the content determine the page structure.
8. Keep the established visual rhythm where it fits: compact spacing, clear typography hierarchy, responsive action rows, and grids that collapse cleanly on smaller screens.
9. Widget selection is not a fixed formula. Try different arrangements of cards, resource rows, meters, charts, tabs, empty states, and actions, then keep the version that communicates the content clearly and feels consistent with the project.
10. Match nearby screens in card density, borders, radius, spacing, content width, and responsive behavior.
11. Use semantic theme tokens so new screens work with light mode, dark mode, and the existing theme presets.
12. Handle relevant loading, empty, error, disabled, and overflow states.
13. Keep screens accessible with semantic HTML, keyboard support, visible focus states, labels, and appropriate ARIA attributes.
14. Use the shared [`FloatingSaveBar`](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/src/app/(main)/dashboard/_components/floating-save-bar.tsx) (`src/app/(main)/dashboard/_components/floating-save-bar.tsx`) for screens or tabs with editable settings/configurations so dirty-state tracking, discard, and floating save actions remain consistent across the dashboard.
15. **Document every new feature**: Whenever you add or extend a feature, add concise feature notes to `AGENTS.md` (under `## Feature Notes`) and update `ai-guidelines/` (`ai-guidelines/INDEX.md` and `ai-guidelines/feature/<feature>.md`).

## Feature Notes

- **Partner & Sponsor Voucher Redemption Reports (Zero-Leak Live Sharing)**:
  - **Opaque Share Token (`/vouchers/report/[shareToken]`)**: Generates an unguessable 24-character token (`vshr_...`) stored on `event_vouchers` (`partner_share_token`). Document ID (`{eventId}_{code}`) and promo code are NEVER exposed in the public URL to prevent attendee voucher code leaks.
  - **Access Code Enforcement**: Access to the report is gated behind an organizer-configurable access code (`partner_access_code`, e.g. `GDG-XXXXXX`). Partners can enter it in the access gate or organizers can share direct links with `?code=GDG-XXXXXX`.
  - **Anti-Leak Display Protection**: Optional `partner_show_voucher_code` toggle (defaults to false). When false, the report masks the promo code as `DEV****50` so partner presentations or screenshares do not leak the code to attendees.
  - **Server-Side PII Masking**: Handled exclusively in `getPartnerVoucherReportAction` (`src/server/voucher-partner-actions.ts`) using `src/lib/security/pii-mask.ts`. Raw emails (`fa***n@gmail.com`), full names (`Muhammad F*** T***`), and phone numbers (`+62 812-****-**89`) are masked on the server before dispatching data to the client, preventing attendee scraping.
  - **Organizer Controls**: Integrated into `VoucherDialog` (`voucher-dialog.tsx`), `VouchersTab` (`vouchers-tab.tsx`), and `VoucherRedemptionsDialog` (`voucher-redemptions-dialog.tsx`) with instant link copying, access code regeneration, and visual status badges.

- **Organizer Registration Cancellation with Mandatory Reason**:
  - Cancelling attendees from the dashboard (single attendee action and batch cancellation in `registrants-tab.tsx`) requires a non-empty cancellation reason input.
  - The reason is propagated to `sendCancelAttendeeEmailAction` and `deleteEventRegistrationAction` (passed into DOKU payment cancellation payloads if active payment exists).
  - The `cancelled` email template renders `<p><strong>Reason for Cancellation:</strong><br>{{ $('event-params').item.json.cancellationReason }}</p>` inside `.alert-box`.
  - Backward compatibility helper `ensureCancellationReasonInCancelledHtml` automatically injects this block into existing Firestore event templates, and template interpolation formats multi-line reasons using `<br>`.
  - Manual template test sender (`send-template-email-dialog.tsx`) and sample data config drawer (`configure-template-data-dialog.tsx`) also enforce / provide simulation for the cancellation reason.

- **Configurable Voucher Scope ("Bundle Only", "All Items") & Eligible Item Checklist**:
  - `VoucherAppliesTo` supports `"all" | "ticket" | "bundle" | "merchandise"`.
  - `EventVoucher` supports optional item checklists (`eligible_ticket_ids`, `eligible_bundle_ids`, `eligible_merchandise_ids`). When null or omitted, all items within the active scope are eligible.
  - In `VoucherDialog`, organizers can select **"All Items"** (Tickets, Merch & Bundles), **"Tickets Only"**, **"Bundle Only"**, or **"Merch Only"**. An interactive checklist panel below Discount Scope lists the event's items filtered to the active scope, allowing organizers to customize which tickets, bundles, or merchandise items are checklisted.
  - On the registration form (`event-registration-modal.tsx`), when a voucher is applied, checklisted items are enabled and selectable, while unselected items are disabled with an informative prompt.

- **Total Registered Attendee card**: `registrant-statistics.tsx` overview shows approved + `paid_and_registered` (+ attended/confirmed/registered) as one card; clicking applies the `registered_attendees` status filter handled in `registrants-tab.tsx`. Documented in the Status & Metric Guide.

- **Email Templates & Thermal Printers Ref & ID Alignment**:
  - Accepted / Ticket Confirmation email templates (`DEFAULT_ACCEPTED_EMAIL_HTML`) render the Attendee ID (`ID: {{ $('Add Bevy Attendee API').item.json.id }}`) directly beneath the Attendee Ref Code (`Ref: {{ $('Add Bevy Attendee API').item.json.attendee_code }}`).
  - Dynamic n8n webhook payload sanitizers (`adjustBodyEmailForApprovedWebhook`) and template parsers (`interpolateTemplateHtml`, `ensureAttendeeIdInAcceptedHtml`) preserve both ID and Ref code tags.
  - Thermal badge print templates render stacked reference badges (`REF: [[ticketCode]]` and `ID: [[attendeeId]]`), supported across default label templates, Monaco editor palettes, and auto-print queue generators.

- **Thermal Printers & Label Station (`/dashboard/printers`) & Per-Event Printer Templates**:
  - **Routes & Components**: `src/app/(main)/dashboard/printers/page.tsx`, `src/app/(main)/dashboard/printers/_components/printers-dashboard.tsx`, `src/app/(main)/dashboard/printers/_components/label-html-editor-preview.tsx`, and `src/app/(main)/dashboard/events/[eventId]/_components/event-printer-tab.tsx`.
  - **Per-Event Printer Templates & Form Questions**: Each event can configure its own thermal badge dimensions, orientation, and HTML badge template under the **Badge Printer** tab in `/dashboard/events/[eventId]`. Organizers can drag & drop answered registration form questions (`[[<question_id>]]`, `[[answers.<question_id>]]`, `[[question:<question_id>]]`) into the badge HTML template.
  - **Core Utilities**: `src/lib/printers/types.ts`, `src/lib/printers/templates.ts`, and `src/lib/printers/qr-svg.ts` (self-contained ISO/IEC 18004 SVG QR generator for `eventId:attendeeId`). `renderLabelTemplate` interpolates custom question answers from registration data alongside standard tokens.
  - **Check-In Integration**: `src/app/(main)/dashboard/events/[eventId]/_components/qr-checkin-scanner-dialog.tsx` checks event-specific `printer_config` first (falling back to system settings) when auto-printing badges on attendee check-in.
  - **Firestore & Kiosk Printing**: Persists system configuration in `system_settings/printer`, event configuration in `events/{eventId}.printer_config`, and print jobs (`MAX_STORED_PRINT_JOBS = 30`) in `system_settings/printer_queue`.

- **Local Print Worker (Dialog-Free Badge Printing, macOS)**:
  - `scripts/print-worker/worker.mjs` (zero-dependency Node service bound to `127.0.0.1`, default port `17777`) renders label HTML to a PDF with headless Chrome and sends it to CUPS via `lp -o media=Custom.<W>x<H>mm`. `scripts/print-worker/setup.mjs` is the interactive CLI installer (pick printer, Chrome path, port, allowed dashboard origins, then starts the worker; there is no login auto-start). Config lives in `~/.gdg-print-worker/config.json`.
  - **Printer pool (parallel printing)**: setup lets you select several printers (`printers: []` in the config; legacy single `printer` still works). The worker assigns each `POST /print` to an idle printer itself (least recently used first), so N printers print N labels at once, a disabled/failing printer is skipped for 30s and its job is retried on another one, and the web app never sends a printer id. `GET /health` returns `printers[]` (state, busy, available, lastError) and `queued`. Each render uses its own throwaway Chrome profile.
  - **Packaged executable + dashboard install flow**: `npm run print-worker:build` (`scripts/print-worker/build.mjs`) bundles `main.mjs` with esbuild, injects it into an official Node binary (Node SEA; Homebrew Node lacks SEA so it downloads and checksum-verifies the official build), ad-hoc codesigns it (macOS kills it otherwise) and writes `scripts/print-worker/dist/gdg-print-worker-macos-arm64.tar.gz` (~42 MB, Apple Silicon only, gitignored). It is over Cloudflare's 25 MiB static asset limit, so never put it in `public/`; upload it through the dashboard Media page as `community-dashboard/app/gdg-print-worker-macos-arm64-tar.gz` (note `-tar.gz`), which is served at `https://gdgjakarta.com/api/media/community-dashboard/app/gdg-print-worker-macos-arm64-tar.gz` (the default of `PRINT_WORKER_DOWNLOAD_URL` in `local-worker.ts`; `NEXT_PUBLIC_PRINT_WORKER_DOWNLOAD_URL` overrides it). The **Install Worker** button (`install-print-worker-dialog.tsx`, URL from `getPrintWorkerDownloadUrl()` in `local-worker.ts`) downloads it and opens a dialog with Terminal commands (including `setup --origin https://gdgjakarta.com` (plus the current origin when the page is open elsewhere, e.g. localhost)) that turns green when the worker connects. CLI: `gdg-print-worker run | stop | setup [--origin U] | uninstall | version`; no auto-start (the worker runs only while started by hand, Ctrl+C or `stop` ends it); setup copies the executable to `~/.gdg-print-worker/bin` so it can be started after the download is deleted, and removes any old launchd agent.
  - Run from source with `npm run print-worker:setup` Endpoints: `GET /health`, `POST /print` `{ html, widthMm, heightMm, copies? }`. CORS is restricted to configured origins and answers Chrome's Private Network Access preflight.
  - Dashboard client: `src/lib/printers/local-worker.ts`. `executeSilentPrint` in `printers-dashboard.tsx` prints through the worker when `/health` is reachable (polled every 10s, shown on the Print Station Status card) and falls back to the iframe `window.print()` / `--kiosk-printing` path only when the worker is unreachable. Queue handling moved into `usePrintStation` (see Multi-Laptop Print Stations): the dashboard tab must stay open, and jobs are claimed per printer from `print_jobs` (replaces `system_settings/printer_queue`).

- **Multi-Laptop Print Stations & Job Assignment**:
  - Every open dashboard tab (`usePrintStation` in `src/app/(main)/dashboard/printers/_components/use-print-station.ts`) heartbeats its laptop to `print_workers/{stationId}` (computer name, model, OS, worker version, printers + status). The worker's `GET /health` now returns `device` and `POST /print` accepts an optional `printer` to pin a job to one printer (worker v2.3.0; older workers still work).
  - Print jobs are one document each in `print_jobs/{jobId}` (replaces the array in `system_settings/printer_queue`). With Start Print Station on, each idle printer claims the oldest pending job in a Firestore transaction (`claimPrintJob`), so one job is held by exactly one printer on one laptop and records `assigned_station_*`, `assigned_printer`, `attempts[]`.
  - Failed prints retry on another online printer (max 3, failed printer excluded) and are otherwise marked `failed` with error + attempt history and a Retry button; jobs held by a laptop that stopped responding are failed (never auto-reassigned, to avoid duplicate labels). UI: Workers & Printers card (`print-stations-card.tsx`) and Printed on / Retry in the Print Queue tab. Identical printers share one USB serial (same CUPS device URI) and must be pinned per USB port with `location=` (setup warns; see item 11). Details in `ai-guidelines/feature/printers.md` (item 11).

- **Badge Name Fitting & Safe Templating**:
  - `src/lib/printers/name-fit.ts` holds `escapeHtml`, `shortenName` / `initialsOf` and the in-page fit script injected by `injectNameFit` (called from `buildPrintDocument` and the editor preview). For every `.attendee-name` / `[data-fit-name]` element it tries the full name, then only the last word as an initial (`Muhammad Fachridan T.`), then one more word from the back each time (`Muhammad F. T.`), and finally all initials (`M. F. T.`), keeping the first that fits in 2 lines (`data-fit-lines`). The font size is left alone by default; set `data-fit-min="6"` (pt) on the element to also allow shrinking before abbreviating. A single word is truncated with `…` instead. Works for the worker (headless Chrome), the iframe path and the preview, so saved templates need no change.
  - New template tokens `[[nameShort]]` (last word as initial) and `[[nameInitials]]` (also in the Monaco token palette) for manual control.
  - `renderLabelTemplate` now HTML-escapes every inserted value (including `[`/`]` so a value can never be re-read as a token) and substitutes with function replacers so `$&` in a name is literal. Previously a name with `<` or `&` could break the label.

- **Payment Policy CMS (`/dashboard/faq` -> Payment Policy Page)**:
  - **Firestore Model & Storage**: Persisted in `content_settings/payment_policy`. Validated in `firestore.rules` for fields `header`, `notice`, `sections`, `channels`, `contact`, `updatedAt`, `updatedBy`.
  - **Hooks & State**: Handled via `usePaymentPolicyContent` (`src/lib/content/hooks.ts`) and `DEFAULT_PAYMENT_POLICY_CONTENT` (`src/lib/content/defaults.ts`). Auto-revalidates `/payment-policy`, `/faq`, and `/dashboard/faq`.
  - **Organizer CMS Dashboard**: Integrated into `src/app/(main)/dashboard/faq/_components/payment-policy-editor.tsx` and `payment-policy-section-dialog.tsx` as a dedicated tab under `/dashboard/faq`. Supports structured section editing, ordering, active/hide toggling, callout banners, and `FloatingSaveBar`.
  - **Public Display**: Rendered dynamically via `src/app/(external)/payment-policy/_components/payment-policy-view.tsx` with zero layout shift from default SSR baseline.

- **Live Agenda (`/events/live-agenda`)**:
  - Public live board (no login, inside the `(external)` layout with the public header/footer; fullscreen hides them), to be linked later from the member My Events dashboard (the entry button is not built yet). Desktop layout is a 3-column grid; the time/stages block (`current-time-column.tsx`, `lg:col-start-2`): DevFest logo, a ticking WIB clock, and per stage (`<h2>` "<name> Track", `<h3>` agenda title) the agenda running now, else the next one, else the last one (badge: Happening now / Up next / Finished); below the stages, "See full agenda here" with a link to `LIVE_AGENDA_FULL_AGENDA_PATH` (`/events/132640`).
  - **Venue map (left column)**: `venue-map-column.tsx` shows `<h2>` "Venue Map" on top, the venue map image, then a `<h3>` hint below it (image: `LIVE_AGENDA_VENUE_MAP_URL`, `assets.gdgjakarta.org/devfest/instagram-post-21.png`), `lg:col-start-1`.
  - **Feedback section (right column)**: `feedback-column.tsx` shows `<h2>` "Thank you for attending <event name>" on top, a QR (self-contained `generateQrSvgDataUrl`) linking to `LIVE_AGENDA_FEEDBACK_URL` (`http://gdgjakarta.org/feedback`), also clickable, then `<h3>` "Please take a moment to fill our feedback form" below it. Event name is the unique titles of the shown events joined with " & ". Pinned to the 3rd grid column on desktop (`lg:col-start-3`); 
  - **Fullscreen + theming**: the view container (`live-agenda-view.tsx`) has a fullscreen toggle (Fullscreen API) and paints its background from the `--live-agenda-bg` CSS variable, set from `LIVE_AGENDA_BACKGROUND_URL` / `LIVE_AGENDA_LOGO_URL` in `src/lib/events/live-agenda.ts` (`assets.gdgjakarta.org/devfest/background.png` and `devfest-logo.png`). Text is white on the green background regardless of light/dark theme.
  - `page.tsx` picks the nearest Bevy published event that is running or still ahead (end day >= today in `Asia/Jakarta`), plus any other event starting the same day; `?eventId=<id>` pins one event regardless of date (preview / future button target). Stages come from `buildUnifiedAgenda` groups (a single generic "Agenda Schedule" group takes the event title), so "Conference" / "Seminar" are either two groups of one event or two events.
  - `src/lib/events/live-agenda.ts` holds the pure logic: `buildLiveAgendaStages`, `parseTimeLabel` (handles "09:05 WIB", "08:15 WIB - 12:00 WIB", AM/PM, WITA/WIT shift), `getStageHighlight` (missing end time = next agenda start, last agenda = +60 min). Items with unparseable times are skipped.

- **Google Drive Venue Ticket Distribution & Google Sheets Picker**:
  - **Google Drive OAuth (`src/lib/google-drive/venue-tickets.ts`)**: Authenticates the signed-in organizer via `GoogleAuthProvider` (`https://www.googleapis.com/auth/drive` scope) and caches the OAuth `accessToken` in `sessionStorage` (~50 mins) so private Drive folders and spreadsheets accessible to that organizer work without making folders public.
  - **Deterministic 1-to-1 Venue Ticket Mapping (`venue-ticket-drive-dialog.tsx`)**: Organizers paste a Google Drive folder link under the **Venue Tickets** button in `registrants-tab.tsx`. `listDriveFolderPdfs` lists non-trashed files sorted in natural filename order (`1.pdf`, `2.pdf`, …, `10.pdf`) and `computeSequencePdfAssignments` maps them 1-to-1 to confirmed registrants (`approved`, `paid_and_registered`, `registered`, `attended`) sorted ascending by `registered_at`, preserving already-sent tickets (`venue_ticket_sent_at`) while remapping unsent registrants and clearing stale assignments on cancelled registrants via **Sync Registrants & Remap**.
  - **Validation & View-Only Permission Grant Before Email Delivery**: `ApplicantDetailDialog` displays a **Venue Ticket** card showing `#sequence`, filename, link, `Shared`/`Sent` badges, a manual override dropdown, and a **"Grant Access & Send Venue Ticket"** button. Before dispatching the email (`sendQuickEmail` with `venueTicketHtmlTemplate`), `grantDriveReaderPermission` calls Drive API v3 `permissions.create` (`role: "reader"`, `type: "user"`, `emailAddress: registration.member_email`) and records `venue_ticket_shared_at` and `venue_ticket_sent_at`.
  - **"Venue Ticket" Email Template (`/dashboard/email-manager`)**: Added `id: "venue_ticket"` (`name: "Venue Ticket"`, `category: "rsvp"`, `badge: "Venue Pass"`) under the **RSVP & Tickets** group with `[[VenueTicketUrl]]`, `[[VenueGuideUrl]]` (how to get to the venue link), and `[[VehicleTicketUrl]]` (vehicle / parking pass link) placeholder support. The Email Composer features a floating **Save as Template** action button (`fixed right-6 bottom-6`) with **Save as Current Template** (overwrites active custom or pre-built template via `saveFeatureTemplateOverride`) and **Save as New Template** options.
  - **Searchable Google Sheets Picker (`email-blast-form.tsx`)**: In **Emails → Google Sheets Import**, organizers can browse/search their **Recent Spreadsheets** via a searchable Drive dropdown (`listDriveSpreadsheets`) or paste a `Spreadsheet URL` manually; `fetchSheetsList` and `fetchSheetHeaders` accept the optional OAuth `accessToken` to read private sheets.


## Code conventions

- TypeScript strict mode is enabled. Use precise types and avoid `any`.
- Use the existing `@/` import aliases.
- Follow the Biome configuration: double quotes, semicolons, two-space indentation, sorted imports, and a 120-character line width.
- Avoid unnecessary dependencies.
- Keep changes focused and do not refactor unrelated files.

## Contributions

- Use conventional commit prefixes such as `feat:`, `fix:`, `refactor:`, `docs:`, and `chore:`.
- Include screenshots for new screens and material visual changes. Include mobile and dark-theme states when relevant.
- Explain new reusable patterns or dependencies in the pull request.
- Follow `CONTRIBUTING.md` for the contribution workflow.
