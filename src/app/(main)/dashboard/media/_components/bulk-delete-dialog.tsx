"use client";

import * as React from "react";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bulkDeleteMediaAction } from "@/server/media-actions";

interface BulkDeleteDialogProps {
  selectedKeys: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BulkDeleteDialog({ selectedKeys, isOpen, onOpenChange, onSuccess }: BulkDeleteDialogProps) {
  const [isPending, setIsPending] = React.useState(false);

  const handleBulkDelete = async () => {
    if (selectedKeys.length === 0) return;

    setIsPending(true);
    try {
      const res = await bulkDeleteMediaAction(selectedKeys);
      if (res.success) {
        toast.success(`Successfully deleted ${res.deletedCount ?? selectedKeys.length} selected file(s)`);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error ?? "Failed to delete selected files");
      }
    } catch {
      toast.error("Error deleting files");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Bulk Delete ({selectedKeys.length}) Files
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{selectedKeys.length} selected file(s)</span>? This action
            is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive text-xs">
          <p className="font-medium">Bulk Deletion Confirmation</p>
          <p className="mt-1">All selected objects will be permanently removed from Cloudflare R2.</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete {selectedKeys.length} Files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
