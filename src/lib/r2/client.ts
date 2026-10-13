import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import type {
  CreateFolderResult,
  DeleteResult,
  FolderItem,
  MediaItem,
  R2DirectoryContent,
  RenameResult,
} from "./types";
import {
  buildStorageKey,
  getFileCategory,
  normalizePrefix,
  resolveMediaUrl,
  sanitizeStorageName,
  splitStorageKey,
} from "./utils";

/**
 * Resolves Cloudflare R2 bucket from worker context, with an optional S3 SDK fallback if running outside Cloudflare.
 */
export async function getMediaBucket(): Promise<R2Bucket> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    if (ctx.env.MEDIA_BUCKET) {
      return ctx.env.MEDIA_BUCKET;
    }
  } catch (_err) {
    // getCloudflareContext throws if executed outside worker context without platform proxy
  }

  // Check if S3 credentials are provided for fallback
  const accountId = process.env.R2_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME ?? "gdgjakarta-assets";

  if (accountId && accessKeyId && secretAccessKey) {
    // Dynamically wrap AWS S3 client to emulate R2Bucket interface
    return createS3R2Adapter({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
    });
  }

  throw new Error(
    "Cloudflare R2 Bucket binding 'MEDIA_BUCKET' is not available. Please verify wrangler.jsonc or set R2 credentials.",
  );
}

/**
 * Lists items and folders for a given prefix directory in the bucket.
 */
export async function listDirectoryContent(
  rawPrefix = "",
  options?: { cursor?: string; limit?: number },
): Promise<R2DirectoryContent> {
  const bucket = await getMediaBucket();
  const prefix = normalizePrefix(rawPrefix);
  const limit = options?.limit ?? 100;

  const result = await bucket.list({
    prefix,
    delimiter: "/",
    cursor: options?.cursor,
    limit,
    include: ["httpMetadata", "customMetadata"],
  });

  // Extract sub-folders from delimitedPrefixes
  const folders: FolderItem[] = [];
  const seenPrefixes = new Set<string>();

  for (const delPrefix of result.delimitedPrefixes ?? []) {
    if (delPrefix === prefix || seenPrefixes.has(delPrefix)) continue;
    seenPrefixes.add(delPrefix);

    const trimmed = delPrefix.endsWith("/") ? delPrefix.slice(0, -1) : delPrefix;
    const folderName = trimmed.slice(prefix.length);

    if (folderName) {
      folders.push({
        prefix: delPrefix,
        name: folderName,
        parentPrefix: prefix,
        isFolder: true,
      });
    }
  }

  // Extract media items, ignoring directory markers and hidden placeholder objects
  const items: MediaItem[] = [];

  for (const obj of result.objects) {
    // Ignore exact folder marker (ends with / or matches prefix)
    if (obj.key === prefix || obj.key.endsWith("/")) {
      continue;
    }

    const { folder, name } = splitStorageKey(obj.key);
    // Ignore .keep files or dotfiles intended purely for directory retention
    if (name === ".keep" || name === ".gitkeep") {
      continue;
    }

    const contentType = obj.httpMetadata?.contentType ?? "application/octet-stream";
    const category = getFileCategory(contentType, name);
    const url = resolveMediaUrl(obj.key);

    items.push({
      key: obj.key,
      name,
      size: obj.size,
      etag: obj.etag,
      contentType,
      category,
      updatedAt: obj.uploaded.toISOString(),
      url,
      folder,
      isFolder: false,
      metadata: obj.customMetadata,
    });
  }

  // Sort folders alphabetically, items by newest first
  folders.sort((a, b) => a.name.localeCompare(b.name));
  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return {
    currentPrefix: prefix,
    folders,
    items,
    totalFolders: folders.length,
    totalItems: items.length,
    cursor: result.truncated ? result.cursor : undefined,
    hasMore: result.truncated,
  };
}

