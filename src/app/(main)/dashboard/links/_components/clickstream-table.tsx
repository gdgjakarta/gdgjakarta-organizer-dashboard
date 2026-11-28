"use client";

import * as React from "react";

import { format } from "date-fns";
import { Activity, Info, RefreshCw } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClickStreamEntry, ShortlinkProviderName } from "@/lib/shortio/types";

interface ClickstreamTableProps {
  entries: ClickStreamEntry[];
  provider: ShortlinkProviderName;
  showSlug?: boolean;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export function ClickstreamTable({
  entries,
  provider,
  showSlug = false,
  onRefresh,
  isRefreshing = false,
}: ClickstreamTableProps) {
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const autoRefreshId = React.useId();

  React.useEffect(() => {
    if (!autoRefresh || provider !== "cloudflare" || !onRefresh) return;
    const timer = setInterval(() => {
      void onRefresh();
    }, 15_000);
    return () => clearInterval(timer);
  }, [autoRefresh, provider, onRefresh]);

  return (
    <Card className="p-4">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 p-0 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <CardTitle className="text-sm">Real-time Clickstream</CardTitle>
        </div>

        {provider === "cloudflare" && onRefresh && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id={autoRefreshId}
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                aria-label="Auto-refresh clickstream every 15 seconds"
              />
              <Label htmlFor={autoRefreshId} className="font-normal text-muted-foreground text-xs">
                Auto (15s)
              </Label>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void onRefresh()}
              disabled={isRefreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {provider === "shortio" && (
          <Alert>
            <Info className="size-4" />
            <AlertDescription>
              Real-time clickstream events and city-level breakdowns require{" "}
              <code className="font-mono">SHORTLINK_PROVIDER=cloudflare</code>.
            </AlertDescription>
          </Alert>
        )}
        {provider === "cloudflare" && entries.length === 0 && (
          <p className="py-4 text-center text-muted-foreground text-xs">No recent clickstream events recorded yet.</p>
        )}
        {provider === "cloudflare" && entries.length > 0 && (
          <section aria-label="Real-time clickstream events" className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="text-xs">
                    Time
                  </TableHead>
                  {showSlug && (
                    <TableHead scope="col" className="text-xs">
                      Slug
                    </TableHead>
                  )}
                  <TableHead scope="col" className="text-xs">
                    Location
                  </TableHead>
                  <TableHead scope="col" className="text-xs">
                    Device / OS / Browser
                  </TableHead>
                  <TableHead scope="col" className="text-xs">
                    Referrer
                  </TableHead>
                  <TableHead scope="col" className="text-xs">
                    Variant
                  </TableHead>
                  <TableHead scope="col" className="text-xs">
                    Traffic
                  </TableHead>
                  <TableHead scope="col" className="text-xs">
                    Target
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const location = [entry.city, entry.country].filter(Boolean).join(", ") || "Unknown";
                  const client = [entry.device, entry.os, entry.browser].filter(Boolean).join(" · ") || "Unknown";
                  const timeLabel = Number.isFinite(entry.clickedAt)
                    ? format(new Date(entry.clickedAt), "dd MMM HH:mm:ss")
                    : "—";

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-muted-foreground text-xs">{timeLabel}</TableCell>
                      {showSlug && <TableCell className="font-mono text-xs">/{entry.path}</TableCell>}
                      <TableCell className="text-xs">{location}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{client}</TableCell>
                      <TableCell
                        className="max-w-[140px] truncate text-muted-foreground text-xs"
                        title={entry.referer ?? "Direct"}
                      >
                        {entry.referer || "Direct"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.variantLabel ? (
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                            {entry.variantLabel}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={entry.isBot ? "outline" : "secondary"} className="px-1.5 py-0 text-[10px]">
                          {entry.isBot ? "Bot" : "Human"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="max-w-[180px] truncate font-mono text-muted-foreground text-xs"
                        title={entry.targetUrl ?? undefined}
                      >
                        {entry.targetUrl || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
