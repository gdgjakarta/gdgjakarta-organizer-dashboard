"use client";

import { useEffect, useRef, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArrowRight, Calendar, Code, Heart, Pause, Play, Sparkles, Users, Volume2, VolumeX } from "lucide-react";

import { GoogleButton } from "@/app/(main)/auth/_components/social-auth/google-button";
import { Button } from "@/components/ui/button";
import { getDashboardHomeUrl } from "@/lib/auth-roles";
import { useFeaturedEventContent } from "@/lib/content/hooks";
import { parseVideoUrl } from "@/lib/events/media-utils";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth/auth-provider";

export function CommunityHero() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  // Featured event dynamic configuration
  const { content } = useFeaturedEventContent();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  // Parse video source URL
  const videoInfo = parseVideoUrl(content.videoUrl);

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

  // Sync muted and autoplay properties on HTML5 video element
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = isMuted;
      if (content.autoplay) {
        video.play().catch(() => {
          setIsPlaying(false);
        });
      }
    }
  }, [isMuted, content.autoplay]);

  const toggleSound = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const video = videoRef.current;
    if (video) {
      const nextMuted = !video.muted;
      video.muted = nextMuted;
      setIsMuted(nextMuted);
    } else {
      setIsMuted((prev) => !prev);
    }
  };

  const togglePlayback = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const video = videoRef.current;
    if (video) {
      if (video.paused) {
        video.play();
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  useEffect(() => {
    if (pathname) {
      setIsNavigating(false);
    }
  }, [pathname]);

  const renderDashboardAction = () => {
    if (isLoading) {
      return (
        <div className="relative h-12 w-44 overflow-hidden rounded-full border border-[var(--theme-border)] bg-muted/60">
          <div className="shimmer-wave" aria-hidden="true" />
        </div>
      );
    }

    if (user) {
      return (
        <Button
          asChild
          variant="outline"
          size="lg"
          className="relative h-12 overflow-hidden rounded-full border-[var(--theme-border)] bg-background/80 px-8 font-medium text-[14px] backdrop-blur-xs transition-all duration-300 hover:border-[var(--theme-primary)] hover:bg-background hover:text-[var(--theme-text)]"
        >
          <Link href={getDashboardHomeUrl(user)} onClick={() => setIsNavigating(true)}>
            <span>Go to Dashboard</span>
            {isNavigating && <div className="shimmer-wave" aria-hidden="true" />}
          </Link>
        </Button>
      );
    }

    return (
      <GoogleButton
        size="lg"
        variant="outline"
        className="h-12 w-auto rounded-full border-[var(--theme-border)] bg-background/80 px-8 font-medium text-[14px] backdrop-blur-xs transition-all duration-300 hover:border-[var(--theme-primary)] hover:bg-background hover:text-[var(--theme-text)]"
      >
        Join Community
      </GoogleButton>
    );
  };

  return (
    <section
      className="relative overflow-hidden border-b py-20 transition-colors duration-500 lg:py-28"
      style={{
        backgroundColor: "var(--theme-bg-subtle)",
        borderColor: "var(--theme-border)",
      }}
    >
      {/* Background ambient radial glow */}
      <div
        className="pointer-events-none absolute -top-40 -right-40 size-[600px] rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--theme-primary) 0%, transparent 70%)",
        }}
      />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left Column: Editorial Headline & CTAs */}
          <div
            className={cn(
              "flex flex-col items-start transition-all duration-300",
              content.enabled ? "lg:col-span-7" : "lg:col-span-12 max-w-4xl",
            )}
          >
            {/* Top pill badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-medium text-xs shadow-xs transition-colors"
              style={{
                borderColor: "var(--theme-border)",
                backgroundColor: "var(--background)",
                color: "var(--theme-text)",
              }}
            >
              <Sparkles className="size-3.5" style={{ color: "var(--theme-primary)" }} />
              <span>Official Chapter • GDG Jakarta</span>
            </div>

            {/* Oversized Display Typography */}
            <h1 className="mt-6 text-left font-medium text-[48px] leading-[1.05] tracking-tight sm:text-[68px] lg:text-[96px]">
              Where developer <br />
              <span
                className="transition-colors duration-500"
                style={{
                  color: "var(--theme-text)",
                }}
              >
                communities
              </span>{" "}
              thrive.
            </h1>

            {/* Subtitle */}
            <p className="mt-6 max-w-xl text-left text-muted-foreground text-[14px] leading-relaxed">
              Google Developer Groups (GDG) Jakarta is the premier hub for developers, creators, and engineers in
              Indonesia to learn Google technologies, build groundbreaking software, and connect directly with industry
              experts.
            </p>

            {/* Pill CTA Row */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="group h-12 rounded-full px-8 font-medium text-[14px] shadow-[var(--theme-shadow)] transition-all duration-300 hover:scale-[1.02] hover:bg-[var(--theme-primary-hover)]"
                style={{
                  backgroundColor: "var(--theme-primary)",
                  color: "var(--theme-primary-foreground)",
                }}
              >
                <Link href="/events" className="flex items-center gap-2">
                  <span>Explore Events</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>

              {renderDashboardAction()}
            </div>

            {/* Social Proof Stats Pill */}
            <div className="mt-10 flex flex-wrap items-center gap-6 text-muted-foreground text-[14px]">
              <div className="flex items-center gap-2">
                <Users className="size-4" style={{ color: "var(--theme-primary)" }} />
                <span>
                  <strong className="text-foreground">15.6K+</strong> Members
                </span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Calendar className="size-4" style={{ color: "var(--theme-primary)" }} />
                <span>
                  <strong className="text-foreground">133+</strong> Activities Hosted
                </span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Heart className="size-4" style={{ color: "var(--theme-primary)" }} />
                <span>
                  <strong className="text-foreground">100%</strong> Free & Community Run
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Featured Event Showcase Card (Removed when disabled) */}
          {content.enabled && (
            <div className="relative lg:col-span-5">
              {/* Visual Glass Card */}
              <div
                className="relative overflow-hidden rounded-[2.5rem] border bg-background/90 p-6 shadow-xl backdrop-blur-md transition-all duration-500 sm:p-8"
                style={{
                  borderColor: "var(--theme-border)",
                  boxShadow: "var(--theme-shadow)",
                }}
              >
                {/* Card Header Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex size-9 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: "var(--theme-bg-subtle)",
                        color: "var(--theme-primary)",
                      }}
                    >
                      <Code className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium text-[14px]">GDG Jakarta Community</p>
                      <p className="text-muted-foreground text-xs">Empowering Indonesian Builders</p>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 font-medium text-xs"
                    style={{
                      backgroundColor: "var(--theme-bg-subtle)",
                      color: "var(--theme-primary)",
                    }}
                  >
                    Live Chapter
                  </span>
                </div>

                {/* Graphic / Video Banner */}
                <div
                  className="group relative mt-6 flex min-h-[220px] sm:min-h-[240px] flex-col justify-end overflow-hidden rounded-2xl p-6 text-white transition-all duration-300"
                  style={{
                    background: "linear-gradient(135deg, var(--theme-primary) 0%, #1a1a1a 100%)",
                  }}
                >
                  {/* Background HTML5 Video */}
                  {isDirectVideo && content.videoUrl && (
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
                  )}

                  {/* Background Iframe (YouTube / Vimeo) */}
                  {embedUrl && (
                    <iframe
                      src={embedUrl}
                      title={content.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="pointer-events-none absolute inset-0 size-full border-0 object-cover"
                    />
                  )}

                  {/* Background Poster fallback */}
                  {!isDirectVideo && !embedUrl && content.videoPosterUrl && (
                    <Image
                      src={content.videoPosterUrl}
                      alt={content.title || "Featured Event"}
                      fill
                      sizes="(max-width: 768px) 100vw, 40vw"
                      className="object-cover"
                    />
                  )}

                  {/* Dark gradient overlay for typography readability */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

                  {/* Floating Media Controls (if video source is active) */}
                  {content.showControls !== false && (isDirectVideo || embedUrl) && (
                    <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={togglePlayback}
                        className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-black/80"
                        aria-label={isPlaying ? "Pause video" : "Play video"}
                        title={isPlaying ? "Pause video" : "Play video"}
                      >
                        {isPlaying ? <Pause className="size-3" /> : <Play className="ml-0.5 size-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={toggleSound}
                        className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-black/80"
                        aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                        title={isMuted ? "Unmute audio" : "Mute audio"}
                      >
                        {isMuted ? (
                          <VolumeX className="size-3 text-red-400" />
                        ) : (
                          <Volume2 className="size-3 text-emerald-400" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Text Content Overlay */}
                  <div className="relative z-10">
                    <span className="inline-block w-fit rounded-full bg-white/20 px-3 py-0.5 font-medium text-xs backdrop-blur-sm">
                      {content.badge || "Flagship Gathering"}
                    </span>
                    <h3 className="mt-2 line-clamp-2 font-medium text-[24px] text-white tracking-tight sm:text-[30px]">
                      {content.title || "DevFest Jakarta 2026"}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-white/80 text-[13px] sm:text-[14px]">
                      {content.description ||
                        "The biggest annual technology conference by Google Developer Groups in Jakarta."}
                    </p>
                    {content.dateString && (
                      <div className="mt-2 flex items-center gap-1.5 text-white/90 text-xs">
                        <Calendar className="size-3 shrink-0 text-white/70" />
                        <span className="truncate">{content.dateString}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Topics Pills */}
                <div className="mt-6">
                  <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Technology Pillars
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Gemini & AI", "Google Cloud", "Android & Kotlin", "Next.js & Web", "Flutter", "Firebase"].map(
                      (tag) => (
                        <span
                          key={tag}
                          className="rounded-full border px-3 py-1 font-medium text-xs transition-colors hover:border-[var(--theme-primary)] hover:text-[var(--theme-text)]"
                          style={{
                            borderColor: "var(--theme-border)",
                            backgroundColor: "var(--theme-bg-subtle)",
                          }}
                        >
                          {tag}
                        </span>
                      ),
                    )}
                  </div>
                </div>

                {/* Quick Action */}
                <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--theme-border)" }}>
                  <Link
                    href={content.ctaUrl || "/events"}
                    className="flex items-center justify-between font-medium text-[14px] transition-colors hover:text-[var(--theme-text)]"
                  >
                    <span>{content.ctaText || "Browse all upcoming activities"}</span>
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
