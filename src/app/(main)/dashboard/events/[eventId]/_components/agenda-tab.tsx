"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { Calendar, ChevronDown, ExternalLink, Info, Plus, Presentation, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllEventSpeakers } from "@/lib/bevy/speakers";
import { findMatchingSpeakers, hasActualAgendaActivities, normalizeStr } from "@/lib/events/agenda-unification";
import { updateEventHighlightsMediaAction } from "@/lib/firestore/actions";
import type { EventPresentationSlide, EventPresentationSlideSpeaker, FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { type AgendaActivityOption, SortableSlideDeckCard } from "./sortable-slide-deck-card";

function normalizeSlides(
  rawSlides?: EventPresentationSlide[],
  legacySessions?: FirestoreEvent["sessions"],
): EventPresentationSlide[] {
  if (rawSlides && Array.isArray(rawSlides) && rawSlides.length > 0) {
    return rawSlides.map((s, idx) => ({
      ...s,
      id: s.id?.trim() ? s.id : `slide-${idx}-${Date.now()}`,
    }));
  }

  // Migration fallback: if presentation_slides is empty, check legacy sessions with slides
  if (legacySessions && Array.isArray(legacySessions)) {
    const slideSessions = legacySessions.filter(
      (s) => Boolean(s.slides_url) || Boolean(s.related_links && s.related_links.length > 0),
    );
    if (slideSessions.length > 0) {
      return slideSessions.map((s, idx) => ({
        id: s.id?.trim() ? s.id : `slide-${idx}-${Date.now()}`,
        agenda_activity_id: s.agenda_activity_id,
        title: s.title,
        time_slot: s.time_slot,
        speaker_name: s.speaker_name,
        slides_url: s.slides_url,
        slides_title: s.slides_title,
        related_links: s.related_links,
      }));
    }
  }

  return [];
}

interface AgendaTabProps {
  event: FirestoreEvent;
}

export function AgendaTab({ event }: AgendaTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [slides, setSlides] = useState<EventPresentationSlide[]>(() =>
    normalizeSlides(event.presentation_slides, event.sessions),
  );
  const [internalAgenda, setInternalAgenda] = useState(event.agenda);
  const [internalSpeakers, setInternalSpeakers] = useState(event.speakers);
  const [isAgendaLoading, setIsAgendaLoading] = useState(() => !hasActualAgendaActivities(event.agenda));
  const [isSaving, setIsSaving] = useState(false);
  const initialSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasActualAgendaActivities(event.agenda)) {
      setInternalAgenda(event.agenda);
      setIsAgendaLoading(false);
    }
  }, [event.agenda]);

  useEffect(() => {
    if (event.speakers && event.speakers.length > 0) {
      setInternalSpeakers(event.speakers);
    }
  }, [event.speakers]);

  // Determine if event is completed / past
  const isEventPast =
    event.status === "Completed" || (event.end_date ? new Date(event.end_date).getTime() < Date.now() : false);

  // Load latest Firestore data on mount
  useEffect(() => {
    let isMounted = true;
    async function loadLatestData() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (isMounted && docData) {
          const slideList = normalizeSlides(
            docData.presentation_slides ?? event.presentation_slides,
            docData.sessions ?? event.sessions,
          );
          setSlides(slideList);

          if (hasActualAgendaActivities(docData.agenda)) {
            setInternalAgenda(docData.agenda);
            setIsAgendaLoading(false);
          }
          if (docData.speakers && docData.speakers.length > 0) {
            setInternalSpeakers(docData.speakers);
          }

          initialSnapshotRef.current = JSON.stringify(slideList);
        }
      } catch (err) {
        console.warn("[AgendaTab] Failed to fetch latest event data:", err);
      }

      // If agenda is still missing or has 0 actual activities, attempt fallback fetch directly from Bevy
      const currentEffAgenda = event.agenda;
      if (!hasActualAgendaActivities(currentEffAgenda)) {
        try {
          setIsAgendaLoading(true);
          const { fetchBevyEventDetailAction } = await import("@/server/bevy-actions");
          const fresh = await fetchBevyEventDetailAction(String(event.id));
          if (isMounted && fresh) {
            if (hasActualAgendaActivities(fresh.agenda)) {
              setInternalAgenda(fresh.agenda);
            }
            const allSpeakers = getAllEventSpeakers(fresh);
            if (allSpeakers.length > 0) {
              setInternalSpeakers(allSpeakers);
            }
          }
        } catch (bevyErr) {
          console.warn("[AgendaTab] Fallback fetch for Bevy agenda failed:", bevyErr);
        } finally {
          if (isMounted) setIsAgendaLoading(false);
        }
      } else {
        if (isMounted) setIsAgendaLoading(false);
      }
    }

    initialSnapshotRef.current = JSON.stringify(normalizeSlides(event.presentation_slides, event.sessions));
    void loadLatestData();

    return () => {
      isMounted = false;
    };
  }, [event.id, event.presentation_slides, event.sessions, event.agenda]);

  // Dirty state calculation
  const currentSnapshot = JSON.stringify(slides);
  const isDirty = initialSnapshotRef.current !== null && initialSnapshotRef.current !== currentSnapshot;

  const handleDiscardChanges = () => {
    if (initialSnapshotRef.current !== null) {
      try {
        const snap = JSON.parse(initialSnapshotRef.current) as EventPresentationSlide[];
        setSlides(snap);
        toast.info("Discarded unsaved agenda changes.");
      } catch {
        // ignore
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    startTransition(async () => {
      try {
        const res = await updateEventHighlightsMediaAction(
          String(event.id),
          {
            presentation_slides: slides,
          },
          event,
        );

        if (res.success) {
          initialSnapshotRef.current = currentSnapshot;
          toast.success("Agenda presentation slides saved successfully!");
          router.refresh();
        } else {
          toast.error(res.error ?? "Failed to save agenda presentation slides.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save.";
        toast.error(msg);
      } finally {
        setIsSaving(false);
      }
    });
  };

  // Helper to update a slide's fields
  const handleUpdateSlide = (slideId: string, updates: Partial<EventPresentationSlide>) => {
    setSlides((prev) => prev.map((s) => (s.id === slideId ? { ...s, ...updates } : s)));
  };

  // Helper to add a related link to a slide
  const handleAddSlideRelatedLink = (slideId: string) => {
    setSlides((prev) =>
      prev.map((s) => {
        if (s.id !== slideId) return s;
        const currentLinks = s.related_links ?? [];
        return {
          ...s,
          related_links: [...currentLinks, { title: "", url: "" }],
        };
      }),
    );
  };

  // Helper to update a related link in a slide
  const handleUpdateSlideRelatedLink = (slideId: string, linkIndex: number, field: "title" | "url", val: string) => {
    setSlides((prev) =>
      prev.map((s) => {
        if (s.id !== slideId) return s;
        const currentLinks = [...(s.related_links ?? [])];
        if (!currentLinks[linkIndex]) return s;
        currentLinks[linkIndex] = {
          ...currentLinks[linkIndex],
          [field]: val,
        };
        return {
          ...s,
          related_links: currentLinks,
        };
      }),
    );
  };

  // Helper to remove a related link from a slide
  const handleRemoveSlideRelatedLink = (slideId: string, linkIndex: number) => {
    setSlides((prev) =>
      prev.map((s) => {
        if (s.id !== slideId) return s;
        const currentLinks = (s.related_links ?? []).filter((_, idx) => idx !== linkIndex);
        return {
          ...s,
          related_links: currentLinks,
        };
      }),
    );
  };

  // Extract all activity items from existing Bevy agenda
  const agendaActivities: AgendaActivityOption[] = useMemo(() => {
    const list: AgendaActivityOption[] = [];

    let effectiveAgenda = event.agenda;
    if (hasActualAgendaActivities(internalAgenda)) {
      effectiveAgenda = internalAgenda;
    } else if (hasActualAgendaActivities(event.agenda)) {
      effectiveAgenda = event.agenda;
    } else if (internalAgenda) {
      effectiveAgenda = internalAgenda;
    }
    const effectiveSpeakers = internalSpeakers && internalSpeakers.length > 0 ? internalSpeakers : event.speakers;

    let days: Array<{
      title?: string;
      items?: Array<{ activity?: string; time?: string; description?: string }>;
      agenda?: Array<{ activity?: string; time?: string; description?: string }>;
    }> = [];

    if (effectiveAgenda && typeof effectiveAgenda === "object") {
      if ("days" in effectiveAgenda && Array.isArray((effectiveAgenda as { days: unknown[] }).days)) {
        days = (effectiveAgenda as { days: typeof days }).days;
      } else if (Array.isArray(effectiveAgenda)) {
        const first = effectiveAgenda[0];
        if (first && typeof first === "object" && ("items" in first || "agenda" in first)) {
          days = effectiveAgenda as typeof days;
        } else {
          days = [{ items: effectiveAgenda as Array<{ activity?: string; time?: string; description?: string }> }];
        }
      }
    }

    days.forEach((day, dIdx) => {
      const items = day.items ?? day.agenda ?? [];
      items.forEach((item, iIdx) => {
        if (!item.activity?.trim()) return;
        const matched = [
          ...findMatchingSpeakers(item.description || "", effectiveSpeakers),
          ...findMatchingSpeakers(item.activity, effectiveSpeakers),
        ];
        const primarySpeaker = matched[0];
        list.push({
          id: `item-${dIdx}-${iIdx}`,
          time: item.time || "",
          activity: item.activity.trim(),
          speakerName: primarySpeaker?.name ?? "",
          speakerRole: primarySpeaker?.role ?? "",
          speakerAvatar: primarySpeaker?.avatar ?? "",
          description: item.description,
        });
      });
    });

    return list;
  }, [internalAgenda, internalSpeakers, event.agenda, event.speakers]);

  const isActivityAdded = (activityTitle: string) => {
    const norm = normalizeStr(activityTitle);
    return slides.some((s) => normalizeStr(s.title) === norm);
  };

  const handleAddFromAgenda = (act: AgendaActivityOption) => {
    const alreadyExists = slides.find((s) => normalizeStr(s.title) === normalizeStr(act.activity));
    if (alreadyExists) {
      toast.info(`"${act.activity}" is already in your slide deck list.`);
      return;
    }

    // Auto-detect all speakers/panelists from description and activity
    const effectiveSpeakersList = internalSpeakers && internalSpeakers.length > 0 ? internalSpeakers : event.speakers;
    const detected = [
      ...findMatchingSpeakers(act.description || "", effectiveSpeakersList),
      ...findMatchingSpeakers(act.activity, effectiveSpeakersList),
    ];
    const seenNames = new Set<string>();
    const boundSpeakers: EventPresentationSlideSpeaker[] = [];
    for (const d of detected) {
      const k = d.name.toLowerCase();
      if (!seenNames.has(k)) {
        seenNames.add(k);
        boundSpeakers.push({
          name: d.name,
          role: d.role,
          avatar_url: d.avatar,
          type: d.type,
        });
      }
    }

    const newSlide: EventPresentationSlide = {
      id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      agenda_activity_id: act.id,
      title: act.activity,
      time_slot: act.time,
      speaker_name: boundSpeakers.length > 0 ? boundSpeakers.map((s) => s.name).join(", ") : act.speakerName,
      speakers: boundSpeakers.length > 0 ? boundSpeakers : undefined,
      slides_url: "",
      slides_title: "Download Slides",
      related_links: [],
    };
    setSlides((prev) => [...prev, newSlide]);
    toast.success(`Attached agenda activity "${act.activity}".`);
  };

  const handleAddAllFromAgenda = () => {
    const unadded = agendaActivities.filter((act) => !isActivityAdded(act.activity));
    if (unadded.length === 0) {
      toast.info("All agenda activities already have slide attachments.");
      return;
    }

    const effectiveSpeakersList = internalSpeakers && internalSpeakers.length > 0 ? internalSpeakers : event.speakers;

    const newSlides: EventPresentationSlide[] = unadded.map((act, idx) => {
      const detected = [
        ...findMatchingSpeakers(act.description || "", effectiveSpeakersList),
        ...findMatchingSpeakers(act.activity, effectiveSpeakersList),
      ];
      const seenNames = new Set<string>();
      const boundSpeakers: EventPresentationSlideSpeaker[] = [];
      for (const d of detected) {
        const k = d.name.toLowerCase();
        if (!seenNames.has(k)) {
          seenNames.add(k);
          boundSpeakers.push({
            name: d.name,
            role: d.role,
            avatar_url: d.avatar,
            type: d.type,
          });
        }
      }

      return {
        id: `slide-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        agenda_activity_id: act.id,
        title: act.activity,
        time_slot: act.time,
        speaker_name: boundSpeakers.length > 0 ? boundSpeakers.map((s) => s.name).join(", ") : act.speakerName,
        speakers: boundSpeakers.length > 0 ? boundSpeakers : undefined,
        slides_url: "",
        slides_title: "Download Slides",
        related_links: [],
      };
    });

    setSlides((prev) => [...prev, ...newSlides]);
    toast.success(`Attached ${newSlides.length} agenda activity slide deck${newSlides.length > 1 ? "s" : ""}.`);
  };

  const handleAddCustomSlide = () => {
    const newSlide: EventPresentationSlide = {
      id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: "New Presentation / Session",
      slides_title: "Download Slides",
      slides_url: "",
      related_links: [],
    };
    setSlides((prev) => [...prev, newSlide]);
    toast.success("Added new slide attachment card.");
  };

  const handleRemoveSlide = (slideId: string) => {
    const targetSlide = slides.find((s) => s.id === slideId);
    setSlides((prev) => prev.filter((item) => item.id !== slideId));
    toast.info(`Removed slides for "${targetSlide?.title || "Presentation"}".`);
  };

  const handleMoveSlideUp = (index: number) => {
    if (index <= 0) return;
    setSlides((prev) => {
      const next = [...prev];
      const item = next[index];
      const prevItem = next[index - 1];
      if (!item || !prevItem) return prev;
      next[index - 1] = item;
      next[index] = prevItem;
      return next;
    });
  };

  const handleMoveSlideDown = (index: number) => {
    if (index >= slides.length - 1) return;
    setSlides((prev) => {
      const next = [...prev];
      const item = next[index];
      const nextItem = next[index + 1];
      if (!item || !nextItem) return prev;
      next[index] = nextItem;
      next[index + 1] = item;
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { source } = event.operation;
    if (event.canceled || !isSortable(source) || source.initialIndex === source.index) {
      return;
    }
    setSlides((prev) => {
      const next = [...prev];
      const [movedItem] = next.splice(source.initialIndex, 1);
      if (movedItem) {
        next.splice(source.index, 0, movedItem);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6 pb-24">
      {/* ── Top Overview Banner ────────────────────────────────────────── */}
      <Card className="border-primary/20 bg-gradient-to-r from-card via-card to-primary/5 shadow-2xs">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-2xs">
              <Calendar className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-base text-foreground tracking-tight sm:text-lg">
                  Event Agenda & Presentation Slides
                </h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    isEventPast
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
                  )}
                >
                  {isEventPast ? "Event Concluded" : "Upcoming Event"}
                </Badge>
                {agendaActivities.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {agendaActivities.length} Bevy {agendaActivities.length === 1 ? "Activity" : "Activities"}
                  </Badge>
                )}
                {slides.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                    {slides.length} Deck{slides.length === 1 ? "" : "s"} Attached
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-muted-foreground text-xs sm:text-sm">
                Bind slide decks, codelab links, and attach multiple speakers, panelists, or facilitators to Bevy agenda
                items. These will be displayed on the public event agenda timeline.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
              <Link href={`/events/${event.id}`} target="_blank" rel="noopener noreferrer">
                <span>View Public Agenda</span>
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Slide Decks & Agenda Activities List ──────────────────────── */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Presentation className="size-4 text-primary" />
              <CardTitle className="text-base sm:text-lg">Presentation Slides & Resources</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Organize slides, link repository/codelab resources, and attach multiple panelists or facilitators to each
              session.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {isAgendaLoading ? (
              <Skeleton className="h-8 w-44 rounded-md" />
            ) : (
              <>
                {agendaActivities.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                        <Plus className="size-3.5 text-primary" />
                        <span>Attach from Agenda</span>
                        <ChevronDown className="size-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 max-h-80 overflow-y-auto">
                      <DropdownMenuLabel className="text-xs">Select Bevy Agenda Activity</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {agendaActivities.map((act) => {
                        const added = isActivityAdded(act.activity);
                        const matchingSlide = slides.find(
                          (s) =>
                            s.agenda_activity_id === act.id || normalizeStr(s.title) === normalizeStr(act.activity),
                        );
                        const boundSpeaker = matchingSlide?.speaker_name || act.speakerName;
                        return (
                          <DropdownMenuItem
                            key={act.id}
                            disabled={added}
                            onClick={() => handleAddFromAgenda(act)}
                            className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="font-semibold text-xs text-foreground truncate">{act.activity}</span>
                              {added ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] shrink-0 h-4 px-1.5 bg-emerald-500/15 text-emerald-600"
                                >
                                  Attached
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground shrink-0">{act.time}</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between w-full text-[11px]">
                              {boundSpeaker ? (
                                <span className="text-muted-foreground truncate">
                                  Speaker: <strong className="text-foreground font-medium">{boundSpeaker}</strong>
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic text-[10px]">No presenter specified</span>
                              )}
                              {added && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ Added</span>
                              )}
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleAddAllFromAgenda}
                        disabled={agendaActivities.every((act) => isActivityAdded(act.activity))}
                        className="gap-2 cursor-pointer font-medium text-primary text-xs"
                      >
                        <Sparkles className="size-3.5" />
                        <span>
                          Attach All from Agenda ({agendaActivities.filter((a) => !isActivityAdded(a.activity)).length}{" "}
                          remaining)
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <Button size="sm" variant="ghost" onClick={handleAddCustomSlide} className="gap-1.5 text-xs">
                  <Plus className="size-3.5" />
                  <span>Custom Deck</span>
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isAgendaLoading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 border-dashed bg-muted/15 p-8 text-center">
              <Skeleton className="size-12 rounded-2xl mb-3" />
              <Skeleton className="h-4 w-52 mb-2" />
              <Skeleton className="h-3 w-80 max-w-full mb-4" />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Skeleton className="h-8 w-40 rounded-md" />
                <Skeleton className="h-8 w-36 rounded-md" />
              </div>
            </div>
          ) : agendaActivities.length === 0 && slides.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 border-dashed bg-muted/20 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                <Info className="size-6 opacity-60 text-primary" />
              </div>
              <p className="mt-3 font-semibold text-foreground text-sm">No Bevy Agenda Items Found</p>
              <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                To bind presentation slides, ensure the agenda schedule and presenters are configured in Bevy Chapter
                management. You can also add custom slide decks manually.
              </p>
              <Button size="sm" variant="outline" onClick={handleAddCustomSlide} className="mt-4 gap-1.5 text-xs">
                <Plus className="size-3.5" />
                Add Custom Slide Deck
              </Button>
            </div>
          ) : slides.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 border-dashed bg-muted/20 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                <Presentation className="size-6 opacity-60" />
              </div>
              <p className="mt-3 font-semibold text-foreground text-sm">No presentation slides attached yet</p>
              <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                Select from your {agendaActivities.length} Bevy agenda activities to attach presentation slides, codelab
                links, and bind multiple panelists or facilitators.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" onClick={handleAddAllFromAgenda} className="gap-1.5 text-xs">
                  <Sparkles className="size-3.5" />
                  Attach All from Agenda ({agendaActivities.length})
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <Plus className="size-3.5" />
                      Select from Agenda
                      <ChevronDown className="size-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-80 max-h-80 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">Choose Bevy Agenda Activity</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {agendaActivities.map((act) => {
                      const added = isActivityAdded(act.activity);
                      const matchingSlide = slides.find(
                        (s) => s.agenda_activity_id === act.id || normalizeStr(s.title) === normalizeStr(act.activity),
                      );
                      const boundSpeaker = matchingSlide?.speaker_name || act.speakerName;
                      return (
                        <DropdownMenuItem
                          key={act.id}
                          disabled={added}
                          onClick={() => handleAddFromAgenda(act)}
                          className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="font-semibold text-xs text-foreground truncate">{act.activity}</span>
                            {added ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] shrink-0 h-4 px-1.5 bg-emerald-500/15 text-emerald-600"
                              >
                                Attached
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground shrink-0">{act.time}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between w-full text-[11px]">
                            {boundSpeaker ? (
                              <span className="text-muted-foreground truncate">
                                Speaker: <strong className="text-foreground font-medium">{boundSpeaker}</strong>
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic text-[10px]">No presenter specified</span>
                            )}
                            {added && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ Added</span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm" variant="ghost" onClick={handleAddCustomSlide} className="gap-1.5 text-xs">
                  <Plus className="size-3.5" />
                  Custom Deck
                </Button>
              </div>
            </div>
          ) : (
            <DragDropProvider onDragEnd={handleDragEnd}>
              <div className="space-y-4">
                {slides.map((slide, sIdx) => (
                  <SortableSlideDeckCard
                    key={slide.id}
                    slide={slide}
                    index={sIdx}
                    totalSlides={slides.length}
                    agendaActivities={agendaActivities}
                    speakers={internalSpeakers ?? event.speakers}
                    onUpdate={handleUpdateSlide}
                    onRemove={handleRemoveSlide}
                    onMoveUp={handleMoveSlideUp}
                    onMoveDown={handleMoveSlideDown}
                    onAddRelatedLink={handleAddSlideRelatedLink}
                    onUpdateRelatedLink={handleUpdateSlideRelatedLink}
                    onRemoveRelatedLink={handleRemoveSlideRelatedLink}
                  />
                ))}
              </div>
            </DragDropProvider>
          )}
        </CardContent>
      </Card>

      {/* ── Fixed Floating Bottom Save Bar ──────────────────────────── */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving || isPending}
        onSave={handleSave}
        onDiscard={handleDiscardChanges}
        discardLabel="Discard"
        saveLabel="Save Changes"
        savingLabel="Saving Agenda..."
        savedLabel="Agenda Saved"
        helperText="Agenda presentations will immediately reflect on the public event page."
      />
    </div>
  );
}
