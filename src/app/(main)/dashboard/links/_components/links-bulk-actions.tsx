"use client";

import { CheckSquare, Copy, FolderSymlink, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ShortLinkItem } from "@/lib/shortio/types";

interface LinksBulkActionsProps {
  selectedCount: number;
  totalFilteredCount: number;
  selectedLinks: ShortLinkItem[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  onMoveFolder: () => void;
  onDelete: () => void;
  onCopyLinks: () => void;
}

export function LinksBulkActions({
  selectedCount,
  totalFilteredCount,
  onClearSelection,
  onSelectAll,
  onMoveFolder,
  onDelete,
  onCopyLinks,
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
            variant="ghost"
            size="xs"
            onClick={onSelectAll}
            className="h-6 text-muted-foreground text-xs hover:text-foreground"
          >
            Select all {totalFilteredCount}
          </Button>
        )}
        <Button
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
          size="xs"
          variant="outline"
          onClick={onCopyLinks}
          className="gap-1.5 font-medium shadow-2xs"
          title="Copy selected short URLs to clipboard"
        >
          <Copy className="size-3.5" />
          Copy {selectedCount > 1 ? "links" : "link"}
        </Button>

        <Button size="xs" variant="outline" onClick={onMoveFolder} className="gap-1.5 font-medium shadow-2xs">
          <FolderSymlink className="size-3.5 text-primary" />
          Move to folder
        </Button>

        <Button size="xs" variant="destructive" onClick={onDelete} className="gap-1.5 font-medium shadow-2xs">
          <Trash2 className="size-3.5" />
          Delete {selectedCount > 1 ? `(${selectedCount})` : "link"}
        </Button>
      </div>
    </div>
  );
}
