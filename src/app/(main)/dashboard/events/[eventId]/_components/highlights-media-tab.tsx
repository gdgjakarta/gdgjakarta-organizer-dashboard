"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { Camera, ExternalLink, Play, Plus, Presentation, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { parsePhotoAlbum, parseVideoUrl } from "@/lib/events/media-utils";
import { updateEventHighlightsMediaAction } from "@/lib/firestore/actions";
import type { EventSession, FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { HtmlEditText } from "./html-edit-text";
import { SortableSlideDeckCard } from "./sortable-slide-deck-card";

function normalizeSessions(rawSessions?: EventSession[]): EventSession[] {
  if (!rawSessions || !Array.isArray(rawSessions)) return [];
  return rawSessions.map((s, idx) => ({
    ...s,
    id: s.id?.trim() ? s.id : `session-${idx}-${Date.now()}`,
  }));
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
  const [sessions, setSessions] = useState<EventSession[]>(() => normalizeSessions(event.sessions));

  const [isSaving, setIsSaving] = useState(false);
  const initialSnapshotRef = useRef<string | null>(null);

  // Determine if event is completed / past
  const isEventPast =
    event.status === "Completed" || (event.end_date ? new Date(event.end_date).getTime() < Date.now() : false);

  // Load latest Firestore data on mount
  useEffect(() => {
    async function loadLatestData() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData) {
          const videoUrl = docData.highlight_video_url ?? event.highlight_video_url ?? "";
          const videoTitle = docData.highlight_video_title ?? event.highlight_video_title ?? "";
          const albumUrl = docData.photo_album_url ?? event.photo_album_url ?? "";
          const albumTitle = docData.photo_album_title ?? event.photo_album_title ?? "";
          const recap = docData.recap_description ?? event.recap_description ?? "";
          const sessList = normalizeSessions(docData.sessions ?? event.sessions ?? []);

          setHighlightVideoUrl(videoUrl);
          setHighlightVideoTitle(videoTitle);
          setPhotoAlbumUrl(albumUrl);
          setPhotoAlbumTitle(albumTitle);
          setRecapDescription(recap);
          setSessions(sessList);

          initialSnapshotRef.current = JSON.stringify({
            highlightVideoUrl: videoUrl,
            highlightVideoTitle: videoTitle,
            photoAlbumUrl: albumUrl,
            photoAlbumTitle: albumTitle,
            recapDescription: recap,
            sessions: sessList,
          });
        }
      } catch (err) {
        console.warn("[HighlightsMediaTab] Failed to fetch latest event data:", err);
      }
    }

    initialSnapshotRef.current = JSON.stringify({
      highlightVideoUrl: event.highlight_video_url ?? "",
      highlightVideoTitle: event.highlight_video_title ?? "",
      photoAlbumUrl: event.photo_album_url ?? "",
      photoAlbumTitle: event.photo_album_title ?? "",
      recapDescription: event.recap_description ?? "",
      sessions: normalizeSessions(event.sessions),
    });

    void loadLatestData();
  }, [
    event.id,
    event.highlight_video_url,
    event.highlight_video_title,
    event.photo_album_url,
    event.photo_album_title,
    event.recap_description,
    event.sessions,
  ]);

  // Dirty state calculation
  const currentSnapshot = JSON.stringify({
    highlightVideoUrl,
    highlightVideoTitle,
    photoAlbumUrl,
    photoAlbumTitle,
    recapDescription,
    sessions,
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
          sessions: EventSession[];
        };
        setHighlightVideoUrl(snap.highlightVideoUrl);
        setHighlightVideoTitle(snap.highlightVideoTitle);
        setPhotoAlbumUrl(snap.photoAlbumUrl);
        setPhotoAlbumTitle(snap.photoAlbumTitle);
        setRecapDescription(snap.recapDescription);
        setSessions(snap.sessions);
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
        const res = await updateEventHighlightsMediaAction(String(event.id), {
          highlight_video_url: highlightVideoUrl,
          highlight_video_title: highlightVideoTitle,
          photo_album_url: photoAlbumUrl,
          photo_album_title: photoAlbumTitle,
          recap_description: recapDescription,
          sessions,
        });

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

  // Helper to update a session's slide fields
  const handleUpdateSessionSlide = (sessionId: string, updates: Partial<EventSession>) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...updates } : s)));
  };

  // Helper to add a related link to a session
  const handleAddSessionRelatedLink = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const currentLinks = s.related_links ?? [];
        return {
          ...s,
          related_links: [...currentLinks, { title: "", url: "" }],
        };
      }),
    );
  };

  // Helper to update a related link in a session
  const handleUpdateSessionRelatedLink = (
    sessionId: string,
    linkIndex: number,
    field: "title" | "url",
    val: string,
  ) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
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

  // Helper to remove a related link from a session
  const handleRemoveSessionRelatedLink = (sessionId: string, linkIndex: number) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const currentLinks = (s.related_links ?? []).filter((_, idx) => idx !== linkIndex);
        return {
          ...s,
          related_links: currentLinks,
        };
      }),
    );
  };

  // Helper to add a new generic session for slides if none exist
  const handleAddNewSession = () => {
    const newSession: EventSession = {
      id: `session-${Date.now()}`,
      title: "Keynote / Main Presentation",
      speaker_name: "",
      slides_url: "",
      slides_title: "Download Slides",
      capacity: 0,
      related_links: [],
    };
    setSessions((prev) => [...prev, newSession]);
    toast.success("Added presentation session deck.");
  };

  const handleRemoveSession = (sessionId: string) => {
    const targetSession = sessions.find((s) => s.id === sessionId);
    setSessions((prev) => prev.filter((item) => item.id !== sessionId));
    toast.info(`Removed session "${targetSession?.title || "Slide Deck"}".`);
  };

  const handleMoveSessionUp = (index: number) => {
    if (index <= 0) return;
    setSessions((prev) => {
      const next = [...prev];
      const item = next[index];
      const prevItem = next[index - 1];
      if (!item || !prevItem) return prev;
      next[index - 1] = item;
      next[index] = prevItem;
      return next;
    });
  };

  const handleMoveSessionDown = (index: number) => {
    if (index >= sessions.length - 1) return;
    setSessions((prev) => {
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
    setSessions((prev) => {
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
                Embed official highlight videos, link Google Photos / Drive albums, and publish speaker presentation
                slides for attendees and the public community.
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
              <div className="overflow-hidden rounded-xl border border-border/80 bg-black shadow-xs">
                <div className="relative aspect-video w-full">
                  {parsedVideo.type === "youtube" || parsedVideo.type === "vimeo" ? (
                    <iframe
                      src={parsedVideo.embedUrl}
                      title={highlightVideoTitle || "Video Preview"}
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
              </div>
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-border/60 border-dashed bg-muted/20 p-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                  <Play className="size-6 opacity-60" />
                </div>
                <p className="mt-3 font-medium text-muted-foreground text-xs">
                  No video URL entered yet. Paste a link above to preview the player here.
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
            <CardTitle className="text-base sm:text-lg">Event Photo Album (Google Photos / Google Drive)</CardTitle>
          </div>
          <CardDescription>
            Share an official photo album link with attendees. On the public page, attendees will see a highlighted
            showcase card with 1-click access to view and download photos.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="photo-album-url">Photo Album Link (Google Photos / Google Drive)</FieldLabel>
              <Input
                id="photo-album-url"
                placeholder="https://photos.app.goo.gl/... or https://drive.google.com/drive/folders/..."
                value={photoAlbumUrl}
                onChange={(e) => setPhotoAlbumUrl(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5">
                <p className="text-[11px] text-muted-foreground">
                  Paste a public Google Photos shared album or Google Drive folder URL.
                </p>
                {photoAlbumUrl && parsedAlbum && (
                  <Badge
                    variant="outline"
                    className="border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400"
                  >
                    ✓ Detected {parsedAlbum.label} Link
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
              Add presentation slide decks (Google Slides, SpeakerDeck, Canva, PDF) and related links for each session.
              Attendees can view or download them directly from the Agenda and Highlights tabs.
            </CardDescription>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleAddNewSession}
            className="gap-1.5 self-start text-xs sm:self-auto"
          >
            <Plus className="size-3.5 text-primary" />
            Add Slide Deck Session
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 border-dashed bg-muted/20 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                <Presentation className="size-6 opacity-60" />
              </div>
              <p className="mt-3 font-semibold text-foreground text-sm">No session presentation decks yet</p>
              <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                Click &ldquo;Add Slide Deck Session&rdquo; above to attach speaker presentation slides or codelab
                resources.
              </p>
              <Button size="sm" onClick={handleAddNewSession} className="mt-4 gap-1.5 text-xs">
                <Plus className="size-3.5" />
                Add Presentation Slide Deck
              </Button>
            </div>
          ) : (
            <DragDropProvider onDragEnd={handleDragEnd}>
              <div className="space-y-4">
                {sessions.map((sess, sIdx) => (
                  <SortableSlideDeckCard
                    key={sess.id}
                    session={sess}
                    index={sIdx}
                    totalSessions={sessions.length}
                    onUpdate={handleUpdateSessionSlide}
                    onRemove={handleRemoveSession}
                    onMoveUp={handleMoveSessionUp}
                    onMoveDown={handleMoveSessionDown}
                    onAddRelatedLink={handleAddSessionRelatedLink}
                    onUpdateRelatedLink={handleUpdateSessionRelatedLink}
                    onRemoveRelatedLink={handleRemoveSessionRelatedLink}
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
