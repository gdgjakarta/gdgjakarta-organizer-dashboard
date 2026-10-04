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
- Fallback to whitelist `isAuthorizedOrganizerEmail(email)` if user is not in team list.
- If verified team member: sets `auth_role="organizer"` cookie.
- If member: sets `auth_role="member"` cookie.

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

---

## 3. Implementation Rules

1. Always validate organizer status on the server (`auth-actions.ts`) before elevating permissions or issuing cookies.
2. Store the role in the `auth_role` HTTP-only cookie for secure middleware validation.
3. Synchronize member profiles to the Firestore `members` collection on the browser client to maintain real-time directory data.
