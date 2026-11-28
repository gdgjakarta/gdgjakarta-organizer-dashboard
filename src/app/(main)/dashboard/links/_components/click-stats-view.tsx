"use client";

import * as React from "react";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClickStreamEntry, ShortlinkProviderName, StatsPeriod } from "@/lib/shortio/types";
import type { ExtendedClickStats } from "@/lib/shortlinks/analytics";

import type { ActionResult } from "./action-result";
import { ClickstreamTable } from "./clickstream-table";

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  today: "Today",
  last7: "Last 7 days",
  last30: "Last 30 days",
  week: "This week",
  month: "This month",
  total: "All time",
};

const chartConfig = { clicks: { label: "Clicks", color: "var(--chart-1)" } } satisfies ChartConfig;

function Breakdown({ title, rows }: { title: string; rows: { label: string; score: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.score));
  return (
    <Card className="p-4">
      <CardHeader className="p-0 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 p-0">
        {rows.length === 0 && <p className="text-muted-foreground text-xs">No data yet</p>}
        {rows.slice(0, 6).map((r) => (
          <div key={r.label} className="grid gap-1">
            <div className="flex justify-between text-xs">
              <span className="truncate">{r.label || "Direct / unknown"}</span>
              <span className="font-medium tabular-nums">{r.score}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.score / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface ClickStatsViewProps {
  load: (period: StatsPeriod) => Promise<ActionResult<ExtendedClickStats>>;
  loadClickstream?: () => Promise<ActionResult<ClickStreamEntry[]>>;
  provider?: ShortlinkProviderName;
  showSlugInClickstream?: boolean;
}

/** Period picker + KPI + clicks chart + breakdowns + split variants + clickstream. */
export function ClickStatsView({
  load,
  loadClickstream,
  provider = "shortio",
  showSlugInClickstream = false,
}: ClickStatsViewProps) {
  const [period, setPeriod] = React.useState<StatsPeriod>("last30");
  const [stats, setStats] = React.useState<ExtendedClickStats | null>(null);
  const [clickstream, setClickstream] = React.useState<ClickStreamEntry[]>([]);
  const [isRefreshingStream, setIsRefreshingStream] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load(period)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setStats(res.data);
          setClickstream(res.data.clickstream ?? []);
        } else {
          setError(res.error ?? "Failed to load analytics");
        }
      })
      .catch(() => !cancelled && setError("Failed to load analytics"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [load, period]);

  const handleRefreshClickstream = React.useCallback(async () => {
    if (!loadClickstream) return;
    setIsRefreshingStream(true);
    try {
      const res = await loadClickstream();
      if (res.success && res.data) {
        setClickstream(res.data);
      } else {
        toast.error(res.error ?? "Failed to refresh clickstream");
      }
    } catch {
      toast.error("Failed to refresh clickstream");
    } finally {
      setIsRefreshingStream(false);
    }
  }, [loadClickstream]);

  const series = (stats?.clickStatistics?.datasets?.[0]?.data ?? []).map((p) => ({
    date: new Date(p.x).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    clicks: Number(p.y),
  }));
  const total = stats?.totalClicks ?? stats?.clicks ?? 0;
  const legacyClicks = stats?.legacyClicks ?? 0;
  const splitVariants = stats?.splitVariants ?? [];

  return (
    <div className="grid gap-4">
      <Select value={period} onValueChange={(v) => setPeriod(v as StatsPeriod)}>
        <SelectTrigger className="w-44" aria-label="Period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PERIOD_LABELS).map(([k, label]) => (
            <SelectItem key={k} value={k}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {loading && !stats && <Skeleton className="h-60 w-full" />}
      {stats && (
        <div className={loading ? "grid gap-4 opacity-60" : "grid gap-4"}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <p className="text-muted-foreground text-xs">Total clicks</p>
              <p className="font-bold text-2xl tabular-nums">{total.toLocaleString()}</p>
              {period === "total" && legacyClicks > 0 && (
                <p className="mt-1 text-muted-foreground text-xs">
                  Includes {legacyClicks.toLocaleString()} legacy Short.io clicks
                </p>
              )}
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs">Human clicks</p>
              <p className="font-bold text-2xl tabular-nums">{(stats.humanClicks ?? 0).toLocaleString()}</p>
            </Card>
          </div>

          <Card className="p-4">
            <CardTitle className="pb-2 text-sm">Clicks over time</CardTitle>
            {series.length === 0 ? (
              <p className="text-muted-foreground text-xs">No clicks in this period</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-48 w-full">
                <BarChart data={series}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="clicks" fill="var(--color-clicks)" radius={3} />
                </BarChart>
              </ChartContainer>
            )}
          </Card>

          {splitVariants.length > 0 && (
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-sm">A/B Split Test Variants</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-0">
                {splitVariants.map((variant) => (
                  <div key={variant.variantLabel} className="grid gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          {variant.variantLabel}
                        </Badge>
                        {variant.targetUrl && (
                          <span
                            className="truncate font-mono text-[11px] text-muted-foreground"
                            title={variant.targetUrl}
                          >
                            {variant.targetUrl}
                          </span>
                        )}
                      </div>
                      <span className="font-medium tabular-nums">
                        {variant.clicks.toLocaleString()} clicks ({variant.humanClicks.toLocaleString()} human) ·{" "}
                        {variant.percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, variant.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Breakdown
              title="Countries"
              rows={(stats.country ?? []).map((r) => ({ label: r.countryName ?? r.country, score: r.score }))}
            />
            <Breakdown
              title="Cities"
              rows={(stats.cities ?? []).map((c) => ({
                label: c.country ? `${c.city}, ${c.country}` : c.city,
                score: c.score,
              }))}
            />
            <Breakdown title="Devices" rows={(stats.device ?? []).map((r) => ({ label: r.device, score: r.score }))} />
            <Breakdown
              title="Operating systems"
              rows={(stats.os ?? []).map((r) => ({ label: r.os, score: r.score }))}
            />
            <Breakdown
              title="Browsers"
              rows={(stats.browser ?? []).map((r) => ({ label: r.browser, score: r.score }))}
            />
            <Breakdown
              title="Referrers"
              rows={(stats.referer ?? []).map((r) => ({ label: r.referer, score: r.score }))}
            />
          </div>

          <ClickstreamTable
            entries={clickstream}
            provider={provider}
            showSlug={showSlugInClickstream}
            onRefresh={loadClickstream ? handleRefreshClickstream : undefined}
            isRefreshing={isRefreshingStream}
          />
        </div>
      )}
    </div>
  );
}
