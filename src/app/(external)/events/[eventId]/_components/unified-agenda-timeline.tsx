"use client";

import { useMemo, useState } from "react";

import { Calendar, Clock, ExternalLink, Layers, Link2, MapPin, Presentation, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BevyAgenda, BevySpeaker } from "@/lib/bevy/types";
import { buildUnifiedAgenda, type UnifiedAgendaItem, type UnifiedSessionTrack } from "@/lib/events/agenda-unification";
import type { EventSession } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

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

interface TrackCardProps {
  track: UnifiedSessionTrack;
}

function TrackCard({ track }: TrackCardProps) {
  const capacity = track.capacity ?? 0;
  const totalRegistered = track.totalRegistered ?? 0;
  const available = capacity > 0 ? capacity - totalRegistered > 0 : true;
  const remaining = Math.max(0, capacity - totalRegistered);

  let capacityBadgeText = "Open Capacity";
  if (capacity > 0) {
    capacityBadgeText = available
      ? `${totalRegistered}/${capacity} booked (${remaining} left)`
      : `Full (${capacity} max)`;
  }

  return (
    <div className="space-y-2.5 rounded-2xl border border-border/80 bg-background/50 p-3.5 transition-all hover:border-border">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <Badge variant="outline" className="border-primary/30 bg-primary/5 font-semibold text-[10px] text-primary">
          {track.trackName}
        </Badge>
        <Badge variant={available ? "secondary" : "destructive"} className="text-[10px]">
          {capacityBadgeText}
        </Badge>
      </div>

      <div>
        <h6 className="font-semibold text-foreground text-sm leading-snug">{track.title}</h6>
        {track.speakerName && (
          <p className="mt-0.5 text-muted-foreground text-xs">
            Speaker: <span className="font-medium text-foreground">{track.speakerName}</span>
          </p>
        )}
      </div>

      {track.description &&
        (track.description.includes("<") && track.description.includes(">") ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none line-clamp-3 text-muted-foreground text-xs leading-relaxed break-words [&_p]:my-1 [&_a]:text-primary [&_a]:underline"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Session description HTML content
            dangerouslySetInnerHTML={{ __html: track.description }}
          />
        ) : (
          <p className="line-clamp-3 text-muted-foreground text-xs leading-relaxed break-words">{track.description}</p>
        ))}

      {/* Location / Check-in deadline */}
      <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
        {(track.location ?? track.locationUrl) &&
          (track.locationUrl ? (
            <a
              href={track.locationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <MapPin className="size-3" />
              <span>{track.location ?? "Room Location"}</span>
              <ExternalLink className="size-2.5" />
            </a>
          ) : (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" /> {track.location}
            </span>
          ))}

        {track.checkinDeadline && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Clock className="size-3" /> Check-in: {track.checkinDeadline}
          </span>
        )}
      </div>

      {/* Slides & Links */}
      {(Boolean(track.slidesUrl) || Boolean(track.relatedLinks && track.relatedLinks.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 border-border/40 border-t pt-2">
          {track.slidesUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 border-primary/30 bg-primary/5 px-2.5 text-primary text-xs hover:bg-primary/10 hover:text-primary"
            >
              <a href={track.slidesUrl} target="_blank" rel="noopener noreferrer">
                <Presentation className="size-3.5" />
                <span>{track.slidesTitle ?? "Open Slides"}</span>
                <ExternalLink className="size-2.5" />
              </a>
            </Button>
          )}

          {track.relatedLinks?.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            >
              <Link2 className="size-2.5 text-primary" />
              <span className="max-w-[140px] truncate">{link.title || link.url}</span>
              <ExternalLink className="size-2" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

interface AgendaItemCardProps {
  item: UnifiedAgendaItem;
  selectedTrack: string;
}

function AgendaItemCard({ item, selectedTrack }: AgendaItemCardProps) {
  // If track filter is active, check if this item matches
  if (selectedTrack !== "all") {
    const hasMatchingTrack = item.tracks.some((t) => t.id === selectedTrack || t.trackName === selectedTrack);
    // If it's a dedicated breakout/track item and does NOT match the selected track, hide it
    if (item.tracks.length > 0 && !hasMatchingTrack) {
      return null;
    }
  }

  const primaryTrack = item.tracks[0];
  const isMultiTrack = item.tracks.length > 1;

  // Capacity info for single-track session
  const capacity = primaryTrack?.capacity ?? 0;
  const totalRegistered = primaryTrack?.totalRegistered ?? 0;
  const available = capacity > 0 ? capacity - totalRegistered > 0 : true;
  const remaining = Math.max(0, capacity - totalRegistered);

  let sessionBadgeText = "Open Capacity";
  if (capacity > 0) {
    sessionBadgeText = available
      ? `${totalRegistered}/${capacity} booked (${remaining} left)`
      : `Full (${capacity} max)`;
  }

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

            {!isMultiTrack && primaryTrack && (
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/5 font-semibold text-[10px] text-primary"
              >
                {primaryTrack.trackName}
              </Badge>
            )}

            {!isMultiTrack && primaryTrack && (
              <Badge variant={available ? "secondary" : "destructive"} className="text-[10px]">
                {sessionBadgeText}
              </Badge>
            )}

            {isMultiTrack && (
              <Badge variant="secondary" className="gap-1 bg-primary/10 text-[10px] text-primary">
                <Layers className="size-3" />
                {item.tracks.length} Concurrent Tracks
              </Badge>
            )}

            {item.checkinDeadline && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <Clock className="size-3" /> Check-in: {item.checkinDeadline}
              </span>
            )}
          </div>

          {/* Activity / Session Title */}
          <h5 className="font-semibold text-foreground text-sm leading-snug sm:text-base">{item.activity}</h5>

          {/* Speaker Card / Attribution (e.g. event 122720) */}
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
                dangerouslySetInnerHTML={{ __html: item.description }}
              />
            ) : (
              <p className="whitespace-pre-line text-muted-foreground text-xs leading-relaxed break-words">
                {item.description}
              </p>
            ))}

          {/* Location details */}
          {(item.location ?? item.locationUrl) && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <MapPin className="size-3 text-primary" />
              {item.locationUrl ? (
                <a
                  href={item.locationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <span>{item.location ?? "Venue Location"}</span>
                  <ExternalLink className="size-2.5" />
                </a>
              ) : (
                <span>{item.location}</span>
              )}
            </div>
          )}

          {/* Concurrent Breakout Tracks Grid (if 2+ parallel tracks) */}
          {isMultiTrack && (
            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              {item.tracks.map((track) => (
                <TrackCard key={track.id} track={track} />
              ))}
            </div>
          )}

          {/* Speaker Presentation Slides & Related Links for single-track session */}
          {!isMultiTrack && (Boolean(item.slidesUrl) || Boolean(item.relatedLinks && item.relatedLinks.length > 0)) && (
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
  const [selectedTrack, setSelectedTrack] = useState<string>("all");

  const visibleGroups = useMemo(() => {
    if (selectedSessionId === "all") {
      return unified.sessionGroups;
    }
    return unified.sessionGroups.filter((g) => g.id === selectedSessionId);
  }, [unified.sessionGroups, selectedSessionId]);

  if (unified.totalItemsCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 border-dashed p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Calendar className="size-6" />
        </div>
        <h4 className="mt-3 font-semibold text-base text-foreground">Agenda Schedule Coming Soon</h4>
        <p className="mt-1 max-w-sm text-muted-foreground text-xs">
          The agenda, speakers, and breakout tracks for this event are currently being finalized.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── TOP CONTROLS: SESSION SWITCHER & TRACK FILTER ───────────────── */}
      <div className="flex flex-col gap-3 border-border/60 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Session Switcher (e.g. Morning Session vs Afternoon Session as in Event 122720) */}
        {unified.hasMultipleSessions ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-medium text-muted-foreground text-xs">Session:</span>
            <Button
              size="sm"
              variant={selectedSessionId === "all" ? "default" : "outline"}
              className="h-8 rounded-full text-xs"
              onClick={() => setSelectedSessionId("all")}
            >
              All Sessions ({unified.totalItemsCount})
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
                <span className="ml-1.5 opacity-70">({group.items.length})</span>
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <span className="font-semibold text-foreground text-sm">Event Agenda Schedule</span>
          </div>
        )}

        {/* Track Filter (if 2+ distinct tracks exist) */}
        {unified.allAvailableTracks.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-medium text-muted-foreground text-xs">Track:</span>
            <Button
              size="sm"
              variant={selectedTrack === "all" ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setSelectedTrack("all")}
            >
              All Tracks
            </Button>
            {unified.allAvailableTracks.map((tr) => (
              <Button
                key={tr.id}
                size="sm"
                variant={selectedTrack === tr.id || selectedTrack === tr.name ? "secondary" : "ghost"}
                className="h-7 text-xs"
                onClick={() => setSelectedTrack(tr.id)}
              >
                {tr.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* ── TIMELINE GROUPS ────────────────────────────────────────────── */}
      <div className="space-y-8">
        {visibleGroups.map((group, gIdx) => (
          <div key={group.id} className="space-y-4">
            {/* Session Group Banner (shown when multiple sessions exist) */}
            {unified.hasMultipleSessions && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/50 bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-xs">
                    {gIdx + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-foreground text-sm tracking-tight sm:text-base">
                      {group.sessionTitle}
                    </h4>
                    {group.timeRange && (
                      <p className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
                        <Clock className="size-3" />
                        {group.timeRange}
                      </p>
                    )}
                  </div>
                </div>

                <Badge variant="outline" className="text-xs">
                  {group.items.length} {group.items.length === 1 ? "activity" : "activities"}
                </Badge>
              </div>
            )}

            {/* List of Agenda Items */}
            <div className="space-y-3.5 sm:space-y-4">
              {group.items.map((item) => (
                <AgendaItemCard key={item.id} item={item} selectedTrack={selectedTrack} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
