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
  type ShortlinkWorkerEnv,
  type SplitTestTarget,
  type UtmParams,
} from "@/lib/shortlinks/types";

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== "string") {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function normalizeExpiresAt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : null;
    }
    const parsedMs = Date.parse(trimmed);
    return Number.isFinite(parsedMs) ? parsedMs : null;
  }
  return null;
}

function normalizeRedirectType(value: unknown): RedirectStatusCode {
  const num = typeof value === "number" ? value : Number(value);
  if (num === 301 || num === 302 || num === 307 || num === 308) {
    return num;
  }
  return 302;
}

export function decodePathnameSafely(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

export function parseD1LinkRow(row: D1ShortLinkRow): EdgeShortLinkRecord {
  return {
    id: row.id,
    domainId: row.domain_id,
    hostname: normalizeHostname(row.hostname),
    path: normalizeSlugPath(row.path),
    originalURL: row.original_url,
    redirectType: normalizeRedirectType(row.redirect_type),
    archived: Boolean(row.archived),
    expiresAt: normalizeExpiresAt(row.expires_at),
    expiredURL: row.expired_url ?? null,
    passwordHash: row.password_hash ?? null,
    cloaking: Boolean(row.cloaking),
    androidURL: row.android_url ?? null,
    iphoneURL: row.iphone_url ?? null,
    geoTargets: safeJsonParse<GeoTargetRule[]>(row.geo_targets_json, []),
    utmParams: row.utm_params_json ? safeJsonParse<UtmParams | null>(row.utm_params_json, null) : null,
    pixels: row.pixels_json ? safeJsonParse<LinkPixelConfig | null>(row.pixels_json, null) : null,
    maxClicks: typeof row.max_clicks === "number" && Number.isFinite(row.max_clicks) ? row.max_clicks : null,
    linkType: row.link_type === "split" || row.link_type === "bundle" ? row.link_type : "redirect",
    splitTargets: safeJsonParse<SplitTestTarget[]>(row.split_targets_json, []),
    bundleItems: safeJsonParse<LinkBundleItem[]>(row.bundle_items_json, []),
    title: row.title ?? null,
    folderId: row.folder_id ?? null,
    tags: safeJsonParse<string[]>(row.tags_json, []),
    updatedAt: row.updated_at,
  };
}

export function parseD1DomainRow(row: D1ShortDomainRow): EdgeDomainConfig {
  return {
    id: row.id,
    hostname: normalizeHostname(row.hostname),
    state: row.state,
    linkType: row.link_type,
    appleAppSiteAssociation: row.apple_app_site_association ?? null,
    assetLinks: row.asset_links ?? null,
    updatedAt: row.updated_at,
  };
}

function normalizeKvLinkRecord(
  raw: unknown,
  fallbackHostname: string,
  fallbackSlug: string,
): EdgeShortLinkRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id.trim()) {
    return null;
  }

  const linkType = obj.linkType === "split" || obj.linkType === "bundle" ? obj.linkType : "redirect";

  return {
    id: obj.id.trim(),
    domainId: typeof obj.domainId === "number" && Number.isFinite(obj.domainId) ? obj.domainId : 0,
    hostname:
      typeof obj.hostname === "string" && obj.hostname.trim() ? normalizeHostname(obj.hostname) : fallbackHostname,
    path: typeof obj.path === "string" && obj.path.trim() ? normalizeSlugPath(obj.path) : fallbackSlug,
    originalURL: typeof obj.originalURL === "string" ? obj.originalURL : "",
    redirectType: normalizeRedirectType(obj.redirectType),
    archived: Boolean(obj.archived),
    expiresAt: normalizeExpiresAt(obj.expiresAt),
    expiredURL: typeof obj.expiredURL === "string" ? obj.expiredURL : null,
    passwordHash: typeof obj.passwordHash === "string" ? obj.passwordHash : null,
    cloaking: Boolean(obj.cloaking),
    androidURL: typeof obj.androidURL === "string" ? obj.androidURL : null,
    iphoneURL: typeof obj.iphoneURL === "string" ? obj.iphoneURL : null,
    geoTargets: Array.isArray(obj.geoTargets) ? (obj.geoTargets as GeoTargetRule[]) : [],
    utmParams: obj.utmParams && typeof obj.utmParams === "object" ? (obj.utmParams as UtmParams) : null,
    pixels: obj.pixels && typeof obj.pixels === "object" ? (obj.pixels as LinkPixelConfig) : null,
    maxClicks: typeof obj.maxClicks === "number" && Number.isFinite(obj.maxClicks) ? obj.maxClicks : null,
    linkType,
    splitTargets: Array.isArray(obj.splitTargets) ? (obj.splitTargets as SplitTestTarget[]) : [],
    bundleItems: Array.isArray(obj.bundleItems) ? (obj.bundleItems as LinkBundleItem[]) : [],
    title: typeof obj.title === "string" ? obj.title : null,
    folderId: typeof obj.folderId === "string" ? obj.folderId : null,
    tags: Array.isArray(obj.tags) ? (obj.tags as string[]) : [],
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : undefined,
  };
}

