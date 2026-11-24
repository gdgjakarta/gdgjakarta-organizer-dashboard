import {
  addDays,
  calcDeltaPct,
  calcSharePct,
  chunkDateRange,
  formatShortDateLabel,
  type ResolvedDateWindow,
  toWibDateKey,
  utcEpochEnd,
  utcEpochStart,
} from "@/lib/analytics/date-range";
import type {
  BreakdownItem,
  InstagramAdsSummary,
  InstagramAnalyticsPayload,
  InstagramBoostedPost,
  InstagramPostInsight,
} from "@/lib/analytics/types";

interface MetaInsightResult {
  dimension_values?: string[];
  value?: number;
}

interface MetaInsightMetric {
  name: string;
  period?: string;
  values?: Array<{ value: number; end_time?: string }>;
  total_value?: {
    value?: number;
    breakdowns?: Array<{
      dimension_keys?: string[];
      results?: MetaInsightResult[];
    }>;
  };
}

interface MetaErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
}

export function isInstagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN?.trim() && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim());
}

function getInstagramConfig() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ?? "";
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim() ?? "";
  const version = process.env.INSTAGRAM_GRAPH_API_VERSION?.trim() || "v25.0";
  const host = (process.env.INSTAGRAM_API_HOST?.trim() || "https://graph.facebook.com").replace(/\/+$/, "");
  return { token, accountId, version, host };
}

class MetaApiError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
  }
}

async function metaFetch<T>(url: string, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json().catch(() => ({}))) as T & MetaErrorPayload;
  if (!res.ok || json.error) {
    const code = json.error?.code;
    const rawMsg = json.error?.message || `Meta Graph API error (${res.status})`;
    if (code === 190) {
      throw new MetaApiError("Instagram access token expired or invalid. Rotate INSTAGRAM_ACCESS_TOKEN.", code);
    }
    if (code === 4 || code === 17 || code === 32 || code === 80002) {
      throw new MetaApiError("Meta Graph API rate limit reached. Cached data will resume shortly.", code);
    }
    if (code === 10 || code === 200) {
      throw new MetaApiError("Missing Instagram Insights permission (instagram_manage_insights).", code);
    }
    throw new MetaApiError(rawMsg, code);
  }
  return json;
}

function buildInsightsUrl(params: {
  host: string;
  version: string;
  accountId: string;
  token: string;
  metric: string;
  sinceDate: string;
  untilDate: string;
  metricType: "total_value" | "time_series";
  breakdown?: string;
}): string {
  const qs = new URLSearchParams({
    metric: params.metric,
    period: "day",
    metric_type: params.metricType,
    since: String(utcEpochStart(params.sinceDate)),
    until: String(utcEpochEnd(params.untilDate)),
    access_token: params.token,
  });
  if (params.breakdown) {
    qs.set("breakdown", params.breakdown);
  }
  return `${params.host}/${params.version}/${encodeURIComponent(params.accountId)}/insights?${qs.toString()}`;
}

function sumMetricTotals(metrics: MetaInsightMetric[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const m of metrics) {
    const val = Number(m.total_value?.value ?? 0);
    totals[m.name] = (totals[m.name] ?? 0) + val;
  }
  return totals;
}

async function fetchCoreTotals(
  cfg: ReturnType<typeof getInstagramConfig>,
  sinceDate: string,
  untilDate: string,
): Promise<Record<string, number>> {
  const chunks = chunkDateRange(sinceDate, untilDate, 30);
  const metric = "views,reach,accounts_engaged,total_interactions,likes,comments,shares,saves";
  const responses = await Promise.all(
    chunks.map((c) =>
      metaFetch<{ data?: MetaInsightMetric[] }>(
        buildInsightsUrl({
          ...cfg,
          metric,
          sinceDate: c.since,
          untilDate: c.until,
          metricType: "total_value",
        }),
      ),
    ),
  );

  const combined: Record<string, number> = {};
  for (const res of responses) {
    const part = sumMetricTotals(res.data ?? []);
    for (const [k, v] of Object.entries(part)) {
      combined[k] = (combined[k] ?? 0) + v;
    }
  }
  return combined;
}

