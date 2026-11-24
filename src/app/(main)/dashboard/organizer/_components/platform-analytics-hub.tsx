"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BarChart3, CalendarDays, Globe, Ticket, Users } from "lucide-react";
import { siInstagram } from "simple-icons";
import { toast } from "sonner";

import { Shimmer } from "@/components/shimmer";
import { SimpleIcon } from "@/components/simple-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/config/firebase";
import {
  ANALYTICS_DOMAINS,
  type AnalyticsDomain,
  addDays,
  formatMonthLabel,
  formatShortDateLabel,
  getTodayWibDateStr,
} from "@/lib/analytics/date-range";
import {
  type AnalyticsPromptBundle,
  buildAnalyticsReportPrompt,
  type ReportPromptPurpose,
} from "@/lib/analytics/prompt-builder";
import type {
  AnalyticsCapabilities,
  AnalyticsOverviewResponse,
  EventAnalyticsPayload,
  InstagramAnalyticsPayload,
  MemberAnalyticsPayload,
  TicketAnalyticsPayload,
  WebsiteAnalyticsPayload,
  WebsiteProviderId,
} from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

import { AnalyticsFilterBar, type AnalyticsFilterState } from "./analytics-filter-bar";
import { EventsTab } from "./analytics-tabs/events-tab";
import { InstagramTab } from "./analytics-tabs/instagram-tab";
import { MembersTab } from "./analytics-tabs/members-tab";
import { TicketsTab } from "./analytics-tabs/tickets-tab";
import { WebsiteTab } from "./analytics-tabs/website-tab";

const STORAGE_KEY = "gdg_organizer_analytics_prefs_v2";

function getDefaultFilterState(): AnalyticsFilterState {
  const today = getTodayWibDateStr();
  return {
    mode: "all_time",
    month: today.slice(0, 7),
    year: today.slice(0, 4),
    from: addDays(today, -29),
    to: today,
  };
}

interface StoredPrefs {
  tab?: AnalyticsDomain;
  filter?: Partial<AnalyticsFilterState>;
}

