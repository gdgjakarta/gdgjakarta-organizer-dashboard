import { unstable_cache } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { analyticsQuerySchema, type ResolvedDateWindow, resolveDateWindow } from "@/lib/analytics/date-range";
import { fetchCloudflareWebsiteAnalytics, isCloudflareAnalyticsConfigured } from "@/lib/analytics/providers/cloudflare";
import {
  countLoggedInDashboardUsers,
  fetchEventAnalytics,
  fetchMemberAnalytics,
  fetchTicketAnalytics,
} from "@/lib/analytics/providers/firestore-analytics";
import { fetchGa4WebsiteAnalytics, isGa4Configured } from "@/lib/analytics/providers/ga4";
import type { AnalyticsOverviewResponse, WebsiteAnalyticsPayload, WebsiteProviderId } from "@/lib/analytics/types";
import { fetchInstagramInsights, isInstagramConfigured } from "@/lib/instagram/client";
import { isAuthorizedExecutiveOrganizerSession } from "@/server/auth-guard";

export const dynamic = "force-dynamic";

function extractBearerToken(req: NextRequest): string | undefined {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1]?.trim() || undefined;
}

function buildRangeMeta(window: ResolvedDateWindow, cached: boolean) {
  return {
    mode: window.mode,
    month: window.month,
    sinceDate: window.sinceDate,
    untilDate: window.untilDate,
    prevSinceDate: window.prevSinceDate,
    prevUntilDate: window.prevUntilDate,
    dayCount: window.dayCount,
    label: window.label,
    prevLabel: window.prevLabel,
    fetchedAt: new Date().toISOString(),
    cached,
  };
}

async function computeWebsiteAnalytics(
  window: ResolvedDateWindow,
  preferredProvider?: WebsiteProviderId,
  token?: string,
  cached = false,
): Promise<WebsiteAnalyticsPayload> {
  const ga4Ready = isGa4Configured();
  const cfReady = isCloudflareAnalyticsConfigured();
  const availableProviders: WebsiteProviderId[] = [];
  if (ga4Ready) availableProviders.push("ga4");
  if (cfReady) availableProviders.push("cloudflare");

  const activeProvider: WebsiteProviderId | null =
    preferredProvider && availableProviders.includes(preferredProvider)
      ? preferredProvider
      : (availableProviders[0] ?? null);

  const loggedInDashboardUsers = await countLoggedInDashboardUsers(window, token).catch(() => ({
    current: 0,
    previous: null,
    deltaPct: null,
  }));

  if (!activeProvider) {
    return {
      domain: "website",
      configured: false,
      activeProvider: null,
      availableProviders,
      range: buildRangeMeta(window, cached),
      loggedInDashboardUsers,
      kpis: {
        pageViews: { current: 0, previous: null, deltaPct: null },
        totalUsers: null,
        newUsers: null,
        totalSessions: { current: 0, previous: null, deltaPct: null },
        engagedSessions: null,
        engagementRatePct: null,
        pagesPerVisit: null,
      },
      series: [],
      countries: [],
    };
  }

  try {
    if (activeProvider === "ga4") {
      const ga4 = await fetchGa4WebsiteAnalytics(window);
      return {
        domain: "website",
        configured: true,
        activeProvider: "ga4",
        availableProviders,
        range: buildRangeMeta(window, cached),
        loggedInDashboardUsers,
        kpis: {
          pageViews: ga4.kpis.pageViews,
          totalUsers: ga4.kpis.totalUsers,
          newUsers: ga4.kpis.newUsers,
          totalSessions: ga4.kpis.totalSessions,
          engagedSessions: ga4.kpis.engagedSessions,
          engagementRatePct: ga4.kpis.engagementRatePct,
          pagesPerVisit: null,
        },
        series: ga4.series,
        countries: ga4.countries,
      };
    }

    const cf = await fetchCloudflareWebsiteAnalytics(window);
    return {
      domain: "website",
      configured: true,
      activeProvider: "cloudflare",
      availableProviders,
      range: buildRangeMeta(window, cached),
      loggedInDashboardUsers,
      kpis: {
        pageViews: cf.kpis.pageViews,
        totalUsers: null,
        newUsers: null,
        totalSessions: cf.kpis.totalSessions,
        engagedSessions: null,
        engagementRatePct: null,
        pagesPerVisit: cf.kpis.pagesPerVisit,
      },
      series: cf.series,
      countries: cf.countries,
      topPaths: cf.topPaths,
      topReferrers: cf.topReferrers,
    };
  } catch (err) {
    return {
      domain: "website",
      configured: true,
      activeProvider,
      availableProviders,
      error: err instanceof Error ? err.message : "Failed to load website analytics.",
      range: buildRangeMeta(window, false),
      loggedInDashboardUsers,
      kpis: {
        pageViews: { current: 0, previous: null, deltaPct: null },
        totalUsers: null,
        newUsers: null,
        totalSessions: { current: 0, previous: null, deltaPct: null },
        engagedSessions: null,
        engagementRatePct: null,
        pagesPerVisit: null,
      },
      series: [],
      countries: [],
    };
  }
}

