"use client";

import { useMemo, useState } from "react";

import { format, parseISO } from "date-fns";
import {
  Check,
  Copy,
  Crown,
  Gift,
  Loader2,
  Medal,
  MoreHorizontal,
  RotateCcw,
  Search,
  Sparkles,
  Trophy,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { excludeMemberFromLeaderboardAction, resetMemberReferralAction } from "@/lib/firestore/actions";
import type { ReferralLeaderboardEntry } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { ReferralRedemptionsDialog } from "./referral-redemptions-dialog";

interface ReferralTableProps {
  entries: ReferralLeaderboardEntry[];
  onDataMutated?: () => void;
}

export function ReferralTable({ entries, onDataMutated }: ReferralTableProps) {
  const [search, setSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<ReferralLeaderboardEntry | null>(null);
  const [resetting, setResetting] = useState(false);
  const [excludingId, setExcludingId] = useState<string | null>(null);
  const [selectedReferrerForRedemptions, setSelectedReferrerForRedemptions] = useState<ReferralLeaderboardEntry | null>(
    null,
  );

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

  const handleResetMember = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const res = await resetMemberReferralAction(resetTarget.member_id);
      if (!res.success) {
        toast.error(res.error || "Failed to reset member referral.");
        return;
      }
      toast.success(`Referral points and tickets reset for ${resetTarget.name}.`);
      setResetTarget(null);
      onDataMutated?.();
    } catch {
      toast.error("Failed to reset referral.");
    } finally {
      setResetting(false);
    }
  };

  const handleExcludeMember = async (entry: ReferralLeaderboardEntry) => {
    setExcludingId(entry.member_id);
    try {
      const res = await excludeMemberFromLeaderboardAction(entry.member_id);
      if (!res.success) {
        toast.error(res.error || "Failed to exclude member.");
        return;
      }
      toast.success(`${entry.name} excluded from leaderboard.`);
      onDataMutated?.();
    } catch {
      toast.error("Failed to exclude member.");
    } finally {
      setExcludingId(null);
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
    <>
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
                  <TableHead className="w-12 text-center text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-xs">
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

                        <TableCell className="text-right">
                          {entry.referrals_count > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedReferrerForRedemptions(entry)}
                              className="group ml-auto flex h-7 items-center justify-end gap-1.5 px-2 font-mono text-xs hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                              title="View attendees who redeemed this referral"
                            >
                              <span className="font-semibold text-foreground group-hover:text-primary">
                                {entry.referrals_count}
                              </span>
                              <span className="text-[10px] text-muted-foreground group-hover:text-primary">
                                tickets
                              </span>
                              <Users className="size-3 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:text-primary" />
                            </Button>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              0 <span className="text-[10px] text-muted-foreground">tickets</span>
                            </span>
                          )}
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

                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="size-7 text-muted-foreground hover:text-foreground"
                              >
                                {excludingId === entry.member_id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="size-3.5" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-xs">
                              <DropdownMenuItem
                                onClick={() => setSelectedReferrerForRedemptions(entry)}
                                className="gap-2 cursor-pointer text-xs"
                              >
                                <Users className="size-3.5" />
                                View Redemptions ({entry.referrals_count})
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCopyCode(entry.referral_code)}
                                className="gap-2 cursor-pointer text-xs"
                              >
                                <Copy className="size-3.5" />
                                Copy Referral Code
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleExcludeMember(entry)}
                                disabled={excludingId === entry.member_id}
                                className="gap-2 cursor-pointer text-xs"
                              >
                                <UserX className="size-3.5" />
                                Exclude from Board
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setResetTarget(entry)}
                                className="gap-2 cursor-pointer text-xs text-destructive focus:text-destructive"
                              >
                                <RotateCcw className="size-3.5 text-destructive" />
                                Reset Points & Count
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Single Member Reset Confirmation Dialog */}
      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(next) => {
          if (!next && !resetting) setResetTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive shadow-xs">
                <RotateCcw className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base text-destructive">Reset Member Referral Stats?</DialogTitle>
                <DialogDescription className="text-xs">
                  This will reset accumulated referral points and tickets count to 0 for this member.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {resetTarget && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-semibold text-foreground">{resetTarget.name}</p>
                <p className="text-[11px] text-muted-foreground">{resetTarget.email}</p>
                <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-foreground">
                  <span>
                    Current Points: <strong>{resetTarget.referral_points}</strong>
                  </span>
                  <span>
                    Referred: <strong>{resetTarget.referrals_count} tickets</strong>
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The member's referral code ({resetTarget.referral_code}) will remain valid for future invites.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResetTarget(null)}
              disabled={resetting}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleResetMember}
              disabled={resetting}
              className="h-8 text-xs font-medium"
            >
              {resetting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset to 0"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendees who redeemed referral inspection dialog */}
      <ReferralRedemptionsDialog
        entry={selectedReferrerForRedemptions}
        open={Boolean(selectedReferrerForRedemptions)}
        onOpenChange={(next) => {
          if (!next) setSelectedReferrerForRedemptions(null);
        }}
      />
    </>
  );
}
