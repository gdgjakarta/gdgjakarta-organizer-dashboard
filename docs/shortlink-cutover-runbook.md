# `gdgjakarta.org` Shortlink Phase 2 Provisioning & DNS Cutover Runbook

This runbook covers provisioning Cloudflare D1 (`SHORTLINKS_DB`) and Workers KV (`SHORTLINKS_KV`), migrating all Short.io domains, folders, links, and historical click counts (`legacy_clicks`), verifying `SHORTLINK_PROVIDER=cloudflare` before cutover, safely switching `gdgjakarta.org` DNS from Short.io to the Cloudflare Redirect Worker, and rolling back if needed.

---

## 1. Architecture & Domain Usage Standard

- **Edge Redirect Worker (`workers/shortlink/wrangler.jsonc`, name: `gdgjakarta-shortlink-redirect`)**:
  - Bound to `gdgjakarta.org` via Workers Custom Domain (`routes: [{ "pattern": "gdgjakarta.org", "custom_domain": true }]`).
  - Serves sub-millisecond redirects and edge HTML responses (password unlock prompt, iframe cloaking, retargeting pixel interstitials, link bundles, `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json`) from `SHORTLINKS_KV` (`<hostname>:<slug>` and `<hostname>:__domain__`) with `SHORTLINKS_DB` (D1) fallback/atomic `max_clicks` enforcement and asynchronous click ingestion via `ctx.waitUntil()`.
  - Root `https://gdgjakarta.org/` redirects to `https://gdgjakarta.com`; unknown slugs return a branded `404` page linking to `https://gdgjakarta.com`.
- **Organizer Dashboard & External API (`wrangler.jsonc`, name: `gdgjakarta-organizer-dashboard`)**:
  - OpenNext Cloudflare Worker hosting `/dashboard/links` and `/api/links/shorten`.
  - Controlled by `SHORTLINK_PROVIDER` (`"shortio"` default until cutover; `"cloudflare"` after cutover).
- **Domain Usage Standard (`.agents/rules/domain-usage.md`)**:
  - `gdgjakarta.com` is the primary production web application domain (all canonical web pages, speaker handbooks, dashboard routes, and email target links).
  - `gdgjakarta.org` is strictly reserved for shortlink redirects (`https://gdgjakarta.org/<slug>`) and verified email identities (e.g., `info@gdgjakarta.org`). Never construct deep application routes on `gdgjakarta.org`.

---

## 2. Required Cloudflare API Token Permissions

If authenticating Wrangler via `CLOUDFLARE_API_TOKEN` (CI/CD or non-interactive CLI) instead of `npx wrangler login`, create a Custom API Token with these exact minimum permissions:

| Scope | Permission | Access | Purpose |
|---|---|---|---|
| **Account** | `D1` | `Edit` | Create `gdgjakarta-shortlinks`, apply migrations, run `wrangler d1 execute` |
| **Account** | `Workers KV Storage` | `Edit` | Create `SHORTLINKS_KV`, run `wrangler kv bulk put` |
| **Account** | `Workers Scripts` | `Edit` | Deploy `gdgjakarta-shortlink-redirect` & dashboard Worker, set secrets |
| **Account** | `Account Settings` | `Read` | Resolve Cloudflare Account ID for Wrangler commands |
| **Zone (`gdgjakarta.org`)** | `Zone` | `Read` | Resolve Zone ID for `gdgjakarta.org` |
| **Zone (`gdgjakarta.org`)** | `DNS` | `Edit` | Export DNS backup and remove conflicting Short.io apex records |
| **Zone (`gdgjakarta.org`)** | `Workers Routes` | `Edit` | Attach `custom_domain: true` (`gdgjakarta.org`) and provision Edge TLS |

---

## 3. Prerequisites & Cloudflare Environment Rules

1. Install dependencies and verify Wrangler authentication:
   ```bash
   npm ci
   npx wrangler whoami
   ```
