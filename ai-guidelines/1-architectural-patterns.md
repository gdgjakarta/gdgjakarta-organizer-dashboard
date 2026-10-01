# Architectural Patterns & Data Flow

This guide outlines the architectural patterns, component separation, state management conventions, and data flow used across the **GDG Jakarta Organizer Dashboard**.

---

## 1. Clean Architecture Layering

The dashboard follows a modern Full-Stack Clean Architecture utilizing **Next.js 16 App Router**, **React 19**, **Server Actions**, **Zustand**, and **Firebase / Firestore**:

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                   │
│  src/app/(main)/dashboard/<screen>/page.tsx (RSC)       │
│  src/app/(main)/dashboard/<screen>/_components/ (Client)│
│  src/components/ui/ (shadcn radix-nova primitives)      │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                    State & Store Layer                  │
│  src/stores/auth/ (Zustand Auth Store & Provider)       │
│  src/stores/preferences/ (Theme & Layout Settings)      │
│  src/hooks/ (useMobile, useLg, local custom hooks)      │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                    Repository & Action Layer            │
│  src/server/ (Server Actions: "use server")             │
│    ├── auth-actions.ts (Auth cookies & Bevy validation) │
│    ├── bevy-actions.ts (Server-side Bevy API calls)     │
│    └── server-actions.ts (Path revalidations)           │
│  src/lib/firestore/ (Client-Side Firestore DB & Sync)   │
│    ├── client.ts (Direct Firestore CRUD operations)     │
│    ├── sync-service.ts (Bevy-to-Firestore batch sync)   │
│    └── actions.ts (Client registration orchestrators)   │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                    External Services Layer              │
│  Bevy API (https://gdg.community.dev/api) [Session Spoof]
│  Firebase Authentication (Google Sign-In)               │
│  Cloud Firestore (Real-time NoSQL collections)          │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Server Components vs. Client Components

### 2.1 Default to Server Components (`RSC`)
- Route entry points (`page.tsx`) must be **React Server Components (RSC)** by default.
- Keep `page.tsx` concise and responsible for:
  1. Inspecting cookies/headers (e.g. `cookies()`).
  2. Performing initial server data fetching (or delegating to child components).
  3. Composing screen layout and passing props down to Client Components.

```typescript
// src/app/(main)/dashboard/events/page.tsx (Server Component)
import { Suspense } from "react";
import { EventsHeader } from "./_components/events-header";
import { EventsListContainer } from "./_components/events-list-container";
import { EventsLoadingSkeleton } from "./_components/events-loading-skeleton";

export default async function EventsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <EventsHeader />
      <Suspense fallback={<EventsLoadingSkeleton />}>
        <EventsListContainer />
      </Suspense>
    </div>
  );
}
```

### 2.2 Client Components (`"use client"`)
Declare `"use client"` **only** when a component requires:
- Browser APIs (window, document, navigator, Web Camera).
- React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`).
- Event listeners (`onClick`, `onChange`, `onSubmit`).
- Zustand stores (`useAuthStore`, `usePreferencesStore`).
- Client-side Firestore operations.

Keep Client Components co-located inside the route's `_components/` directory.

---

## 3. Co-Location Structure

Keep code as close as possible to the route that consumes it:

```
src/app/(main)/dashboard/<screen>/
├── page.tsx                  # Main server component
├── layout.tsx                # Screen layout (if applicable)
├── loading.tsx               # Next.js streaming loading skeleton
├── _components/              # Screen-specific interactive components
│   ├── screen-header.tsx
│   ├── screen-table.tsx
│   ├── screen-filter-bar.tsx
│   └── modals/
├── _types/ or types.ts       # Screen-specific TypeScript interfaces
└── _hooks/                   # Screen-specific custom hooks
```

> [!IMPORTANT]
> Do not move screen-specific components into `@/components` until they are genuinely reused by multiple disparate features.

---

## 4. State Management with Zustand

Global cross-cutting concerns (authentication session, theme presets, sidebar state) are managed via **Zustand** stores wrapped in React Context Providers:

1. **`AuthStore` (`src/stores/auth/`)**:
   - Manages Firebase `User`, user role (`"organizer"` | `"member"`), Bevy user ID, and chapter role.
   - Initialized at root level in `src/stores/auth/auth-provider.tsx`.

2. **`PreferencesStore` (`src/stores/preferences/`)**:
   - Manages theme preset (`"tangerine"`, `"brutalist"`, `"soft-pop"`), dark/light mode, sidebar collapsed state, and layout density.
   - Synchronizes settings with cookies or local storage.

---

## 5. Client-Side Firestore Strategy

Because Cloudflare Workers and certain edge runtimes encounter protobuf compilation and V8 `EvalError` when running the Node.js Firebase Admin SDK in edge environments:
- **Firestore mutations and queries run on the authenticated browser client** (`src/lib/firestore/client.ts`).
- Server actions (`src/server/auth-actions.ts`, `bevy-actions.ts`) handle Bevy session token calls, cookies, and header spoofing.
- The browser client executes the sync engine (`src/lib/firestore/sync-service.ts`) after fetching data through server actions.

---

## 6. Route Protection & Role-Based Middleware

Authentication and authorization are enforced at multiple levels:

1. **`src/middleware.ts`**:
   - Intercepts requests to `/dashboard/*`.
   - Inspects `auth_token` and `auth_role` cookies.
   - Redirects unauthenticated users to `/auth/login`.
   - Restricts `/dashboard/organizer` and management routes to users with `auth_role === "organizer"`.
   - Directs non-organizers attempting to access admin routes to `/unauthorized` or `/dashboard/member`.

2. **Client Route Guards**:
   - Components verify `useAuthStore().role` before rendering administrative controls.
