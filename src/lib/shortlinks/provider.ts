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
import {
  createShortFolder,
  createShortLink,
  deleteShortLink,
  findShortLinkByOriginalUrl,
  getEventShortLinks,
  getShortLinkByPath,
  listAllShortLinks,
  listShortFolders,
  updateShortLink,
} from "@/lib/shortio/client";
import type {
  BulkImportRow,
  ClickStats,
  CreateShortFolderInput,
  CreateShortLinkInput,
  EventShortLinksStatus,
  ShortDomain,
  ShortFolder,
  ShortLinkItem,
  ShortLinkListResponse,
  StatsPeriod,
  UpdateShortLinkInput,
} from "@/lib/shortio/types";

import {
  type ExtendedClickStats,
  queryClickstreamD1,
  queryDomainStatsD1,
  queryLinkStatsD1,
  querySplitTestStatsD1,
  type SplitVariantStat,
} from "./analytics";
import {
  archiveLinksD1,
  bulkCreateLinksD1,
  bulkDeleteLinksD1,
  bulkMoveLinksD1,
  createDomainD1,
  createFolderD1,
  createLinkD1,
  deleteDomainD1,
  deleteFolderD1,
  deleteLinkD1,
  findLinkByOriginalUrlD1,
  getLinkByIdD1,
  getLinkByPathD1,
  type ListLinksD1Options,
  listDomainsD1,
  listFoldersD1,
  listLinksD1,
  ShortlinkValidationError,
  updateDomainConfigD1,
  updateFolderD1,
  updateLinkD1,
} from "./d1-store";
import { getShortlinkBindings, getShortlinkProvider } from "./env";
import type { ClickStreamEntry } from "./types";

export async function listShortLinksViaProvider(options?: ListLinksD1Options): Promise<ShortLinkListResponse> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return listLinksD1(db, kv, options);
  }
  return listAllShortLinks({
    folderId: options?.folderId,
    limit: options?.limit,
    pageToken: options?.pageToken,
  });
}

export async function listShortFoldersViaProvider(): Promise<ShortFolder[]> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return listFoldersD1(db, kv);
  }
  return listShortFolders();
}

export async function createShortFolderViaProvider(
  input: CreateShortFolderInput & { icon?: string },
): Promise<ShortFolder | null> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return createFolderD1(db, kv, input);
  }
  return createShortFolder(input);
}

export async function updateShortFolderViaProvider(
  folderId: string,
  input: { name?: string; color?: string; icon?: string | null },
): Promise<ShortFolder> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db } = await getShortlinkBindings();
    return updateFolderD1(db, folderId, input);
  }
  throw new ShortlinkValidationError("Folder editing is only supported when SHORTLINK_PROVIDER=cloudflare.");
}

export async function deleteShortFolderViaProvider(folderId: string): Promise<boolean> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return deleteFolderD1(db, kv, folderId);
  }
  throw new ShortlinkValidationError("Folder deletion is only supported when SHORTLINK_PROVIDER=cloudflare.");
}

export async function createShortLinkViaProvider(
  input: CreateShortLinkInput & { ownerId?: number; ownerEmail?: string },
): Promise<ShortLinkItem | null> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return createLinkD1(db, kv, input);
  }
  return createShortLink(input);
}

export async function updateShortLinkViaProvider(
  linkId: string,
  input: UpdateShortLinkInput,
): Promise<ShortLinkItem | null> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return updateLinkD1(db, kv, linkId, input);
  }
  return updateShortLink(linkId, input);
}

export async function deleteShortLinkViaProvider(linkId: string): Promise<boolean> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return deleteLinkD1(db, kv, linkId);
  }
  return deleteShortLink(linkId);
}

export async function getShortLinkByIdViaProvider(linkId: string): Promise<ShortLinkItem | null> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db } = await getShortlinkBindings();
    return getLinkByIdD1(db, linkId);
  }
  const all = await listAllShortLinks({ limit: 150 });
  return all.links.find((l) => l.id === linkId || l.idString === linkId) ?? null;
}

export async function getShortLinkByPathViaProvider(path: string, hostname?: string): Promise<ShortLinkItem | null> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db } = await getShortlinkBindings();
    return getLinkByPathD1(db, path, hostname);
  }
  return getShortLinkByPath(path);
}

export async function findShortLinkByOriginalUrlViaProvider(
  originalURL: string,
  hostname?: string,
): Promise<ShortLinkItem | null> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db } = await getShortlinkBindings();
    return findLinkByOriginalUrlD1(db, originalURL, hostname);
  }
  return findShortLinkByOriginalUrl(originalURL);
}

export async function getEventShortLinksViaProvider(params: {
  liveUrl?: string;
  bevyUrl?: string;
}): Promise<EventShortLinksStatus> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db } = await getShortlinkBindings();
    const [liveShortLink, bevyShortLink] = await Promise.all([
      params.liveUrl ? findLinkByOriginalUrlD1(db, params.liveUrl) : Promise.resolve(null),
      params.bevyUrl ? findLinkByOriginalUrlD1(db, params.bevyUrl) : Promise.resolve(null),
    ]);
    return { liveShortLink, bevyShortLink };
  }
  return getEventShortLinks(params);
}

