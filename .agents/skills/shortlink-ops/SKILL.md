---
name: shortlink-ops
description: >-
  Run Cloudflare shortlink operations: migrate archived Short.io CSV links into
  D1/KV or sync Cloudflare Worker preview secrets. Use for "/shortlink-ops",
  "migrate archived links", "import short.io csv", "sync preview secrets", or
  "check worker secrets".
---

# Shortlink Ops Skill

Operational runbook for `scripts/migrate-shortio-to-d1.mjs` and `scripts/sync-preview-secrets.mjs`.

## 1. Sync Cloudflare Preview / Worker Secrets

Always run `--dry-run` first to compare `.env.local` / `process.env` against remote Wrangler secrets without printing secret values:

```bash
node scripts/sync-preview-secrets.mjs --dry-run
```

Apply found secrets via `npx wrangler versions secret bulk`:

```bash
node scripts/sync-preview-secrets.mjs --apply
```

Useful flags:
- `--all`: include all secret keys listed in `wrangler.jsonc` top-level `vars`
- `--keys KEY1,KEY2`: sync specific keys only
- `-c workers/shortlink/wrangler.jsonc`: target the Redirect Worker instead of the dashboard Worker
- `--env <name>`: target an explicit Wrangler `env.<name>` block if defined

## 2. Migrate Archived Short.io Links (CSV)

Short.io's REST API hides archived links by default. Export the CSV from **Short.io Dashboard -> Domain Settings (`gdgjakarta.org`) -> Link export**, then preview first with `--dry-run`:

```bash
node scripts/migrate-shortio-to-d1.mjs \
  --from-backup /tmp/shortio-backup.json \
  --archived-csv /path/to/shortio-archived.csv \
  --out-sql /tmp/shortio-migration.sql \
  --out-kv /tmp/shortio-kv-bulk.json \
  --out-report /tmp/shortio-migration-report.json \
  --dry-run
```

If `--from-backup` is not available (e.g., Short.io subscription already canceled) and you only have the CSV, confirm with the user before importing, then apply remotely:

```bash
node scripts/migrate-shortio-to-d1.mjs \
  --from-backup /tmp/shortio-backup.json \
  --archived-csv /path/to/shortio-archived.csv \
  --out-sql /tmp/shortio-migration.sql \
  --out-kv /tmp/shortio-kv-bulk.json \
  --out-report /tmp/shortio-migration-report.json \
  --apply-d1 --apply-kv --remote
```

## Safety Rules

- Never print or echo secret values in terminal output.
- Always run `--dry-run` before `--apply` or `--remote`.
- Re-running `migrate-shortio-to-d1.mjs` is idempotent: it preserves existing `short_links.id`, `clicks_count`, `MAX(legacy_clicks)`, and organizer-set `password_hash` values.
