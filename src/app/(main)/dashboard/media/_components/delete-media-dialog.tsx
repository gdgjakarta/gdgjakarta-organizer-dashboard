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
import type { FolderItem, MediaItem } from "@/lib/r2/types";
import { deleteMediaFolderAction, deleteMediaObjectAction } from "@/server/media-actions";

interface DeleteMediaDialogProps {
  item: MediaItem | null;
  folder: FolderItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteMediaDialog({ item, folder, isOpen, onOpenChange, onSuccess }: DeleteMediaDialogProps) {
  const [isPending, setIsPending] = React.useState(false);

  const isFolderDelete = Boolean(folder);
  const targetName = folder ? folder.name : item?.name;
  const targetKey = folder ? folder.prefix : item?.key;

  if (!item && !folder) return null;

  const handleDelete = async () => {
    if (!targetKey) return;

    setIsPending(true);
    try {
      if (isFolderDelete) {
        const res = await deleteMediaFolderAction(targetKey);
        if (res.success) {
          toast.success(`Folder '${targetName}' and its contents deleted successfully`);
          onOpenChange(false);
          onSuccess();
        } else {
          toast.error(res.error ?? "Failed to delete folder");
        }
      } else {
        const res = await deleteMediaObjectAction(targetKey);
        if (res.success) {
          toast.success(`File '${targetName}' deleted successfully`);
          onOpenChange(false);
          onSuccess();
        } else {
          toast.error(res.error ?? "Failed to delete file");
        }
      }
    } catch {
      toast.error("Error deleting item");
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
            Delete {isFolderDelete ? "Folder" : "File"}
          </DialogTitle>
          <DialogDescription>
            {isFolderDelete ? (
              <span>
                Are you sure you want to delete folder{" "}
                <span className="font-semibold text-foreground">/{targetName}</span>? All files and subfolders within it
                will be permanently deleted from Cloudflare R2.
              </span>
            ) : (
              <span>
                Are you sure you want to delete file <span className="font-semibold text-foreground">{targetName}</span>
                ? This action cannot be undone.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive text-xs">
          <p className="font-medium">Permanent Deletion Warning</p>
          <p className="mt-1">
            Data deleted from Cloudflare R2 cannot be recovered. Make sure you no longer need this asset.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete Permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
