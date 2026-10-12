"use client";

import { useMemo, useState } from "react";

import { format, parseISO } from "date-fns";
import { Check, Copy, Crown, Gift, Medal, Search, Sparkles, Trophy, Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReferralLeaderboardEntry } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface ReferralTableProps {
  entries: ReferralLeaderboardEntry[];
}

export function ReferralTable({ entries }: ReferralTableProps) {
  const [search, setSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.referral_code.toLowerCase().includes(q),
    );
  }, [entries, search]);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`Referral code ${code} copied!`);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error("Failed to copy code.");
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <Badge className="border-amber-500/40 bg-amber-500 font-bold text-amber-950 text-xs shadow-2xs hover:bg-amber-500">
          <Crown className="mr-1 size-3 fill-amber-950" />
          #1
        </Badge>
      );
    }
    if (rank === 2) {
      return (
        <Badge
          variant="outline"
          className="border-slate-400/40 bg-slate-200/60 font-bold text-slate-800 text-xs dark:bg-slate-800 dark:text-slate-200"
        >
          <Medal className="mr-1 size-3 text-slate-500" />
          #2
        </Badge>
      );
    }
    if (rank === 3) {
      return (
        <Badge
          variant="outline"
          className="border-amber-800/40 bg-amber-800/10 font-bold text-amber-800 text-xs dark:text-amber-300"
        >
          <Medal className="mr-1 size-3 text-amber-700" />
          #3
        </Badge>
      );
    }
    return (
      <Badge variant="ghost" className="font-mono text-muted-foreground text-xs">
        #{rank}
      </Badge>
    );
  };

  return (
    <Card className="shadow-xs">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Ranked Leaderboard</CardTitle>
          <p className="text-xs text-muted-foreground">
            All registered referrers sorted by points. Top rank qualifies for exclusive GDG Jakarta merchandise.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search member or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16 text-center text-xs">Rank</TableHead>
                <TableHead className="text-xs">Member</TableHead>
                <TableHead className="text-xs">Referral Code</TableHead>
                <TableHead className="text-right text-xs">Tickets Referred</TableHead>
                <TableHead className="text-right text-xs">Points</TableHead>
                <TableHead className="text-center text-xs">Prize Status</TableHead>
                <TableHead className="text-right text-xs">Joined Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-xs">
                    {search ? `No members found matching "${search}".` : "No referral records yet."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => {
                  let formattedDate = entry.joined_date;
                  try {
                    formattedDate = format(parseISO(entry.joined_date), "dd MMM yyyy");
                  } catch {
                    // Keep raw
                  }

                  const isFirst = entry.rank === 1 && entry.referral_points > 0;
                  const isTopThree = entry.rank <= 3 && entry.referral_points > 0;

                  return (
                    <TableRow
                      key={entry.member_id}
                      className={cn("text-xs", isFirst && "bg-amber-500/5 font-medium hover:bg-amber-500/10")}
                    >
                      <TableCell className="text-center font-medium">{getRankBadge(entry.rank)}</TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarImage src={entry.avatar_url ?? undefined} alt={entry.name} />
                            <AvatarFallback className="text-[10px] font-semibold">
                              {entry.name
                                .split(" ")
                                .slice(0, 2)
                                .map((w) => w[0]?.toUpperCase())
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground text-xs leading-none">{entry.name}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground leading-none">{entry.email}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold">{entry.referral_code}</span>
                          {entry.referral_code !== "-" && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleCopyCode(entry.referral_code)}
                              className="size-6 text-muted-foreground hover:text-foreground"
                              title="Copy referral code"
                            >
                              {copiedCode === entry.referral_code ? (
                                <Check className="size-3 text-emerald-600" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-mono font-medium">
                        {entry.referrals_count} <span className="text-[10px] text-muted-foreground">tickets</span>
                      </TableCell>

                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-mono font-bold",
                            isFirst ? "text-amber-600 dark:text-amber-400" : "text-foreground",
                          )}
                        >
                          {entry.referral_points}
                        </span>{" "}
                        <span className="text-[10px] text-muted-foreground">pts</span>
                      </TableCell>

                      <TableCell className="text-center">
                        {isFirst ? (
                          <Badge className="border-amber-500/40 bg-amber-500/15 font-semibold text-amber-700 text-[10px] dark:text-amber-300">
                            <Gift className="mr-1 size-2.5" />
                            Merch Prize Winner
                          </Badge>
                        ) : isTopThree ? (
                          <Badge
                            variant="outline"
                            className="border-slate-300 font-medium text-[10px] text-muted-foreground dark:border-slate-700"
                          >
                            Top Contender
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Participant</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-muted-foreground text-[11px]">{formattedDate}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
