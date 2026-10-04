"use client";

import { CheckSquare, ChevronDown, Copy, Download, FileJson, FileSpreadsheet, Mail, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface MembersBulkActionsProps {
  selectedCount: number;
  totalFilteredCount: number;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onExportCsv: (onlySelected: boolean) => void;
  onExportJson: (onlySelected: boolean) => void;
  onCopyEmails: () => void;
  onBulkSyncBevy: () => Promise<void>;
  onEmailSelected: () => void;
  isBulkSyncing: boolean;
}

export function MembersBulkActions({
  selectedCount,
  totalFilteredCount,
  onClearSelection,
  onSelectAll,
  onExportCsv,
  onExportJson,
  onCopyEmails,
  onBulkSyncBevy,
  onEmailSelected,
  isBulkSyncing,
}: MembersBulkActionsProps) {
  if (selectedCount === 0) {
    return (
      <div className="flex items-center justify-between gap-3 px-4">
        <div className="text-muted-foreground text-sm tabular-nums">0 selected</div>
      </div>
    );
  }

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
        {/* Export selected members dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="xs" variant="outline" className="gap-1.5 font-medium shadow-2xs">
              <Download className="size-3.5 text-primary" />
              Export selected ({selectedCount})
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExportCsv(true)} className="gap-2">
              <FileSpreadsheet className="size-3.5" />
              Export as CSV ({selectedCount})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExportJson(true)} className="gap-2">
              <FileJson className="size-3.5" />
              Export as JSON ({selectedCount})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Copy selected emails */}
        <Button
          size="xs"
          variant="outline"
          onClick={onCopyEmails}
          className="gap-1.5 font-medium shadow-2xs"
          title="Copy selected email addresses to clipboard"
        >
          <Copy className="size-3.5" />
          Copy emails
        </Button>

        {/* Bulk sync selected members to Bevy */}
        <Button
          size="xs"
          variant="outline"
          onClick={() => void onBulkSyncBevy()}
          disabled={isBulkSyncing}
          className="gap-1.5 font-medium shadow-2xs"
          title="Verify or import selected members with Bevy"
        >
          <RefreshCw className={cn("size-3.5", isBulkSyncing && "animate-spin text-primary")} />
          Sync with Bevy
        </Button>

        {/* Send email to selected members */}
        <Button
          size="xs"
          variant="outline"
          onClick={onEmailSelected}
          className="gap-1.5 font-medium shadow-2xs"
          title="Compose email to selected members (BCC)"
        >
          <Mail className="size-3.5" />
          Send email
        </Button>
      </div>
    </div>
  );
}
