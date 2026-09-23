# GDG Organizer Dashboard - Dev Changelog
This is a changelog for the development of the GDG Organizer Dashboard. Me Rizky, make this developer note as the main source of truth for development information. Copy-paste directly from the Antigravity agent response (like the block below) or notes from other sources.

## [September 13, 2026] - Fix Bevy Organizer Authentication & Role Detection

### Root Cause Analysis

When investigating the Bevy authentication and organizer role verification flow, two primary issues were causing organizers to be recognized as regular members and directed to the member dashboard:

1. **Incorrect Bevy API Endpoint**:
   - `getBevyChapterTeams()` in `src/lib/bevy/client.ts` was requesting `/chapter/642` expecting a top-level `chapter_team` field, which failed or returned 403.
   - The correct Bevy API endpoint that provides the GDG Jakarta chapter team list is `/api/chapter/642/team`.

2. **GDPR/Privacy Email Masking on Bevy API**:
   - Bevy masks team member emails in its API responses for privacy reasons (e.g., `r*******@gmail.com`, `d***********@gmail.com`, `a***********@gmail.com`).
   - The previous validation logic performed a strict literal equality check (`teamEmail === userGoogleEmail`). Since the incoming Google Auth email was unmasked (e.g., `user@gmail.com`) while Bevy returned masked strings, the equality comparison always evaluated to `false`, causing all organizers to fail validation and fall back to the member role.

---

### What Was Fixed

1. **Updated Bevy Team Retrieval**:
   - In `src/lib/bevy/client.ts`, updated `getBevyChapterTeams` to fetch from `/chapter/${chapterId}/team`, successfully retrieving all 21 team members, roles, and titles (e.g., *GDG Organizer*, *GDG Co-Organizer*, *Regional Lead*, *Core Team*).

2. **Added Smart Masked Email & Profile Matching**:
   - Implemented `matchesMaskedEmail()` to match incoming Google emails against Bevy's privacy-masked patterns by preserving the first character, domain, and character counts.
   - Added `nameMatches()` as a secondary validation using the authenticated user's Google display name against Bevy team profiles (`first_name`, `last_name`).

3. **Propagated Display Names across Auth Actions**:
   - Updated `src/server/auth-actions.ts` and `src/stores/auth/auth-provider.tsx` so `validateBevyOrganizer(email, displayName)` is called with full profile context during both Google Sign-In and session restore (`onAuthStateChanged`).

4. **Case-Insensitive Role Routing**:
   - Updated `src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx` and session cookies to ensure organizer roles (*Organizer*, *GDG Co-Organizer*, *Regional Leader*, etc.) are recognized and route directly to `/dashboard/organizer`.

5. **Firestore Double-Check & Anti-Downgrade Protection**:
   - Updated `handleUserPostLoginAction` to check Firestore's `members` collection **before** trusting Bevy API validation.
   - If a user is already marked as an `organizer` (or `lead`) in Firestore, they bypass a failed Bevy API check (e.g. from expired session cookies, rate limits, or masking misses). This guarantees robust login uptime and prevents accidental downgrades to `member` status when the Bevy API fails.

---

## [September 23, 2026] - Fix Cloudflare Wrangler Preview Redirect Error

### Error Summary

When running `npm run preview` (`opennextjs-cloudflare build && opennextjs-cloudflare preview`), Wrangler failed with the following error:
```text
X [ERROR] There is a deploy configuration at ".wrangler\deploy\config.json".
  But the redirected configuration path it points to, "dist\server\wrangler.json", does not exist.
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
```

### Root Cause Analysis

1. **Stale Wrangler Deploy State**:
   - An earlier build or framework integration (e.g., Vinext or a prior build tool) created `.wrangler/deploy/config.json` containing:
     ```json
     {"configPath":"..\\..\\dist\\server\\wrangler.json","auxiliaryWorkers":[]}
     ```
   - Wrangler automatically inspects `.wrangler/deploy/config.json` on execution. If present, it redirects config loading to the specified path instead of the root `wrangler.jsonc`.
   - Since `dist/server/wrangler.json` was no longer present in the `@opennextjs/cloudflare` setup, Wrangler threw a fatal path error and aborted.

2. **Windows libuv Assertion Crash**:
   - The `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` error is a known Windows Node.js/libuv crash artifact that occurs when Wrangler terminates abruptly following the fatal configuration exception.

