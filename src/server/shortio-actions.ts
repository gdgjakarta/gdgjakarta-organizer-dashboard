"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  createShortFolder,
  createShortLink,
  deleteShortLink,
  getEventShortLinks,
  listAllShortLinks,
  listShortFolders,
  updateShortLink,
} from "@/lib/shortio/client";
import type {
  CreateShortFolderInput,
  CreateShortLinkInput,
  EventShortLinksStatus,
  ShortFolder,
  ShortLinkItem,
  UpdateShortLinkInput,
} from "@/lib/shortio/types";

/**
 * Verifies that the caller has an active, authenticated organizer session.
 * RBAC Guard: Organizers, Core Team, and Googlers only.
 */
async function isAuthorizedOrganizerSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const role = cookieStore.get("auth_role")?.value;
    return Boolean(token) && (role === "organizer" || role === "core_team" || role === "googler");
  } catch {
    return false;
  }
}

export async function fetchShortLinksAction(options?: {
  folderId?: string;
  limit?: number;
}): Promise<{ success: boolean; data?: ShortLinkItem[]; count?: number; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const res = await listAllShortLinks(options);
    return { success: true, data: res.links, count: res.count };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch short links";
    return { success: false, error: message };
  }
}

export async function fetchShortFoldersAction(): Promise<{
  success: boolean;
  data?: ShortFolder[];
  error?: string;
}> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const folders = await listShortFolders();
    return { success: true, data: folders };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch folders";
    return { success: false, error: message };
  }
}

export async function createShortFolderAction(
  input: CreateShortFolderInput,
): Promise<{ success: boolean; data?: ShortFolder; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const folder = await createShortFolder(input);
    if (!folder) {
      return { success: false, error: "Failed to create folder on Short.io" };
    }
    revalidatePath("/dashboard/links");
    return { success: true, data: folder };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create folder";
    return { success: false, error: message };
  }
}

export async function createShortLinkAction(
  input: CreateShortLinkInput,
): Promise<{ success: boolean; data?: ShortLinkItem; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const link = await createShortLink(input);
    if (!link) {
      return { success: false, error: "Failed to create link on Short.io" };
    }
    revalidatePath("/dashboard/links");
    return { success: true, data: link };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create short link";
    return { success: false, error: message };
  }
}

export async function updateShortLinkAction(
  linkId: string,
  input: UpdateShortLinkInput,
): Promise<{ success: boolean; data?: ShortLinkItem; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const link = await updateShortLink(linkId, input);
    if (!link) {
      return { success: false, error: "Failed to update link on Short.io" };
    }
    revalidatePath("/dashboard/links");
    return { success: true, data: link };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update short link";
    return { success: false, error: message };
  }
}

export async function moveLinkToFolderAction(
  linkId: string,
  folderId: string | null,
): Promise<{ success: boolean; data?: ShortLinkItem; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const link = await updateShortLink(linkId, { folderId });
    if (!link) {
      return { success: false, error: "Failed to move link to folder" };
    }
    revalidatePath("/dashboard/links");
    return { success: true, data: link };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to move link to folder";
    return { success: false, error: message };
  }
}

export async function deleteShortLinkAction(linkId: string): Promise<{ success: boolean; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const success = await deleteShortLink(linkId);
    if (!success) {
      return { success: false, error: "Failed to delete short link on Short.io" };
    }
    revalidatePath("/dashboard/links");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete short link";
    return { success: false, error: message };
  }
}

export async function getEventShortLinksAction(params: {
  liveUrl?: string;
  bevyUrl?: string;
}): Promise<{ success: boolean; data?: EventShortLinksStatus; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const status = await getEventShortLinks(params);
    return { success: true, data: status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to check event short links";
    return { success: false, error: message };
  }
}

/**
 * Helper to automatically deduce the most fitting folder based on event title and tags
 */
function resolveFolderForEvent(title: string, tags: string[] = [], folders: ShortFolder[] = []): string | undefined {
  const combined = `${title} ${tags.join(" ")}`.toLowerCase();

  const devfestFolder = folders.find((f) => f.name.toLowerCase().includes("devfest"));
  if (combined.includes("devfest") && devfestFolder) return devfestFolder.id;

  const bwaiFolder = folders.find((f) => f.name.toLowerCase().includes("bwai"));
  if ((combined.includes("bwai") || combined.includes("build with ai")) && bwaiFolder) return bwaiFolder.id;

  const ioFolder = folders.find((f) => f.name.toLowerCase().includes("i/o") || f.name.toLowerCase().includes("io"));
  if ((combined.includes("i/o") || combined.includes("extended")) && ioFolder) return ioFolder.id;

  const hackathonFolder = folders.find((f) => f.name.toLowerCase().includes("hackathon"));
  if (combined.includes("hackathon") && hackathonFolder) return hackathonFolder.id;

  const iwdFolder = folders.find((f) => f.name.toLowerCase().includes("iwd"));
  if ((combined.includes("iwd") || combined.includes("women")) && iwdFolder) return iwdFolder.id;

  const gdgFolder = folders.find((f) => f.name.toLowerCase() === "gdg");
  if (gdgFolder) return gdgFolder.id;

  return undefined;
}

export async function generateEventShortLinkAction(params: {
  eventId: string;
  type: "live" | "bevy";
  originalURL: string;
  title: string;
  customSlug?: string;
  folderId?: string;
  tags?: string[];
}): Promise<{ success: boolean; data?: ShortLinkItem; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    let resolvedFolderId = params.folderId;
    if (!resolvedFolderId) {
      const folders = await listShortFolders();
      resolvedFolderId = resolveFolderForEvent(params.title, params.tags, folders);
    }

    const linkTitle = params.type === "live" ? `${params.title} (Live Page)` : `${params.title} (Bevy Page)`;

    const defaultTags = ["Event", ...(params.tags ?? [])];

    const link = await createShortLink({
      originalURL: params.originalURL,
      path: params.customSlug,
      title: linkTitle,
      folderId: resolvedFolderId,
      tags: defaultTags,
    });

    if (!link) {
      return { success: false, error: "Failed to generate event short link" };
    }

    revalidatePath("/dashboard/links");
    revalidatePath(`/dashboard/events/${params.eventId}`);
    revalidatePath("/dashboard/events");

    return { success: true, data: link };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate event short link";
    return { success: false, error: message };
  }
}
