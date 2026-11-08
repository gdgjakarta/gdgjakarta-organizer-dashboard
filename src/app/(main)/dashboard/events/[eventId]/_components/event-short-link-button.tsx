"use client";

import * as React from "react";

import { Check, ChevronDown, Copy, Edit2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBevyLiveEventUrl } from "@/config/remote-config-utils";
import type { ShortLinkItem } from "@/lib/shortio/types";
import {
  generateEventShortLinkAction,
  getEventShortLinksAction,
  updateEventShortLinkAction,
} from "@/server/shortio-actions";

interface EventShortLinkButtonProps {
  event: {
    id: string;
    title: string;
    url?: string;
    static_url?: string;
    tags?: string[];
  };
  isOrganizer?: boolean;
}

export function EventShortLinkButton({ event, isOrganizer = true }: EventShortLinkButtonProps) {
  const [liveShortLink, setLiveShortLink] = React.useState<ShortLinkItem | null>(null);
  const [bevyShortLink, setBevyShortLink] = React.useState<ShortLinkItem | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState<"live" | "bevy" | null>(null);
  const [copiedType, setCopiedType] = React.useState<"live" | "bevy" | null>(null);

  // Edit slug dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editType, setEditType] = React.useState<"live" | "bevy">("live");
  const [slugInput, setSlugInput] = React.useState("");
  const [isSavingSlug, setIsSavingSlug] = React.useState(false);

  const liveBevyUrl = React.useMemo(
    () =>
      getBevyLiveEventUrl({
        url: event.url,
        static_url: event.static_url,
        id: event.id,
      }),
    [event],
  );

  // Always point to production canonical URL
  const getLiveUrl = React.useCallback(() => {
    return `https://gdgjakarta.org/events/${event.id}`;
  }, [event.id]);

  // Load existing short links on mount
  React.useEffect(() => {
    let isMounted = true;

    async function checkLinks() {
      if (!isOrganizer) return;
      try {
        const liveUrl = getLiveUrl();
        const res = await getEventShortLinksAction({
          liveUrl,
          bevyUrl: liveBevyUrl || undefined,
        });

        if (isMounted && res.success && res.data) {
          setLiveShortLink(res.data.liveShortLink ?? null);
          setBevyShortLink(res.data.bevyShortLink ?? null);
        }
      } catch (err) {
        console.error("[EventShortLinkButton] Error checking short links:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void checkLinks();

    return () => {
      isMounted = false;
    };
  }, [isOrganizer, getLiveUrl, liveBevyUrl]);

  const handleCopyLink = (link: ShortLinkItem, type: "live" | "bevy") => {
    void navigator.clipboard.writeText(link.shortURL);
    setCopiedType(type);
    toast.success(`Copied ${type === "live" ? "Live page" : "Bevy page"} short link: ${link.shortURL}`);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleGenerateLink = async (type: "live" | "bevy") => {
    const destinationUrl = type === "live" ? getLiveUrl() : liveBevyUrl;
    if (!destinationUrl) {
      toast.error("Destination URL not found for this event");
      return;
    }

    setIsGenerating(type);
    const toastId = toast.loading(`Generating short link for ${type === "live" ? "Live page" : "Bevy page"}...`);

    try {
      const res = await generateEventShortLinkAction({
        eventId: event.id,
        type,
        originalURL: destinationUrl,
        title: event.title,
        tags: event.tags,
      });

      if (res.success && res.data) {
        if (type === "live") {
          setLiveShortLink(res.data);
        } else {
          setBevyShortLink(res.data);
        }

        void navigator.clipboard.writeText(res.data.shortURL);
        toast.success(`Short link generated & copied: ${res.data.shortURL}`, { id: toastId });
      } else {
        toast.error(res.error ?? "Failed to generate short link", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error generating short link", { id: toastId });
    } finally {
      setIsGenerating(null);
    }
  };

  const openEditDialog = (type: "live" | "bevy", currentPath?: string) => {
    setEditType(type);
    setSlugInput(currentPath ?? "");
    setIsEditDialogOpen(true);
  };

  const handleSaveSlug = async () => {
    const cleanSlug = slugInput.trim().replace(/^\//, "");
    if (!cleanSlug) {
      toast.error("Custom slug cannot be empty");
      return;
    }

    const currentLink = editType === "live" ? liveShortLink : bevyShortLink;
    setIsSavingSlug(true);
    const toastId = toast.loading("Updating short link slug...");

    try {
      const res = await updateEventShortLinkAction({
        eventId: event.id,
        type: editType,
        linkId: currentLink?.idString || currentLink?.id,
        currentPath: currentLink?.path,
        newSlug: cleanSlug,
      });

      if (res.success && res.data) {
        if (editType === "live") {
          setLiveShortLink(res.data);
        } else {
          setBevyShortLink(res.data);
        }
        setIsEditDialogOpen(false);
        toast.success(`Short link updated: ${res.data.shortURL}`, { id: toastId });
      } else {
        toast.error(res.error ?? "Failed to update short link slug", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating short link", { id: toastId });
    } finally {
      setIsSavingSlug(false);
    }
  };

  if (!isOrganizer) return null;

  const hasAnyLink = Boolean(liveShortLink || bevyShortLink);
  const hasLiveLink = Boolean(liveShortLink);
  const hasBevyLink = Boolean(bevyShortLink);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={isLoading}>
            {isLoading && <Loader2 className="size-3.5 animate-spin" />}
            {!isLoading && hasAnyLink && <Copy className="size-3.5 text-emerald-500" />}
            {!isLoading && !hasAnyLink && <Sparkles className="size-3.5 text-primary" />}

            <span>
              <span className="hidden sm:inline">{hasAnyLink ? "Copy Short Link" : "Generate Short Link"}</span>
              <span className="sm:hidden">{hasAnyLink ? "Short Link" : "Generate Link"}</span>
            </span>

            {hasAnyLink && (
              <Badge variant="secondary" className="px-1 py-0 font-mono text-[10px]">
                {[hasLiveLink && "Live", hasBevyLink && "Bevy"].filter(Boolean).join(" & ")}
              </Badge>
            )}

            <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72">
          {/* Section 1: Live Page */}
          <DropdownMenuLabel className="flex items-center justify-between font-normal text-muted-foreground text-xs">
            <span>Live Page Destination</span>
            {hasLiveLink && <span className="font-semibold text-emerald-600 dark:text-emerald-400">Ready</span>}
          </DropdownMenuLabel>

          {hasLiveLink && liveShortLink ? (
            <div className="flex items-center px-1 py-1">
              <DropdownMenuItem
                onClick={() => handleCopyLink(liveShortLink, "live")}
                className="flex flex-1 items-center justify-between cursor-pointer"
              >
                <div className="flex items-center">
                  {copiedType === "live" ? (
                    <Check className="mr-2 size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="mr-2 size-3.5" />
                  )}
                  <span>Copy Short Link</span>
                </div>
                <span className="max-w-[80px] truncate font-mono text-[10px] text-muted-foreground">
                  /{liveShortLink.path}
                </span>
              </DropdownMenuItem>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                title="Edit Short Link Slug"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditDialog("live", liveShortLink.path);
                }}
              >
                <Edit2 className="size-3.5" />
              </Button>
            </div>
          ) : (
            <DropdownMenuItem
              onClick={() => handleGenerateLink("live")}
              disabled={isGenerating === "live"}
              className="font-medium text-primary cursor-pointer"
            >
              {isGenerating === "live" ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-3.5" />
              )}
              Generate Live Page Link
            </DropdownMenuItem>
          )}

          {liveBevyUrl && <DropdownMenuSeparator />}

          {/* Section 2: Bevy Page */}
          {liveBevyUrl && (
            <>
              <DropdownMenuLabel className="flex items-center justify-between font-normal text-muted-foreground text-xs">
                <span>Bevy Platform Destination</span>
                {hasBevyLink && <span className="font-semibold text-emerald-600 dark:text-emerald-400">Ready</span>}
              </DropdownMenuLabel>

              {hasBevyLink && bevyShortLink ? (
                <div className="flex items-center px-1 py-1">
                  <DropdownMenuItem
                    onClick={() => handleCopyLink(bevyShortLink, "bevy")}
                    className="flex flex-1 items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center">
                      {copiedType === "bevy" ? (
                        <Check className="mr-2 size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="mr-2 size-3.5" />
                      )}
                      <span>Copy Short Link</span>
                    </div>
                    <span className="max-w-[80px] truncate font-mono text-[10px] text-muted-foreground">
                      /{bevyShortLink.path}
                    </span>
                  </DropdownMenuItem>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Edit Short Link Slug"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog("bevy", bevyShortLink.path);
                    }}
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <DropdownMenuItem
                  onClick={() => handleGenerateLink("bevy")}
                  disabled={isGenerating === "bevy"}
                  className="font-medium text-primary cursor-pointer"
                >
                  {isGenerating === "bevy" ? (
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 size-3.5" />
                  )}
                  Generate Bevy Page Link
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Short Link Slug Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Short Link Slug</DialogTitle>
            <DialogDescription>
              Customize the link slug for {editType === "live" ? "Live Event Page" : "Bevy Event Page"}. The short URL
              will immediately update across Short.io and Bevy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="short-slug">Custom Slug</Label>
              <div className="flex items-center rounded-md border border-input bg-muted/40 px-3 py-1 font-mono text-xs focus-within:ring-1 focus-within:ring-ring">
                <span className="text-muted-foreground select-none">
                  {editType === "live"
                    ? (liveShortLink?.shortURL.split("/").slice(0, 3).join("/") ?? "https://s.id")
                    : (bevyShortLink?.shortURL.split("/").slice(0, 3).join("/") ?? "https://s.id")}
                  /
                </span>
                <Input
                  id="short-slug"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                  placeholder="custom-slug"
                  className="h-8 border-0 bg-transparent p-0 font-mono text-xs shadow-none focus-visible:ring-0"
                  autoFocus
                />
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Destination URL:</span>
              <p className="mt-0.5 break-all font-mono text-[11px]">
                {editType === "live" ? getLiveUrl() : (liveBevyUrl ?? "-")}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSavingSlug}>
              Cancel
            </Button>
            <Button onClick={handleSaveSlug} disabled={isSavingSlug || !slugInput.trim()}>
              {isSavingSlug && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
