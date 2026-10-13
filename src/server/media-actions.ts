"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  bulkDeleteMediaObjects,
  createFolderMarker,
  deleteFolderRecursive,
  deleteMediaObject,
  listDirectoryContent,
  renameOrMoveObject,
  updateMediaMetadata,
} from "@/lib/r2/client";
import type { FolderItem, MediaItem, R2DirectoryContent } from "@/lib/r2/types";
import { buildStorageKey, normalizePrefix, sanitizeStorageName, splitStorageKey } from "@/lib/r2/utils";

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

/**
 * Fetches the directory content for a given prefix.
 */
export async function fetchMediaDirectoryAction(
  prefix = "",
): Promise<{ success: boolean; data?: R2DirectoryContent; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const data = await listDirectoryContent(prefix);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat konten direktori dari R2";
    return { success: false, error: message };
  }
}

/**
 * Creates a new folder under the parent prefix.
 * Enforces lowercase and hyphenated name formatting.
 */
export async function createMediaFolderAction(
  parentPrefix: string,
  rawFolderName: string,
): Promise<{ success: boolean; folder?: FolderItem; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  const cleanName = sanitizeStorageName(rawFolderName, true);
  if (!cleanName) {
    return { success: false, error: "Nama folder tidak boleh kosong dan harus menggunakan karakter valid" };
  }

  try {
    const result = await createFolderMarker(parentPrefix, cleanName);
    if (!result.success) {
      return { success: false, error: result.error ?? "Gagal membuat folder di Cloudflare R2" };
    }

    revalidatePath("/dashboard/media");
    return { success: true, folder: result.folder };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal membuat folder";
    return { success: false, error: message };
  }
}

/**
 * Renames a media file or folder.
 * Enforces lowercase and hyphenated naming.
 */
export async function renameMediaObjectAction(
  oldKey: string,
  rawNewName: string,
): Promise<{ success: boolean; item?: MediaItem; newKey?: string; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  const { folder, isFolder } = splitStorageKey(oldKey);
  const cleanName = sanitizeStorageName(rawNewName, isFolder);

  if (!cleanName) {
    return { success: false, error: "Nama baru tidak valid" };
  }

  const newKey = buildStorageKey(folder, cleanName, isFolder);

  try {
    const result = await renameOrMoveObject(oldKey, newKey);
    if (!result.success) {
      return { success: false, error: result.error ?? "Gagal mengubah nama file" };
    }

    revalidatePath("/dashboard/media");
    return { success: true, item: result.item, newKey: result.newKey };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengubah nama";
    return { success: false, error: message };
  }
}

/**
 * Moves a media file to a target directory prefix.
 */
export async function moveMediaObjectAction(
  sourceKey: string,
  destPrefix: string,
): Promise<{ success: boolean; item?: MediaItem; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  const { name, isFolder } = splitStorageKey(sourceKey);
  const normDest = normalizePrefix(destPrefix);
  const destKey = buildStorageKey(normDest, name, isFolder);

  try {
    const result = await renameOrMoveObject(sourceKey, destKey);
    if (!result.success) {
      return { success: false, error: result.error ?? "Gagal memindahkan file" };
    }

    revalidatePath("/dashboard/media");
    return { success: true, item: result.item };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memindahkan file";
    return { success: false, error: message };
  }
}

/**
 * Deletes a single media file.
 */
export async function deleteMediaObjectAction(key: string): Promise<{ success: boolean; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const res = await deleteMediaObject(key);
    if (!res.success) {
      return { success: false, error: res.error ?? "Gagal menghapus file" };
    }

    revalidatePath("/dashboard/media");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus file";
    return { success: false, error: message };
  }
}

/**
 * Deletes an entire folder and all its contents recursively.
 */
export async function deleteMediaFolderAction(
  folderPrefix: string,
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const res = await deleteFolderRecursive(folderPrefix);
    if (!res.success) {
      return { success: false, error: res.error ?? "Gagal menghapus folder" };
    }

    revalidatePath("/dashboard/media");
    return { success: true, deletedCount: res.deletedCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus folder";
    return { success: false, error: message };
  }
}

/**
 * Bulk deletes multiple media keys.
 */
export async function bulkDeleteMediaAction(
  keys: string[],
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  if (keys.length === 0) {
    return { success: false, error: "Tidak ada file yang dipilih" };
  }

  try {
    const res = await bulkDeleteMediaObjects(keys);
    if (!res.success) {
      return { success: false, error: res.error ?? "Gagal menghapus beberapa item" };
    }

    revalidatePath("/dashboard/media");
    return { success: true, deletedCount: res.deletedCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus media";
    return { success: false, error: message };
  }
}

/**
 * Updates an object's custom metadata.
 */
export async function updateMediaMetadataAction(
  key: string,
  metadata: Record<string, string>,
): Promise<{ success: boolean; item?: MediaItem; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const res = await updateMediaMetadata(key, metadata);
    if (!res.success) {
      return { success: false, error: res.error ?? "Gagal memperbarui metadata file" };
    }

    revalidatePath("/dashboard/media");
    return { success: true, item: res.item };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui metadata";
    return { success: false, error: message };
  }
}
