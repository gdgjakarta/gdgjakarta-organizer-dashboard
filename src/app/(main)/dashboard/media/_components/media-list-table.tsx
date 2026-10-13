"use client";

import {
  Code,
  Copy,
  Download,
  Edit2,
  Eye,
  File,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  Folder,
  ImageIcon,
  MoreVertical,
  Move,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FolderItem, MediaCategory, MediaItem } from "@/lib/r2/types";
import { formatFileSize } from "@/lib/r2/utils";

interface MediaListTableProps {
  folders: FolderItem[];
  items: MediaItem[];
  selectedKeys: Set<string>;
  onToggleSelect: (key: string) => void;
  onToggleSelectAll: () => void;
  onOpenFolder: (prefix: string) => void;
  onDeleteFolder: (folder: FolderItem) => void;
  onPreview: (item: MediaItem) => void;
  onRename: (item: MediaItem) => void;
  onMove: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}

function SmallCategoryIcon({ category }: { category: MediaCategory }) {
  switch (category) {
    case "image":
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    case "video":
      return <FileVideo className="h-4 w-4 text-purple-500" />;
    case "audio":
      return <FileAudio className="h-4 w-4 text-amber-500" />;
    case "document":
      return <FileText className="h-4 w-4 text-emerald-500" />;
    case "archive":
      return <FileArchive className="h-4 w-4 text-orange-500" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

export function MediaListTable({
  folders,
  items,
  selectedKeys,
  onToggleSelect,
  onToggleSelectAll,
  onOpenFolder,
  onDeleteFolder,
  onPreview,
  onRename,
  onMove,
  onDelete,
}: MediaListTableProps) {
  const allSelected = items.length > 0 && items.every((it) => selectedKeys.has(it.key));

  const handleCopyUrl = (item: MediaItem) => {
    const fullUrl = item.url.startsWith("http") ? item.url : `${window.location.origin}${item.url}`;
    void navigator.clipboard.writeText(fullUrl);
    toast.success("URL berhasil disalin");
  };

  const handleCopyMarkdown = (item: MediaItem) => {
    const fullUrl = item.url.startsWith("http") ? item.url : `${window.location.origin}${item.url}`;
    void navigator.clipboard.writeText(`![${item.name}](${fullUrl})`);
    toast.success("Markdown tag disalin");
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 text-center">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleSelectAll}
                aria-label="Pilih semua file"
                disabled={items.length === 0}
              />
            </TableHead>
            <TableHead>Nama</TableHead>
            <TableHead className="w-28">Kategori</TableHead>
            <TableHead className="w-28 text-right">Ukuran</TableHead>
            <TableHead className="w-40">Terakhir Diperbarui</TableHead>
            <TableHead className="w-16 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Folders first */}
          {folders.map((folder) => (
            <TableRow
              key={folder.prefix}
              onClick={() => onOpenFolder(folder.prefix)}
              className="cursor-pointer hover:bg-muted/50"
            >
              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                <span className="text-muted-foreground">—</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5 font-medium">
                  <Folder className="h-4 w-4 shrink-0 fill-primary/20 text-primary" />
                  <span className="truncate">{folder.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  Folder
                </Badge>
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
              <TableCell className="text-muted-foreground text-xs">—</TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onOpenFolder(folder.prefix)}>
                      <Eye className="mr-2 h-4 w-4" /> Buka Folder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDeleteFolder(folder)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Hapus Folder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}

          {/* Files next */}
          {items.map((item) => {
            const isSelected = selectedKeys.has(item.key);
            return (
              <TableRow
                key={item.key}
                onClick={() => onPreview(item)}
                className={`cursor-pointer hover:bg-muted/50 ${isSelected ? "bg-primary/[0.03]" : ""}`}
              >
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(item.key)}
                    aria-label={`Pilih ${item.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <SmallCategoryIcon category={item.category} />
                    <span className="truncate font-medium text-sm" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[11px] uppercase">
                    {item.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-xs">
                  {formatFileSize(item.size)}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {new Date(item.updatedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onPreview(item)}>
                        <Eye className="mr-2 h-4 w-4" /> Pratinjau
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopyUrl(item)}>
                        <Copy className="mr-2 h-4 w-4" /> Salin URL
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopyMarkdown(item)}>
                        <Code className="mr-2 h-4 w-4" /> Salin Markdown
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(`${item.url}${item.url.includes("?") ? "&" : "?"}download=1`, "_blank")
                        }
                      >
                        <Download className="mr-2 h-4 w-4" /> Unduh
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onRename(item)}>
                        <Edit2 className="mr-2 h-4 w-4" /> Ubah Nama
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onMove(item)}>
                        <Move className="mr-2 h-4 w-4" /> Pindahkan
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(item)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
