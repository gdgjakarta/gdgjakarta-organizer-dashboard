import type {
  BulkImportRow,
  CreateShortFolderInput,
  CreateShortLinkInput,
  ShortDomain,
  ShortFolder,
  ShortLinkItem,
  ShortLinkListResponse,
  UpdateShortLinkInput,
} from "@/lib/shortio/types";

import { hashLinkPassword } from "./crypto";
import { getPrimaryDomainConfig } from "./env";
import {
  deleteDomainFromKv,
  deleteLinkFromKv,
  normalizeIsoTimestamp,
  parseJsonArray,
  parseJsonObject,
  syncDomainToKv,
  syncLinkToKv,
} from "./kv-sync";
import {
  buildDomainKvKey,
  type D1ShortDomainRow,
  type D1ShortFolderRow,
  type D1ShortLinkRow,
  type GeoTargetRule,
  type LinkBundleItem,
  type LinkPixelConfig,
  normalizeHostname,
  normalizeSlugPath,
  type RedirectStatusCode,
  type ShortLinkType,
  type SplitTestTarget,
  type UtmParams,
} from "./types";

const SLUG_ALPHABET = "abcdefghijkmnopqrstuvwxyz0123456789";
const VALID_REDIRECT_CODES = new Set<RedirectStatusCode>([301, 302, 307, 308]);
const VALID_LINK_TYPES = new Set<ShortLinkType>(["redirect", "split", "bundle"]);
const HOSTNAME_REGEX = /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;
const D1_IN_CHUNK_SIZE = 90;
const KV_SYNC_CONCURRENCY = 50;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function runInBatches<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
  }
}

function hasAsciiControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

export class ShortlinkValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ShortlinkValidationError";
  }
}

export class ShortlinkNotFoundError extends Error {
  readonly status = 404;
  constructor(message: string) {
    super(message);
    this.name = "ShortlinkNotFoundError";
  }
}

export class ShortlinkConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ShortlinkConflictError";
  }
}

function generateId(prefix: "lnk" | "fld"): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return `${prefix}_${hex}`;
}

function generateRandomSlug(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let slug = "";
  for (const byte of bytes) {
    slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
  }
  return slug;
}

function validateHttpUrl(rawUrl: string, fieldName: string): string {
  if (hasAsciiControlChar(rawUrl)) {
    throw new ShortlinkValidationError(`${fieldName} must not contain control characters.`);
  }
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("//")) {
    throw new ShortlinkValidationError(`${fieldName} must not be empty.`);
  }
  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
      throw new ShortlinkValidationError(`${fieldName} must use http:// or https://.`);
    }
    return trimmed;
  } catch (err) {
    if (err instanceof ShortlinkValidationError) throw err;
    throw new ShortlinkValidationError(`Invalid ${fieldName}: ${trimmed}`);
  }
}

function normalizeOptionalHttpUrl(rawUrl: string | null | undefined, fieldName: string): string | null | undefined {
  if (rawUrl === undefined) return undefined;
  if (rawUrl === null) return null;
  if (hasAsciiControlChar(rawUrl)) {
    throw new ShortlinkValidationError(`${fieldName} must not contain control characters.`);
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  return validateHttpUrl(trimmed, fieldName);
}

function normalizeSlug(rawSlug: string): string {
  const clean = normalizeSlugPath(rawSlug);
  if (/[\s?#]/.test(clean)) {
    throw new ShortlinkValidationError("Short link slug must not contain whitespace, '?' or '#'.");
  }
  return clean;
}

function parseRedirectType(value: unknown, fallback: RedirectStatusCode = 302): RedirectStatusCode {
  if (value === undefined || value === null || value === "") return fallback;
  const num = Number(value);
  if (!Number.isInteger(num) || !VALID_REDIRECT_CODES.has(num as RedirectStatusCode)) {
    throw new ShortlinkValidationError("redirectType must be 301, 302, 307, or 308.");
  }
  return num as RedirectStatusCode;
}

function parseLinkType(value: unknown, fallback: ShortLinkType = "redirect"): ShortLinkType {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string" && VALID_LINK_TYPES.has(value as ShortLinkType)) {
    return value as ShortLinkType;
  }
  throw new ShortlinkValidationError("linkType must be 'redirect', 'split', or 'bundle'.");
}

function parseExpiresAt(value: string | number | null | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  let ms: number;
  if (typeof value === "number") {
    ms = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    ms = /^\d+$/.test(trimmed) ? Number(trimmed) : Date.parse(trimmed);
  } else {
    throw new ShortlinkValidationError("Invalid expiresAt value.");
  }
  if (!Number.isFinite(ms) || ms < 0) {
    throw new ShortlinkValidationError("Invalid expiresAt timestamp.");
  }
  return Math.trunc(ms);
}

function parseMaxClicks(value: number | null | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw new ShortlinkValidationError("maxClicks must be a non-negative integer.");
  }
  return value;
}

function sanitizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  const unique = new Set<string>();
  for (const tag of tags) {
    if (typeof tag === "string") {
      const trimmed = tag.trim();
      if (trimmed) unique.add(trimmed);
    }
  }
  return Array.from(unique);
}

