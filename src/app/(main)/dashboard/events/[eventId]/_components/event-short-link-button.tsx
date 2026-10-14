"use client";

import * as React from "react";

import { Check, ChevronDown, Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBevyLiveEventUrl } from "@/config/remote-config-utils";
import type { ShortLinkItem } from "@/lib/shortio/types";
import { generateEventShortLinkAction, getEventShortLinksAction } from "@/server/shortio-actions";

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

  const liveBevyUrl = React.useMemo(
    () =>
      getBevyLiveEventUrl({
        url: event.url,
        static_url: event.static_url,
        id: event.id,
      }),
    [event],
  );

  const getLiveUrl = React.useCallback(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://gdgjakarta.org";
    return `${origin}/events/${event.id}`;
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

  if (!isOrganizer) return null;

  const hasAnyLink = Boolean(liveShortLink || bevyShortLink);
  const hasLiveLink = Boolean(liveShortLink);
  const hasBevyLink = Boolean(bevyShortLink);

  return (
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

      <DropdownMenuContent align="end" className="w-64">
        {/* Section 1: Live Page */}
        <DropdownMenuLabel className="flex items-center justify-between font-normal text-muted-foreground text-xs">
          <span>Live Page Destination</span>
          {hasLiveLink && <span className="font-semibold text-emerald-600 dark:text-emerald-400">Ready</span>}
        </DropdownMenuLabel>

        {hasLiveLink && liveShortLink ? (
          <DropdownMenuItem
            onClick={() => handleCopyLink(liveShortLink, "live")}
            className="flex items-center justify-between"
          >
            <div className="flex items-center">
              {copiedType === "live" ? (
                <Check className="mr-2 size-3.5 text-emerald-500" />
              ) : (
                <Copy className="mr-2 size-3.5" />
              )}
              <span>Copy Short Link</span>
            </div>
            <span className="max-w-[100px] truncate font-mono text-[10px] text-muted-foreground">
              /{liveShortLink.path}
            </span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => handleGenerateLink("live")}
            disabled={isGenerating === "live"}
            className="font-medium text-primary"
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
              <DropdownMenuItem
                onClick={() => handleCopyLink(bevyShortLink, "bevy")}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {copiedType === "bevy" ? (
                    <Check className="mr-2 size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="mr-2 size-3.5" />
                  )}
                  <span>Copy Short Link</span>
                </div>
                <span className="max-w-[100px] truncate font-mono text-[10px] text-muted-foreground">
                  /{bevyShortLink.path}
                </span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => handleGenerateLink("bevy")}
                disabled={isGenerating === "bevy"}
                className="font-medium text-primary"
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
  );
}
