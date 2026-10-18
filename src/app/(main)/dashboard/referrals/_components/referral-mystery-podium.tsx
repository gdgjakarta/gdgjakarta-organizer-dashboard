"use client";

import { Crown, Gift, HelpCircle, Medal, Trophy } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ReferralLeaderboardEntry } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface ReferralMysteryPodiumProps {
  entries: ReferralLeaderboardEntry[];
  revealedRanks: {
    rank1: boolean;
    rank2: boolean;
    rank3: boolean;
  };
  merchPrizeDescription?: string;
}

const RANK_THEMES = {
  1: {
    avatarSize: "size-28",
    avatarBorder: "border-amber-400",
    badgeBg: "bg-amber-400 text-amber-950",
    mysteryIcon: "size-12 text-amber-400",
    fallbackBg: "bg-amber-950 text-amber-300",
    mysteryFrame: "size-28 border-amber-400/60",
  },
  2: {
    avatarSize: "size-24",
    avatarBorder: "border-slate-300",
    badgeBg: "bg-slate-300 text-slate-900",
    mysteryIcon: "size-10 text-slate-300",
    fallbackBg: "bg-slate-800 text-slate-200",
    mysteryFrame: "size-24 border-slate-600/60",
  },
  3: {
    avatarSize: "size-24",
    avatarBorder: "border-amber-700",
    badgeBg: "bg-amber-700 text-white",
    mysteryIcon: "size-10 text-amber-600",
    fallbackBg: "bg-amber-950 text-amber-200",
    mysteryFrame: "size-24 border-slate-600/60",
  },
} as const;

export function ReferralMysteryPodium({
  entries,
  revealedRanks,
  merchPrizeDescription = "Exclusive GDG Jakarta Merchandise Bundle",
}: ReferralMysteryPodiumProps) {
  const first = entries.length > 0 ? entries[0] : null;
  const second = entries.length > 1 ? entries[1] : null;
  const third = entries.length > 2 ? entries[2] : null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");
  };

  return (
    <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 md:items-end">
      {/* 2nd Place (Silver) */}
      <div className="order-2 md:order-1">
        <PodiumCard
          rank={2}
          entry={second}
          isRevealed={revealedRanks.rank2}
          getInitials={getInitials}
          rankTitle="Rank #2 • Runner Up"
          borderColor="border-slate-400/50"
          glowColor="from-slate-400/20"
          badgeColor="border-slate-400/40 bg-slate-400/20 text-slate-200"
          accentIcon={<Medal className="size-4 text-slate-300" />}
        />
      </div>

      {/* 1st Place (Gold Champion & Merch Winner) - Elevated Center */}
      <div className="order-1 -mt-4 md:order-2 md:-mt-8">
        <PodiumCard
          rank={1}
          entry={first}
          isRevealed={revealedRanks.rank1}
          getInitials={getInitials}
          rankTitle="Champion #1 • Merch Winner"
          borderColor="border-amber-400/60"
          glowColor="from-amber-500/25"
          badgeColor="border-amber-400/50 bg-amber-400 text-amber-950 font-bold"
          accentIcon={<Crown className="size-5 fill-amber-950" />}
          merchPrizeDescription={merchPrizeDescription}
          isChampion
        />
      </div>

      {/* 3rd Place (Bronze) */}
      <div className="order-3">
        <PodiumCard
          rank={3}
          entry={third}
          isRevealed={revealedRanks.rank3}
          getInitials={getInitials}
          rankTitle="Rank #3 • 2nd Runner Up"
          borderColor="border-amber-700/50"
          glowColor="from-amber-700/20"
          badgeColor="border-amber-700/40 bg-amber-700/20 text-amber-300"
          accentIcon={<Medal className="size-4 text-amber-500" />}
        />
      </div>
    </div>
  );
}

interface PodiumCardProps {
  rank: 1 | 2 | 3;
  entry: ReferralLeaderboardEntry | null;
  isRevealed: boolean;
  getInitials: (name: string) => string;
  rankTitle: string;
  borderColor: string;
  glowColor: string;
  badgeColor: string;
  accentIcon: React.ReactNode;
  merchPrizeDescription?: string;
  isChampion?: boolean;
}

