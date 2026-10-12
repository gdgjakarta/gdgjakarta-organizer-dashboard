import type { ShortFolder, ShortLinkItem } from "@/lib/shortio/types";

export interface FolderMeta {
  color: string;
  badgeClass: string;
  dotClass: string;
}

export const KNOWN_FOLDER_COLORS: Record<string, string> = {
  DevFest: "#0693E3",
  BWAI: "#00D084",
  GDG: "#FCB900",
  Hackathon: "#FF6900",
  "I/O Extended": "#EB144C",
  IWD: "#FFC0CB",
};

export const COLOR_PALETTE = [
  "#0693E3", // Blue
  "#00D084", // Green
  "#FCB900", // Yellow
  "#FF6900", // Orange
  "#EB144C", // Red
  "#9B51E0", // Purple
  "#FFC0CB", // Pink
  "#00B4D8", // Cyan
  "#6C757D", // Gray
];

export function getFolderColor(folder?: ShortFolder | null): string {
  if (!folder) return "#64748B";
  return folder.color || KNOWN_FOLDER_COLORS[folder.name] || "#0693E3";
}

export function findFolderById(folders: ShortFolder[], folderId?: string | null): ShortFolder | undefined {
  if (!folderId) return undefined;
  return folders.find((f) => f.id === folderId);
}

export function getLinkCountByFolder(links: ShortLinkItem[], folderId?: string): number {
  if (!folderId) {
    // Uncategorized
    return links.filter((l) => !l.FolderId).length;
  }
  return links.filter((l) => l.FolderId === folderId).length;
}
