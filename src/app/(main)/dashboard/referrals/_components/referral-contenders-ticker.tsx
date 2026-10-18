"use client";

import { Sparkles, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ReferralLeaderboardEntry } from "@/lib/firestore/types";

interface ReferralContendersTickerProps {
  entries: ReferralLeaderboardEntry[];
  isRevealed?: boolean;
}

export function ReferralContendersTicker({ entries, isRevealed = false }: ReferralContendersTickerProps) {
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

  // Duplicate items to ensure a seamless infinite marquee loop
  const displayItems =
    entries.length < 10 ? [...entries, ...entries, ...entries, ...entries] : [...entries, ...entries];

  return (
    <div className="relative w-full overflow-hidden py-3">
      {/* Title & Stats Indicator */}
      <div className="mb-2 flex items-center justify-between px-6 text-slate-400 text-xs">
        <div className="flex items-center gap-2">
          <Users className="size-3.5 text-blue-400" />
          <span className="font-semibold text-slate-300 uppercase tracking-wider">
            Official Contenders Spotlight ({entries.length} members)
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-amber-400/90">
          <Sparkles className="size-3" />
          <span>{isRevealed ? "All Scores Unlocked" : "Ranks Concealed • Live Contenders"}</span>
        </div>
      </div>

      {/* Gradient Fades for Smooth Edge Blending */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-950 to-transparent" />

      {/* Scrolling Track */}
      <div className="flex w-max animate-[scroll_40s_linear_infinite] gap-3 hover:[animation-play-state:paused]">
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
