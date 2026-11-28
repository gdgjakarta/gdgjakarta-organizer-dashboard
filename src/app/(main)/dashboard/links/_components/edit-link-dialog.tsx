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
import type { ShortFolder, ShortLinkItem, ShortlinkProviderName } from "@/lib/shortio/types";
import { updateShortLinkAction } from "@/server/shortio-actions";

import { AdvancedOptions } from "./advanced-options";
import { getFolderColor } from "./data";
import {
  advancedFromLink,
  advancedToInput,
  buildPixelsConfig,
  EMPTY_ADVANCED,
  resolveEffectiveOriginalUrl,
  validateBundleItems,
  validateGeoTargets,
  validateMaxClicks,
  validateOptionalAdvancedUrls,
  validatePixelConfig,
  validateSplitTargets,
} from "./link-form-helpers";

interface EditLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: ShortLinkItem | null;
  folders: ShortFolder[];
  primaryDomain: string;
  provider: ShortlinkProviderName;
  onLinkUpdated: (link: ShortLinkItem) => void;
}

export function EditLinkDialog({
  open,
  onOpenChange,
  link,
  folders,
  primaryDomain,
  provider,
  onLinkUpdated,
}: EditLinkDialogProps) {
  const [originalURL, setOriginalURL] = React.useState("");
  const [path, setPath] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [folderId, setFolderId] = React.useState<string>("none");
  const [tagsInput, setTagsInput] = React.useState("");
  const [advanced, setAdvanced] = React.useState(EMPTY_ADVANCED);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (link) {
      setOriginalURL(link.originalURL);
      setPath(link.path);
      setTitle(link.title ?? "");
      setFolderId(link.FolderId ?? "none");
      setTagsInput(link.tags?.join(", ") ?? "");
      setAdvanced(advancedFromLink(link));
    }
  }, [link]);

  const activeDomain = link?.hostname || primaryDomain;

  const handleUpdate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!link) return;

    const optUrlError = validateOptionalAdvancedUrls(advanced);
    if (optUrlError) {
      toast.error(optUrlError);
      return;
    }

    if (provider === "cloudflare") {
      const maxCheck = validateMaxClicks(advanced.maxClicks);
      if (!maxCheck.valid) {
        toast.error(maxCheck.error ?? "Invalid click limit");
        return;
      }
      const geoCheck = validateGeoTargets(advanced.geoTargets);
      if (!geoCheck.valid) {
        toast.error(geoCheck.error ?? "Invalid geo-targeting rule");
        return;
      }
      const pixelCheck = validatePixelConfig(buildPixelsConfig(advanced));
      if (!pixelCheck.valid) {
        toast.error(pixelCheck.error ?? "Invalid retargeting pixel config");
        return;
      }
      const splitCheck = validateSplitTargets(advanced.splitTargets, advanced.linkType);
      if (!splitCheck.valid) {
        toast.error(splitCheck.error ?? "Invalid A/B split targets");
        return;
      }
      const bundleCheck = validateBundleItems(advanced.bundleItems, advanced.linkType);
      if (!bundleCheck.valid) {
        toast.error(bundleCheck.error ?? "Invalid link bundle items");
        return;
      }
    }

    const urlResult = resolveEffectiveOriginalUrl(originalURL, advanced, provider);
    if (urlResult.error) {
      toast.error(urlResult.error);
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        const res = await updateShortLinkAction(link.id, {
          originalURL: urlResult.url,
          ...advancedToInput(advanced, true, provider),
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
  const isDestinationRequired = advanced.linkType === "redirect";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Edit3 className="size-4" />
            </div>
            <div>
              <DialogTitle>Edit Short Link</DialogTitle>
              <DialogDescription>Update destination, category folder, slug, or Pro edge rules.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleUpdate} className="grid gap-4 py-3">
          <div className="grid gap-2">
            <Label htmlFor="edit-dest-url">
              {isDestinationRequired ? (
                <>
                  Destination URL <span className="text-destructive">*</span>
                </>
              ) : (
                "Fallback Destination URL (optional — auto-filled from first item)"
              )}
            </Label>
            <Input
              id="edit-dest-url"
              type="url"
              value={originalURL}
              onChange={(e) => setOriginalURL(e.target.value)}
              disabled={isPending}
              required={isDestinationRequired}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-slug-path">Slug / Path</Label>
            <div className="flex items-center rounded-md border bg-muted/40 px-3 py-1 text-sm">
              <span className="text-muted-foreground">{activeDomain}/</span>
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
                https://{activeDomain}/{previewSlug}
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

          <AdvancedOptions
            value={advanced}
            onChange={setAdvanced}
            provider={provider}
            disabled={isPending}
            hasPassword={link?.hasPassword}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