function sanitizeGeoTargets(targets: GeoTargetRule[] | null | undefined): GeoTargetRule[] {
  if (!Array.isArray(targets)) return [];
  return targets.map((rule, idx) => {
    const country = typeof rule.country === "string" ? rule.country.trim().toUpperCase() : "";
    if (!/^[A-Z]{2}$/.test(country)) {
      throw new ShortlinkValidationError(`geoTargets[${idx}].country must be a 2-letter ISO country code.`);
    }
    const url = validateHttpUrl(rule.url ?? "", `geoTargets[${idx}].url`);
    return {
      country,
      url,
      ...(rule.region?.trim() ? { region: rule.region.trim() } : {}),
    };
  });
}

function sanitizeSplitTargets(targets: SplitTestTarget[] | null | undefined): SplitTestTarget[] {
  if (!Array.isArray(targets)) return [];
  return targets.map((target, idx) => {
    const url = validateHttpUrl(target.url ?? "", `splitTargets[${idx}].url`);
    const weight = Number(target.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new ShortlinkValidationError(`splitTargets[${idx}].weight must be a positive number.`);
    }
    const label = typeof target.label === "string" && target.label.trim() ? target.label.trim() : `Variant ${idx + 1}`;
    return { url, weight, label };
  });
}

function sanitizeBundleItems(items: LinkBundleItem[] | null | undefined): LinkBundleItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item, idx) => {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (!title) {
      throw new ShortlinkValidationError(`bundleItems[${idx}].title is required.`);
    }
    const url = validateHttpUrl(item.url ?? "", `bundleItems[${idx}].url`);
    return {
      title,
      url,
      ...(item.description?.trim() ? { description: item.description.trim() } : {}),
      ...(item.icon?.trim() ? { icon: item.icon.trim() } : {}),
    };
  });
}

function sanitizeUtmParams(utm: UtmParams | null | undefined): UtmParams | null {
  if (!utm || typeof utm !== "object") return null;
  const cleaned: UtmParams = {};
  if (utm.source?.trim()) cleaned.source = utm.source.trim();
  if (utm.medium?.trim()) cleaned.medium = utm.medium.trim();
  if (utm.campaign?.trim()) cleaned.campaign = utm.campaign.trim();
  if (utm.term?.trim()) cleaned.term = utm.term.trim();
  if (utm.content?.trim()) cleaned.content = utm.content.trim();
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function sanitizePixels(pixels: LinkPixelConfig | null | undefined): LinkPixelConfig | null {
  if (!pixels || typeof pixels !== "object") return null;
  const cleaned: LinkPixelConfig = {};
  if (pixels.metaPixelId?.trim()) cleaned.metaPixelId = pixels.metaPixelId.trim();
  if (pixels.gtmId?.trim()) cleaned.gtmId = pixels.gtmId.trim();
  if (pixels.ga4Id?.trim()) cleaned.ga4Id = pixels.ga4Id.trim();
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function isUniqueConstraintError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed/i.test(msg);
}

/**
 * Maps a D1 short_links row to the client-facing ShortLinkItem contract.
 * Never includes password_hash or passwordHash.
 */
export function mapD1RowToShortLinkItem(row: D1ShortLinkRow): ShortLinkItem {
  const hostname = normalizeHostname(row.hostname);
  const path = normalizeSlugPath(row.path);
  const shortURL = `https://${hostname}/${path}`;
  const clicksCount = row.clicks_count;
  const legacyClicks = row.legacy_clicks;

  return {
    id: row.id,
    idString: row.id,
    shortURL,
    secureShortURL: shortURL,
    originalURL: row.original_url,
    path,
    displayPath: path,
    title: row.title ?? undefined,
    tags: parseJsonArray<string>(row.tags_json),
    FolderId: row.folder_id ?? undefined,
    DomainId: row.domain_id,
    OwnerId: row.owner_id ?? undefined,
    createdAt: normalizeIsoTimestamp(row.created_at),
    updatedAt: normalizeIsoTimestamp(row.updated_at),
    archived: row.archived === 1,
    clicks: clicksCount + legacyClicks,
    clicksCount,
    legacyClicks,
    cloaking: row.cloaking === 1,
    hasPassword: row.has_password === 1,
    redirectType: String(row.redirect_type),
    expiresAt: row.expires_at ?? null,
    expiredURL: row.expired_url ?? null,
    androidURL: row.android_url ?? null,
    iphoneURL: row.iphone_url ?? null,
    hostname,
    linkType: row.link_type,
    maxClicks: row.max_clicks ?? null,
    geoTargets: parseJsonArray<GeoTargetRule>(row.geo_targets_json),
    utmParams: parseJsonObject<UtmParams>(row.utm_params_json),
    pixels: parseJsonObject<LinkPixelConfig>(row.pixels_json),
    splitTargets: parseJsonArray<SplitTestTarget>(row.split_targets_json),
    bundleItems: parseJsonArray<LinkBundleItem>(row.bundle_items_json),
  };
}

export function mapD1RowToShortFolder(row: D1ShortFolderRow): ShortFolder {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon ?? undefined,
    DomainId: row.domain_id,
  };
}

export function mapD1RowToShortDomain(row: D1ShortDomainRow): ShortDomain {
  return {
    id: row.id,
    hostname: normalizeHostname(row.hostname),
    state: row.state,
    linkType: row.link_type,
    appleAppSiteAssociation: row.apple_app_site_association,
    assetLinks: row.asset_links,
    createdAt: normalizeIsoTimestamp(row.created_at),
    updatedAt: normalizeIsoTimestamp(row.updated_at),
    provider: "cloudflare",
  };
}

