# Authentication & Membership Verification Feature

This guide outlines the authentication architecture, organizer permission verification, and session state management in the **GDG Jakarta Organizer Dashboard**, aligned with the **KawalEvent** project architecture.

---

## 1. Overview & Authentication Flow

The authentication system combines **Firebase Authentication (Google Sign-In)** with **Bevy API verification** (`getUserById` & `getUserChapterRole`) to ensure appropriate access for Community Members and Core Team Organizers:

```
                  ┌────────────────────────┐
                  │    Google Sign-In      │
                  │   (Firebase Auth)      │
                  └───────────┬────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │  Server Post-Login     │
                  │  handleUserPostLogin   │
                  └───────────┬────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │ Bevy: getMemberById    │
                  │ (email / identifier)   │
                  └───────────┬────────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
        [200 OK / Success]           [Not 200 / Not Found]
               │                             │ (New Member)
               │                             ▼
               │                 ┌────────────────────────┐
               │                 │ GDG Jakarta Webhook    │
               │                 │ import-member (n8n)    │
               │                 │ {first_name, last_name,│
               │                 │  email} via X-API-Key  │
               │                 └───────────┬────────────┘
               │                             │
               │                             ▼
               │                 ┌────────────────────────┐
               │                 │ Retry getMemberById /  │
               │                 │ Assign Community Member│
               │                 └───────────┬────────────┘
               │                             │
               └──────────────┬──────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │ getUserChapterRole     │
                  │ GET /chapter/{id}/team/│
                  └───────────┬────────────┘
                              │
               ┌──────────────┴──────────────┐
               │  Compare role.id in Team    │
               │  1     -> ORGANIZER         │
               │  2, 3  -> CORE_TEAM         │
               │  4     -> GOOGLER           │
               │  else  -> MEMBER            │
               └──────────────┬──────────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
    [Is Team Member: 1, 2, 3, 4]      [Member / Not in Team]
               │                             │
               ▼                             ▼
   ┌───────────────────────┐     ┌───────────────────────┐
   │ Set Cookie: organizer │     │  Set Cookie: member   │
   │ Route: /dashboard/    │     │  Route: /dashboard/   │
   │       organizer       │     │         member        │
   └───────────────────────┘     └───────────────────────┘
```

---

## 2. Key Components

### 2.1 Login Presentation (`src/app/(main)/auth/login/page.tsx`)
- Provides Google Sign-In button invoking Firebase `signInWithPopup(auth, googleProvider)`.
- Fallback form for administrative demo credentials.
- After receiving Firebase ID token, extracts `firstName` and `lastName` from Google profile and calls `handleUserPostLoginAction({ uid, email, name, token, firstName, lastName })`.

### 2.2 Server Action Verification (`src/server/auth-actions.ts`)
- Calls `validateBevyOrganizer(email, name, firstName, lastName)`.
- Invokes Bevy API `getMemberById(email)` to retrieve the user's Bevy ID and membership status.
- If response is not success or 200 (user is new/not registered on Bevy):
  - Calls GDG Jakarta API webhook `https://n8n.gdgjakarta.com/webhook/api/import-member` with `first_name`, `last_name`, and `email` using `X-API-Key: N8N_WEBHOOK_API_KEY`.
  - Re-queries Bevy to associate the newly generated Bevy User ID.
- Invokes `getUserChapterRole(bevyUserId)` to look up the user in `getChapterTeam(chapterId)`.
- Resolves role:
  - `1`: `ChapterRole.ORGANIZER`
  - `2, 3`: `ChapterRole.CORE_TEAM`
  - `4`: `ChapterRole.GOOGLER`
  - `else`: `ChapterRole.MEMBER`
- **No hardcoded email allowlists**: `ORGANIZER_EMAILS` and `isAuthorizedOrganizerEmail` are disabled (`[]` / `false`). On transient Bevy outages (`429`, `>= 500`, or empty `/chapter/{id}/team/`), `validateBevyOrganizer` falls back dynamically to the caller's own Firestore UID doc (`getFirestoreDoc("members", uid, token)`).
- **Explicit cookie write signaling**: `setAuthSessionCookie` returns `{ ok, error }` instead of swallowing `SESSION_SECRET` / cookie errors; `handleUserPostLoginAction` and `restoreSessionCookieAction` surface `cookieSet` and `error` so `processUserCredential` aborts navigation when session cookies cannot be persisted.
- If verified team member: sets `auth_role` (`"organizer"`, `"core_team"`, or `"check_in_staff"`) HMAC-signed cookie.
- If member: sets `auth_role="member"` HMAC-signed cookie.

### 2.3 Middleware Guard (`src/middleware.ts`)
- Inspects `auth_token` and `auth_role` cookies.
- Redirects unauthenticated requests from `/dashboard/*` to `/auth/login`.
- Restricts organizer paths (`/dashboard/organizer`, `/dashboard/events/create`, etc.) to users with team permissions (`auth_role === "organizer"`).

### 2.4 Client State (`src/stores/auth/auth-store.ts`)
- Zustand store exposing:
  - `user`: Firebase User object.
  - `role`: `"organizer"` | `"member"` | `null`.
  - `chapterRole`: Official title (e.g. `"Lead Organizer"`, `"Co-Organizer"`).
  - `bevyUserId`: Numerical Bevy user identifier.
  - `isAuthenticated`: Boolean status.
  - `signOut()`: Clears cookies, signs out of Firebase, and redirects to `/auth/login`.

### 2.5 Session Restoration & Role Sync Boundaries (`restoreSessionCookieAction`)
- **Strict Bevy API Boundaries**: Bevy API role validation (`validateBevyOrganizer`) is ONLY executed during sign-in (`handleUserPostLoginAction`), manual role sync (`refreshUserRoleAction`), and chapter team sync.
- **O(1) UID-First Firestore Restore**: When `onAuthStateChanged` or `onIdTokenChanged` invokes `restoreSessionCookieAction`, the server fast-paths when the existing token & verified team cookie already match (even before client `cachedRole` hydrates), otherwise verifies the Firebase ID token, performs an O(1) `getFirestoreDoc("members", uid, token)` lookup (following `bevy_user_id` if present), and falls back to `queryFirestoreDocs("members", ..., 5, token)` by verified email.
- **Non-Downgrade & Write Guard Invariants**: `restoreSessionCookieAction` never silently downgrades an already verified `"organizer" | "core_team" | "check_in_staff"` cookie on transient/empty Firestore reads. Client `onIdTokenChanged` awaits `redirectResultPromise` and skips while `isSigningInWithGoogle` is active, and `onAuthStateChanged` never overwrites Firestore member docs when `!restoreRes.success`.
- **Masked-Email Sync Hygiene**: `isMaskedEmailMatch` (`src/lib/firestore/sync-service.ts`) enforces exact local-part length + domain + unique-match checks (`matches.length === 1`) and always preserves clean unmasked `existingMatch.email` addresses over `*`-masked Bevy emails.

---

## 3. Implementation Rules

1. Always validate organizer status on the server (`auth-actions.ts`) before elevating permissions or issuing cookies; never hardcode email or role allowlists.
2. Store the role in the HMAC-signed `auth_role` HTTP-only cookie for secure middleware validation and fail closed when `SESSION_SECRET` is unset or cookie persistence fails.
3. Synchronize member profiles to the Firestore `members` collection on the browser client to maintain real-time directory data, guarding against overwrites when session restoration fails.
