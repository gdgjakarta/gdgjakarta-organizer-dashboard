# Authentication & Role Sync Invariants

Follow these strict invariants whenever working on authentication, session cookies (`auth_token`, `auth_role`), or role-based access control (RBAC):

1. **Bevy API Role Check Boundaries**:
   - Querying the Bevy API (`validateBevyOrganizer`, `getUserChapterRole`, `getChapterTeam`) to verify a user's role or chapter team membership is strictly limited to three explicit actions:
     1. **Sign-in / Sign-out** (`handleUserPostLoginAction`)
     2. **Clear Cache & Sync Role** (`refreshUserRoleAction`)
     3. **Sync Chapter Team** (`/dashboard/members?tab=team` / `/dashboard/team`)
   - **Never** call the Bevy API during background session or token restoration (`restoreSessionCookieAction`, `onIdTokenChanged`, `onAuthStateChanged`). Always resolve the user's `role` and `chapter_role` from the Firestore `members` collection during session restoration.

2. **Never Silently Downgrade `auth_role` Cookie on Transient Errors**:
   - Background token refreshes (`onIdTokenChanged`) must never overwrite an existing verified `auth_role` cookie (`organizer`, `core_team`, `check_in_staff`) with `"member"` due to network or upstream errors.
   - Client-side role state (`useAuthStore`) and server-side HTTP-only cookies (`auth_role`) must stay synchronized from the same Firestore `members` source of truth outside of explicit sync actions.

3. **UI Action Gating Must Match Server Action Guards**:
   - When a tab or view (e.g., `SpeakersTab`) is accessible to `team_member` / `core_team` roles (`hasTeamOperationalAccess`), any mutation trigger whose server action requires executive organizer permissions must be gated in the UI using `isExecutiveOrganizer(user)` (e.g., hiding **Add Speaker** for `team_member`).
