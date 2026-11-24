# Partner & Sponsor Management, Bevy Sync & Tokenized Document Generator

## Overview
The Partnership & Sponsorship feature enables organizers to manage both chapter-wide partners (`/dashboard/partnership`) and event-specific sponsors (`/dashboard/events/[eventId]` -> **Sponsors** tab), sync brand assets and tier mappings directly with Bevy (`POST /api/sponsor/`, `PATCH /api/event/[eventId]/`, `POST /api/image/`), collect self-service confirmations via public tokenized forms, send pitch proposals, and generate tokenized **Invoice V2**, **Quotation V1**, and **LOA V2 (Letter of Agreement)** PDFs.

## Key Routes & Components
- **Organizer Partnership Dashboard**:
  - `src/app/(main)/dashboard/partnership/page.tsx`
  - `src/app/(main)/dashboard/partnership/_components/partnership-dashboard.tsx`
  - `src/app/(main)/dashboard/partnership/_components/partners-tab.tsx`
  - `src/app/(main)/dashboard/partnership/_components/document-templates-tab.tsx`
  - `src/app/(main)/dashboard/partnership/_components/sign-documents-tab.tsx`
  - `src/app/(main)/dashboard/partnership/_components/signature-creator-studio.tsx`
  - `src/app/(main)/dashboard/partnership/_components/pdf-placement-canvas.tsx`
- **Event Sponsors Tab**:
  - `src/app/(main)/dashboard/events/[eventId]/_components/sponsors-tab.tsx`
- **Shared Document Preview & Generator Modal**:
  - `src/components/sponsor-document-preview.tsx`
  - `src/components/sponsor-documents-dialog.tsx`
  - `src/components/sponsor-logo-cropper-dialog.tsx`
- **Public Portals & Confirmation Forms**:
  - `src/app/(external)/events/[eventId]/partner-confirmation/page.tsx` (Event-bound sponsor/partner confirmation)
  - `src/app/(external)/partnership/partner-confirmation/page.tsx` (Non-event chapter partner confirmation)
  - `src/app/(external)/partnership/proposals/[token]/page.tsx` (Interactive proposal decision portal)
  - `src/app/(external)/partnership/documents/[token]/page.tsx` (Shareable A4 PDF & online counter-sign portal for Invoice V2, Quotation V1, and LOA V2)
  - `src/app/(external)/partnership/signed-documents/[token]/page.tsx` (Public X.509 e-certificate & browser-only SHA-256 integrity verification portal)
- **Server Actions, PDF Signing Engine & API Routes**:
  - `src/server/sponsor-actions.ts`
  - `src/server/sponsor-confirmation-actions.ts`
  - `src/server/sponsor-document-actions.ts`
  - `src/server/partner-signage-actions.ts`
  - `src/server/public-proposal-actions.ts`
  - `src/lib/pdf/coordinate-transform.ts`
  - `src/lib/pdf/sign-pdf.ts`
  - `src/app/api/events/upload-sponsor-logo/route.ts`
  - `src/app/api/partnership/sign-pdf/route.ts`

## Architectural Invariants
1. **Poster Logo Upload & Sanitization**:
   - Logos are cropped in 16:9 poster aspect ratio (`SponsorLogoCropperDialog`) and uploaded directly to Bevy's image container (`POST /api/image/`, `container: "sponsors"`).
   - `sanitizeBevyLogoUrl` (`src/lib/bevy/partners.ts`) unwraps nested Cloudinary URLs returned by Bevy so Next.js `/_next/image` optimization always receives a valid origin URL.
2. **Default Tier & Organizer Control**:
   - Public sponsor confirmation forms omit the tier selection dropdown and default submissions to `"partner"`, leaving tier assignment (`platinum`, `gold`, `silver`, `bronze`, `community`, `partner`, `media_partner`) to organizers in the dashboard.
   - Updating a sponsor's tier in the dashboard invokes `syncBevySponsorTierMapping` to migrate the sponsor ID across Bevy's tier arrays (`sponsors_platinum-4`, `sponsors_gold-5`, `sponsors_silver-4`, `sponsors_bronze-4`, `sponsors_community-4`, `partners_list`, `media_partners`).
3. **Tokenized Sponsor Documents (Invoice V2, Quotation V1, LOA V2)**:
   - Master templates, banking details, signatory defaults, and numbering patterns (`{{year}}/INV/{{seq}}`, `{{seq}}/QUO/GDGJKT/{{romanMonth}}/{{year}}`) are configured exclusively by organizers in `/dashboard/partnership` (**Document Templates** tab) and stored in `site_config/sponsor_document_templates`.
   - Per-sponsor documents are stored in `sponsor_documents` (`spdoc_${token}`), rendered via `SponsorDocumentPreview` with `@media print` A4 portrait rules, shareable via `/partnership/documents/[token]`, counter-signable online (Quotation & LOA), and dispatchable via n8n (`/webhook/api/send-email`).
   - Invoices can be prefilled directly from an existing Quotation (via the **Create Invoice from Quotation** row action on any Quotation or the **Prefill from Quotation** selector inside the Invoice editor), copying billing/contact info, event metadata, tier, currency, bank details, and cloned line items while preserving Invoice-specific numbering, dates, and tax notes, and persisting `source_quotation_id` / `source_quotation_number`.
4. **Partner PDF Signage & X.509 PKCS#7 E-Certificate (`Sign Partner PDFs` tab)**:
   - Executive Organizers can upload partner-provided PDFs (`<= 15 MB`), render pages locally via `pdfjs-dist` (`/pdf.worker.min.mjs`), create transparent PNG signatures (**Initials / Typed Name**, **Freehand Draw**, or **Upload / Saved Organizer Signature** fetched via same-origin `/api/media/`), drag & resize placements across pages (`mapViewportRectToPdf` handles `0°/90°/180°/270°` rotation and `CropBox` offsets), and optionally append an A4 Certificate of Completion & QR audit trail page.
   - Server-side `signPartnerPdfBuffer` (`src/lib/pdf/sign-pdf.ts`) embeds PNGs/stamps with `pdf-lib`, saves with `useObjectStreams: false`, and embeds an `adbe.pkcs7.detached` X.509 signature via `@signpdf/signpdf` + `@signpdf/signer-p12` using Worker secrets (`PDF_SIGNING_P12_BASE64`, `PDF_SIGNING_P12_PASSPHRASE`), with automatic `hash_only` SHA-256 fallback when `.p12` secrets are absent.
   - Finalized signed PDFs are uploaded only under `community-dashboard/partnership/signed-documents/<slug>-signed-<16-hex>.pdf` in Cloudflare R2 (`https://assets.gdgjakarta.org`), recorded in `partner_signed_documents/psgn_<token>`, shareable by bucket URL / n8n email, and locally verifiable bit-for-bit via Web Crypto SHA-256 at `/partnership/signed-documents/[token]`.
