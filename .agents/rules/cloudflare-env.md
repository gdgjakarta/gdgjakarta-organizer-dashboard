---
trigger: always_on
description: Cloudflare Workers + OpenNext env vars - NEXT_PUBLIC_* are build-time; never hardcode credential fallbacks.
---

# Cloudflare env vars (build vs runtime)

1. **Never hardcode credentials or API keys as fallbacks** (`process.env.X || "AIza..."`), even public Firebase/Maps browser keys, and not even as a temporary "make it work" fix. If a value is missing, fix the env source.
2. **`NEXT_PUBLIC_*` is inlined by `next build`.** On Cloudflare Workers Builds it must be set under **Settings → Build → Variables and secrets** (Build variables). These are NOT visible to `next build`:
   - `wrangler.jsonc` `vars` and dashboard runtime "Variables and Secrets" (the "Edit variable … in Production / Save version / Deploy" dialog)
   - `.env.local` (gitignored, local only)
3. **Diagnosing "key empty in production"**: do not blame CDN/browser cache, Text vs Secret type, or point at local `.open-next` output (local builds read `.env.local`). The `env.X (...)` lines in the Cloudflare build log are the `wrangler deploy` binding table printed after the Building phase. They don't show what the build saw.
4. **Do not add `next.config.mjs` `env` passthroughs with `|| ""`.** They don't fix a missing build var, and they bake `""` into server bundles as well. The `PHASE_PRODUCTION_BUILD` guard in `next.config.mjs` is the safety net: add any new required `NEXT_PUBLIC_*` to `REQUIRED_PUBLIC_ENV`.
5. Real secrets go through `wrangler secret put`, never `wrangler.jsonc` `vars`.