async function fetchIsolatedFollowBreakdown(
  cfg: ReturnType<typeof getInstagramConfig>,
  metric: "views" | "reach" | "follows_and_unfollows",
  sinceDate: string,
  untilDate: string,
): Promise<{ follower: number; nonFollower: number; unknown: number }> {
  const chunks = chunkDateRange(sinceDate, untilDate, 30);
  const responses = await Promise.all(
    chunks.map((c) =>
      metaFetch<{ data?: MetaInsightMetric[] }>(
        buildInsightsUrl({
          ...cfg,
          metric,
          sinceDate: c.since,
          untilDate: c.until,
          metricType: "total_value",
          breakdown: "follow_type",
        }),
      ),
    ),
  );

  let follower = 0;
  let nonFollower = 0;
  let unknown = 0;

  for (const res of responses) {
    const m = res.data?.[0];
    const results = m?.total_value?.breakdowns?.[0]?.results ?? [];
    for (const r of results) {
      const dim = (r.dimension_values?.[0] ?? "").toUpperCase();
      const val = Number(r.value ?? 0);
      if (dim === "FOLLOWER") follower += val;
      else if (dim === "NON_FOLLOWER") nonFollower += val;
      else unknown += val;
    }
  }

  return { follower, nonFollower, unknown };
}

async function fetchDailyReachSeries(
  cfg: ReturnType<typeof getInstagramConfig>,
  sinceDate: string,
  untilDate: string,
): Promise<Array<{ date: string; label: string; reach: number }>> {
  const chunks = chunkDateRange(sinceDate, untilDate, 30);
  const responses = await Promise.all(
    chunks.map((c) =>
      metaFetch<{ data?: MetaInsightMetric[] }>(
        buildInsightsUrl({
          ...cfg,
          metric: "reach",
          sinceDate: c.since,
          untilDate: c.until,
          metricType: "time_series",
        }),
      ),
    ),
  );

  const byDate = new Map<string, number>();
  for (const res of responses) {
    const values = res.data?.[0]?.values ?? [];
    for (const pt of values) {
      const dateKey = pt.end_time ? pt.end_time.slice(0, 10) : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
      byDate.set(dateKey, Number(pt.value ?? 0));
    }
  }

  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, reach]) => ({
      date,
      label: formatShortDateLabel(date),
      reach,
    }));
}

interface MetaMediaItem {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  insights?: {
    data?: Array<{
      name: string;
      values?: Array<{ value?: number }>;
    }>;
  };
}

async function fetchMediaPosts(
  cfg: ReturnType<typeof getInstagramConfig>,
  sinceDate: string,
  untilDate: string,
  allTime = false,
): Promise<InstagramPostInsight[]> {
  const fields =
    "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count,insights.metric(views,reach,total_interactions,shares,saved)";
  let nextUrl: string | null =
    `${cfg.host}/${cfg.version}/${encodeURIComponent(cfg.accountId)}/media?fields=${encodeURIComponent(fields)}&limit=25&access_token=${encodeURIComponent(cfg.token)}`;

  const collected: InstagramPostInsight[] = [];
  const MAX_PAGES = allTime ? 8 : 4;

  for (let page = 0; page < MAX_PAGES && nextUrl; page++) {
    const res: { data?: MetaMediaItem[]; paging?: { next?: string } } = await metaFetch(nextUrl, 20_000);
    const items = res.data ?? [];
    if (items.length === 0) break;

    let passedOlderThanSince = false;
    for (const item of items) {
      const dateKey = toWibDateKey(item.timestamp);
      if (!dateKey) continue;
      if (!allTime) {
        if (dateKey < sinceDate) {
          passedOlderThanSince = true;
          continue;
        }
        if (dateKey > untilDate) continue;
      }

      const metricMap: Record<string, number> = {};
      for (const m of item.insights?.data ?? []) {
        metricMap[m.name] = Number(m.values?.[0]?.value ?? 0);
      }

      const likes = Number(item.like_count ?? 0);
      const comments = Number(item.comments_count ?? 0);
      const shares = metricMap.shares ?? 0;
      const saves = metricMap.saved ?? 0;
      const views = metricMap.views ?? 0;
      const reach = metricMap.reach ?? 0;
      const totalInteractions = metricMap.total_interactions ?? likes + comments + shares + saves;

      let mediaLabel = "Post";
      if (item.media_product_type === "REELS") mediaLabel = "Reel";
      else if (item.media_type === "CAROUSEL_ALBUM") mediaLabel = "Carousel";
      else if (item.media_type === "VIDEO") mediaLabel = "Video";

      collected.push({
        id: item.id,
        caption: (item.caption ?? "").replace(/\s+/g, " ").trim() || "Untitled post",
        mediaType: mediaLabel,
        permalink: item.permalink || `https://instagram.com/gdgjakarta`,
        thumbnailUrl: item.thumbnail_url || item.media_url || null,
        timestamp: item.timestamp || dateKey,
        views,
        reach,
        totalInteractions,
        likes,
        comments,
        shares,
        saves,
        engagementRatePct: reach > 0 ? Math.round((totalInteractions / reach) * 1000) / 10 : 0,
      });
    }

    if (passedOlderThanSince) break;
    nextUrl = res.paging?.next ?? null;
  }

  return collected;
}

