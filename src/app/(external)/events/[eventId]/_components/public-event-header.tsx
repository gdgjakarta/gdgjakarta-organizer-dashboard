"use client";

import { useState } from "react";

import Link from "next/link";

import { ArrowLeft, Check, Copy, ExternalLink, EyeOff, FlaskConical, Globe, MapPin, Radio, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBevyLiveEventUrl } from "@/config/remote-config-utils";
import { resolveEventAudience } from "@/lib/bevy/audience";
import type { BevyEvent } from "@/lib/bevy/types";
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
}

export function PublicEventHeader({ event }: PublicEventHeaderProps) {
  const [copied, setCopied] = useState(false);
  const { isVirtual, isHybrid } = resolveEventAudience(event.audience_type, event.is_virtual_event);

  const isHidden = Boolean(event.is_hidden ?? (event as { hidden?: boolean }).hidden);
  const isTest = Boolean(event.is_test);
  const liveBevyUrl = getBevyLiveEventUrl(event);
  const cohostedChapters = getCohostedChapters(event);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Event link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (typeof window !== "undefined") {
      const shareUrl = window.location.href;
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
      handleCopyLink();
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
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Share2 className="size-3.5" />}
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5 text-xs">
            <Copy className="size-3.5" />
            Copy Link
          </Button>
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
      <h1 className="font-bold text-2xl text-foreground tracking-tight sm:text-3xl md:text-4xl">{event.title}</h1>

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
