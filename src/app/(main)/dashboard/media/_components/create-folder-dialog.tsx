"use client";

import * as React from "react";

import { FolderPlus, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeStorageName } from "@/lib/r2/utils";
import { createMediaFolderAction } from "@/server/media-actions";

interface CreateFolderDialogProps {
  currentPrefix: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateFolderDialog({ currentPrefix, isOpen, onOpenChange, onSuccess }: CreateFolderDialogProps) {
  const [folderName, setFolderName] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);

  const formattedName = React.useMemo(() => {
    return sanitizeStorageName(folderName, true);
  }, [folderName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formattedName) {
      toast.error("Nama folder tidak boleh kosong");
      return;
    }

    setIsPending(true);
    try {
      const res = await createMediaFolderAction(currentPrefix, formattedName);
      if (res.success) {
        toast.success(`Folder '${formattedName}' berhasil dibuat`);
        setFolderName("");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error ?? "Gagal membuat folder");
      }
    } catch {
      toast.error("Terjadi kesalahan saat membuat folder");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              Buat Folder Baru
            </DialogTitle>
            <DialogDescription>
              Buat direktori baru di dalam direktori{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {currentPrefix ? `/${currentPrefix}` : "/ (Root)"}
              </code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Nama Folder</Label>
              <Input
                id="folder-name"
                placeholder="misal: devfest-2024 atau sponsors"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                autoFocus
                disabled={isPending}
              />
              <p className="text-muted-foreground text-xs">
                Nama folder otomatis diformat menjadi huruf kecil (lowercase) dan dipisahkan strip (-).
              </p>
            </div>

            {folderName.trim() && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                <span className="text-muted-foreground">Path yang akan dibuat: </span>
                <span className="font-medium font-mono text-foreground">
                  {currentPrefix}
                  {formattedName}/
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending || !formattedName}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Buat Folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
