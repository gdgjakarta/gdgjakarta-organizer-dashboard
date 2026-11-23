# Changelog

All notable changes to the **GDG Jakarta Dashboard** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.57] - 2026-11-23

### Added
- **Manual Print Badge Trigger on Registrants & Dossier**: Added a 1-click **Print Badge** icon button and dropdown action on every row in the Registrants tab, plus a **Print Badge** button in the Application Dossier header, creating a fresh Print Queue job regardless of the auto-print-on-check-in setting.

---

## [1.0.56] - 2026-11-23

### Added
- **Print Queue Organizer Attribution (`Triggered by`)**: Automatically stamps `auth.currentUser` name and email on every enqueued print job and displays a **Triggered by** column in the Real-Time Print Queue table.
- **Live Queue Indicator & Manual Refresh**: Added a pulsing `● Live · Updated HH:mm:ss` badge and a **Refresh** button (`fetchRecentPrintQueue`) in the Real-Time Print Queue header.

---

## [1.0.55] - 2026-11-23

### Fixed
- **Printer Template Quick-Pick TypeScript Build**: Widened `ticket_type` before fallback `.trim()` in `ConfigurePrinterTemplateDataDialog` for strict TypeScript production builds.

---

## [1.0.54] - 2026-11-23

### Added
- **Editable Shipping Labels Dashboard Tab**: Added a Monaco HTML/CSS editor, click-to-insert token bar (`[[contactLine]]`, `[[mapsQr]]`, etc.), live thermal preview with Maps QR toggle, and **Save Current as Default** / **Reset to Saved Default** / **Restore Built-In** actions.
- **Responsive Shipping Label Presets**: Added `buildShippingLabelCoreCss` and `syncShippingTemplateDimensions` so shipping labels automatically rescale across `40×30mm`, `50×30mm`, `60×40mm`, portrait, and custom roll sizes.
- **Print Queue Pagination & Cancel Queued Action**: Raised live queue history to 200 jobs with `10 / 25 / 50` per-page pagination, removed the static `(30)` tab count, and added transactional `cancelQueuedPrintJob` (`×`) buttons.
- **Speaker Thank-You Icon & Capacity Sync**: Added an amber `Award` icon for `speaker_thank_you` email templates and synced `max_attendees` from Bevy `total_capacity` on event creation.

### Improved
- **CT221B Portrait Rotation & Native App `v2.5.0`**: Added 90° clockwise portrait rotation onto `50×30mm` physical rolls, fixed TSPL polarity and `WKWebView` CSS px sizing, centered Notch HUD pills, and uploaded signed `v2.5.0` macOS `.dmg` / `.zip` / `install-macos.sh` to Cloudflare R2.
- **Shipping Label & Delivery UI Polish**: Full-width single-line recipient name with initials fallback, single-line `WA • email` auto-shrink, overflow-safe `Note:` / `Items` spacing, compact single-row Printers header toolbar, and full-width + 2-column action buttons in `MerchandiseDeliveryStatusDialog`.
- **Template Quick-Pick Data Accuracy**: Populated actual registrant role, company, email, ticket type, ref code, and attendee ID in `ConfigurePrinterTemplateDataDialog`.

---

## [1.0.53] - 2026-11-23

### Added
- **Direct Bluetooth Thermal Printing (CT221B BLE + TSPL)**: Added CoreBluetooth BLE support in `GDG Print Station.app v2.5.0`, pure TSPL raster encoder (`tspl-ct221b.ts`), Chromium Web Bluetooth fallback (`web-bluetooth-ct221b.ts`), and Bluetooth darkness/gap configuration.
- **Per-Document MOU Clause Overrides**: Allowed customizing MOU clauses per sponsor document.

### Fixed
- **Bevy Sponsor Logo Sync & Web Bluetooth BufferSource**: Sent relative logo paths to Bevy while surfacing sponsor sync errors, and fixed `Uint8Array` chunk typing for TypeScript 5.7+ builds.

---

## [1.0.52] - 2026-11-23

### Improved
- **Partnership Document Creation Menu**: Consolidated Invoice, Quotation, LOA, and MOU creation buttons into a single dropdown menu inside `SponsorDocumentsDialog`.

---

## [1.0.51] - 2026-11-20

