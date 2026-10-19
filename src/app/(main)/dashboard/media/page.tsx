import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { listDirectoryContent } from "@/lib/r2/client";
import type { R2DirectoryContent } from "@/lib/r2/types";
import { isAuthorizedExecutiveOrganizerSession } from "@/server/auth-guard";

import { MediaView } from "./_components/media-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bucket Storage",
  description: "Manage Cloudflare R2 storage bucket, organize directories, upload assets, and distribute media links.",
};

export default async function MediaPage() {
  // Defense-in-depth: Strict Executive Organizer guard
  // Team members, check-in staff, core team, and members cannot access or view Bucket Storage
  const isOrganizer = await isAuthorizedExecutiveOrganizerSession();

  if (!isOrganizer) {
    redirect("/dashboard/member");
  }

  let initialContent: R2DirectoryContent = {
    currentPrefix: "",
    folders: [],
    items: [],
    totalFolders: 0,
    totalItems: 0,
    hasMore: false,
  };

  try {
    initialContent = await listDirectoryContent("");
  } catch (err) {
    console.error("[Cloudflare R2 Media Page] Error preloading initial directory content:", err);
  }

  return <MediaView initialContent={initialContent} />;
}