function PodiumCard({
  rank,
  entry,
  isRevealed,
  getInitials,
  rankTitle,
  borderColor,
  glowColor,
  badgeColor,
  accentIcon,
  merchPrizeDescription,
  isChampion = false,
}: PodiumCardProps) {
  const theme = RANK_THEMES[rank];

  return (
    <div
      className={cn(
        "relative flex flex-col items-center overflow-hidden rounded-3xl border bg-slate-900/90 p-6 text-center backdrop-blur-xl transition-all duration-700",
        borderColor,
        isChampion ? "shadow-2xl shadow-amber-500/20 md:py-8" : "shadow-black/40 shadow-lg",
      )}
    >
      {/* Background Ambient Glow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 -top-16 h-40 bg-gradient-to-b to-transparent blur-2xl",
          glowColor,
        )}
      />

      {/* Podium Top Badge */}
      <div className="z-10 mb-5 flex items-center justify-between gap-2">
        <Badge className={cn("px-3 py-1 font-semibold text-xs shadow-sm", badgeColor)}>
          {accentIcon}
          <span className="ml-1.5">{rankTitle}</span>
        </Badge>
      </div>

      {/* Mystery State */}
      {!isRevealed ? (
        <div className="z-10 flex flex-col items-center">
          {/* Mystery Pulsing Avatar Frame */}
          <div className="relative mb-4 flex items-center justify-center">
            <div
              className={cn(
                "flex items-center justify-center rounded-full border-2 border-dashed bg-slate-950/80 shadow-inner transition-all",
                theme.mysteryFrame,
                "animate-pulse",
              )}
            >
              <HelpCircle className={cn("animate-bounce", theme.mysteryIcon)} />
            </div>
            {/* Mystery Number Badge */}
            <div
              className={cn(
                "absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full font-black text-xs shadow-md",
                theme.badgeBg,
              )}
            >
              {rank}
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 className="flex items-center justify-center gap-1.5 font-bold text-lg text-slate-400 tracking-widest">
              <span>? ? ? ? ?</span>
            </h4>
            <p className="font-mono text-slate-500 text-xs">GDG-SECRET-CODE</p>
          </div>

          <div className="mt-5 flex w-full max-w-[200px] justify-around rounded-xl border border-slate-800 bg-slate-950/60 py-2.5 text-xs">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Points</p>
              <p className="font-bold font-mono text-slate-400">••••</p>
            </div>
            <div className="border-slate-800 border-r" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Referrals</p>
              <p className="font-bold font-mono text-slate-400">••</p>
            </div>
          </div>
        </div>
      ) : (
        /* Revealed Winner State */
        <div className="fade-in zoom-in-95 z-10 flex animate-in flex-col items-center duration-500">
          {/* Crown for Champion */}
          {isChampion && (
            <div className="-mt-3 mb-1 animate-bounce">
              <Crown className="size-8 fill-amber-400 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
            </div>
          )}

          {/* Winner Avatar */}
          <div className="relative mb-3">
            <Avatar
              className={cn(
                "border-4 shadow-xl transition-transform hover:scale-105",
                theme.avatarSize,
                theme.avatarBorder,
              )}
            >
              <AvatarImage src={entry?.avatar_url ?? undefined} alt={entry?.name ?? `Rank ${rank}`} />
              <AvatarFallback className={cn("font-bold text-lg", theme.fallbackBg)}>
                {entry ? getInitials(entry.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full font-black text-xs shadow-md",
                theme.badgeBg,
              )}
            >
              {rank}
            </div>
          </div>

          {/* Winner Details */}
          <div className="space-y-1">
            <h4
              className={cn(
                "line-clamp-1 font-bold text-foreground text-white",
                isChampion ? "text-amber-300 text-xl sm:text-2xl" : "text-lg text-slate-100",
              )}
            >
              {entry ? entry.name : "Winner"}
            </h4>
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-mono text-slate-400 text-xs">{entry?.referral_code}</span>
              {isChampion && (
                <Badge
                  variant="outline"
                  className="border-amber-400/50 bg-amber-400/10 font-bold text-[10px] text-amber-300"
                >
                  <Gift className="mr-1 size-2.5" />
                  Merch Winner
                </Badge>
              )}
            </div>
          </div>

          {/* Prize description for Champion */}
          {isChampion && merchPrizeDescription && (
            <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-center text-amber-200 text-xs">
              <Trophy className="size-3.5 shrink-0 text-amber-400" />
              <span className="line-clamp-1 font-medium">{merchPrizeDescription}</span>
            </div>
          )}

          {/* Points & Referrals Stats */}
          <div
            className={cn(
              "mt-4 flex w-full justify-around rounded-xl py-3 text-xs",
              isChampion
                ? "border border-amber-400/30 bg-amber-400/10 text-amber-100"
                : "border border-slate-800 bg-slate-950/70 text-slate-300",
            )}
          >
            <div>
              <p
                className={cn("text-[10px] uppercase", isChampion ? "font-semibold text-amber-300" : "text-slate-500")}
              >
                Total Points
              </p>
              <p className={cn("font-black", isChampion ? "text-amber-200 text-xl" : "text-base text-white")}>
                {entry?.referral_points?.toLocaleString("id-ID") ?? 0}
              </p>
            </div>
            <div className={cn("border-r", isChampion ? "border-amber-400/30" : "border-slate-800")} />
            <div>
              <p
                className={cn("text-[10px] uppercase", isChampion ? "font-semibold text-amber-300" : "text-slate-500")}
              >
                Conversions
              </p>
              <p className={cn("font-black", isChampion ? "text-amber-200 text-xl" : "text-base text-white")}>
                {entry?.referrals_count?.toLocaleString("id-ID") ?? 0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
