"use client";

import { AlertTriangle, RefreshCw, Save } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
  saving?: boolean;
  title?: string;
  description?: string;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onCancel,
  onDiscard,
  onSave,
  saving = false,
  title = "Unsaved Changes",
  description = "You have unsaved changes. If you leave this page now, your changes will be discarded.",
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <AlertDialogTitle className="font-semibold text-base">{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-0.5 text-muted-foreground text-xs">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel onClick={onCancel} disabled={saving} className="mt-0 text-xs sm:text-sm">
            Keep Editing
          </AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            onClick={onDiscard}
            disabled={saving}
            className="border-destructive/20 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive sm:text-sm"
          >
            Discard & Leave
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onSave}
            disabled={saving}
            className="gap-1.5 font-semibold text-xs sm:text-sm"
          >
            {saving ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                <span>Save & Leave</span>
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
