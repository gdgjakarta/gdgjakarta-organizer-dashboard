import { SHORTIO_CONFIG } from "@/config/shortio-config";

import type { BulkImportRow, ClickStats, ShortDomain, StatsPeriod } from "./types";

const API = SHORTIO_CONFIG.apiBaseUrl;
const STATS_API = "https://statistics.short.io";

async function shortFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: SHORTIO_CONFIG.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new Error(data.error ?? data.message ?? `Short.io request failed (${res.status})`);
  return data;
}

const statsQuery = (period: StatsPeriod) => `period=${period}&tz=${encodeURIComponent("Asia/Jakarta")}`;

export const getLinkStats = (linkId: string, period: StatsPeriod) =>
  shortFetch<ClickStats>(`${STATS_API}/statistics/link/${encodeURIComponent(linkId)}?${statsQuery(period)}`);

export const getDomainStats = (period: StatsPeriod) =>
  shortFetch<ClickStats>(`${STATS_API}/statistics/domain/${SHORTIO_CONFIG.domainId}?${statsQuery(period)}`);

export const archiveShortLink = (linkId: string) =>
  shortFetch(`${API}/links/archive`, { method: "POST", body: JSON.stringify({ link_id: linkId }) });

export const bulkArchiveShortLinks = (linkIds: string[]) =>
  shortFetch(`${API}/links/archive_bulk`, { method: "POST", body: JSON.stringify({ link_ids: linkIds }) });

export async function bulkCreateShortLinks(rows: BulkImportRow[]) {
  const results: { originalURL: string; ok: boolean; error?: string }[] = [];
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const data = await shortFetch<Record<string, unknown>[]>(`${API}/links/bulk`, {
      method: "POST",
      body: JSON.stringify({ domain: SHORTIO_CONFIG.domain, allowDuplicates: false, links: chunk }),
    });
    chunk.forEach((row, idx) => {
      const r = data[idx] ?? {};
      const err = (r.error ?? r.message) as string | undefined;
      results.push({ originalURL: row.originalURL, ok: !err && Boolean(r.idString ?? r.id), error: err });
    });
  }
  return results;
}

export const listShortDomains = () => shortFetch<ShortDomain[]>(`${API}/api/domains?limit=100`);

export const createShortDomain = (hostname: string) =>
  shortFetch<ShortDomain>(`${API}/domains`, { method: "POST", body: JSON.stringify({ hostname }) });

export const deleteShortDomain = (domainId: number) => shortFetch(`${API}/domains/${domainId}`, { method: "DELETE" });
