"use client";

import * as React from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ShortLinkItem, ShortlinkProviderName, StatsPeriod } from "@/lib/shortio/types";
import { getLinkClickstreamAction, getLinkStatsAction } from "@/server/shortio-advanced-actions";

import { ClickStatsView } from "./click-stats-view";

interface Props {
  link: ShortLinkItem | null;
  provider: ShortlinkProviderName;
  onOpenChange: (open: boolean) => void;
}

export function LinkAnalyticsSheet({ link, provider, onOpenChange }: Props) {
  const linkId = link?.id;
  const load = React.useCallback((p: StatsPeriod) => getLinkStatsAction(linkId ?? "", p), [linkId]);
  const loadClickstream = React.useCallback(() => getLinkClickstreamAction(linkId ?? "", { limit: 50 }), [linkId]);

  return (
    <Sheet open={Boolean(link)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Link analytics</SheetTitle>
          <SheetDescription className="break-all font-mono">{link?.shortURL}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {link && <ClickStatsView key={link.id} load={load} loadClickstream={loadClickstream} provider={provider} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
