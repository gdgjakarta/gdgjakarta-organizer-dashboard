"use client";

import { AlertTriangle } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { MemberAnalyticsPayload } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

import { formatCompactNumber, KpiTile } from "./shared-kpi";

const chartConfig = {
  current: {
    label: "New Bevy joins",
    theme: {
      light: "oklch(0.55 0.19 250)",
      dark: "oklch(0.7 0.17 250)",
    },
  },
  previous: {
    label: "Previous period",
    theme: {
      light: "oklch(0.65 0.05 250)",
      dark: "oklch(0.65 0.05 250)",
    },
  },
} satisfies ChartConfig;

export function MembersTab({ data, isExpanded }: { data: MemberAnalyticsPayload; isExpanded: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
        <span>
          Total Chapter Members on Bevy:{" "}
          <strong className="text-foreground tabular-nums">{data.kpis.totalChapterMembers.toLocaleString()}</strong>
        </span>
        {data.partialWarning ? (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {data.partialWarning}
          </span>
        ) : null}
      </div>

      <div className={cn("grid gap-2.5", isExpanded ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        <KpiTile
          label="New Chapter Members"
          value={formatCompactNumber(data.kpis.newChapterMembers.current)}
          deltaPct={data.kpis.newChapterMembers.deltaPct}
          subtext={`vs ${formatCompactNumber(data.kpis.newChapterMembers.previous ?? 0)} prior`}
          info="New community members who joined GDG Jakarta on Bevy within the selected period."
        />
        <KpiTile
          label="Active Dashboard Users"
          value={formatCompactNumber(data.kpis.activeDashboardMembers.current)}
          deltaPct={data.kpis.activeDashboardMembers.deltaPct}
          subtext={`${data.kpis.activeDashboardPct}% of synced profiles`}
          info="Synced Firestore members with a last_active timestamp in the selected period."
        />
        <KpiTile
          label="Repeat Attendees"
          value={`${data.kpis.repeatAttendeesPct}%`}
          subtext="2+ events registered"
          info="Percentage of synced Firestore members who have registered for 2 or more events."
        />
        <KpiTile
          label="Verified & Synced"
          value={`${data.kpis.emailVerifiedPct}% / ${data.kpis.bevySyncedPct}%`}
          subtext={`${data.kpis.referralParticipationPct}% referral active`}
          info="Share of synced members with verified emails and linked Bevy user IDs, plus referral program participation."
        />
      </div>

      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-medium text-foreground text-xs">New Chapter Member Joins (Bevy)</span>
          <span className="text-[11px] text-muted-foreground">vs {data.range.prevLabel}</span>
        </div>
        {data.series.length === 0 ? (
          <div className="flex h-44 items-center justify-center text-muted-foreground text-xs">
            No member join records in this period.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-44 w-full">
            <LineChart data={data.series} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} width={40} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent className="[&_.justify-between]:gap-4" />} />
              <Line type="monotone" dataKey="current" stroke="var(--color-current)" strokeWidth={2} dot={false} />
              <Line
                type="monotone"
                dataKey="previous"
                stroke="var(--color-previous)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
