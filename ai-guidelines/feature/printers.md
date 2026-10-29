# Thermal Printers & Label Station Feature Guide

## Overview
The **Thermal Printers & Label Station** (`/dashboard/printers`) allows organizers and check-in staff to configure **Clabel 221B** thermal sticker rolls, customize high-contrast HTML badge templates, preview and configure sample attendee/event data in real time, and run a background print station listener that automatically prints attendee badges upon QR check-in without browser dialogs (via Chrome `--kiosk-printing`).

## Key Files
- **Route**: `src/app/(main)/dashboard/printers/page.tsx`
- **Dashboard Component**: `src/app/(main)/dashboard/printers/_components/printers-dashboard.tsx`
- **Monaco HTML Editor & Live Preview**: `src/app/(main)/dashboard/printers/_components/label-html-editor-preview.tsx`
- **Event-Specific Badge Printer Tab**: `src/app/(main)/dashboard/events/[eventId]/_components/event-printer-tab.tsx`
- **Types & Presets**: `src/lib/printers/types.ts`
- **Template Engine & Dynamic Sizing**: `src/lib/printers/templates.ts`
- **Offline SVG QR Generator**: `src/lib/printers/qr-svg.ts`
- **Check-In Scanner Integration**: `src/app/(main)/dashboard/events/[eventId]/_components/qr-checkin-scanner-dialog.tsx`
- **Firestore Persistence**: `src/lib/firestore/client.ts` (`system_settings/printer`, `events/{eventId}.printer_config`, and `system_settings/printer_queue`)

## Architecture & Patterns
1. **Per-Event Badge Printer & Form Question Tokens**:
   - Each event features a dedicated **Badge Printer** tab under `/dashboard/events/[eventId]`.
   - Organizers can drag and drop answered registration form questions (e.g. `[[company_or_institution]]`, `[[role_or_title]]`, `[[years_of_experience]]`, or custom question IDs) directly into the badge HTML template.
   - `renderLabelTemplate` resolves question tokens dynamically against `reg.answers` and provides live preview simulation with configurable sample data.
2. **Paper & Roll Sizing Sync (`syncTemplateDimensions`)**:
   - Changing the preset (`50×30mm`, `40×30mm`, `60×40mm`), orientation (`landscape` / `portrait`), or custom millimeter dimensions dynamically updates `@page`, `body`, `.ticket-badge`, typography pt sizes, and QR millimeter dimensions inside the HTML template.
3. **Offline SVG QR Code (`generateQrSvgDataUrl`)**:
   - Generates a crisp, self-contained SVG `data:image/svg+xml` QR code encoding `eventId:attendeeId` locally with zero external network dependencies.
4. **Interactive Sample Data Configurator**:
   - Organizers can select a live Bevy event or specific attendee and customize sample attendee/event/question fields directly from the Live Preview toolbar.
5. **Floating Save Bar (`FloatingSaveBar`)**:
   - Tracks unsaved changes across roll dimensions, orientation, auto-print preferences, HTML template, selected event, and sample data using `src/app/(main)/dashboard/_components/floating-save-bar.tsx`.
6. **Real-Time Print Queue (`system_settings/printer_queue`)**:
   - Stores up to 30 recent print jobs inside `system_settings/printer_queue`. When an attendee is checked in via `QRCheckinScannerDialog` with Auto-Print enabled, the scanner prioritizes event-level `printer_config` before falling back to system defaults, enqueuing a pending print job immediately rendered with all registration form answers.
