# GDG Jakarta Organizer Dashboard AI Guidelines Index

Welcome to the comprehensive architecture, API, and feature documentation index for the **GDG Jakarta Organizer Dashboard**. This directory contains architectural standards, design tokens, code conventions, complete Bevy API specifications, repository and data layer patterns, and feature-specific implementation guides tailored for Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Firebase, and Bevy API integration.

---

## 🏛️ Core Architecture & Foundation Guidelines

| Document | Description |
|---|---|
| [1. Architectural Patterns & Data Models](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/1-architectural-patterns.md) | Next.js 16 App Router, React 19 Server vs. Client Components, Server Actions (`"use server"`), Zustand state management (`auth-store`, `preferences-store`), and Firestore database layering. |
| [2. Design Tokens & Theming](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/2-design-tokens-theming.md) | Tailwind CSS v4 configuration, shadcn/ui `radix-nova` base, theme presets (Tangerine, Brutalist, Soft Pop), CSS variable semantic tokens, and Google Developer Groups (GDG) brand color guidelines. |
| [3. Component Composition & UI Rules](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/3-component-composition-ui.md) | shadcn/ui composition rules, strict protection of `src/components/ui/` and `src/components/calendar/`, layout spacing, accessibility (ARIA & Radix primitives), and responsive breakpoints (`useMobile`, `useLg`). |
| [4. Code Style & Preferences](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/4-code-style-preferences.md) | Strict TypeScript typing (zero `any`), Biome formatting rules (double quotes, semicolons, 2-space indentation, 120 line width, sorted imports), error handling, and `@/` path alias usage. |
| [5. Networking & Bevy API Session Spoofing](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/5-networking-and-bevy-api.md) | Complete Bevy API specification, session spoofing architecture (`Cookie`, `X-Csrftoken`, dynamic `Referer` URLs), environment configuration, and exhaustive endpoint catalog with request/response schemas and error codes. |
| [6. Repository & Data Layer Architecture](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/6-repository-and-data-layer.md) | Dual-source Repository pattern: Remote Bevy API client (`src/lib/bevy/client.ts`), Server Actions (`src/server/`), Client Firestore operations (`src/lib/firestore/client.ts`), Sync Service, caching, revalidation, and offline resilience. |

---

## 📱 Feature Specifications & Guides

| Feature Document | Scope & Key Components |
|---|---|
| [Authentication Feature](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/authentication.md) | Firebase Google Sign-In, Bevy Chapter Team verification (`/chapter/{id}/team/`), role cookies (`auth_token`, `auth_role`), Access Pending state, role-based middleware routing, and profile completion. |
| [Events Feature](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/events.md) | Chapter events (`/chapter/{id}/event/`), Bevy-to-Firestore synchronization, event types, active event selection, custom questions, registration approval workflows, and live attendance metrics. |
| [Attendees Feature](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/attendees.md) | Attendee roster (`/event/{id}/attendee/`), real-time search (`/attendee_search/`), manual check-in (`PUT /attendee/checkin/`), undo check-in, walk-in registration (`POST /attendee/`), and Firestore approval pipeline. |
| [QR Scanner Feature](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/scanner.md) | Web camera QR/Barcode scanning using browser APIs (HTML5/BarcodeDetector), camera permissions, ticket code parsing, instant Bevy check-in verification, audio/haptic feedback, and duplicate prevention. |
| [Members Feature](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/members.md) | Community members directory (`/chapter/{id}/member/`), Core Team roster (`/chapter/{id}/team/`), role assignments, permissions, and member profile synchronization. |
| [Profile Feature](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/profile.md) | Organizer & member identity, Bevy user metadata, chapter details badge, preferences management, and secure sign-out. |
| [Tickets Feature](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/ai-guidelines/feature/tickets.md) | Ticket tiers, RSVP capacity controls, custom questionnaire schema, registration limits, and ticket verification. |
