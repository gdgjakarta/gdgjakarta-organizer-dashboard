"use client";

import * as React from "react";

import { Edit3, Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SHORTIO_CONFIG } from "@/config/shortio-config";
import type { ShortFolder, ShortLinkItem } from "@/lib/shortio/types";
import { updateShortLinkAction } from "@/server/shortio-actions";

import { getFolderColor } from "./data";

interface EditLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: ShortLinkItem | null;
  folders: ShortFolder[];
  onLinkUpdated: (link: ShortLinkItem) => void;
}

export function EditLinkDialog({ open, onOpenChange, link, folders, onLinkUpdated }: EditLinkDialogProps) {
  const [originalURL, setOriginalURL] = React.useState("");
  const [path, setPath] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [folderId, setFolderId] = React.useState<string>("none");
  const [tagsInput, setTagsInput] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (link) {
      setOriginalURL(link.originalURL);
      setPath(link.path);
      setTitle(link.title ?? "");
      setFolderId(link.FolderId ?? "none");
      setTagsInput(link.tags?.join(", ") ?? "");
    }
  }, [link]);

  const handleUpdate = () => {
    if (!link) return;

    const trimmedUrl = originalURL.trim();
    if (!trimmedUrl) {
      toast.error("Please provide a destination URL");
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      toast.error("Invalid destination URL. Make sure it includes http:// or https://");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        const res = await updateShortLinkAction(link.id, {
          originalURL: trimmedUrl,
          path: path.trim() || undefined,
          title: title.trim() || undefined,
          folderId: folderId === "none" ? null : folderId,
          tags,
        });

        if (res.success && res.data) {
          toast.success("Short link updated successfully!");
          onLinkUpdated(res.data);
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Failed to update short link");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error updating short link");
      }
    });
  };

  const previewSlug = path.trim() || link?.path || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Edit3 className="size-4" />
            </div>
            <div>
              <DialogTitle>Edit Short Link</DialogTitle>
              <DialogDescription>Update destination, category folder, or slug.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-3">
          <div className="grid gap-2">
            <Label htmlFor="edit-dest-url">
              Destination URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-dest-url"
              type="url"
              value={originalURL}
              onChange={(e) => setOriginalURL(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-slug-path">Slug / Path</Label>
            <div className="flex items-center rounded-md border bg-muted/40 px-3 py-1 text-sm">
              <span className="text-muted-foreground">{SHORTIO_CONFIG.domain}/</span>
              <Input
                id="edit-slug-path"
                value={path}
                onChange={(e) => setPath(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                className="h-7 border-0 bg-transparent p-0 focus-visible:ring-0"
                disabled={isPending}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Live link:{" "}
              <span className="font-mono text-foreground">
                https://{SHORTIO_CONFIG.domain}/{previewSlug}
              </span>
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-link-title">Title</Label>
            <Input id="edit-link-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isPending} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-link-folder">Category Folder</Label>
            <Select value={folderId} onValueChange={setFolderId} disabled={isPending}>
              <SelectTrigger id="edit-link-folder">
                <SelectValue placeholder="Select folder" />
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
            <Label htmlFor="edit-link-tags">Tags (comma-separated)</Label>
            <Input
              id="edit-link-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
