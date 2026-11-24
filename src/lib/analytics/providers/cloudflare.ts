import { alpha2ToNumericId, getCountryDisplayName } from "@/lib/analytics/country-codes";
import {
  addDays,
  calcDeltaPct,
  calcSharePct,
  enumerateDateKeys,
  formatShortDateLabel,
  type ResolvedDateWindow,
} from "@/lib/analytics/date-range";
import type { ComparisonSeriesPoint, CountryMetricRow, KpiComparisonMetric } from "@/lib/analytics/types";

const CF_BEACON_TOKEN = "47c99f8f97fd44689a4e81ec4e4fdb24";

export interface CloudflareWebsiteResult {
  kpis: {
    pageViews: KpiComparisonMetric;
    totalSessions: KpiComparisonMetric; // Visits
    pagesPerVisit: number;
  };
  series: ComparisonSeriesPoint[];
  countries: CountryMetricRow[];
  topPaths: Array<{ path: string; pageViews: number; visits: number }>;
  topReferrers: Array<{ host: string; pageViews: number; visits: number }>;
}

function getCloudflareAccountId(): string | undefined {
  return process.env.R2_ACCOUNT_ID?.trim() || process.env.CF_ACCOUNT_ID?.trim();
}

export function isCloudflareAnalyticsConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim() && getCloudflareAccountId());
}

let cachedDiscoveredSiteTag: string | null = null;

