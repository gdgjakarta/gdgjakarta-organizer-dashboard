"use server";

import { revalidatePath } from "next/cache";

import { SHORTIO_CONFIG } from "@/config/shortio-config";
import {
  archiveShortLink,
  bulkArchiveShortLinks,
  bulkCreateShortLinks,
  createShortDomain,
  deleteShortDomain,
  getDomainStats,
  getLinkStats,
  listShortDomains,
} from "@/lib/shortio/advanced";
import type { BulkImportRow, ClickStats, ShortDomain, StatsPeriod } from "@/lib/shortio/types";

import { isAuthorizedExecutiveOrganizerSession, isAuthorizedOrganizerSession } from "./auth-guard";

type Result<T = undefined> = { success: boolean; data?: T; error?: string };

const PERIODS = new Set<StatsPeriod>(["today", "week", "month", "last7", "last30", "total"]);
const DENIED = "Unauthorized: Organizer privileges required";

async function guard<T>(allowed: () => Promise<boolean>, fn: () => Promise<T>, denied = DENIED): Promise<Result<T>> {
  if (!(await allowed())) return { success: false, error: denied };
  try {
    return { success: true, data: await fn() };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Short.io request failed" };
  }
}

export async function getLinkStatsAction(linkId: string, period: StatsPeriod): Promise<Result<ClickStats>> {
  if (!PERIODS.has(period) || !/^lnk_|^link_/.test(linkId)) return { success: false, error: "Invalid request" };
  return guard(isAuthorizedOrganizerSession, () => getLinkStats(linkId, period));
}

export async function getDomainStatsAction(period: StatsPeriod): Promise<Result<ClickStats>> {
  if (!PERIODS.has(period)) return { success: false, error: "Invalid period" };
  return guard(isAuthorizedOrganizerSession, () => getDomainStats(period));
}

export async function archiveShortLinksAction(linkIds: string[]): Promise<Result> {
  if (linkIds.length === 0 || linkIds.length > 1000) return { success: false, error: "Select 1-1000 links" };
  const res = await guard(isAuthorizedOrganizerSession, () =>
    linkIds.length === 1 ? archiveShortLink(linkIds[0]) : bulkArchiveShortLinks(linkIds),
  );
  if (res.success) revalidatePath("/dashboard/links");
  return { success: res.success, error: res.error };
}

export async function bulkImportShortLinksAction(
  rows: BulkImportRow[],
): Promise<Result<{ originalURL: string; ok: boolean; error?: string }[]>> {
  if (rows.length === 0 || rows.length > 1000) return { success: false, error: "Import 1-1000 rows" };
  const bad = rows.find((r) => !/^https?:\/\//i.test(r.originalURL ?? ""));
  if (bad) return { success: false, error: `Invalid URL: ${bad.originalURL}` };
  const res = await guard(isAuthorizedOrganizerSession, () => bulkCreateShortLinks(rows));
  if (res.success) revalidatePath("/dashboard/links");
  return res;
}

export async function listShortDomainsAction(): Promise<Result<ShortDomain[]>> {
  return guard(isAuthorizedOrganizerSession, listShortDomains);
}

export async function createShortDomainAction(hostname: string): Promise<Result<ShortDomain>> {
  const host = hostname.trim().toLowerCase();
  if (!/^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return { success: false, error: "Invalid hostname" };
  return guard(
    isAuthorizedExecutiveOrganizerSession,
    () => createShortDomain(host),
    "Unauthorized: Executive organizer privileges required",
  );
}

export async function deleteShortDomainAction(domainId: number): Promise<Result> {
  if (domainId === SHORTIO_CONFIG.domainId) {
    return { success: false, error: "The primary domain used by this dashboard cannot be removed here" };
  }
  const res = await guard(
    isAuthorizedExecutiveOrganizerSession,
    () => deleteShortDomain(domainId),
    "Unauthorized: Executive organizer privileges required",
  );
  return { success: res.success, error: res.error };
}