/**
 * Idempotently ensures the configured primary domain exists in D1 and is cached in KV.
 */
export async function ensurePrimaryDomain(db: D1Database, kv: KVNamespace): Promise<D1ShortDomainRow> {
  const { domain, domainId } = await getPrimaryDomainConfig();
  const nowIso = new Date().toISOString();

  await db
    .prepare(
      `INSERT OR IGNORE INTO short_domains (id, hostname, state, link_type, created_at, updated_at)
       VALUES (?, ?, 'configured', 'custom', ?, ?)`,
    )
    .bind(domainId, domain, nowIso, nowIso)
    .run();

  const row = await db
    .prepare(
      `SELECT * FROM short_domains
       WHERE hostname = ? OR id = ?
       ORDER BY CASE WHEN hostname = ? THEN 0 ELSE 1 END
       LIMIT 1`,
    )
    .bind(domain, domainId, domain)
    .first<D1ShortDomainRow>();

  if (!row) {
    throw new Error(`Failed to ensure primary domain '${domain}' in D1.`);
  }

  const existingKv = await kv.get(buildDomainKvKey(row.hostname));
  if (existingKv === null) {
    await syncDomainToKv(kv, row);
  }

  return row;
}

async function resolveDomainRow(db: D1Database, kv: KVNamespace, rawHostname?: string): Promise<D1ShortDomainRow> {
  const primary = await ensurePrimaryDomain(db, kv);
  if (!rawHostname?.trim()) {
    return primary;
  }
  const normalized = normalizeHostname(rawHostname);
  if (normalized === normalizeHostname(primary.hostname)) {
    return primary;
  }
  const domainRow = await db
    .prepare("SELECT * FROM short_domains WHERE hostname = ? LIMIT 1")
    .bind(normalized)
    .first<D1ShortDomainRow>();

  if (!domainRow) {
    throw new ShortlinkValidationError(`Domain '${normalized}' is not configured.`);
  }
  return domainRow;
}

async function assertFolderExists(db: D1Database, folderId: string): Promise<void> {
  const row = await db
    .prepare("SELECT id FROM short_folders WHERE id = ? LIMIT 1")
    .bind(folderId)
    .first<{ id: string }>();
  if (!row) {
    throw new ShortlinkValidationError(`Folder '${folderId}' does not exist.`);
  }
}

export interface ListLinksD1Options {
  folderId?: string;
  limit?: number;
  pageToken?: string;
  archived?: boolean | "all";
  hostname?: string;
  search?: string;
}

