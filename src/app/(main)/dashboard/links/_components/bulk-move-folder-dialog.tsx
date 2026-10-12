"use client";

import * as React from "react";

import { FolderSymlink, Globe, Loader2 } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ShortFolder, ShortLinkItem } from "@/lib/shortio/types";
import { bulkMoveLinksToFolderAction } from "@/server/shortio-actions";

import { getFolderColor } from "./data";

interface BulkMoveFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: ShortLinkItem[];
  folders: ShortFolder[];
  onLinksMoved: (updatedLinks: ShortLinkItem[]) => void;
}

export function BulkMoveFolderDialog({ open, onOpenChange, links, folders, onLinksMoved }: BulkMoveFolderDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = React.useState<string>("none");
  const [isPending, startTransition] = React.useTransition();

  const handleMove = () => {
    if (links.length === 0) return;

    startTransition(async () => {
      try {
        const folderId = selectedFolderId === "none" ? null : selectedFolderId;
        const linkIds = links.map((l) => l.id);
        const res = await bulkMoveLinksToFolderAction(linkIds, folderId);

        if (res.success && res.updatedLinks.length > 0) {
          const targetFolderName =
            folderId === null ? "Uncategorized" : (folders.find((f) => f.id === folderId)?.name ?? "selected folder");
          toast.success(`Moved ${res.updatedCount} link${res.updatedCount === 1 ? "" : "s"} to ${targetFolderName}`);
          if (res.error) {
            toast.warning(res.error);
          }
          onLinksMoved(res.updatedLinks);
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Failed to move selected links");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error moving links");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderSymlink className="size-4" />
            </div>
            <div>
              <DialogTitle>Move Links to Folder</DialogTitle>
              <DialogDescription>
                Assign {links.length} selected link{links.length === 1 ? "" : "s"} to a category folder.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="bulk-target-folder">Target Folder</Label>
            <Select value={selectedFolderId} onValueChange={setSelectedFolderId} disabled={isPending}>
              <SelectTrigger id="bulk-target-folder">
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

          <div className="grid gap-2">
            <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Selected Links ({links.length})
            </span>
            <ScrollArea className="max-h-40 rounded-md border bg-muted/20 p-2.5">
              <div className="divide-y divide-border/40">
                {links.map((link) => (
                  <div key={link.id} className="flex min-w-0 flex-col gap-0.5 py-1.5 first:pt-0 last:pb-0">
                    <span className="truncate font-medium font-mono text-foreground text-xs">{link.shortURL}</span>
                    <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Globe className="size-3 shrink-0 opacity-60" />
                      <span className="truncate">{link.originalURL}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={isPending || links.length === 0}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Move {links.length} Link{links.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
