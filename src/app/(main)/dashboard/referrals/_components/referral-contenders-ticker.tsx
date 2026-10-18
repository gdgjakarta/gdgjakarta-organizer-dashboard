"use client";

import { useState } from "react";

import { Gauge, Pause, Play, Sparkles, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ReferralLeaderboardEntry } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface ReferralContendersTickerProps {
  entries: ReferralLeaderboardEntry[];
  isRevealed?: boolean;
}

const SPEED_OPTIONS = [
  { label: "0.5x", val: 0.5 },
  { label: "1x", val: 1 },
  { label: "1.5x", val: 1.5 },
  { label: "2x", val: 2 },
] as const;

export function ReferralContendersTicker({ entries, isRevealed = false }: ReferralContendersTickerProps) {
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  if (entries.length === 0) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");
  };

  // Adaptive base duration based on member count (~1.4s per member card, minimum 25s)
  const baseDuration = Math.max(25, entries.length * 1.4);
  const currentDuration = baseDuration / speedMultiplier;

  // Duplicate items to ensure a seamless infinite marquee loop
  const displayItems =
    entries.length < 10 ? [...entries, ...entries, ...entries, ...entries] : [...entries, ...entries];

  return (
    <div className="relative w-full overflow-hidden py-3">
      {/* Title & Speed Controls */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-6 text-slate-400 text-xs">
        <div className="flex items-center gap-2">
          <Users className="size-3.5 text-blue-400" />
          <span className="font-semibold text-slate-300 uppercase tracking-wider">
            Official Contenders Spotlight ({entries.length} members)
          </span>
        </div>

        {/* Speed & Playback Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/90 p-1 shadow-xs backdrop-blur-md">
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                isPaused
                  ? "bg-amber-400 font-bold text-amber-950 shadow-xs"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white",
              )}
              title={isPaused ? "Resume Marquee (Click to play)" : "Pause Marquee"}
            >
              {isPaused ? <Play className="size-2.5 fill-current" /> : <Pause className="size-2.5 fill-current" />}
              <span>{isPaused ? "Paused" : "Pause"}</span>
            </button>

            <div className="mx-0.5 h-3 w-px bg-slate-800" />

            <div className="flex items-center gap-0.5">
              <Gauge className="ml-1 size-3 text-slate-500" />
              {SPEED_OPTIONS.map(({ label, val }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setSpeedMultiplier(val);
                    setIsPaused(false);
                  }}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                    speedMultiplier === val && !isPaused
                      ? "bg-blue-600 font-bold text-white shadow-xs"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white",
                  )}
                  title={`Set marquee speed to ${label}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden items-center gap-1.5 font-mono text-[11px] text-amber-400/90 sm:flex">
            <Sparkles className="size-3" />
            <span>{isRevealed ? "All Scores Unlocked" : "Ranks Concealed • Live Contenders"}</span>
          </div>
        </div>
      </div>

      {/* Gradient Fades for Smooth Edge Blending */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-950 to-transparent" />

      {/* Scrolling Track with Dynamic Speed */}
      <div
        className="flex w-max gap-3 hover:[animation-play-state:paused]"
        style={{
          animationName: "scroll",
          animationDuration: `${currentDuration}s`,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationPlayState: isPaused ? "paused" : "running",
        }}
      >
        {displayItems.map((entry, idx) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Marquee loop duplicates items for infinite continuous scroll
            key={`${entry.member_id}-${idx}`}
            className="group flex items-center gap-3 rounded-full border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 shadow-sm backdrop-blur-md transition-all hover:border-blue-500/50 hover:bg-slate-800/90"
          >
            <Avatar className="size-7 border border-slate-700">
              <AvatarImage src={entry.avatar_url ?? undefined} alt={entry.name} />
              <AvatarFallback className="bg-slate-800 font-bold text-[10px] text-slate-200">
                {getInitials(entry.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col">
              <span className="line-clamp-1 max-w-[130px] font-medium text-slate-200 text-xs">{entry.name}</span>
              <span className="font-mono text-[10px] text-slate-400">{entry.referral_code}</span>
            </div>

            <Badge variant="outline" className="border-slate-700 bg-slate-800/80 font-mono text-[10px] text-slate-300">
              {isRevealed ? `${entry.referral_points} pts` : "Contender"}
            </Badge>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