export async function listLinksD1(
  db: D1Database,
  kv: KVNamespace,
  options?: ListLinksD1Options,
): Promise<ShortLinkListResponse> {
  await ensurePrimaryDomain(db, kv);

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (options?.archived === true) {
    conditions.push("archived = 1");
  } else if (options?.archived !== "all") {
    conditions.push("archived = 0");
  }

  if (options?.folderId) {
    if (options.folderId === "uncategorized") {
      conditions.push("folder_id IS NULL");
    } else {
      conditions.push("folder_id = ?");
      params.push(options.folderId);
    }
  }

  if (options?.hostname?.trim()) {
    conditions.push("hostname = ?");
    params.push(normalizeHostname(options.hostname));
  }

  if (options?.search?.trim()) {
    const pattern = `%${options.search.trim().toLowerCase()}%`;
    conditions.push(
      "(LOWER(path) LIKE ? OR LOWER(original_url) LIKE ? OR LOWER(COALESCE(title, '')) LIKE ? OR LOWER(tags_json) LIKE ?)",
    );
    params.push(pattern, pattern, pattern, pattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rawLimit =
    typeof options?.limit === "number" && Number.isFinite(options.limit) ? Math.trunc(options.limit) : 150;
  const limit = Math.min(500, Math.max(1, rawLimit));
  const parsedOffset = options?.pageToken ? Number.parseInt(options.pageToken, 10) : 0;
  const offset = Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM short_links ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();

  const rowsRes = await db
    .prepare(
      `SELECT * FROM short_links ${whereClause}
       ORDER BY created_at DESC, rowid DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, limit, offset)
    .all<D1ShortLinkRow>();

  const rows = rowsRes.results ?? [];
  const total = Number(countRow?.total ?? rows.length);
  const nextPageToken = offset + rows.length < total ? String(offset + rows.length) : undefined;

  return {
    count: total,
    links: rows.map(mapD1RowToShortLinkItem),
    nextPageToken,
  };
}

export async function getLinkByIdD1(db: D1Database, linkId: string): Promise<ShortLinkItem | null> {
  const trimmed = linkId.trim();
  if (!trimmed) return null;
  const row = await db.prepare("SELECT * FROM short_links WHERE id = ? LIMIT 1").bind(trimmed).first<D1ShortLinkRow>();
  return row ? mapD1RowToShortLinkItem(row) : null;
}

export async function getLinkByPathD1(db: D1Database, path: string, hostname?: string): Promise<ShortLinkItem | null> {
  const cleanPath = normalizeSlugPath(path);
  if (!cleanPath) return null;
  const targetHost = hostname?.trim() ? normalizeHostname(hostname) : (await getPrimaryDomainConfig()).domain;

  const row = await db
    .prepare("SELECT * FROM short_links WHERE hostname = ? AND path = ? LIMIT 1")
    .bind(targetHost, cleanPath)
    .first<D1ShortLinkRow>();

  return row ? mapD1RowToShortLinkItem(row) : null;
}

export async function findLinkByOriginalUrlD1(
  db: D1Database,
  originalURL: string,
  hostname?: string,
  options?: { includeArchived?: boolean },
): Promise<ShortLinkItem | null> {
  const trimmedUrl = originalURL.trim();
  if (!trimmedUrl) return null;
  const targetHost = hostname?.trim() ? normalizeHostname(hostname) : (await getPrimaryDomainConfig()).domain;
  const includeArchived = options?.includeArchived === true;

  const row = await db
    .prepare(
      includeArchived
        ? `SELECT * FROM short_links
           WHERE hostname = ? AND original_url = ?
           ORDER BY archived ASC, created_at DESC, rowid DESC
           LIMIT 1`
        : `SELECT * FROM short_links
           WHERE hostname = ? AND original_url = ? AND archived = 0
           ORDER BY created_at DESC, rowid DESC
           LIMIT 1`,
    )
    .bind(targetHost, trimmedUrl)
    .first<D1ShortLinkRow>();

  return row ? mapD1RowToShortLinkItem(row) : null;
}

export async function createLinkD1(
  db: D1Database,
  kv: KVNamespace,
  input: CreateShortLinkInput & { ownerId?: number; ownerEmail?: string },
): Promise<ShortLinkItem> {
  const domainRow = await resolveDomainRow(db, kv, input.hostname);
  const linkType = parseLinkType(input.linkType, "redirect");
  const bundleItems = sanitizeBundleItems(input.bundleItems);
  const splitTargets = sanitizeSplitTargets(input.splitTargets);

  if (linkType === "split" && splitTargets.length === 0) {
    throw new ShortlinkValidationError("Split test links require at least one target.");
  }
  if (linkType === "bundle" && bundleItems.length === 0) {
    throw new ShortlinkValidationError("Link bundles require at least one bundle item.");
  }

  if (hasAsciiControlChar(input.originalURL)) {
    throw new ShortlinkValidationError("originalURL must not contain control characters.");
  }
  const rawOriginal = input.originalURL.trim() ? input.originalURL : bundleItems[0]?.url || splitTargets[0]?.url || "";
  const originalUrl = validateHttpUrl(rawOriginal, "originalURL");

  const folderId = input.folderId?.trim() || null;
  if (folderId) {
    await assertFolderExists(db, folderId);
  }

  const explicitSlug = input.path !== undefined ? normalizeSlug(input.path) : "";
  const hasExplicitSlug = explicitSlug.length > 0;
  const redirectType = parseRedirectType(input.redirectType, 302);
  const expiresAt = parseExpiresAt(input.expiresAt) ?? null;
  const expiredUrl = normalizeOptionalHttpUrl(input.expiredURL, "expiredURL") ?? null;
  const androidUrl = normalizeOptionalHttpUrl(input.androidURL, "androidURL") ?? null;
  const iphoneUrl = normalizeOptionalHttpUrl(input.iphoneURL, "iphoneURL") ?? null;
  const maxClicks = parseMaxClicks(input.maxClicks) ?? null;
  const tags = sanitizeTags(input.tags);
  const geoTargets = sanitizeGeoTargets(input.geoTargets);
  const utmParams = sanitizeUtmParams(input.utmParams);
  const pixels = sanitizePixels(input.pixels);

  let passwordHash: string | null = null;
  let hasPassword = 0;
  if (typeof input.password === "string" && input.password.length > 0) {
    passwordHash = await hashLinkPassword(input.password);
    hasPassword = 1;
  }

  const maxAttempts = hasExplicitSlug ? 1 : 6;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const slug = hasExplicitSlug ? explicitSlug : generateRandomSlug();
    const id = generateId("lnk");
    const nowIso = new Date().toISOString();

    try {
      await db
        .prepare(
          `INSERT INTO short_links (
             id, domain_id, hostname, path, original_url, title, tags_json, folder_id,
             archived, redirect_type, expires_at, expired_url, password_hash, has_password,
             cloaking, android_url, iphone_url, geo_targets_json, utm_params_json, pixels_json,
             max_clicks, clicks_count, legacy_clicks, link_type, split_targets_json, bundle_items_json,
             owner_id, owner_email, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          domainRow.id,
          normalizeHostname(domainRow.hostname),
          slug,
          originalUrl,
          input.title?.trim() || null,
          JSON.stringify(tags),
          folderId,
          redirectType,
          expiresAt,
          expiredUrl,
          passwordHash,
          hasPassword,
          input.cloaking ? 1 : 0,
          androidUrl,
          iphoneUrl,
          JSON.stringify(geoTargets),
          utmParams ? JSON.stringify(utmParams) : null,
          pixels ? JSON.stringify(pixels) : null,
          maxClicks,
          linkType,
          JSON.stringify(splitTargets),
          JSON.stringify(bundleItems),
          input.ownerId ?? null,
          input.ownerEmail ?? null,
          nowIso,
          nowIso,
        )
        .run();

      const inserted = await db
        .prepare("SELECT * FROM short_links WHERE id = ? LIMIT 1")
        .bind(id)
        .first<D1ShortLinkRow>();
      if (!inserted) {
        throw new Error("Failed to read back created short link.");
      }
      await syncLinkToKv(kv, inserted);
      return mapD1RowToShortLinkItem(inserted);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        if (hasExplicitSlug) {
          throw new ShortlinkConflictError(
            `A short link with slug '${slug}' already exists on ${normalizeHostname(domainRow.hostname)}.`,
          );
        }
        continue;
      }
      throw err;
    }
  }

  throw new ShortlinkConflictError("Failed to generate a unique short link slug. Please retry.");
}