### Solution & Fix

1. **Delete Stale `.wrangler` Cache**:
   - Remove the `.wrangler` state directory to purge the stale deploy redirection:
     ```powershell
     Remove-Item -Recurse -Force .wrangler
     ```
   - On Unix/macOS:
     ```bash
     rm -rf .wrangler
     ```

2. **Use Root `wrangler.jsonc`**:
   - With `.wrangler` cleaned, running `npm run preview` properly uses the root `wrangler.jsonc` targeting `.open-next/worker.js` and `.open-next/assets`.

---

## [September 23, 2026] - Fix Firebase Auth Popup Failure with Cross-Origin-Opener-Policy (COOP)

### Error Summary

After deploying to Cloudflare Workers, Firebase Google Sign-In popup completed authentication in the popup window, but the main application window never redirected to the dashboard, accompanied by browser console warnings/errors:
```text
Cross-Origin-Opener-Policy policy would block the window.postMessage call.
```

### Root Cause Analysis

1. **COOP Header Blocking Popup Communication**:
   - In `next.config.mjs`, the application previously set:
     ```javascript
     {
       key: "Cross-Origin-Opener-Policy",
       value: "same-origin-allow-popups",
     }
     ```
   - Firebase Auth's `signInWithPopup` opens a popup that navigates across origins (`your-worker.workers.dev` -> `accounts.google.com` -> `gdgjakarta-app.firebaseapp.com/__/auth/handler`).
   - Because the destination iframe/popup origins do not have identical COOP settings matching the opener, the browser severs the opener relationship (`window.opener` becomes `null` or restricted).
   - When the authentication flow completes, Firebase Auth's handler is unable to post messages back to the parent window, causing the login flow to hang and fail redirecting.

### Solution & Fix

1. **Update COOP Header to `unsafe-none`**:
   - In `next.config.mjs`, configured `Cross-Origin-Opener-Policy` to `unsafe-none`:
     ```javascript
     async headers() {
       return [
         {
           source: "/(.*)",
           headers: [
             {
               key: "Cross-Origin-Opener-Policy",
               value: "unsafe-none",
             },
           ],
         },
       ];
     }
     ```
   - This explicitly enables cross-origin `postMessage` messaging between Firebase Auth popups and your Cloudflare Worker app.

2. **Firebase Console Authorized Domains**:
   - Ensure the deployed Cloudflare Worker domain (e.g., `gdgjakarta-organizer-dashboard.<subdomain>.workers.dev` or custom domain) is added to **Firebase Console -> Authentication -> Settings -> Authorized Domains**.

---

## [September 23, 2026] - Fix Server Components Render Crash on Missing Preference Cookies

### Error Summary

After successful Firebase authentication, redirecting to the dashboard caused a 500 error in Next.js production builds:
```text
An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error
```

### Root Cause Analysis

1. **Unsafe `.trim()` on `undefined` Cookie Value**:
   - In `src/app/(main)/dashboard/layout.tsx`, the root dashboard layout executes during SSR:
     ```typescript
     const [variant, collapsible] = await Promise.all([
       getPreference("sidebar_variant"),
       getPreference("sidebar_collapsible"),
     ]);
     ```
   - In `src/server/server-actions.ts`, `getPreference` previously contained:
     ```typescript
     return parsePreference(key, cookieStore.get(key)?.value.trim());
     ```
   - When a newly authenticated user accesses the dashboard without preexisting `sidebar_variant` or `sidebar_collapsible` cookies, `cookieStore.get(key)` returns `undefined`.
   - `cookieStore.get(key)?.value` evaluates to `undefined`, and calling `.trim()` on `undefined` threw an uncaught `TypeError: Cannot read properties of undefined (reading 'trim')` on the server during the Server Component render.

### Solution & Fix

1. **Safe Optional Chaining in [src/server/server-actions.ts](file:///g:/Code/Antigravity/gdgjakarta-organizer-dashboard/src/server/server-actions.ts#L36-L40)**:
   - Added optional chaining to `.trim()`:
     ```typescript
     const cookieStore = await cookies();
     return parsePreference(key, cookieStore.get(key)?.value?.trim());
     ```
   - If the cookie is absent or undefined, `parsePreference()` safely falls back to default registry values (`sidebar` and `icon`) without throwing runtime exceptions.

