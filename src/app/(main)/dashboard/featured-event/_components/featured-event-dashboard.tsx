"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import {
  Calendar,
  CheckCircle2,
  Eye,
  Film,
  HardDrive,
  Link2,
  Loader2,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  UploadCloud,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useFeaturedEventContent } from "@/lib/content/hooks";
import { parseVideoUrl } from "@/lib/events/media-utils";
import { sanitizeStorageName } from "@/lib/r2/utils";
import { cn } from "@/lib/utils";

import { fetchFeaturedEventBevyListAction, type PublishedEventOption } from "../_actions/fetch-bevy-events";
import { BevyEventSelector } from "./bevy-event-selector";

interface FeaturedEventDashboardProps {
  initialEvents?: PublishedEventOption[];
}

export function FeaturedEventDashboard({ initialEvents = [] }: FeaturedEventDashboardProps) {
  const { content, setContent, hasChanges, discardChanges, saving, saveContent, resetToDefaults } =
    useFeaturedEventContent();

  const {
    showPrompt: showUnsavedPrompt,
    setShowPrompt: setShowUnsavedPrompt,
    isSaving: isSavingAndLeaving,
    cancelNavigation,
    confirmDiscardAndLeave,
    confirmSaveAndLeave,
  } = useUnsavedChanges({
    hasChanges,
    onSave: async () => saveContent(content),
    onDiscard: discardChanges,
  });

  // State for available events from Bevy API
  const [availableEvents, setAvailableEvents] = useState<PublishedEventOption[]>(initialEvents);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview interactive state
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [previewPlaying, setPreviewPlaying] = useState(true);

  // If initialEvents was empty, fetch Bevy events on mount
  useEffect(() => {
    if (availableEvents.length > 0) return;
    async function loadEvents() {
      setIsLoadingEvents(true);
      try {
        const res = await fetchFeaturedEventBevyListAction();
        if (res.success && res.events) {
          setAvailableEvents(res.events);
        }
      } catch (err) {
        console.warn("[FeaturedEventDashboard] Could not fetch Bevy events list:", err);
      } finally {
        setIsLoadingEvents(false);
      }
    }
    void loadEvents();
  }, [availableEvents.length]);

  // Handle manual sync from Bevy API
  const handleRefreshBevyEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const res = await fetchFeaturedEventBevyListAction();
      if (res.success && res.events) {
        setAvailableEvents(res.events);
        toast.success("Bevy events updated", {
          description: `Loaded ${res.events.length} events from Bevy API.`,
        });
      } else {
        toast.error("Failed to load Bevy events", {
          description: res.error ?? "Please check your network or try again.",
        });
      }
    } catch (err) {
      console.error("[FeaturedEventDashboard] Error refreshing Bevy events:", err);
      toast.error("Error fetching Bevy events");
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Handle auto-populating fields from selected Bevy event
  const handleSelectEvent = (selected: PublishedEventOption | null) => {
    if (!selected) {
      setContent({ ...content, eventId: undefined });
      toast.info("Cleared linked Bevy event", {
        description: "Switched to custom featured event details.",
      });
      return;
    }

    const dateFormatted = selected.formattedTime
      ? `${selected.formattedDate} • ${selected.formattedTime}`
      : selected.formattedDate;

    const locationStr =
      selected.venueName ?? selected.venueAddress ?? (selected.isVirtual ? "Virtual / Online" : "Jakarta, Indonesia");

    const poster = selected.bannerUrl ?? selected.thumbnailUrl ?? "";

    setContent({
      ...content,
      eventId: selected.id,
      title: selected.title ? selected.title : content.title,
      description: selected.descriptionShort ? selected.descriptionShort : content.description,
      dateString: dateFormatted ? dateFormatted : content.dateString,
      location: locationStr ? locationStr : content.location,
      ctaUrl: `/events/${selected.id}`,
      secondaryCtaUrl: selected.url ? selected.url : `/events/${selected.id}`,
      videoPosterUrl: poster ? poster : content.videoPosterUrl,
    });

    toast.info("Bevy event synchronized", {
      description: `Imported title, date, venue, and links from "${selected.title}".`,
    });
  };

  // Upload video directly to Cloudflare R2 bucket via /api/media/upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate video MIME or extension
    const validVideoExts = ["mp4", "webm", "mov", "m4v"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!file.type.startsWith("video/") && !validVideoExts.includes(ext)) {
      toast.error("Format file tidak didukung", {
        description: "Harap unggah file video dengan format .mp4, .webm, atau .mov.",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);

    try {
      const sanitizedName = sanitizeStorageName(file.name, false);
      const formData = new FormData();
      formData.append("prefix", "featured-videos");
      formData.append("file", file, sanitizedName);

      setUploadProgress(45);

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(85);

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error ?? `Upload failed with HTTP status ${res.status}`);
      }

      const data = (await res.json()) as {
        success: boolean;
        items?: Array<{ url: string; key: string; name: string }>;
      };

      const uploadedItem = data.items?.[0];
      if (!uploadedItem) {
        throw new Error("No media item returned by R2 upload service.");
      }

      setUploadProgress(100);

      setContent({
        ...content,
        videoSourceType: "upload",
        videoUrl: uploadedItem.url,
        videoStorageKey: uploadedItem.key,
      });

      toast.success("Video berhasil diunggah ke Cloudflare R2!", {
        description: `Disimpan di bucket dengan nama: ${uploadedItem.name}`,
      });
    } catch (err) {
      console.error("[FeaturedEventDashboard] Video upload error:", err);
      toast.error("Gagal mengunggah video ke R2", {
        description: err instanceof Error ? err.message : "Periksa koneksi Anda dan coba lagi.",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Parse video source for live preview
  const videoInfo = parseVideoUrl(content.videoUrl);
  let previewEmbedUrl = "";
  if (videoInfo?.type === "youtube" && videoInfo.videoId) {
    const muteParam = previewMuted ? "1" : "0";
    const playParam = previewPlaying ? "1" : "0";
    previewEmbedUrl = `https://www.youtube-nocookie.com/embed/${videoInfo.videoId}?autoplay=${playParam}&mute=${muteParam}&loop=1&playlist=${videoInfo.videoId}&playsinline=1&controls=0&rel=0`;
  } else if (videoInfo?.type === "vimeo" && videoInfo.videoId) {
    const muteParam = previewMuted ? "1" : "0";
    const playParam = previewPlaying ? "1" : "0";
    previewEmbedUrl = `https://player.vimeo.com/video/${videoInfo.videoId}?autoplay=${playParam}&muted=${muteParam}&loop=1&playsinline=1&controls=0`;
  }
  const isDirectVideo = !previewEmbedUrl && Boolean(content.videoUrl);

  return (
    <div className="space-y-8 pb-28">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">Homepage Featured Event</h1>
            <Badge variant="outline" className="gap-1 border-primary/30 text-primary text-xs">
              <Sparkles className="size-3" />
              Public Spotlight
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground text-sm">
            Configure the flagship event banner with autoplay video displayed prominently on the GDG Jakarta public
            homepage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-full">
            <Link href="/" target="_blank">
              <Eye className="size-4" />
              <span>View Public Page</span>
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefaults}
            className="gap-1.5 rounded-full text-muted-foreground hover:text-foreground"
            title="Reset to default content"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Form Controls (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Card 1: Feature Activation & Event Sync */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Visibility & Event Selection</CardTitle>
              <CardDescription>
                Enable the spotlight on the homepage and optionally auto-fill metadata from an existing event.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Enable / Disable Switch */}
              <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="featured-enabled" className="font-medium text-sm">
                    Display Featured Event on Homepage
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    When enabled, the marquee spotlight section renders on the public home page.
                  </p>
                </div>
                <Switch
                  id="featured-enabled"
                  checked={content.enabled}
                  onCheckedChange={(checked) => setContent({ ...content, enabled: checked })}
                />
              </div>

              {/* Bevy Event Picker Combobox */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium text-sm">Link with Bevy Event (Optional)</Label>
                  <button
                    type="button"
                    onClick={() => void handleRefreshBevyEvents()}
                    disabled={isLoadingEvents}
                    className="inline-flex items-center gap-1.5 font-medium text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    title="Refresh official GDG chapter events from Bevy API"
                  >
                    <RefreshCw className={cn("size-3", isLoadingEvents && "animate-spin")} />
                    <span>Sync Bevy</span>
                  </button>
                </div>
                <BevyEventSelector
                  events={availableEvents}
                  selectedEventId={content.eventId}
                  onSelectEvent={handleSelectEvent}
                  isLoading={isLoadingEvents}
                />
                <p className="text-muted-foreground text-xs">
                  Selecting an event will auto-fill the title, date, venue, description, and link directly from Bevy.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Featured Video Configuration & R2 Storage */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Film className="size-5 text-primary" />
                    <span>Featured Video Source</span>
                  </CardTitle>
                  <CardDescription>
                    Provide an external video link or upload a video file to your Cloudflare R2 bucket (`MEDIA_BUCKET`).
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <Tabs
                value={content.videoSourceType || "upload"}
                onValueChange={(val) => setContent({ ...content, videoSourceType: val as "url" | "upload" })}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload" className="gap-2">
                    <UploadCloud className="size-4" />
                    <span>Upload to Cloudflare R2</span>
                  </TabsTrigger>
                  <TabsTrigger value="url" className="gap-2">
                    <Link2 className="size-4" />
                    <span>External Video Link</span>
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Upload to R2 Bucket */}
                <TabsContent value="upload" className="space-y-4 pt-4">
                  <button
                    type="button"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                      isDragOver
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20",
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          void handleFileUpload(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />

                    {isUploading ? (
                      <div className="w-full max-w-xs space-y-3 py-4 text-center">
                        <Loader2 className="mx-auto size-8 animate-spin text-primary" />
                        <p className="font-medium text-sm">Mengunggah ke Cloudflare R2...</p>
                        <Progress value={uploadProgress} className="h-2 w-full" />
                      </div>
                    ) : (
                      <>
                        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <HardDrive className="size-6" />
                        </div>
                        <p className="mt-3 font-medium text-sm">
                          Klik untuk memilih file atau drag & drop video ke sini
                        </p>
                        <p className="mt-1 text-muted-foreground text-xs">
                          Mendukung .mp4, .webm, dan .mov (disimpan otomatis di R2 Bucket gdgjakarta-assets)
                        </p>
                      </>
                    )}
                  </button>

                  {/* Active Uploaded R2 Video Badge */}
                  {content.videoSourceType === "upload" && content.videoUrl && (
                    <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                        <div className="overflow-hidden">
                          <p className="truncate font-medium text-xs">{content.videoStorageKey || content.videoUrl}</p>
                          <p className="text-[11px] text-muted-foreground">Stored in Cloudflare R2</p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContent({ ...content, videoUrl: "", videoStorageKey: undefined });
                        }}
                        title="Remove video"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: External Video URL */}
                <TabsContent value="url" className="space-y-3 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="video-url" className="font-medium text-xs">
                      Video URL (YouTube, Vimeo, or direct MP4/WebM)
                    </Label>
                    <Input
                      id="video-url"
                      placeholder="https://www.youtube.com/watch?v=... or https://cdn.example.com/video.mp4"
                      value={content.videoUrl}
                      onChange={(e) => setContent({ ...content, videoUrl: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Paste a public video link. Direct HTML5 video files or YouTube/Vimeo links will autoplay muted.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Poster thumbnail (Optional) */}
              <div className="space-y-1.5 border-t pt-2">
                <Label htmlFor="video-poster" className="font-medium text-xs">
                  Video Poster / Fallback Image URL (Optional)
                </Label>
                <Input
                  id="video-poster"
                  placeholder="https://..."
                  value={content.videoPosterUrl || ""}
                  onChange={(e) => setContent({ ...content, videoPosterUrl: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Displayed as a thumbnail image while the video stream is buffering.
                </p>
              </div>

              {/* Autoplay & Playback Toggles */}
              <div className="space-y-3 border-t pt-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="toggle-autoplay" className="font-medium text-xs">
                      Autoplay Video
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Starts video automatically as soon as the public page loads.
                    </p>
                  </div>
                  <Switch
                    id="toggle-autoplay"
                    checked={content.autoplay}
                    onCheckedChange={(c) => setContent({ ...content, autoplay: c })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="toggle-muted" className="font-medium text-xs">
                      Muted by Default
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Required by modern browsers for autoplay. Users can unmute anytime.
                    </p>
                  </div>
                  <Switch
                    id="toggle-muted"
                    checked={content.muted}
                    onCheckedChange={(c) => setContent({ ...content, muted: c })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="toggle-loop" className="font-medium text-xs">
                      Loop Continuously
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Replays video automatically when it reaches the end.
                    </p>
                  </div>
                  <Switch
                    id="toggle-loop"
                    checked={content.loop}
                    onCheckedChange={(c) => setContent({ ...content, loop: c })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="toggle-controls" className="font-medium text-xs">
                      Show Floating Controls (Sound & Pause)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Displays interactive 1-click sound unmute and pause buttons over the video.
                    </p>
                  </div>
                  <Switch
                    id="toggle-controls"
                    checked={content.showControls !== false}
                    onCheckedChange={(c) => setContent({ ...content, showControls: c })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Event Content & CTAs */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Event Content & Action Links</CardTitle>
              <CardDescription>
                Customize headings, dates, venue information, and call-to-action buttons.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="event-badge" className="font-medium text-xs">
                    Badge Label
                  </Label>
                  <Input
                    id="event-badge"
                    value={content.badge}
                    onChange={(e) => setContent({ ...content, badge: e.target.value })}
                    placeholder="e.g. Flagship Gathering"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="event-date" className="font-medium text-xs">
                    Date & Time Display
                  </Label>
                  <Input
                    id="event-date"
                    value={content.dateString || ""}
                    onChange={(e) => setContent({ ...content, dateString: e.target.value })}
                    placeholder="e.g. Saturday, Nov 14, 2026 • 09:00 WIB"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-title" className="font-medium text-xs">
                  Event Title
                </Label>
                <Input
                  id="event-title"
                  value={content.title}
                  onChange={(e) => setContent({ ...content, title: e.target.value })}
                  placeholder="e.g. DevFest Jakarta 2026"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-location" className="font-medium text-xs">
                  Venue / Location
                </Label>
                <Input
                  id="event-location"
                  value={content.location || ""}
                  onChange={(e) => setContent({ ...content, location: e.target.value })}
                  placeholder="e.g. Auditorium Google Indonesia, Jakarta"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-desc" className="font-medium text-xs">
                  Description / Pitch
                </Label>
                <Textarea
                  id="event-desc"
                  rows={3}
                  value={content.description}
                  onChange={(e) => setContent({ ...content, description: e.target.value })}
                  placeholder="Describe why developers should attend this event..."
                />
              </div>

              <div className="grid gap-4 border-t pt-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cta-text" className="font-medium text-xs">
                    Primary Button Text
                  </Label>
                  <Input
                    id="cta-text"
                    value={content.ctaText}
                    onChange={(e) => setContent({ ...content, ctaText: e.target.value })}
                    placeholder="e.g. RSVP & Get Tickets"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cta-url" className="font-medium text-xs">
                    Primary Button URL
                  </Label>
                  <Input
                    id="cta-url"
                    value={content.ctaUrl}
                    onChange={(e) => setContent({ ...content, ctaUrl: e.target.value })}
                    placeholder="e.g. /events or registration URL"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sec-cta-text" className="font-medium text-xs">
                    Secondary Button Text (Optional)
                  </Label>
                  <Input
                    id="sec-cta-text"
                    value={content.secondaryCtaText || ""}
                    onChange={(e) => setContent({ ...content, secondaryCtaText: e.target.value })}
                    placeholder="e.g. View Event Details"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sec-cta-url" className="font-medium text-xs">
                    Secondary Button URL (Optional)
                  </Label>
                  <Input
                    id="sec-cta-url"
                    value={content.secondaryCtaUrl || ""}
                    onChange={(e) => setContent({ ...content, secondaryCtaUrl: e.target.value })}
                    placeholder="e.g. /events/123"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Real-Time Live Preview (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="sticky top-20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 font-semibold text-sm">
                <Eye className="size-4 text-primary" />
                <span>Live Public Preview</span>
              </h2>
              <Badge variant="outline" className="text-[11px]">
                {content.enabled ? "Active on Home Page" : "Hidden (Disabled)"}
              </Badge>
            </div>

            {/* Preview Card Mockup */}
            <div
              className={cn(
                "overflow-hidden rounded-[2rem] border bg-card shadow-lg transition-all",
                !content.enabled && "opacity-60 grayscale",
              )}
            >
              {/* Video Player Preview */}
              <div className="relative aspect-video w-full overflow-hidden bg-black/90">
                {(() => {
                  if (isDirectVideo) {
                    return (
                      <video
                        ref={previewVideoRef}
                        src={content.videoUrl}
                        poster={content.videoPosterUrl || undefined}
                        autoPlay={content.autoplay}
                        muted={previewMuted}
                        loop={content.loop}
                        playsInline
                        className="size-full object-cover"
                        onPlay={() => setPreviewPlaying(true)}
                        onPause={() => setPreviewPlaying(false)}
                      />
                    );
                  }
                  if (previewEmbedUrl) {
                    return (
                      <iframe
                        src={previewEmbedUrl}
                        title="Preview"
                        allow="accelerometer; autoplay; encrypted-media; gyroscope"
                        className="pointer-events-none size-full border-0"
                      />
                    );
                  }
                  return (
                    <div className="flex size-full items-center justify-center p-4 text-center text-muted-foreground text-xs">
                      No video configured
                    </div>
                  );
                })()}

                {/* Floating Preview Controls */}
                {content.showControls !== false && (isDirectVideo || previewEmbedUrl) && (
                  <div className="absolute right-3 bottom-3 z-10 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const previewVideo = previewVideoRef.current;
                        if (previewVideo) {
                          if (previewVideo.paused) {
                            previewVideo.play();
                            setPreviewPlaying(true);
                          } else {
                            previewVideo.pause();
                            setPreviewPlaying(false);
                          }
                        } else {
                          setPreviewPlaying((p) => !p);
                        }
                      }}
                      className="flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-md"
                    >
                      {previewPlaying ? <Pause className="size-3" /> : <Play className="ml-0.5 size-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const previewVideo = previewVideoRef.current;
                        if (previewVideo) {
                          const next = !previewVideo.muted;
                          previewVideo.muted = next;
                          setPreviewMuted(next);
                        } else {
                          setPreviewMuted((m) => !m);
                        }
                      }}
                      className="flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-md"
                    >
                      {previewMuted ? (
                        <VolumeX className="size-3 text-red-500" />
                      ) : (
                        <Volume2 className="size-3 text-emerald-500" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Preview Content */}
              <div className="space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-[11px] text-primary">
                    {content.badge || "Featured"}
                  </span>
                  {content.dateString && (
                    <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <Calendar className="size-3" />
                      {content.dateString}
                    </span>
                  )}
                </div>

                <h3 className="line-clamp-1 font-semibold text-lg">{content.title || "Untitled Event"}</h3>

                {content.location && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="size-3 shrink-0 text-primary" />
                    <span className="truncate">{content.location}</span>
                  </div>
                )}

                <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                  {content.description || "No description provided."}
                </p>

                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" className="h-8 w-full rounded-full text-xs">
                    {content.ctaText || "RSVP"}
                  </Button>
                  {content.secondaryCtaText && (
                    <Button variant="outline" size="sm" className="h-8 w-full rounded-full text-xs">
                      {content.secondaryCtaText}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Save / Discard Bar */}
      <FloatingSaveBar
        isDirty={hasChanges}
        isSaving={saving}
        onSave={() => saveContent(content)}
        onDiscard={discardChanges}
      />

      {/* Unsaved Changes Confirmation Modal */}
      <UnsavedChangesDialog
        open={showUnsavedPrompt}
        onOpenChange={setShowUnsavedPrompt}
        onDiscard={confirmDiscardAndLeave}
        onSave={confirmSaveAndLeave}
        onCancel={cancelNavigation}
        saving={isSavingAndLeaving}
      />
    </div>
  );
}
