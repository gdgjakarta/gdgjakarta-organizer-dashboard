# Profile & Account Settings Feature

This guide outlines user profile presentation, chapter configuration, preferences settings, and sign-out handling in the **GDG Jakarta Organizer Dashboard**.

---

## 1. Overview & Information Hierarchy

The Profile view (`src/app/(main)/dashboard/profile/page.tsx`) organizes user data into focused sections:

1. **User Identity**: Avatar, display name, verified Google email, and user ID.
2. **Community Association**: Active chapter badge (Google Developer Group Jakarta), official title/role, and Core Team status.
3. **Application Preferences**: Theme preset selection (Tangerine, Brutalist, Soft Pop), dark mode toggle, and layout density settings.
4. **Session Management**: Session revocation, cache clearing, and secure logout.

---

## 2. Key Components & State

- **`useAuthStore`**: Supplies active user session details (`user`, `role`, `chapterRole`, `bevyUserId`).
- **`usePreferencesStore`**: Manages runtime UI theme and sidebar configuration.
- **`logoutAction()` (`src/server/auth-actions.ts`)**:
  - Clears `auth_token` and `auth_role` session cookies.
  - Redirects user to `/auth/login`.

---

## 3. Implementation Rules

1. Always display confirmation prompts before completing sign-out actions.
2. On logout, ensure client-side state in `useAuthStore` and `usePreferencesStore` is cleared alongside HTTP-only cookies.
3. Keep user profile edits synchronized with the Firestore `members` collection.
