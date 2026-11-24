"use client";

import { Database } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { TicketAnalyticsPayload } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

import { formatCompactNumber, formatIdr, KpiTile } from "./shared-kpi";

const chartConfig = {
  current: {
    label: "Tickets",
    theme: {
      light: "oklch(0.55 0.18 155)",
      dark: "oklch(0.7 0.17 155)",
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

export function TicketsTab({ data, isExpanded }: { data: TicketAnalyticsPayload; isExpanded: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Database className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>Combined event registrations &amp; on-the-spot merchandise sales</span>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums">
          <Badge variant="outline" className="text-[10px]">
            {data.kpis.paidTickets.current.toLocaleString()} paid tickets
          </Badge>
          {data.kpis.merchOrdersPaidCount > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {data.kpis.merchOrdersPaidCount.toLocaleString()} merch orders
            </Badge>
          ) : null}
        </div>
      </div>

      <div className={cn("grid gap-2.5", isExpanded ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        <KpiTile
          label="Tickets Issued"
          value={formatCompactNumber(data.kpis.totalTickets.current)}
          deltaPct={data.kpis.totalTickets.deltaPct}
          subtext={`${data.kpis.paidTickets.current.toLocaleString()} paid`}
          info="Total event registrations created in Firestore during the selected period."
        />
        <KpiTile
          label="Paid Conversion"
          value={`${data.kpis.paidConversionPct}%`}
          deltaPct={data.kpis.paidTickets.deltaPct}
          subtext="Paid / total tickets"
          info="Percentage of total ticket registrations that completed payment."
        />
        <KpiTile
          label="Gross Paid Revenue"
          value={formatIdr(data.kpis.grossPaidRevenueIdr.current)}
          deltaPct={data.kpis.grossPaidRevenueIdr.deltaPct}
          subtext={`Tickets ${formatIdr(data.kpis.ticketRevenueIdr)} + Merch ${formatIdr(data.kpis.merchOrderRevenueIdr)}`}
          info="Combined gross IDR revenue from paid event tickets/bundles and paid on-the-spot merchandise orders (before refunds)."
        />
        <KpiTile
          label="Voucher & Referral Use"
          value={`${data.kpis.voucherAdoptionPct}% / ${data.kpis.referralAdoptionPct}%`}
          subtext={
            data.kpis.totalDiscountIdr > 0 ? `${formatIdr(data.kpis.totalDiscountIdr)} discounted` : "No discounts"
          }
          info="Share of registrations using a promo voucher code vs. a community referral code, plus total discount value."
        />
      </div>

      <div className={cn("grid gap-4", isExpanded ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1")}>
        <div className={cn("rounded-lg border bg-muted/20 p-3", isExpanded && "lg:col-span-7")}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium text-foreground text-xs">Daily Ticket Registrations</span>
            <span className="text-[11px] text-muted-foreground">vs {data.range.prevLabel}</span>
          </div>
          {data.series.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-muted-foreground text-xs">
              No registrations in this period.
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

        <div className={cn("space-y-3 rounded-lg border bg-muted/20 p-3", isExpanded && "lg:col-span-5")}>
          <div>
            <div className="mb-2 font-medium text-foreground text-xs">Status Funnel</div>
            {data.statusFunnel.length === 0 ? (
              <p className="text-muted-foreground text-xs">No ticket status data yet.</p>
            ) : (
              <div className="space-y-1.5">
                {data.statusFunnel.map((s) => (
                  <div key={s.key} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-foreground">{s.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {s.count.toLocaleString()} ({s.pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, s.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.ticketTypeSplit.length > 0 ? (
            <div className="border-t pt-2.5">
              <div className="mb-1.5 font-medium text-foreground text-xs">Ticket Types</div>
              <div className="flex flex-wrap gap-2 text-muted-foreground text-xs tabular-nums">
                {data.ticketTypeSplit.map((t) => (
                  <span key={t.key}>
                    <strong className="text-foreground">{t.label}:</strong> {t.pct}%
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