### Added
- **Per-Document LOA Clause Overrides & Workshop Toggle**: Added customizable LOA clause overrides and an optional workshop clause toggle when generating partner Letters of Agreement.

---

## [1.0.50] - 2026-11-20

### Fixed
- **Cloudflare Worker Bundle Size**: Disabled sourcemap uploads in `wrangler.jsonc` to stay comfortably under the 60 MiB Workers upload limit.

---

## [1.0.49] - 2026-11-20

### Fixed
- **PDF Fontkit Dependency**: Added `@pdf-lib/fontkit` explicitly to `package.json` for production builds.

---

## [1.0.48] - 2026-11-20

### Fixed
- **Partner Email Dialog Wrapping**: Fixed text and attachment wrapping inside the Send Document via Email dialog.

---

## [1.0.47] - 2026-11-20

### Changed
- **Default Partnership Website**: Set default event website in partnership document templates to `https://gdgjakarta.org/`.

---

## [1.0.46] - 2026-11-20

### Improved
- **Compact Sponsor Document Actions**: Switched the sponsor document email action to a compact icon button.

---

## [1.0.45] - 2026-11-20

### Added
- **Attendance & Speaker Appreciation Certificates**: Launched end-to-end event certificate generation with PKCS#7 digital signing, Cloudflare R2 storage, public verification, and n8n email dispatch workflows.
- **Sponsor Document Signing & Custom Titles**: Added direct Sign Document action, custom document title support, and MOU Clause 6 overrides.
- **Multi-Recipient Email API**: Added CC, BCC, and multi-recipient support to the `send-email` API.

---

## [1.0.44] - 2026-11-20

### Fixed
- **Public Partner Confirmation Writes**: Updated Firestore rules and error handling to permit public `chapter_sponsors` confirmation writes and surface write failures cleanly.

---

## [1.0.43] - 2026-11-19

### Improved
- **Partnership Loading Skeletons**: Added shimmer skeleton states while loading Brand Guide URLs, email headers, and confirmation URLs in the Partnership tab.

---

## [1.0.42] - 2026-11-19

### Fixed
- **Email Custom Note Formatting & Signing Canvas**: Preserved line spacing and emphasis in partner email custom notes and refined the PDF signing canvas layout.

---

## [1.0.41] - 2026-11-19

### Fixed
- **Email Custom Note Font Normalization**: Stripped pasted inline font styles from partner email custom note HTML so emails render consistently.

---

## [1.0.40] - 2026-11-19

### Added
- **Rich-Text HTML Note Editor**: Added a rich-text note editor to the Partner Email dialog.

---

## [1.0.39] - 2026-11-19

