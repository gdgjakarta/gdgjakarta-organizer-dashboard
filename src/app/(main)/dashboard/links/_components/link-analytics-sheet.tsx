"use client";

import * as React from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ShortLinkItem, StatsPeriod } from "@/lib/shortio/types";
import { getLinkStatsAction } from "@/server/shortio-advanced-actions";

import { ClickStatsView } from "./click-stats-view";

interface Props {
  link: ShortLinkItem | null;
  onOpenChange: (open: boolean) => void;
}

export function LinkAnalyticsSheet({ link, onOpenChange }: Props) {
  const linkId = link?.id;
  const load = React.useCallback((p: StatsPeriod) => getLinkStatsAction(linkId ?? "", p), [linkId]);

  return (
    <Sheet open={Boolean(link)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Link analytics</SheetTitle>
          <SheetDescription className="break-all font-mono">{link?.shortURL}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">{link && <ClickStatsView key={link.id} load={load} />}</div>
      </SheetContent>
    </Sheet>
  );
}
