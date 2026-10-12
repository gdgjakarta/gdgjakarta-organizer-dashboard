"use client";

import * as React from "react";

import { FolderSymlink, Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ShortFolder, ShortLinkItem } from "@/lib/shortio/types";
import { moveLinkToFolderAction } from "@/server/shortio-actions";

import { getFolderColor } from "./data";

interface MoveFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: ShortLinkItem | null;
  folders: ShortFolder[];
  onLinkMoved: (updatedLink: ShortLinkItem) => void;
}

export function MoveFolderDialog({ open, onOpenChange, link, folders, onLinkMoved }: MoveFolderDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = React.useState<string>("none");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (link) {
      setSelectedFolderId(link.FolderId ?? "none");
    }
  }, [link]);

  const handleMove = () => {
    if (!link) return;

    startTransition(async () => {
      try {
        const folderId = selectedFolderId === "none" ? null : selectedFolderId;
        const res = await moveLinkToFolderAction(link.id, folderId);

        if (res.success && res.data) {
          const targetFolderName =
            folderId === null ? "Uncategorized" : (folders.find((f) => f.id === folderId)?.name ?? "selected folder");
          toast.success(`Moved to ${targetFolderName}`);
          onLinkMoved(res.data);
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Failed to move link");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error moving link");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderSymlink className="size-4" />
            </div>
            <div>
              <DialogTitle>Move to Folder</DialogTitle>
              <DialogDescription className="truncate">{link ? link.shortURL : "Organize short link"}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3 py-3">
          <Label htmlFor="target-folder">Select Target Folder</Label>
          <Select value={selectedFolderId} onValueChange={setSelectedFolderId} disabled={isPending}>
            <SelectTrigger id="target-folder">
              <SelectValue placeholder="Choose a folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-muted-foreground/40" />
                  <span>No Folder (Uncategorized)</span>
                </div>
              </SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: getFolderColor(f) }} />
                    <span>{f.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Move Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