async function fetchExternalWithR2Cache<T extends AnalyticsOverviewResponse>(
  cacheKeyParts: string[],
  revalidateSeconds: number,
  bypassCache: boolean,
  loader: (cachedFlag: boolean) => Promise<T>,
): Promise<T> {
  if (bypassCache) {
    return loader(false);
  }
  const cachedFn = unstable_cache(async () => loader(true), cacheKeyParts, {
    revalidate: revalidateSeconds,
  });
  return cachedFn();
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorizedExecutiveOrganizerSession())) {
    return NextResponse.json({ error: "Unauthorized: Executive Organizer access required." }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const parsed = analyticsQuerySchema.safeParse({
    domain: sp.get("domain"),
    mode: sp.get("mode") ?? "all_time",
    month: sp.get("month") ?? undefined,
    year: sp.get("year") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    provider: sp.get("provider") ?? undefined,
    includeTest: sp.get("includeTest") ?? undefined,
    refresh: sp.get("refresh") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const fields = Object.keys(fieldErrors);
    return NextResponse.json(
      {
        error: fields.length > 0 ? `Invalid query parameters (${fields.join(", ")})` : "Invalid query parameters",
        details: fieldErrors,
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const window = resolveDateWindow({
    mode: input.mode,
    month: input.month,
    year: input.year,
    from: input.from,
    to: input.to,
  });
  const bypassCache = input.refresh === "1";
  const ttlSeconds = window.isSettled ? 21_600 : 900; // 6h for settled months, 15m for recent windows
  const bearerToken = extractBearerToken(req) ?? req.cookies.get("auth_token")?.value?.trim();

  let payload: AnalyticsOverviewResponse;

  switch (input.domain) {
    case "website": {
      if (isGa4Configured() || isCloudflareAnalyticsConfigured()) {
        // Cache external GA4/Cloudflare data; loggedInDashboardUsers is fetched with caller token or cached
        payload = await fetchExternalWithR2Cache(
          ["analytics", "website", "v2", input.provider ?? "auto", window.sinceDate, window.apiUntilDate],
          ttlSeconds,
          bypassCache,
          (cachedFlag) => computeWebsiteAnalytics(window, input.provider, bearerToken, cachedFlag),
        );
      } else {
        payload = await computeWebsiteAnalytics(window, input.provider, bearerToken, false);
      }
      break;
    }

    case "events": {
      const includeTest = input.includeTest === "1";
      payload = await fetchExternalWithR2Cache(
        ["analytics", "events", String(includeTest), window.sinceDate, window.untilDate],
        300,
        bypassCache,
        (cachedFlag) => fetchEventAnalytics(window, { includeTest, token: bearerToken, cached: cachedFlag }),
      );
      break;
    }

    case "tickets": {
      payload = await fetchExternalWithR2Cache(
        ["analytics", "tickets", "v1", window.sinceDate, window.apiUntilDate],
        window.isSettled ? 21_600 : 300,
        bypassCache,
        (cachedFlag) => fetchTicketAnalytics(window, { token: bearerToken, cached: cachedFlag }),
      );
      break;
    }

    case "members": {
      payload = await fetchExternalWithR2Cache(
        ["analytics", "members", window.sinceDate, window.apiUntilDate],
        ttlSeconds,
        bypassCache,
        (cachedFlag) => fetchMemberAnalytics(window, { token: bearerToken, cached: cachedFlag }),
      );
      break;
    }

    case "instagram": {
      if (!isInstagramConfigured()) {
        payload = await fetchInstagramInsights(window, { cached: false });
        break;
      }
      payload = await fetchExternalWithR2Cache(
        [
          "analytics",
          "instagram",
          "v9",
          process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim() ?? "",
          window.mode,
          window.sinceDate,
          window.apiUntilDate,
        ],
        ttlSeconds,
        bypassCache,
        (cachedFlag) => fetchInstagramInsights(window, { cached: cachedFlag }),
      );
      break;
    }
  }

  const cacheControl = bypassCache || ("error" in payload && payload.error) ? "no-store" : "private, max-age=300";

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": cacheControl,
    },
  });
}
