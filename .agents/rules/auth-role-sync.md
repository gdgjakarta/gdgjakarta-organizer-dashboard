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

4. **Zero Hardcoded Emails or Roles**:
   - Never hardcode organizer/staff email addresses or roles in `firestore.rules`, `src/config/auth-config.ts`, `wrangler.jsonc`, or Remote Config allowlists.
   - All organizer and team permissions must resolve dynamically from Bevy (`/chapter/{id}/team/`) on explicit sign-in/sync and from the Firestore `members` collection on session restoration.

5. **Firestore REST Lookup Hygiene in Session Restoration (`restoreSessionCookieAction`)**:
   - Always read the caller's profile via O(1) `getFirestoreDoc("members", uid, token)` first, passing the freshly verified Firebase ID `token` explicitly (never rely on a potentially expired or unset `auth_token` cookie).
   - Any fallback `queryFirestoreDocs("members", ...)` MUST pass both `limit <= 5` (to satisfy `firestore.rules` `allow list`) and the explicit `token`.
   - Never require client `cachedRole` to be populated in order to preserve an already-valid HMAC-signed team `auth_role` cookie (`organizer`, `core_team`, `check_in_staff`).

6. **Fail-Loud Session Cookies & Auth Listener Race Guards**:
   - `setAuthSessionCookie()` must never silently swallow errors; if cookie signing or setting fails, return `cookieSet: false` with an error so login UI displays an error instead of navigating into a `/dashboard` ↔ `/auth/login` redirect loop.
   - Both `onAuthStateChanged` AND `onIdTokenChanged` must guard against `isSigningInWithGoogle` (and pending `redirectResultPromise`) so background token listeners never race with `handleUserPostLoginAction`.
   - `onAuthStateChanged` must never overwrite a verified Firestore `chapter_role` (`Organizer`, `Googler`, `Core Team`, `Check-in Staff`) with a fallback `"Member"` string from a failed or non-team `restoreSessionCookieAction` response.

7. **Masked-Email Sync Safety (`sync-service.ts`)**:
   - Never overwrite a clean unmasked email in Firestore with any email containing `*` (check `includes("*")`, not just `includes("***")`).
   - Any masked-email match (e.g. `d***********@gmail.com`) must enforce exact local-part length + domain match and abort on ambiguous multi-matches.
