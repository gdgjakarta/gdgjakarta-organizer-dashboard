import type { MediaCategory } from "./types";

/**
 * Sanitizes a file or folder name to be URL-safe, always lowercase, and hyphen-separated.
 *
 * Rules:
 * - Always lowercase (.toLowerCase())
 * - Spaces replaced with dashes ('-')
 * - Consecutive dashes collapsed
 * - Unsafe characters removed
 * - Leading and trailing dashes trimmed
 * - If not a folder, preserves and lowercases the extension (.png, .jpg, etc.)
 */
export function sanitizeStorageName(input: string, isFolder = false): string {
  if (!input) return "";

  const trimmed = input.trim();
  if (isFolder) {
    return trimmed
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Handle file name and extension
  const lastDotIndex = trimmed.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    // No extension or dotfile
    return trimmed
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const baseName = trimmed.slice(0, lastDotIndex);
  const extension = trimmed.slice(lastDotIndex + 1);

  const cleanBase = baseName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  const cleanExt = extension
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");

  if (!cleanBase) {
    return cleanExt ? `file.${cleanExt}` : "unnamed-file";
  }

  return cleanExt ? `${cleanBase}.${cleanExt}` : cleanBase;
}

/**
 * Normalizes a prefix path, ensuring it ends with a slash if not empty, and doesn't have leading slashes.
 */
export function normalizePrefix(prefix: string): string {
  if (!prefix || prefix === "/" || prefix === ".") return "";
  let clean = prefix.replace(/^\/+/, "").replace(/\/+/g, "/");
  if (!clean.endsWith("/")) {
    clean += "/";
  }
  return clean;
}

/**
 * Combines directory prefix and file/folder name into a normalized storage key.
 */
export function buildStorageKey(prefix: string, name: string, isFolder = false): string {
  const normPrefix = normalizePrefix(prefix);
  const cleanName = sanitizeStorageName(name, isFolder);
  const result = `${normPrefix}${cleanName}`;
  if (isFolder) {
    return result.endsWith("/") ? result : `${result}/`;
  }
  return result;
}

/**
 * Splits a full key into its parent directory prefix and file/folder name.
 */
export function splitStorageKey(key: string): { folder: string; name: string; isFolder: boolean } {
  const isFolder = key.endsWith("/");
  const trimmed = isFolder ? key.slice(0, -1) : key;
  const lastSlash = trimmed.lastIndexOf("/");

  if (lastSlash === -1) {
    return {
      folder: "",
      name: trimmed,
      isFolder,
    };
  }

  return {
    folder: `${trimmed.slice(0, lastSlash)}/`,
    name: trimmed.slice(lastSlash + 1),
    isFolder,
  };
}

/**
 * Formats byte size into human-readable representation.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / k ** i;
  return `${Number(val.toFixed(i === 0 ? 0 : 1))} ${sizes[i]}`;
}

/**
 * Detects media category based on MIME content-type and file extension.
 */
export function getFileCategory(contentType: string, fileName: string): MediaCategory {
  const lowerType = (contentType || "").toLowerCase();
  const lowerExt = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (
    lowerType.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(lowerExt)
  ) {
    return "image";
  }

  if (lowerType.startsWith("video/") || ["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(lowerExt)) {
    return "video";
  }

  if (lowerType.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(lowerExt)) {
    return "audio";
  }

  if (
    lowerType.includes("pdf") ||
    lowerType.includes("word") ||
    lowerType.includes("document") ||
    lowerType.includes("sheet") ||
    lowerType.includes("excel") ||
    lowerType.includes("presentation") ||
    lowerType.includes("text/") ||
    ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md"].includes(lowerExt)
  ) {
    return "document";
  }

  if (
    lowerType.includes("zip") ||
    lowerType.includes("tar") ||
    lowerType.includes("rar") ||
    lowerType.includes("7z") ||
    lowerType.includes("gzip") ||
    ["zip", "tar", "gz", "tgz", "rar", "7z"].includes(lowerExt)
  ) {
    return "archive";
  }

  return "other";
}

/**
 * Resolves the public URL for an R2 key.
 * If NEXT_PUBLIC_R2_PUBLIC_URL is configured (e.g. https://assets.gdgjakarta.org or pub-*.r2.dev),
 * uses that. Otherwise routes through the /api/media streaming proxy.
 */
export function resolveMediaUrl(key: string): string {
  const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/+$/, "");
  const encodedKey = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");

  if (publicBase) {
    return `${publicBase}/${encodedKey}`;
  }

  return `/api/media/${encodedKey}`;
}
