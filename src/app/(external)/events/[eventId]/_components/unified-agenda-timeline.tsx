"use client";

import { useMemo, useState } from "react";

import { Calendar, Clock, ExternalLink, Link2, MapPin, Presentation, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BevyAgenda, BevySpeaker } from "@/lib/bevy/types";
import { buildUnifiedAgenda, type UnifiedAgendaItem } from "@/lib/events/agenda-unification";
import type { EventSession } from "@/lib/firestore/types";
import { cn, sanitizeHtml } from "@/lib/utils";

function formatAudienceType(audienceType?: string): string {
  if (!audienceType) return "";
  return audienceType.replace(/_/g, "-").toUpperCase();
}

function getAudienceBadgeStyle(audienceType?: string): string {
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

interface AgendaItemCardProps {
  item: UnifiedAgendaItem;
}

function AgendaItemCard({ item }: AgendaItemCardProps) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-card p-4 shadow-2xs transition-all hover:border-zinc-300 sm:p-5 dark:border-zinc-800 dark:hover:border-zinc-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
        {/* Time Pill Badge */}
        <div className="shrink-0">
          <span className="inline-flex items-center justify-center rounded-full bg-blue-50 px-3.5 py-1.5 font-medium text-blue-600 text-xs tracking-tight sm:text-sm dark:bg-blue-950/60 dark:text-blue-400">
            {item.time}
          </span>
        </div>

        {/* Content Column */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Top Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {item.audienceType && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-[10px] uppercase tracking-wider sm:text-[11px]",
                  getAudienceBadgeStyle(item.audienceType),
                )}
              >
                {formatAudienceType(item.audienceType)}
              </span>
            )}
          </div>

          {/* Activity / Session Title */}
          <h5 className="font-semibold text-foreground text-sm leading-snug sm:text-base">{item.activity}</h5>

          {/* Speaker Card / Attribution */}
          {item.speakerName && (
            <div className="inline-flex items-center gap-2 rounded-xl bg-muted/40 px-2.5 py-1 text-xs">
              <Avatar className="size-5 shrink-0">
                {item.speakerAvatar && <AvatarImage src={item.speakerAvatar} alt={item.speakerName} />}
                <AvatarFallback className="text-[10px]">
                  <User className="size-3" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <span className="font-medium text-foreground">{item.speakerName}</span>
                {item.speakerRole && <span className="text-[11px] text-muted-foreground"> • {item.speakerRole}</span>}
              </div>
            </div>
          )}

          {/* Activity Description */}
          {item.description &&
            (item.description.includes("<") && item.description.includes(">") ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground text-xs leading-relaxed break-words [&_p]:my-1 [&_a]:text-primary [&_a]:underline"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Bevy verified agenda HTML content
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }}
              />
            ) : (
              <p className="whitespace-pre-line text-muted-foreground text-xs leading-relaxed break-words">
                {item.description}
              </p>
            ))}

          {/* Presentation Slides & Related Links for this activity */}
          {(Boolean(item.slidesUrl) || Boolean(item.relatedLinks && item.relatedLinks.length > 0)) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-border/40 border-t pt-2">
              {item.slidesUrl && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 border-primary/30 bg-primary/5 px-2.5 text-primary text-xs hover:bg-primary/10 hover:text-primary"
                >
                  <a href={item.slidesUrl} target="_blank" rel="noopener noreferrer">
                    <Presentation className="size-3.5" />
                    <span>{item.slidesTitle ?? "Open Slides"}</span>
                    <ExternalLink className="size-2.5" />
                  </a>
                </Button>
              )}

              {item.relatedLinks?.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/70 hover:text-foreground"
                >
                  <Link2 className="size-2.5 text-primary" />
                  <span className="max-w-[180px] truncate">{link.title || link.url}</span>
                  <ExternalLink className="size-2" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface UnifiedAgendaTimelineProps {
  bevyAgenda?: BevyAgenda | null;
  speakers?: BevySpeaker[] | null;
  firestoreSessions?: EventSession[] | null;
}

export function UnifiedAgendaTimeline({ bevyAgenda, speakers, firestoreSessions }: UnifiedAgendaTimelineProps) {
  const unified = useMemo(
    () => buildUnifiedAgenda(bevyAgenda, speakers, firestoreSessions),
    [bevyAgenda, speakers, firestoreSessions],
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");

  const visibleGroups = useMemo(() => {
    if (selectedSessionId === "all") {
      return unified.sessionGroups;
    }
    return unified.sessionGroups.filter((g) => g.id === selectedSessionId);
  }, [unified.sessionGroups, selectedSessionId]);

  const hasAnyContent =
    unified.totalItemsCount > 0 ||
    unified.sessionGroups.some(
      (g) => Boolean(g.slidesUrl) || Boolean(g.description) || Boolean(g.location) || g.items.length > 0,
    );

  if (!hasAnyContent) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 border-dashed p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Calendar className="size-6" />
        </div>
        <h4 className="mt-3 font-semibold text-base text-foreground">Agenda Schedule Coming Soon</h4>
        <p className="mt-1 max-w-sm text-muted-foreground text-xs">
          The agenda, speakers, and session schedule for this event are currently being finalized.
        </p>
      </div>
    );
  }

  const totalSessionCount = unified.totalItemsCount > 0 ? unified.totalItemsCount : unified.sessionGroups.length;

  return (
    <div className="space-y-6">
      {/* ── TOP CONTROLS: SESSION SWITCHER (Only rendered when multiple tracks/sessions exist) ── */}
      {unified.hasMultipleSessions && (
        <div className="flex flex-col gap-3 border-border/60 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-medium text-muted-foreground text-xs">Session:</span>
            <Button
              size="sm"
              variant={selectedSessionId === "all" ? "default" : "outline"}
              className="h-8 rounded-full text-xs"
              onClick={() => setSelectedSessionId("all")}
            >
              All Sessions ({totalSessionCount})
            </Button>
            {unified.sessionGroups.map((group) => (
              <Button
                key={group.id}
                size="sm"
                variant={selectedSessionId === group.id ? "default" : "outline"}
                className="h-8 rounded-full text-xs"
                onClick={() => setSelectedSessionId(group.id)}
              >
                {group.sessionTitle}
                {group.items.length > 0 && <span className="ml-1.5 opacity-70">({group.items.length})</span>}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* ── TIMELINE GROUPS ────────────────────────────────────────────── */}
      <div className="space-y-8">
        {visibleGroups.map((group, gIdx) => {
          const isSingleGenericGroup =
            !unified.hasMultipleSessions &&
            (group.sessionTitle === "Agenda Schedule" || group.sessionTitle === "Event Agenda Schedule") &&
            !group.description &&
            !group.slidesUrl &&
            !group.location &&
            !group.checkinDeadline &&
            !group.capacity;

          return (
            <div key={group.id} className="space-y-4">
              {/* Session Group Header Banner: omit bulky duplicate box for single generic schedule */}
              {isSingleGenericGroup && group.timeRange && (
                <div className="flex items-center justify-between px-1 text-muted-foreground text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="size-3.5 text-primary" />
                    {group.timeRange}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {group.items.length} {group.items.length === 1 ? "activity" : "activities"}
                  </Badge>
                </div>
              )}

              {!isSingleGenericGroup && (
                <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-2xs sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {unified.hasMultipleSessions && (
                        <span className="flex size-7 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary text-xs">
                          {gIdx + 1}
                        </span>
                      )}
                      <div>
                        <h4 className="font-bold text-foreground text-base tracking-tight sm:text-lg">
                          {group.sessionTitle}
                        </h4>
                        {group.timeRange && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground text-xs">
                            <Clock className="size-3.5 text-primary" />
                            <span>{group.timeRange}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Session Badges / Metrics */}
                    <div className="flex flex-wrap items-center gap-2">
                      {group.checkinDeadline && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 text-xs dark:text-amber-400"
                        >
                          <Clock className="size-3" />
                          Check-in: {group.checkinDeadline}
                        </Badge>
                      )}

                      {group.capacity !== undefined && group.capacity > 0 && (
                        <Badge
                          variant={group.capacity - (group.totalRegistered ?? 0) > 0 ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {group.capacity - (group.totalRegistered ?? 0) > 0
                            ? `${group.totalRegistered ?? 0}/${group.capacity} booked (${Math.max(0, group.capacity - (group.totalRegistered ?? 0))} left)`
                            : `Full (${group.capacity} max)`}
                        </Badge>
                      )}

                      {group.location && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                          <MapPin className="size-3 text-primary" />
                          {group.locationUrl ? (
                            <a
                              href={group.locationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-primary hover:underline"
                            >
                              <span>{group.location}</span>
                              <ExternalLink className="size-2.5" />
                            </a>
                          ) : (
                            <span>{group.location}</span>
                          )}
                        </span>
                      )}

                      <Badge variant="outline" className="text-xs">
                        {group.items.length} {group.items.length === 1 ? "activity" : "activities"}
                      </Badge>
                    </div>
                  </div>

                  {/* Session Description */}
                  {group.description && (
                    <div className="border-border/50 border-t pt-2.5 text-muted-foreground text-xs leading-relaxed">
                      {group.description.includes("<") && group.description.includes(">") ? (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground text-xs leading-relaxed break-words [&_p]:my-1 [&_a]:text-primary [&_a]:underline"
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: Session description HTML content
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(group.description) }}
                        />
                      ) : (
                        <p className="whitespace-pre-line">{group.description}</p>
                      )}
                    </div>
                  )}

                  {/* Session-level presentation slides & related links */}
                  {(Boolean(group.slidesUrl) || Boolean(group.relatedLinks && group.relatedLinks.length > 0)) && (
                    <div className="flex flex-wrap items-center gap-2 border-border/40 border-t pt-2.5">
                      {group.slidesUrl && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 border-primary/30 bg-primary/5 px-2.5 text-primary text-xs hover:bg-primary/10 hover:text-primary"
                        >
                          <a href={group.slidesUrl} target="_blank" rel="noopener noreferrer">
                            <Presentation className="size-3.5" />
                            <span>{group.slidesTitle ?? "Session Slides"}</span>
                            <ExternalLink className="size-2.5" />
                          </a>
                        </Button>
                      )}

                      {group.relatedLinks?.map((link) => (
                        <a
                          key={link.url}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/70 hover:text-foreground"
                        >
                          <Link2 className="size-2.5 text-primary" />
                          <span className="max-w-[180px] truncate">{link.title || link.url}</span>
                          <ExternalLink className="size-2" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* List of Agenda Items inside this Session */}
              {group.items.length === 0 ? (
                <div className="rounded-2xl border border-border/70 border-dashed py-6 text-center text-muted-foreground text-xs">
                  Detailed activity schedule for this session will be announced soon.
                </div>
              ) : (
                <div className="space-y-3.5 sm:space-y-4">
                  {group.items.map((item) => (
                    <AgendaItemCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
