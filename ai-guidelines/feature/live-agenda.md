# Live Agenda Feature Guide

A public live board at `/events/live-agenda` (no login; lives under the `(external)` layout, so it shows the public header/footer until fullscreen) that shows what is happening on each stage right now. It is meant to be linked from the member My Events dashboard (the entry button is not built yet) and is designed for a 3-column desktop layout that collapses to one column on small screens.

---

## Current scope

All three columns are implemented (left: venue map, middle: time + stages, right: feedback).

- DevFest logo (`LIVE_AGENDA_LOGO_URL`).
- Ticking clock in `Asia/Jakarta` (labelled WIB) with the date.
- One block per stage: `<h2>` "<stage> Track" and `<h3>` agenda title of the agenda running now, otherwise the next one, otherwise the last one. A badge shows Happening now / Up next / Finished plus the agenda's time label. Below the stages: "See full agenda here" and a link to `LIVE_AGENDA_FULL_AGENDA_URL` (`https://gdgjakarta.org/devfest26`).

- **Left column** (`venue-map-column.tsx`): `<h2>` "Venue Map" on top, the venue map image, then a `<h3>` hint below it (image: `LIVE_AGENDA_VENUE_MAP_URL`, `assets.gdgjakarta.org/devfest/instagram-post-21.png`, 4:5, same width as the feedback QR card: `w-64 sm:w-72`). Uses `lg:col-start-1`; on mobile the DOM order (time, venue, feedback) applies.
- **Right column** (`feedback-column.tsx`): `<h2>` "Thank you for attending <event name>" on top, a QR code (`generateQrSvgDataUrl`) to `LIVE_AGENDA_FEEDBACK_URL` (`http://gdgjakarta.org/feedback`); the QR card is also a link, then `<h3>` "Please take a moment to fill our feedback form" below it. Event name = unique titles of the shown events joined with " & " (fallback "our event"). Uses `lg:col-start-3`.

Every column is vertically centered in the board (columns use `justify-center`; the grid fills the board height).

The whole board can go fullscreen (button top-right, Fullscreen API on the container). Its background is the `--live-agenda-bg` CSS variable fed by `LIVE_AGENDA_BACKGROUND_URL`; both asset URLs live in `src/lib/events/live-agenda.ts` and point to `assets.gdgjakarta.org/devfest/`. Text is white on the green background in both themes.

`live-agenda-view.tsx` owns the grid and the shared `now` ticker.

---

## Files

- `src/app/(external)/events/live-agenda/page.tsx`: Server Component. Resolves today's events and builds the stages.
- `src/app/(external)/events/live-agenda/_components/live-agenda-view.tsx`: Client Component with the 1-second ticker (starts as `null` to avoid hydration mismatch).
- `src/app/(external)/events/live-agenda/_components/current-time-column.tsx`: Column 1.
- `src/lib/events/live-agenda.ts`: pure helpers (`buildLiveAgendaStages`, `parseTimeLabel`, `getStageHighlight`, `getDateKeyInTimeZone`, `getMinutesInTimeZone`).

## Data flow

1. The nearest Bevy published event that is running or still ahead (end day >= today in `Asia/Jakarta`) is selected, together with any other event starting the same day. `?eventId=<id>` pins one event regardless of date.
2. For each event, the Bevy event (agenda, speakers) and Firestore doc (`sessions`, `presentation_slides`) are merged with `buildUnifiedAgenda`, the same builder the public agenda tab uses.
3. Each unified session group with items becomes a stage. A single generic "Agenda Schedule" group takes the event title as its stage name; a trailing "Track" in a title is stripped and re-added on display.
4. The client picks the highlighted agenda per stage every second.

## Time parsing rules

- Accepts "09:05 WIB", "08:15 WIB - 12:00 WIB", "9:00 AM – 10:30 AM"; WITA / WIT labels are shifted to WIB. Items without a parseable time are ignored.
- A missing end time runs until the next agenda starts; the last agenda without an end time runs 60 minutes.
- Times are only compared with the clock on event days (`startDay`..`endDay`, WIB). Before the event day the first agenda shows as Up next; after it the last shows as Finished (`getEventPhase`).
