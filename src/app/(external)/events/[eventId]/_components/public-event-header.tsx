"use client";

import { useState } from "react";

import Image from "next/image";
import Link from "next/link";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  EyeOff,
  FlaskConical,
  Globe,
  Link2,
  MapPin,
  Radio,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBevyLiveEventUrl } from "@/config/remote-config-utils";
import { resolveEventAudience } from "@/lib/bevy/audience";
import type { BevyEvent } from "@/lib/bevy/types";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

function isSelfChapter(title?: string): boolean {
  if (!title) return false;
  const clean = title.toLowerCase().replace(/[^a-z]/g, "");
  return clean === "gdgjakarta" || clean === "googledevelopergroupjakarta" || clean === "googledevelopergroupsjakarta";
}

function getCohostedChapters(event: BevyEvent): Array<{
  title: string;
  logo_url?: string;
  city?: string;
  country?: string;
}> {
  const chapters: Array<{
    title: string;
    logo_url?: string;
    city?: string;
    country?: string;
  }> = [];

  // 1. Check event.cohost_chapters
  if (Array.isArray(event.cohost_chapters)) {
    for (const c of event.cohost_chapters) {
      if (c?.title && !isSelfChapter(c.title)) {
        chapters.push({
          title: c.title,
          logo_url: c.logo_url,
          city: c.city,
          country: c.country,
        });
      }
    }
  }

  // 2. Check event.cohosts
  if (Array.isArray(event.cohosts)) {
    for (const item of event.cohosts) {
      const ch = item.chapter ?? item;
      const title = ch.title ?? item.chapter_title;
      if (title && !isSelfChapter(title)) {
        if (!chapters.some((x) => x.title.toLowerCase() === title.toLowerCase())) {
          chapters.push({
            title,
            logo_url: ch.logo_url ?? item.logo_url,
            city: ch.city ?? item.city,
            country: ch.country ?? item.country,
          });
        }
      }
    }
  }

  // 3. Check event.cohost_registration_chapter_title
  if (event.cohost_registration_chapter_title && !isSelfChapter(event.cohost_registration_chapter_title)) {
    const title = event.cohost_registration_chapter_title;
    if (!chapters.some((x) => x.title.toLowerCase() === title.toLowerCase())) {
      chapters.push({ title });
    }
  }

  // 4. If primary event.chapter is not GDG Jakarta, then that chapter is cohosting with GDG Jakarta
  if (event.chapter?.title && !isSelfChapter(event.chapter.title)) {
    const title = event.chapter.title;
    if (!chapters.some((x) => x.title.toLowerCase() === title.toLowerCase())) {
      chapters.push({
        title,
        logo_url: event.chapter.logo_url,
        city: event.chapter.city,
        country: event.chapter.country,
      });
    }
  }

  return chapters;
}

interface PublicEventHeaderProps {
  event: BevyEvent;
  firestoreEvent?: FirestoreEvent | null;
}

