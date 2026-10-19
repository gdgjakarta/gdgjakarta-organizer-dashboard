import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { listAllShortLinks, listShortFolders } from "@/lib/shortio/client";
import type { ShortFolder, ShortLinkItem } from "@/lib/shortio/types";
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

  let links: ShortLinkItem[] = [];
  let folders: ShortFolder[] = [];

  try {
    const [linksRes, foldersRes] = await Promise.all([listAllShortLinks({ limit: 150 }), listShortFolders()]);

    links = linksRes.links || [];
    folders = foldersRes || [];
  } catch (err) {
    console.error("[Short.io Links Page] Error fetching initial data:", err);
  }

  return <Links initialLinks={links} initialFolders={folders} />;
}
