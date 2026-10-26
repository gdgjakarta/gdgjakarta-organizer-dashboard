"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Camera, ExternalLink, Play, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { parsePhotoAlbum, parseVideoUrl } from "@/lib/events/media-utils";
import { updateEventHighlightsMediaAction } from "@/lib/firestore/actions";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { HtmlEditText } from "./html-edit-text";

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

          setHighlightVideoUrl(videoUrl);
          setHighlightVideoTitle(videoTitle);
          setPhotoAlbumUrl(albumUrl);
          setPhotoAlbumTitle(albumTitle);
          setRecapDescription(recap);

          initialSnapshotRef.current = JSON.stringify({
            highlightVideoUrl: videoUrl,
            highlightVideoTitle: videoTitle,
            photoAlbumUrl: albumUrl,
            photoAlbumTitle: albumTitle,
            recapDescription: recap,
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
  ]);

  // Dirty state calculation
  const currentSnapshot = JSON.stringify({
    highlightVideoUrl,
    highlightVideoTitle,
    photoAlbumUrl,
    photoAlbumTitle,
    recapDescription,
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
        };
        setHighlightVideoUrl(snap.highlightVideoUrl);
        setHighlightVideoTitle(snap.highlightVideoTitle);
        setPhotoAlbumUrl(snap.photoAlbumUrl);
        setPhotoAlbumTitle(snap.photoAlbumTitle);
        setRecapDescription(snap.recapDescription);
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
          },
          event,
        );

        if (res.success) {
          initialSnapshotRef.current = currentSnapshot;
          toast.success("Event highlights, photo album, and recap saved successfully!");
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
                Embed official highlight videos, link Google Photos albums, and publish community recap notes for
                attendees.
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
              {parsedVideo?.embedUrl ? (
                <span className="text-emerald-600 dark:text-emerald-400">Ready to play</span>
              ) : (
                <span className="italic">Paste a valid URL above to preview</span>
              )}
            </div>

            {parsedVideo?.embedUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/80 bg-black shadow-inner">
                <iframe
                  src={parsedVideo.embedUrl}
                  title={highlightVideoTitle || "Event Highlight Video"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="size-full border-0"
                />
              </div>
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-border/60 border-dashed bg-muted/20 p-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                  <Play className="size-6 opacity-40" />
                </div>
                <p className="mt-3 font-medium text-muted-foreground text-xs">No video URL entered yet</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                  YouTube and Vimeo embed previews will display here interactively once entered.
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
            Provide a shared album link (Google Photos, Google Drive Folder, Flickr, or OneDrive). Attendees will be
            able to browse photos directly from the public event page.
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
