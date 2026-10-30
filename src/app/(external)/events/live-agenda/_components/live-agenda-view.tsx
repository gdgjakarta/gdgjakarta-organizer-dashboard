"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";

import { Maximize, Minimize } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LIVE_AGENDA_BACKGROUND_URL, type LiveAgendaStage } from "@/lib/events/live-agenda";
import { cn } from "@/lib/utils";

import { CurrentTimeColumn } from "./current-time-column";
import { FeedbackColumn } from "./feedback-column";
import { VenueMapColumn } from "./venue-map-column";

interface LiveAgendaViewProps {
  stages: LiveAgendaStage[];
  eventName: string;
}

export function LiveAgendaView({ stages, eventName }: LiveAgendaViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Null until mounted so server and client markup match; the clock fills in right after hydration.
  const [now, setNow] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current?.requestFullscreen();
      }
    } catch (error) {
      console.warn("[LiveAgenda] Fullscreen is not available:", error);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ "--live-agenda-bg": `url(${LIVE_AGENDA_BACKGROUND_URL})` } as CSSProperties}
      className={cn(
        "bg-(image:--live-agenda-bg) relative flex flex-1 flex-col overflow-y-auto bg-center bg-cover bg-green-700 p-6 text-white md:p-10",
        isFullscreen ? "h-screen rounded-none" : "min-h-[calc(100svh-12rem)] rounded-2xl",
      )}
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className="absolute top-4 right-4 z-10 text-white hover:bg-white/20 hover:text-white"
      >
        {isFullscreen ? <Minimize /> : <Maximize />}
      </Button>

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        <CurrentTimeColumn now={now} stages={stages} />
        <VenueMapColumn />
        <FeedbackColumn eventName={eventName} />
      </div>
    </div>
  );
}
