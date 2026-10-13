"use client";

import { useEffect, useState } from "react";

import { Crown, Gift, Sparkles, Ticket, Trophy, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReferralLeaderboardAction, getReferralProgramSettingsAction } from "@/lib/firestore/actions";
import type { ReferralLeaderboardEntry, ReferralProgramSettings } from "@/lib/firestore/types";

import { ReferralLeaderboardSkeleton } from "../loading";
import { ReferralExcludedMembersDialog } from "./referral-excluded-members-dialog";
import { ReferralExport } from "./referral-export";
import { ReferralPodium } from "./referral-podium";
import { ReferralResetAllDialog } from "./referral-reset-all-dialog";
import { ReferralSettingsDialog } from "./referral-settings-dialog";
import { ReferralTable } from "./referral-table";

interface ReferralLeaderboardViewProps {
  initialEntries?: ReferralLeaderboardEntry[];
  initialSettings?: ReferralProgramSettings | null;
}

export function ReferralLeaderboardView({ initialEntries, initialSettings }: ReferralLeaderboardViewProps) {
  const [entries, setEntries] = useState<ReferralLeaderboardEntry[]>(initialEntries ?? []);
  const [settings, setSettings] = useState<ReferralProgramSettings | null>(initialSettings ?? null);
  const [loading, setLoading] = useState<boolean>(!initialEntries);

  const refreshData = async () => {
    try {
      const [loadedEntries, loadedSettings] = await Promise.all([
        getReferralLeaderboardAction(200),
        getReferralProgramSettingsAction(),
      ]);
      setEntries(loadedEntries);
      if (loadedSettings) {
        setSettings(loadedSettings);
      }
    } catch (err) {
      console.error("[ReferralLeaderboardView] Failed to refresh referral data:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [loadedEntries, loadedSettings] = await Promise.all([
          getReferralLeaderboardAction(200),
          getReferralProgramSettingsAction(),
        ]);
        if (isMounted) {
          setEntries(loadedEntries);
          if (loadedSettings) {
            setSettings(loadedSettings);
          }
        }
      } catch (err) {
        console.error("[ReferralLeaderboardView] Failed to load referral data:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (!initialEntries) {
      void loadData();
    }
    return () => {
      isMounted = false;
    };
  }, [initialEntries]);

  if (loading) {
    return <ReferralLeaderboardSkeleton />;
  }

  const totalPoints = entries.reduce((acc, curr) => acc + (curr.referral_points || 0), 0);
  const totalReferrals = entries.reduce((acc, curr) => acc + (curr.referrals_count || 0), 0);
  const activeReferrersCount = entries.filter(
    (e) => (e.referral_points || 0) > 0 || (e.referrals_count || 0) > 0,
  ).length;
  const topLeader = entries.length > 0 && entries[0].referral_points > 0 ? entries[0] : null;

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6 lg:p-8">
      {/* Header with Title & Action Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Referral Leaderboard</h1>
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 text-amber-700 text-xs dark:text-amber-300"
            >
              <Trophy className="mr-1 size-3" />
              Community Program
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Monitor community promoter rankings, ticket conversions, and reward the top referrer with official GDG
            merchandise.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ReferralExcludedMembersDialog
            onExclusionsChanged={refreshData}
            autoExcludeOrganizers={settings?.auto_exclude_organizers}
          />
          <ReferralSettingsDialog
            initialSettings={settings}
            onSettingsUpdated={(updatedSettings) => {
              setSettings(updatedSettings);
              void refreshData();
            }}
          />
          <ReferralResetAllDialog
            totalActiveReferrers={activeReferrersCount}
            totalPoints={totalPoints}
            onResetCompleted={refreshData}
          />
          <ReferralExport entries={entries} />
        </div>
      </div>

      {/* Program Announcement Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-background to-primary/5 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-amber-950 shadow-xs">
              <Gift className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground text-sm">
                  Season Grand Prize: {settings?.merch_prize_description || "Exclusive GDG Jakarta Merchandise"}
                </p>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {settings?.default_discount_type === "fixed"
                    ? `Rp ${(settings?.default_discount_amount ?? 25000).toLocaleString("id-ID")}`
                    : `${settings?.default_discount_percentage ?? 10}%`}{" "}
                  Attendee Discount
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                Attendees applying referral codes receive{" "}
                {settings?.default_discount_type === "fixed"
                  ? `Rp ${(settings?.default_discount_amount ?? 25000).toLocaleString("id-ID")}`
                  : `${settings?.default_discount_percentage ?? 10}%`}{" "}
                off their ticket. Referrers gain +{settings?.points_per_referral ?? 10} points per ticket. The highest
                scorer wins the official merchandise pack!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Points Awarded
            </CardTitle>
            <Trophy className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPoints.toLocaleString("id-ID")}</div>
            <p className="text-[11px] text-muted-foreground">Across all community members</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tickets Referred
            </CardTitle>
            <Ticket className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals.toLocaleString("id-ID")}</div>
            <p className="text-[11px] text-muted-foreground">Successful event registrations</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Referrers
            </CardTitle>
            <Users className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeReferrersCount}</div>
            <p className="text-[11px] text-muted-foreground">Promoters with points earned</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Current Top Scorer
            </CardTitle>
            <Crown className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="line-clamp-1 text-base font-bold sm:text-lg">{topLeader ? topLeader.name : "None yet"}</div>
            <p className="text-[11px] text-muted-foreground">
              {topLeader
                ? `${topLeader.referral_points} pts • ${topLeader.referrals_count} tickets`
                : "Awaiting first bookings"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top 3 Podium */}
      {entries.length > 0 && entries[0].referral_points > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            <h3 className="font-semibold text-sm">Top 3 Leaderboard Podium</h3>
          </div>
          <ReferralPodium entries={entries} merchPrizeDescription={settings?.merch_prize_description} />
        </div>
      )}

      {/* Ranked Table */}
      <ReferralTable entries={entries} onDataMutated={refreshData} />
    </div>
  );
}
