"use server";

import { revalidatePath } from "next/cache";

import type { BulkImportRow, ClickStats, ClickStreamEntry, ShortDomain, StatsPeriod } from "@/lib/shortio/types";
import type { ExtendedClickStats, SplitVariantStat } from "@/lib/shortlinks/analytics";
import { getPrimaryDomainConfig } from "@/lib/shortlinks/env";
import {
  archiveShortLinksViaProvider,
  bulkImportShortLinksViaProvider,
  createShortDomainViaProvider,
  deleteShortDomainViaProvider,
  getClickstreamViaProvider,
  getDomainStatsViaProvider,
  getLinkStatsViaProvider,
  getSplitTestStatsViaProvider,
  listShortDomainsViaProvider,
  unarchiveShortLinksViaProvider,
  updateShortDomainConfigViaProvider,
} from "@/lib/shortlinks/provider";

import { isAuthorizedExecutiveOrganizerSession, isAuthorizedOrganizerSession } from "./auth-guard";

type Result<T = undefined> = { success: boolean; data?: T; error?: string };

const PERIODS = new Set<StatsPeriod>(["today", "week", "month", "last7", "last30", "total"]);
const DENIED = "Unauthorized: Organizer privileges required";
const EXEC_DENIED = "Unauthorized: Executive organizer privileges required";

async function guard<T>(allowed: () => Promise<boolean>, fn: () => Promise<T>, denied = DENIED): Promise<Result<T>> {
  if (!(await allowed())) return { success: false, error: denied };
  try {
    return { success: true, data: await fn() };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Shortlink request failed" };
  }
}

export async function getLinkStatsAction(linkId: string, period: StatsPeriod): Promise<Result<ExtendedClickStats>> {
  if (!PERIODS.has(period) || !/^lnk_|^link_/.test(linkId)) return { success: false, error: "Invalid request" };
  return guard(isAuthorizedOrganizerSession, () => getLinkStatsViaProvider(linkId, period));
}

export async function getDomainStatsAction(period: StatsPeriod): Promise<Result<ClickStats>> {
  if (!PERIODS.has(period)) return { success: false, error: "Invalid period" };
  return guard(isAuthorizedOrganizerSession, () => getDomainStatsViaProvider(period));
}

export async function getLinkClickstreamAction(
  linkId: string,
  options?: { limit?: number },
): Promise<Result<ClickStreamEntry[]>> {
  if (!/^lnk_|^link_/.test(linkId)) return { success: false, error: "Invalid request" };
  return guard(isAuthorizedOrganizerSession, () => getClickstreamViaProvider({ linkId, limit: options?.limit }));
}

export async function getDomainClickstreamAction(options?: {
  limit?: number;
  hostname?: string;
}): Promise<Result<ClickStreamEntry[]>> {
  return guard(isAuthorizedOrganizerSession, () => getClickstreamViaProvider(options));
}

export async function getSplitTestStatsAction(
  linkId: string,
  period: StatsPeriod,
): Promise<Result<SplitVariantStat[]>> {
  if (!PERIODS.has(period) || !/^lnk_|^link_/.test(linkId)) return { success: false, error: "Invalid request" };
  return guard(isAuthorizedOrganizerSession, () => getSplitTestStatsViaProvider(linkId, period));
}

export async function archiveShortLinksAction(linkIds: string[]): Promise<Result> {
  if (linkIds.length === 0 || linkIds.length > 1000) return { success: false, error: "Select 1-1000 links" };
  const res = await guard(isAuthorizedOrganizerSession, () => archiveShortLinksViaProvider(linkIds));
  if (res.success) revalidatePath("/dashboard/links");
  return { success: res.success, error: res.error };
}

export async function unarchiveShortLinksAction(linkIds: string[]): Promise<Result> {
  if (linkIds.length === 0 || linkIds.length > 1000) return { success: false, error: "Select 1-1000 links" };
  const res = await guard(isAuthorizedOrganizerSession, () => unarchiveShortLinksViaProvider(linkIds));
  if (res.success) revalidatePath("/dashboard/links");
  return { success: res.success, error: res.error };
}

export async function bulkImportShortLinksAction(
  rows: BulkImportRow[],
): Promise<Result<{ originalURL: string; ok: boolean; error?: string }[]>> {
  if (rows.length === 0 || rows.length > 1000) return { success: false, error: "Import 1-1000 rows" };
  const bad = rows.find((r) => !/^https?:\/\//i.test(r.originalURL ?? ""));
  if (bad) return { success: false, error: `Invalid URL: ${bad.originalURL}` };
  const res = await guard(isAuthorizedOrganizerSession, () => bulkImportShortLinksViaProvider(rows));
  if (res.success) revalidatePath("/dashboard/links");
  return res;
}

export async function listShortDomainsAction(): Promise<Result<ShortDomain[]>> {
  return guard(isAuthorizedOrganizerSession, listShortDomainsViaProvider);
}

export async function createShortDomainAction(hostname: string): Promise<Result<ShortDomain>> {
  const host = hostname.trim().toLowerCase();
  if (!/^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return { success: false, error: "Invalid hostname" };
  const res = await guard(isAuthorizedExecutiveOrganizerSession, () => createShortDomainViaProvider(host), EXEC_DENIED);
  if (res.success) revalidatePath("/dashboard/links");
  return res;
}

function isValidOptionalJson(value: string | null | undefined): boolean {
  if (value === undefined || value === null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export async function updateShortDomainConfigAction(
  domainId: number,
  input: {
    appleAppSiteAssociation?: string | null;
    assetLinks?: string | null;
    linkType?: string;
    state?: string;
  },
): Promise<Result<ShortDomain>> {
  if (!Number.isInteger(domainId) || domainId <= 0) {
    return { success: false, error: "Invalid domainId" };
  }
  if (!isValidOptionalJson(input.appleAppSiteAssociation)) {
    return { success: false, error: "appleAppSiteAssociation must be valid JSON" };
  }
  if (!isValidOptionalJson(input.assetLinks)) {
    return { success: false, error: "assetLinks must be valid JSON" };
  }
  const res = await guard(
    isAuthorizedExecutiveOrganizerSession,
    () => updateShortDomainConfigViaProvider(domainId, input),
    EXEC_DENIED,
  );
  if (res.success) revalidatePath("/dashboard/links");
  return res;
}

export async function deleteShortDomainAction(domainId: number): Promise<Result> {
  const res = await guard(
    isAuthorizedExecutiveOrganizerSession,
    async () => {
      const primary = await getPrimaryDomainConfig();
      if (domainId === primary.domainId) {
        throw new Error("The primary domain used by this dashboard cannot be removed here");
      }
      return deleteShortDomainViaProvider(domainId);
    },
    EXEC_DENIED,
  );
  if (res.success) revalidatePath("/dashboard/links");
  return { success: res.success, error: res.error };
}