### Added
- **Partner PDF Signage & X.509 E-Certificate Portal**: Added the **Sign Partner PDFs** studio (`pdfjs-dist` page viewer, typed/drawn/uploaded signatures, drag & resize placements, optional A4 audit trail page, PKCS#7 X.509 signing with SHA-256 fallback, R2 hosting, and public verification at `/partnership/signed-documents/[token]`).

---

## [1.0.38] - 2026-11-19

### Added
- **Brand Guide URL Setting**: Added a configurable Brand Guide URL setting and quick-open button for non-event chapter sponsors.

---

## [1.0.37] - 2026-11-19

### Added
- **Partner & Sponsor Management Suite**: Launched `/dashboard/partnership` with Bevy chapter/event direct sync, 16:9 poster logo cropper, tokenized Invoice/Quotation/LOA/MOU PDF generator, thank-you email dispatch, and public partner confirmation portals.
- **Async Check-in Rate Column**: Added non-blocking async check-in rate hydration for curation mode on the Registrants tab.

### Fixed
- **Merchandise Delivery Tracking**: Fixed courier name mapping, tracking history display, and delivery status dialog action layout.

---

## [1.0.36] - 2026-11-16

### Improved
- **Direct Check-in Rate Resolution from Member Detail in Curation Mode**: Updated `/dashboard/events/[eventId]` (Registrants Tab) to read live check-in rates directly using member detail stats (`getBevyChapterMemberDetailAction`) without modifying Firestore `members` records or Bevy member sync services.

---

## [1.0.35] - 2026-11-16

### Added
- **Member Detail Dialog & Social Links View**: Added an inspectable member modal on `/dashboard/members` featuring full Bevy + Firestore profiles, direct WhatsApp button (`wa.me`), brand-colored SVG icons for LinkedIn, GitHub, Instagram, X, Threads, and Personal Website, and attendance stats.
- **Personal Information Social Links & Auto-Complete**: Expanded `/dashboard/account` with social fields (LinkedIn, GitHub, Instagram, X with username normalization, Threads, Personal Website) and wired auto-fill into `EventRegistrationModal` when custom questions match.
- **Check-in Rate Badge & Indication in Curation Mode**: Displayed check-in rate badge directly under email on `/dashboard/events/[eventId]` (Registrants Tab) with color indicator dots (Emerald $\ge 75\%$, Amber $50\%-74\%$, Rose $< 50\%$, Muted for new attendees).
- **Check-in Rate Sorting**: Added interactive column header sort and a dedicated "Check-in Rate:" filter dropdown (Highest First / Lowest First) with active filter pill indicator and tie-breaking on attended counts.

---

## [1.0.34] - 2026-11-16

### Added
- **Short.io Dashboard Advanced Features**: Full-featured Short Links dashboard with Links, Analytics, and Domains tabs, click telemetry charts, QR generation, password protection, expiration, and bulk CSV import.

---

## [1.0.33] - 2026-11-15

### Added
- **Thermal Shipping Label Printing for Merchandise Delivery**: Added 1-click and batch thermal shipping label printing to `MerchandiseDeliveryTab`, `DeliveryApprovalDialog`, and `MerchandiseDeliveryStatusDialog`.
- **Conditional Google Maps QR Code**: Automatically renders high-contrast offline SVG QR codes (`SCAN MAPS`) when `maps_url` is provided, expanding recipient & destination details to 100% width when omitted.
- **Cross-Laptop Thermal Printer Selection**: Added `ShippingLabelPrintDialog` with 1:1 paper preview, live printer status, and targeted station/printer pinning so an organizer on one laptop can trigger thermal printing on another laptop's connected printer.
- **Auto-Fit Recipient & Destination Typography**: Formatted recipient names with up to 2-line auto-wrapping and auto-shrinking typography down to `5.5pt`, with email placed cleanly below WhatsApp numbers and dynamic scroll zoom adjustments to guarantee fit without edge clipping.

### Fixed
- **Thermal Printer Connection Guard**: Disabled silent browser dialog fallbacks when no thermal printer is connected, alerting organizers with `toast.error("Please connect printer thermal first")`.

---

## [1.0.32] - 2026-11-15

### Added
- **Native macOS Menu Bar App (`GDG Print Station.app` v2.4.0)**: Built native Swift Menu Bar app with Dynamic Island / Notch Live Activity HUD, replacing the Node.js SEA CLI worker. Includes 1-click test prints, live USB status, auto-fixing shared USB ports, and instant CUPS queue flushing.
- **Direct macOS Disk Image (`GDG-Print-Station-macOS.dmg`)**: Packaged signed native application into DMG and ZIP distributions hosted on Cloudflare R2 with a 1-line quarantine-free installation script.
- **Universal Check-in Auto-Print**: Wired real-time Firestore auto-print into QR Scanner and Registrants tab with deterministic deduplication across multiple stations and browser tabs.

### Improved
- **Dual-Index Print Station Deduplication**: Prevented duplicate Mac listings (Online + Offline) by indexing on both hardware UUID and normalized host name/model, automatically cleaning up stale offline records.
- **Menu Bar & Station Copywriting**: Clarified device status by switching "queue(s)" references to "printer(s)" and enabling full word wrapping on Notch HUD banners to prevent text truncation.

### Fixed
- **Pre-Spool USB Connection Verification**: Verified physical USB presence before sending jobs to CUPS to prevent false success reports when USB cables are unplugged.
- **Stuck CUPS Spool Job Cancellation**: Monitored spool transitions and automatically canceled unprinted jobs when printers are offline or unplugged.
- **Refresh Crash Prevention**: Moved shell calls off the UI thread and outside locks when refreshing printer lists with all USB devices disconnected.

---

## [1.0.31] - 2026-11-15

### Added
- **Interactive Image Adjuster (`AdjustImageDialog`)**: Added macOS Preview-style dark frosted glass backdrop for transparent speaker avatars and 0.5x–3.0x zoom-out range.
- **GDGoC / GDSC Ecosystem Role**: Added `"GDGoC / GDSC"` across speaker confirmation forms, dashboard Add/Edit speaker dialogs, and public event pages.

### Improved
- **Public Speaker Ecosystem Badges**: Assigned distinct color palettes per ecosystem (GDE = Amber, Googler = Blue, WTM = Emerald, GDGoC / GDSC = Cyan, GDG = Rose) and stacked badge pills vertically below speaker names.

### Fixed
- **Public Event Speaker Roster Sync**: Merged Firestore event presenters into Bevy public event tabs (`extractEventSpeakerGroups`, `getAllEventSpeakers`, `getTotalSpeakersCount`) so manually added speakers appear on live event pages with matching counts.
- **Manual Speaker `confirmation_id` Linking**: Included `confirmation_id` when syncing `newSpeakerObj` in `addManualSpeakerConfirmationAction` so public ecosystem badges resolve directly from `event_speaker_confirmations`.

---

## [1.0.30] - 2026-11-15

### Added
- **Bevy `#ID` Badge**: Displayed Bevy person ID badge on speaker items when `bevy_person_id` is present.

### Improved
- **Unified Dietary Restrictions Selector**: Reused the same dietary restrictions checkbox/other component across both Add Speaker and Edit Speaker dialogs.

---

## [1.0.29] - 2026-11-15

### Added
- **Featured Event Dynamic Spotlight & Bevy Data Binding (`/dashboard/partnership`)**: Integrated live Bevy event selector (`BevyEventSelector`), allowing organizers to bind the partnership featured event spotlight directly to published Bevy events. Automatically extracts technology focus tags and description narrative with custom editorial overrides.
- **Dynamic Event Data Tokenizer & Drag-and-Drop Parameter Chips**: Added comprehensive event token resolution (`{{event:title}}`, `{{event:date}}`, `{{event:hours}}`, `{{event:venue}}`, `{{event:capacity}}`) across partnership hero lead paragraphs, highlight cards, and sponsor FAQs with 1-click draggable chips, live resolved preview, and 2-6 card quota limits.
- **Dynamic Sponsor FAQ Event Tokenization (`/partnership`)**: Bound partnership sponsor FAQ questions and answers to live featured event data, updating automatically on the public partnership accordion whenever a new event is set as featured.
- **Event Visibility Toggle**: Added an instant toggle switch on both dashboard configuration and public display for the Featured Event Spotlight section.
- **Contextual Action Links for "Why Us" Value Cards**: Replaced static repetition with tailored contextual action links and dedicated handlers for all 6 partnership value propositions.

### Fixed
- **Mobile Overflow & Button Truncation**: Fixed flexbox wrap, textarea min-height, and button layout overflow in the highlight cards and sponsor FAQ authoring panels.
- **Organizer Dashboard Card Hierarchy**: Swapped card layout positioning so Community Organizers is displayed above the Referral Leaderboard.
- **Homepage Ticketing Accuracy & Community Access Redesign**: Modernized `CommunityAccessSpotlight` with verified monogram, lanyard slot, and updated admission copy clarifying that while most meetups are 100% free, flagship summits offer subsidized community pricing.

---

## [1.0.28] - 2026-11-14

### Fixed
- **Organizer Role Bootstrap & Firestore Permission Deadlock**: Added `isBootstrapOrganizerEmail()` and extended `isMatchingEmail()` in `firestore.rules` to handle Bevy's masked team email format (`f**********@gmail.com`). Prevented chicken-and-egg permission-denied loops when accessing `event_registrations` and updating member documents.
- **Accidental Role Downgrade Prevention**: Hardened `saveFirestoreMember` and `account-profile-tab` so transient Bevy API timeouts or regular profile updates never demote existing organizers/Core Team members back to `"member"`.
- **Bevy Role Standardization & Regional Lead Handling**: Normalized Bevy `roleId: 4` and `"regional_lead"` roles through helper `isGooglerRole()`, ensuring seamless executive permissions across the dashboard.
- **Interactive Role Sync Controls**: Added 1-click **"Sync Roles to Firestore"** on the Chapter Team tab (`/dashboard/members?tab=team`) and **"Sync Role"** on the Account Chapter tab (`/dashboard/account`).

---

## [1.0.27] - 2026-11-13

### Fixed
- **Organizer Role Authority & Chapter Role Persistence**: Resolved role display discrepancy on the account screen by prioritizing active session organizer and core team roles over stale Firestore member records. Updated `saveFirestoreMember` to preserve and persist `chapter_role` alongside user profiles.

---

## [1.0.26] - 2026-11-13

### Fixed
- **Google Sign-In Redirect Loop & Popup Fallback**: Restored `signInWithPopup` as the primary authentication mode with seamless automatic fallback to `signInWithRedirect` when popups are blocked or unsupported by the browser. Memoized `handleGoogleRedirectResult` across concurrent callers and synchronized `onAuthStateChanged` to eliminate auth state race conditions and premature navigation before session cookies settle.

---

## [1.0.25] - 2026-11-12

### Fixed
- **Algolia Member Search Authentication & Content Negotiation (`/dashboard/members`)**: Added `/config/algolia` to protected Bevy API endpoints to inject organizer session credentials, and updated client `Accept` headers to `application/json; version=bevy.1.0` (semicolon). This enables Bevy to return the dynamic secured `chapter_member_key` and allows real-time member searches across all ~17.8k chapter members via Algolia.
- **Server-Driven Pagination & Full 17.8k Member Count**: Configured TanStack Table with manual server-side pagination (10 rows/page) and an enhanced multi-ellipsis pagination bar supporting thousands of pages. Switching between Community Members and Chapter Team tabs now preserves cached member state without falling back to 20 pages.
- **Tab Switching & Search Loading Shimmer States**: Integrated pulsating skeleton shimmer rows on table page fetching and debounced search, with deferred composition to keep tab navigation responsive.
- **Google Auth Redirect Fallback for WebKit Browsers**: Added Firebase `signInWithRedirect` and mount-time `getRedirectResult` handling alongside rewrites for `/__/auth/` to ensure reliable sign-in on browsers where popups fail.

---

## [1.0.24] - 2026-11-12

### Improved
- **Algolia Fast-Path for Member Bevy Sync (`/dashboard/members`)**: Integrated Bevy's official high-throughput chapter Algolia index (`google_chapter_member_index_production`) as a pre-check fast path in `syncSingleMemberToBevyAction`. Syncing members with existing Bevy accounts resolves their Bevy User ID instantly via Algolia with zero Bevy REST calls, avoiding HTTP 429 rate limits during bulk sync operations.

---

## [1.0.23] - 2026-11-12

### Fixed
- **Rate Limit Circuit Breaker on Bulk Bevy Member Sync (`/dashboard/members`)**: Added automatic circuit breaker detection for Bevy API 429 rate limit responses during bulk member sync. When Bevy triggers a rate limit, the loop halts immediately and displays a clear toast notification reporting the exact count of members successfully verified and updated before the limit was reached.

---

## [1.0.22] - 2026-11-12

### Removed
- **Header "Sync with Bevy" Button (`/dashboard/members`)**: Removed the heavy global chapter sync button from the table header to avoid unnecessary background queries; member verification is handled directly and transparently via table row selection and "Bulk sync Bevy ID" action bar.

---

## [1.0.21] - 2026-11-12

### Fixed
- **Bevy Sync Duplicate Resurrection Prevention (`syncBevyMembersToFirestore`)**: Fixed synchronization loop where syncing with Bevy would resurrect deleted numeric Bevy ID documents (`/members/{bevy_user_id}`). The sync service now maps incoming Bevy records against existing Firestore members by verified email and Bevy User ID, prioritizing primary Firebase Auth UID documents and merging directly into them without creating duplicate documents.
- **Paginated Bulk Bevy Member Sync & Batch Chunking**: Adjusted Bevy sync to use `fetchAllBevyChapterMembersAction` with pagination (up to 1,000 members) and split Firestore operations across 400-doc batches, preventing the previous 230-member single-batch limitation and Firestore 500-doc writeBatch cap.

---

## [1.0.20] - 2026-11-12

### Added
- **Single & Bulk Member Merge System (`/dashboard/members`)**: Added intelligent duplicate detection and merging for Firestore member records with duplicate entries by shared email or Bevy User ID.
  - Automatically identifies duplicate clusters, scores authoritative documents (retains primary Firebase Auth UID and unmasked real email address), and re-links event registrations before deleting secondary documents.
  - Added individual "Merge duplicate..." dialog from row actions and top-bar "Bulk merge duplicates" scanner dialog.
- **Top-Level Chapter Bulk Sync to Bevy (`/dashboard/members`)**: Added top-bar "Sync with Bevy" button to run chapter-wide synchronization of members and chapter team roster directly from Bevy into Firestore.

### Fixed
- **Strict Bevy ID Assignment without Synthetic Fallbacks**: Completely eliminated fallback Bevy User IDs (e.g. `"1005761"`) in Bevy organizer authentication resolution; members without a verified Bevy user ID are marked as `null` and treated as `not_synced` to prevent cross-account collisions.

## [1.0.16] - 2026-11-12

### Fixed
- **Googler & Regional Lead RBAC Normalization**: Fixed Bevy chapter role resolution for Regional Leads and Community Managers (`roleId=4` and `roleId=1` with custom titles like "Regional Lead" / "Community Manager") to correctly resolve as executive organizers with full dashboard access to event registrants and analytics.
- **Defensive Role Hydration Guards**: Added fallback guards in client auth provider and session restoration for legacy Firestore member documents and session cookies storing `"googler"`, guaranteeing seamless access without requiring a manual sign-out.

---

## [1.0.15] - 2026-11-11

### Added
- **Transactions & QRIS Payments Dashboard (`/dashboard/payments`)**: Built dedicated real-time organizer dashboard for incoming DOKU QRIS payments, webhook notifications, and operational email dispatch status.
- **DOKU Payment Status Checking & Bulk Actions**: Added individual and bulk live status verification against DOKU Check Status API with automatic sync and audit logs.
- **Canonical Filtration Layout**: Standardized the payments table and filtration controls to replicate the canonical `registrants-tab.tsx` component hierarchy (Avatar + Customer info, InputGroup search, FilterSelect dropdowns, status pills, and batch actions toolbar).
- **Payment & Email Status Persistence**: Track email delivery (`payment_email_status`, `payment_email_sent_at`, `payment_email_recipient`) on registrations and orders, and persist incoming payloads to `payment_transactions` collection.

---

## [1.0.14] - 2026-11-11

### Fixed
- Fixed presentation slides URL autofill in Agenda slide deck builder to populate from confirmed speaker data with manual override support.
- Fixed speaker confirmation `session_slot` and presentation slides URL auto-synchronization when agenda activities are bound to speakers.
- Fixed speaker handbook links in invitation emails and templates to use canonical `gdgjakarta.com` instead of `gdgjakarta.org`.

### Added
- Codified domain usage standards rule (`.agents/rules/domain-usage.md`) requiring `gdgjakarta.com` for web applications and reserving `gdgjakarta.org` strictly for Short.io URL redirects and email identities.

---

## [1.0.13] - 2026-11-09

### Fixed
- Fixed Cloudflare Workers request hang and SSR stream deadlock by baking `NEXT_PUBLIC_FIREBASE_API_KEY` into `next.config.mjs` env and restoring resilient fallback resolution across server actions.

---

## [1.0.12] - 2026-11-09

### Added
- Enabled real-time error and issue tracking (`observability.issues: { enabled: true }`) in `wrangler.jsonc` for Cloudflare Workers.

### Improved
- Enforced strict environment variable validation for Firebase configuration across server actions and remote config.
- Synchronized missing environment variables and documented secret bindings (`wrangler secret put`) for deployment.

---

## [1.0.11] - 2026-11-09

### Fixed
- Fixed in-person event creation failure by omitting `virtual_event_type`, `virtual_venue_link`, and `virtual_event_instructions` from the Bevy payload for `IN_PERSON` events.

---

## [1.0.10] - 2026-11-09

### Fixed
- Unchecked "Show event on chapter page", "Disable social sharing", and "Allow automated emails" by default when creating new events.
- Added responsive spacing between Cancel and Give Feedback buttons in the user feedback dialog.

---

## [1.0.9] - 2026-11-09

### Improved
- Migrated `gdg-jakarta-automation` stack to a 4 GB RAM (`e2-medium`) GCP instance in `asia-southeast2-a` (Jakarta) with `gdg-gateway` edge reverse proxy support.

### Fixed
- Fixed Docker container logs popup dialog width constraint on screens above 640px to ensure wide terminal display.

---

## [1.0.8] - 2026-11-09

### Improved
- Cleaned up What's New / Changelog dialog UI by removing bottom action bar to maximize content view.

---

## [1.0.7] - 2026-11-09

### Added
- One-click HTML Error Page inspection for public service health probes and Docker Ops Agent.
- Streamlined organizer System Health dashboard with real-time status chips and modal settings configuration.

### Improved
- Redesigned Auto-refresh toggle button with live pulsing status indicator and mono interval badge.
- Added explicit Settings trigger action to manage public service URLs and probe parameters.

---

## [1.0.6] - 2026-11-09

### Added
- Unified Agenda & Breakout Sessions synchronization with Bevy API live sessions.
- Interactive Copy Agenda Dialog to duplicate schedules across stages and dates.
- System Health Dashboard (`/dashboard/health`) with live Docker container metrics, logs, and 1-click PostgreSQL backup.
- Event Tags Input and rich Google Maps pinpoint picker for venue addresses.

### Improved
- Short link button generation for event URLs with instant click-to-copy.
- Expanded date and time pickers with intuitive wheel and keyboard selection.

---

## [1.0.5] - 2026-11-08

### Added
- Instant search and find features on the public events directory page (`/events`).
- Dynamic `my-events` email link interpolation with live attendee authentication context.

### Fixed
- Prevented ticket tier badge text from clipping and overflow on smaller cards.
- Ensured consistent ticket status badges across member event views.

---

## [1.0.4] - 2026-11-07

### Added
- Automatic bundle voucher cleanup upon registration cancellation, deleting unredeemed friend vouchers.
- Pre-filled Bevy highlight video URL and enabled opening recap video in a new tab.

### Fixed
- Enforced styled blue hyperlinks and `target="_blank"` on public event description content.
- Hardened Firestore security rules for partner voucher redemptions and registration records.

---

## [1.0.3] - 2026-11-04

### Added
- Full-chapter member search powered by Bevy's Algolia index across all chapter members.
- Dedicated Chapter Team Management tab with Add, Edit, and Delete team member dialogs.
- Real-time member sync with Bevy user lookup by email.

### Improved
- Display unmasked email addresses for verified organizers and check-in staff.
- Masked emails in team roster table for attendees and privacy protection.

---

## [1.0.2] - 2026-11-03

### Added
- Merchandise delivery counters in event header and tabs (`<total> Merchandise Delivery (<pending> pending)`).
- Loading shimmer skeletons for breakout session registrant rosters.
- WhatsApp direct message and quick copy actions to breakout session attendee rosters.
- Preserved breakout session states during agenda edits and saves.

### Fixed
- Replaced nested scroll areas with native scroll containers to fix link truncation in links manager.
- Expanded bulk link action dialog sizing to prevent modal clipping.
- Excluded static partner fields from dynamic sponsorship tier parsing.

---

## [1.0.1] - 2026-11-03

### Added
- Configurable merchandise fulfillment and production timelines (lead time & courier shipping weeks).
- Attendee fulfillment announcement notes on registration and order dialogs.
- Automatic virtual stream button transition to "View Recording" when event concludes.
- Excluded test and hidden events from public and member event listings.

### Fixed
- Handled Bevy pagination using `pagination.next_page` URL parameter.
- Adjusted event detail header counters to full width with drop percentage positioning.

---

## [1.0.0] - 2026-11-02

### Added
- Google Maps interactive pinpointing and direct location link for merchandise delivery addresses.
- Merchandise variant exchange support on on-the-spot attendee item collection.
- Refund and delivery flows for uncollected merchandise post-event.
- Label Station and thermal printer setup configuration with local worker download guidance.
- Main Event default session selection and distinctive Bevy RSVP tags.

### Improved
- Moved merchandise delivery fee configuration into an organizer modal dialog.
- Added entropy and deduplication for fallback attendee merchandise status logs.
