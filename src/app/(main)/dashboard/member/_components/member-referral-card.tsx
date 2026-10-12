"use client";

import { useEffect, useState } from "react";

import { Check, Copy, Gift, HelpCircle, Share2, Sparkles, Trophy, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getMemberReferralDataAction } from "@/lib/firestore/actions";
import { generateUserReferralCode } from "@/lib/firestore/client";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface MemberReferralInfo {
  code: string;
  points: number;
  count: number;
  hasUsedReferral: boolean;
  discountType?: "percentage" | "fixed";
  discountPercentage: number;
  discountAmount?: number;
  pointsPerReferral: number;
  referredByCode?: string;
}

export function MemberReferralCard() {
  const user = useAuthStore((s) => s.user);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [info, setInfo] = useState<MemberReferralInfo | null>(null);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!user?.id) {
        setInfo(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setInfo(null);
      try {
        const data = await getMemberReferralDataAction(user.id, user.email, user.name);
        if (isMounted && data) {
          setInfo(data);
        }
      } catch (err) {
        console.error("[MemberReferralCard] Failed to load referral data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.email, user?.name]);

  if (!user) return null;

  const currentUserId = user.id;
  const immediateCode = currentUserId ? generateUserReferralCode(currentUserId) : "";
  const referralCode = info?.code && info.code !== "GDG7X9K" ? info.code : immediateCode || "GENERATING...";
  const discountPercent = info?.discountPercentage ?? 10;
  const isFixed = info?.discountType === "fixed";
  const discountLabel = isFixed
    ? `Rp ${(info?.discountAmount ?? 25000).toLocaleString("id-ID")}`
    : `${discountPercent}%`;
  const pointsPerRef = info?.pointsPerReferral ?? 10;
  const points = info?.points ?? 0;
  const referralsCount = info?.count ?? 0;
  const hasUsed = info?.hasUsedReferral ?? false;

  const handleCopyCode = async () => {
    const codeToCopy = referralCode !== "GENERATING..." ? referralCode : null;
    if (!codeToCopy) return;
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopiedCode(true);
      toast.success(`Referral code ${codeToCopy} copied to clipboard!`);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Failed to copy code.");
    }
  };

  const handleShareLink = async () => {
    const codeToShare = referralCode !== "GENERATING..." ? referralCode : null;
    if (!codeToShare) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${origin}/events?ref=${encodeURIComponent(codeToShare)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join GDG Jakarta Events with my Referral Code!",
          text: `Use my referral code ${codeToShare} to get ${discountLabel} off your GDG Jakarta ticket!`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      toast.success("Referral invitation link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Failed to copy share link.");
    }
  };

  return (
    <Card className="relative mb-6 overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-xs">
      {/* Decorative gradient glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-primary/10 blur-3xl" />

      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Gift className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Community Referral Program</CardTitle>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[11px]">
                  <Sparkles className="mr-1 size-3" />
                  Exclusive Merch Prize
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Invite fellow developers to GDG Jakarta events. Top referrer wins official merchandise!
              </CardDescription>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="size-3.5" />
                How it works
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="size-5 text-amber-500" />
                  How Referral Program Works
                </DialogTitle>
                <DialogDescription>
                  Earn points, give discounts, and compete for exclusive GDG Jakarta merchandise.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5 py-2 text-sm">
                <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-xs">Share Your Code</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Copy your personal code or share link with your colleagues, classmates, and tech communities.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-xs">They Get a Ticket Discount</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      When your friend books a ticket using your code, they receive up to{" "}
                      <span className="font-semibold text-foreground">{discountLabel} discount</span> on their ticket!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-xs">You Earn Points &amp; Climb the Leaderboard</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      You receive <span className="font-semibold text-foreground">+{pointsPerRef} points</span> for each
                      successful ticket booking. Only 1 referral code can be redeemed per account.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-700 text-xs dark:text-amber-300">
                    🏆
                  </div>
                  <div>
                    <p className="font-medium text-amber-900 text-xs dark:text-amber-200">
                      Grand Prize: Official Merch Pack
                    </p>
                    <p className="text-amber-800/80 text-xs leading-relaxed dark:text-amber-300/80">
                      The member with the highest points at the end of the season will receive an exclusive GDG Jakarta
                      Merchandise bundle shipped directly from us!
                    </p>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Code Display & Action Buttons */}
          <div className="space-y-3 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Your Referral Code:</span>
              <div className="flex items-center gap-1.5 rounded-lg border bg-muted/60 px-3 py-1 font-mono font-bold text-sm tracking-wider">
                {referralCode}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                disabled={!referralCode || referralCode === "GENERATING..."}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {copiedCode ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                {copiedCode ? "Copied" : "Copy Code"}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleShareLink}
                disabled={!referralCode || referralCode === "GENERATING..."}
                className="h-8 gap-1.5 text-xs font-medium shadow-xs"
              >
                {copiedLink ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
                {copiedLink ? "Link Copied" : "Share Link"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Give your friends <span className="font-semibold text-foreground">{discountPercent}% OFF</span> event
              tickets. Each booking awards you{" "}
              <span className="font-semibold text-foreground">{pointsPerRef} points</span> toward the GDG Merch Prize.
            </p>
          </div>

          {/* Right Column: Stats & Status Badge */}
          <div className="flex flex-wrap items-center gap-3 lg:col-span-5 lg:justify-end">
            <div className="flex items-center gap-2 rounded-xl border bg-background/80 px-3.5 py-2 shadow-2xs">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Trophy className="size-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Points</p>
                <p className="text-base font-bold leading-none text-foreground">
                  {points} <span className="text-xs font-normal text-muted-foreground">pts</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border bg-background/80 px-3.5 py-2 shadow-2xs">
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Users className="size-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Friends Referred</p>
                <p className="text-base font-bold leading-none text-foreground">
                  {referralsCount} <span className="text-xs font-normal text-muted-foreground">tickets</span>
                </p>
              </div>
            </div>

            {hasUsed ? (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px]"
              >
                <Check className="mr-1 size-3" />
                Referral Discount Redeemed
              </Badge>
            ) : (
              <Badge variant="outline" className="border-muted text-muted-foreground text-[11px]">
                1x Referral Discount Available
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
