"use client";

import { SHORTIO_CONFIG } from "@/config/shortio-config";
import { getDomainStatsAction } from "@/server/shortio-advanced-actions";

import { ClickStatsView } from "./click-stats-view";

export function AnalyticsTab() {
  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">Click analytics across every link on {SHORTIO_CONFIG.domain}.</p>
      <ClickStatsView load={getDomainStatsAction} />
    </div>
  );
}
