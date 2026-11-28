"use client";

import * as React from "react";

import type { ShortlinkProviderName } from "@/lib/shortio/types";
import { getDomainClickstreamAction, getDomainStatsAction } from "@/server/shortio-advanced-actions";

import { ClickStatsView } from "./click-stats-view";

interface AnalyticsTabProps {
  primaryDomain: string;
  provider: ShortlinkProviderName;
}

export function AnalyticsTab({ primaryDomain, provider }: AnalyticsTabProps) {
  const loadClickstream = React.useCallback(
    () => getDomainClickstreamAction({ hostname: primaryDomain, limit: 50 }),
    [primaryDomain],
  );

  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">Click analytics across every link on {primaryDomain}.</p>
      <ClickStatsView
        load={getDomainStatsAction}
        loadClickstream={loadClickstream}
        provider={provider}
        showSlugInClickstream
      />
    </div>
  );
}
