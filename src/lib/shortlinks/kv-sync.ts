import {
  buildDomainKvKey,
  buildLinkKvKey,
  type D1ShortDomainRow,
  type D1ShortLinkRow,
  type EdgeDomainConfig,
  type EdgeShortLinkRecord,
  type GeoTargetRule,
  type LinkBundleItem,
  type LinkPixelConfig,
  normalizeHostname,
  normalizeSlugPath,
  type RedirectStatusCode,
  type SplitTestTarget,
  type UtmParams,
} from "./types";

const VALID_REDIRECT_CODES = new Set<RedirectStatusCode>([301, 302, 307, 308]);

export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function parseJsonObject<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
    return null;
  } catch {
    return null;
  }
}

export function normalizeIsoTimestamp(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const trimmed = value.trim();
  const sqliteUtc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed.replace(" ", "T")}.000Z`
    : trimmed;
  const ms = Date.parse(sqliteUtc);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : trimmed;
}

function toRedirectCode(value: number): RedirectStatusCode {
  return VALID_REDIRECT_CODES.has(value as RedirectStatusCode) ? (value as RedirectStatusCode) : 302;
}

/**
 * Maps a D1 short_links row to the edge KV payload contract consumed by the Redirect Worker.
 */
export function toEdgeShortLinkRecord(row: D1ShortLinkRow): EdgeShortLinkRecord {
  return {
    id: row.id,
    domainId: row.domain_id,
    hostname: normalizeHostname(row.hostname),
    path: normalizeSlugPath(row.path),
    originalURL: row.original_url,
    redirectType: toRedirectCode(row.redirect_type),
    archived: row.archived === 1,
    expiresAt: row.expires_at ?? null,
    expiredURL: row.expired_url ?? null,
    passwordHash: row.password_hash ?? null,
    cloaking: row.cloaking === 1,
    androidURL: row.android_url ?? null,
    iphoneURL: row.iphone_url ?? null,
    geoTargets: parseJsonArray<GeoTargetRule>(row.geo_targets_json),
    utmParams: parseJsonObject<UtmParams>(row.utm_params_json),
    pixels: parseJsonObject<LinkPixelConfig>(row.pixels_json),
    maxClicks: row.max_clicks ?? null,
    linkType: row.link_type,
    splitTargets: parseJsonArray<SplitTestTarget>(row.split_targets_json),
    bundleItems: parseJsonArray<LinkBundleItem>(row.bundle_items_json),
    title: row.title ?? null,
    folderId: row.folder_id ?? null,
    tags: parseJsonArray<string>(row.tags_json),
    updatedAt: normalizeIsoTimestamp(row.updated_at),
  };
}

/**
 * Maps a D1 short_domains row to the edge KV domain config payload.
 */
export function toEdgeDomainConfig(row: D1ShortDomainRow): EdgeDomainConfig {
  return {
    id: row.id,
    hostname: normalizeHostname(row.hostname),
    state: row.state,
    linkType: row.link_type || null,
    appleAppSiteAssociation: row.apple_app_site_association ?? null,
    assetLinks: row.asset_links ?? null,
    updatedAt: normalizeIsoTimestamp(row.updated_at),
  };
}

/**
 * Synchronously writes a link record to SHORTLINKS_KV, removing any stale key if hostname/path changed.
 */
export async function syncLinkToKv(
  kv: KVNamespace,
  row: D1ShortLinkRow,
  previous?: { hostname: string; path: string },
): Promise<void> {
  const nextKey = buildLinkKvKey(row.hostname, row.path);
  if (previous) {
    const previousKey = buildLinkKvKey(previous.hostname, previous.path);
    if (previousKey !== nextKey) {
      await kv.delete(previousKey);
    }
  }
  await kv.put(nextKey, JSON.stringify(toEdgeShortLinkRecord(row)));
}

export async function deleteLinkFromKv(kv: KVNamespace, hostname: string, path: string): Promise<void> {
  await kv.delete(buildLinkKvKey(hostname, path));
}

export async function syncDomainToKv(kv: KVNamespace, row: D1ShortDomainRow): Promise<void> {
  await kv.put(buildDomainKvKey(row.hostname), JSON.stringify(toEdgeDomainConfig(row)));
}

export async function deleteDomainFromKv(kv: KVNamespace, hostname: string): Promise<void> {
  await kv.delete(buildDomainKvKey(hostname));
}