2. Gather required credentials before running migration or deploy commands:
   - `SHORTIO_API_KEY`: Existing Short.io Secret API Key (used only for export and rollback/dual-mode).
   - `SHORTLINK_COOKIE_SECRET`: Generate a 32-byte hex secret (`openssl rand -hex 32`) shared by **both** Workers for PBKDF2/HMAC unlock and A/B split-test cookies.
   - `SHORTLINK_API_KEY`: Generate a strong API key (`openssl rand -hex 32`) for `/api/links/shorten` (or align with `N8N_WEBHOOK_API_KEY`).
3. **Cloudflare Environment Rules (`.agents/rules/cloudflare-env.md`)**:
   - **Never hardcode credentials or fallbacks** in source code or `wrangler.jsonc`.
   - **`NEXT_PUBLIC_*` variables** are inlined at `next build` time and must be configured under Cloudflare Workers Builds **Build variables** (not only runtime `vars`).
   - **Real secrets** (`SHORTLINK_COOKIE_SECRET`, `SHORTLINK_API_KEY`, `SHORTIO_API_KEY`, `N8N_WEBHOOK_API_KEY`) must be provisioned with `wrangler secret put` — never in `wrangler.jsonc` `vars`.
   - **Fail-Closed Secret Pre-Deploy Gate**: `src/lib/shortlinks/crypto.ts` throws if `SHORTLINK_COOKIE_SECRET` is empty, and `/api/links/shorten` returns `401` if `SHORTLINK_API_KEY` / `N8N_WEBHOOK_API_KEY` is unset. Always provision secrets **before** deploying either Worker.

---

## 4. Step 1 — Provision Cloudflare KV & D1

1. Create the production KV namespace:
   ```bash
   npx wrangler kv namespace create SHORTLINKS_KV
   ```
   *(Optional: create a separate preview namespace via `npx wrangler kv namespace create SHORTLINKS_KV --preview` if you want Cloudflare preview deployments isolated from production links.)*
2. Create the production D1 database:
   ```bash
   npx wrangler d1 create gdgjakarta-shortlinks
   ```
   *(Optional: create `gdgjakarta-shortlinks-preview` if isolating `previews` in `wrangler.jsonc`.)*
3. Replace the zeroed placeholder IDs (`00000000000000000000000000000000` and `00000000-0000-0000-0000-000000000000`) in **both** Wrangler config files:
   - `wrangler.jsonc`:
     - Top-level `kv_namespaces[0].id` and `d1_databases[0].database_id`
     - `previews.kv_namespaces[0].id` and `previews.d1_databases[0].database_id`
   - `workers/shortlink/wrangler.jsonc`:
     - `kv_namespaces[0].id` and `d1_databases[0].database_id`

> **Note on `migrations_dir`**: Root `wrangler.jsonc` sets `"migrations_dir": "workers/shortlink/migrations"`, while `workers/shortlink/wrangler.jsonc` sets `"migrations_dir": "migrations"` (relative to `workers/shortlink/`). Passing `-c workers/shortlink/wrangler.jsonc` works consistently from the repository root.

---

## 5. Step 2 — Apply D1 Schema Migration (`0001_shortlinks.sql`)

1. Apply and verify locally first:
   ```bash
   npx wrangler d1 migrations apply gdgjakarta-shortlinks --local -c workers/shortlink/wrangler.jsonc
   npx wrangler d1 execute gdgjakarta-shortlinks --local -c workers/shortlink/wrangler.jsonc \
     --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
   ```
2. Apply to the remote production D1 database:
   ```bash
   npx wrangler d1 migrations apply gdgjakarta-shortlinks --remote -c workers/shortlink/wrangler.jsonc
   ```
3. Verify all 4 expected tables (`short_domains`, `short_folders`, `short_link_clicks`, `short_links`) exist remotely:
   ```bash
   npx wrangler d1 execute gdgjakarta-shortlinks --remote -c workers/shortlink/wrangler.jsonc \
     --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
   ```

