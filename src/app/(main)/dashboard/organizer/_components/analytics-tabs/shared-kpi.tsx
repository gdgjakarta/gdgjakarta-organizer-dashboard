"use client";

import { Info, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return value.toLocaleString("en-US");
}

export function formatHumanDate(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(Date.UTC(y, m - 1, d)));
  }
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return dateStr;
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dt);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
  return `${datePart} · ${timePart} WIB`;
}

export function formatIdr(value: number): string {
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "")}B`;
  }
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function DeltaBadge({ deltaPct }: { deltaPct: number | null | undefined }) {
  if (deltaPct === null || deltaPct === undefined) return null;
  const isPositive = deltaPct > 0;
  const isNegative = deltaPct < 0;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-0.5 px-1.5 py-0 font-medium text-[10px] tabular-nums",
        isPositive && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        isNegative && "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        !isPositive && !isNegative && "text-muted-foreground",
      )}
    >
      {isPositive && <TrendingUp className="size-2.5" aria-hidden="true" />}
      {isNegative && <TrendingDown className="size-2.5" aria-hidden="true" />}
      {isPositive ? `+${deltaPct}%` : `${deltaPct}%`}
    </Badge>
  );
}

export function MetricInfoPopup({ title, description }: { title: string; description: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`About ${title}`}
        >
          <Info className="size-3" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-1 p-3 text-xs">
        <div className="font-semibold text-foreground">{title}</div>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </PopoverContent>
    </Popover>
  );
}

export function KpiTile({
  label,
  value,
  deltaPct,
  subtext,
  info,
  title,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  subtext?: string;
  info?: string;
  title?: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-2.5 rounded-lg border bg-muted/30 p-3.5" title={title}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate font-medium text-[11px] text-muted-foreground">{label}</span>
          {info ? <MetricInfoPopup title={label} description={info} /> : null}
        </div>
        <DeltaBadge deltaPct={deltaPct} />
      </div>
      <div className="font-bold text-foreground text-xl tabular-nums leading-none tracking-tight">{value}</div>
      {subtext ? <div className="truncate text-[11px] text-muted-foreground tabular-nums">{subtext}</div> : null}
    </div>
  );
}
