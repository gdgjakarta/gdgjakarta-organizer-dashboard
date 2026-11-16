# Short Links (`/dashboard/links`)

Organizer-only Short.io dashboard (live API, no Firestore mirror).

- **Tabs**: Links | Analytics (domain-wide) | Domains.
- **Links**: CRUD, folders, bulk move/delete, QR, archive (row action), CSV import (`parse-csv.ts`, max 1000 rows), per-link analytics sheet.
- **Advanced options** (`advanced-options.tsx`): redirect type, cloaking, password, expiry + expired URL, Android/iOS URLs, UTM builder (applied to the destination URL on save). Edit sends `null` to clear expiry/device URLs; an empty password means "keep current".
- **Data layer**: `src/lib/shortio/client.ts` (SDK), `src/lib/shortio/advanced.ts` (fetch: stats via `statistics.short.io`, archive, bulk, domains), `src/server/shortio-actions.ts` + `src/server/shortio-advanced-actions.ts` (all guarded by `isAuthorizedOrganizerSession`; domain add/remove require executive organizer; the primary domain cannot be removed).
- **Not implemented**: geo targeting, archived-links view/unarchive (public list API has no archived filter), plan-gated features surface the API error.
