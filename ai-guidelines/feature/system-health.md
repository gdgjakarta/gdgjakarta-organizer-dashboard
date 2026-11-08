# System Health & Docker Operations (`/dashboard/health`)

## Overview
Provides Organizers with a Zeabur-like container management and telemetry dashboard under **System & Tools → System Health** (`/dashboard/health`) paired with the zero-dependency `gdg-ops-agent` sidecar (`~/.zeabur-migration/gdg-jakarta/ops-agent.mjs`) for the GCP Free Tier (`e2-micro`) + Cloudflare Tunnel stack.

## Key Files
- `src/app/(main)/dashboard/health/page.tsx`: Organizer-guarded Server Component.
- `src/app/(main)/dashboard/health/_components/system-health-dashboard.tsx`: Interactive dashboard for live endpoint health probes, host RAM/Swap/Disk/Volume meters, container Restart/Update/Start/Stop actions, live log viewer modal, 1-click PostgreSQL backup download, and endpoint configuration (`FloatingSaveBar`).
- `src/server/system-health-actions.ts`: Server Actions for health snapshots, container lifecycle operations, and log retrieval.
- `src/app/api/system-health/backup/route.ts`: Streams compressed PostgreSQL custom dumps (`pg_dump -Fc -Z 6`) from `gdg-postgresql`.
- `src/lib/system-health/types.ts`: Telemetry and configuration types.

## Security Invariant
- `OPS_AGENT_SECRET` is read strictly on the server from `process.env.OPS_AGENT_SECRET` and verified using `crypto.timingSafeEqual` in `ops-agent.mjs`. It is never stored in `system_settings/system_health` because `system_settings` allows public reads in `firestore.rules`.
