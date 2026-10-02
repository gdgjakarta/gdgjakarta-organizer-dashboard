# GDG Organizer Dashboard - Dev Changelog
This is a changelog for the development of the GDG Organizer Dashboard. Me Rizky, make this developer note as the main source of truth for development information. Copy-paste directly from the Antigravity agent response (like the block below) or notes from other sources.

## [October 2, 2026] - Fetch Sponsor & Partner Logos from Bevy API on Home Page

### Overview
Replaced static mock sponsors on the public home page with live sponsors and partners fetched directly from Bevy's API.

### What Was Done
1. **Added Bevy Sponsor Types**:
   - Defined `BevySponsor` interface in `src/lib/bevy/types.ts` representing company name, logo URL, external URL, description, and sponsor type.

2. **Implemented Bevy Sponsor Client**:
   - Added `getBevyChapterSponsors(chapterSlugOrId)` in `src/lib/bevy/client.ts` querying `/chapter_slim/{slug}/sponsors/` with automatic fallback to chapter ID `642`.

3. **Created SponsorsSection Component**:
   - Created `src/app/(external)/_components/sponsors-section.tsx` with logo validation, duplicate company filtering, responsive cards with hover micro-animations, clickable external website links, and graceful empty state handling.

4. **Integrated with Home Page**:
   - Updated `src/app/(external)/page.tsx` to fetch sponsors in parallel with upcoming events via `Promise.all` and display `<SponsorsSection sponsors={sponsors} />`.

