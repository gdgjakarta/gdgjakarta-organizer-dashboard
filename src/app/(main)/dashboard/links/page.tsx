import { redirect } from "next/navigation";

import type { Metadata } from "next";

import type { ShortDomain, ShortFolder, ShortLinkItem } from "@/lib/shortio/types";
import { getPrimaryDomainConfig, getShortlinkProvider } from "@/lib/shortlinks/env";
import {
  listShortDomainsViaProvider,
  listShortFoldersViaProvider,
  listShortLinksViaProvider,
} from "@/lib/shortlinks/provider";
import { isAuthorizedOrganizerSession } from "@/server/auth-guard";

import { Links } from "./_components/links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Short Links",
  description: "Manage, categorize, generate, edit, and delete shortened links for GDG Jakarta.",
};

export default async function LinksPage() {
  // Defense-in-depth: Strict Organizer-only guard
  const isOrganizer = await isAuthorizedOrganizerSession();
  if (!isOrganizer) {
    redirect("/dashboard/member");
  }

  const [provider, primaryConfig] = await Promise.all([getShortlinkProvider(), getPrimaryDomainConfig()]);

  let links: ShortLinkItem[] = [];
  let folders: ShortFolder[] = [];
  let domains: ShortDomain[] = [];
  let initialTotalCount = 0;
  let initialNextPageToken: string | undefined;

  try {
    const [linksRes, foldersRes, domainsRes] = await Promise.all([
      listShortLinksViaProvider({ limit: 150 }),
      listShortFoldersViaProvider(),
      listShortDomainsViaProvider().catch(() => [] as ShortDomain[]),
    ]);

    links = linksRes.links || [];
    initialTotalCount = linksRes.count ?? links.length;
    initialNextPageToken = linksRes.nextPageToken;
    folders = foldersRes || [];
    domains = domainsRes || [];
  } catch (err) {
    console.error("[Short Links Page] Error fetching initial data:", err);
  }

  return (
    <Links
      initialLinks={links}
      initialFolders={folders}
      initialDomains={domains}
      provider={provider}
      primaryDomain={primaryConfig.domain}
      primaryDomainId={primaryConfig.domainId}
      initialTotalCount={initialTotalCount}
      initialNextPageToken={initialNextPageToken}
    />
  );
}
