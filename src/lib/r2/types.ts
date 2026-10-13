export type MediaCategory = "image" | "video" | "audio" | "document" | "archive" | "other";

export interface MediaItemMetadata {
  title?: string;
  alt?: string;
  description?: string;
  width?: string | number;
  height?: string | number;
  [key: string]: unknown;
}

export interface MediaItem {
  key: string;
  name: string;
  size: number;
  etag?: string;
  contentType: string;
  category: MediaCategory;
  updatedAt: string;
  url: string;
  folder: string;
  isFolder: false;
  metadata?: MediaItemMetadata;
}

export interface FolderItem {
  prefix: string;
  name: string;
  parentPrefix: string;
  isFolder: true;
}

export interface R2DirectoryContent {
  currentPrefix: string;
  folders: FolderItem[];
  items: MediaItem[];
  totalFolders: number;
  totalItems: number;
  cursor?: string;
  hasMore: boolean;
}

export interface UploadMediaResult {
  success: boolean;
  item?: MediaItem;
  error?: string;
}

export interface CreateFolderResult {
  success: boolean;
  folder?: FolderItem;
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  deletedCount: number;
  error?: string;
}

export interface RenameResult {
  success: boolean;
  newKey?: string;
  item?: MediaItem;
  error?: string;
}
