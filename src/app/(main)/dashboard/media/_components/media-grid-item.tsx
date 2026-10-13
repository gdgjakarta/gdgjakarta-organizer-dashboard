"use client";

import * as React from "react";

import {
  Code,
  Copy,
  Download,
  Edit2,
  ExternalLink,
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
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FolderItem, MediaCategory, MediaItem } from "@/lib/r2/types";
import { formatFileSize } from "@/lib/r2/utils";

interface FolderCardProps {
  folder: FolderItem;
  onOpen: (prefix: string) => void;
  onDelete: (folder: FolderItem) => void;
}

export function FolderCard({ folder, onOpen, onDelete }: FolderCardProps) {
  return (
    <Card
      onClick={() => onOpen(folder.prefix)}
      className="group relative cursor-pointer border-dashed transition-all hover:border-primary/50 hover:bg-accent/40"
    >
      <CardContent className="flex items-center justify-between p-3.5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Folder className="h-5 w-5 fill-primary/20" />
          </div>
          <div className="overflow-hidden">
            <p className="truncate font-medium text-foreground text-sm" title={folder.name}>
              {folder.name}
            </p>
            <p className="text-muted-foreground text-xs">Folder</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            className="flex h-8 w-8 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onOpen(folder.prefix)}>
              <ExternalLink className="mr-2 h-4 w-4" /> Buka Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(folder)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Hapus Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

interface MediaCardProps {
  item: MediaItem;
  isSelected: boolean;
  onToggleSelect: (key: string) => void;
  onPreview: (item: MediaItem) => void;
  onRename: (item: MediaItem) => void;
  onMove: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}

function CategoryIcon({ category }: { category: MediaCategory }) {
  switch (category) {
    case "image":
      return <ImageIcon className="h-8 w-8 text-blue-500/70" />;
    case "video":
      return <FileVideo className="h-8 w-8 text-purple-500/70" />;
    case "audio":
      return <FileAudio className="h-8 w-8 text-amber-500/70" />;
    case "document":
      return <FileText className="h-8 w-8 text-emerald-500/70" />;
    case "archive":
      return <FileArchive className="h-8 w-8 text-orange-500/70" />;
    default:
      return <File className="h-8 w-8 text-muted-foreground" />;
  }
}

export function MediaCard({ item, isSelected, onToggleSelect, onPreview, onRename, onMove, onDelete }: MediaCardProps) {
  const [imageError, setImageError] = React.useState(false);

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullUrl = item.url.startsWith("http") ? item.url : `${window.location.origin}${item.url}`;
    void navigator.clipboard.writeText(fullUrl);
    toast.success("CDN URL berhasil disalin ke clipboard");
  };

  const handleCopyMarkdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullUrl = item.url.startsWith("http") ? item.url : `${window.location.origin}${item.url}`;
    const tag = `![${item.name}](${fullUrl})`;
    void navigator.clipboard.writeText(tag);
    toast.success("Markdown tag berhasil disalin");
  };

  const handleCopyHtml = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullUrl = item.url.startsWith("http") ? item.url : `${window.location.origin}${item.url}`;
    const tag = `<img src="${fullUrl}" alt="${item.name}" />`;
    void navigator.clipboard.writeText(tag);
    toast.success("HTML tag berhasil disalin");
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const downloadUrl = `${item.url}${item.url.includes("?") ? "&" : "?"}download=1`;
    window.open(downloadUrl, "_blank");
  };

  return (
    <Card
      onClick={() => onPreview(item)}
      className={`group relative flex cursor-pointer flex-col overflow-hidden transition-all hover:shadow-md ${
        isSelected ? "border-primary bg-primary/[0.02] ring-2 ring-primary/20" : "hover:border-primary/40"
      }`}
    >
      {/* Checkbox overlay */}
      <div
        className={`absolute top-2.5 left-2.5 z-10 rounded-md bg-background/80 p-1 backdrop-blur-xs transition-opacity ${
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(item.key)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Action menu overlay */}
      <div className="absolute top-2.5 right-2.5 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 opacity-0 backdrop-blur-xs transition-opacity hover:bg-muted group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onPreview(item)}>
              <Eye className="mr-2 h-4 w-4" /> Pratinjau
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyUrl}>
              <Copy className="mr-2 h-4 w-4" /> Salin URL
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyMarkdown}>
              <Code className="mr-2 h-4 w-4" /> Salin Markdown Tag
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyHtml}>
              <Code className="mr-2 h-4 w-4" /> Salin HTML Tag
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload}>
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
            <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Visual Thumbnail Area */}
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted/40">
        {item.category === "image" && !imageError ? (
          // biome-ignore lint/performance/noImgElement: R2 storage asset preview
          <img
            src={item.url}
            alt={item.name}
            loading="lazy"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <CategoryIcon category={item.category} />
            <span className="font-mono text-muted-foreground text-xs uppercase">
              {item.name.split(".").pop() || item.category}
            </span>
          </div>
        )}
      </div>

      {/* Card Info Footer */}
      <CardContent className="flex flex-col gap-1 p-3">
        <p className="truncate font-medium text-foreground text-xs" title={item.name}>
          {item.name}
        </p>
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>{formatFileSize(item.size)}</span>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] uppercase">
            {item.category}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
