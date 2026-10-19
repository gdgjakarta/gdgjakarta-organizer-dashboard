"use client";

import { useMemo } from "react";

import Image from "next/image";

import {
  Camera,
  ExternalLink,
  FileText,
  Images,
  Link2,
  Play,
  Presentation,
  Sparkles,
  Users,
  Video,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractEventPartners, groupPartnersByTier } from "@/lib/bevy/partners";
import type { BevyEvent, BevyPartner, BevySpeaker } from "@/lib/bevy/types";
import { buildUnifiedAgenda } from "@/lib/events/agenda-unification";
import { parsePhotoAlbum, parseVideoUrl } from "@/lib/events/media-utils";
import type { EventSession, FirestoreEvent } from "@/lib/firestore/types";
import { sanitizeHtml } from "@/lib/utils";

import { UnifiedAgendaTimeline } from "./unified-agenda-timeline";

const VIDEO_PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  direct: "Original",
  unknown: "Original",
};

function _formatAudienceType(audienceType?: string): string {
  if (!audienceType) return "";
  return audienceType.replace(/_/g, "-").toUpperCase();
}

function _getAudienceBadgeStyle(audienceType?: string): string {
  const normalized = audienceType?.toUpperCase().replace(/-/g, "_");
  switch (normalized) {
    case "IN_PERSON":
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400";
    case "HYBRID":
      return "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400";
    case "VIRTUAL":
    case "ONLINE":
      return "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

interface PublicEventTabsProps {
  event: BevyEvent;
  firestoreSessions?: EventSession[];
  firestoreEvent?: FirestoreEvent | null;
}

export function PublicEventTabs({ event, firestoreSessions, firestoreEvent }: PublicEventTabsProps) {
  const hasSpeakers = Array.isArray(event.speakers) && event.speakers.length > 0;
  const partners =
    Array.isArray(event.partners) && event.partners.length > 0 ? event.partners : extractEventPartners(event);
  const hasPartners = partners.length > 0;
  const tierGroups = groupPartnersByTier(partners);
  const unifiedAgenda = useMemo(
    () => buildUnifiedAgenda(event.agenda, event.speakers, firestoreSessions),
    [event.agenda, event.speakers, firestoreSessions],
  );
  const hasAgenda = unifiedAgenda.sessionGroups.length > 0;
  const agendaBadgeCount =
    unifiedAgenda.totalItemsCount > 0 ? unifiedAgenda.totalItemsCount : unifiedAgenda.sessionGroups.length;

  // Post-Event Recap & Media
  const highlightVideoUrl = firestoreEvent?.highlight_video_url ?? event.highlight_video_url ?? event.video_url;
  const highlightVideoTitle =
    firestoreEvent?.highlight_video_title ?? event.highlight_video_title ?? "Event Highlights & Recap";
  const photoAlbumUrl = firestoreEvent?.photo_album_url ?? event.photo_album_url;
  const photoAlbumTitle = firestoreEvent?.photo_album_title ?? event.photo_album_title ?? "Official Photo Album";
  const recapDescription = firestoreEvent?.recap_description ?? event.recap_description;

  const isEventPast =
    event.status === "Completed" || (event.end_date ? new Date(event.end_date).getTime() < Date.now() : false);
  const parsedVideo = parseVideoUrl(highlightVideoUrl);
  const parsedAlbum = parsePhotoAlbum(photoAlbumUrl);

  const allSessionsWithSlides = [
    ...(firestoreSessions?.filter(
      (s) => Boolean(s.slides_url) || Boolean(s.related_links && s.related_links.length > 0),
    ) ?? []),
  ];
  const allBevyItemsWithSlides =
    event.agenda?.days?.flatMap((d) => {
      const items = d.items ?? d.agenda;
      return Array.isArray(items)
        ? items.filter((i) => Boolean(i.slides_url) || Boolean(i.related_links && i.related_links.length > 0))
        : [];
    }) ?? [];
  const hasAnySlides = allSessionsWithSlides.length > 0 || allBevyItemsWithSlides.length > 0;

  const hasHighlights =
    Boolean(parsedVideo) || Boolean(parsedAlbum) || Boolean(recapDescription) || isEventPast || hasAnySlides;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="about" className="w-full">
        {/* Tab Navigation Row */}
        <div className="scrollbar-none -mx-4 w-[calc(100%+2rem)] overflow-x-auto border-border/70 border-b px-4 touch-pan-x sm:mx-0 sm:w-full sm:px-0">
          <TabsList className="inline-flex h-12 w-max min-w-full items-center justify-start gap-1 rounded-none bg-transparent p-0 sm:gap-2">
            <TabsTrigger
              value="about"
              className="group relative flex h-12 shrink-0 flex-none cursor-pointer items-center gap-2 rounded-t-lg border-0 bg-transparent px-3.5 pt-1 pb-1 font-medium text-muted-foreground text-xs shadow-none transition-colors after:hidden hover:bg-muted/30 hover:text-foreground focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4.5 sm:text-sm"
            >
              <span className="relative z-10">About</span>
              <span className="pointer-events-none absolute inset-x-2 -bottom-[1px] h-[2.5px] rounded-full bg-primary opacity-0 transition-all duration-200 group-data-[state=active]:opacity-100" />
            </TabsTrigger>

            <TabsTrigger
              value="agenda"
              className="group relative flex h-12 shrink-0 flex-none cursor-pointer items-center gap-2 rounded-t-lg border-0 bg-transparent px-3.5 pt-1 pb-1 font-medium text-muted-foreground text-xs shadow-none transition-colors after:hidden hover:bg-muted/30 hover:text-foreground focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4.5 sm:text-sm"
            >
              <span className="relative z-10">Agenda</span>
              {hasAgenda && (
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground transition-colors group-hover:bg-muted/80 group-data-[state=active]:bg-primary/10 group-data-[state=active]:font-semibold group-data-[state=active]:text-primary">
                  {agendaBadgeCount}
                </span>
              )}
              <span className="pointer-events-none absolute inset-x-2 -bottom-[1px] h-[2.5px] rounded-full bg-primary opacity-0 transition-all duration-200 group-data-[state=active]:opacity-100" />
            </TabsTrigger>

            <TabsTrigger
              value="speakers"
              className="group relative flex h-12 shrink-0 flex-none cursor-pointer items-center gap-2 rounded-t-lg border-0 bg-transparent px-3.5 pt-1 pb-1 font-medium text-muted-foreground text-xs shadow-none transition-colors after:hidden hover:bg-muted/30 hover:text-foreground focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4.5 sm:text-sm"
            >
              <span className="relative z-10">Speakers</span>
              {hasSpeakers && (
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground transition-colors group-hover:bg-muted/80 group-data-[state=active]:bg-primary/10 group-data-[state=active]:font-semibold group-data-[state=active]:text-primary">
                  {event.speakers?.length}
                </span>
              )}
              <span className="pointer-events-none absolute inset-x-2 -bottom-[1px] h-[2.5px] rounded-full bg-primary opacity-0 transition-all duration-200 group-data-[state=active]:opacity-100" />
            </TabsTrigger>

            <TabsTrigger
              value="partners"
              className="group relative flex h-12 shrink-0 flex-none cursor-pointer items-center gap-2 rounded-t-lg border-0 bg-transparent px-3.5 pt-1 pb-1 font-medium text-muted-foreground text-xs shadow-none transition-colors after:hidden hover:bg-muted/30 hover:text-foreground focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4.5 sm:text-sm"
            >
              <span className="relative z-10">Partners</span>
              {hasPartners && (
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground transition-colors group-hover:bg-muted/80 group-data-[state=active]:bg-primary/10 group-data-[state=active]:font-semibold group-data-[state=active]:text-primary">
                  {partners.length}
                </span>
              )}
              <span className="pointer-events-none absolute inset-x-2 -bottom-[1px] h-[2.5px] rounded-full bg-primary opacity-0 transition-all duration-200 group-data-[state=active]:opacity-100" />
            </TabsTrigger>

            {hasHighlights && (
              <TabsTrigger
                value="highlights"
                className="group relative flex h-12 shrink-0 flex-none cursor-pointer items-center gap-2 rounded-t-lg border-0 bg-transparent px-3.5 pt-1 pb-1 font-medium text-muted-foreground text-xs shadow-none transition-colors after:hidden hover:bg-muted/30 hover:text-foreground focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4.5 sm:text-sm"
              >
                <Video className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground group-data-[state=active]:text-primary" />
                <span className="relative z-10">Highlights</span>
                {(parsedVideo ?? parsedAlbum) && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-[10px] text-emerald-600 dark:text-emerald-400">
                    Media
                  </span>
                )}
                <span className="pointer-events-none absolute inset-x-2 -bottom-[1px] h-[2.5px] rounded-full bg-primary opacity-0 transition-all duration-200 group-data-[state=active]:opacity-100" />
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* ── TAB 1: ABOUT ────────────────────────────────────────── */}
        <TabsContent value="about" className="space-y-6 pt-4">
          {/* Highlight short description banner */}
          {event.description_short && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-foreground/90 leading-relaxed shadow-2xs dark:bg-blue-500/10">
              <p className="font-medium text-sm sm:text-base">{event.description_short}</p>
            </div>
          )}

          {/* Full HTML Description */}
          {event.description ? (
            <div
              className="prose dark:prose-invert max-w-none prose-img:rounded-xl prose-headings:font-bold prose-a:text-primary text-foreground/90 text-sm leading-relaxed prose-headings:tracking-tight hover:prose-a:underline sm:text-base"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Bevy trusted description
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.description) }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 border-dashed p-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Sparkles className="size-6" />
              </div>
              <h3 className="mt-3 font-semibold text-base text-foreground">Overview Coming Soon</h3>
              <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                Detailed event descriptions and highlights will be updated shortly.
              </p>
            </div>
          )}

          {/* Sponsors spotlight on About tab */}
          {hasPartners && (
            <div className="space-y-4 border-border/60 border-t pt-6">
              <div>
                <h3 className="font-bold text-base text-foreground tracking-tight">Event Partners & Sponsors</h3>
                <p className="text-muted-foreground text-xs">
                  Proudly supported by organizations driving the developer community.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {partners.map((partner) => (
                  <PartnerCard key={partner.id ?? partner.company} partner={partner} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2: AGENDA ───────────────────────────────────────── */}
        <TabsContent value="agenda" className="space-y-6 pt-4">
          <UnifiedAgendaTimeline
            bevyAgenda={event.agenda}
            speakers={event.speakers}
            firestoreSessions={firestoreSessions}
          />
        </TabsContent>

        {/* ── TAB 3: SPEAKERS ─────────────────────────────────────── */}
        <TabsContent value="speakers" className="space-y-4 pt-4">
          {hasSpeakers ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {event.speakers?.map((speaker) => (
                <SpeakerCard key={speaker.id ?? speaker.full_name} speaker={speaker} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 border-dashed p-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Users className="size-6" />
              </div>
              <h3 className="mt-3 font-semibold text-base text-foreground">Speakers In Announcement</h3>
              <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                Distinguished speakers and community experts will be featured here soon.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── TAB 4: PARTNERS & SPONSORS ───────────────────────────── */}
        <TabsContent value="partners" className="space-y-6 pt-4">
          {hasPartners ? (
            <div className="space-y-8">
              {tierGroups.map((group) => (
                <div key={group.tierName} className="space-y-3">
                  <div className="flex items-center gap-2.5 border-border/60 border-b pb-2.5">
                    <h3 className="font-bold text-foreground text-lg tracking-tight">{group.tierName}</h3>
                    <Badge variant="secondary" className="px-2 py-0 text-xs">
                      {group.partners.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {group.partners.map((partner) => (
                      <PartnerCard key={partner.id ?? partner.company} partner={partner} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 border-dashed p-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Sparkles className="size-6" />
              </div>
              <h3 className="mt-3 font-semibold text-base text-foreground">Partners & Sponsors</h3>
              <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                Community partners supporting this event will be highlighted here.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── TAB 5: HIGHLIGHTS & MEDIA RECAP ──────────────────────── */}
        {hasHighlights && (
          <TabsContent value="highlights" className="space-y-6 pt-4">
            {/* Embedded Highlight Video */}
            {parsedVideo && (
              <Card className="overflow-hidden border-border/60 bg-card shadow-2xs">
                <div className="border-border/60 border-b p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                        <Video className="size-4.5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-foreground tracking-tight">{highlightVideoTitle}</h3>
                        <p className="text-muted-foreground text-xs">Official event recap and session highlights</p>
                      </div>
                    </div>
                    {parsedVideo.originalUrl && (
                      <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                        <a href={parsedVideo.originalUrl} target="_blank" rel="noopener noreferrer">
                          <span>Watch on {VIDEO_PLATFORM_LABELS[parsedVideo.type] ?? "Original"}</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                <CardContent className="p-0">
                  {parsedVideo.embedUrl ? (
                    <div className="relative aspect-video w-full bg-black">
                      {parsedVideo.type === "youtube" || parsedVideo.type === "vimeo" ? (
                        <iframe
                          src={parsedVideo.embedUrl}
                          title={highlightVideoTitle}
                          className="size-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : (
                        <video controls playsInline className="size-full object-contain" src={parsedVideo.embedUrl}>
                          <track kind="captions" />
                        </video>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <Button asChild size="lg" className="gap-2">
                        <a href={parsedVideo.originalUrl} target="_blank" rel="noopener noreferrer">
                          <Play className="size-4" />
                          Watch Highlight Video
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!parsedVideo && isEventPast && (
              <Card className="border-border/60 border-dashed bg-muted/20 p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Video className="size-6" />
                </div>
                <h4 className="mt-3 font-semibold text-foreground text-sm">Event Highlight Video</h4>
                <p className="mx-auto mt-1 max-w-sm text-muted-foreground text-xs">
                  The event recap video and highlight reel are currently being prepared by the organizing team.
                </p>
              </Card>
            )}

            {/* Official Photo Album Card */}
            {parsedAlbum && (
              <Card className="border-border/60 bg-gradient-to-br from-card via-card to-muted/30 p-5 shadow-2xs sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-primary/10 text-primary shadow-2xs">
                      <Camera className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="gap-1 border-primary/20 bg-primary/10 text-[11px] text-primary"
                        >
                          <Sparkles className="size-3" />
                          {parsedAlbum.label}
                        </Badge>
                        <h3 className="font-bold text-base text-foreground tracking-tight">{photoAlbumTitle}</h3>
                      </div>
                      <p className="max-w-xl text-muted-foreground text-xs leading-relaxed">
                        Browse high-resolution event photography, keynote presentations, networking snapshots, and
                        community memories from this gathering.
                      </p>
                    </div>
                  </div>

                  <Button
                    asChild
                    size="default"
                    className="shrink-0 gap-2 self-start font-medium shadow-2xs sm:self-center"
                  >
                    <a href={parsedAlbum.url} target="_blank" rel="noopener noreferrer">
                      <Images className="size-4" />
                      <span>View Photo Album</span>
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                </div>
              </Card>
            )}

            {/* Organizer Recap Notes */}
            {recapDescription && (
              <Card className="border-border/60 bg-card p-5 shadow-2xs sm:p-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-border/60 border-b pb-3">
                    <FileText className="size-4 text-primary" />
                    <h3 className="font-bold text-base text-foreground tracking-tight">Event Recap & Notes</h3>
                  </div>
                  <div
                    className="prose dark:prose-invert max-w-none text-foreground/90 text-sm leading-relaxed"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: Event organizer recap
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(recapDescription) }}
                  />
                </div>
              </Card>
            )}

            {/* Quick Access to Presentation Slides & Materials if available */}
            {hasAnySlides && (
              <Card className="space-y-4 border-border/60 bg-card p-5 shadow-2xs sm:p-6">
                <div className="border-border/60 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Presentation className="size-4 text-primary" />
                    <h3 className="font-bold text-base text-foreground tracking-tight">Speaker Slides & Resources</h3>
                  </div>
                  <p className="pt-0.5 text-muted-foreground text-xs">
                    Access slide decks and resources shared by session speakers.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {allSessionsWithSlides.map((sess) => (
                    <div
                      key={sess.id}
                      className="flex flex-col justify-between space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4"
                    >
                      <div>
                        <span className="block font-semibold text-foreground text-sm leading-snug">{sess.title}</span>
                        {sess.speaker_name && (
                          <span className="mt-0.5 block text-muted-foreground text-xs">
                            Speaker: {sess.speaker_name}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 border-border/40 border-t pt-2">
                        {sess.slides_url && (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="w-full gap-1.5 border-primary/30 text-primary text-xs hover:bg-primary/10"
                          >
                            <a href={sess.slides_url} target="_blank" rel="noopener noreferrer">
                              <Presentation className="size-3.5" />
                              <span>{sess.slides_title ?? "Download / View Slides"}</span>
                              <ExternalLink className="ml-auto size-3" />
                            </a>
                          </Button>
                        )}
                        {sess.related_links && sess.related_links.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {sess.related_links.map((link) => (
                              <a
                                key={link.url}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              >
                                <Link2 className="size-2.5 text-primary" />
                                <span className="max-w-[140px] truncate">{link.title ? link.title : link.url}</span>
                                <ExternalLink className="size-2" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {allBevyItemsWithSlides.map((item) => (
                    <div
                      key={`${item.time}-${item.activity}`}
                      className="flex flex-col justify-between space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4"
                    >
                      <div>
                        <span className="block font-semibold text-foreground text-sm leading-snug">
                          {item.activity}
                        </span>
                        {item.audience_type && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {item.audience_type}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2 border-border/40 border-t pt-2">
                        {item.slides_url && (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="w-full gap-1.5 border-primary/30 text-primary text-xs hover:bg-primary/10"
                          >
                            <a href={item.slides_url} target="_blank" rel="noopener noreferrer">
                              <Presentation className="size-3.5" />
                              <span>{item.slides_title ?? "Download / View Slides"}</span>
                              <ExternalLink className="ml-auto size-3" />
                            </a>
                          </Button>
                        )}
                        {item.related_links && item.related_links.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.related_links.map((link) => (
                              <a
                                key={link.url}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              >
                                <Link2 className="size-2.5 text-primary" />
                                <span className="max-w-[140px] truncate">{link.title ? link.title : link.url}</span>
                                <ExternalLink className="size-2" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Attendance & Event Summary Cards */}
            {isEventPast && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                  <span className="text-muted-foreground text-xs">Total Attendees</span>
                  <p className="font-bold text-foreground text-lg sm:text-xl">
                    {event.total_attendees ?? event.checkin_count ?? "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                  <span className="text-muted-foreground text-xs">Total Agenda</span>
                  <p className="font-bold text-foreground text-lg sm:text-xl">{agendaBadgeCount || "-"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                  <span className="text-muted-foreground text-xs">Speakers</span>
                  <p className="font-bold text-foreground text-lg sm:text-xl">{event.speakers?.length ?? "-"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                  <span className="text-muted-foreground text-xs">Status</span>
                  <p className="font-bold text-emerald-600 text-lg sm:text-xl dark:text-emerald-400">Completed</p>
                </div>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function SpeakerCard({ speaker }: { speaker: BevySpeaker }) {
  const avatarUrl = speaker.picture_url ?? speaker.picture?.url;
  const rawName = `${speaker.first_name ?? ""} ${speaker.last_name ?? ""}`.trim();
  const fullName = speaker.full_name ?? (rawName.length > 0 ? rawName : "Speaker");
  const roleInfo = [speaker.title, speaker.company].filter(Boolean).join(" @ ");
  const hasSocials = Boolean(speaker.linkedin_url ?? speaker.personal_twitter ?? speaker.company_twitter);

  return (
    <Card className="flex flex-col justify-between border-border/60 bg-card p-4 shadow-2xs transition-all hover:bg-muted/10">
      <div className="space-y-3">
        <div className="flex items-start gap-3.5">
          <Avatar className="size-14 rounded-2xl border border-border/60 shadow-2xs">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
            <AvatarFallback className="rounded-2xl bg-primary/10 font-bold text-primary text-sm">
              {fullName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-0.5">
            <h4 className="font-bold text-base text-foreground tracking-tight">{fullName}</h4>
            {roleInfo && <p className="text-muted-foreground text-xs leading-snug">{roleInfo}</p>}
          </div>
        </div>

        {speaker.bio && (
          <div
            className="line-clamp-3 text-muted-foreground text-xs leading-relaxed break-words prose prose-sm dark:prose-invert max-w-none [&_h1]:my-0.5 [&_h1]:text-xs [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:my-0.5 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:my-0.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground [&_h4]:my-0.5 [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:text-foreground [&_p]:my-0.5 [&_strong]:font-semibold [&_strong]:text-foreground [&_a]:text-primary hover:[&_a]:underline"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Bevy verified speaker bio HTML
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(speaker.bio) }}
          />
        )}
      </div>

      {hasSocials && (
        <div className="mt-3 flex items-center gap-2 border-border/40 border-t pt-2.5">
          {speaker.linkedin_url && (
            <a
              href={speaker.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="LinkedIn Profile"
            >
              <span className="font-bold text-[11px]">in</span>
            </a>
          )}
          {speaker.personal_twitter && (
            <a
              href={
                speaker.personal_twitter.startsWith("http")
                  ? speaker.personal_twitter
                  : `https://x.com/${speaker.personal_twitter.replace("@", "")}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="X Profile"
            >
              <XIcon className="size-3" />
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function PartnerCard({ partner }: { partner: BevyPartner }) {
  const logoUrl = partner.logo_url ?? partner.logo?.url ?? partner.logo?.thumbnail_url;

  return (
    <Card className="flex flex-col justify-between border-border/60 bg-card p-4 shadow-2xs transition-all hover:bg-muted/10 sm:p-5">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            {logoUrl ? (
              <div className="relative h-14 w-28 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-white p-2 dark:bg-white/95">
                <Image src={logoUrl} alt={partner.company} fill className="object-contain p-1" sizes="112px" />
              </div>
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-base text-primary">
                {partner.company.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-bold text-base text-foreground tracking-tight">{partner.company}</h4>
                {partner.tier && (
                  <Badge variant="outline" className="font-medium text-[11px]">
                    {partner.tier}
                  </Badge>
                )}
              </div>
              {partner.is_global && <span className="block text-[11px] text-muted-foreground">Global Partner</span>}
            </div>
          </div>

          {partner.url && (
            <Button variant="outline" size="sm" asChild className="shrink-0 gap-1.5 text-xs">
              <a href={partner.url} target="_blank" rel="noopener noreferrer">
                <span>Visit Website</span>
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
        </div>

        {partner.description && (
          <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">{partner.description}</p>
        )}
      </div>
    </Card>
  );
}
