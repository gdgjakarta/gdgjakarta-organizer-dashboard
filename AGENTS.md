# AGENTS.md

Welcome to the **GDG Jakarta Organizer Dashboard** repository. Follow these guidelines when reading, writing, and refactoring code across the application.

For in-depth architectural patterns, Bevy API session spoofing specifications, repository architecture, and feature guides, refer to the [AI Guidelines Index](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/INDEX.md):
- [1. Architectural Patterns & Data Models](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/1-architectural-patterns.md)
- [2. Design Tokens & Theming](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/2-design-tokens-theming.md)
- [3. Component Composition & UI Rules](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/3-component-composition-ui.md)
- [4. Code Style & Preferences](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/4-code-style-preferences.md)
- [5. Networking & Bevy API Session Spoofing](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/5-networking-and-bevy-api.md)
- [6. Repository & Data Layer Architecture](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/6-repository-and-data-layer.md)

Feature Guidelines:
- [Authentication](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/authentication.md) | [Events](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/events.md) | [Attendees](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/attendees.md) | [QR Scanner](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/scanner.md) | [Members](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/members.md) | [Profile](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/profile.md) | [Tickets](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/tickets.md) | [Printers](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/printers.md)

---

## Project overview

GDG Jakarta Dashboard is a responsive admin community management or event organizer dashboard built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, and shadcn/ui. 

The dashboard will have two roles: admin/organizer and member/user. 

Admin/organizer dashboard:
- Create, edit, delete events
- Create, edit, delete tickets
- Create, edit, delete event merchandises
- Configure thermal badge printers, label templates, and automated check-in print stations
- Manage users
- Manage news
- Manage community 

Member/user dashboard:
- View events
- Register for events
- View tickets
- View event merchandises
- View news
- View community

This repository uses the shadcn `radix-nova` style. The shadcn CLI reports `base: "radix"`, which refers to Radix UI. Always inspect the local components in `src/components/ui/` because individual wrappers may use different primitives.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Focuses

This project will be simultaneously building the members and organizer dashboard, all together with a same codebase according to the feature that the user requested.

## shadcn skill

Use the shadcn skill for all work involving shadcn/ui components, styling, composition, registries, presets, or `components.json`.

If the skill is not available, install it with:

```bash
npx skills add shadcn/ui
```

The skill contains the component, styling, composition, accessibility, and CLI rules. Do not duplicate those rules here. Always inspect the local component source before using it.

Do not modify files inside `src/components/ui/` or `src/components/calendar/`. Keep these components intact and apply styling or customization where they are used.

## Setup

This project uses npm.

```bash
npm install
npm run dev
```

Available commands:

```bash
npm run build
npm run lint
npm run format
npm run check
npm run check:fix
npm run generate:presets
```

There is currently no automated test command. Run build, lint, check, or other validation commands only when the user explicitly requests that validation.


## User authentication

This project uses Firebase auth with Google Sign In provider.
Login page is at `src/app/(main)/auth/login/page.tsx`. 

## Co-location-based structure

Keep feature code close to the route that owns it.

- Dashboard routes: `src/app/(main)/dashboard/<screen>/page.tsx`
- Screen-specific components, data, and schemas: `src/app/(main)/dashboard/<screen>/_components/`
- Shared dashboard components: `src/app/(main)/dashboard/_components/`
- Shared application components: `src/components/`
- Local shadcn components: `src/components/ui/`
- Shared hooks and utilities: `src/hooks/` and `src/lib/`
- Theme presets: `src/styles/presets/`

Keep a component inside its route until it is reused by another feature. Do not move screen-specific code into a shared directory preemptively.

## Creating or extending a screen

