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
          toast.success(`Folder '${targetName}' beserta isinya berhasil dihapus`);
          onOpenChange(false);
          onSuccess();
        } else {
          toast.error(res.error ?? "Gagal menghapus folder");
        }
      } else {
        const res = await deleteMediaObjectAction(targetKey);
        if (res.success) {
          toast.success(`Berkas '${targetName}' berhasil dihapus`);
          onOpenChange(false);
          onSuccess();
        } else {
          toast.error(res.error ?? "Gagal menghapus berkas");
        }
      }
    } catch {
      toast.error("Terjadi kesalahan saat menghapus data");
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
            Hapus {isFolderDelete ? "Folder" : "Berkas"}
          </DialogTitle>
          <DialogDescription>
            {isFolderDelete ? (
              <span>
                Apakah Anda yakin ingin menghapus folder{" "}
                <span className="font-semibold text-foreground">/{targetName}</span>? Semua berkas dan subfolder di
                dalamnya akan dihapus permanen dari Cloudflare R2.
              </span>
            ) : (
              <span>
                Apakah Anda yakin ingin menghapus berkas{" "}
                <span className="font-semibold text-foreground">{targetName}</span>? Tindakan ini tidak dapat
                dibatalkan.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive text-xs">
          <p className="font-medium">Peringatan Penghapusan Permanen</p>
          <p className="mt-1">
            Data yang dihapus dari bucket R2 tidak dapat dipulihkan. Pastikan Anda tidak memerlukan aset ini lagi.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Hapus Permanen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
