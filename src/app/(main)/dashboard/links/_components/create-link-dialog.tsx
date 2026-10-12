"use client";

import * as React from "react";

import { Link2, Loader2 } from "lucide-react";
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
import { createShortLinkAction } from "@/server/shortio-actions";

import { getFolderColor } from "./data";

interface CreateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: ShortFolder[];
  defaultFolderId?: string;
  onLinkCreated: (link: ShortLinkItem) => void;
}

export function CreateLinkDialog({
  open,
  onOpenChange,
  folders,
  defaultFolderId,
  onLinkCreated,
}: CreateLinkDialogProps) {
  const [originalURL, setOriginalURL] = React.useState("");
  const [path, setPath] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [folderId, setFolderId] = React.useState<string>(defaultFolderId ?? "none");
  const [tagsInput, setTagsInput] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (defaultFolderId) {
      setFolderId(defaultFolderId);
    }
  }, [defaultFolderId]);

  const handleCreate = () => {
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
        const res = await createShortLinkAction({
          originalURL: trimmedUrl,
          path: path.trim() || undefined,
          title: title.trim() || undefined,
          folderId: folderId === "none" ? undefined : folderId,
          tags: tags.length > 0 ? tags : undefined,
        });

        if (res.success && res.data) {
          toast.success("Short link created successfully!");
          void navigator.clipboard.writeText(res.data.shortURL);
          toast.info(`Copied to clipboard: ${res.data.shortURL}`);
          onLinkCreated(res.data);
          setOriginalURL("");
          setPath("");
          setTitle("");
          setTagsInput("");
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Failed to create short link");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error creating short link");
      }
    });
  };

  const previewSlug = path.trim() || "your-slug";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Link2 className="size-4" />
            </div>
            <div>
              <DialogTitle>Create Short Link</DialogTitle>
              <DialogDescription>Generate a branded short link under {SHORTIO_CONFIG.domain}.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-3">
          <div className="grid gap-2">
            <Label htmlFor="dest-url">
              Destination URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dest-url"
              type="url"
              placeholder="https://example.com/very-long-url-path"
              value={originalURL}
              onChange={(e) => setOriginalURL(e.target.value)}
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="slug-path">Custom Slug / Path (Optional)</Label>
            <div className="flex items-center rounded-md border bg-muted/40 px-3 py-1 text-sm">
              <span className="text-muted-foreground">{SHORTIO_CONFIG.domain}/</span>
              <Input
                id="slug-path"
                placeholder="custom-slug"
                value={path}
                onChange={(e) => setPath(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                className="h-7 border-0 bg-transparent p-0 focus-visible:ring-0"
                disabled={isPending}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Preview:{" "}
              <span className="font-mono text-foreground">
                https://{SHORTIO_CONFIG.domain}/{previewSlug}
              </span>
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="link-title">Title (Optional)</Label>
            <Input
              id="link-title"
              placeholder="e.g. GDG Jakarta DevFest Speaker Submission"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="link-folder">Category Folder</Label>
            <Select value={folderId} onValueChange={setFolderId} disabled={isPending}>
              <SelectTrigger id="link-folder">
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
            <Label htmlFor="link-tags">Tags (Optional, comma-separated)</Label>
            <Input
              id="link-tags"
              placeholder="event, speaker, devfest"
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
          <Button onClick={handleCreate} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Generate Short Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
