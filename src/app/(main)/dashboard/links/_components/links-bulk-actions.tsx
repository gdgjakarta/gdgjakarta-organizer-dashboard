"use client";

import { Archive, ArchiveRestore, CheckSquare, Copy, FolderSymlink, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ShortLinkItem } from "@/lib/shortio/types";

interface LinksBulkActionsProps {
  selectedCount: number;
  totalFilteredCount: number;
  selectedLinks: ShortLinkItem[];
  isArchivedView?: boolean;
  canUnarchive?: boolean;
  isArchiving?: boolean;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onMoveFolder: () => void;
  onDelete: () => void;
  onCopyLinks: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
}

export function LinksBulkActions({
  selectedCount,
  totalFilteredCount,
  isArchivedView = false,
  canUnarchive = false,
  isArchiving = false,
  onClearSelection,
  onSelectAll,
  onMoveFolder,
  onDelete,
  onCopyLinks,
  onArchive,
  onUnarchive,
}: LinksBulkActionsProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2 shadow-2xs transition-all duration-200">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1.5 font-medium">
          <CheckSquare className="size-3 text-primary" />
          {selectedCount} selected
        </Badge>
        {selectedCount < totalFilteredCount && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onSelectAll}
            className="h-6 text-muted-foreground text-xs hover:text-foreground"
          >
            Select all {totalFilteredCount}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onClearSelection}
          className="h-6 text-muted-foreground text-xs hover:text-foreground"
        >
          Deselect all
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={onCopyLinks}
          className="gap-1.5 font-medium shadow-2xs"
          title="Copy selected short URLs to clipboard"
        >
          <Copy className="size-3.5" />
          Copy {selectedCount > 1 ? "links" : "link"}
        </Button>

        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={onMoveFolder}
          className="gap-1.5 font-medium shadow-2xs"
        >
          <FolderSymlink className="size-3.5 text-primary" />
          Move to folder
        </Button>

        {!isArchivedView && onArchive && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onArchive}
            disabled={isArchiving}
            className="gap-1.5 font-medium shadow-2xs"
          >
            <Archive className="size-3.5" />
            Archive {selectedCount > 1 ? `(${selectedCount})` : "link"}
          </Button>
        )}

        {isArchivedView && canUnarchive && onUnarchive && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onUnarchive}
            disabled={isArchiving}
            className="gap-1.5 font-medium shadow-2xs"
          >
            <ArchiveRestore className="size-3.5 text-primary" />
            Restore {selectedCount > 1 ? `(${selectedCount})` : "link"}
          </Button>
        )}

        <Button
          type="button"
          size="xs"
          variant="destructive"
          onClick={onDelete}
          className="gap-1.5 font-medium shadow-2xs"
        >
          <Trash2 className="size-3.5" />
          Delete {selectedCount > 1 ? `(${selectedCount})` : "link"}
        </Button>
      </div>
    </div>
  );
}
