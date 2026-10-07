"use client";

import Image from "next/image";

import { Calendar, Clock, ExternalLink, Layers, MapPin, Sparkles, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BevyEvent, BevyPartner, BevySpeaker } from "@/lib/bevy/types";
import type { EventSession } from "@/lib/firestore/types";

interface PublicEventTabsProps {
  event: BevyEvent;
  firestoreSessions?: EventSession[];
}

export function PublicEventTabs({ event, firestoreSessions }: PublicEventTabsProps) {
  const hasSpeakers = Array.isArray(event.speakers) && event.speakers.length > 0;
  const hasPartners = Array.isArray(event.partners) && event.partners.length > 0;
  const hasBevyAgenda =
    Array.isArray(event.agenda?.days) &&
    event.agenda.days.some((day) => Array.isArray(day.items) && day.items.length > 0);
  const hasFirestoreSessions = Array.isArray(firestoreSessions) && firestoreSessions.length > 0;
  const hasAgenda = hasBevyAgenda || hasFirestoreSessions;

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
                  {event.partners?.length}
                </span>
              )}
            </TabsTrigger>
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
                          {sess.description && (
                            <p className="text-muted-foreground text-xs leading-relaxed">{sess.description}</p>
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
                                  <span>{sess.location || "Google Maps"}</span>
                                  <ExternalLink className="size-2.5" />
                                </a>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <MapPin className="size-3" /> {sess.location}
                                </span>
                              ))}
                          </div>
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

        {/* ── TAB 4: PARTNERS ─────────────────────────────────────── */}
        <TabsContent value="partners" className="space-y-4 pt-4">
          {hasPartners ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {event.partners?.map((partner) => (
                <PartnerCard key={partner.id ?? partner.company} partner={partner} />
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
  return (
    <Card className="flex items-center justify-between gap-4 border-border/60 bg-card p-4 shadow-2xs transition-all hover:bg-muted/10">
      <div className="flex items-center gap-3.5">
        {partner.logo_url ? (
          <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/30 p-1">
            <Image src={partner.logo_url} alt={partner.company} fill className="object-contain" />
          </div>
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary text-xs">
            {partner.company.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h4 className="font-semibold text-foreground text-sm">{partner.company}</h4>
          {partner.description && <p className="line-clamp-1 text-muted-foreground text-xs">{partner.description}</p>}
        </div>
      </div>

      {partner.url && (
        <a
          href={partner.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={`Visit ${partner.company}`}
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </Card>
  );
}
