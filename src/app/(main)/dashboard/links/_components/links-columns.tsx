"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  Copy,
  ExternalLink,
  FolderSymlink,
  Globe,
  MoreHorizontal,
  Pencil,
  QrCode,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DataTableFeatures } from "@/lib/data-table-features";
import type { ShortFolder, ShortLinkItem, ShortlinkProviderName } from "@/lib/shortio/types";

import { findFolderById, getFolderColor } from "./data";
import { extractProBadges, formatClickCount } from "./link-form-helpers";

interface ColumnCallbacks {
  folders: ShortFolder[];
  provider?: ShortlinkProviderName;
  onEdit: (link: ShortLinkItem) => void;
  onMoveFolder: (link: ShortLinkItem) => void;
  onDelete: (link: ShortLinkItem) => void;
  onQrCode: (link: ShortLinkItem) => void;
  onAnalytics: (link: ShortLinkItem) => void;
  onArchive: (link: ShortLinkItem) => void;
  onUnarchive?: (link: ShortLinkItem) => void;
}

export function createLinksColumns(callbacks: ColumnCallbacks): ColumnDef<DataTableFeatures, ShortLinkItem>[] {
  const {
    folders,
    provider = "shortio",
    onEdit,
    onMoveFolder,
    onDelete,
    onQrCode,
    onAnalytics,
    onArchive,
    onUnarchive,
  } = callbacks;

  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Subscribe
            source={table.atoms.rowSelection}
            selector={() =>
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected() && "indeterminate")
            }
          >
            {(checked) => (
              <Checkbox
                aria-label="Select all links"
                checked={checked}
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              />
            )}
          </Subscribe>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Subscribe source={row.table.atoms.rowSelection} selector={(selection) => Boolean(selection?.[row.id])}>
            {(checked) => (
              <Checkbox
                aria-label={`Select ${row.original.shortURL}`}
                checked={checked}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
              />
            )}
          </Subscribe>
        </div>
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "search",
      accessorFn: (row) => {
        const folder = findFolderById(folders, row.FolderId);
        return `${row.shortURL} ${row.path} ${row.originalURL} ${row.title ?? ""} ${folder?.name ?? ""} ${(row.tags ?? []).join(" ")}`;
      },
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      accessorKey: "shortURL",
      header: "Short Link",
      cell: ({ row }) => {
        const link = row.original;
        const proBadges = extractProBadges(link);

        return (
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground text-sm">
                <span className="font-mono">{link.shortURL}</span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    void navigator.clipboard.writeText(link.shortURL);
                    toast.success("Short link copied to clipboard");
                  }}
                  aria-label="Copy short link"
                >
                  <Copy className="size-3" />
                </Button>
                <a
                  href={link.shortURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Open short link in new tab"
                >
                  <ExternalLink className="size-3" />
                </a>
              </div>
              {link.title && <span className="line-clamp-1 text-muted-foreground text-xs">{link.title}</span>}
              {proBadges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {proBadges.map((b) => (
                    <Badge key={b.key} variant="outline" className="px-1.5 py-0 font-normal text-[10px]">
                      {b.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "originalURL",
      header: "Destination URL",
      cell: ({ row }) => {
        const original = row.original.originalURL;
        return (
          <div className="flex max-w-[280px] items-center gap-1.5 lg:max-w-[360px]">
            <Globe className="size-3.5 shrink-0 text-muted-foreground/70" />
            <a
              href={original}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-muted-foreground text-xs hover:text-foreground hover:underline"
              title={original}
            >
              {original}
            </a>
          </div>
        );
      },
    },
    {
      accessorKey: "FolderId",
      header: "Category Folder",
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || filterValue === "all") return true;
        if (filterValue === "uncategorized") return !row.original.FolderId;
        return row.getValue(columnId) === filterValue;
      },
      cell: ({ row }) => {
        const folder = findFolderById(folders, row.original.FolderId);
        if (!folder) {
          return (
            <Badge
              variant="outline"
              className="gap-1 border-dashed px-2 py-0.5 font-normal text-muted-foreground text-xs"
            >
              Uncategorized
            </Badge>
          );
        }

        const color = getFolderColor(folder);
        return (
          <Badge
            variant="outline"
            className="gap-1.5 border px-2 py-0.5 font-medium text-xs"
            style={{
              borderColor: `${color}40`,
              backgroundColor: `${color}15`,
              color: color,
            }}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
            {folder.name}
          </Badge>
        );
      },
    },
    {
      accessorKey: "tags",
      header: "Tags",
      cell: ({ row }) => {
        const tags = row.original.tags || [];
        if (tags.length === 0) return <span className="text-muted-foreground text-xs">—</span>;

        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "clicks",
      accessorFn: (row) => formatClickCount(row).total,
      header: "Clicks",
      cell: ({ row }) => {
        const { totalFormatted, capLabel, legacyNote } = formatClickCount(row.original);
        const content = (
          <div className="flex items-baseline gap-1 text-xs tabular-nums">
            <span className="font-medium text-foreground">{totalFormatted}</span>
            {capLabel && <span className="text-muted-foreground">{capLabel}</span>}
          </div>
        );

        if (!legacyNote) return content;

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help items-center gap-1 underline decoration-dotted underline-offset-2">
                  {content}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{legacyNote}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        const rawDate = row.original.createdAt;
        try {
          const parsed = parseISO(rawDate);
          return <span className="text-muted-foreground text-xs">{format(parsed, "dd MMM yyyy")}</span>;
        } catch {
          return <span className="text-muted-foreground text-xs">{rawDate}</span>;
        }
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const link = row.original;

        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  aria-label={`Open actions for ${link.shortURL}`}
                  className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                  size="icon-sm"
                  variant="ghost"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    void navigator.clipboard.writeText(link.shortURL);
                    toast.success("Short link copied to clipboard");
                  }}
                >
                  <Copy className="mr-2 size-3.5" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={link.shortURL} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 size-3.5" />
                    Open in New Tab
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAnalytics(link)}>
                  <BarChart3 className="mr-2 size-3.5" />
                  View Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onQrCode(link)}>
                  <QrCode className="mr-2 size-3.5" />
                  View QR Code
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onMoveFolder(link)}>
                  <FolderSymlink className="mr-2 size-3.5" />
                  Move to Folder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(link)}>
                  <Pencil className="mr-2 size-3.5" />
                  Edit Link
                </DropdownMenuItem>
                {link.archived ? (
                  provider === "cloudflare" &&
                  onUnarchive && (
                    <DropdownMenuItem onClick={() => onUnarchive(link)}>
                      <ArchiveRestore className="mr-2 size-3.5" />
                      Restore Link
                    </DropdownMenuItem>
                  )
                ) : (
                  <DropdownMenuItem onClick={() => onArchive(link)}>
                    <Archive className="mr-2 size-3.5" />
                    Archive Link
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(link)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 size-3.5" />
                  Delete Link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];
}
