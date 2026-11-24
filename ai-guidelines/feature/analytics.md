# Unified Organizer Analytics Hub (`/dashboard/organizer`)

## Overview
Located in the bottom-left `xl:col-span-7` slot beneath **Recent & Upcoming Events** on `/dashboard/organizer` (with an inline **Expand / Compact** toggle that promotes the hub to `xl:col-span-12`), the **Platform & Community Analytics Hub** surfaces real, unfabricated metrics across five tabs:

1. **Website (`gdgjakarta.com`)**: Auto-detects **GA4 / Firebase Data API** (`GA4_PROPERTY_ID` + `GA4_SERVICE_ACCOUNT_JSON`) and/or **Cloudflare Web Analytics GraphQL API** (`CLOUDFLARE_API_TOKEN` + `R2_ACCOUNT_ID`), paired with live **Logged-in Dashboard Users** from Firestore `members.last_active`. Includes an interactive SVG World Choropleth Map (`world-atlas/countries-110m.json` + `d3-geo` + `topojson-client`).
2. **Events**: Live Bevy chapter events (`getAllEvents`, with Firestore `events` fallback). Excludes `Draft`, `Canceled`, and `is_test` events by default (with an **Include test events** toggle) and computes Check-in Rate `%` and No-Show Rate `%` strictly across completed/past events.
3. **Tickets**: Firestore `event_registrations` + `event_merchandise_orders` (Gross Paid Revenue in IDR, paid conversion `%`, status funnel `%`, ticket type split `%`, and voucher/referral adoption `%`).
4. **Members**: Bevy chapter joins (`getBevyChapterMembers` sorted `-created_date`) + Firestore `members` (`last_active`, repeat attendees `%`, email verified `%`, Bevy-synced `%`, referral participation `%`).
5. **Instagram (`@gdgjakarta`)**: Meta Graph API (`graph.facebook.com`, default `v25.0`), automatic `<= 30`-day chunking, isolated `follow_type` breakdowns, **Engagement Rate by Reach** (`Accounts Engaged / Reach × 100`), Followers vs Non-Followers `%` split bar, and Daily Reach chart.

## Key Files & Security Invariants
- **API Route**: `src/app/api/analytics/overview/route.ts` — `GET` endpoint strictly guarded by `isAuthorizedExecutiveOrganizerSession()` (`401` otherwise) and `zod` query validation (`analyticsQuerySchema`).
- **Core & Providers**: `src/lib/analytics/date-range.ts`, `country-codes.ts`, `types.ts`, `capabilities.ts`, `src/lib/analytics/providers/{ga4,cloudflare,firestore-analytics}.ts`, `src/lib/instagram/client.ts`.
- **UI**: `src/app/(main)/dashboard/organizer/_components/{organizer-main-grid,platform-analytics-hub,analytics-filter-bar,world-choropleth-map}.tsx` and `analytics-tabs/{website,events,tickets,members,instagram}-tab.tsx`.
- **Secret Hygiene**: External tokens (`GA4_SERVICE_ACCOUNT_JSON`, `CLOUDFLARE_API_TOKEN`, `INSTAGRAM_ACCESS_TOKEN`) are server-only environment secrets—never `NEXT_PUBLIC_*` and never stored in `site_config` or `system_settings`.
