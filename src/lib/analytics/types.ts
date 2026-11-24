import type { AnalyticsDomain } from "./date-range";

export interface KpiComparisonMetric {
  current: number;
  previous: number | null;
  deltaPct: number | null;
}

export interface ComparisonSeriesPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Nov 1"
  current: number;
  previous: number;
}

export interface CountryMetricRow {
  code: string; // ISO alpha-2
  numericId: string | null; // ISO numeric for world-atlas
  name: string;
  usersOrVisits: number;
  pageViews: number;
  pct: number;
}

export interface BreakdownItem {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export interface AnalyticsRangeMeta {
  mode: "all_time" | "month" | "year" | "date_range";
  month?: string;
  year?: string;
  sinceDate: string;
  untilDate: string;
  prevSinceDate: string;
  prevUntilDate: string;
  dayCount: number;
  label: string;
  prevLabel: string;
  fetchedAt: string;
  cached: boolean;
}

export type WebsiteProviderId = "ga4" | "cloudflare";

export interface WebsiteAnalyticsPayload {
  domain: "website";
  configured: boolean;
  activeProvider: WebsiteProviderId | null;
  availableProviders: WebsiteProviderId[];
  error?: string;
  range: AnalyticsRangeMeta;
  loggedInDashboardUsers: KpiComparisonMetric;
  kpis: {
    pageViews: KpiComparisonMetric;
    totalUsers: KpiComparisonMetric | null; // GA4 only
    newUsers: KpiComparisonMetric | null; // GA4 only
    totalSessions: KpiComparisonMetric; // GA4 sessions or Cloudflare visits
    engagedSessions: KpiComparisonMetric | null; // GA4 only
    engagementRatePct: number | null; // GA4 engagedSessions / sessions
    pagesPerVisit: number | null; // Cloudflare pageViews / visits
  };
  series: ComparisonSeriesPoint[];
  countries: CountryMetricRow[];
  topPaths?: Array<{ path: string; pageViews: number; visits: number }>;
  topReferrers?: Array<{ host: string; pageViews: number; visits: number }>;
}

export interface EventAnalyticsPayload {
  domain: "events";
  configured: true;
  includeTest: boolean;
  range: AnalyticsRangeMeta;
  kpis: {
    eventsCount: KpiComparisonMetric;
    pastEventsCount: number;
    totalAttendees: KpiComparisonMetric;
    totalCheckedIn: KpiComparisonMetric;
    checkInRatePct: number; // Computed strictly across past/completed events
    noShowRatePct: number; // Computed strictly across past/completed events
    avgAttendeesPerEvent: number;
  };
  formatSplit: BreakdownItem[];
  series: Array<{
    date: string;
    label: string;
    attendees: number;
    checkedIn: number;
    events: number;
  }>;
  topEvents: Array<{
    id: string;
    title: string;
    startDate: string;
    audienceType: string;
    attendees: number;
    checkedIn: number;
    checkInRatePct: number | null;
    isPast: boolean;
  }>;
}

export interface TicketAnalyticsPayload {
  domain: "tickets";
  configured: true;
  range: AnalyticsRangeMeta;
  kpis: {
    totalTickets: KpiComparisonMetric;
    paidTickets: KpiComparisonMetric;
    paidConversionPct: number;
    grossPaidRevenueIdr: KpiComparisonMetric;
    ticketRevenueIdr: number;
    merchOrderRevenueIdr: number;
    merchOrdersPaidCount: number;
    voucherAdoptionPct: number;
    referralAdoptionPct: number;
    totalDiscountIdr: number;
  };
  statusFunnel: BreakdownItem[];
  ticketTypeSplit: BreakdownItem[];
  series: ComparisonSeriesPoint[];
}

export interface MemberAnalyticsPayload {
  domain: "members";
  configured: true;
  range: AnalyticsRangeMeta;
  kpis: {
    totalChapterMembers: number;
    newChapterMembers: KpiComparisonMetric;
    activeDashboardMembers: KpiComparisonMetric;
    activeDashboardPct: number;
    repeatAttendeesPct: number;
    emailVerifiedPct: number;
    bevySyncedPct: number;
    referralParticipationPct: number;
  };
  series: ComparisonSeriesPoint[];
  partialWarning?: string;
}

export interface InstagramPostInsight {
  id: string;
  caption: string;
  mediaType: string;
  permalink: string;
  thumbnailUrl: string | null;
  timestamp: string;
  views: number;
  reach: number;
  totalInteractions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRatePct: number;
  adBoost?: {
    adCount: number;
    activeAdCount: number;
    spend: number;
    currency: string;
  } | null;
}

export interface InstagramAdsSummary {
  accountId: string;
  currency: string;
  activeAdsCount: number;
  totalAdsCount: number;
  boostedPostsCount: number;
  totalSpend: number;
}

export interface InstagramBoostedPost {
  mediaId: string;
  caption: string;
  mediaType: string | null;
  permalink: string;
  thumbnailUrl: string | null;
  timestamp: string | null;
  adCount: number;
  activeAdCount: number;
  spend: number;
  currency: string;
  impressions: number;
  reach: number;
  clicks: number;
}

export interface InstagramAnalyticsPayload {
  domain: "instagram";
  configured: boolean;
  error?: string;
  errorCode?: number;
  range: AnalyticsRangeMeta;
  isChunked: boolean;
  partialWarnings: string[];
  profile: {
    username: string;
    name: string;
    followersCount: number;
    followsCount: number;
    mediaCount: number;
    profilePictureUrl: string | null;
  } | null;
  kpis: {
    views: KpiComparisonMetric;
    reach: KpiComparisonMetric;
    totalInteractions: KpiComparisonMetric;
    accountsEngaged: KpiComparisonMetric;
    followersCount: number;
    netFollowerChange: number | null;
  } | null;
  rates: {
    engagementRateByReachPct: number;
    interactionRateByReachPct: number;
    audienceSplit: {
      followersPct: number;
      nonFollowersPct: number;
      unknownCount: number;
      metricSource: "views" | "reach" | "none";
    };
    interactionMix: BreakdownItem[];
  } | null;
  dailyReach: Array<{ date: string; label: string; reach: number }>;
  postsAnalyzedCount: number;
  topPostsByInteractions: InstagramPostInsight[];
  topPostsByViews: InstagramPostInsight[];
  adsSummary?: InstagramAdsSummary | null;
  boostedPosts?: InstagramBoostedPost[];
  demographics: {
    timeframeLabel: string;
    gender: BreakdownItem[];
    age: BreakdownItem[];
  } | null;
}

export type AnalyticsOverviewResponse =
  | WebsiteAnalyticsPayload
  | EventAnalyticsPayload
  | TicketAnalyticsPayload
  | MemberAnalyticsPayload
  | InstagramAnalyticsPayload;

export interface AnalyticsCapabilities {
  websiteConfigured: boolean;
  ga4Configured: boolean;
  cloudflareConfigured: boolean;
  instagramConfigured: boolean;
  defaultTab: AnalyticsDomain;
}