export async function updateLinkD1(
  db: D1Database,
  kv: KVNamespace,
  linkId: string,
  input: UpdateShortLinkInput,
): Promise<ShortLinkItem | null> {
  const existing = await db
    .prepare("SELECT * FROM short_links WHERE id = ? LIMIT 1")
    .bind(linkId.trim())
    .first<D1ShortLinkRow>();

  if (!existing) {
    throw new ShortlinkNotFoundError("Short link not found.");
  }

  const targetDomain = input.hostname !== undefined ? await resolveDomainRow(db, kv, input.hostname) : null;
  const nextDomainId = targetDomain ? targetDomain.id : existing.domain_id;
  const nextHostname = targetDomain ? normalizeHostname(targetDomain.hostname) : normalizeHostname(existing.hostname);

  let nextPath = normalizeSlugPath(existing.path);
  if (input.path !== undefined) {
    const clean = normalizeSlug(input.path);
    if (!clean) {
      throw new ShortlinkValidationError("Short link slug cannot be empty.");
    }
    nextPath = clean;
  }

  const nextOriginalUrl =
    input.originalURL !== undefined ? validateHttpUrl(input.originalURL, "originalURL") : existing.original_url;

  const nextTitle = input.title !== undefined ? input.title.trim() || null : existing.title;
  const nextTagsJson = input.tags !== undefined ? JSON.stringify(sanitizeTags(input.tags)) : existing.tags_json;

  let nextFolderId = existing.folder_id;
  if (input.folderId !== undefined) {
    if (input.folderId === null || input.folderId.trim() === "") {
      nextFolderId = null;
    } else {
      const trimmedFolderId = input.folderId.trim();
      await assertFolderExists(db, trimmedFolderId);
      nextFolderId = trimmedFolderId;
    }
  }

  const nextRedirectType =
    input.redirectType !== undefined
      ? parseRedirectType(input.redirectType, 302)
      : (existing.redirect_type as RedirectStatusCode);

  const nextExpiresAt = input.expiresAt !== undefined ? (parseExpiresAt(input.expiresAt) ?? null) : existing.expires_at;
  const nextExpiredUrl =
    input.expiredURL !== undefined
      ? (normalizeOptionalHttpUrl(input.expiredURL, "expiredURL") ?? null)
      : existing.expired_url;
  const nextAndroidUrl =
    input.androidURL !== undefined
      ? (normalizeOptionalHttpUrl(input.androidURL, "androidURL") ?? null)
      : existing.android_url;
  const nextIphoneUrl =
    input.iphoneURL !== undefined
      ? (normalizeOptionalHttpUrl(input.iphoneURL, "iphoneURL") ?? null)
      : existing.iphone_url;

  let nextPasswordHash = existing.password_hash;
  let nextHasPassword = existing.has_password;
  if (input.clearPassword === true) {
    nextPasswordHash = null;
    nextHasPassword = 0;
  } else if (typeof input.password === "string" && input.password.length > 0) {
    nextPasswordHash = await hashLinkPassword(input.password);
    nextHasPassword = 1;
  }

  let nextCloaking = existing.cloaking;
  if (input.cloaking !== undefined) {
    nextCloaking = input.cloaking ? 1 : 0;
  }
  const nextMaxClicks = input.maxClicks !== undefined ? (parseMaxClicks(input.maxClicks) ?? null) : existing.max_clicks;
  const nextLinkType =
    input.linkType !== undefined ? parseLinkType(input.linkType, existing.link_type) : existing.link_type;

  const nextGeoTargetsJson =
    input.geoTargets !== undefined
      ? JSON.stringify(input.geoTargets === null ? [] : sanitizeGeoTargets(input.geoTargets))
      : existing.geo_targets_json;

  const nextUtmParamsJson =
    input.utmParams !== undefined
      ? (() => {
          const sanitized = sanitizeUtmParams(input.utmParams);
          return sanitized ? JSON.stringify(sanitized) : null;
        })()
      : existing.utm_params_json;

  const nextPixelsJson =
    input.pixels !== undefined
      ? (() => {
          const sanitized = sanitizePixels(input.pixels);
          return sanitized ? JSON.stringify(sanitized) : null;
        })()
      : existing.pixels_json;

  let nextSplitTargetsJson = existing.split_targets_json;
  if (input.splitTargets !== undefined) {
    nextSplitTargetsJson = JSON.stringify(input.splitTargets === null ? [] : sanitizeSplitTargets(input.splitTargets));
  } else if (nextLinkType !== "split") {
    nextSplitTargetsJson = "[]";
  }

  let nextBundleItemsJson = existing.bundle_items_json;
  if (input.bundleItems !== undefined) {
    nextBundleItemsJson = JSON.stringify(input.bundleItems === null ? [] : sanitizeBundleItems(input.bundleItems));
  } else if (nextLinkType !== "bundle") {
    nextBundleItemsJson = "[]";
  }

  if (nextLinkType === "split" && parseJsonArray<SplitTestTarget>(nextSplitTargetsJson).length === 0) {
    throw new ShortlinkValidationError("Split test links require at least one target.");
  }
  if (nextLinkType === "bundle" && parseJsonArray<LinkBundleItem>(nextBundleItemsJson).length === 0) {
    throw new ShortlinkValidationError("Link bundles require at least one bundle item.");
  }

  const nowIso = new Date().toISOString();

  try {
    await db
      .prepare(
        `UPDATE short_links SET
           domain_id = ?, hostname = ?, path = ?, original_url = ?, title = ?,
           tags_json = ?, folder_id = ?, redirect_type = ?, expires_at = ?, expired_url = ?,
           password_hash = ?, has_password = ?, cloaking = ?, android_url = ?, iphone_url = ?,
           geo_targets_json = ?, utm_params_json = ?, pixels_json = ?, max_clicks = ?,
           link_type = ?, split_targets_json = ?, bundle_items_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        nextDomainId,
        nextHostname,
        nextPath,
        nextOriginalUrl,
        nextTitle,
        nextTagsJson,
        nextFolderId,
        nextRedirectType,
        nextExpiresAt,
        nextExpiredUrl,
        nextPasswordHash,
        nextHasPassword,
        nextCloaking,
        nextAndroidUrl,
        nextIphoneUrl,
        nextGeoTargetsJson,
        nextUtmParamsJson,
        nextPixelsJson,
        nextMaxClicks,
        nextLinkType,
        nextSplitTargetsJson,
        nextBundleItemsJson,
        nowIso,
        existing.id,
      )
      .run();
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ShortlinkConflictError(`A short link with slug '${nextPath}' already exists on ${nextHostname}.`);
    }
    throw err;
  }

  const updated = await db
    .prepare("SELECT * FROM short_links WHERE id = ? LIMIT 1")
    .bind(existing.id)
    .first<D1ShortLinkRow>();
  if (!updated) {
    throw new Error("Failed to read back updated short link.");
  }

  await syncLinkToKv(kv, updated, { hostname: existing.hostname, path: existing.path });
  return mapD1RowToShortLinkItem(updated);
}

export async function archiveLinksD1(
  db: D1Database,
  kv: KVNamespace,
  linkIds: string[],
  archived = true,
): Promise<{ updatedCount: number }> {
  const uniqueIds = Array.from(new Set(linkIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { updatedCount: 0 };

  const archivedFlag = archived ? 1 : 0;
  const nowIso = new Date().toISOString();
  const idChunks = chunkArray(uniqueIds, D1_IN_CHUNK_SIZE);

  const updateStatements = idChunks.map((chunk) => {
    const placeholders = chunk.map(() => "?").join(", ");
    return db
      .prepare(`UPDATE short_links SET archived = ?, updated_at = ? WHERE id IN (${placeholders})`)
      .bind(archivedFlag, nowIso, ...chunk);
  });
  const selectStatements = idChunks.map((chunk) => {
    const placeholders = chunk.map(() => "?").join(", ");
    return db.prepare(`SELECT * FROM short_links WHERE id IN (${placeholders})`).bind(...chunk);
  });

  const batchResults = await db.batch<D1ShortLinkRow>([...updateStatements, ...selectStatements]);
  const rows = batchResults.slice(updateStatements.length).flatMap((res) => res.results ?? []);

  await runInBatches(rows, KV_SYNC_CONCURRENCY, (row) => syncLinkToKv(kv, row));

  return { updatedCount: rows.length };
}

export async function deleteLinkD1(db: D1Database, kv: KVNamespace, linkId: string): Promise<boolean> {
  const existing = await db
    .prepare("SELECT id, hostname, path FROM short_links WHERE id = ? LIMIT 1")
    .bind(linkId.trim())
    .first<{ id: string; hostname: string; path: string }>();

  if (!existing) return false;

  await db.prepare("DELETE FROM short_links WHERE id = ?").bind(existing.id).run();
  await deleteLinkFromKv(kv, existing.hostname, existing.path);
  return true;
}

export async function bulkDeleteLinksD1(
  db: D1Database,
  kv: KVNamespace,
  linkIds: string[],
): Promise<{ deletedIds: string[] }> {
  const uniqueIds = Array.from(new Set(linkIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { deletedIds: [] };

  const idChunks = chunkArray(uniqueIds, D1_IN_CHUNK_SIZE);
  const selectResults = await db.batch<{ id: string; hostname: string; path: string }>(
    idChunks.map((chunk) => {
      const placeholders = chunk.map(() => "?").join(", ");
      return db.prepare(`SELECT id, hostname, path FROM short_links WHERE id IN (${placeholders})`).bind(...chunk);
    }),
  );

  const toDelete = selectResults.flatMap((res) => res.results ?? []);
  if (toDelete.length === 0) return { deletedIds: [] };

  const deleteChunks = chunkArray(
    toDelete.map((row) => row.id),
    D1_IN_CHUNK_SIZE,
  );
  await db.batch(
    deleteChunks.map((chunk) => {
      const placeholders = chunk.map(() => "?").join(", ");
      return db.prepare(`DELETE FROM short_links WHERE id IN (${placeholders})`).bind(...chunk);
    }),
  );

  await runInBatches(toDelete, KV_SYNC_CONCURRENCY, (row) => deleteLinkFromKv(kv, row.hostname, row.path));

  return { deletedIds: toDelete.map((row) => row.id) };
}

export async function bulkMoveLinksD1(
  db: D1Database,
  kv: KVNamespace,
  linkIds: string[],
  folderId: string | null,
): Promise<ShortLinkItem[]> {
  const uniqueIds = Array.from(new Set(linkIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const nextFolderId = folderId?.trim() || null;
  if (nextFolderId) {
    await assertFolderExists(db, nextFolderId);
  }

  const nowIso = new Date().toISOString();
  const idChunks = chunkArray(uniqueIds, D1_IN_CHUNK_SIZE);
  const updateStatements = idChunks.map((chunk) => {
    const placeholders = chunk.map(() => "?").join(", ");
    return db
      .prepare(`UPDATE short_links SET folder_id = ?, updated_at = ? WHERE id IN (${placeholders})`)
      .bind(nextFolderId, nowIso, ...chunk);
  });
  const selectStatements = idChunks.map((chunk) => {
    const placeholders = chunk.map(() => "?").join(", ");
    return db.prepare(`SELECT * FROM short_links WHERE id IN (${placeholders})`).bind(...chunk);
  });

  const batchResults = await db.batch<D1ShortLinkRow>([...updateStatements, ...selectStatements]);
  const rows = batchResults.slice(updateStatements.length).flatMap((res) => res.results ?? []);

  await runInBatches(rows, KV_SYNC_CONCURRENCY, (row) => syncLinkToKv(kv, row));

  return rows.map(mapD1RowToShortLinkItem);
}

export async function bulkCreateLinksD1(
  db: D1Database,
  kv: KVNamespace,
  rows: BulkImportRow[],
): Promise<{ originalURL: string; ok: boolean; error?: string }[]> {
  const results: { originalURL: string; ok: boolean; error?: string }[] = [];
  for (const row of rows) {
    try {
      await createLinkD1(db, kv, {
        originalURL: row.originalURL,
        path: row.path,
        title: row.title,
        tags: row.tags,
      });
      results.push({ originalURL: row.originalURL, ok: true });
    } catch (err) {
      results.push({
        originalURL: row.originalURL,
        ok: false,
        error: err instanceof Error ? err.message : "Failed to create short link",
      });
    }
  }
  return results;
}

export async function listFoldersD1(db: D1Database, kv: KVNamespace): Promise<ShortFolder[]> {
  await ensurePrimaryDomain(db, kv);
  const res = await db.prepare("SELECT * FROM short_folders ORDER BY name ASC").all<D1ShortFolderRow>();
  return (res.results ?? []).map(mapD1RowToShortFolder);
}

export async function createFolderD1(
  db: D1Database,
  kv: KVNamespace,
  input: CreateShortFolderInput & { icon?: string },
): Promise<ShortFolder> {
  const primary = await ensurePrimaryDomain(db, kv);
  const name = input.name.trim();
  if (!name) {
    throw new ShortlinkValidationError("Folder name is required.");
  }

  const id = generateId("fld");
  const color = input.color?.trim() || "#0693E3";
  const icon = input.icon?.trim() || null;
  const nowIso = new Date().toISOString();

  try {
    await db
      .prepare(
        `INSERT INTO short_folders (id, domain_id, name, color, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, primary.id, name, color, icon, nowIso, nowIso)
      .run();
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ShortlinkConflictError(`Folder '${name}' already exists.`);
    }
    throw err;
  }

  const created = await db
    .prepare("SELECT * FROM short_folders WHERE id = ? LIMIT 1")
    .bind(id)
    .first<D1ShortFolderRow>();
  if (!created) {
    throw new Error("Failed to read back created folder.");
  }
  return mapD1RowToShortFolder(created);
}

