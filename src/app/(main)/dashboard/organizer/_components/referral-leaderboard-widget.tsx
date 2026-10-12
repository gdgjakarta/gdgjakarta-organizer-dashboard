import Link from "next/link";

import { ArrowRight, Crown, Gift, Medal, Trophy } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getReferralLeaderboardAction } from "@/lib/firestore/actions";

export async function ReferralLeaderboardWidget() {
  const entries = await getReferralLeaderboardAction(5);
  const topThree = entries.slice(0, 3);
  const leader = entries.length > 0 && entries[0].referral_points > 0 ? entries[0] : null;

  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Trophy className="size-4" />
          </div>
          <CardTitle className="text-base font-semibold">Referral Leaderboard</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Community promoters earning points toward the GDG merchandise grand prize.
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link href="/dashboard/referrals">
              View All
              <ArrowRight className="size-3" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
        {leader && (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="font-semibold text-amber-950 dark:text-amber-200">#1 Leader: {leader.name}</span>
            </div>
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/20 font-bold text-[10px] text-amber-900 dark:text-amber-100"
            >
              <Gift className="mr-1 size-2.5" />
              Merch Winner
            </Badge>
          </div>
        )}

        {topThree.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
            No referral activity recorded yet.
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {topThree.map((item, index) => {
              const rank = index + 1;
              return (
                <div
                  key={item.member_id}
                  className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-5 shrink-0 items-center justify-center font-bold text-[11px]">
                      {rank === 1 ? (
                        <span className="text-amber-500">🥇</span>
                      ) : rank === 2 ? (
                        <span className="text-slate-400">🥈</span>
                      ) : (
                        <span className="text-amber-700">🥉</span>
                      )}
                    </div>
                    <Avatar className="size-7 shrink-0">
                      <AvatarImage src={item.avatar_url ?? undefined} alt={item.name} />
                      <AvatarFallback className="text-[10px]">
                        {item.name
                          .split(" ")
                          .slice(0, 2)
                          .map((w) => w[0]?.toUpperCase())
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground text-xs leading-none">{item.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground leading-none">
                        {item.referral_code}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <p className="font-mono font-bold text-foreground leading-none">
                      {item.referral_points} <span className="font-normal text-[10px] text-muted-foreground">pts</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground leading-none">
                      {item.referrals_count} tickets
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
