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
        toast.success(`Berhasil menghapus ${res.deletedCount ?? selectedKeys.length} berkas terpilih`);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error ?? "Gagal menghapus berkas terpilih");
      }
    } catch {
      toast.error("Terjadi kesalahan saat menghapus berkas");
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
            Hapus Masal ({selectedKeys.length}) Berkas
          </DialogTitle>
          <DialogDescription>
            Apakah Anda yakin ingin menghapus{" "}
            <span className="font-semibold text-foreground">{selectedKeys.length} berkas</span> yang dipilih? Tindakan
            ini bersifat permanen dan tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive text-xs">
          <p className="font-medium">Konfirmasi Penghapusan Masal</p>
          <p className="mt-1">Semua objek yang dipilih akan dihapus dari Cloudflare R2 secara bersamaan.</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button type="button" variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Hapus {selectedKeys.length} Berkas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
