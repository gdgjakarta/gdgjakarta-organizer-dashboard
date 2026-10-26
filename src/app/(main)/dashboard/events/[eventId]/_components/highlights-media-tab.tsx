"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import {
  Calendar,
  Camera,
  ChevronDown,
  ExternalLink,
  Info,
  Play,
  Plus,
  Presentation,
  Sparkles,
  Video,
} from "lucide-react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { findMatchingSpeaker, normalizeStr } from "@/lib/events/agenda-unification";
import { parsePhotoAlbum, parseVideoUrl } from "@/lib/events/media-utils";
import { updateEventHighlightsMediaAction } from "@/lib/firestore/actions";
import type { EventPresentationSlide, FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { HtmlEditText } from "./html-edit-text";
import { SortableSlideDeckCard } from "./sortable-slide-deck-card";

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

interface HighlightsMediaTabProps {
  event: FirestoreEvent;
}

export function HighlightsMediaTab({ event }: HighlightsMediaTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [highlightVideoUrl, setHighlightVideoUrl] = useState(event.highlight_video_url ?? "");
  const [highlightVideoTitle, setHighlightVideoTitle] = useState(event.highlight_video_title ?? "");
  const [photoAlbumUrl, setPhotoAlbumUrl] = useState(event.photo_album_url ?? "");
  const [photoAlbumTitle, setPhotoAlbumTitle] = useState(event.photo_album_title ?? "");
  const [recapDescription, setRecapDescription] = useState(event.recap_description ?? "");
  const [slides, setSlides] = useState<EventPresentationSlide[]>(() =>
    normalizeSlides(event.presentation_slides, event.sessions),
  );
  const [internalAgenda, setInternalAgenda] = useState(event.agenda);
  const [internalSpeakers, setInternalSpeakers] = useState(event.speakers);
  const [isAgendaLoading, setIsAgendaLoading] = useState(() => {
    const raw = event.agenda as unknown;
    if (!raw) return true;
    if (typeof raw === "object" && "days" in (raw as Record<string, unknown>)) {
      const days = (raw as { days: unknown[] }).days;
      return !Array.isArray(days) || days.length === 0;
    }
    if (Array.isArray(raw)) return raw.length === 0;
    return true;
  });

  useEffect(() => {
    if (event.agenda) {
      setInternalAgenda(event.agenda);
      setIsAgendaLoading(false);
    }
  }, [event.agenda]);

  useEffect(() => {
    if (event.speakers && event.speakers.length > 0) {
      setInternalSpeakers(event.speakers);
    }
  }, [event.speakers]);

  const [isSaving, setIsSaving] = useState(false);
  const initialSnapshotRef = useRef<string | null>(null);

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
          const videoUrl = docData.highlight_video_url ?? event.highlight_video_url ?? "";
          const videoTitle = docData.highlight_video_title ?? event.highlight_video_title ?? "";
          const albumUrl = docData.photo_album_url ?? event.photo_album_url ?? "";
          const albumTitle = docData.photo_album_title ?? event.photo_album_title ?? "";
          const recap = docData.recap_description ?? event.recap_description ?? "";
          const slideList = normalizeSlides(
            docData.presentation_slides ?? event.presentation_slides,
            docData.sessions ?? event.sessions,
          );

          setHighlightVideoUrl(videoUrl);
          setHighlightVideoTitle(videoTitle);
          setPhotoAlbumUrl(albumUrl);
          setPhotoAlbumTitle(albumTitle);
          setRecapDescription(recap);
          setSlides(slideList);

          if (docData.agenda) {
            setInternalAgenda(docData.agenda);
            setIsAgendaLoading(false);
          }
          if (docData.speakers && docData.speakers.length > 0) {
            setInternalSpeakers(docData.speakers);
          }

          initialSnapshotRef.current = JSON.stringify({
            highlightVideoUrl: videoUrl,
            highlightVideoTitle: videoTitle,
            photoAlbumUrl: albumUrl,
            photoAlbumTitle: albumTitle,
            recapDescription: recap,
            slides: slideList,
          });
        }
      } catch (err) {
        console.warn("[HighlightsMediaTab] Failed to fetch latest event data:", err);
      }

      // If agenda is still missing or has 0 items, attempt fallback fetch directly from Bevy
      const currentEffAgenda = internalAgenda ?? event.agenda;
      const rawDays =
        currentEffAgenda && typeof currentEffAgenda === "object" && "days" in currentEffAgenda
          ? (currentEffAgenda as { days: unknown[] }).days
          : Array.isArray(currentEffAgenda)
            ? currentEffAgenda
            : [];
      if (!rawDays || (Array.isArray(rawDays) && rawDays.length === 0)) {
        try {
          setIsAgendaLoading(true);
          const { fetchBevyEventDetailAction } = await import("@/server/bevy-actions");
          const fresh = await fetchBevyEventDetailAction(String(event.id));
          if (isMounted && fresh) {
            if (fresh.agenda) {
              setInternalAgenda(fresh.agenda);
            }
            if (fresh.speakers && fresh.speakers.length > 0) {
              setInternalSpeakers(fresh.speakers);
            }
          }
        } catch (bevyErr) {
          console.warn("[HighlightsMediaTab] Fallback fetch for Bevy agenda failed:", bevyErr);
        } finally {
          if (isMounted) setIsAgendaLoading(false);
        }
      } else {
        if (isMounted) setIsAgendaLoading(false);
      }
    }

    initialSnapshotRef.current = JSON.stringify({
      highlightVideoUrl: event.highlight_video_url ?? "",
      highlightVideoTitle: event.highlight_video_title ?? "",
      photoAlbumUrl: event.photo_album_url ?? "",
      photoAlbumTitle: event.photo_album_title ?? "",
      recapDescription: event.recap_description ?? "",
      slides: normalizeSlides(event.presentation_slides, event.sessions),
    });

    void loadLatestData();

    return () => {
      isMounted = false;
    };
  }, [
    event.id,
    event.highlight_video_url,
    event.highlight_video_title,
    event.photo_album_url,
    event.photo_album_title,
    event.recap_description,
    event.presentation_slides,
    event.sessions,
    event.agenda,
    internalAgenda,
  ]);

  // Dirty state calculation
  const currentSnapshot = JSON.stringify({
    highlightVideoUrl,
    highlightVideoTitle,
    photoAlbumUrl,
    photoAlbumTitle,
    recapDescription,
    slides,
  });
  const isDirty = initialSnapshotRef.current !== null && initialSnapshotRef.current !== currentSnapshot;

  const parsedVideo = parseVideoUrl(highlightVideoUrl);
  const parsedAlbum = parsePhotoAlbum(photoAlbumUrl);

  const handleDiscardChanges = () => {
    if (initialSnapshotRef.current !== null) {
      try {
        const snap = JSON.parse(initialSnapshotRef.current) as {
          highlightVideoUrl: string;
          highlightVideoTitle: string;
          photoAlbumUrl: string;
          photoAlbumTitle: string;
          recapDescription: string;
          slides: EventPresentationSlide[];
        };
        setHighlightVideoUrl(snap.highlightVideoUrl);
        setHighlightVideoTitle(snap.highlightVideoTitle);
        setPhotoAlbumUrl(snap.photoAlbumUrl);
        setPhotoAlbumTitle(snap.photoAlbumTitle);
        setRecapDescription(snap.recapDescription);
        setSlides(snap.slides);
        toast.info("Discarded unsaved changes.");
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
            highlight_video_url: highlightVideoUrl,
            highlight_video_title: highlightVideoTitle,
            photo_album_url: photoAlbumUrl,
            photo_album_title: photoAlbumTitle,
            recap_description: recapDescription,
            presentation_slides: slides,
          },
          event,
        );

        if (res.success) {
          initialSnapshotRef.current = currentSnapshot;
          toast.success("Event highlights, photo album, and presentation slides saved successfully!");
          router.refresh();
        } else {
          toast.error(res.error ?? "Failed to save highlights and media.");
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
  const agendaActivities = useMemo(() => {
    const list: Array<{
      id: string;
      time: string;
      activity: string;
      speakerName: string;
      speakerRole?: string;
      speakerAvatar?: string;
      description?: string;
    }> = [];

    const effectiveAgenda = internalAgenda ?? event.agenda;
    const effectiveSpeakers = internalSpeakers ?? event.speakers;

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
        const speakerMatch =
          findMatchingSpeaker(item.description || "", effectiveSpeakers) ??
          findMatchingSpeaker(item.activity, effectiveSpeakers);
        list.push({
          id: `item-${dIdx}-${iIdx}`,
          time: item.time || "",
          activity: item.activity.trim(),
          speakerName: speakerMatch?.speakerName ?? "",
          speakerRole: speakerMatch?.speakerRole ?? "",
          speakerAvatar: speakerMatch?.speakerAvatar ?? "",
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

  const handleAddFromAgenda = (act: {
    id: string;
    time: string;
    activity: string;
    speakerName: string;
    description?: string;
  }) => {
    const alreadyExists = slides.find((s) => normalizeStr(s.title) === normalizeStr(act.activity));
    if (alreadyExists) {
      toast.info(`"${act.activity}" is already in your slide deck list.`);
      return;
    }

    const newSlide: EventPresentationSlide = {
      id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      agenda_activity_id: act.id,
      title: act.activity,
      time_slot: act.time,
      speaker_name: act.speakerName,
      slides_url: "",
      slides_title: "Download Slides",
      related_links: [],
    };
    setSlides((prev) => [...prev, newSlide]);
    toast.success(`Attached presentation slides for "${act.activity}".`);
  };

  const handleAddAllFromAgenda = () => {
    const unadded = agendaActivities.filter((act) => !isActivityAdded(act.activity));
    if (unadded.length === 0) {
      toast.info("All agenda activities already have slide attachments.");
      return;
    }

    const newSlides: EventPresentationSlide[] = unadded.map((act, idx) => ({
      id: `slide-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      agenda_activity_id: act.id,
      title: act.activity,
      time_slot: act.time,
      speaker_name: act.speakerName,
      slides_url: "",
      slides_title: "Download Slides",
      related_links: [],
    }));

    setSlides((prev) => [...prev, ...newSlides]);
    toast.success(`Attached ${newSlides.length} agenda activity slide deck${newSlides.length > 1 ? "s" : ""}.`);
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
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-base text-foreground tracking-tight sm:text-lg">
                  Event Highlights & Post-Event Media
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
              </div>
              <p className="mt-1 text-muted-foreground text-xs sm:text-sm">
                Embed official highlight videos, link Google Photos albums, and bind presentation slides and resources
                directly to Bevy agenda items and speakers.
              </p>
            </div>
          </div>

          <Button asChild variant="outline" size="sm" className="gap-1.5 self-start text-xs sm:self-auto">
            <Link href={`/events/${event.id}`} target="_blank" rel="noopener noreferrer">
              <span>View Public Page</span>
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* ── 1. Official Highlight Video ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Video className="size-4 text-primary" />
            <CardTitle className="text-base sm:text-lg">Official Event Highlight Video</CardTitle>
          </div>
          <CardDescription>
            Paste a YouTube (video, shorts, embed) or Vimeo link. It will automatically render as a responsive 16:9
            embedded player in the public Highlights tab.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="highlight-video-url">Highlight Video URL (YouTube, Vimeo, MP4)</FieldLabel>
              <Input
                id="highlight-video-url"
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/... or https://vimeo.com/..."
                value={highlightVideoUrl}
                onChange={(e) => setHighlightVideoUrl(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5">
                <p className="text-[11px] text-muted-foreground">
                  Supports YouTube standard URLs, short links (youtu.be), Shorts, and Vimeo video links.
                </p>
                {highlightVideoUrl && parsedVideo?.embedUrl && (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                  >
                    ✓ Valid {parsedVideo.type.toUpperCase()} embed detected
                  </Badge>
                )}
              </div>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="highlight-video-title">Video Display Title (Optional)</FieldLabel>
              <Input
                id="highlight-video-title"
                placeholder="e.g. GDG Jakarta DevFest 2025 Highlight Reel"
                value={highlightVideoTitle}
                onChange={(e) => setHighlightVideoTitle(e.target.value)}
              />
            </Field>
          </div>

          {/* Live Video Preview Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="font-medium text-foreground">Interactive Player Preview</span>
              {parsedVideo?.embedUrl && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  Ready to display on public event page
                </span>
              )}
            </div>

            {parsedVideo?.embedUrl ? (
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-black/90 shadow-inner">
                <div className="relative aspect-video w-full">
                  <iframe
                    src={parsedVideo.embedUrl}
                    title={highlightVideoTitle || "Event Highlight Video"}
                    className="absolute inset-0 size-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 border-dashed bg-muted/20 p-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Play className="size-5" />
                </div>
                <p className="mt-2 font-medium text-muted-foreground text-xs">No video URL entered yet</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                  Add a YouTube or Vimeo link above to preview the embedded player.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Official Photo Album ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Camera className="size-4 text-primary" />
            <CardTitle className="text-base sm:text-lg">Official Event Photo Album</CardTitle>
          </div>
          <CardDescription>
            Provide a public Google Photos, Google Drive folder, or Flickr album link. Attendees can browse photos from
            the public highlights tab.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="photo-album-url">Photo Album URL (Google Photos, Drive, Flickr)</FieldLabel>
              <Input
                id="photo-album-url"
                placeholder="https://photos.app.goo.gl/... or https://drive.google.com/drive/folders/..."
                value={photoAlbumUrl}
                onChange={(e) => setPhotoAlbumUrl(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5">
                <p className="text-[11px] text-muted-foreground">
                  Make sure the shared album has public read permissions enabled.
                </p>
                {photoAlbumUrl && parsedAlbum && (
                  <Badge
                    variant="outline"
                    className="border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400"
                  >
                    ✓ {parsedAlbum.label} link detected
                  </Badge>
                )}
              </div>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="photo-album-title">Photo Album Display Title (Optional)</FieldLabel>
              <Input
                id="photo-album-title"
                placeholder="e.g. Official GDG Jakarta Event Photos"
                value={photoAlbumTitle}
                onChange={(e) => setPhotoAlbumTitle(e.target.value)}
              />
            </Field>
          </div>

          {photoAlbumUrl && (
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 p-3.5">
              <div className="flex items-center gap-2 text-xs">
                <Camera className="size-4 text-primary" />
                <span className="font-medium text-foreground">{photoAlbumTitle || "Official Event Photo Album"}</span>
              </div>
              <Button asChild size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                <a href={photoAlbumUrl} target="_blank" rel="noopener noreferrer">
                  <span>Open Album</span>
                  <ExternalLink className="size-3" />
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Event Recap & Community Notes ─────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <CardTitle className="text-base sm:text-lg">Event Recap & Organizer Notes</CardTitle>
          </div>
          <CardDescription>
            Write a message to attendees summarizing the event highlights, key takeaways, gratitude to sponsors &
            volunteers, or details for future meetups.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Field>
            <FieldLabel>Recap & Notes (Rich HTML Editor)</FieldLabel>
            <HtmlEditText
              value={recapDescription}
              onChange={(val) => setRecapDescription(val)}
              placeholder="Summary of sessions, key takeaways, thank you notes, or community announcements..."
              minHeight="min-h-[140px]"
            />
          </Field>
        </CardContent>
      </Card>

      {/* ── 4. Speaker Presentation Slides & Resources ───────────────── */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Presentation className="size-4 text-primary" />
              <CardTitle className="text-base sm:text-lg">Speaker Presentation Slides & Resources</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Bind presentation slide decks and resource links to Bevy agenda items and speakers. These are displayed in
              the Agenda and Highlights tabs without creating separate registration tracks.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isAgendaLoading ? (
              <Skeleton className="h-8 w-44 rounded-md" />
            ) : (
              agendaActivities.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <Plus className="size-3.5 text-primary" />
                      <span>Attach Presentation Slides</span>
                      <ChevronDown className="size-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 max-h-80 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">Select from Bevy Agenda</DropdownMenuLabel>
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
                              <span className="text-muted-foreground italic text-[10px]">No speaker in agenda</span>
                            )}
                            {added && matchingSlide?.speaker_name && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ Bound</span>
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
              )
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
          ) : agendaActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 border-dashed bg-muted/20 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                <Info className="size-6 opacity-60 text-primary" />
              </div>
              <p className="mt-3 font-semibold text-foreground text-sm">No Bevy Agenda Items Found</p>
              <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                To attach presentation slides, ensure the agenda and speakers are configured in the Bevy Chapter event
                schedule. Slides bind directly to Bevy agenda activities.
              </p>
            </div>
          ) : slides.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 border-dashed bg-muted/20 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                <Presentation className="size-6 opacity-60" />
              </div>
              <p className="mt-3 font-semibold text-foreground text-sm">No presentation slides attached yet</p>
              <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                Select from your {agendaActivities.length} Bevy agenda activities to attach speaker presentation slides
                or codelab resource links.
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
                              <span className="text-muted-foreground italic text-[10px]">No speaker in agenda</span>
                            )}
                            {added && matchingSlide?.speaker_name && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ Bound</span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
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
        savingLabel="Saving Media..."
        savedLabel="All Changes Saved"
        helperText="Updates will immediately reflect on the public event page."
      />
    </div>
  );
}