---

## 6. Step 3 — Provision Secrets (Fail-Closed Pre-Deploy Gate)

Set secrets on **both** Workers before any deployment:

1. **Redirect Worker (`workers/shortlink/wrangler.jsonc`)**:
   ```bash
   npx wrangler secret put SHORTLINK_COOKIE_SECRET -c workers/shortlink/wrangler.jsonc
   ```
2. **Dashboard Worker (`wrangler.jsonc`)**:
   ```bash
   npx wrangler secret put SHORTLINK_COOKIE_SECRET
   npx wrangler secret put SHORTLINK_API_KEY
   npx wrangler secret list
   ```
   Ensure `SHORTLINK_COOKIE_SECRET` uses the **exact same value** on both Workers, and confirm `SHORTIO_API_KEY` and `N8N_WEBHOOK_API_KEY` are already listed. Because `wrangler.jsonc` uses Cloudflare Workers Builds `"previews"` rather than `"env.preview"` (running `wrangler secret put ... --env preview` will fail with `Environment "preview" not found in configuration`), configure preview `SHORTLINK_COOKIE_SECRET` and `SHORTLINK_API_KEY` secrets in **Cloudflare Dashboard → Workers & Pages → `gdgjakarta-organizer-dashboard` → Settings → Variables and Secrets** (or add an explicit `"env": { "preview": ... }` block if using Wrangler CLI environments).

---

## 7. Step 4 — Export & Migrate Data from Short.io (`scripts/migrate-shortio-to-d1.mjs`)

### 7a. Export Archived Links CSV from Short.io Dashboard (Recommended)
Short.io's `GET /api/links` REST endpoint hides archived links by default. To ensure archived historical links are included:
1. Open the Short.io Dashboard → **Domain Settings** (`gdgjakarta.org`) → **Link export**.
2. Export the CSV file locally (e.g., `./shortio-archived.csv`).

### 7b. Run Dry-Run Export & Generate Local Backup + Artifacts
```bash
SHORTIO_API_KEY="<your-shortio-api-key>" node scripts/migrate-shortio-to-d1.mjs \
  --backup ./shortio-backup.json \
  --archived-csv ./shortio-archived.csv \
  --out-sql ./shortio-migration.sql \
  --out-kv ./shortio-kv-bulk.json \
  --out-report ./shortio-migration-report.json \
  --fetch-geo \
  --dry-run
```
- Saves a complete local JSON backup (`./shortio-backup.json`) containing domains, folders, active + archived links, geo targets, and click totals (`legacy_clicks` fetched from `statistics.short.io`).
- Emits idempotent D1 SQL (`./shortio-migration.sql`, omitting `BEGIN TRANSACTION`/`COMMIT` for remote D1 compatibility) and Wrangler KV bulk JSON (`./shortio-kv-bulk.json`, keyed by `<hostname>:<slug>` and `<hostname>:__domain__`).
- Writes `./shortio-migration-report.json` and prints a `WARNING` banner listing every password-protected slug (`flaggedPasswordLinks`).

### 7c. Load Local D1 & KV First (Offline Replay from Backup)
```bash
node scripts/migrate-shortio-to-d1.mjs \
  --from-backup ./shortio-backup.json \
  --out-sql ./shortio-migration.sql \
  --out-kv ./shortio-kv-bulk.json \
  --apply-d1 \
  --apply-kv \
  --local
```