/**
 * Creates an empty folder marker object in R2 (ends with a trailing slash).
 */
export async function createFolderMarker(parentPrefix = "", rawFolderName: string): Promise<CreateFolderResult> {
  const bucket = await getMediaBucket();
  const normParent = normalizePrefix(parentPrefix);
  const cleanName = sanitizeStorageName(rawFolderName, true);

  if (!cleanName) {
    return { success: false, error: "Nama folder tidak valid" };
  }

  const folderKey = `${normParent}${cleanName}/`;

  try {
    // Write 0-byte directory object marker
    await bucket.put(folderKey, new Uint8Array(0), {
      httpMetadata: {
        contentType: "application/x-directory",
      },
      customMetadata: {
        isFolderMarker: "true",
        createdDate: new Date().toISOString(),
      },
    });

    return {
      success: true,
      folder: {
        prefix: folderKey,
        name: cleanName,
        parentPrefix: normParent,
        isFolder: true,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal membuat folder di Cloudflare R2";
    return { success: false, error: message };
  }
}

/**
 * Uploads a file stream/buffer to Cloudflare R2 under the specified directory.
 */
export async function uploadMediaObject(
  prefix: string,
  rawFileName: string,
  data: ArrayBuffer | Uint8Array | ReadableStream,
  options?: {
    contentType?: string;
    customMetadata?: Record<string, string>;
  },
): Promise<{ success: boolean; item?: MediaItem; error?: string }> {
  const bucket = await getMediaBucket();
  const cleanName = sanitizeStorageName(rawFileName, false);
  const key = buildStorageKey(prefix, cleanName, false);
  const contentType = options?.contentType ?? "application/octet-stream";

  try {
    const uploadedObj = await bucket.put(key, data, {
      httpMetadata: {
        contentType,
      },
      customMetadata: {
        originalName: rawFileName,
        uploadedAt: new Date().toISOString(),
        ...(options?.customMetadata ?? {}),
      },
    });

    const category = getFileCategory(contentType, cleanName);
    const { folder, name } = splitStorageKey(key);

    const item: MediaItem = {
      key: uploadedObj.key,
      name,
      size: uploadedObj.size,
      etag: uploadedObj.etag,
      contentType,
      category,
      updatedAt: uploadedObj.uploaded.toISOString(),
      url: resolveMediaUrl(uploadedObj.key),
      folder,
      isFolder: false,
      metadata: uploadedObj.customMetadata,
    };

    return { success: true, item };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengunggah media ke Cloudflare R2";
    return { success: false, error: message };
  }
}

/**
 * Deletes an individual object or folder marker by key.
 */
export async function deleteMediaObject(key: string): Promise<DeleteResult> {
  const bucket = await getMediaBucket();
  try {
    await bucket.delete(key);
    return { success: true, deletedCount: 1 };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus file dari R2";
    return { success: false, deletedCount: 0, error: message };
  }
}

/**
 * Deletes multiple keys in a single batch.
 */
export async function bulkDeleteMediaObjects(keys: string[]): Promise<DeleteResult> {
  if (!keys.length) {
    return { success: true, deletedCount: 0 };
  }

  const bucket = await getMediaBucket();
  try {
    await bucket.delete(keys);
    return { success: true, deletedCount: keys.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus media secara massal";
    return { success: false, deletedCount: 0, error: message };
  }
}

/**
 * Recursively deletes a folder and all objects contained within its prefix.
 */
export async function deleteFolderRecursive(rawFolderPrefix: string): Promise<DeleteResult> {
  const bucket = await getMediaBucket();
  const folderPrefix = normalizePrefix(rawFolderPrefix);

  if (!folderPrefix || folderPrefix === "/") {
    return { success: false, deletedCount: 0, error: "Root folder tidak dapat dihapus" };
  }

  let totalDeleted = 0;
  let cursor: string | undefined;

  try {
    do {
      const list = await bucket.list({
        prefix: folderPrefix,
        cursor,
        limit: 500,
      });

      const keysToDelete = list.objects.map((o) => o.key);
      if (keysToDelete.length > 0) {
        await bucket.delete(keysToDelete);
        totalDeleted += keysToDelete.length;
      }

      cursor = list.truncated ? list.cursor : undefined;
      if (!list.truncated) break;
    } while (cursor);

    return { success: true, deletedCount: totalDeleted };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus folder beserta isinya";
    return { success: false, deletedCount: totalDeleted, error: message };
  }
}

/**
 * Renames or moves a file object.
 * In object storage, rename/move copies object to destination key and deletes source key.
 */
export async function renameOrMoveObject(sourceKey: string, destKey: string): Promise<RenameResult> {
  if (sourceKey === destKey) {
    return { success: true, newKey: destKey };
  }

  const bucket = await getMediaBucket();

  try {
    const sourceObj = await bucket.get(sourceKey);
    if (!sourceObj) {
      return { success: false, error: "File sumber tidak ditemukan" };
    }

    // Write to destination key with preserved metadata
    await bucket.put(destKey, sourceObj.body, {
      httpMetadata: sourceObj.httpMetadata,
      customMetadata: sourceObj.customMetadata,
    });

    // Delete source key
    await bucket.delete(sourceKey);

    const { folder, name } = splitStorageKey(destKey);
    const contentType = sourceObj.httpMetadata?.contentType ?? "application/octet-stream";

    const item: MediaItem = {
      key: destKey,
      name,
      size: sourceObj.size,
      etag: sourceObj.etag,
      contentType,
      category: getFileCategory(contentType, name),
      updatedAt: new Date().toISOString(),
      url: resolveMediaUrl(destKey),
      folder,
      isFolder: false,
      metadata: sourceObj.customMetadata,
    };

    return { success: true, newKey: destKey, item };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memindahkan/mengubah nama file";
    return { success: false, error: message };
  }
}

/**
 * Updates an object's metadata (e.g. alt text, title, tags) without re-uploading file bytes.
 */
export async function updateMediaMetadata(
  key: string,
  newMetadata: Record<string, string>,
): Promise<{ success: boolean; item?: MediaItem; error?: string }> {
  const bucket = await getMediaBucket();

  try {
    const obj = await bucket.get(key);
    if (!obj) {
      return { success: false, error: "File tidak ditemukan" };
    }

    const mergedMetadata = {
      ...(obj.customMetadata ?? {}),
      ...newMetadata,
    };

    const updated = await bucket.put(key, obj.body, {
      httpMetadata: obj.httpMetadata,
      customMetadata: mergedMetadata,
    });

    const { folder, name } = splitStorageKey(key);
    const contentType = obj.httpMetadata?.contentType ?? "application/octet-stream";

    const item: MediaItem = {
      key: updated.key,
      name,
      size: updated.size,
      etag: updated.etag,
      contentType,
      category: getFileCategory(contentType, name),
      updatedAt: updated.uploaded.toISOString(),
      url: resolveMediaUrl(updated.key),
      folder,
      isFolder: false,
      metadata: mergedMetadata,
    };

    return { success: true, item };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui metadata file";
    return { success: false, error: message };
  }
}

/**
 * Retrieves a media object stream and metadata for HTTP response streaming.
 */
export async function getMediaObjectStream(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null> {
  const bucket = await getMediaBucket();
  const obj = await bucket.get(key, options);
  return obj;
}

/**
 * Optional S3-to-R2 adapter for local development when running outside Cloudflare Worker environment.
 */
function createS3R2Adapter(config: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}): R2Bucket {
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async list(opts?: R2ListOptions) {
      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: config.bucketName,
          Prefix: opts?.prefix ?? "",
          Delimiter: opts?.delimiter,
          ContinuationToken: opts?.cursor,
          MaxKeys: opts?.limit,
        }),
      );

      const objects = (res.Contents ?? []).map((c) => ({
        key: c.Key ?? "",
        size: c.Size ?? 0,
        etag: c.ETag?.replace(/"/g, "") ?? "",
        uploaded: c.LastModified ?? new Date(),
        version: "v1",
        httpEtag: c.ETag?.replace(/"/g, "") ?? "",
        storageClass: "Standard",
        checksums: { md5: undefined, sha1: undefined, sha256: undefined, sha384: undefined, sha512: undefined },
        httpMetadata: {},
        customMetadata: {},
        writeHttpMetadata: () => {
          /* no-op */
        },
      })) as unknown as R2Object[];

      const delimitedPrefixes = (res.CommonPrefixes ?? [])
        .map((cp) => cp.Prefix)
        .filter((p): p is string => Boolean(p));

      return {
        objects,
        delimitedPrefixes,
        truncated: Boolean(res.IsTruncated),
        cursor: res.NextContinuationToken,
      } as unknown as R2Objects;
    },
    async put(key: string, value: Parameters<R2Bucket["put"]>[1], opts?: Parameters<R2Bucket["put"]>[2]) {
      let body: Buffer | Uint8Array | string | undefined;

      if (value instanceof ReadableStream) {
        const reader = value.getReader();
        const chunks: Uint8Array[] = [];
        let doneReading = false;
        while (!doneReading) {
          const { done, value: chunk } = await reader.read();
          if (done) {
            doneReading = true;
          } else if (chunk) {
            chunks.push(chunk);
          }
        }
        body = Buffer.concat(chunks);
      } else if (value instanceof Uint8Array) {
        body = Buffer.from(value);
      } else if (typeof value === "string") {
        body = value;
      }

      const contentType =
        opts?.httpMetadata && "contentType" in opts.httpMetadata ? opts.httpMetadata.contentType : undefined;

      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
          Metadata: opts?.customMetadata,
        }),
      );

      return {
        key,
        size: typeof body === "string" ? body.length : (body?.length ?? 0),
        etag: "s3-etag",
        httpEtag: "s3-etag",
        version: "v1",
        storageClass: "Standard",
        checksums: { md5: undefined, sha1: undefined, sha256: undefined, sha384: undefined, sha512: undefined },
        uploaded: new Date(),
        httpMetadata: opts?.httpMetadata ?? {},
        customMetadata: opts?.customMetadata ?? {},
        writeHttpMetadata: () => {
          /* no-op */
        },
      } as unknown as R2Object;
    },
    async get(key: string) {
      try {
        const res = await s3.send(
          new GetObjectCommand({
            Bucket: config.bucketName,
            Key: key,
          }),
        );
        return {
          key,
          size: res.ContentLength ?? 0,
          etag: res.ETag?.replace(/"/g, "") ?? "",
          httpEtag: res.ETag?.replace(/"/g, "") ?? "",
          version: "v1",
          storageClass: "Standard",
          checksums: { md5: undefined, sha1: undefined, sha256: undefined, sha384: undefined, sha512: undefined },
          uploaded: res.LastModified ?? new Date(),
          httpMetadata: { contentType: res.ContentType },
          customMetadata: res.Metadata ?? {},
          writeHttpMetadata: () => {
            /* no-op */
          },
          body: res.Body as unknown as ReadableStream,
          bodyUsed: false,
          arrayBuffer: async () => new ArrayBuffer(0),
          text: async () => "",
          json: async () => ({}),
          blob: async () => new Blob([]),
        } as unknown as R2ObjectBody;
      } catch {
        return null;
      }
    },
    async delete(keys: string | string[]) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      if (!keyList.length) return;
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: config.bucketName,
          Delete: {
            Objects: keyList.map((k) => ({ Key: k })),
            Quiet: true,
          },
        }),
      );
    },
    async head(_key: string) {
      return null;
    },
  } as unknown as R2Bucket;
}
