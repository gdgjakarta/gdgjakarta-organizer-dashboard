"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AlertTriangle, Loader2, Maximize2, Minimize2, Pause, Play, RefreshCw, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ProtectedYoutubePlayerProps {
  videoId: string;
  title: string;
  viewerEmail?: string;
  sessionId?: string;
  watermarkEnabled?: boolean;
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (vol: number) => void;
  getVolume: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getPlayerState: () => number;
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        config: {
          host?: string;
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

function loadYoutubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      ytApiPromise = null;
      reject(new Error("Failed to load YouTube Player API. Check your connection or ad-blocker."));
    };
    document.head.appendChild(script);
  });

  return ytApiPromise;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const WATERMARK_POSITIONS = [
  "top-6 left-6",
  "top-6 right-6",
  "bottom-16 left-6",
  "bottom-16 right-6",
  "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
];

export function ProtectedYoutubePlayer({
  videoId,
  title,
  viewerEmail,
  sessionId,
  watermarkEnabled = true,
}: ProtectedYoutubePlayerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wmIndex, setWmIndex] = useState(0);
  const [clockLabel, setClockLabel] = useState("");

  // Initialize YouTube IFrame API player with controls disabled + script.onerror recovery (BUG-4)
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(null);

    void loadYoutubeIframeApi()
      .then(() => {
        if (cancelled || !mountRef.current || !window.YT?.Player) return;

        mountRef.current.innerHTML = "";
        const playerHost = document.createElement("div");
        playerHost.className = "h-full w-full";
        mountRef.current.appendChild(playerHost);

        playerRef.current = new window.YT.Player(playerHost, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              setReady(true);
              setDuration(e.target.getDuration() || 0);
              setMuted(e.target.isMuted());
              setVolume(e.target.getVolume());
            },
            onStateChange: (e) => {
              if (cancelled) return;
              setPlaying(e.data === 1);
            },
          },
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Could not load video player.");
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // Ignore teardown errors
      }
      playerRef.current = null;
    };
  }, [videoId, reloadNonce]);

  // Poll playback time while ready
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        setCurrentTime(p.getCurrentTime() || 0);
        setDuration(p.getDuration() || 0);
      } catch {
        // Ignore
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ready]);

  // Rotate dynamic watermark position every 20 seconds
  useEffect(() => {
    if (!watermarkEnabled || !viewerEmail) return;
    const updateClock = () => {
      setClockLabel(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    };
    updateClock();
    const timer = window.setInterval(() => {
      setWmIndex((i) => (i + 1) % WATERMARK_POSITIONS.length);
      updateClock();
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [watermarkEnabled, viewerEmail]);

  // Sync fullscreen state
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p || !ready) return;
    if (playing) {
      p.pauseVideo();
    } else {
      p.playVideo();
    }
  }, [playing, ready]);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p || !ready) return;
    if (muted) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  }, [muted, ready]);

  const handleVolumeChange = (nextVol: number) => {
    const p = playerRef.current;
    if (!p || !ready) return;
    setVolume(nextVol);
    p.setVolume(nextVol);
    if (nextVol === 0) {
      p.mute();
      setMuted(true);
    } else if (muted) {
      p.unMute();
      setMuted(false);
    }
  };

  const handleSeek = (nextSec: number) => {
    const p = playerRef.current;
    if (!p || !ready) return;
    setCurrentTime(nextSec);
    p.seekTo(nextSec, true);
  };

  const toggleFullscreen = async () => {
    const el = wrapperRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Fullscreen may be blocked by browser policy
    }
  };

  const shortSession = sessionId ? sessionId.slice(-6).toUpperCase() : "";

  return (
    <div
      ref={wrapperRef}
      role="region"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className="group relative aspect-video w-full overflow-hidden rounded-xl border bg-black select-none"
      aria-label={`Protected video player: ${title}`}
    >
      {/* YouTube IFrame container — pointer-events disabled so casual users cannot right-click or click Share/Copy */}
      <div ref={mountRef} className="pointer-events-none h-full w-full" />

      {/* Transparent click-shield overlay covering the iframe */}
      <div
        role="button"
        tabIndex={0}
        aria-label={playing ? "Pause stream" : "Play stream"}
        onClick={togglePlay}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            togglePlay();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-transparent"
      >
        {loadError ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-w-sm flex-col items-center gap-3 rounded-xl bg-black/85 p-5 text-center text-white backdrop-blur-sm"
          >
            <AlertTriangle className="size-7 text-amber-400" />
            <p className="text-xs text-white/90">{loadError}</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setReloadNonce((n) => n + 1)}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Retry Player
            </Button>
          </div>
        ) : !ready ? (
          <div className="flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-xs text-white backdrop-blur-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading player...
          </div>
        ) : !playing ? (
          <div className="flex size-16 items-center justify-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-sm transition-transform group-hover:scale-105">
            <Play className="ml-1 size-7 fill-current" />
          </div>
        ) : null}
      </div>

      {/* Dynamic moving viewer watermark (deters screen recording & leaks) */}
      {watermarkEnabled && viewerEmail && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute z-20 rounded bg-black/35 px-2.5 py-1 font-mono text-[11px] text-white/60 backdrop-blur-[1px] transition-all duration-700 ${WATERMARK_POSITIONS[wmIndex]}`}
        >
          {viewerEmail}
          {shortSession ? ` • #${shortSession}` : ""}
          {clockLabel ? ` • ${clockLabel}` : ""}
        </div>
      )}

      {/* Custom accessible control bar */}
      <div
        onContextMenu={(e) => e.preventDefault()}
        className="absolute right-0 bottom-0 left-0 z-30 flex items-center gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pt-6 pb-2.5 text-white"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={togglePlay}
          disabled={!ready}
          className="size-8 text-white hover:bg-white/15 hover:text-white"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          disabled={!ready}
          className="size-8 text-white hover:bg-white/15 hover:text-white"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </Button>

        <input
          type="range"
          min={0}
          max={100}
          disabled={!ready}
          value={muted ? 0 : volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
          aria-label="Volume"
          className="h-1 w-14 cursor-pointer accent-white disabled:opacity-40 sm:w-16"
        />

        {duration > 0 ? (
          <div className="flex flex-1 items-center gap-2 px-1">
            <span className="font-mono text-[11px] text-white/80">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.floor(duration)}
              disabled={!ready}
              value={Math.min(Math.floor(currentTime), Math.floor(duration))}
              onChange={(e) => handleSeek(Number(e.target.value))}
              aria-label="Seek timeline"
              className="h-1 flex-1 cursor-pointer accent-white disabled:opacity-40"
            />
            <span className="font-mono text-[11px] text-white/80">{formatTime(duration)}</span>
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-1.5 px-2">
            <span className="size-2 rounded-full bg-red-500" />
            <span className="font-medium text-xs text-white/90">LIVE</span>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void toggleFullscreen()}
          className="size-8 text-white hover:bg-white/15 hover:text-white"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