### 7d. Load Remote Production D1 & KV (Idempotent)
```bash
node scripts/migrate-shortio-to-d1.mjs \
  --from-backup ./shortio-backup.json \
  --out-sql ./shortio-migration.sql \
  --out-kv ./shortio-kv-bulk.json \
  --apply-d1 \
  --apply-kv \
  --remote
```
Verify idempotency by re-running the D1 load or querying remote row counts and `legacy_clicks`:
```bash
npx wrangler d1 execute gdgjakarta-shortlinks --remote -c workers/shortlink/wrangler.jsonc \
  --command "SELECT COUNT(*) AS links, SUM(legacy_clicks) AS total_legacy_clicks, SUM(clicks_count) AS total_live_clicks FROM short_links;"
```
Re-running the script preserves existing `short_links.id`, never resets `clicks_count`, updates `legacy_clicks` via `MAX(short_links.legacy_clicks, excluded.legacy_clicks)`, and never overwrites organizer-set `password_hash` values.

### 7e. Re-Enter Passwords for Flagged Password-Protected Slugs
Short.io does not export plaintext passwords or password hashes. Every password-protected link is imported with `has_password = 1` and `password_hash = NULL` and listed in `shortio-migration-report.json` (`flaggedPasswordLinks`).
- Before DNS cutover, open `/dashboard/links` in a `SHORTLINK_PROVIDER=cloudflare` preview/local session connected to the provisioned D1/KV, edit each flagged slug, and re-save its password so PBKDF2-SHA256 `password_hash` is populated in both `short_links` and `SHORTLINKS_KV`.

---

## 8. Step 5 — Pre-Cutover Testing (`SHORTLINK_PROVIDER=cloudflare`)

Keep production `wrangler.jsonc` set to `"SHORTLINK_PROVIDER": "shortio"` until DNS cutover is ready.

1. **Test Redirect Worker locally against seeded local/remote bindings**:
   ```bash
   npx wrangler dev -c workers/shortlink/wrangler.jsonc
   ```
   Verify root redirect (`Host: gdgjakarta.org`), branded 404, migrated slugs, password unlock prompt, cloaking, OS/country geo-targeting, UTM merging, retargeting pixels, `maxClicks`, A/B split testing, link bundles, and `/.well-known/{apple-app-site-association,assetlinks.json}`.
2. *(Optional staging check before DNS edit)*: Deploy `workers/shortlink` temporarily with `routes` commented out to its `*.workers.dev` URL, test with `curl -i -H "Host: gdgjakarta.org" https://gdgjakarta-shortlink-redirect.<account>.workers.dev/<slug>`, and re-enable `routes` in `workers/shortlink/wrangler.jsonc` before Step 6.
3. **Test Dashboard & External API with `SHORTLINK_PROVIDER=cloudflare`**:
   - Run the dashboard locally (`npm run dev` or Cloudflare preview with `SHORTLINK_PROVIDER=cloudflare`) and verify `/dashboard/links` (CRUD, folders, tags, archive/unarchive, CSV import, client-side QR, Pro edge options, Cities + Clickstream combining `legacy_clicks + short_link_clicks`, Domains Mobile Deep Linking) and `/api/links/shorten`:
     ```bash
     curl -sS -X POST "http://localhost:3000/api/links/shorten" \
       -H "content-type: application/json" \
       -H "x-api-key: $SHORTLINK_API_KEY" \
       -d '{"originalURL":"https://gdgjakarta.com/events","title":"Test Link"}'
     ```

---

## 9. Step 6 — Safe DNS Cutover for `gdgjakarta.org`

Perform these steps in exact order to avoid email, R2 asset, or link downtime:

1. **Export DNS Zone Backup**:
   - In Cloudflare Dashboard → Zone `gdgjakarta.org` → **DNS → Records → Import and Export → Export** and save the BIND zone file locally.
2. **Verify & Strictly Preserve Critical Non-Short.io Records (DO NOT DELETE)**:
   - **All `MX` records** on `gdgjakarta.org` (Google Workspace email routing).
   - **All `TXT` records** on `gdgjakarta.org`, `_domainkey`, and `_dmarc` (SPF, DKIM, DMARC, Google/domain verification).
   - **`assets.gdgjakarta.org`** (Cloudflare R2 public media, speaker assets, signed partnership PDFs).
   - Any other unrelated subdomains (e.g., `s.gdgjakarta.org`, `app.gdgjakarta.org`).
