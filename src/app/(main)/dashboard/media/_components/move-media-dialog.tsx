"use client";

import * as React from "react";

import { Folder, HardDrive, Loader2, Move } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { FolderItem, MediaItem } from "@/lib/r2/types";
import { normalizePrefix } from "@/lib/r2/utils";
import { moveMediaObjectAction } from "@/server/media-actions";

interface MoveMediaDialogProps {
  item: MediaItem | null;
  availableFolders: FolderItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MoveMediaDialog({ item, availableFolders, isOpen, onOpenChange, onSuccess }: MoveMediaDialogProps) {
  const [selectedFolderPrefix, setSelectedFolderPrefix] = React.useState<string>("");
  const [isPending, setIsPending] = React.useState(false);

  React.useEffect(() => {
    if (item) {
      setSelectedFolderPrefix(item.folder);
    }
  }, [item]);

  if (!item) return null;

  const currentFolder = normalizePrefix(item.folder);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFolderPrefix === currentFolder) {
      onOpenChange(false);
      return;
    }

    setIsPending(true);
    try {
      const res = await moveMediaObjectAction(item.key, selectedFolderPrefix);
      if (res.success) {
        toast.success(`Berkas berhasil dipindahkan ke ${selectedFolderPrefix ? `/${selectedFolderPrefix}` : "/Root"}`);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error ?? "Gagal memindahkan berkas");
      }
    } catch {
      toast.error("Terjadi kesalahan saat memindahkan berkas");
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
              <Move className="h-5 w-5 text-primary" />
              Pindahkan Berkas
            </DialogTitle>
            <DialogDescription>
              Pilih folder tujuan untuk memindahkan berkas{" "}
              <span className="font-medium text-foreground">{item.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Label>Pilih Direktori Tujuan</Label>
            <RadioGroup
              value={selectedFolderPrefix}
              onValueChange={setSelectedFolderPrefix}
              className="max-h-60 space-y-1.5 overflow-y-auto rounded-lg border p-2"
            >
              {/* Root option */}
              <div
                className={`flex items-center space-x-2.5 rounded-md p-2 transition-colors hover:bg-muted ${
                  selectedFolderPrefix === "" ? "bg-muted font-medium" : ""
                }`}
              >
                <RadioGroupItem value="" id="folder-root" />
                <Label htmlFor="folder-root" className="flex cursor-pointer items-center gap-2 font-normal text-xs">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span>/ (Root Directory)</span>
                </Label>
              </div>

              {/* Subfolders */}
              {availableFolders.map((folder) => (
                <div
                  key={folder.prefix}
                  className={`flex items-center space-x-2.5 rounded-md p-2 transition-colors hover:bg-muted ${
                    selectedFolderPrefix === folder.prefix ? "bg-muted font-medium" : ""
                  }`}
                >
                  <RadioGroupItem value={folder.prefix} id={`folder-${folder.prefix}`} />
                  <Label
                    htmlFor={`folder-${folder.prefix}`}
                    className="flex cursor-pointer items-center gap-2 truncate font-normal text-xs"
                  >
                    <Folder className="h-4 w-4 shrink-0 fill-primary/20 text-primary" />
                    <span className="truncate">/{folder.prefix}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending || selectedFolderPrefix === currentFolder}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pindahkan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
