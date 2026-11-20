# Event Certificates (Attendance & Speaker Appreciation)

## Overview
Supports **Attendance Event Certificates** (member self-service on event wrap-up) and **Speaker Appreciation Certificates** (organizer manual/bulk email dispatch with PDF attachment and conditional event highlights).

## Key Files
- **Types & Utilities**: `src/lib/firestore/types.ts`, `src/lib/events/certificate-utils.ts`, `src/lib/events/certificate-webhooks.ts`
- **Google Drawing Overlay Renderer**: `src/lib/pdf/certificate-overlay.ts` (`pdf-lib` + `buildQrMatrix` vector QR)
- **Server Actions**: `src/server/certificate-actions.ts`
- **Organizer UI**:
  - `src/app/(main)/dashboard/events/[eventId]/_components/certificates-tab.tsx`
  - `src/app/(main)/dashboard/events/[eventId]/_components/certificate-overlay-editor.tsx`
  - `src/app/(main)/dashboard/events/[eventId]/_components/speaker-appreciation-panel.tsx` (mounted in `speakers-tab.tsx`)
- **Attendee UI & Public Verification**:
  - `src/components/events/attendance-certificate-actions.tsx` (mounted in `event-card-item.tsx`, `member-event-detail.tsx`, and `public-event-rsvp-card.tsx` desktop + mobile)
  - `src/app/(external)/certificates/[token]/page.tsx` & `_components/public-certificate-viewer.tsx`
- **n8n Workflows**: `docs/n8n-workflows/generate-certificate-api.json`, `docs/n8n-workflows/send-certificate-email-api.json`, `docs/n8n-workflows/README.md`

## Invariants
- **Dual Engine**: Per-event `events/{eventId}.certificate_config` supports separate `attendance` and `speaker` configs, each choosing `google_slides` (default, 1-slide 4:3 via n8n) or `google_drawing` (cached R2 Drawing PDF + `pdf-lib` overlay).
- **Lazy R2 Caching**: Attendance certificates generate on the attendee's first Download / Copy Link click, upload to Cloudflare R2 (`community-dashboard/events/{eventId}/certificates/{attendance|speaker}/`), and persist to `event_certificates/cert_<32-hex>`.
- **Security**: `claimAttendanceCertificateAction` cryptographically verifies the caller's Firebase ID token via `verifyFirebaseIdToken()` before calling n8n or R2, checks main event check-in (`is_checked_in || status === "attended"`), and `firestore.rules` enforces ownership, check-in, wrap-up unlock, `member_id` binding, and R2 URL prefix. `getPublicCertificateByTokenAction` strips `recipient_email`.
- **Canonical Domain**: Public verification links always use `https://gdgjakarta.com/certificates/{token}`.
- **Conditional Highlights**: `speaker_thank_you` email template renders `{{eventHighlightsHtml}}` via `renderEventHighlightsHtml()` — omitting the entire section when both `photo_album_url` and `highlight_video_url` / `video_url` are empty.