async function resolveCloudflareSiteTag(accountId: string, apiToken: string): Promise<string> {
  const explicit = process.env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG?.trim();
  if (explicit) return explicit;
  if (cachedDiscoveredSiteTag) return cachedDiscoveredSiteTag;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/rum/site_info/list?per_page=50`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    },
  );
  const json = (await res.json()) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
    result?: Array<{ site_tag?: string; site_token?: string; host?: string }>;
  };
  if (!res.ok || !json.success) {
    throw new Error(json.errors?.[0]?.message || `Cloudflare RUM site lookup failed (${res.status})`);
  }

  const sites = json.result ?? [];
  const matched =
    sites.find((s) => s.site_token === CF_BEACON_TOKEN) ??
    sites.find((s) => (s.host ?? "").includes("gdgjakarta")) ??
    sites[0];

  if (!matched?.site_tag) {
    throw new Error("No Cloudflare Web Analytics site found on this account.");
  }
  cachedDiscoveredSiteTag = matched.site_tag;
  return matched.site_tag;
}

interface CfAdaptiveGroup {
  count?: number;
  sum?: { visits?: number };
  dimensions?: {
    date?: string;
    countryName?: string;
    requestPath?: string;
    refererHost?: string;
  };
}

interface CfGraphqlResponse {
  errors?: Array<{ message?: string }>;
  data?: {
    viewer?: {
      accounts?: Array<{
        currentTotals?: CfAdaptiveGroup[];
        previousTotals?: CfAdaptiveGroup[];
        currentDaily?: CfAdaptiveGroup[];
        previousDaily?: CfAdaptiveGroup[];
        countries?: CfAdaptiveGroup[];
        topPaths?: CfAdaptiveGroup[];
        topReferrers?: CfAdaptiveGroup[];
      }>;
    };
  };
}

export async function fetchCloudflareWebsiteAnalytics(window: ResolvedDateWindow): Promise<CloudflareWebsiteResult> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = getCloudflareAccountId();
  if (!apiToken || !accountId) {
    throw new Error("CLOUDFLARE_API_TOKEN or R2_ACCOUNT_ID is missing.");
  }

  const siteTag = await resolveCloudflareSiteTag(accountId, apiToken);

  const query = `
    query GetWebAnalytics(
      $accountTag: String!
      $siteTag: String!
      $curStart: Date!
      $curEnd: Date!
      $prevStart: Date!
      $prevEnd: Date!
    ) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          currentTotals: rumPageloadEventsAdaptiveGroups(
            limit: 1
            filter: { siteTag: $siteTag, date_geq: $curStart, date_leq: $curEnd, bot: 0 }
          ) {
            count
            sum { visits }
          }
          previousTotals: rumPageloadEventsAdaptiveGroups(
            limit: 1
            filter: { siteTag: $siteTag, date_geq: $prevStart, date_leq: $prevEnd, bot: 0 }
          ) {
            count
            sum { visits }
          }
          currentDaily: rumPageloadEventsAdaptiveGroups(
            limit: 400
            filter: { siteTag: $siteTag, date_geq: $curStart, date_leq: $curEnd, bot: 0 }
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            count
            sum { visits }
          }
          previousDaily: rumPageloadEventsAdaptiveGroups(
            limit: 400
            filter: { siteTag: $siteTag, date_geq: $prevStart, date_leq: $prevEnd, bot: 0 }
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            count
            sum { visits }
          }
          countries: rumPageloadEventsAdaptiveGroups(
            limit: 100
            filter: { siteTag: $siteTag, date_geq: $curStart, date_leq: $curEnd, bot: 0 }
            orderBy: [sum_visits_DESC]
          ) {
            dimensions { countryName }
            count
            sum { visits }
          }
          topPaths: rumPageloadEventsAdaptiveGroups(
            limit: 8
            filter: { siteTag: $siteTag, date_geq: $curStart, date_leq: $curEnd, bot: 0 }
            orderBy: [count_DESC]
          ) {
            dimensions { requestPath }
            count
            sum { visits }
          }
          topReferrers: rumPageloadEventsAdaptiveGroups(
            limit: 8
            filter: { siteTag: $siteTag, date_geq: $curStart, date_leq: $curEnd, bot: 0 }
            orderBy: [sum_visits_DESC]
          ) {
            dimensions { refererHost }
            count
            sum { visits }
          }
        }
      }
    }
  `;

  const isAllTime = window.mode === "all_time";
  const curStart = isAllTime ? addDays(window.apiUntilDate, -179) : window.sinceDate;
  const prevStart = isAllTime ? curStart : window.prevSinceDate;
  const prevEnd = isAllTime ? curStart : window.prevUntilDate;

  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        accountTag: accountId,
        siteTag,
        curStart,
        curEnd: window.apiUntilDate,
        prevStart,
        prevEnd,
      },
    }),
    signal: AbortSignal.timeout(12_000),
  });

  const json = (await res.json()) as CfGraphqlResponse;
  if (!res.ok || (json.errors && json.errors.length > 0)) {
    throw new Error(json.errors?.[0]?.message || `Cloudflare GraphQL API failed (${res.status})`);
  }

  const acct = json.data?.viewer?.accounts?.[0];
  const curTotal = acct?.currentTotals?.[0];
  const prevTotal = acct?.previousTotals?.[0];

  const pageViewsCur = Number(curTotal?.count ?? 0);
  const pageViewsPrev = Number(prevTotal?.count ?? 0);
  const visitsCur = Number(curTotal?.sum?.visits ?? 0);
  const visitsPrev = Number(prevTotal?.sum?.visits ?? 0);

  const curByDate = new Map<string, number>();
  for (const row of acct?.currentDaily ?? []) {
    if (row.dimensions?.date) {
      curByDate.set(row.dimensions.date, Number(row.count ?? 0));
    }
  }
  const prevByDate = new Map<string, number>();
  for (const row of acct?.previousDaily ?? []) {
    if (row.dimensions?.date) {
      prevByDate.set(row.dimensions.date, Number(row.count ?? 0));
    }
  }

  const currentKeys = enumerateDateKeys(curStart, window.apiUntilDate);
  const prevKeys = isAllTime ? [] : enumerateDateKeys(prevStart, prevEnd);
  const series: ComparisonSeriesPoint[] = currentKeys.map((dateKey, idx) => ({
    date: dateKey,
    label: formatShortDateLabel(dateKey),
    current: curByDate.get(dateKey) ?? 0,
    previous: prevKeys[idx] ? (prevByDate.get(prevKeys[idx]) ?? 0) : 0,
  }));

  const rawCountries = (acct?.countries ?? [])
    .map((row) => {
      const code = (row.dimensions?.countryName ?? "").trim().toUpperCase();
      const visits = Number(row.sum?.visits ?? 0);
      const views = Number(row.count ?? 0);
      return {
        code,
        numericId: alpha2ToNumericId(code),
        name: getCountryDisplayName(code),
        usersOrVisits: visits,
        pageViews: views,
      };
    })
    .filter((c) => c.code && c.code !== "XX" && (c.usersOrVisits > 0 || c.pageViews > 0));

  const totalVisits = rawCountries.reduce((acc, c) => acc + c.usersOrVisits, 0);
  const countries: CountryMetricRow[] = rawCountries.map((c) => ({
    ...c,
    pct: calcSharePct(c.usersOrVisits, totalVisits),
  }));

  const topPaths = (acct?.topPaths ?? [])
    .filter((p) => p.dimensions?.requestPath)
    .map((p) => ({
      path: p.dimensions?.requestPath || "/",
      pageViews: Number(p.count ?? 0),
      visits: Number(p.sum?.visits ?? 0),
    }));

  const topReferrers = (acct?.topReferrers ?? [])
    .filter((r) => r.dimensions?.refererHost)
    .map((r) => ({
      host: r.dimensions?.refererHost || "Direct",
      pageViews: Number(r.count ?? 0),
      visits: Number(r.sum?.visits ?? 0),
    }));

  return {
    kpis: {
      pageViews: {
        current: pageViewsCur,
        previous: pageViewsPrev,
        deltaPct: calcDeltaPct(pageViewsCur, pageViewsPrev),
      },
      totalSessions: { current: visitsCur, previous: visitsPrev, deltaPct: calcDeltaPct(visitsCur, visitsPrev) },
      pagesPerVisit: visitsCur > 0 ? Math.round((pageViewsCur / visitsCur) * 10) / 10 : 0,
    },
    series,
    countries,
    topPaths,
    topReferrers,
  };
}
