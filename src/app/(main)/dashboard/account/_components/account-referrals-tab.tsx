"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import {
  ArrowUpRight,
  Check,
  Copy,
  Gift,
  HelpCircle,
  MessageCircle,
  Percent,
  Sparkles,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isExecutiveOrganizer } from "@/lib/auth-roles";
import { getMemberReferralHistoryAction } from "@/lib/firestore/actions";
import type { FirestoreMember, ReferralRedemption } from "@/lib/firestore/types";
import type { AuthOrganizer } from "@/stores/auth/auth-store";

interface AccountReferralsTabProps {
  user: AuthOrganizer;
  member: FirestoreMember | null;
}

export function AccountReferralsTab({ user, member }: AccountReferralsTabProps) {
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<ReferralRedemption[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const referralCode = member?.referral_code ?? "GDG7X9K";
  const points = member?.referral_points ?? 0;
  const referralsCount = member?.referrals_count ?? 0;
  const isOrganizer = isExecutiveOrganizer(user) || isExecutiveOrganizer(member?.role);

  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      if (!member?.id && !user.id) return;
      try {
        const data = await getMemberReferralHistoryAction(member?.id ?? user.id);
        if (isMounted) {
          setHistory(data);
        }
      } catch (err) {
        console.error("[AccountReferralsTab] Failed to load referral history:", err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    }
    void loadHistory();
    return () => {
      isMounted = false;
    };
  }, [member?.id, user.id]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success("Referral code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy referral code.");
    }
  };

  const shareText = `Join me at upcoming GDG Jakarta developer events! Use my referral code "${referralCode}" to get a discount on your event tickets: https://gdgjakarta.org`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="space-y-6">
      {/* Referral Code Hero Card */}
      <Card className="overflow-hidden border-none bg-gradient-to-r from-primary/10 via-card to-card shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary font-medium text-primary-foreground text-xs">
                  <Sparkles className="mr-1 size-3" />
                  Your Community Referral Code
                </Badge>
                {isOrganizer && (
                  <Badge variant="outline" className="text-xs">
                    Organizer Program
                  </Badge>
                )}
              </div>
              <h2 className="font-bold font-mono text-3xl text-foreground tracking-wider sm:text-4xl">
                {referralCode}
              </h2>
              <p className="max-w-xl text-muted-foreground text-xs sm:text-sm">
                Share this code with fellow developers and colleagues. When they use your code during event ticket
                registration, they get an instant discount and you earn points toward rewards!
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button onClick={handleCopyCode} className="gap-2 font-medium">
                {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                <span>{copied ? "Copied!" : "Copy Code"}</span>
              </Button>

              <Button variant="outline" asChild className="gap-2">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4 text-emerald-500" />
                  <span>Share on WhatsApp</span>
                </a>
              </Button>

              {isOrganizer && (
                <Button variant="secondary" asChild className="gap-1.5">
                  <Link href="/dashboard/referrals">
                    <span>Leaderboard</span>
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Stats Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-none shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="font-normal text-muted-foreground text-xs">Points Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-amber-500" />
              <span className="font-bold text-2xl text-foreground">{points}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Community reward points</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="font-normal text-muted-foreground text-xs">Successful Referees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <span className="font-bold text-2xl text-foreground">{referralsCount}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Developers invited</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="font-normal text-muted-foreground text-xs">Friend Discount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Percent className="size-5 text-emerald-500" />
              <span className="font-bold text-2xl text-foreground">10% OFF</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Applied on paid tickets</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="font-normal text-muted-foreground text-xs">Bonus per Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Gift className="size-5 text-indigo-500" />
              <span className="font-bold text-2xl text-foreground">+10 pts</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Per confirmed registration</p>
          </CardContent>
        </Card>
      </div>

      {/* Program Guide & How It Works */}
      <Card className="border-none shadow-xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base sm:text-lg">How the Referral Program Works</CardTitle>
              <CardDescription>Earn rewards while helping grow the GDG Jakarta developer community</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/30 p-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                1
              </div>
              <h4 className="font-semibold text-foreground text-sm">Share Your Code</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Give your referral code to friends, team members, or post on social media channels.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/30 p-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 font-bold text-emerald-600 text-sm dark:text-emerald-400">
                2
              </div>
              <h4 className="font-semibold text-foreground text-sm">Friends Get 10% Off</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Referees enter your code at checkout for eligible GDG Jakarta events to receive an instant 10% discount.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/30 p-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 font-bold text-amber-600 text-sm dark:text-amber-400">
                3
              </div>
              <h4 className="font-semibold text-foreground text-sm">Earn 10 Reward Points</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Once payment or registration is completed, 10 reward points are automatically credited to your account.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/30 p-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 font-bold text-indigo-600 text-sm dark:text-indigo-400">
                4
              </div>
              <h4 className="font-semibold text-foreground text-sm">Win Merchandise</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Top participants on the leaderboard win exclusive GDG Jakarta hoodies, t-shirts, and developer swag!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Redemption History */}
      <Card className="border-none shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">Referral Redemption History</CardTitle>
              <CardDescription>Track events where community members redeemed your referral code</CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              {history.length} {history.length === 1 ? "Redemption" : "Redemptions"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loadingHistory && (
            <div className="flex flex-col items-center justify-center space-y-2 py-8 text-muted-foreground">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-xs">Loading redemption history...</p>
            </div>
          )}

          {!loadingHistory && history.length === 0 && (
            <div className="flex flex-col items-center justify-center space-y-3 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                <Ticket className="size-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground text-sm">No Redemptions Yet</h4>
                <p className="max-w-sm text-muted-foreground text-xs">
                  Share your referral code <span className="font-medium font-mono text-foreground">{referralCode}</span>{" "}
                  with friends attending upcoming GDG Jakarta events to start earning points.
                </p>
              </div>
              <Button size="sm" onClick={handleCopyCode} className="gap-1.5 text-xs">
                <Copy className="size-3.5" />
                <span>Copy My Referral Code</span>
              </Button>
            </div>
          )}

          {!loadingHistory && history.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="pb-3 font-medium">Attendee</th>
                    <th className="pb-3 font-medium">Event</th>
                    <th className="pb-3 font-medium">Discount Given</th>
                    <th className="pb-3 text-right font-medium">Points Earned</th>
                    <th className="pb-3 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="py-3 font-medium text-foreground">{item.referee_name || "Community Member"}</td>
                      <td className="py-3 text-muted-foreground text-xs">{item.event_title}</td>
                      <td className="py-3 text-xs">
                        <Badge
                          variant="outline"
                          className="border-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400"
                        >
                          {item.discount_percentage
                            ? `${item.discount_percentage}% OFF`
                            : `Rp ${item.discount_amount?.toLocaleString()}`}
                        </Badge>
                      </td>
                      <td className="py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                        +{item.points_awarded ?? 10} pts
                      </td>
                      <td className="py-3 text-right text-muted-foreground text-xs">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