async function fetchDemographicBreakdown(
  cfg: ReturnType<typeof getInstagramConfig>,
  breakdown: "age" | "gender",
  timeframe: "last_14_days" | "last_30_days" | "last_90_days",
): Promise<BreakdownItem[]> {
  const qs = new URLSearchParams({
    metric: "follower_demographics",
    period: "lifetime",
    timeframe,
    metric_type: "total_value",
    breakdown,
    access_token: cfg.token,
  });
  const url = `${cfg.host}/${cfg.version}/${encodeURIComponent(cfg.accountId)}/insights?${qs.toString()}`;
  const res = await metaFetch<{ data?: MetaInsightMetric[] }>(url);
  const results = res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];

  const genderLabels: Record<string, string> = {
    M: "Male",
    F: "Female",
    U: "Unspecified",
  };
  const ageOrder = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

  const raw = results.map((r) => {
    const key = (r.dimension_values?.[0] ?? "U").trim();
    const count = Number(r.value ?? 0);
    return {
      key,
      label: breakdown === "gender" ? (genderLabels[key.toUpperCase()] ?? key) : key,
      count,
    };
  });

  if (breakdown === "age") {
    raw.sort((a, b) => {
      const ia = ageOrder.indexOf(a.key);
      const ib = ageOrder.indexOf(b.key);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  } else {
    raw.sort((a, b) => b.count - a.count);
  }

  const total = raw.reduce((acc, item) => acc + item.count, 0);
  return raw.map((item) => ({
    ...item,
    pct: calcSharePct(item.count, total),
  }));
}

interface MetaAdItem {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  adset?: {
    effective_status?: string;
    start_time?: string;
    end_time?: string;
  };
  creative?: {
    source_instagram_media_id?: string;
    effective_instagram_media_id?: string;
    thumbnail_url?: string;
  };
  insights?: {
    data?: Array<{
      spend?: string | number;
      impressions?: string | number;
      reach?: string | number;
      clicks?: string | number;
      account_currency?: string;
    }>;
  };
}

function cleanAdPostName(name?: string): string {
  const cleaned = (name ?? "")
    .replace(/^(Instagram post|Postingan Instagram)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Boosted Instagram Post";
}

async function fetchInstagramAdsData(
  cfg: ReturnType<typeof getInstagramConfig>,
  sinceDate: string,
  untilDate: string,
  allTime: boolean,
): Promise<{
  summary: InstagramAdsSummary;
  byMediaId: Map<string, NonNullable<InstagramPostInsight["adBoost"]>>;
  boostedPosts: InstagramBoostedPost[];
} | null> {
  let rawAdAccountId = process.env.META_AD_ACCOUNT_ID?.trim() ?? "";
  let defaultCurrency = "IDR";

  if (!rawAdAccountId) {
    try {
      const accRes = await metaFetch<{ data?: Array<{ id?: string; currency?: string }> }>(
        `${cfg.host}/${cfg.version}/me/adaccounts?fields=id,currency&limit=1&access_token=${encodeURIComponent(cfg.token)}`,
        10_000,
      );
      rawAdAccountId = accRes.data?.[0]?.id?.trim() ?? "";
      if (accRes.data?.[0]?.currency) defaultCurrency = accRes.data[0].currency;
    } catch {
      return null;
    }
  }

  if (!rawAdAccountId) return null;
  const adAccountId = rawAdAccountId.startsWith("act_") ? rawAdAccountId : `act_${rawAdAccountId}`;

  const insightsSpec = allTime
    ? "insights.date_preset(maximum){spend,impressions,reach,clicks,account_currency}"
    : `insights.time_range(${JSON.stringify({ since: sinceDate, until: untilDate })}){spend,impressions,reach,clicks,account_currency}`;
  const fields = `id,name,status,effective_status,adset{effective_status,start_time,end_time},creative{source_instagram_media_id,effective_instagram_media_id,thumbnail_url},${insightsSpec}`;

  let nextUrl: string | null =
    `${cfg.host}/${cfg.version}/${encodeURIComponent(adAccountId)}/ads?fields=${encodeURIComponent(fields)}&limit=100&access_token=${encodeURIComponent(cfg.token)}`;

  const nowMs = Date.now();
  const byMediaId = new Map<string, NonNullable<InstagramPostInsight["adBoost"]>>();
  const boostedByPostKey = new Map<string, InstagramBoostedPost>();
  let activeAdsCount = 0;
  let totalAdsCount = 0;
  let totalSpend = 0;
  let currency = defaultCurrency;

  for (let page = 0; page < 4 && nextUrl; page++) {
    const res: { data?: MetaAdItem[]; paging?: { next?: string } } = await metaFetch(nextUrl, 15_000);
    const ads = res.data ?? [];
    if (ads.length === 0) break;

    for (const ad of ads) {
      const insight = ad.insights?.data?.[0];
      const spend = Number(insight?.spend ?? 0);
      const impressions = Number(insight?.impressions ?? 0);
      const reach = Number(insight?.reach ?? 0);
      const clicks = Number(insight?.clicks ?? 0);
      if (insight?.account_currency) currency = insight.account_currency;

      // Meta keeps boosted-post effective_status as ACTIVE even after adset.end_time has passed
      const endTimeMs = ad.adset?.end_time ? Date.parse(ad.adset.end_time) : Number.NaN;
      const isCurrentlyActive =
        ad.effective_status === "ACTIVE" &&
        (!ad.adset?.effective_status || ad.adset.effective_status === "ACTIVE") &&
        (Number.isNaN(endTimeMs) || endTimeMs > nowMs);

      if (isCurrentlyActive) activeAdsCount += 1;
      if (!allTime && spend <= 0 && !isCurrentlyActive) continue;

      totalAdsCount += 1;
      totalSpend += spend;

      const sourceId = ad.creative?.source_instagram_media_id?.trim();
      const effectiveId = ad.creative?.effective_instagram_media_id?.trim();
      const canonicalPostKey = sourceId || effectiveId || ad.id;

      const existingPost = boostedByPostKey.get(canonicalPostKey);
      const adTimestamp = ad.adset?.end_time || ad.adset?.start_time || null;
      if (existingPost) {
        existingPost.adCount += 1;
        existingPost.activeAdCount += isCurrentlyActive ? 1 : 0;
        existingPost.spend = Math.round(existingPost.spend + spend);
        existingPost.impressions += impressions;
        existingPost.reach += reach;
        existingPost.clicks += clicks;
        existingPost.currency = currency;
        if (!existingPost.thumbnailUrl && ad.creative?.thumbnail_url) {
          existingPost.thumbnailUrl = ad.creative.thumbnail_url;
        }
      } else {
        boostedByPostKey.set(canonicalPostKey, {
          mediaId: canonicalPostKey,
          caption: cleanAdPostName(ad.name),
          mediaType: null,
          permalink: "https://instagram.com/gdgjakarta",
          thumbnailUrl: ad.creative?.thumbnail_url ?? null,
          timestamp: adTimestamp,
          adCount: 1,
          activeAdCount: isCurrentlyActive ? 1 : 0,
          spend: Math.round(spend),
          currency,
          impressions,
          reach,
          clicks,
        });
      }

      const mediaIds = new Set([sourceId, effectiveId].filter((id): id is string => Boolean(id)));
      for (const mediaId of mediaIds) {
        const existing = byMediaId.get(mediaId);
        if (existing) {
          existing.adCount += 1;
          existing.activeAdCount += isCurrentlyActive ? 1 : 0;
          existing.spend += spend;
          existing.currency = currency;
        } else {
          byMediaId.set(mediaId, {
            adCount: 1,
            activeAdCount: isCurrentlyActive ? 1 : 0,
            spend,
            currency,
          });
        }
      }
    }

    nextUrl = res.paging?.next ?? null;
  }

  const boostedPosts = Array.from(boostedByPostKey.values()).sort(
    (a, b) => b.activeAdCount - a.activeAdCount || b.spend - a.spend,
  );

  return {
    summary: {
      accountId: adAccountId,
      currency,
      activeAdsCount,
      totalAdsCount,
      boostedPostsCount: boostedByPostKey.size,
      totalSpend: Math.round(totalSpend),
    },
    byMediaId,
    boostedPosts,
  };
}

export async function fetchInstagramInsights(
  window: ResolvedDateWindow,
  options: { cached?: boolean } = {},
): Promise<InstagramAnalyticsPayload> {
  const rangeMeta = {
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
    cached: Boolean(options.cached),
  };

  if (!isInstagramConfigured()) {
    return {
      domain: "instagram",
      configured: false,
      range: rangeMeta,
      isChunked: false,
      partialWarnings: [],
      profile: null,
      kpis: null,
      rates: null,
      dailyReach: [],
      postsAnalyzedCount: 0,
      topPostsByInteractions: [],
      topPostsByViews: [],
      demographics: null,
    };
  }

  const cfg = getInstagramConfig();
  const isAllTime = window.mode === "all_time";
  // Account-level Meta Insights cap single queries at 30d; for All Time use trailing 90d for account totals while Top Posts rank all-time media
  const accountSince = isAllTime ? addDays(window.apiUntilDate, -89) : window.sinceDate;
  const isChunked = chunkDateRange(accountSince, window.apiUntilDate, 30).length > 1;
  const partialWarnings: string[] = [];
  if (isAllTime) {
    partialWarnings.push("Account totals show Meta's trailing 90-day window; Top Posts rank all-time media.");
  }

  let demoTimeframe: "last_14_days" | "last_30_days" | "last_90_days" = "last_30_days";
  let demoTimeframeLabel = "Last 30 Days";
  if (window.dayCount <= 14) {
    demoTimeframe = "last_14_days";
    demoTimeframeLabel = "Last 14 Days";
  } else if (isAllTime || window.dayCount > 30) {
    demoTimeframe = "last_90_days";
    demoTimeframeLabel = "Last 90 Days";
  }

  const profileUrl = `${cfg.host}/${cfg.version}/${encodeURIComponent(cfg.accountId)}?fields=id,username,name,followers_count,follows_count,media_count,profile_picture_url&access_token=${encodeURIComponent(cfg.token)}`;

  const [
    profileRes,
    curTotalsRes,
    prevTotalsRes,
    viewsSplitRes,
    reachSplitRes,
    followsRes,
    dailyReachRes,
    mediaRes,
    genderRes,
    ageRes,
    adsRes,
  ] = await Promise.allSettled([
    metaFetch<{
      id: string;
      username?: string;
      name?: string;
      followers_count?: number;
      follows_count?: number;
      media_count?: number;
      profile_picture_url?: string;
    }>(profileUrl),
    fetchCoreTotals(cfg, accountSince, window.apiUntilDate),
    isAllTime ? Promise.resolve(null) : fetchCoreTotals(cfg, window.prevSinceDate, window.prevUntilDate),
    fetchIsolatedFollowBreakdown(cfg, "views", accountSince, window.apiUntilDate),
    fetchIsolatedFollowBreakdown(cfg, "reach", accountSince, window.apiUntilDate),
    fetchIsolatedFollowBreakdown(cfg, "follows_and_unfollows", accountSince, window.apiUntilDate),
    fetchDailyReachSeries(cfg, accountSince, window.apiUntilDate),
    fetchMediaPosts(cfg, window.sinceDate, window.apiUntilDate, isAllTime),
    fetchDemographicBreakdown(cfg, "gender", demoTimeframe),
    fetchDemographicBreakdown(cfg, "age", demoTimeframe),
    fetchInstagramAdsData(cfg, window.sinceDate, window.apiUntilDate, isAllTime),
  ]);

  // If both profile and core totals failed with a fatal auth/rate-limit error, surface it clearly
  if (profileRes.status === "rejected" && curTotalsRes.status === "rejected") {
    const err = curTotalsRes.reason instanceof Error ? curTotalsRes.reason : new Error("Meta API request failed");
    return {
      domain: "instagram",
      configured: true,
      error: err.message,
      errorCode: err instanceof MetaApiError ? err.code : undefined,
      range: rangeMeta,
      isChunked,
      partialWarnings,
      profile: null,
      kpis: null,
      rates: null,
      dailyReach: [],
      postsAnalyzedCount: 0,
      topPostsByInteractions: [],
      topPostsByViews: [],
      demographics: null,
    };
  }

  const profile =
    profileRes.status === "fulfilled"
      ? {
          username: profileRes.value.username || "gdgjakarta",
          name: profileRes.value.name || "GDG Jakarta",
          followersCount: Number(profileRes.value.followers_count ?? 0),
          followsCount: Number(profileRes.value.follows_count ?? 0),
          mediaCount: Number(profileRes.value.media_count ?? 0),
          profilePictureUrl: profileRes.value.profile_picture_url ?? null,
        }
      : null;

  if (profileRes.status === "rejected") {
    partialWarnings.push("Profile snapshot unavailable.");
  }

  const cur = curTotalsRes.status === "fulfilled" ? curTotalsRes.value : {};
  const prev = prevTotalsRes.status === "fulfilled" ? prevTotalsRes.value : null;

  if (curTotalsRes.status === "rejected") {
    partialWarnings.push(
      curTotalsRes.reason instanceof Error ? curTotalsRes.reason.message : "Core insights unavailable for this range.",
    );
  }
  if (prevTotalsRes.status === "rejected") {
    partialWarnings.push("Prior-period comparison unavailable (outside Meta retention window).");
  }

  const viewsCur = cur.views ?? 0;
  const viewsPrev = prev ? (prev.views ?? 0) : null;
  const reachCur = cur.reach ?? 0;
  const reachPrev = prev ? (prev.reach ?? 0) : null;
  const interactionsCur = cur.total_interactions ?? 0;
  const interactionsPrev = prev ? (prev.total_interactions ?? 0) : null;
  const engagedCur = cur.accounts_engaged ?? 0;
  const engagedPrev = prev ? (prev.accounts_engaged ?? 0) : null;

  // Audience split: prefer `views` breakdown, fall back to `reach` breakdown
  let split = { follower: 0, nonFollower: 0, unknown: 0 };
  let metricSource: "views" | "reach" | "none" = "none";
  if (viewsSplitRes.status === "fulfilled" && viewsSplitRes.value.follower + viewsSplitRes.value.nonFollower > 0) {
    split = viewsSplitRes.value;
    metricSource = "views";
  } else if (
    reachSplitRes.status === "fulfilled" &&
    reachSplitRes.value.follower + reachSplitRes.value.nonFollower > 0
  ) {
    split = reachSplitRes.value;
    metricSource = "reach";
  }

  const knownSplitTotal = split.follower + split.nonFollower;
  const followersPct = calcSharePct(split.follower, knownSplitTotal);
  const nonFollowersPct = knownSplitTotal > 0 ? Math.round((100 - followersPct) * 10) / 10 : 0;

  let netFollowerChange: number | null = null;
  if (followsRes.status === "fulfilled") {
    const f = followsRes.value;
    if (f.follower > 0 || f.nonFollower > 0) {
      // Verified live on @gdgjakarta: FOLLOWER = new follows, NON_FOLLOWER = unfollows
      netFollowerChange = f.follower - f.nonFollower;
    }
  }

  const engagementRateByReachPct = reachCur > 0 ? Math.round((engagedCur / reachCur) * 1000) / 10 : 0;
  const interactionRateByReachPct = reachCur > 0 ? Math.round((interactionsCur / reachCur) * 1000) / 10 : 0;

  const interactionItems = [
    { key: "likes", label: "Likes", count: cur.likes ?? 0 },
    { key: "comments", label: "Comments", count: cur.comments ?? 0 },
    { key: "shares", label: "Shares", count: cur.shares ?? 0 },
    { key: "saves", label: "Saves", count: cur.saves ?? 0 },
  ];
  const mixTotal = interactionItems.reduce((acc, i) => acc + i.count, 0) || interactionsCur;
  const interactionMix: BreakdownItem[] = interactionItems.map((i) => ({
    ...i,
    pct: calcSharePct(i.count, mixTotal),
  }));

  const dailyReach = dailyReachRes.status === "fulfilled" ? dailyReachRes.value : [];
  if (mediaRes.status === "rejected") {
    partialWarnings.push("Top posts insights timed out or were unavailable from Meta.");
  }
  const adsData = adsRes.status === "fulfilled" ? adsRes.value : null;
  const posts = (mediaRes.status === "fulfilled" ? mediaRes.value : []).map((post) => ({
    ...post,
    adBoost: adsData?.byMediaId.get(post.id) ?? null,
  }));
  const postsById = new Map(posts.map((p) => [p.id, p]));
  const boostedPosts: InstagramBoostedPost[] = (adsData?.boostedPosts ?? []).map((bp) => {
    const matched = postsById.get(bp.mediaId);
    if (!matched) return bp;
    return {
      ...bp,
      caption: matched.caption,
      mediaType: matched.mediaType,
      permalink: matched.permalink,
      thumbnailUrl: matched.thumbnailUrl ?? bp.thumbnailUrl,
      timestamp: matched.timestamp,
    };
  });
  const topPostsByInteractions = [...posts].sort((a, b) => b.totalInteractions - a.totalInteractions).slice(0, 5);
  const topPostsByViews = [...posts].sort((a, b) => b.views - a.views).slice(0, 5);

  const gender = genderRes.status === "fulfilled" ? genderRes.value : [];
  const age = ageRes.status === "fulfilled" ? ageRes.value : [];
  const demographics =
    gender.length > 0 || age.length > 0
      ? {
          timeframeLabel: demoTimeframeLabel,
          gender,
          age,
        }
      : null;

  return {
    domain: "instagram",
    configured: true,
    range: rangeMeta,
    isChunked,
    partialWarnings,
    profile,
    kpis: {
      views: { current: viewsCur, previous: viewsPrev, deltaPct: calcDeltaPct(viewsCur, viewsPrev) },
      reach: { current: reachCur, previous: reachPrev, deltaPct: calcDeltaPct(reachCur, reachPrev) },
      totalInteractions: {
        current: interactionsCur,
        previous: interactionsPrev,
        deltaPct: calcDeltaPct(interactionsCur, interactionsPrev),
      },
      accountsEngaged: {
        current: engagedCur,
        previous: engagedPrev,
        deltaPct: calcDeltaPct(engagedCur, engagedPrev),
      },
      followersCount: profile?.followersCount ?? 0,
      netFollowerChange,
    },
    rates: {
      engagementRateByReachPct,
      interactionRateByReachPct,
      audienceSplit: {
        followersPct,
        nonFollowersPct,
        unknownCount: split.unknown,
        metricSource,
      },
      interactionMix,
    },
    dailyReach,
    postsAnalyzedCount: posts.length,
    topPostsByInteractions,
    topPostsByViews,
    adsSummary: adsData?.summary ?? null,
    boostedPosts,
    demographics,
  };
}
