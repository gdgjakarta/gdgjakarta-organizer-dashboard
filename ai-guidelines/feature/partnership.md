# Partner & Sponsor Management, Bevy Sync & Tokenized Document Generator

## Overview
The Partnership & Sponsorship feature enables organizers to manage both chapter-wide partners (`/dashboard/partnership`) and event-specific sponsors (`/dashboard/events/[eventId]` -> **Sponsors** tab), sync brand assets and tier mappings directly with Bevy (`POST /api/sponsor/`, `PATCH /api/event/[eventId]/`, `POST /api/image/`), collect self-service confirmations via public tokenized forms, send pitch proposals, and generate tokenized **Invoice V2**, **Quotation V1**, and **LOA V2 (Letter of Agreement)** PDFs.

## Key Routes & Components
- **Organizer Partnership Dashboard**:
  - `src/app/(main)/dashboard/partnership/page.tsx`
  - `src/app/(main)/dashboard/partnership/_components/partnership-dashboard.tsx`
  - `src/app/(main)/dashboard/partnership/_components/partners-tab.tsx`
  - `src/app/(main)/dashboard/partnership/_components/document-templates-tab.tsx`
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
- **Server Actions & API Routes**:
  - `src/server/sponsor-actions.ts`
  - `src/server/sponsor-confirmation-actions.ts`
  - `src/server/sponsor-document-actions.ts`
  - `src/server/public-proposal-actions.ts`
  - `src/app/api/events/upload-sponsor-logo/route.ts`

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
