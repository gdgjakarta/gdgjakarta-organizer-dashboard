# Authentication & Membership Verification Feature

This guide outlines the authentication architecture, organizer permission verification, and session state management in the **GDG Jakarta Organizer Dashboard**.

---

## 1. Overview & Authentication Flow

The authentication system combines **Firebase Authentication (Google Sign-In)** with **Bevy Chapter Team verification** to ensure appropriate access for Community Members and Core Team Organizers:

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
                  │ Check Whitelist & Bevy │
                  │ GET /chapter/{id}/team │
                  └───────────┬────────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
        [Is Team Member]             [Not Team Member]
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
- After receiving Firebase ID token, calls `handleUserPostLoginAction({ uid, email, name, token })`.

### 2.2 Server Action Verification (`src/server/auth-actions.ts`)
- Calls `validateOrganizerAction(email, name)`.
- Checks email against `isAuthorizedOrganizerEmail(email)` whitelist in `src/config/auth-config.ts`.
- Calls Bevy API `getBevyChapterTeams()` to match against unmasked official chapter team members.
- If verified: sets `auth_role="organizer"` cookie.
- If not on team: sets `auth_role="member"` cookie.

### 2.3 Middleware Guard (`src/middleware.ts`)
- Inspects `auth_token` and `auth_role` cookies.
- Redirects unauthenticated requests from `/dashboard/*` to `/auth/login`.
- Restricts organizer paths (`/dashboard/organizer`, `/dashboard/events/create`, etc.) to users with `auth_role === "organizer"`.

### 2.4 Client State (`src/stores/auth/auth-store.ts`)
- Zustand store exposing:
  - `user`: Firebase User object.
  - `role`: `"organizer"` | `"member"` | `null`.
  - `chapterRole`: Official title (e.g. `"Lead Organizer"`, `"Co-Organizer"`).
  - `bevyUserId`: Numerical Bevy user identifier.
  - `isAuthenticated`: Boolean status.
  - `signOut()`: Clears cookies, signs out of Firebase, and redirects to `/auth/login`.

---

## 3. Implementation Rules

1. Always validate organizer status on the server (`auth-actions.ts`) before elevating permissions or issuing cookies.
2. Store the role in the `auth_role` HTTP-only cookie for secure middleware validation.
3. Synchronize member profiles to the Firestore `members` collection on the browser client to maintain real-time directory data.