export async function bulkMoveLinksViaProvider(
  linkIds: string[],
  folderId: string | null,
): Promise<{ updatedLinks: ShortLinkItem[]; failures: number }> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    const updatedLinks = await bulkMoveLinksD1(db, kv, linkIds, folderId);
    return { updatedLinks, failures: Math.max(0, linkIds.length - updatedLinks.length) };
  }

  const results = await Promise.allSettled(linkIds.map((id) => updateShortLink(id, { folderId })));
  const updatedLinks: ShortLinkItem[] = [];
  let failures = 0;
  for (const res of results) {
    if (res.status === "fulfilled" && res.value) {
      updatedLinks.push(res.value);
    } else {
      failures++;
    }
  }
  return { updatedLinks, failures };
}

export async function bulkDeleteLinksViaProvider(
  linkIds: string[],
): Promise<{ deletedIds: string[]; failures: number }> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    const { deletedIds } = await bulkDeleteLinksD1(db, kv, linkIds);
    return { deletedIds, failures: Math.max(0, linkIds.length - deletedIds.length) };
  }

  const results = await Promise.allSettled(
    linkIds.map(async (id) => {
      const ok = await deleteShortLink(id);
      if (!ok) {
        throw new Error(`Failed to delete link ${id}`);
      }
      return id;
    }),
  );
  const deletedIds: string[] = [];
  let failures = 0;
  for (const res of results) {
    if (res.status === "fulfilled" && res.value) {
      deletedIds.push(res.value);
    } else {
      failures++;
    }
  }
  return { deletedIds, failures };
}

export async function getLinkStatsViaProvider(linkId: string, period: StatsPeriod): Promise<ExtendedClickStats> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db } = await getShortlinkBindings();
    return queryLinkStatsD1(db, linkId, period);
  }
  return getLinkStats(linkId, period);
}

export async function getDomainStatsViaProvider(
  period: StatsPeriod,
  hostnameOrDomainId?: string | number,
): Promise<ClickStats> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db } = await getShortlinkBindings();
    return queryDomainStatsD1(db, hostnameOrDomainId, period);
  }
  return getDomainStats(period);
}

export async function getClickstreamViaProvider(options?: {
  linkId?: string;
  hostname?: string;
  limit?: number;
}): Promise<ClickStreamEntry[]> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db } = await getShortlinkBindings();
    return queryClickstreamD1(db, options);
  }
  return [];
}

export async function getSplitTestStatsViaProvider(linkId: string, period: StatsPeriod): Promise<SplitVariantStat[]> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db } = await getShortlinkBindings();
    return querySplitTestStatsD1(db, linkId, period);
  }
  return [];
}

export async function archiveShortLinksViaProvider(linkIds: string[]): Promise<unknown> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return archiveLinksD1(db, kv, linkIds, true);
  }
  return linkIds.length === 1 ? archiveShortLink(linkIds[0]) : bulkArchiveShortLinks(linkIds);
}

export async function unarchiveShortLinksViaProvider(linkIds: string[]): Promise<{ updatedCount: number }> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return archiveLinksD1(db, kv, linkIds, false);
  }
  throw new ShortlinkValidationError("Unarchiving links is only supported when SHORTLINK_PROVIDER=cloudflare.");
}

export async function bulkImportShortLinksViaProvider(
  rows: BulkImportRow[],
): Promise<{ originalURL: string; ok: boolean; error?: string }[]> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return bulkCreateLinksD1(db, kv, rows);
  }
  return bulkCreateShortLinks(rows);
}

export async function listShortDomainsViaProvider(): Promise<ShortDomain[]> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return listDomainsD1(db, kv);
  }
  const domains = await listShortDomains();
  return domains.map((d) => ({ ...d, provider: "shortio" }));
}

export async function createShortDomainViaProvider(hostname: string): Promise<ShortDomain> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return createDomainD1(db, kv, hostname);
  }
  const created = await createShortDomain(hostname);
  return { ...created, provider: "shortio" };
}

export async function updateShortDomainConfigViaProvider(
  domainId: number,
  input: {
    appleAppSiteAssociation?: string | null;
    assetLinks?: string | null;
    linkType?: string;
    state?: string;
  },
): Promise<ShortDomain> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return updateDomainConfigD1(db, kv, domainId, input);
  }
  throw new ShortlinkValidationError(
    "Domain deep-linking configuration is only supported when SHORTLINK_PROVIDER=cloudflare.",
  );
}

export async function deleteShortDomainViaProvider(domainId: number): Promise<unknown> {
  const provider = await getShortlinkProvider();
  if (provider === "cloudflare") {
    const { db, kv } = await getShortlinkBindings();
    return deleteDomainD1(db, kv, domainId);
  }
  return deleteShortDomain(domainId);
}
