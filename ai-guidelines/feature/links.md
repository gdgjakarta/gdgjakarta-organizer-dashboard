# Short Links (`/dashboard/links` & `gdgjakarta.org` Edge Redirect Worker)

## Overview
Phase 2 dual-mode link shortener for `gdgjakarta.org` (`SHORTLINK_PROVIDER=cloudflare|shortio`, defaulting to `"shortio"` in `wrangler.jsonc` until DNS cutover). Replaces Short.io Pro with a dedicated Cloudflare Redirect Worker (`workers/shortlink/`), Workers KV (`SHORTLINKS_KV`), and Cloudflare D1 (`SHORTLINKS_DB` / `gdgjakarta-shortlinks`), integrated seamlessly with `/dashboard/links`, event short-link sync, speaker invitations, and `/api/links/shorten`.

## Architecture & Data Flow
- **Edge Redirect Worker (`workers/shortlink/`)**:
  - Standalone Worker (`gdgjakarta-shortlink-redirect`, `workers/shortlink/wrangler.jsonc`) bound to `gdgjakarta.org` via `custom_domain: true` and excluded from root `tsconfig.json` to keep Worker types isolated from DOM types.
  - Reads `<hostname>:<slug>` (`EdgeShortLinkRecord`) and `<hostname>:__domain__` (`EdgeDomainConfig`) from `SHORTLINKS_KV` with `SHORTLINKS_DB` fallback and atomic D1 `WHERE clicks_count < max_clicks` enforcement.
  - Redirects root `https://gdgjakarta.org/` to `https://gdgjakarta.com` and serves a branded `404` linking to `https://gdgjakarta.com` for unknown slugs.
  - Supports `301`/`302`/`307`/`308` redirects, time-based expiration (`expiresAt` + `expiredURL`), PBKDF2-SHA256 (`100_000` iterations) + HMAC-SHA256 password unlock cookies (`SHORTLINK_COOKIE_SECRET`), `<iframe>` cloaking, Android/iOS OS targeting, country geo-targeting (`request.cf.country`), UTM parameter merging, Meta Pixel/GTM/GA4 interstitials, sticky-cookie A/B split testing, responsive link bundles (`linkType: "bundle"`), and `/.well-known/apple-app-site-association` & `/.well-known/assetlinks.json`.
  - Records click telemetry (`short_link_clicks`) asynchronously via `ctx.waitUntil()`.
- **D1 Schema & KV Sync (`workers/shortlink/migrations/0001_shortlinks.sql`, `src/lib/shortlinks/`)**:
  - Tables: `short_domains`, `short_folders`, `short_links` (including `legacy_clicks` to preserve historical Short.io totals alongside live `clicks_count`), and `short_link_clicks`.
  - Dashboard/server mutations access `SHORTLINKS_DB` and `SHORTLINKS_KV` via `await getCloudflareContext({ async: true })` and sync `<hostname>:<slug>` / `<hostname>:__domain__` to KV on every link or domain change.
  - Preserves backward-compatible `ShortLinkItem` / `ShortDomain` / `ClickStats` contracts (`src/lib/shortio/types.ts`) and `lnk_` ID compatibility.
- **Dual-Mode Provider & External API (`src/server/`, `src/app/api/links/shorten/route.ts`)**:
  - `SHORTLINK_PROVIDER` (`"cloudflare"` or `"shortio"`) routes `src/server/shortio-actions.ts`, `src/server/shortio-advanced-actions.ts`, and `src/server/speaker-confirmation-actions.ts` without breaking existing callers.
  - `/api/links/shorten` exposes fail-closed `POST` (create/shorten) and `GET` (lookup by `path` or `originalURL`) authenticated via `x-api-key` or `Authorization: Bearer` against `SHORTLINK_API_KEY` / `N8N_WEBHOOK_API_KEY` (`401` if unset/invalid).

## Dashboard UI (`/dashboard/links`)
- **Tabs**: **Links** | **Analytics** (total vs human clicks combining `legacy_clicks` + `short_link_clicks`, countries, **Cities**, browsers, OS, devices, referrers, time-series, and **Real-time Clickstream**) | **Domains** (including per-domain `apple-app-site-association` & `assetlinks.json` deep-link editors).
- **Capabilities**: Full Short.io parity (custom slugs, folders, tags, archive/unarchive, bulk archive/move/delete, CSV import max 1000 rows, client-side SVG QR codes reusing `src/lib/printers/qr-svg.ts`) plus Pro edge controls (Country Geo-targeting, UTM builder, Retargeting pixels, Click-Limit Expiration, A/B Split Testing, Link Bundles).
- **RBAC**: Guarded by `isAuthorizedOrganizerSession`; domain creation/removal and Mobile Deep Linking updates require `isAuthorizedExecutiveOrganizerSession`.

## Migration, Security & Domain Rules
- **Migration CLI (`scripts/migrate-shortio-to-d1.mjs`)**: Pure ESM script exporting Short.io domains, folders, active/archived links (plus optional `--archived-csv`), geo targets (`--fetch-geo`), and historical click counts (`legacy_clicks`) to a local JSON backup (`--backup` / `--from-backup`), generating D1-safe idempotent SQL (no `BEGIN TRANSACTION`/`COMMIT`, `ON CONFLICT(hostname, path) DO UPDATE` preserving `id`, `clicks_count`, `MAX(legacy_clicks)`, and existing `password_hash`), KV bulk JSON, and a report flagging password-protected slugs (`flaggedPasswordLinks`) for manual re-entry before cutover.
- **Runbook (`docs/shortlink-cutover-runbook.md`)**: Documents Cloudflare API token permissions, D1/KV provisioning, secret pre-deploy gates (`SHORTLINK_COOKIE_SECRET`, `SHORTLINK_API_KEY`), migration steps, pre-cutover testing, safe apex DNS cutover (preserving `MX`, `TXT`, and `assets.gdgjakarta.org`), and rollback.
- **Domain Usage Standard (`.agents/rules/domain-usage.md`)**: `gdgjakarta.org` is strictly for shortlinks and email identities; canonical web pages and dashboard routes live on `gdgjakarta.com`.

## Key Files
- `workers/shortlink/migrations/0001_shortlinks.sql` — D1 DDL for `short_domains`, `short_folders`, `short_links`, and `short_link_clicks`.
- `workers/shortlink/wrangler.jsonc` & `wrangler.jsonc` — `SHORTLINKS_KV` and `SHORTLINKS_DB` bindings + `custom_domain: true` route for `gdgjakarta.org`.
- `src/lib/shortlinks/types.ts` & `src/lib/shortlinks/crypto.ts` — Shared KV/D1/edge types, key normalization, PBKDF2-SHA256 password hashing, and fail-closed HMAC-SHA256 cookie helpers.
- `src/lib/shortio/types.ts` — Backward-compatible Short.io + Phase 2 contract extensions.
- `src/app/api/links/shorten/route.ts` — External `POST`/`GET` shortening API for n8n and automation workflows.
- `scripts/migrate-shortio-to-d1.mjs` — Idempotent Short.io -> D1/KV migration CLI.
- `docs/shortlink-cutover-runbook.md` — Provisioning, secret setup, DNS cutover, and rollback runbook.
- `tests/shortlink/schema-crypto.test.mjs` & `tests/shortlink/migration.test.mjs` — Offline `node:sqlite` + Web Crypto + migration test suites.
