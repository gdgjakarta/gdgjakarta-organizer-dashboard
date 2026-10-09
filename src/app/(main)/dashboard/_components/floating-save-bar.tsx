"use client";

import type React from "react";

import { Check, RefreshCw, RotateCcw, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FloatingSaveBarProps {
  isDirty?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
  savingLabel?: string;
  savedLabel?: string;
  discardLabel?: string;
  unsavedBadgeLabel?: string;
  savedBadgeLabel?: string;
  statusInfo?: React.ReactNode;
  helperText?: React.ReactNode;
  extraActions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function FloatingSaveBar({
  isDirty = false,
  isSaving = false,
  onSave,
  onDiscard,
  saveLabel = "Save Changes",
  savingLabel = "Saving...",
  savedLabel = "All Saved",
  discardLabel = "Discard",
  unsavedBadgeLabel = "Unsaved Changes",
  savedBadgeLabel = "All Saved",
  statusInfo,
  helperText,
  extraActions,
  className,
  children,
}: FloatingSaveBarProps) {
  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 left-4 z-40 mx-auto max-w-4xl rounded-2xl border border-border/80 bg-background/95 p-3.5 shadow-xl backdrop-blur-md transition-all sm:left-64",
        className,
      )}
    >
      {children ? (
        children
      ) : (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isDirty ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                </span>
                {unsavedBadgeLabel}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              >
                <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                {savedBadgeLabel}
              </Badge>
            )}

            {statusInfo && (
              <>
                <span className="hidden text-muted-foreground/40 sm:inline">•</span>
                <span className="text-[11px] text-muted-foreground">{statusInfo}</span>
              </>
            )}

            {helperText && <span className="hidden text-[11px] text-muted-foreground sm:inline">{helperText}</span>}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {extraActions}

            {isDirty && onDiscard && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDiscard}
                disabled={isSaving}
                className="text-xs"
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                {discardLabel}
              </Button>
            )}

            {onSave && (
              <Button
                type="button"
                size="sm"
                disabled={!isDirty || isSaving}
                onClick={onSave}
                className="font-semibold text-xs"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                    {savingLabel}
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 size-3.5" />
                    {isDirty ? saveLabel : savedLabel}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