1. Inspect the closest current screen before writing code.
2. When reproducing a UI from a screenshot or image, follow its visual direction closely, including layout, hierarchy, spacing, component structure, and important details. Implement it with the project's existing components and semantic theme tokens rather than copying raw color values. If the design needs a color that is not available through the existing theme tokens, or the user explicitly requests a non-theme color, use a named color from Tailwind's default palette. Do not use arbitrary hex, RGB, HSL, or OKLCH values.
3. Reuse the existing dashboard shell, local components, layout controls, and theme tokens.
4. Break each new page into focused components inside the route's `_components/` directory. Keep `page.tsx` small and focused on composing those pieces.
5. Keep `page.tsx` as a Server Component by default. Move interactive or browser-dependent code into a dedicated Client Component.
6. Add the screen to `src/navigation/sidebar/sidebar-items.ts` when it should appear in the dashboard navigation.
7. Decide the information hierarchy before choosing widgets. Let the content determine the page structure.
8. Keep the established visual rhythm where it fits: compact spacing, clear typography hierarchy, responsive action rows, and grids that collapse cleanly on smaller screens.
9. Widget selection is not a fixed formula. Try different arrangements of cards, resource rows, meters, charts, tabs, empty states, and actions, then keep the version that communicates the content clearly and feels consistent with the project.
10. Match nearby screens in card density, borders, radius, spacing, content width, and responsive behavior.
11. Use semantic theme tokens so new screens work with light mode, dark mode, and the existing theme presets.
12. Handle relevant loading, empty, error, disabled, and overflow states.
13. Keep screens accessible with semantic HTML, keyboard support, visible focus states, labels, and appropriate ARIA attributes.
14. Use the shared [`FloatingSaveBar`](file:///Users/fachridantm/IdeaProjects/gdgjakarta-organizer-dashboard/src/app/(main)/dashboard/_components/floating-save-bar.tsx) (`src/app/(main)/dashboard/_components/floating-save-bar.tsx`) for screens or tabs with editable settings/configurations so dirty-state tracking, discard, and floating save actions remain consistent across the dashboard.
15. **Document every new feature**: Whenever you add or extend a feature, add concise feature notes to `AGENTS.md` (under `## Feature Notes`) and update `ai-guidelines/` (`ai-guidelines/INDEX.md` and `ai-guidelines/feature/<feature>.md`).

## Feature Notes

- **Organizer Registration Cancellation with Mandatory Reason**:
  - Cancelling attendees from the dashboard (single attendee action and batch cancellation in `registrants-tab.tsx`) requires a non-empty cancellation reason input.
  - The reason is propagated to `sendCancelAttendeeEmailAction` and `deleteEventRegistrationAction` (passed into DOKU payment cancellation payloads if active payment exists).
  - The `cancelled` email template renders `<p><strong>Reason for Cancellation:</strong><br>{{ $('event-params').item.json.cancellationReason }}</p>` inside `.alert-box`.
  - Backward compatibility helper `ensureCancellationReasonInCancelledHtml` automatically injects this block into existing Firestore event templates, and template interpolation formats multi-line reasons using `<br>`.
  - Manual template test sender (`send-template-email-dialog.tsx`) and sample data config drawer (`configure-template-data-dialog.tsx`) also enforce / provide simulation for the cancellation reason.

- **Total Registered Attendee card**: `registrant-statistics.tsx` overview shows approved + `paid_and_registered` (+ attended/confirmed/registered) as one card; clicking applies the `registered_attendees` status filter handled in `registrants-tab.tsx`. Documented in the Status & Metric Guide.

- **Email Templates & Thermal Printers Ref & ID Alignment**:
  - Accepted / Ticket Confirmation email templates (`DEFAULT_ACCEPTED_EMAIL_HTML`) render the Attendee ID (`ID: {{ $('Add Bevy Attendee API').item.json.id }}`) directly beneath the Attendee Ref Code (`Ref: {{ $('Add Bevy Attendee API').item.json.attendee_code }}`).
  - Dynamic n8n webhook payload sanitizers (`adjustBodyEmailForApprovedWebhook`) and template parsers (`interpolateTemplateHtml`, `ensureAttendeeIdInAcceptedHtml`) preserve both ID and Ref code tags.
  - Thermal badge print templates render stacked reference badges (`REF: [[ticketCode]]` and `ID: [[attendeeId]]`), supported across default label templates, Monaco editor palettes, and auto-print queue generators.

- **Thermal Printers & Label Station (`/dashboard/printers`) & Per-Event Printer Templates**:
  - **Routes & Components**: `src/app/(main)/dashboard/printers/page.tsx`, `src/app/(main)/dashboard/printers/_components/printers-dashboard.tsx`, `src/app/(main)/dashboard/printers/_components/label-html-editor-preview.tsx`, and `src/app/(main)/dashboard/events/[eventId]/_components/event-printer-tab.tsx`.
  - **Per-Event Printer Templates & Form Questions**: Each event can configure its own thermal badge dimensions, orientation, and HTML badge template under the **Badge Printer** tab in `/dashboard/events/[eventId]`. Organizers can drag & drop answered registration form questions (`[[<question_id>]]`, `[[answers.<question_id>]]`, `[[question:<question_id>]]`) into the badge HTML template.
  - **Core Utilities**: `src/lib/printers/types.ts`, `src/lib/printers/templates.ts`, and `src/lib/printers/qr-svg.ts` (self-contained ISO/IEC 18004 SVG QR generator for `eventId:attendeeId`). `renderLabelTemplate` interpolates custom question answers from registration data alongside standard tokens.
  - **Check-In Integration**: `src/app/(main)/dashboard/events/[eventId]/_components/qr-checkin-scanner-dialog.tsx` checks event-specific `printer_config` first (falling back to system settings) when auto-printing badges on attendee check-in.
  - **Firestore & Kiosk Printing**: Persists system configuration in `system_settings/printer`, event configuration in `events/{eventId}.printer_config`, and print jobs (`MAX_STORED_PRINT_JOBS = 30`) in `system_settings/printer_queue`.

- **Payment Policy CMS (`/dashboard/faq` -> Payment Policy Page)**:
  - **Firestore Model & Storage**: Persisted in `content_settings/payment_policy`. Validated in `firestore.rules` for fields `header`, `notice`, `sections`, `channels`, `contact`, `updatedAt`, `updatedBy`.
  - **Hooks & State**: Handled via `usePaymentPolicyContent` (`src/lib/content/hooks.ts`) and `DEFAULT_PAYMENT_POLICY_CONTENT` (`src/lib/content/defaults.ts`). Auto-revalidates `/payment-policy`, `/faq`, and `/dashboard/faq`.
  - **Organizer CMS Dashboard**: Integrated into `src/app/(main)/dashboard/faq/_components/payment-policy-editor.tsx` and `payment-policy-section-dialog.tsx` as a dedicated tab under `/dashboard/faq`. Supports structured section editing, ordering, active/hide toggling, callout banners, and `FloatingSaveBar`.
  - **Public Display**: Rendered dynamically via `src/app/(external)/payment-policy/_components/payment-policy-view.tsx` with zero layout shift from default SSR baseline.


## Code conventions

- TypeScript strict mode is enabled. Use precise types and avoid `any`.
- Use the existing `@/` import aliases.
- Follow the Biome configuration: double quotes, semicolons, two-space indentation, sorted imports, and a 120-character line width.
- Avoid unnecessary dependencies.
- Keep changes focused and do not refactor unrelated files.

## Contributions

- Use conventional commit prefixes such as `feat:`, `fix:`, `refactor:`, `docs:`, and `chore:`.
- Include screenshots for new screens and material visual changes. Include mobile and dark-theme states when relevant.
- Explain new reusable patterns or dependencies in the pull request.
- Follow `CONTRIBUTING.md` for the contribution workflow.
