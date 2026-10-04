"use client";

import Link from "next/link";

import { CheckSquare, ChevronDown, Copy, Download, ExternalLink, Eye, FileJson, FileSpreadsheet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { EventRow } from "./data";

interface EventsBulkActionsProps {
  selectedCount: number;
  totalFilteredCount: number;
  selectedEvents: EventRow[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onCopyLinks: () => void;
}

export function EventsBulkActions({
  selectedCount,
  totalFilteredCount,
  selectedEvents,
  onClearSelection,
  onSelectAll,
  onExportCsv,
  onExportJson,
  onCopyLinks,
}: EventsBulkActionsProps) {
  if (selectedCount === 0) {
    return (
      <div className="flex items-center gap-3 px-4">
        <div className="text-muted-foreground text-sm tabular-nums">0 selected</div>
      </div>
    );
  }

  const singleEvent = selectedCount === 1 ? selectedEvents[0] : null;

  return (
    <div className="mx-4 flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2 shadow-2xs transition-all duration-200">
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
        {/* If exactly 1 event is selected, provide quick navigation actions */}
        {singleEvent && (
          <>
            <Button size="xs" variant="outline" asChild className="gap-1.5 font-medium shadow-2xs">
              <Link href={`/dashboard/events/${singleEvent.id}`}>
                <Eye className="size-3.5 text-primary" />
                View details
              </Link>
            </Button>
            {singleEvent.url && (
              <Button size="xs" variant="outline" asChild className="gap-1.5 font-medium shadow-2xs">
                <a href={singleEvent.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  Bevy page
                </a>
              </Button>
            )}
          </>
        )}

        {/* Copy selected event links */}
        <Button
          size="xs"
          variant="outline"
          onClick={onCopyLinks}
          className="gap-1.5 font-medium shadow-2xs"
          title="Copy selected event URLs to clipboard"
        >
          <Copy className="size-3.5" />
          Copy {selectedCount > 1 ? "links" : "link"}
        </Button>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="xs" variant="outline" className="gap-1.5 font-medium shadow-2xs">
              <Download className="size-3.5 text-primary" />
              Export ({selectedCount})
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportCsv} className="gap-2">
              <FileSpreadsheet className="size-3.5" />
              Export as CSV ({selectedCount})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportJson} className="gap-2">
              <FileJson className="size-3.5" />
              Export as JSON ({selectedCount})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