function normalizeJsonTextField(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return null;
}

function normalizeKvDomainConfig(raw: unknown, fallbackHostname: string): EdgeDomainConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const aasa = normalizeJsonTextField(obj.appleAppSiteAssociation);
  const assetLinks = normalizeJsonTextField(obj.assetLinks);

  return {
    id: typeof obj.id === "number" && Number.isFinite(obj.id) ? obj.id : 0,
    hostname:
      typeof obj.hostname === "string" && obj.hostname.trim() ? normalizeHostname(obj.hostname) : fallbackHostname,
    state: typeof obj.state === "string" ? obj.state : "configured",
    linkType: typeof obj.linkType === "string" ? obj.linkType : null,
    appleAppSiteAssociation: aasa,
    assetLinks,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : undefined,
  };
}

export async function getEdgeLink(
  env: ShortlinkWorkerEnv,
  hostname: string,
  slug: string,
  ctx: ExecutionContext,
): Promise<EdgeShortLinkRecord | null> {
  const normHost = normalizeHostname(hostname);
  const normSlug = normalizeSlugPath(slug);
  if (!normHost || !normSlug) {
    return null;
  }

  const candidates = [normSlug];
  const withoutTrailingSlash = normSlug.replace(/\/+$/, "");
  if (withoutTrailingSlash && withoutTrailingSlash !== normSlug) {
    candidates.push(withoutTrailingSlash);
  }

  for (const candidate of candidates) {
    const kvKey = buildLinkKvKey(normHost, candidate);

    try {
      const rawKv = await env.SHORTLINKS_KV.get(kvKey, "text");
      if (rawKv !== null) {
        const parsed = normalizeKvLinkRecord(JSON.parse(rawKv), normHost, candidate);
        if (parsed) {
          return parsed;
        }
      }
    } catch {
      // Malformed KV JSON falls through to D1.
    }

    const row = await env.SHORTLINKS_DB.prepare("SELECT * FROM short_links WHERE hostname = ? AND path = ? LIMIT 1")
      .bind(normHost, candidate)
      .first<D1ShortLinkRow>();

    if (row) {
      const record = parseD1LinkRow(row);
      ctx.waitUntil(
        env.SHORTLINKS_KV.put(kvKey, JSON.stringify(record)).catch((err) => {
          console.warn("KV link backfill failed", err);
        }),
      );
      return record;
    }
  }

  return null;
}

export async function getDomainConfig(
  env: ShortlinkWorkerEnv,
  hostname: string,
  ctx: ExecutionContext,
): Promise<EdgeDomainConfig | null> {
  const normHost = normalizeHostname(hostname);
  if (!normHost) {
    return null;
  }

  const kvKey = buildDomainKvKey(normHost);

  try {
    const rawKv = await env.SHORTLINKS_KV.get(kvKey, "text");
    if (rawKv !== null) {
      const parsed = normalizeKvDomainConfig(JSON.parse(rawKv), normHost);
      if (parsed) {
        return parsed;
      }
    }
  } catch {
    // Malformed KV JSON falls through to D1.
  }

  const row = await env.SHORTLINKS_DB.prepare("SELECT * FROM short_domains WHERE hostname = ? LIMIT 1")
    .bind(normHost)
    .first<D1ShortDomainRow>();

  if (!row) {
    return null;
  }

  const config = parseD1DomainRow(row);
  ctx.waitUntil(
    env.SHORTLINKS_KV.put(kvKey, JSON.stringify(config)).catch((err) => {
      console.warn("KV domain backfill failed", err);
    }),
  );
  return config;
}
