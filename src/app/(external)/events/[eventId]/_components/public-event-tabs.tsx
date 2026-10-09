"use client";

import Image from "next/image";

import {
  Calendar,
  Camera,
  Clock,
  ExternalLink,
  FileText,
  Images,
  Layers,
  Link2,
  MapPin,
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
import { parsePhotoAlbum, parseVideoUrl } from "@/lib/events/media-utils";
import type { EventSession, FirestoreEvent } from "@/lib/firestore/types";

const VIDEO_PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  direct: "Original",
  unknown: "Original",
};

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
  const hasBevyAgenda =
    Array.isArray(event.agenda?.days) &&
    event.agenda.days.some((day) => Array.isArray(day.items) && day.items.length > 0);
  const hasFirestoreSessions = Array.isArray(firestoreSessions) && firestoreSessions.length > 0;
  const hasAgenda = hasBevyAgenda || hasFirestoreSessions;

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
    event.agenda?.days?.flatMap((d) =>
      d.items.filter((i) => Boolean(i.slides_url) || Boolean(i.related_links && i.related_links.length > 0)),
    ) ?? [];
  const hasAnySlides = allSessionsWithSlides.length > 0 || allBevyItemsWithSlides.length > 0;

  const hasHighlights =
    Boolean(parsedVideo) || Boolean(parsedAlbum) || Boolean(recapDescription) || isEventPast || hasAnySlides;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="about" className="w-full">
        {/* Tab Navigation Row */}
        <div className="border-border/60 border-b">
          <TabsList className="h-11 w-full justify-start gap-1 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="about"
              className="relative h-11 rounded-none border-transparent border-b-2 bg-transparent px-4 pt-2 pb-3 font-medium text-muted-foreground text-sm shadow-none transition-all data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary"
            >
              About
            </TabsTrigger>

            <TabsTrigger
              value="agenda"
              className="relative h-11 rounded-none border-transparent border-b-2 bg-transparent px-4 pt-2 pb-3 font-medium text-muted-foreground text-sm shadow-none transition-all data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary"
            >
              Agenda
              {hasAgenda && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] text-primary">
                  {hasFirestoreSessions ? firestoreSessions.length : event.agenda?.days?.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="speakers"
              className="relative h-11 rounded-none border-transparent border-b-2 bg-transparent px-4 pt-2 pb-3 font-medium text-muted-foreground text-sm shadow-none transition-all data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary"
            >
              Speakers
              {hasSpeakers && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] text-primary">
                  {event.speakers?.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="partners"
              className="relative h-11 rounded-none border-transparent border-b-2 bg-transparent px-4 pt-2 pb-3 font-medium text-muted-foreground text-sm shadow-none transition-all data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary"
            >
              Partners
              {hasPartners && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] text-primary">
                  {partners.length}
                </span>
              )}
            </TabsTrigger>

            {hasHighlights && (
              <TabsTrigger
                value="highlights"
                className="relative h-11 rounded-none border-transparent border-b-2 bg-transparent px-4 pt-2 pb-3 font-medium text-muted-foreground text-sm shadow-none transition-all data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary"
              >
                <span className="flex items-center gap-1.5">
                  <Video className="size-3.5" />
                  <span>Highlights</span>
                  {(parsedVideo ?? parsedAlbum) && (
                    <span className="ml-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.2 font-medium text-[10px] text-emerald-600 dark:text-emerald-400">
                      Media
                    </span>
                  )}
                </span>
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
              dangerouslySetInnerHTML={{ __html: event.description }}
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
          {/* Firestore Breakout Sessions / Tracks if configured */}
          {hasFirestoreSessions && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">
                  Breakout Sessions & Specialized Tracks
                </h3>
              </div>
              <div className="space-y-3">
                {firestoreSessions.map((sess, idx) => {
                  const capacity = sess.capacity ?? 0;
                  const totalRegistered = sess.total_registered ?? 0;
                  const available = capacity - totalRegistered > 0;
                  const remaining = Math.max(0, capacity - totalRegistered);

                  let sessionBadgeText = "Open Capacity";
                  if (capacity > 0) {
                    sessionBadgeText = available
                      ? `${totalRegistered}/${capacity} booked (${remaining} left)`
                      : `Full (${capacity} max)`;
                  }

                  return (
                    <Card
                      key={sess.id}
                      className="border-border/60 bg-card shadow-2xs transition-all hover:bg-muted/10"
                    >
                      <CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              Track #{idx + 1}
                            </Badge>
                            <h4 className="font-semibold text-foreground text-sm">{sess.title}</h4>
                          </div>
                          {sess.speaker_name && (
                            <p className="text-[11px] font-medium text-foreground/80">
                              Speaker: <span className="text-foreground">{sess.speaker_name}</span>
                            </p>
                          )}
                          {sess.description && (
                            <div
                              className="prose prose-xs dark:prose-invert max-w-none text-muted-foreground text-xs leading-relaxed [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4"
                              // biome-ignore lint/security/noDangerouslySetInnerHtml: Event organizer session description
                              dangerouslySetInnerHTML={{ __html: sess.description }}
                            />
                          )}
                          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-muted-foreground">
                            {sess.time_slot && (
                              <span className="flex items-center gap-1">
                                <Clock className="size-3" /> {sess.time_slot}
                              </span>
                            )}
                            {(sess.location || sess.location_url) &&
                              (sess.location_url ? (
                                <a
                                  href={sess.location_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary/80 hover:underline"
                                  title="Open Google Maps / Venue Location"
                                >
                                  <MapPin className="size-3" />
                                  <span>{sess.location ?? "Google Maps"}</span>
                                  <ExternalLink className="size-2.5" />
                                </a>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <MapPin className="size-3" /> {sess.location}
                                </span>
                              ))}
                          </div>

                          {/* Speaker Presentation Slides & Related Links */}
                          {(sess.slides_url || (sess.related_links && sess.related_links.length > 0)) && (
                            <div className="flex flex-wrap items-center gap-2 border-border/40 border-t pt-2">
                              {sess.slides_url && (
                                <Button
                                  asChild
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1.5 border-primary/30 bg-primary/5 px-2.5 text-primary text-xs hover:bg-primary/10 hover:text-primary"
                                >
                                  <a href={sess.slides_url} target="_blank" rel="noopener noreferrer">
                                    <Presentation className="size-3.5" />
                                    <span>{sess.slides_title ?? "Speaker Slides"}</span>
                                    <ExternalLink className="size-2.5" />
                                  </a>
                                </Button>
                              )}
                              {sess.related_links?.map((link) => (
                                <a
                                  key={link.url}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/70 hover:text-foreground"
                                >
                                  <Link2 className="size-2.5 text-primary" />
                                  <span className="max-w-[180px] truncate">{link.title ? link.title : link.url}</span>
                                  <ExternalLink className="size-2" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 self-start sm:self-center">
                          <Badge variant={available ? "secondary" : "destructive"} className="text-xs">
                            {sessionBadgeText}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standard Bevy Agenda Days */}
          {hasBevyAgenda && (
            <div className="space-y-6">
              {event.agenda?.days?.map((day, dIdx) => (
                <div key={day.title ?? `day-${dIdx + 1}`} className="space-y-3">
                  {day.title && <h4 className="font-bold text-base text-foreground tracking-tight">{day.title}</h4>}
                  <div className="space-y-2.5">
                    {day.items.map((item) => (
                      <Card key={`${item.time}-${item.activity}`} className="border-border/60 bg-card p-4 shadow-2xs">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          <div className="shrink-0">
                            <Badge variant="secondary" className="font-mono text-xs">
                              <Clock className="mr-1 size-3" />
                              {item.time}
                            </Badge>
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="font-semibold text-foreground text-sm">{item.activity}</h5>
                              {item.audience_type && (
                                <Badge variant="outline" className="text-[10px]">
                                  {item.audience_type}
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-muted-foreground text-xs leading-relaxed">{item.description}</p>
                            )}

                            {/* Speaker Slides & Related Links if any */}
                            {(item.slides_url || (item.related_links && item.related_links.length > 0)) && (
                              <div className="flex flex-wrap items-center gap-2 border-border/40 border-t pt-2">
                                {item.slides_url && (
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 border-primary/30 bg-primary/5 px-2.5 text-primary text-xs hover:bg-primary/10 hover:text-primary"
                                  >
                                    <a href={item.slides_url} target="_blank" rel="noopener noreferrer">
                                      <Presentation className="size-3.5" />
                                      <span>{item.slides_title ?? "Session Slides"}</span>
                                      <ExternalLink className="size-2.5" />
                                    </a>
                                  </Button>
                                )}
                                {item.related_links?.map((link) => (
                                  <a
                                    key={link.url}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/70 hover:text-foreground"
                                  >
                                    <Link2 className="size-2.5 text-primary" />
                                    <span className="max-w-[180px] truncate">{link.title ? link.title : link.url}</span>
                                    <ExternalLink className="size-2" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hasBevyAgenda && !hasFirestoreSessions && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 border-dashed p-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Calendar className="size-6" />
              </div>
              <h3 className="mt-3 font-semibold text-base text-foreground">Agenda In Progress</h3>
              <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                The session schedule and timeline are being finalized. Check back soon!
              </p>
            </div>
          )}
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
                    dangerouslySetInnerHTML={{ __html: recapDescription }}
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
                  <span className="text-muted-foreground text-xs">Sessions / Tracks</span>
                  <p className="font-bold text-foreground text-lg sm:text-xl">
                    {firestoreSessions?.length ?? event.agenda?.days?.length ?? 1}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                  <span className="text-muted-foreground text-xs">Speakers</span>
                  <p className="font-bold text-foreground text-lg sm:text-xl">{event.speakers?.length ?? "-"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                  <span className="text-muted-foreground text-xs">Status</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 text-lg sm:text-xl">Completed</p>
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

        {speaker.bio && <p className="line-clamp-3 text-muted-foreground text-xs leading-relaxed">{speaker.bio}</p>}
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
