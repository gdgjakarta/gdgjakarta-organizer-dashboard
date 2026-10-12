import {
  createFolder,
  createLink,
  deleteLink,
  getLinkByOriginalUrl,
  listFolders,
  listLinks,
  setApiKey,
  updateLink,
} from "@short.io/client-node";

import { SHORTIO_CONFIG } from "@/config/shortio-config";

import type {
  CreateShortFolderInput,
  CreateShortLinkInput,
  EventShortLinksStatus,
  ShortFolder,
  ShortLinkItem,
  ShortLinkListResponse,
  UpdateShortLinkInput,
} from "./types";

let isApiKeyInitialized = false;

function ensureClientAuth() {
  if (!isApiKeyInitialized) {
    setApiKey(SHORTIO_CONFIG.apiKey);
    isApiKeyInitialized = true;
  }
}

/**
 * List all shortened links for the configured domain
 */
export async function listAllShortLinks(options?: {
  folderId?: string;
  limit?: number;
  pageToken?: string;
}): Promise<ShortLinkListResponse> {
  ensureClientAuth();
  try {
    const res = await listLinks({
      query: {
        domain_id: SHORTIO_CONFIG.domainId,
        limit: options?.limit ?? 150,
        folderId: options?.folderId ?? undefined,
        pageToken: options?.pageToken ?? undefined,
      },
    });

    if (res.error || !res.data) {
      console.error("[Short.io] listLinks error:", res.error);
      return { count: 0, links: [] };
    }

    const data = res.data as { count?: number; links?: ShortLinkItem[]; nextPageToken?: string };
    return {
      count: data.count ?? data.links?.length ?? 0,
      links: data.links ?? [],
      nextPageToken: data.nextPageToken,
    };
  } catch (error) {
    console.error("[Short.io] listAllShortLinks exception:", error);
    return { count: 0, links: [] };
  }
}

/**
 * List all folders for the configured domain
 */
export async function listShortFolders(): Promise<ShortFolder[]> {
  ensureClientAuth();
  try {
    const res = await listFolders({
      path: {
        domainId: SHORTIO_CONFIG.domainId,
      },
    });

    if (res.error || !res.data) {
      console.error("[Short.io] listFolders error:", res.error);
      return [];
    }

    const data = res.data as { linkFolders?: ShortFolder[] };
    return data.linkFolders ?? [];
  } catch (error) {
    console.error("[Short.io] listShortFolders exception:", error);
    return [];
  }
}

/**
 * Create a new folder on Short.io
 */
export async function createShortFolder(input: CreateShortFolderInput): Promise<ShortFolder | null> {
  ensureClientAuth();
  try {
    const res = await createFolder({
      body: {
        domainId: SHORTIO_CONFIG.domainId,
        name: input.name,
        color: input.color ?? "#0693E3",
      },
    });

    if (res.error || !res.data) {
      console.error("[Short.io] createFolder error:", res.error);
      return null;
    }

    return res.data as ShortFolder;
  } catch (error) {
    console.error("[Short.io] createShortFolder exception:", error);
    return null;
  }
}

/**
 * Create a shortened link on Short.io
 */
export async function createShortLink(input: CreateShortLinkInput): Promise<ShortLinkItem | null> {
  ensureClientAuth();
  try {
    const cleanPath = input.path?.trim() ? input.path.trim().replace(/^\//, "") : undefined;

    const res = await createLink({
      body: {
        domain: SHORTIO_CONFIG.domain,
        originalURL: input.originalURL.trim(),
        path: cleanPath,
        title: input.title?.trim() || undefined,
        folderId: input.folderId ?? undefined,
        tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
      },
    });

    if (res.error || !res.data) {
      console.error("[Short.io] createLink error:", res.error);
      const err = res.error as { message?: string; error?: string } | undefined;
      throw new Error(err?.message ?? err?.error ?? "Failed to create short link");
    }

    return res.data as ShortLinkItem;
  } catch (error) {
    console.error("[Short.io] createShortLink exception:", error);
    throw error;
  }
}

/**
 * Update an existing short link
 */
export async function updateShortLink(linkId: string, input: UpdateShortLinkInput): Promise<ShortLinkItem | null> {
  ensureClientAuth();
  try {
    const cleanPath = input.path?.trim() ? input.path.trim().replace(/^\//, "") : undefined;

    const body: Record<string, unknown> = {};
    if (input.originalURL) body.originalURL = input.originalURL.trim();
    if (cleanPath !== undefined) body.path = cleanPath;
    if (input.title !== undefined) body.title = input.title;
    if (input.tags !== undefined) body.tags = input.tags;
    if (input.folderId !== undefined) body.folderId = input.folderId;

    const res = await updateLink({
      path: {
        linkId,
      },
      body,
    });

    if (res.error || !res.data) {
      console.error("[Short.io] updateLink error:", res.error);
      const err = res.error as { message?: string; error?: string } | undefined;
      throw new Error(err?.message ?? err?.error ?? "Failed to update short link");
    }

    return res.data as ShortLinkItem;
  } catch (error) {
    console.error("[Short.io] updateShortLink exception:", error);
    throw error;
  }
}

/**
 * Delete a short link by link ID
 */
export async function deleteShortLink(linkId: string): Promise<boolean> {
  ensureClientAuth();
  try {
    const res = await deleteLink({
      path: {
        link_id: linkId,
      },
    });

    if (res.error) {
      console.error("[Short.io] deleteLink error:", res.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Short.io] deleteShortLink exception:", error);
    return false;
  }
}

/**
 * Find short link by destination original URL
 */
export async function findShortLinkByOriginalUrl(originalURL: string): Promise<ShortLinkItem | null> {
  ensureClientAuth();
  try {
    const trimmed = originalURL.trim();
    if (!trimmed) return null;

    const res = await getLinkByOriginalUrl({
      query: {
        domain: SHORTIO_CONFIG.domain,
        originalURL: trimmed,
      },
    });

    if (res.error || !res.data) {
      return null;
    }

    return res.data as ShortLinkItem;
  } catch {
    return null;
  }
}

/**
 * Get short links for an event (Live Page and Bevy Page)
 */
export async function getEventShortLinks(params: {
  liveUrl?: string;
  bevyUrl?: string;
}): Promise<EventShortLinksStatus> {
  ensureClientAuth();
  const [liveShortLink, bevyShortLink] = await Promise.all([
    params.liveUrl ? findShortLinkByOriginalUrl(params.liveUrl) : Promise.resolve(null),
    params.bevyUrl ? findShortLinkByOriginalUrl(params.bevyUrl) : Promise.resolve(null),
  ]);

  return {
    liveShortLink,
    bevyShortLink,
  };
}
