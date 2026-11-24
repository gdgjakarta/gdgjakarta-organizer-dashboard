"use client";

import Link from "next/link";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Switch } from "@/components/ui/switch";
import type { EventAnalyticsPayload } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

import { formatCompactNumber, KpiTile } from "./shared-kpi";

const chartConfig = {
  attendees: {
    label: "Registrations",
    color: "var(--chart-2)",
  },
  checkedIn: {
    label: "Checked In",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function EventsTab({
  data,
  includeTest,
  onToggleIncludeTest,
  isExpanded,
}: {
  data: EventAnalyticsPayload;
  includeTest: boolean;
  onToggleIncludeTest: (val: boolean) => void;
  isExpanded: boolean;
}) {
  const hasEventActivity = data.series.some((s) => s.attendees > 0 || s.events > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          Check-in &amp; no-show rates computed across{" "}
          <strong className="text-foreground tabular-nums">{data.kpis.pastEventsCount}</strong> completed events.
        </span>

        <label
          htmlFor="include-test-events"
          className="flex cursor-pointer items-center gap-2 text-muted-foreground text-xs"
        >
          <Switch id="include-test-events" checked={includeTest} onCheckedChange={onToggleIncludeTest} />
          <span>Include test events</span>
        </label>
      </div>

      <div className={cn("grid gap-2.5", isExpanded ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        <KpiTile
          label="Events in Period"
          value={data.kpis.eventsCount.current.toLocaleString()}
          deltaPct={data.kpis.eventsCount.deltaPct}
          subtext={`Avg ${data.kpis.avgAttendeesPerEvent} attendees / event`}
          info="Published/completed chapter events starting within the selected period (excludes Draft & Canceled)."
        />
        <KpiTile
          label="Total Attendees"
          value={formatCompactNumber(data.kpis.totalAttendees.current)}
          deltaPct={data.kpis.totalAttendees.deltaPct}
          subtext={`${formatCompactNumber(data.kpis.totalCheckedIn.current)} checked in`}
          info="Total registered attendees across all events in this period."
        />
        <KpiTile
          label="Check-in Rate"
          value={`${data.kpis.checkInRatePct}%`}
          subtext={`${data.kpis.pastEventsCount} completed events`}
          info="Checked-in attendees ÷ registered attendees, calculated strictly across completed/past events."
        />
        <KpiTile
          label="No-Show Rate"
          value={`${data.kpis.noShowRatePct}%`}
          subtext="Across completed events"
          info="Percentage of registered attendees who did not check in across completed/past events (100% − Check-in Rate)."
        />
      </div>

      {/* Format split */}
      {data.formatSplit.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
          <span className="font-medium text-muted-foreground">Event Formats:</span>
          {data.formatSplit.map((f) => (
            <Badge key={f.key} variant="outline" className="gap-1 font-normal tabular-nums">
              <span>{f.label}</span>
              <span className="font-semibold text-foreground">
                {f.count} ({f.pct}%)
              </span>
            </Badge>
          ))}
        </div>
      ) : null}

      <div className={cn("grid gap-4", isExpanded ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1")}>
        <div className={cn("rounded-lg border bg-muted/20 p-3", isExpanded && "lg:col-span-7")}>
          <div className="mb-2 font-medium text-foreground text-xs">Registrations vs Check-ins by Event Date</div>
          {!hasEventActivity ? (
            <div className="flex h-44 items-center justify-center text-muted-foreground text-xs">
              No events scheduled in this period.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-44 w-full">
              <BarChart data={data.series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} width={40} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent className="[&_.justify-between]:gap-4" />} />
                <Bar dataKey="attendees" fill="var(--color-attendees)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="checkedIn" fill="var(--color-checkedIn)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        {data.topEvents.length > 0 ? (
          <div className={cn("rounded-lg border bg-muted/20 p-3", isExpanded && "lg:col-span-5")}>
            <div className="mb-2 font-medium text-foreground text-xs">Top Events in Period</div>
            <div className="space-y-2">
              {data.topEvents.slice(0, isExpanded ? 5 : 3).map((ev) => (
                <div key={ev.id} className="flex items-center justify-between gap-2 text-xs">
                  <Link
                    href={`/dashboard/events/${ev.id}`}
                    className="min-w-0 truncate font-medium text-foreground hover:underline"
                    title={ev.title}
                  >
                    {ev.title}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 tabular-nums">
                    <span className="text-muted-foreground">{ev.attendees.toLocaleString()}</span>
                    {ev.checkInRatePct !== null ? (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {ev.checkInRatePct}% in
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">
                        Upcoming
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