---

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
       value; "same-origin-allow-popups"
     }
     ```
   - Firebase Auth's `signInWithPopup` opens a popup that navigates across origins (`your-worker.workers.dev` -> `accounts.google.com` -> `gdgjakarta-app.firebaseapp.com/__/auth/handler`).
   - Because the destination iframe/popup origins do not have identical COOP settings matching the opener, the browser severs the opener relationship (`window.opener` becomes `null` or restricted).
   - When the authentication flow completes, Firebase Auth's handler is unable to post messages back to the parent window, causing the login flow to hang and fail redirecting.

### Solution & Fix

1. **Update COOP Header to `unsafe-none`**:
   - In `next.config.mjs`, configured `Cross-Origin-Opener-Policy` to `unsafe-none`:
     ```js
     async
     headers()
     {
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

---

## [September 29, 2026] - Fix Cloudflare Deployment Error: Missing Compiled Open Next Config

### Error Summary

When deploying to Cloudflare Workers Builds CI/CD, the build succeeded during Next.js compilation, but the deploy step immediately failed with:
```text
OpenNext project detected, calling `opennextjs-cloudflare deploy`
ERROR Could not find compiled Open Next config, did you run the build command?
Failed: error occurred while running deploy command
```

### Root Cause Analysis

1. **Decoupled Build and Deploy in Cloudflare CI/CD**:
   - Cloudflare Workers Builds runs two consecutive lifecycle steps:
     1. User Build Command: `npm run build`
     2. User Deploy Command: `npx wrangler deploy`
   - In `package.json`, `"build"` was previously mapped to `"next build"`.
   - `next build` compiles standard Next.js output into `.next/`, but does NOT generate the `.open-next/` bundle (`worker.js`, `assets/`, and compiled OpenNext configuration).
   - In Step 2, `npx wrangler deploy` detected OpenNext and invoked `opennextjs-cloudflare deploy`, which requires the compiled `.open-next` directory to exist.
   - Because `opennextjs-cloudflare build` had never been executed, the deploy step failed with `Could not find compiled Open Next config, did you run the build command?`.

2. **Recursive Infinite Build Loop Risk**:
   - By default, if `@opennextjs/cloudflare build` runs without an explicit `buildCommand` configured in `open-next.config.ts`, OpenNext falls back to executing `package.json`'s `build` script.
   - If `package.json`'s `"build"` script is set to `"opennextjs-cloudflare build"`, this creates a recursive loop (`npm run build` -> `opennextjs-cloudflare build` -> `npm run build` -> ...).

### Solution & Fix

1. **Set `buildCommand` in [open-next.config.ts](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/open-next.config.ts)**:
   - Configured `config.buildCommand = "next build"` on the exported config.
   - This explicitly instructs OpenNext to compile Next.js directly via `next build`, preventing recursion loops.

2. **Update `build` Script in [package.json](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/package.json)**:
   - Changed `"build"` to `"opennextjs-cloudflare build"` so Cloudflare CI's `npm run build` builds the complete `.open-next` bundle.
   - Added `"build:next": "next build"` for standalone Next.js testing/builds if needed.

---

## [September 29, 2026] - Fix Minified React Error #441 after Google Sign-In Flow

### Error Summary

After completing Google Sign-In popup authentication, the app redirected towards the dashboard and crashed with:
```text
Minified React error #441; visit https://react.dev/errors/441 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
```
In Cloudflare Workers real-time logs, the following trace was captured:
```json
{
  "trigger": "POST /auth/login",
  "url": "https://gdgjakarta-organizer-dashboard.gdg-jakarta.workers.dev/auth/login?callbackUrl=%2Fdashboard%2Fmember",
  "message": "    at i (worker.js:110476:40)\n    at Object.get (worker.js:110552:30)..."
}
```

### Root Cause Analysis

1. **Middleware Interception & 307 Redirect on Server Action `POST` Requests**:
   - In Next.js App Router, invoking a Server Action (`handleUserPostLoginAction`) from `/auth/login` dispatches an HTTP `POST` request to the active page path (`POST /auth/login?callbackUrl=%2Fdashboard%2Fmember`).
   - In `src/middleware.ts`, `if (isAuthPage(pathname) && isAuthenticated)` previously matched `/auth/login` once the user had an active session cookie and issued a `NextResponse.redirect(new URL(target, request.url))`.
   - Because HTTP 307 redirects preserve the request method, the browser followed the redirect by sending `POST /dashboard/member`.
   - `/dashboard/member` is a standard GET page without a corresponding action ID, causing Next.js to fail during Server Component rendering and throw React error `#441`.

2. **Concurrent Duplicate Sync in Auth Store Provider**:
   - In `src/stores/auth/auth-provider.tsx`, both `signInWithGoogle()` and Firebase's `onAuthStateChanged()` listener independently invoked `handleUserPostLoginAction()` upon popup completion, creating two simultaneous in-flight `POST /auth/login` requests that raced with each other.

3. **Unprotected SSR Layout Cookie Access**:
   - In `src/server/server-actions.ts` and `src/app/(main)/dashboard/layout.tsx`, reading cookies or layout preferences lacked fallback `try...catch` blocks to protect against worker environment quirks.

### Solution & Fix

1. **Bypass Middleware Redirects for Non-GET & Server Actions in [src/middleware.ts](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/middleware.ts)**:
   - Added early guard:
     ```typescript
     if (request.method !== "GET" || request.headers.has("next-action")) {
       return NextResponse.next();
     }
     ```
   - Prevents middleware from ever sending 307 redirects for Server Action or form POST requests.

2. **Deduplicate Post-Login Sync in [src/stores/auth/auth-provider.tsx](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/stores/auth/auth-provider.tsx)**:
   - Added `isSigningInWithGoogle` flag to suppress the duplicate `onAuthStateChanged` sync invocation while `signInWithGoogle` is actively running.

3. **Safe SSR Fallbacks in [src/server/server-actions.ts](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/server/server-actions.ts) and [src/app/(main)/dashboard/layout.tsx](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/app/(main)/dashboard/layout.tsx)**:
   - Wrapped `cookies()` and `getPreference()` calls in `try...catch` blocks with safe defaults (`PREFERENCE_DEFAULTS`).

4. **Flight Protocol Sanitization & Top-Level Server Action Guard in [src/server/auth-actions.ts](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/server/auth-actions.ts)**:
   - Sanitized `handleUserPostLoginAction` return value to strictly return plain, serializable primitives (`{ isValidOrganizer, role, bevyUserId, chapterRole }`) instead of raw Bevy objects (`chapterTeamMember`, `bevyUser`) which can trigger React Flight serialization failures.
   - Sanitized Firestore `setDoc` payload in `memberData` with fallback values (`|| ""`, `|| 0`) to prevent `undefined` properties from throwing in the Firestore SDK.
   - Wrapped the entire action in a top-level `try...catch` returning a safe fallback response so the server action promise never rejects with an uncaught 500 / error #441.

5. **Preserved Console Logging for Cloudflare Workers in [next.config.mjs](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/next.config.mjs)**:
   - Set `removeConsole: false` so that server execution logs (`[Auth Step ...]`, error traces) are visible in Cloudflare Observability and `wrangler tail`.

6. **Graceful Error Toast Handling in [src/app/(main)/auth/_components/social-auth/google-button.tsx](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/app/(main)/auth/_components/social-auth/google-button.tsx)**:
   - Intercepted minified React error messages to show clear, user-friendly toast notifications instead of raw stack or error numbers.

7. **Decouple Firestore Client SDK from Cloudflare Worker Runtime ([src/server/auth-actions.ts](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/server/auth-actions.ts), [src/stores/auth/auth-provider.tsx](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/stores/auth/auth-provider.tsx), [src/lib/firestore/client.ts](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/lib/firestore/client.ts))**:
   - **Root Cause**: Cloudflare Workers' V8 isolates strictly prohibit dynamic code generation (`eval()` and `new Function()`). When `@firebase/firestore` initializes inside a Worker during a Server Action, its dependency `protobufjs` invokes `@protobufjs/codegen` (`Function(source)()`), throwing an uncatchable `EvalError` (`at Function (<anonymous>) ... at l.fromJSON`) and crashing the Worker with HTTP 500.
   - **Fix**:
     - Removed Firestore operations from `src/server/auth-actions.ts`. The Server Action now strictly performs Bevy API validation via native `fetch` and sets session cookies via HTTP headers.
     - Delegated Firestore member profile persistence (`syncMemberToFirestore`) to the browser client in `src/stores/auth/auth-provider.tsx`, where Firebase Auth credentials and the full browser environment (WebChannel, IndexedDB, dynamic codegen) are natively supported.
     - Added `if (typeof window === "undefined")` guards to all functions in `src/lib/firestore/client.ts` to ensure Firestore client methods safely return empty fallbacks instead of crashing if invoked in a server or worker context.

---

## [September 29, 2026] - Fix Cloudflare Worker 500 Crash (Protobuf / Codegen `Function (<anonymous>)` in `worker.js`)

### Error Summary

Navigating to dashboard routes (e.g. `/dashboard/member`, `/events`) resulted in HTTP 500 errors on Cloudflare Workers (`gdgjakarta-organizer-dashboard.gdg-jakarta.workers.dev`):
```text
⨯ at Function (<anonymous>)
  at f (worker.js:400302:22)
  at s.get (worker.js:401210:72)
  at j.resolve (worker.js:401548:195)
  at s.resolveAll (worker.js:401242:78)
  at l.resolveAll (worker.js:400474:81)
  at l.resolveAll (worker.js:400474:81)
  at l.resolveAll (worker.js:400474:81)
  at l.resolveAll (worker.js:401398:41)
  at l.fromJSON (worker.js:401323:130)
```

### Root Cause Analysis

1. **`@protobufjs/codegen` and Cloudflare Workers V8 Sandbox**:
   - The `@firebase/firestore` Node build (`common-*.node.cjs.js`) loads `@grpc/proto-loader`, which invokes `protobufjs/ext/descriptor/index.js` synchronously on module import.
   - `protobufjs` calls `fromJSON()`, which triggers `@protobufjs/codegen`'s `Codegen` compiler:
     ```javascript
     return Function(source)(); // eslint-disable-line no-new-func
     ```
   - Cloudflare Workers V8 isolates strictly disallow dynamic string-to-code compilation (`eval()` and `new Function()`).
   - Any module that statically imports `firebase/firestore` inside a Server Component or Server Action bundles the `@firebase/firestore` Node build into `worker.js`, throwing `EvalError: Code generation from strings disallowed for this context` during Worker startup or route dispatch.

2. **Top-Level `getFirestore` and Server Component Imports**:
   - `src/config/firebase.ts` exported `export const db = getFirestore(app);` at module evaluation time.
   - Server Component pages (`dashboard/member/page.tsx`, `events/page.tsx`, `members/page.tsx`, etc.) and `src/server/firestore-actions.ts` directly imported `getFirestore...` from `@/lib/firestore/client`.
   - Even with runtime `typeof window === "undefined"` checks inside function bodies, the static module-level import of `firebase/firestore` was already executed at bundle evaluation time, crashing the isolate before any request handler could complete.

### Solution & Architectural Fix

1. **Purged `firebase/firestore` from Server Configuration ([src/config/firebase.ts](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/config/firebase.ts))**:
   - Removed `getFirestore` import and top-level `db` initialization.
   - Exported `app` so client-side modules can initialize Firestore exclusively in browser environments (`typeof window !== "undefined"`).

2. **Client-Only Firestore Client ([src/lib/firestore/client.ts](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/lib/firestore/client.ts))**:
   - Added `"use client";` directive at line 1, explicitly declaring the file as a client module boundary.
   - Guarded `db` initialization: `export const db = typeof window !== "undefined" ? getFirestore(app) : null!;`.
   - Prevented any server-side bundling of Firestore client SDK.

3. **Replaced Server Actions with Client-Side Action Helpers ([src/lib/firestore/actions.ts](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/lib/firestore/actions.ts))**:
   - Deleted `src/server/firestore-actions.ts` (which had `"use server"` and brought Firestore into the server bundle).
   - Created `src/lib/firestore/actions.ts` with `"use client";`. All UI components (registration modal, sync buttons, applicant review) now invoke Firestore directly from the browser using the user's authenticated session.
   - Added `revalidateDashboardPath(path)` in `src/server/server-actions.ts` so client actions can safely trigger cache revalidation via a lightweight server action that has zero Firestore dependencies.

4. **Isolated Bevy Fetch to Server Actions ([src/server/bevy-actions.ts](file:///Users/fachridantm/Library/CloudStorage/OneDrive-uinjkt.ac.id/IdeaProjects/gdgjakarta-organizer-dashboard/src/server/bevy-actions.ts))**:
   - Created `fetchBevyChapterEventsAction`, `fetchBevyChapterMembersAction`, and `fetchBevyChapterTeamsAction` to handle Bevy data fetching with server-side tokens/cookies via native `fetch`.
   - `src/lib/firestore/sync-service.ts` calls these server actions from the client to receive JSON payloads and writes them directly to Firestore using `writeBatch(db)`.

5. **Direct Server Rendering via Bevy API in Dashboard Server Components**:
   - Updated `src/app/(main)/dashboard/member/page.tsx`, `my-events/page.tsx`, `events/[eventId]/page.tsx`, `events/page.tsx`, `members/page.tsx`, and `organizer/page.tsx`.
   - Removed all imports from `@/lib/firestore/client`.
   - Server Components now render official GDG Jakarta events, community members, and organizer stats directly from Bevy API via native `fetch` (which is fast, fresh, and 100% compatible with Cloudflare Workers).
   - Event registrations are loaded client-side via `RegistrantsTab` without blocking SSR.
