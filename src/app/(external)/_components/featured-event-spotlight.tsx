"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { Calendar, ChevronRight, ExternalLink, MapPin, Pause, Play, Sparkles, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFeaturedEventContent } from "@/lib/content/hooks";
import { parseVideoUrl } from "@/lib/events/media-utils";

export function FeaturedEventSpotlight() {
  const { content } = useFeaturedEventContent();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  // Parse video source URL
  const videoInfo = parseVideoUrl(content.videoUrl);

  // Sync muted and autoplay properties on HTML5 video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (content.autoplay) {
        videoRef.current.play().catch(() => {
          // Browser prevented autoplay without user interaction
          setIsPlaying(false);
        });
      }
    }
  }, [isMuted, content.autoplay]);

  const toggleSound = () => {
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    } else {
      setIsMuted((prev) => !prev);
    }
  };

  const togglePlayback = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  // If feature is disabled, don't render
  if (!content.enabled) {
    return null;
  }

  // Determine embed URL for YouTube/Vimeo with autoplay and mute parameters
  let embedUrl = "";
  if (videoInfo?.type === "youtube" && videoInfo.videoId) {
    const muteParam = isMuted ? "1" : "0";
    const playParam = isPlaying ? "1" : "0";
    embedUrl = `https://www.youtube-nocookie.com/embed/${videoInfo.videoId}?autoplay=${playParam}&mute=${muteParam}&loop=1&playlist=${videoInfo.videoId}&playsinline=1&controls=0&rel=0`;
  } else if (videoInfo?.type === "vimeo" && videoInfo.videoId) {
    const muteParam = isMuted ? "1" : "0";
    const playParam = isPlaying ? "1" : "0";
    embedUrl = `https://player.vimeo.com/video/${videoInfo.videoId}?autoplay=${playParam}&muted=${muteParam}&loop=1&playsinline=1&controls=0`;
  }

  const isDirectVideo = !embedUrl && Boolean(content.videoUrl);

  const renderVideoMedia = () => {
    if (isDirectVideo) {
      return (
        <video
          ref={videoRef}
          src={content.videoUrl}
          poster={content.videoPosterUrl || undefined}
          autoPlay={content.autoplay}
          muted={isMuted}
          loop={content.loop}
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-cover"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      );
    }

    if (embedUrl) {
      return (
        <iframe
          src={embedUrl}
          title={content.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="pointer-events-none absolute inset-0 size-full border-0"
        />
      );
    }

    return (
      <div className="flex size-full items-center justify-center p-8 text-center text-muted-foreground">
        <p className="text-sm">No featured video source configured.</p>
      </div>
    );
  };

  return (
    <section className="container mx-auto px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Outer Spotlight Shell */}
      <div
        className="relative overflow-hidden rounded-[2.5rem] border bg-card shadow-xl transition-all duration-500"
        style={{
          borderColor: "var(--theme-border)",
          boxShadow: "var(--theme-shadow)",
        }}
      >
        {/* Ambient background glow */}
        <div
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full opacity-20 blur-3xl"
          style={{
            background: "radial-gradient(circle, var(--theme-primary) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="grid items-stretch gap-0 lg:grid-cols-12">
          {/* Left/Main Column: Event Editorial Copy & CTAs */}
          <div className="flex flex-col justify-between p-6 sm:p-10 lg:col-span-7 lg:p-12 xl:p-14">
            <div>
              {/* Header Badges */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 font-semibold text-xs transition-colors"
                  style={{
                    borderColor: "var(--theme-border)",
                    backgroundColor: "var(--theme-bg-subtle)",
                    color: "var(--theme-text)",
                  }}
                >
                  <Sparkles className="size-3.5" style={{ color: "var(--theme-primary)" }} />
                  <span>{content.badge || "Featured Gathering"}</span>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 font-medium text-red-500 text-xs">
                  <span className="size-2 animate-pulse rounded-full bg-red-500" />
                  Live Spotlight
                </span>
              </div>

              {/* Event Title */}
              <h2 className="mt-4 font-medium text-[30px] leading-[1.1] tracking-tight sm:text-[42px] lg:text-[48px]">
                {content.title}
              </h2>

              {/* Quick Details Badges */}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-muted-foreground text-xs sm:text-sm">
                {content.dateString && (
                  <div className="flex items-center gap-1.5 font-medium">
                    <Calendar className="size-4" style={{ color: "var(--theme-primary)" }} />
                    <span>{content.dateString}</span>
                  </div>
                )}
                {content.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-4" style={{ color: "var(--theme-primary)" }} />
                    <span className="line-clamp-1">{content.location}</span>
                  </div>
                )}
              </div>

              {/* Event Pitch / Summary */}
              <p className="mt-5 text-[15px] text-muted-foreground leading-relaxed">{content.description}</p>
            </div>

            {/* CTAs Bar */}
            <div
              className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6"
              style={{ borderColor: "var(--theme-border)" }}
            >
              {content.ctaText && content.ctaUrl && (
                <Button
                  asChild
                  size="lg"
                  className="rounded-full px-7 font-medium text-[14px] transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    backgroundColor: "var(--theme-primary)",
                    color: "var(--theme-primary-foreground)",
                  }}
                >
                  <Link href={content.ctaUrl} className="flex items-center gap-2">
                    <span>{content.ctaText}</span>
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
              )}

              {content.secondaryCtaText && content.secondaryCtaUrl && (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-full border-[var(--theme-border)] px-6 font-medium text-[14px] transition-all duration-300 hover:border-[var(--theme-primary)] hover:text-[var(--theme-text)]"
                >
                  <Link href={content.secondaryCtaUrl} className="flex items-center gap-1.5">
                    <span>{content.secondaryCtaText}</span>
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Right Column: Featured Video Showcase */}
          <div className="relative min-h-[300px] overflow-hidden bg-black/90 sm:min-h-[380px] lg:col-span-5 lg:min-h-[440px]">
            {renderVideoMedia()}

            {/* Video Gradient Vignette */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* Floating Media Controls */}
            {content.showControls !== false && (isDirectVideo || embedUrl) && (
              <div className="absolute right-4 bottom-4 z-20 flex items-center gap-2">
                {/* Play / Pause Toggle */}
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-md transition-all hover:scale-105 hover:bg-background"
                  aria-label={isPlaying ? "Pause Video" : "Play Video"}
                  title={isPlaying ? "Pause Video" : "Play Video"}
                >
                  {isPlaying ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
                </button>

                {/* Sound Mute / Unmute Toggle */}
                <button
                  type="button"
                  onClick={toggleSound}
                  className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-2 font-medium text-foreground text-xs shadow-md backdrop-blur-md transition-all hover:scale-105 hover:bg-background"
                  aria-label={isMuted ? "Unmute Audio" : "Mute Audio"}
                  title={isMuted ? "Unmute Audio" : "Mute Audio"}
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="size-4 text-red-500" />
                      <span className="hidden sm:inline">Unmute</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="size-4 text-emerald-500" />
                      <span className="hidden sm:inline">Sound On</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
