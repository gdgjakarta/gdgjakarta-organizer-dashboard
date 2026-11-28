import type { ClickStats, StatsPeriod } from "@/lib/shortio/types";

import { ShortlinkNotFoundError } from "./d1-store";
import { getPrimaryDomainConfig } from "./env";
import { parseJsonArray } from "./kv-sync";
import {
  type CityStat,
  type ClickStreamEntry,
  type D1ShortLinkClickRow,
  normalizeHostname,
  type SplitTestTarget,
} from "./types";

const JAKARTA_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

export interface SplitVariantStat {
  variantLabel: string;
  targetUrl?: string | null;
  clicks: number;
  humanClicks: number;
  percentage: number;
}

export type ExtendedClickStats = ClickStats & {
  splitVariants?: SplitVariantStat[];
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Computes period cutoff epoch milliseconds anchored to Asia/Jakarta (UTC+7).
 */
export function getPeriodStartMs(period: StatsPeriod, nowMs = Date.now()): number {
  const jakarta = new Date(nowMs + JAKARTA_OFFSET_MS);
  const year = jakarta.getUTCFullYear();
  const month = jakarta.getUTCMonth();
  const dayOfMonth = jakarta.getUTCDate();
  const dayOfWeek = jakarta.getUTCDay(); // 0 = Sun, 1 = Mon ...

  switch (period) {
    case "today":
      return Date.UTC(year, month, dayOfMonth) - JAKARTA_OFFSET_MS;
    case "week": {
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      return Date.UTC(year, month, dayOfMonth - daysSinceMonday) - JAKARTA_OFFSET_MS;
    }
    case "month":
      return Date.UTC(year, month, 1) - JAKARTA_OFFSET_MS;
    case "last7":
      return nowMs - 7 * DAY_MS;
    case "last30":
      return nowMs - 30 * DAY_MS;
    default:
      return 0;
  }
}

function formatTimeSeriesBucket(clickedAt: number, period: StatsPeriod): string {
  const jakarta = new Date(clickedAt + JAKARTA_OFFSET_MS);
  const y = jakarta.getUTCFullYear();
  const m = pad2(jakarta.getUTCMonth() + 1);
  const d = pad2(jakarta.getUTCDate());
  if (period === "today") {
    const h = pad2(jakarta.getUTCHours());
    return `${y}-${m}-${d}T${h}:00:00+07:00`;
  }
  return `${y}-${m}-${d}`;
}

function mapClickRow(row: D1ShortLinkClickRow): ClickStreamEntry {
  return {
    id: row.id,
    linkId: row.link_id,
    hostname: normalizeHostname(row.hostname),
    path: row.path,
    clickedAt: row.clicked_at,
    country: row.country,
    city: row.city,
    browser: row.browser,
    os: row.os,
    device: row.device,
    referer: row.referer,
    isBot: row.is_bot === 1,
    variantLabel: row.variant_label,
    targetUrl: row.target_url,
  };
}

function aggregateBreakdowns(rows: D1ShortLinkClickRow[], period: StatsPeriod) {
  const seriesMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const cityMap = new Map<string, CityStat>();
  const browserMap = new Map<string, number>();
  const osMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();
  const refererMap = new Map<string, number>();

  for (const row of rows) {
    const bucket = formatTimeSeriesBucket(row.clicked_at, period);
    seriesMap.set(bucket, (seriesMap.get(bucket) ?? 0) + 1);

    const country = row.country?.trim() || "Unknown";
    countryMap.set(country, (countryMap.get(country) ?? 0) + 1);

    const cityName = row.city?.trim() || "Unknown";
    const cityCountry = row.country?.trim() || undefined;
    const cityKey = `${cityName}::${cityCountry ?? ""}`;
    const existingCity = cityMap.get(cityKey);
    if (existingCity) {
      existingCity.score += 1;
    } else {
      cityMap.set(cityKey, { city: cityName, country: cityCountry, score: 1 });
    }

    const browser = row.browser?.trim() || "Unknown";
    browserMap.set(browser, (browserMap.get(browser) ?? 0) + 1);

    const os = row.os?.trim() || "Unknown";
    osMap.set(os, (osMap.get(os) ?? 0) + 1);

    const device = row.device?.trim() || "Unknown";
    deviceMap.set(device, (deviceMap.get(device) ?? 0) + 1);

    const referer = row.referer?.trim() || "Direct";
    refererMap.set(referer, (refererMap.get(referer) ?? 0) + 1);
  }

  const series = Array.from(seriesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([x, count]) => ({ x, y: String(count) }));

  const sortDesc = <T extends { score: number }>(items: T[]) => items.sort((a, b) => b.score - a.score);

  return {
    clickStatistics: { datasets: [{ data: series }] },
    country: sortDesc(Array.from(countryMap.entries()).map(([country, score]) => ({ country, score }))),
    cities: sortDesc(Array.from(cityMap.values())),
    browser: sortDesc(Array.from(browserMap.entries()).map(([browser, score]) => ({ browser, score }))),
    os: sortDesc(Array.from(osMap.entries()).map(([os, score]) => ({ os, score }))),
    device: sortDesc(Array.from(deviceMap.entries()).map(([device, score]) => ({ device, score }))),
    referer: sortDesc(Array.from(refererMap.entries()).map(([referer, score]) => ({ referer, score }))),
  };
}

function buildSplitVariants(rows: D1ShortLinkClickRow[], configuredTargets: SplitTestTarget[]): SplitVariantStat[] {
  const map = new Map<string, { targetUrl?: string | null; clicks: number; humanClicks: number }>();

  for (const target of configuredTargets) {
    const label = target.label.trim();
    if (label && !map.has(label)) {
      map.set(label, { targetUrl: target.url, clicks: 0, humanClicks: 0 });
    }
  }

  let totalVariantClicks = 0;
  for (const row of rows) {
    const label = row.variant_label?.trim();
    if (!label) continue;
    totalVariantClicks += 1;
    const entry = map.get(label) ?? { targetUrl: row.target_url, clicks: 0, humanClicks: 0 };
    entry.clicks += 1;
    if (row.is_bot === 0) entry.humanClicks += 1;
    if (!entry.targetUrl && row.target_url) entry.targetUrl = row.target_url;
    map.set(label, entry);
  }

  return Array.from(map.entries())
    .map(([variantLabel, stat]) => ({
      variantLabel,
      targetUrl: stat.targetUrl ?? null,
      clicks: stat.clicks,
      humanClicks: stat.humanClicks,
      percentage: totalVariantClicks > 0 ? Math.round((stat.clicks / totalVariantClicks) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

/**
 * Queries per-link click analytics combining short_link_clicks with short_links.legacy_clicks.
 */
export async function queryLinkStatsD1(
  db: D1Database,
  linkId: string,
  period: StatsPeriod,
  nowMs = Date.now(),
): Promise<ExtendedClickStats> {
  const linkRow = await db
    .prepare("SELECT id, legacy_clicks, link_type, split_targets_json FROM short_links WHERE id = ? LIMIT 1")
    .bind(linkId.trim())
    .first<{ id: string; legacy_clicks: number; link_type: string; split_targets_json: string }>();

  if (!linkRow) {
    throw new ShortlinkNotFoundError("Short link not found.");
  }

  const cutoffMs = getPeriodStartMs(period, nowMs);
  const clicksRes = await db
    .prepare(
      `SELECT * FROM short_link_clicks
       WHERE link_id = ? AND clicked_at >= ?
       ORDER BY clicked_at DESC`,
    )
    .bind(linkRow.id, cutoffMs)
    .all<D1ShortLinkClickRow>();

  const rows = clicksRes.results ?? [];
  const d1Total = rows.length;
  const d1Human = rows.filter((r) => r.is_bot === 0).length;
  const legacyClicks = linkRow.legacy_clicks ?? 0;
  const legacyBonus = period === "total" ? legacyClicks : 0;

  const totalClicks = d1Total + legacyBonus;
  const humanClicks = d1Human + legacyBonus;
  const breakdowns = aggregateBreakdowns(rows, period);
  const splitTargets = parseJsonArray<SplitTestTarget>(linkRow.split_targets_json);
  const splitVariants = buildSplitVariants(rows, splitTargets);

  return {
    totalClicks,
    humanClicks,
    clicks: totalClicks,
    legacyClicks,
    ...breakdowns,
    clickstream: rows.slice(0, 50).map(mapClickRow),
    ...(splitVariants.length > 0 ? { splitVariants } : {}),
  };
}

/**
 * Queries domain-wide analytics combining short_link_clicks with summed legacy_clicks across links.
 */
export async function queryDomainStatsD1(
  db: D1Database,
  hostnameOrDomainId: string | number | undefined,
  period: StatsPeriod,
  nowMs = Date.now(),
): Promise<ClickStats> {
  let targetHostname: string | null = null;
  let targetDomainId: number | null = null;

  if (typeof hostnameOrDomainId === "number") {
    if (!Number.isFinite(hostnameOrDomainId)) {
      throw new ShortlinkNotFoundError("Domain not found.");
    }
    const dom = await db
      .prepare("SELECT id, hostname FROM short_domains WHERE id = ? LIMIT 1")
      .bind(hostnameOrDomainId)
      .first<{ id: number; hostname: string }>();
    if (!dom) {
      throw new ShortlinkNotFoundError(`Domain '${hostnameOrDomainId}' not found.`);
    }
    targetDomainId = dom.id;
    targetHostname = normalizeHostname(dom.hostname);
  } else if (typeof hostnameOrDomainId === "string" && hostnameOrDomainId.trim()) {
    targetHostname = normalizeHostname(hostnameOrDomainId);
    const dom = await db
      .prepare("SELECT id FROM short_domains WHERE hostname = ? LIMIT 1")
      .bind(targetHostname)
      .first<{ id: number }>();
    targetDomainId = dom?.id ?? null;
  }

  if (!targetHostname) {
    const primary = await getPrimaryDomainConfig();
    targetHostname = primary.domain;
    targetDomainId = primary.domainId;
  }

  const legacyRow =
    targetDomainId !== null
      ? await db
          .prepare(
            "SELECT COALESCE(SUM(legacy_clicks), 0) AS legacy_total FROM short_links WHERE domain_id = ? OR hostname = ?",
          )
          .bind(targetDomainId, targetHostname)
          .first<{ legacy_total: number }>()
      : await db
          .prepare("SELECT COALESCE(SUM(legacy_clicks), 0) AS legacy_total FROM short_links WHERE hostname = ?")
          .bind(targetHostname)
          .first<{ legacy_total: number }>();

  const cutoffMs = getPeriodStartMs(period, nowMs);
  const clicksRes = await db
    .prepare(
      `SELECT * FROM short_link_clicks
       WHERE hostname = ? AND clicked_at >= ?
       ORDER BY clicked_at DESC`,
    )
    .bind(targetHostname, cutoffMs)
    .all<D1ShortLinkClickRow>();

  const rows = clicksRes.results ?? [];
  const d1Total = rows.length;
  const d1Human = rows.filter((r) => r.is_bot === 0).length;
  const legacyClicks = Number(legacyRow?.legacy_total ?? 0);
  const legacyBonus = period === "total" ? legacyClicks : 0;

  const totalClicks = d1Total + legacyBonus;
  const humanClicks = d1Human + legacyBonus;

  return {
    totalClicks,
    humanClicks,
    clicks: totalClicks,
    legacyClicks,
    ...aggregateBreakdowns(rows, period),
    clickstream: rows.slice(0, 50).map(mapClickRow),
  };
}

/**
 * Queries real-time clickstream events ordered newest first.
 */
export async function queryClickstreamD1(
  db: D1Database,
  options?: { linkId?: string; hostname?: string; limit?: number },
): Promise<ClickStreamEntry[]> {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (options?.linkId?.trim()) {
    conditions.push("link_id = ?");
    params.push(options.linkId.trim());
  }
  if (options?.hostname?.trim()) {
    conditions.push("hostname = ?");
    params.push(normalizeHostname(options.hostname));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rawLimit =
    typeof options?.limit === "number" && Number.isFinite(options.limit) ? Math.trunc(options.limit) : 50;
  const limit = Math.min(200, Math.max(1, rawLimit));

  const res = await db
    .prepare(
      `SELECT * FROM short_link_clicks ${whereClause}
       ORDER BY clicked_at DESC
       LIMIT ?`,
    )
    .bind(...params, limit)
    .all<D1ShortLinkClickRow>();

  return (res.results ?? []).map(mapClickRow);
}

/**
 * Queries per-variant A/B split breakdown for a link.
 */
export async function querySplitTestStatsD1(
  db: D1Database,
  linkId: string,
  period: StatsPeriod,
  nowMs = Date.now(),
): Promise<SplitVariantStat[]> {
  const linkRow = await db
    .prepare("SELECT id, split_targets_json FROM short_links WHERE id = ? LIMIT 1")
    .bind(linkId.trim())
    .first<{ id: string; split_targets_json: string }>();

  if (!linkRow) {
    throw new ShortlinkNotFoundError("Short link not found.");
  }

  const cutoffMs = getPeriodStartMs(period, nowMs);
  const res = await db
    .prepare(
      `SELECT * FROM short_link_clicks
       WHERE link_id = ? AND clicked_at >= ? AND variant_label IS NOT NULL
       ORDER BY clicked_at DESC`,
    )
    .bind(linkRow.id, cutoffMs)
    .all<D1ShortLinkClickRow>();

  return buildSplitVariants(res.results ?? [], parseJsonArray<SplitTestTarget>(linkRow.split_targets_json));
}
