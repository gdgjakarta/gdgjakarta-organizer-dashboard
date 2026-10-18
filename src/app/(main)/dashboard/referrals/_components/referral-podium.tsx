"use client";

import { Crown, Gift, Medal, Trophy } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ReferralLeaderboardEntry } from "@/lib/firestore/types";

interface ReferralPodiumProps {
  entries: ReferralLeaderboardEntry[];
  merchPrizeDescription?: string;
}

export function ReferralPodium({
  entries,
  merchPrizeDescription = "Exclusive GDG Jakarta merchandise bundle",
}: ReferralPodiumProps) {
  if (entries.length === 0) return null;

  const first = entries[0];
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
      {/* 2nd Place (Silver) */}
      <div className="order-2 md:order-1">
        {second ? (
          <Card className="relative overflow-hidden border-slate-300/40 bg-gradient-to-t from-slate-100/30 to-card shadow-xs transition-all hover:shadow-md dark:border-slate-700/50 dark:from-slate-900/30">
            <div className="flex justify-between p-4 pb-2">
              <Badge
                variant="outline"
                className="border-slate-400/30 bg-slate-200/50 font-bold text-slate-700 text-xs dark:bg-slate-800/80 dark:text-slate-300"
              >
                <Medal className="mr-1 size-3 text-slate-500" />
                Rank #2 • Runner Up
              </Badge>
            </div>
            <CardContent className="flex flex-col items-center pt-2 text-center">
              <div className="relative mb-2">
                <Avatar className="size-16 border-2 border-slate-300 shadow-xs dark:border-slate-600">
                  <AvatarImage src={second.avatar_url ?? undefined} alt={second.name} />
                  <AvatarFallback className="font-semibold text-slate-700 dark:text-slate-200">
                    {getInitials(second.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1.5 -right-1 flex size-6 items-center justify-center rounded-full bg-slate-300 font-bold text-[11px] text-slate-800 shadow-xs dark:bg-slate-700 dark:text-slate-100">
                  2
                </div>
              </div>

              <h4 className="line-clamp-1 font-semibold text-foreground text-sm">{second.name}</h4>
              <p className="line-clamp-1 font-mono text-[11px] text-muted-foreground">{second.referral_code}</p>

              <div className="mt-3.5 grid w-full grid-cols-2 divide-x border-t pt-2.5 text-xs">
                <div className="flex flex-col items-center justify-center px-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap">Points</p>
                  <p className="mt-1 font-bold text-foreground text-sm">{second.referral_points}</p>
                </div>
                <div className="flex flex-col items-center justify-center px-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    Referrals
                  </p>
                  <p className="mt-1 font-bold text-foreground text-sm">{second.referrals_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="hidden h-40 rounded-xl border border-dashed md:block" />
        )}
      </div>

      {/* 1st Place (Gold Champion & Merch Winner) */}
      <div className="order-1 md:order-2">
        <Card className="relative overflow-hidden border-amber-500/50 bg-gradient-to-t from-amber-500/10 via-card to-amber-500/5 shadow-md transition-all hover:shadow-lg dark:border-amber-500/40">
          <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-amber-500/15 blur-2xl" />

          <div className="flex justify-between p-4 pb-2">
            <Badge className="border-amber-500/30 bg-amber-500 font-bold text-amber-950 text-xs shadow-2xs hover:bg-amber-500">
              <Crown className="mr-1 size-3.5 fill-amber-950" />
              Leader #1 • Merch Winner
            </Badge>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <Trophy className="size-3.5" />
              Champion
            </div>
          </div>

          <CardContent className="flex flex-col items-center pt-2 text-center">
            <div className="relative mb-2">
              <Avatar className="size-20 border-3 border-amber-500 shadow-md">
                <AvatarImage src={first.avatar_url ?? undefined} alt={first.name} />
                <AvatarFallback className="font-bold text-amber-700 text-lg dark:text-amber-300">
                  {getInitials(first.name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1.5 -right-1 flex size-7 items-center justify-center rounded-full bg-amber-500 font-black text-amber-950 text-xs shadow-xs">
                1
              </div>
            </div>

            <h4 className="line-clamp-1 font-bold text-base text-foreground">{first.name}</h4>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="font-mono font-medium text-xs text-muted-foreground">{first.referral_code}</span>
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 font-medium text-[10px] text-amber-700 dark:text-amber-300"
              >
                <Gift className="mr-1 size-2.5" />
                Wins Merch
              </Badge>
            </div>

            <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground">{merchPrizeDescription}</p>

            <div className="mt-3.5 grid w-full grid-cols-2 divide-x divide-amber-500/30 rounded-xl bg-amber-500/10 px-2 py-2.5 text-xs dark:bg-amber-500/15">
              <div className="flex flex-col items-center justify-center px-2 text-center">
                <p className="text-[10px] text-amber-800 font-medium uppercase tracking-wider whitespace-nowrap dark:text-amber-300">
                  Total Points
                </p>
                <p className="mt-1 font-black text-amber-900 text-lg dark:text-amber-100">{first.referral_points}</p>
              </div>
              <div className="flex flex-col items-center justify-center px-2 text-center">
                <p className="text-[10px] text-amber-800 font-medium uppercase tracking-wider whitespace-nowrap dark:text-amber-300">
                  Total Referrals
                </p>
                <p className="mt-1 font-black text-amber-900 text-lg dark:text-amber-100">{first.referrals_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3rd Place (Bronze) */}
      <div className="order-3">
        {third ? (
          <Card className="relative overflow-hidden border-amber-800/20 bg-gradient-to-t from-amber-900/10 to-card shadow-xs transition-all hover:shadow-md dark:border-amber-700/30 dark:from-amber-950/20">
            <div className="flex justify-between p-4 pb-2">
              <Badge
                variant="outline"
                className="border-amber-700/30 bg-amber-700/10 font-bold text-amber-800 text-xs dark:text-amber-300"
              >
                <Medal className="mr-1 size-3 text-amber-700" />
                Rank #3 • 2nd Runner Up
              </Badge>
            </div>
            <CardContent className="flex flex-col items-center pt-2 text-center">
              <div className="relative mb-2">
                <Avatar className="size-16 border-2 border-amber-700/60 shadow-xs">
                  <AvatarImage src={third.avatar_url ?? undefined} alt={third.name} />
                  <AvatarFallback className="font-semibold text-amber-900 dark:text-amber-200">
                    {getInitials(third.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1.5 -right-1 flex size-6 items-center justify-center rounded-full bg-amber-700 font-bold text-[11px] text-white shadow-xs">
                  3
                </div>
              </div>

              <h4 className="line-clamp-1 font-semibold text-foreground text-sm">{third.name}</h4>
              <p className="line-clamp-1 font-mono text-[11px] text-muted-foreground">{third.referral_code}</p>

              <div className="mt-3.5 grid w-full grid-cols-2 divide-x border-t pt-2.5 text-xs">
                <div className="flex flex-col items-center justify-center px-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap">Points</p>
                  <p className="mt-1 font-bold text-foreground text-sm">{third.referral_points}</p>
                </div>
                <div className="flex flex-col items-center justify-center px-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    Referrals
                  </p>
                  <p className="mt-1 font-bold text-foreground text-sm">{third.referrals_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="hidden h-40 rounded-xl border border-dashed md:block" />
        )}
      </div>
    </div>
  );
}
