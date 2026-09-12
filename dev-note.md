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
