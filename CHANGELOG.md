# Changelog

All notable changes to the **GDG Jakarta Dashboard** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