3. **Delete ONLY Conflicting Short.io Apex Records**:
   - Delete **only** the apex (`@` / `gdgjakarta.org`) `A`, `AAAA`, or `CNAME` records pointing to Short.io (e.g., `52.21.33.16` or `cname.short.io`).
4. **Deploy Redirect Worker with Workers Custom Domain**:
   ```bash
   npx wrangler deploy -c workers/shortlink/wrangler.jsonc
   ```
   This binds `routes: [{ "pattern": "gdgjakarta.org", "custom_domain": true }]`. Confirm in Cloudflare Dashboard → **Workers & Pages → `gdgjakarta-shortlink-redirect` → Settings → Domains & Routes** that `gdgjakarta.org` shows **Active** with an issued Edge TLS certificate.
5. **Switch Dashboard Provider to Cloudflare**:
   - Update `"SHORTLINK_PROVIDER": "cloudflare"` in `wrangler.jsonc` (both top-level `vars` and `previews.vars`) and deploy the dashboard (`npm run deploy` or Cloudflare Workers Builds deployment).

---

## 10. Step 7 — Post-Cutover Verification

Run these checks immediately after DNS cutover and dashboard deployment:

1. **Root & Branded 404**:
   ```bash
   curl -i https://gdgjakarta.org/
   # Expect 301/302 Location: https://gdgjakarta.com

   curl -i https://gdgjakarta.org/__nonexistent_slug_check__
   # Expect 404 HTML linking to https://gdgjakarta.com
   ```
2. **Migrated Slugs, Password Links & Deep Links**:
   ```bash
   curl -I https://gdgjakarta.org/<migrated-slug>
   curl -i https://gdgjakarta.org/.well-known/apple-app-site-association
   curl -i https://gdgjakarta.org/.well-known/assetlinks.json
   ```
   Also test a password-protected slug in a browser to confirm the unlock prompt and signed cookie work end-to-end.
3. **Preserved Email & R2 DNS Records**:
   ```bash
   dig MX gdgjakarta.org +short
   dig TXT gdgjakarta.org +short
   curl -I https://assets.gdgjakarta.org/
   ```
   Confirm `MX` and `TXT` records match your Step 6.1 BIND backup and `assets.gdgjakarta.org` remains reachable.
4. **Dashboard CRUD, Clickstream & External API**:
   - Create, edit, and click a test link in `/dashboard/links`, then verify the click appears in Analytics/Clickstream alongside preserved `legacy_clicks`.
   - Test `POST` and `GET` on `https://gdgjakarta.com/api/links/shorten` with `x-api-key`.

---

## 11. Step 8 — Rollback Plan

If any critical issue occurs after cutover:

1. **Revert Dashboard Provider**:
   - Change `"SHORTLINK_PROVIDER": "shortio"` in `wrangler.jsonc` (and runtime Workers variables if overridden) and redeploy `gdgjakarta-organizer-dashboard` (`npm run deploy`).
2. **Detach Custom Domain from Redirect Worker**:
   - In Cloudflare Dashboard → **Workers & Pages → `gdgjakarta-shortlink-redirect` → Settings → Domains & Routes**, remove the `gdgjakarta.org` custom domain binding.
3. **Restore Short.io Apex DNS Records**:
   - Using your Step 6.1 BIND backup, recreate **only** the apex (`@` / `gdgjakarta.org`) `A`/`AAAA`/`CNAME` records pointing back to Short.io. Never alter `MX`, `TXT`, or `assets.gdgjakarta.org` records.
4. **Reconcile Any Cutover-Window Links**:
   - Export any links created solely in `SHORTLINKS_DB` during the cutover window and import them into Short.io before resuming normal operations.