export function PlatformAnalyticsHub({ capabilities }: { capabilities: AnalyticsCapabilities }) {
  const isExpanded = true;
  const [activeTab, setActiveTab] = useState<AnalyticsDomain>(capabilities.defaultTab);
  const [filter, setFilter] = useState<AnalyticsFilterState>(getDefaultFilterState);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  const [websiteProvider, setWebsiteProvider] = useState<WebsiteProviderId | undefined>(undefined);
  const [includeTestEvents, setIncludeTestEvents] = useState(false);

  const [data, setData] = useState<AnalyticsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isCopyingPrompt, setIsCopyingPrompt] = useState(false);

  const cacheRef = useRef<Map<string, AnalyticsOverviewResponse>>(new Map());
  const prevRefreshTickRef = useRef(0);

  // Restore saved tab & filter from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredPrefs;
        if (parsed.tab && ANALYTICS_DOMAINS.includes(parsed.tab)) {
          setActiveTab(parsed.tab);
        }
        if (parsed.filter) {
          let restoredMode: AnalyticsFilterState["mode"] = "all_time";
          if (parsed.filter.mode === "month") restoredMode = "month";
          else if (parsed.filter.mode === "year") restoredMode = "year";
          else if (parsed.filter.mode === "date_range") restoredMode = "date_range";

          setFilter((prev) => ({
            mode: restoredMode,
            month: parsed.filter?.month && /^\d{4}-\d{2}$/.test(parsed.filter.month) ? parsed.filter.month : prev.month,
            year: parsed.filter?.year && /^\d{4}$/.test(parsed.filter.year) ? parsed.filter.year : prev.year,
            from:
              parsed.filter?.from && /^\d{4}-\d{2}-\d{2}$/.test(parsed.filter.from) ? parsed.filter.from : prev.from,
            to: parsed.filter?.to && /^\d{4}-\d{2}-\d{2}$/.test(parsed.filter.to) ? parsed.filter.to : prev.to,
          }));
        }
      }
    } catch {
      // Ignore storage errors
    } finally {
      setPrefsHydrated(true);
    }
  }, []);

  // Persist tab & filter changes
  useEffect(() => {
    if (!prefsHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tab: activeTab, filter }));
    } catch {
      // Ignore storage errors
    }
  }, [activeTab, filter, prefsHydrated]);

  const buildRequestKey = useCallback(
    (domain: AnalyticsDomain) => {
      return [
        domain,
        filter.mode,
        filter.month,
        filter.year,
        filter.from,
        filter.to,
        domain === "website" ? (websiteProvider ?? "auto") : "",
        domain === "events" ? (includeTestEvents ? "1" : "0") : "",
      ].join("|");
    },
    [filter.from, filter.mode, filter.month, filter.to, filter.year, includeTestEvents, websiteProvider],
  );

  useEffect(() => {
    if (!prefsHydrated) return;

    const cacheKey = buildRequestKey(activeTab);
    const shouldForceRefresh = refreshTick !== prevRefreshTickRef.current;
    prevRefreshTickRef.current = refreshTick;

    if (!shouldForceRefresh) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setData(cached);
        setError(null);
        setLoading(false);
        return;
      }
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const params = new URLSearchParams({
          domain: activeTab,
          mode: filter.mode,
        });
        if (filter.mode === "month") {
          params.set("month", filter.month);
        } else if (filter.mode === "year") {
          params.set("year", filter.year);
        } else if (filter.mode === "date_range") {
          params.set("from", filter.from);
          params.set("to", filter.to);
        }
        if (activeTab === "website" && websiteProvider) {
          params.set("provider", websiteProvider);
        }
        if (activeTab === "events" && includeTestEvents) {
          params.set("includeTest", "1");
        }
        if (shouldForceRefresh) {
          params.set("refresh", "1");
        }

        const headers: Record<string, string> = {};
        try {
          const idToken = await auth.currentUser?.getIdToken();
          if (idToken) {
            headers.Authorization = `Bearer ${idToken}`;
          }
        } catch {
          // Fallback to auth_token cookie
        }

        const res = await fetch(`/api/analytics/overview?${params.toString()}`, {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        const json = (await res.json()) as AnalyticsOverviewResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Failed to load analytics (${res.status})`);
        }
        if (!controller.signal.aborted) {
          const isUnconfigured = "configured" in json && json.configured === false;
          const hasError = "error" in json && Boolean(json.error);
          if (!isUnconfigured && !hasError) {
            cacheRef.current.set(cacheKey, json);
          }
          setData(json);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load analytics.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [
    activeTab,
    buildRequestKey,
    filter.from,
    filter.mode,
    filter.month,
    filter.to,
    filter.year,
    includeTestEvents,
    prefsHydrated,
    refreshTick,
    websiteProvider,
  ]);

  const handleManualRefresh = () => {
    setRefreshTick((t) => t + 1);
  };

  const fetchDomainPayload = useCallback(
    async (domain: AnalyticsDomain): Promise<AnalyticsOverviewResponse | null> => {
      const cacheKey = buildRequestKey(domain);
      const cached = cacheRef.current.get(cacheKey);
      if (cached) return cached;

      const params = new URLSearchParams({
        domain,
        mode: filter.mode,
      });
      if (filter.mode === "month") params.set("month", filter.month);
      else if (filter.mode === "year") params.set("year", filter.year);
      else if (filter.mode === "date_range") {
        params.set("from", filter.from);
        params.set("to", filter.to);
      }
      if (domain === "website" && websiteProvider) params.set("provider", websiteProvider);
      if (domain === "events" && includeTestEvents) params.set("includeTest", "1");

      const headers: Record<string, string> = {};
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) headers.Authorization = `Bearer ${idToken}`;
      } catch {
        // Fallback to auth_token cookie
      }

      const res = await fetch(`/api/analytics/overview?${params.toString()}`, { method: "GET", headers });
      if (!res.ok) return null;
      const json = (await res.json()) as AnalyticsOverviewResponse;
      const isUnconfigured = "configured" in json && json.configured === false;
      const hasError = "error" in json && Boolean(json.error);
      if (!isUnconfigured && !hasError) {
        cacheRef.current.set(cacheKey, json);
      }
      return json;
    },
    [
      buildRequestKey,
      filter.from,
      filter.mode,
      filter.month,
      filter.to,
      filter.year,
      includeTestEvents,
      websiteProvider,
    ],
  );

  const handleCopyPrompt = useCallback(
    async (purpose: ReportPromptPurpose) => {
      setIsCopyingPrompt(true);
      try {
        const domainsToFetch: AnalyticsDomain[] = purpose === "active_tab" ? [activeTab] : [...ANALYTICS_DOMAINS];
        const results = await Promise.all(domainsToFetch.map((d) => fetchDomainPayload(d).catch(() => null)));

        const bundle: AnalyticsPromptBundle = {};
        for (const res of results) {
          if (!res) continue;
          if (res.domain === "website") bundle.website = res;
          else if (res.domain === "events") bundle.events = res;
          else if (res.domain === "tickets") bundle.tickets = res;
          else if (res.domain === "members") bundle.members = res;
          else if (res.domain === "instagram") bundle.instagram = res;
        }

        let filterLabel = "All Time";
        if (filter.mode === "month") filterLabel = formatMonthLabel(filter.month);
        else if (filter.mode === "year") filterLabel = filter.year;
        else if (filter.mode === "date_range") {
          filterLabel = `${formatShortDateLabel(filter.from)} – ${formatShortDateLabel(filter.to)}`;
        }

        const prompt = buildAnalyticsReportPrompt({ purpose, filterLabel, bundle });
        await navigator.clipboard.writeText(prompt);

        const label =
          purpose === "proposal"
            ? "Sponsor Proposal prompt (all 5 tabs)"
            : purpose === "partner_report"
              ? "Partner Impact Report prompt (all 5 tabs)"
              : `${activeTab} Markdown prompt`;
        toast.success(`Copied ${label} to clipboard!`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to copy report prompt.");
      } finally {
        setIsCopyingPrompt(false);
      }
    },
    [activeTab, fetchDomainPayload, filter.from, filter.mode, filter.month, filter.to, filter.year],
  );

  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="size-4" aria-hidden="true" />
            </div>
            <CardTitle className="font-semibold text-base">Platform &amp; Community Analytics</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Real-time metrics across gdgjakarta.com, Bevy events &amp; members, Firestore tickets, and @gdgjakarta.
          </CardDescription>
        </div>

        <AnalyticsFilterBar
          filter={filter}
          onChange={setFilter}
          onRefresh={handleManualRefresh}
          onCopyPrompt={(purpose) => {
            void handleCopyPrompt(purpose);
          }}
          isLoading={loading}
          isCopyingPrompt={isCopyingPrompt}
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AnalyticsDomain)}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="website" className="gap-1.5 px-2.5 py-1 text-xs">
              <Globe className="size-3.5" aria-hidden="true" />
              <span>Website</span>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  capabilities.websiteConfigured ? "bg-emerald-500" : "bg-amber-500",
                )}
                aria-hidden="true"
              />
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5 px-2.5 py-1 text-xs">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <span>Events</span>
            </TabsTrigger>
            <TabsTrigger value="tickets" className="gap-1.5 px-2.5 py-1 text-xs">
              <Ticket className="size-3.5" aria-hidden="true" />
              <span>Tickets</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5 px-2.5 py-1 text-xs">
              <Users className="size-3.5" aria-hidden="true" />
              <span>Members</span>
            </TabsTrigger>
            <TabsTrigger value="instagram" className="gap-1.5 px-2.5 py-1 text-xs">
              <SimpleIcon icon={siInstagram} className="size-3.5 fill-current" aria-hidden="true" />
              <span>Instagram</span>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  capabilities.instagramConfigured ? "bg-emerald-500" : "bg-amber-500",
                )}
                aria-hidden="true"
              />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle className="font-semibold text-xs">Unable to Load Analytics</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <output className="block space-y-4" aria-busy="true" aria-label="Loading analytics">
            <Shimmer className="h-10 w-full rounded-lg" />
            <div className={cn("grid gap-2.5", isExpanded ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
              <Shimmer className="h-22 rounded-lg" />
              <Shimmer className="h-22 rounded-lg" />
              <Shimmer className="h-22 rounded-lg" />
              <Shimmer className="h-22 rounded-lg" />
            </div>
            <Shimmer className="h-44 w-full rounded-lg" />
            <div className={cn("grid gap-4", isExpanded ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <Shimmer className="h-4 w-36" />
                <Shimmer className="h-14 w-full rounded-md" />
                <Shimmer className="h-14 w-full rounded-md" />
              </div>
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <Shimmer className="h-4 w-40" />
                <Shimmer className="h-14 w-full rounded-md" />
                <Shimmer className="h-14 w-full rounded-md" />
              </div>
            </div>
          </output>
        ) : null}

        {!loading && data && data.domain === activeTab ? (
          <div>
            {data.domain === "website" ? (
              <WebsiteTab
                data={data as WebsiteAnalyticsPayload}
                isExpanded={isExpanded}
                onSelectProvider={(prov) => setWebsiteProvider(prov)}
              />
            ) : null}
            {data.domain === "events" ? (
              <EventsTab
                data={data as EventAnalyticsPayload}
                includeTest={includeTestEvents}
                onToggleIncludeTest={(val) => setIncludeTestEvents(val)}
                isExpanded={isExpanded}
              />
            ) : null}
            {data.domain === "tickets" ? (
              <TicketsTab data={data as TicketAnalyticsPayload} isExpanded={isExpanded} />
            ) : null}
            {data.domain === "members" ? (
              <MembersTab data={data as MemberAnalyticsPayload} isExpanded={isExpanded} />
            ) : null}
            {data.domain === "instagram" ? (
              <InstagramTab data={data as InstagramAnalyticsPayload} isExpanded={isExpanded} />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