export async function updateFolderD1(
  db: D1Database,
  folderId: string,
  input: { name?: string; color?: string; icon?: string | null },
): Promise<ShortFolder> {
  const existing = await db
    .prepare("SELECT * FROM short_folders WHERE id = ? LIMIT 1")
    .bind(folderId.trim())
    .first<D1ShortFolderRow>();
  if (!existing) {
    throw new ShortlinkNotFoundError("Folder not found.");
  }

  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  if (!nextName) {
    throw new ShortlinkValidationError("Folder name cannot be empty.");
  }
  const nextColor = input.color !== undefined ? input.color.trim() || "#0693E3" : existing.color;
  const nextIcon = input.icon !== undefined ? input.icon?.trim() || null : existing.icon;
  const nowIso = new Date().toISOString();

  try {
    await db
      .prepare("UPDATE short_folders SET name = ?, color = ?, icon = ?, updated_at = ? WHERE id = ?")
      .bind(nextName, nextColor, nextIcon, nowIso, existing.id)
      .run();
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ShortlinkConflictError(`Folder '${nextName}' already exists.`);
    }
    throw err;
  }

  const updated = await db
    .prepare("SELECT * FROM short_folders WHERE id = ? LIMIT 1")
    .bind(existing.id)
    .first<D1ShortFolderRow>();
  if (!updated) {
    throw new Error("Failed to read back updated folder.");
  }
  return mapD1RowToShortFolder(updated);
}

