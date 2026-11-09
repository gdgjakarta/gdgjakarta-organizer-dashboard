# Changelog

All notable changes to the **GDG Jakarta Dashboard** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
