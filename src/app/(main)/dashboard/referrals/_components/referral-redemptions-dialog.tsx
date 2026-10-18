"use client";

import { useEffect, useMemo, useState } from "react";

import { format, parseISO } from "date-fns";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Search,
  Sparkles,
  Tag,
  Ticket,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMemberReferralHistoryAction } from "@/lib/firestore/actions";
import type { ReferralLeaderboardEntry, ReferralRedemption } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface ReferralRedemptionsDialogProps {
  entry: ReferralLeaderboardEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReferralRedemptionsDialog({ entry, open, onOpenChange }: ReferralRedemptionsDialogProps) {
  const [redemptions, setRedemptions] = useState<ReferralRedemption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!open || !entry) {
      setRedemptions([]);
      setSearch("");
      return;
    }

    let isMounted = true;
    async function fetchRedemptions() {
      if (!entry) return;
      setLoading(true);
      try {
        const data = await getMemberReferralHistoryAction(entry.member_id, entry.referral_code);
        if (isMounted) {
          setRedemptions(data);
        }
      } catch (err) {
        console.error("[ReferralRedemptionsDialog] Failed to load redemptions:", err);
        toast.error("Failed to load referral redemption details.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchRedemptions();

    return () => {
      isMounted = false;
    };
  }, [open, entry]);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast.success(`Referral code ${code} copied!`);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Failed to copy referral code.");
    }
  };

  const filteredRedemptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return redemptions;
    return redemptions.filter(
      (r) =>
        r.referee_name?.toLowerCase().includes(q) ||
        r.referee_email?.toLowerCase().includes(q) ||
        r.event_title?.toLowerCase().includes(q) ||
        r.ticket_name?.toLowerCase().includes(q),
    );
  }, [redemptions, search]);

  const uniqueEventsCount = useMemo(() => {
    const set = new Set(redemptions.map((r) => r.event_id || r.event_title));
    return set.size;
  }, [redemptions]);

  const totalPoints = useMemo(() => {
    return redemptions.reduce((acc, r) => acc + (r.points_awarded || 10), 0);
  }, [redemptions]);

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col overflow-hidden p-0 sm:max-h-[85vh] sm:max-w-4xl lg:max-w-5xl">
        {/* Dialog Header */}
        <DialogHeader className="border-b px-5 py-4 shrink-0 bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="size-10 border border-border/80">
                <AvatarImage src={entry.avatar_url ?? undefined} alt={entry.name} />
                <AvatarFallback className="text-xs font-semibold">
                  {entry.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase())
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold text-foreground">{entry.name}</DialogTitle>
                  {entry.role && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] capitalize">
                      {entry.role.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {entry.rank <= 3 && entry.referral_points > 0 && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-700 text-[10px] dark:text-amber-400"
                    >
                      <Trophy className="mr-1 size-2.5" />
                      Rank #{entry.rank}
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Referral code redemption history and attendee breakdown
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-1">
                <span className="font-mono text-xs font-semibold text-foreground">{entry.referral_code}</span>
                {entry.referral_code !== "-" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleCopyCode(entry.referral_code)}
                    className="size-5 text-muted-foreground hover:text-foreground"
                    title="Copy code"
                  >
                    {copiedCode ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
            <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2">
              <Users className="size-4 text-primary shrink-0" />
              <div>
                <span className="font-mono font-bold text-foreground text-sm">{redemptions.length}</span>
                <p className="text-[10px] text-muted-foreground leading-tight">Total Redeemed</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2">
              <Calendar className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="font-mono font-bold text-foreground text-sm">{uniqueEventsCount}</span>
                <p className="text-[10px] text-muted-foreground leading-tight">Events Reached</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2">
              <Sparkles className="size-4 text-amber-500 shrink-0" />
              <div>
                <span className="font-mono font-bold text-foreground text-sm">
                  {entry.referral_points || totalPoints}
                </span>
                <p className="text-[10px] text-muted-foreground leading-tight">Points Generated</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Search bar */}
        <div className="border-b px-5 py-2.5 bg-background shrink-0">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter by attendee name, email, or event title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Content Table / Body */}
        <div className="flex-1 overflow-y-auto min-h-[220px]">
          {loading && (
            <div className="flex flex-col items-center justify-center space-y-2 py-16 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs">Loading attendees who redeemed this code...</p>
            </div>
          )}

          {!loading && filteredRedemptions.length === 0 && (
            <div className="flex flex-col items-center justify-center space-y-2 py-16 text-center text-muted-foreground">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted/60">
                <Ticket className="size-5 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground text-xs">
                {search ? `No redemptions matching "${search}"` : "No attendee redemptions recorded yet"}
              </p>
              <p className="max-w-xs text-[11px] text-muted-foreground">
                {search
                  ? "Try clearing or modifying your search filter."
                  : "When attendees enter this promoter's referral code during checkout, they will appear here."}
              </p>
            </div>
          )}

          {!loading && filteredRedemptions.length > 0 && (
            <Table>
              <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-xs z-10">
                <TableRow className="hover:bg-transparent text-xs">
                  <TableHead className="text-xs">Attendee (Referee)</TableHead>
                  <TableHead className="text-xs">Event</TableHead>
                  <TableHead className="text-xs">Ticket Tier</TableHead>
                  <TableHead className="text-center text-xs">Discount</TableHead>
                  <TableHead className="text-right text-xs">Points</TableHead>
                  <TableHead className="text-right text-xs">Redeemed Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRedemptions.map((redemption) => {
                  let formattedDate = "-";
                  try {
                    formattedDate = format(parseISO(redemption.created_at), "dd MMM yyyy, HH:mm");
                  } catch {
                    formattedDate = redemption.created_at || "-";
                  }

                  const discountText =
                    redemption.discount_amount && redemption.discount_amount > 0
                      ? `Rp ${redemption.discount_amount.toLocaleString("id-ID")}`
                      : `${redemption.discount_percentage || 10}%`;

                  return (
                    <TableRow key={redemption.id} className="text-xs hover:bg-muted/40">
                      {/* Attendee Info */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7">
                            <AvatarFallback className="text-[10px] font-semibold">
                              {(redemption.referee_name || "A")
                                .split(" ")
                                .slice(0, 2)
                                .map((w) => w[0]?.toUpperCase())
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-xs leading-none truncate max-w-[180px] sm:max-w-xs md:max-w-sm">
                              {redemption.referee_name || "Community Member"}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground leading-none truncate max-w-[180px] sm:max-w-xs md:max-w-sm">
                              {redemption.referee_email}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Event Title */}
                      <TableCell>
                        <p
                          className="font-medium text-foreground text-xs max-w-[180px] sm:max-w-xs md:max-w-sm truncate"
                          title={redemption.event_title}
                        >
                          {redemption.event_title}
                        </p>
                      </TableCell>

                      {/* Ticket Tier */}
                      <TableCell>
                        {redemption.ticket_name ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground text-xs">{redemption.ticket_name}</span>
                            {redemption.ticket_price !== undefined && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {redemption.ticket_price === 0
                                  ? "Free"
                                  : `Rp ${redemption.ticket_price.toLocaleString("id-ID")}`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">General Pass</span>
                        )}
                      </TableCell>

                      {/* Discount Applied */}
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                        >
                          {discountText} OFF
                        </Badge>
                      </TableCell>

                      {/* Points Awarded */}
                      <TableCell className="text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        +{redemption.points_awarded || 10} pts
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-right text-[11px] text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-5 py-2.5 bg-muted/20 text-xs text-muted-foreground shrink-0">
          <span>
            Showing <strong>{filteredRedemptions.length}</strong> of <strong>{redemptions.length}</strong> redemptions
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