export async function deleteFolderD1(db: D1Database, kv: KVNamespace, folderId: string): Promise<boolean> {
  const trimmedId = folderId.trim();
  const existing = await db
    .prepare("SELECT id FROM short_folders WHERE id = ? LIMIT 1")
    .bind(trimmedId)
    .first<{ id: string }>();
  if (!existing) return false;

  const affectedLinks = await db
    .prepare("SELECT * FROM short_links WHERE folder_id = ?")
    .bind(trimmedId)
    .all<D1ShortLinkRow>();
  const affectedRows = affectedLinks.results ?? [];

  await db.prepare("DELETE FROM short_folders WHERE id = ?").bind(trimmedId).run();

  if (affectedRows.length > 0) {
    await runInBatches(affectedRows, KV_SYNC_CONCURRENCY, (row) => syncLinkToKv(kv, { ...row, folder_id: null }));
  }

  return true;
}

export async function listDomainsD1(db: D1Database, kv: KVNamespace): Promise<ShortDomain[]> {
  await ensurePrimaryDomain(db, kv);
  const res = await db.prepare("SELECT * FROM short_domains ORDER BY id ASC").all<D1ShortDomainRow>();
  return (res.results ?? []).map(mapD1RowToShortDomain);
}

export async function createDomainD1(db: D1Database, kv: KVNamespace, rawHostname: string): Promise<ShortDomain> {
  await ensurePrimaryDomain(db, kv);
  const hostname = normalizeHostname(rawHostname);
  if (!HOSTNAME_REGEX.test(hostname)) {
    throw new ShortlinkValidationError("Invalid domain hostname.");
  }

  const nowIso = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO short_domains (hostname, state, link_type, created_at, updated_at)
         VALUES (?, 'configured', 'custom', ?, ?)`,
      )
      .bind(hostname, nowIso, nowIso)
      .run();
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ShortlinkConflictError(`Domain '${hostname}' already exists.`);
    }
    throw err;
  }

  const created = await db
    .prepare("SELECT * FROM short_domains WHERE hostname = ? LIMIT 1")
    .bind(hostname)
    .first<D1ShortDomainRow>();
  if (!created) {
    throw new Error("Failed to read back created domain.");
  }

  await syncDomainToKv(kv, created);
  return mapD1RowToShortDomain(created);
}

function validateOptionalJsonPayload(raw: string | null | undefined, fieldName: string): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    throw new ShortlinkValidationError(`${fieldName} must be valid JSON.`);
  }
}

export async function updateDomainConfigD1(
  db: D1Database,
  kv: KVNamespace,
  domainId: number,
  input: {
    appleAppSiteAssociation?: string | null;
    assetLinks?: string | null;
    linkType?: string;
    state?: string;
  },
): Promise<ShortDomain> {
  await ensurePrimaryDomain(db, kv);
  const existing = await db
    .prepare("SELECT * FROM short_domains WHERE id = ? LIMIT 1")
    .bind(domainId)
    .first<D1ShortDomainRow>();
  if (!existing) {
    throw new ShortlinkNotFoundError("Domain not found.");
  }

  const nextAasa =
    input.appleAppSiteAssociation !== undefined
      ? (validateOptionalJsonPayload(input.appleAppSiteAssociation, "appleAppSiteAssociation") ?? null)
      : existing.apple_app_site_association;
  const nextAssetLinks =
    input.assetLinks !== undefined
      ? (validateOptionalJsonPayload(input.assetLinks, "assetLinks") ?? null)
      : existing.asset_links;
  const nextLinkType = input.linkType !== undefined ? input.linkType.trim() || "custom" : existing.link_type;
  const nextState = input.state !== undefined ? input.state.trim() || existing.state : existing.state;
  const nowIso = new Date().toISOString();

  await db
    .prepare(
      `UPDATE short_domains
       SET apple_app_site_association = ?, asset_links = ?, link_type = ?, state = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(nextAasa, nextAssetLinks, nextLinkType, nextState, nowIso, existing.id)
    .run();

  const updated = await db
    .prepare("SELECT * FROM short_domains WHERE id = ? LIMIT 1")
    .bind(existing.id)
    .first<D1ShortDomainRow>();
  if (!updated) {
    throw new Error("Failed to read back updated domain.");
  }

  await syncDomainToKv(kv, updated);
  return mapD1RowToShortDomain(updated);
}