export function PublicEventHeader({ event, firestoreEvent }: PublicEventHeaderProps) {
  const [copiedType, setCopiedType] = useState<"short" | "full" | null>(null);
  const { isVirtual, isHybrid } = resolveEventAudience(event.audience_type, event.is_virtual_event);

  const isHidden = Boolean(event.is_hidden ?? (event as { hidden?: boolean }).hidden);
  const isTest = Boolean(event.is_test);
  const liveBevyUrl = getBevyLiveEventUrl(event);
  const cohostedChapters = getCohostedChapters(event);
  const thumbnailImageUrl = event.cropped_picture_url ?? event.picture?.url ?? event.picture?.thumbnail_url;

  const shortUrl = firestoreEvent?.live_short_url ?? firestoreEvent?.short_url;
  const shortPath =
    firestoreEvent?.live_short_path ?? (shortUrl ? shortUrl.split("/").filter(Boolean).pop() : undefined);

  let copyHeaderLabel = "Copy Link";
  if (copiedType === "short") {
    copyHeaderLabel = "Short Link Copied!";
  } else if (copiedType) {
    copyHeaderLabel = "Event Link Copied!";
  }

  const handleCopyLink = (type: "short" | "full" = shortUrl ? "short" : "full") => {
    if (typeof window !== "undefined") {
      const urlToCopy = type === "short" && shortUrl ? shortUrl : window.location.href;
      void navigator.clipboard.writeText(urlToCopy);
      setCopiedType(type);
      toast.success(type === "short" && shortUrl ? `Short link copied: ${shortUrl}` : "Event link copied to clipboard");
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleShare = async () => {
    if (typeof window !== "undefined") {
      const shareUrl = shortUrl ?? window.location.href;
      if (navigator.share) {
        try {
          await navigator.share({
            title: event.title,
            text: event.description_short ?? event.title,
            url: shareUrl,
          });
          return;
        } catch {
          // Fall back to copy
        }
      }
      handleCopyLink(shortUrl ? "short" : "full");
    }
  };

  let formatBadgeClass = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  let FormatIcon = MapPin;
  let formatLabel = "In-Person";

  if (isVirtual) {
    formatBadgeClass = "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";
    FormatIcon = Globe;
    formatLabel = "Virtual";
  } else if (isHybrid) {
    formatBadgeClass = "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
    FormatIcon = Radio;
    formatLabel = "Hybrid";
  }

  return (
    <div className="space-y-4">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground">
          <Link href="/events">
            <ArrowLeft className="size-4" />
            All Events
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 text-xs">
            {copiedType ? <Check className="size-3.5 text-emerald-500" /> : <Share2 className="size-3.5" />}
            Share
          </Button>

          {shortUrl ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  {copiedType ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  <span>{copyHeaderLabel}</span>
                  {shortPath && (
                    <Badge variant="secondary" className="px-1 py-0 font-mono text-[9px] text-muted-foreground">
                      /{shortPath}
                    </Badge>
                  )}
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => handleCopyLink("short")}
                  className="flex cursor-pointer items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {copiedType === "short" ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Link2 className="size-3.5 text-primary" />
                    )}
                    <span className="font-medium text-xs">Copy Short Link</span>
                  </div>
                  {shortPath && <span className="font-mono text-[10px] text-muted-foreground">/{shortPath}</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleCopyLink("full")}
                  className="flex cursor-pointer items-center gap-2"
                >
                  {copiedType === "full" ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="text-xs">Copy Full Event Link</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" onClick={() => handleCopyLink("full")} className="gap-1.5 text-xs">
              {copiedType === "full" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              {copiedType === "full" ? "Link Copied!" : "Copy Link"}
            </Button>
          )}

          {liveBevyUrl && (
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <a href={liveBevyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                Open on Bevy
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Badges Row */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* Delivery format badge */}
        <Badge variant="outline" className={cn("gap-1 px-2.5 py-0.5 font-medium text-xs shadow-2xs", formatBadgeClass)}>
          <FormatIcon className="size-3" />
          {formatLabel}
        </Badge>

        {/* Hidden Event Badge */}
        {isHidden && (
          <Badge variant="destructive" className="gap-1 px-2.5 py-0.5 text-xs shadow-2xs">
            <EyeOff className="size-3" />
            Hidden Event
          </Badge>
        )}

        {/* Test Event Badge */}
        {isTest && (
          <Badge
            variant="outline"
            className="gap-1 border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 font-medium text-purple-600 text-xs shadow-2xs dark:text-purple-400"
          >
            <FlaskConical className="size-3" />
            Test Event
          </Badge>
        )}

        {/* Event Type Title */}
        {event.event_type_title && (
          <Badge variant="secondary" className="px-2.5 py-0.5 text-muted-foreground text-xs shadow-2xs">
            {event.event_type_title}
          </Badge>
        )}
      </div>

      {/* Title */}
      <div className="flex items-start gap-3.5">
        {thumbnailImageUrl && (
          <div className="relative aspect-square size-16 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/30 shadow-2xs sm:size-20 lg:hidden">
            <Image
              src={thumbnailImageUrl}
              alt={event.title}
              fill
              priority
              loading="eager"
              sizes="80px"
              className="size-full object-cover"
              unoptimized={!thumbnailImageUrl.includes("res.cloudinary.com")}
            />
          </div>
        )}
        <h1 className="min-w-0 flex-1 font-bold text-2xl text-foreground tracking-tight sm:text-3xl md:text-4xl">
          {event.title}
        </h1>
      </div>

      {/* Co-hosted Chapters Row (Only show if cohosted with other chapters) */}
      {cohostedChapters.length > 0 && (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:gap-3">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Cohosted Event with
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {cohostedChapters.map((ch) => {
              const locationStr = [ch.city, ch.country].filter(Boolean).join(", ");
              return (
                <div key={ch.title} className="flex items-center gap-2">
                  <Avatar className="size-8 rounded-lg border border-border/60 shadow-2xs">
                    {ch.logo_url && <AvatarImage src={ch.logo_url} alt={ch.title} />}
                    <AvatarFallback className="rounded-lg bg-primary/10 font-bold text-primary text-xs">
                      {ch.title.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-foreground text-sm">
                    {ch.title}
                    {locationStr ? ` • ${locationStr}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
