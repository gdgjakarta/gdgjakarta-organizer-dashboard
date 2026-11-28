"use client";

import * as React from "react";

import { Link2, Loader2, Shuffle } from "lucide-react";
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
import type { ShortDomain, ShortFolder, ShortLinkItem, ShortlinkProviderName } from "@/lib/shortio/types";
import { createShortLinkAction } from "@/server/shortio-actions";

import { AdvancedOptions } from "./advanced-options";
import { getFolderColor } from "./data";
import {
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

interface CreateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: ShortFolder[];
  domains?: ShortDomain[];
  primaryDomain: string;
  provider: ShortlinkProviderName;
  defaultFolderId?: string;
  onLinkCreated: (link: ShortLinkItem) => void;
}

function generateRandomSlug(length = 6): string {
  const charset = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => charset[b % charset.length]).join("");
}

export function CreateLinkDialog({
  open,
  onOpenChange,
  folders,
  domains = [],
  primaryDomain,
  provider,
  defaultFolderId,
  onLinkCreated,
}: CreateLinkDialogProps) {
  const [originalURL, setOriginalURL] = React.useState("");
  const [path, setPath] = React.useState("");
  const [hostname, setHostname] = React.useState(primaryDomain);
  const [title, setTitle] = React.useState("");
  const [folderId, setFolderId] = React.useState<string>(defaultFolderId ?? "none");
  const [tagsInput, setTagsInput] = React.useState("");
  const [advanced, setAdvanced] = React.useState(EMPTY_ADVANCED);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setHostname(primaryDomain);
  }, [primaryDomain]);

  React.useEffect(() => {
    if (defaultFolderId) {
      setFolderId(defaultFolderId);
    }
  }, [defaultFolderId]);

  const activeDomain = hostname || primaryDomain;

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();

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
        const res = await createShortLinkAction({
          originalURL: urlResult.url,
          ...advancedToInput(advanced, false, provider),
          ...(provider === "cloudflare" && activeDomain !== primaryDomain ? { hostname: activeDomain } : {}),
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
          setAdvanced(EMPTY_ADVANCED);
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
  const isDestinationRequired = advanced.linkType === "redirect";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Link2 className="size-4" />
            </div>
            <div>
              <DialogTitle>Create Short Link</DialogTitle>
              <DialogDescription>Generate a branded short link under {activeDomain}.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleCreate} className="grid gap-4 py-3">
          {provider === "cloudflare" && domains.length > 1 && (
            <div className="grid gap-2">
              <Label htmlFor="create-link-domain">Domain</Label>
              <Select value={activeDomain} onValueChange={setHostname} disabled={isPending}>
                <SelectTrigger id="create-link-domain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.hostname}>
                      {d.hostname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="dest-url">
              {isDestinationRequired ? (
                <>
                  Destination URL <span className="text-destructive">*</span>
                </>
              ) : (
                "Fallback Destination URL (optional — auto-filled from first item)"
              )}
            </Label>
            <Input
              id="dest-url"
              type="url"
              placeholder="https://example.com/very-long-url-path"
              value={originalURL}
              onChange={(e) => setOriginalURL(e.target.value)}
              disabled={isPending}
              required={isDestinationRequired}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="slug-path">Custom Slug / Path (Optional)</Label>
            <div className="flex items-center rounded-md border bg-muted/40 px-3 py-1 text-sm">
              <span className="shrink-0 text-muted-foreground">{activeDomain}/</span>
              <Input
                id="slug-path"
                placeholder="custom-slug"
                value={path}
                onChange={(e) => setPath(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                className="h-7 border-0 bg-transparent p-0 focus-visible:ring-0"
                disabled={isPending}
              />
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="ml-2 h-6 shrink-0 gap-1 px-2 text-[11px]"
                disabled={isPending}
                onClick={() => setPath(generateRandomSlug())}
              >
                <Shuffle className="size-3" />
                Generate
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Preview:{" "}
              <span className="font-mono text-foreground">
                https://{activeDomain}/{previewSlug}
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

          <AdvancedOptions value={advanced} onChange={setAdvanced} provider={provider} disabled={isPending} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Generate Short Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