export async function deleteDomainD1(db: D1Database, kv: KVNamespace, domainId: number): Promise<boolean> {
  const primary = await getPrimaryDomainConfig();
  if (domainId === primary.domainId) {
    throw new ShortlinkValidationError("The primary domain used by this dashboard cannot be removed here.");
  }

  const domain = await db
    .prepare("SELECT * FROM short_domains WHERE id = ? LIMIT 1")
    .bind(domainId)
    .first<D1ShortDomainRow>();
  if (!domain) {
    throw new ShortlinkNotFoundError("Domain not found.");
  }
  if (normalizeHostname(domain.hostname) === primary.domain) {
    throw new ShortlinkValidationError("The primary domain used by this dashboard cannot be removed here.");
  }

  // Query cascaded links BEFORE DELETE so every KV key is cleaned up synchronously.
  const cascadedLinks = await db
    .prepare("SELECT hostname, path FROM short_links WHERE domain_id = ?")
    .bind(domain.id)
    .all<{ hostname: string; path: string }>();

  await db.prepare("DELETE FROM short_domains WHERE id = ?").bind(domain.id).run();

  await deleteDomainFromKv(kv, domain.hostname);
  await runInBatches(cascadedLinks.results ?? [], KV_SYNC_CONCURRENCY, (link) =>
    deleteLinkFromKv(kv, link.hostname, link.path),
  );

  return true;
}
