"use client";

import { AlertCircle, KeyRound } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { WebsiteAnalyticsPayload, WebsiteProviderId } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

import { WorldChoroplethMap } from "../world-choropleth-map";
import { formatCompactNumber, KpiTile } from "./shared-kpi";

const chartConfig = {
  current: {
    label: "Page views",
    theme: {
      light: "oklch(0.49 0.22 264)",
      dark: "oklch(0.68 0.19 264)",
    },
  },
  previous: {
    label: "Previous period",
    theme: {
      light: "oklch(0.65 0.12 195)",
      dark: "oklch(0.72 0.12 195)",
    },
  },
} satisfies ChartConfig;

export function WebsiteTab({
  data,
  isExpanded,
  onSelectProvider,
}: {
  data: WebsiteAnalyticsPayload;
  isExpanded: boolean;
  onSelectProvider: (provider: WebsiteProviderId) => void;
}) {
  if (!data.configured) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <KpiTile
            label="Logged-in Dashboard Users"
            value={formatCompactNumber(data.loggedInDashboardUsers.current)}
            deltaPct={data.loggedInDashboardUsers.deltaPct}
            subtext="Active in Firestore members"
          />
          <div className="flex flex-col justify-center rounded-lg border border-dashed bg-muted/20 p-3 text-muted-foreground text-xs">
            <span className="font-medium text-foreground">External Web Traffic</span>
            <span>Connect GA4 or Cloudflare API token to view Page Views & Country Map.</span>
          </div>
        </div>

        <Alert>
          <KeyRound className="size-4" />
          <AlertTitle className="font-semibold text-xs">Website Analytics Setup Required</AlertTitle>
          <AlertDescription className="space-y-1.5 text-xs">
            <p>
              Add either provider as server-side secrets (local <code>.env.local</code> or{" "}
              <code>wrangler secret put</code>):
            </p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                <strong>Cloudflare Web Analytics</strong> (beacon already live): set <code>CLOUDFLARE_API_TOKEN</code>{" "}
                (Account Analytics: Read).
              </li>
              <li>
                <strong>Firebase / GA4 Data API</strong> (<code>G-YK2P07NQHZ</code>): set <code>GA4_PROPERTY_ID</code>{" "}
                &amp; <code>GA4_SERVICE_ACCOUNT_JSON</code>.
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isGa4 = data.activeProvider === "ga4";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Badge variant="outline" className="text-[10px]">
            Source: {isGa4 ? "Firebase / GA4" : "Cloudflare Web Analytics"}
          </Badge>
          {data.range.cached ? <span className="text-[11px]">Cached</span> : null}
        </div>

        {data.availableProviders.length > 1 ? (
          <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5 text-[11px]">
            {data.availableProviders.map((prov) => (
              <button
                key={prov}
                type="button"
                onClick={() => onSelectProvider(prov)}
                className={cn(
                  "rounded-sm px-2 py-0.5 font-medium transition-colors",
                  data.activeProvider === prov
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {prov === "ga4" ? "GA4" : "Cloudflare"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {data.error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle className="font-semibold text-xs">Provider Error</AlertTitle>
          <AlertDescription className="text-xs">{data.error}</AlertDescription>
        </Alert>
      ) : null}

      {/* KPI Strip: 6 tiles for GA4 (matches screenshot), 4 tiles for Cloudflare (zero hallucination) */}
      <div
        className={cn(
          "grid gap-2.5",
          isExpanded
            ? isGa4
              ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
              : "grid-cols-2 sm:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-3",
        )}
      >
        <KpiTile
          label="Page Views"
          value={formatCompactNumber(data.kpis.pageViews.current)}
          deltaPct={data.kpis.pageViews.deltaPct}
          subtext={`vs ${formatCompactNumber(data.kpis.pageViews.previous ?? 0)}`}
          info="Total web page loads recorded across gdgjakarta.com in the selected period."
        />
        {isGa4 && data.kpis.totalUsers ? (
          <KpiTile
            label="Total Users"
            value={formatCompactNumber(data.kpis.totalUsers.current)}
            deltaPct={data.kpis.totalUsers.deltaPct}
            subtext={`vs ${formatCompactNumber(data.kpis.totalUsers.previous ?? 0)}`}
            info="Distinct visitors who logged at least one session or event in Google Analytics 4."
          />
        ) : null}
        {isGa4 && data.kpis.newUsers ? (
          <KpiTile
            label="New Users"
            value={formatCompactNumber(data.kpis.newUsers.current)}
            deltaPct={data.kpis.newUsers.deltaPct}
            subtext={`vs ${formatCompactNumber(data.kpis.newUsers.previous ?? 0)}`}
            info="First-time visitors who had no prior GA4 client session."
          />
        ) : null}
        <KpiTile
          label="Logged-in Users"
          value={formatCompactNumber(data.loggedInDashboardUsers.current)}
          deltaPct={data.loggedInDashboardUsers.deltaPct}
          subtext="Firestore active"
          info="Authenticated members with a last_active timestamp in Firestore during this period."
        />
        <KpiTile
          label={isGa4 ? "Total Sessions" : "Total Visits"}
          value={formatCompactNumber(data.kpis.totalSessions.current)}
          deltaPct={data.kpis.totalSessions.deltaPct}
          subtext={data.kpis.pagesPerVisit !== null ? `${data.kpis.pagesPerVisit} pages / visit` : undefined}
          info={
            isGa4
              ? "Total browsing sessions initiated on gdgjakarta.com."
              : "Unique page-load visits tracked by Cloudflare Web Analytics (cookie-less)."
          }
        />
        {isGa4 && data.kpis.engagedSessions ? (
          <KpiTile
            label="Engaged Sessions"
            value={formatCompactNumber(data.kpis.engagedSessions.current)}
            deltaPct={data.kpis.engagedSessions.deltaPct}
            subtext={data.kpis.engagementRatePct !== null ? `${data.kpis.engagementRatePct}% engagement` : undefined}
            info="GA4 sessions lasting >10 seconds, having 2+ page views, or triggering a conversion event."
          />
        ) : null}
      </div>

      {/* Chart + Interactive World Choropleth Map (side-by-side when expanded) */}
      <div className={cn("grid gap-4", isExpanded ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1")}>
        <div className={cn("rounded-lg border bg-muted/20 p-3", isExpanded && "lg:col-span-6")}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium text-foreground text-xs">Page Views Trend</span>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-indigo-600 dark:bg-indigo-400" />
                {data.range.label}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 border-cyan-600 border-t-2 border-dashed dark:border-cyan-400" />
                {data.range.prevLabel}
              </span>
            </div>
          </div>

          {data.series.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground text-xs">
              No daily traffic data in this period.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className={cn("w-full", isExpanded ? "h-64" : "h-48")}>
              <LineChart data={data.series} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent className="[&_.justify-between]:gap-4" />} />
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="var(--color-current)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="previous"
                  stroke="var(--color-previous)"
                  strokeWidth={1.75}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        </div>

        <div className={cn(isExpanded && "lg:col-span-6")}>
          <WorldChoroplethMap
            countries={data.countries}
            primaryMetricLabel={isGa4 ? "Users" : "Visits"}
            isExpanded={isExpanded}
          />
        </div>
      </div>

      {/* Cloudflare-exclusive real breakdowns when active */}
      {!isGa4 && (data.topPaths?.length || data.topReferrers?.length) ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.topPaths && data.topPaths.length > 0 ? (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 font-medium text-foreground text-xs">Top Pages</div>
              <div className="space-y-1.5">
                {data.topPaths.slice(0, 5).map((p) => (
                  <div key={p.path} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-mono text-[11px] text-foreground">{p.path}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{p.pageViews.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {data.topReferrers && data.topReferrers.length > 0 ? (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 font-medium text-foreground text-xs">Top Referrers</div>
              <div className="space-y-1.5">
                {data.topReferrers.slice(0, 5).map((r) => (
                  <div key={r.host} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground">{r.host}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{r.visits.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
