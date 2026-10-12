"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { Copy, ExternalLink, FolderSymlink, Globe, MoreHorizontal, Pencil, QrCode, Trash2 } from "lucide-react";
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
import type { DataTableFeatures } from "@/lib/data-table-features";
import type { ShortFolder, ShortLinkItem } from "@/lib/shortio/types";

import { findFolderById, getFolderColor } from "./data";

interface ColumnCallbacks {
  folders: ShortFolder[];
  onEdit: (link: ShortLinkItem) => void;
  onMoveFolder: (link: ShortLinkItem) => void;
  onDelete: (link: ShortLinkItem) => void;
  onQrCode: (link: ShortLinkItem) => void;
}

export function createLinksColumns(callbacks: ColumnCallbacks): ColumnDef<DataTableFeatures, ShortLinkItem>[] {
  const { folders, onEdit, onMoveFolder, onDelete, onQrCode } = callbacks;

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
        return (
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 font-medium text-foreground text-sm">
                <span className="font-mono">{link.shortURL}</span>
                <Button
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
          <div className="flex max-w-[320px] items-center gap-1.5 lg:max-w-[420px]">
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
