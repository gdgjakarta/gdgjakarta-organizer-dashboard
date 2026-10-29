"use client";

import { useEffect, useRef, useState } from "react";

import { ExternalLink, Map as MapIcon, MapPin, X } from "lucide-react";

interface VenueMapFloatingButtonProps {
  venueMapUrl: string;
  venueName?: string;
  eventTitle?: string;
}

export function VenueMapFloatingButton({ venueMapUrl, venueName, eventTitle }: VenueMapFloatingButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsExpanded(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!venueMapUrl.trim()) {
    return null;
  }

  const trimmedUrl = venueMapUrl.trim();
  const isLikelyImage =
    !imageError &&
    (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(trimmedUrl) ||
      trimmedUrl.includes("res.cloudinary.com") ||
      trimmedUrl.includes("images.unsplash.com") ||
      trimmedUrl.includes("googleusercontent.com") ||
      trimmedUrl.includes("firebasestorage.googleapis.com"));

  return (
    <aside
      ref={containerRef}
      aria-label="Venue Map Floating Action"
      className="group fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 -translate-x-1/2 touch-manipulation select-none lg:bottom-8"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* ── 1. DYNAMIC ISLAND PREVIEW THUMBNAIL CARD (Above Button) ──── */}
      <div
        className={`pointer-events-none absolute bottom-full left-1/2 mb-3 origin-bottom -translate-x-1/2 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isExpanded
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-95 opacity-0 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100"
        }`}
      >
        <div className="w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/80 bg-popover/95 p-3 text-popover-foreground shadow-2xl backdrop-blur-2xl sm:w-80">
          {/* Top header row */}
          <div className="flex items-center justify-between border-border/60 border-b pb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/75" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
                Venue Floor Plan
              </span>
            </div>
            {/* Close button for touch devices */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="-mr-1 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:hidden"
              aria-label="Close preview"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Venue & Event Info */}
          {(venueName || eventTitle) && (
            <div className="pt-2 pb-2.5">
              <p className="truncate font-semibold text-foreground text-xs">{venueName || eventTitle}</p>
              {venueName && eventTitle && <p className="truncate text-[10px] text-muted-foreground">{eventTitle}</p>}
            </div>
          )}

          {/* Media Thumbnail Container */}
          <a
            href={trimmedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group/thumb relative block overflow-hidden rounded-xl border border-border/70 bg-muted/30 transition hover:border-primary/50"
            title="Open venue map"
          >
            {isLikelyImage ? (
              <div className="relative h-36 w-full overflow-hidden bg-muted/40">
                {/* biome-ignore lint/performance/noImgElement: Direct external dynamic venue floor plan preview */}
                <img
                  src={trimmedUrl}
                  alt={venueName ? `${venueName} Floor Map` : "Venue Map"}
                  className="size-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                  onError={() => setImageError(true)}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute right-2 bottom-2 rounded-md bg-black/60 px-2 py-0.5 font-medium text-[10px] text-white backdrop-blur-xs">
                  Click to open
                </div>
              </div>
            ) : (
              <div className="flex h-32 w-full flex-col items-center justify-center gap-2 bg-muted/40 p-4 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl border border-border/80 bg-background text-primary shadow-2xs">
                  <MapIcon className="size-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground text-xs">Interactive Venue Map</p>
                  <p className="text-[10px] text-muted-foreground">Click to open map</p>
                </div>
              </div>
            )}
          </a>
        </div>
      </div>

      {/* ── 2. DYNAMIC ISLAND FLOATING ACTION BUTTON ───────────────────── */}
      <a
        href={trimmedUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View Venue Map"
        className={`flex cursor-pointer items-center gap-2 rounded-full border border-border/80 bg-card/95 px-4 py-2.5 text-foreground shadow-lg backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-primary/50 hover:bg-accent hover:text-accent-foreground hover:shadow-xl active:scale-95 ${
          isExpanded
            ? "scale-102 border-primary/60 bg-accent px-5 text-accent-foreground shadow-xl ring-2 ring-primary/20"
            : ""
        }`}
      >
        <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MapPin className="size-3.5" />
        </div>
        <span className="whitespace-nowrap font-semibold text-foreground text-xs tracking-tight sm:text-sm">
          View Venue Map
        </span>
        <ExternalLink className="size-3.5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
      </a>
    </aside>
  );
}
