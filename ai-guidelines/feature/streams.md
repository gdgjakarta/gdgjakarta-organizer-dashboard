# Restricted Event YouTube Stream Access

## Overview
Allows organizers to attach an embedded YouTube stream (or video) to any event (`/dashboard/events/[eventId]` → **Stream** tab) and publish a dedicated watch page at `https://gdgjakarta.com/events/[eventId]/watch` in either **Public** or **Whitelisted (Single-Use Email OTP)** mode.

## Security Model & Honest Boundaries
- **Server-Side Enforcement**:
  - In `whitelisted` mode, the YouTube video ID is **AES-256-GCM encrypted** (`sealed_video_id`) using a server-only key (`STREAM_ACCESS_SECRET` or fallback to existing server n8n secret env var) and is never embedded in SSR HTML or client-readable Firestore documents.
  - Whitelist emails are stored as server-salted **HMAC-SHA256 hashes** (`whitelist_email_hashes`) in `event_streams/{eventId}`, while organizer-editable plaintext URLs and manual emails live in `event_streams_private/{eventId}` (`hasTeamAccess()` only).
  - Single-use 6-character OTP codes are stored hashed in `event_stream_codes/stcode_<64-hex>` with a 10-minute TTL, max 5 failed attempts, and rate limiting (1 request/60s, 5/hour). Requesting a new code immediately revokes any prior pending code and active session.
  - Redeeming a code burns it immediately (`status: "redeemed"`) and creates `event_stream_sessions/strm_<32-hex>`.
  - Leaving/closing the watch page fires `navigator.sendBeacon` to `POST /api/events/[eventId]/stream/leave` to expire the session immediately, and a 30s heartbeat unmounts the player if revoked.
- **Client-Side Casual Deterrence**:
  - `ProtectedYoutubePlayer` uses the YouTube IFrame Player API (`youtube-nocookie.com`, `controls: 0`, `disablekb: 1`, `rel: 0`) with a transparent click-shield overlay (`pointer-events-none` on iframe, `contextmenu` blocked), custom accessible controls, and a moving dynamic viewer watermark (`email • #session • HH:mm`).
  - **Known Limitation**: Because the browser must load YouTube media directly, technical users with DevTools Network inspection can still extract the YouTube Video ID during active playback. The watermark and OTP gate provide casual deterrence and leak attribution, not DRM.

## Key Files
- [`src/lib/events/stream-access.ts`](../../src/lib/events/stream-access.ts) — Web Crypto HMAC/AES-GCM helpers, OTP generator, email parser/masker, and rate-limit evaluator.
- [`src/server/stream-actions.ts`](../../src/server/stream-actions.ts) — Organizer config actions, approved registrant whitelist sync, public metadata projection, n8n OTP dispatch, single-use redemption, and session heartbeat/revocation.
- [`src/app/api/events/[eventId]/stream/leave/route.ts`](../../src/app/api/events/%5BeventId%5D/stream/leave/route.ts) — `sendBeacon`/`keepalive` session expiration endpoint.
- [`src/app/(main)/dashboard/events/[eventId]/_components/stream-access-tab.tsx`](../../src/app/(main)/dashboard/events/%5BeventId%5D/_components/stream-access-tab.tsx) — Organizer dashboard tab.
- [`src/app/(external)/events/[eventId]/watch/page.tsx`](../../src/app/(external)/events/%5BeventId%5D/watch/page.tsx) & `_components/{restricted-stream-viewer,protected-youtube-player}.tsx` — Public watch page, OTP gate, and protected player.
- [`firestore.rules`](../../firestore.rules) — Security rules for `event_streams`, `event_streams_private`, `event_stream_codes`, and `event_stream_sessions`.
