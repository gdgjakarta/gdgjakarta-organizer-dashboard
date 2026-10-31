# Partner Voucher Redemption Reports (Zero-Leak Architecture)

Live public report feature allowing organizers to share voucher redemption metrics and attendee redemption lists with sponsors and partners safely, with full PII masking and access code gating.

---

## 1. Threat Model & Zero-Leak Requirements

1. **Voucher Code Leakage**:
   - Standard voucher documents in Firestore use the key `{eventId}_{voucherCode}`. Exposing this key or promo code in URLs would allow attendees to discover and redeem secret discount vouchers.
   - **Mitigation**: Each shareable voucher generates an unguessable 24-character opaque token (`vshr_<random>`). The public URL is `/vouchers/report/[shareToken]`.
   - **Screenshare / Deck Protection**: Organizers can toggle `partner_show_voucher_code` (defaults to `false`). When `false`, the code is rendered as `DEV****50` so partner presentations or screenshares do not leak the code to attendees.

2. **Attendee PII Scraping**:
   - Registrants provide real names, emails, and phone numbers. Partners only need to verify redemption authenticity.
   - **Mitigation**: Zero raw PII is sent to the client. The Next.js Server Action (`getPartnerVoucherReportAction`) fetches the registration documents on the server and applies irreversible masking via `src/lib/security/pii-mask.ts`:
     - Email: `fachridantm@gmail.com` -> `fa***m@gmail.com`
     - Name: `Muhammad Fachridan T.` -> `Muhammad F*** T***`
     - Phone: `+628123456789` -> `+62 812-****-**89`

3. **Access Code Protection**:
   - Even with an opaque link, viewing the report requires an organizer-provided partner access code (`partner_access_code`, e.g. `GDG-XXXXXX`).
   - Partners can input it in the access gate or organizers can share direct links containing `?code=GDG-XXXXXX`.

---

## 2. Architecture & File Reference

| Layer | File | Purpose |
|---|---|---|
| **Security Utils** | [`src/lib/security/pii-mask.ts`](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/src/lib/security/pii-mask.ts) | PII masking helpers & token generation functions (`generateOpaqueShareToken`, `generatePartnerAccessCode`). |
| **Data Types** | [`src/lib/firestore/types.ts`](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/src/lib/firestore/types.ts) | `EventVoucher` extensions, `MaskedVoucherRedemption`, and `PublicPartnerVoucherReport`. |
| **Server Action** | [`src/server/voucher-partner-actions.ts`](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/src/server/voucher-partner-actions.ts) | `getPartnerVoucherReportAction` querying Firestore REST API, verifying code, masking PII. |
| **Public Page** | [`src/app/(external)/vouchers/report/[shareToken]/page.tsx`](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/src/app/(external)/vouchers/report/[shareToken]/page.tsx) | Next.js Server Component route with `robots: noindex, nofollow`. |
| **Public View** | [`src/app/(external)/vouchers/report/[shareToken]/_components/partner-voucher-report-view.tsx`](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/src/app/(external)/vouchers/report/[shareToken]/_components/partner-voucher-report-view.tsx) | Client component rendering access gate, KPI metrics, progress bars, masked attendee table, search, CSV export. |
| **Organizer Dialog** | [`src/app/(main)/dashboard/events/[eventId]/_components/voucher-dialog.tsx`](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/src/app/(main)/dashboard/events/[eventId]/_components/voucher-dialog.tsx) | Partner sharing switch, partner name, access code generator, promo code reveal toggle, link preview. |
| **Redemptions Dialog** | [`src/app/(main)/dashboard/events/[eventId]/_components/voucher-redemptions-dialog.tsx`](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/src/app/(main)/dashboard/events/[eventId]/_components/voucher-redemptions-dialog.tsx) | "Share with Partner" button in action bar. |
| **Vouchers Tab** | [`src/app/(main)/dashboard/events/[eventId]/_components/vouchers-tab.tsx`](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/src/app/(main)/dashboard/events/[eventId]/_components/vouchers-tab.tsx) | Action menu copy link button and "Partner Report" status badge. |
| **Security Rules** | [`firestore.rules`](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/firestore.rules) | Schema validation for partner sharing fields on `event_vouchers`. |
