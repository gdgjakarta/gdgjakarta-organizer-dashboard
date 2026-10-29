# Thermal Printers & Label Station Feature Guide

## Overview
The **Thermal Printers & Label Station** (`/dashboard/printers`) allows organizers and check-in staff to configure **Clabel 221B** thermal sticker rolls, customize high-contrast HTML badge templates, preview and configure sample attendee/event data in real time, and run a background print station listener that automatically prints attendee badges upon QR check-in without browser dialogs (via Chrome `--kiosk-printing`).

## Key Files
- **Route**: `src/app/(main)/dashboard/printers/page.tsx`
- **Dashboard Component**: `src/app/(main)/dashboard/printers/_components/printers-dashboard.tsx`
- **Monaco HTML Editor & Live Preview**: `src/app/(main)/dashboard/printers/_components/label-html-editor-preview.tsx`
- **Types & Presets**: `src/lib/printers/types.ts`
- **Template Engine & Dynamic Sizing**: `src/lib/printers/templates.ts`
- **Offline SVG QR Generator**: `src/lib/printers/qr-svg.ts`
- **Check-In Scanner Integration**: `src/app/(main)/dashboard/events/[eventId]/_components/qr-checkin-scanner-dialog.tsx`
- **Firestore Persistence**: `src/lib/firestore/client.ts` (`system_settings/printer` & `system_settings/printer_queue`)

## Architecture & Patterns
1. **Paper & Roll Sizing Sync (`syncTemplateDimensions`)**:
   - Changing the preset (`50×30mm`, `40×30mm`, `60×40mm`), orientation (`landscape` / `portrait`), or custom millimeter dimensions dynamically updates `@page`, `body`, `.ticket-badge`, typography pt sizes, and QR millimeter dimensions inside the HTML template.
2. **Offline SVG QR Code (`generateQrSvgDataUrl`)**:
   - Generates a crisp, self-contained SVG `data:image/svg+xml` QR code encoding `eventId:attendeeId` locally with zero external network dependencies.
3. **Interactive Sample Data Configurator**:
   - Organizers can select a live Bevy event via `PublishedEventSelector` and customize sample attendee/event fields (`[[Name]]`, `[[title]]`, `[[company]]`, `[[ticketCode]]`, `[[attendeeId]]`, `[[sessionTrack]]`, `[[EventName]]`, `[[eventId]]`) directly from the Live Preview toolbar.
4. **Floating Save Bar (`FloatingSaveBar`)**:
   - Tracks unsaved changes across roll dimensions, orientation, auto-print preferences, HTML template, selected event, and sample data using `src/app/(main)/dashboard/_components/floating-save-bar.tsx`.
5. **Real-Time Print Queue (`system_settings/printer_queue`)**:
   - Stores up to 30 recent print jobs inside `system_settings/printer_queue`. When an attendee is checked in via `QRCheckinScannerDialog` with Auto-Print enabled, a pending print job is enqueued and immediately printed by any active Print Station tab via a hidden `<iframe>`.
