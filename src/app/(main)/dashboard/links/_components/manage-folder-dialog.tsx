"use client";

import * as React from "react";

import { FolderCog, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShortFolder } from "@/lib/shortio/types";
import { deleteShortFolderAction, updateShortFolderAction } from "@/server/shortio-actions";

import { COLOR_PALETTE, getFolderColor } from "./data";

interface ManageFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: ShortFolder | null;
  onFolderUpdated: (folder: ShortFolder) => void;
  onFolderDeleted: (folderId: string) => void;
}

export function ManageFolderDialog({
  open,
  onOpenChange,
  folder,
  onFolderUpdated,
  onFolderDeleted,
}: ManageFolderDialogProps) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("#0693E3");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (folder) {
      setName(folder.name);
      setColor(getFolderColor(folder));
    }
  }, [folder]);

  if (!folder) return null;

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Please enter a folder name");
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateShortFolderAction(folder.id, {
          name: trimmedName,
          color: color.trim() || "#0693E3",
        });

        if (res.success && res.data) {
          toast.success(`Folder "${res.data.name}" updated`);
          onFolderUpdated(res.data);
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Failed to update folder");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error updating folder");
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const res = await deleteShortFolderAction(folder.id);
        if (res.success) {
          toast.success(`Folder "${folder.name}" deleted`);
          onFolderDeleted(folder.id);
          setConfirmDeleteOpen(false);
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Failed to delete folder");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error deleting folder");
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FolderCog className="size-4" />
              </div>
              <div>
                <DialogTitle>Manage Folder</DialogTitle>
                <DialogDescription>Rename, recolor, or delete this category folder.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="grid gap-4 py-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-folder-name">Folder Name</Label>
              <Input
                id="edit-folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Folder Color Accent</Label>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    className={`size-7 rounded-full border transition-all ${
                      color === c ? "scale-110 ring-2 ring-primary ring-offset-2" : "opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Label htmlFor="edit-folder-hex" className="text-muted-foreground text-xs">
                  Custom Hex:
                </Label>
                <Input
                  id="edit-folder-hex"
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-28 font-mono text-xs"
                  disabled={isPending}
                />
              </div>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={isPending}
                className="gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Delete Folder
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save Folder
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder &ldquo;{folder.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Short links inside this folder will not be deleted — they will become uncategorized and remain active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete Folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
