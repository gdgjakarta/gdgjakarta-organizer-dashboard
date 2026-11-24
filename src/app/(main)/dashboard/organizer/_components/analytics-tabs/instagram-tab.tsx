"use client";

import {
  AlertCircle,
  BarChart3,
  Bookmark,
  ExternalLink,
  Eye,
  Flame,
  Heart,
  KeyRound,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Share2,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { siInstagram } from "simple-icons";

import { SimpleIcon } from "@/components/simple-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { InstagramAnalyticsPayload, InstagramPostInsight } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

import { formatCompactNumber, formatHumanDate, formatIdr, KpiTile, MetricInfoPopup } from "./shared-kpi";

function formatAdSpend(amount: number, currency: string): string {
  if (currency.toUpperCase() === "IDR") return formatIdr(amount);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

function formatCompactAdSpend(amount: number, currency: string): string {
  const compact = formatCompactNumber(Math.round(amount));
  if (currency.toUpperCase() === "IDR") return `Rp${compact}`;
  return `${currency} ${compact}`;
}

const chartConfig = {
  reach: {
    label: "Daily Reach",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function getMediaTypeBadgeClass(mediaType: string): string {
  switch (mediaType) {
    case "Reel":
      return "border-pink-500/25 bg-pink-500/10 text-pink-600 dark:text-pink-400";
    case "Carousel":
      return "border-purple-500/25 bg-purple-500/10 text-purple-600 dark:text-purple-400";
    case "Video":
      return "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    default:
      return "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400";
  }
}

function PostList({
  title,
  icon,
  posts,
  highlightMetric,
}: {
  title: string;
  icon: React.ReactNode;
  posts: InstagramPostInsight[];
  highlightMetric: "interactions" | "views";
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-2.5 flex items-center gap-1.5 font-medium text-foreground text-xs">
        {icon}
        <span>{title}</span>
      </div>
      {posts.length === 0 ? (
        <p className="py-4 text-center text-muted-foreground text-xs">No posts published in this period.</p>
      ) : (
        <div className="space-y-2.5">
          {posts.map((post) => (
            <a
              key={`${highlightMetric}-${post.id}`}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 rounded-md border bg-background/60 p-2 transition-colors hover:bg-muted/40"
            >
              <Avatar className="size-10 shrink-0 rounded-md">
                <AvatarImage src={post.thumbnailUrl ?? undefined} alt={post.caption} className="object-cover" />
                <AvatarFallback className="rounded-md text-[10px]">IG</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 px-1.5 py-0 text-[9px]", getMediaTypeBadgeClass(post.mediaType))}
                  >
                    {post.mediaType}
                  </Badge>
                  {post.adBoost ? (
                    <Badge
                      variant="outline"
                      title={
                        post.adBoost.activeAdCount > 0
                          ? `${post.adBoost.activeAdCount} active of ${post.adBoost.adCount} ad(s) · Spend: ${formatAdSpend(post.adBoost.spend, post.adBoost.currency)}`
                          : `Boosted (${post.adBoost.adCount} ad${post.adBoost.adCount > 1 ? "s" : ""}) · Spend: ${formatAdSpend(post.adBoost.spend, post.adBoost.currency)}`
                      }
                      className={cn(
                        "shrink-0 gap-1 px-1.5 py-0 text-[9px] tabular-nums",
                        post.adBoost.activeAdCount > 0
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
                      )}
                    >
                      <Megaphone className="size-2.5" aria-hidden="true" />
                      <span>
                        {post.adBoost.activeAdCount > 0 ? "Ads Active" : "Ads"}
                        {post.adBoost.spend > 0
                          ? ` · ${formatCompactAdSpend(post.adBoost.spend, post.adBoost.currency)}`
                          : ""}
                      </span>
                    </Badge>
                  ) : null}
                  <span className="truncate font-medium text-foreground text-xs group-hover:underline">
                    {post.caption}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground tabular-nums">
                  <span>{formatHumanDate(post.timestamp)}</span>
                  <span className="inline-flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1" title="Likes">
                      <Heart className="size-3" aria-hidden="true" />
                      {formatCompactNumber(post.likes)}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Comments">
                      <MessageCircle className="size-3" aria-hidden="true" />
                      {formatCompactNumber(post.comments)}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Shares">
                      <Share2 className="size-3" aria-hidden="true" />
                      {formatCompactNumber(post.shares)}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Saves">
                      <Bookmark className="size-3" aria-hidden="true" />
                      {formatCompactNumber(post.saves)}
                    </span>
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <div className="flex items-center justify-end font-semibold text-foreground text-xs">
                  {highlightMetric === "interactions" ? (
                    <span className="inline-flex items-center gap-1" title="Total interactions">
                      <Flame className="size-3.5" aria-hidden="true" />
                      {post.totalInteractions.toLocaleString()}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1" title="Views">
                      <Eye className="size-3.5" aria-hidden="true" />
                      {formatCompactNumber(post.views)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                  {highlightMetric === "interactions" ? (
                    <>
                      <span className="inline-flex items-center gap-1" title="Engagement rate">
                        <BarChart3 className="size-3" aria-hidden="true" />
                        {post.engagementRatePct}%
                      </span>
                      <span className="inline-flex items-center gap-1" title="Views">
                        <Eye className="size-3" aria-hidden="true" />
                        {formatCompactNumber(post.views)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1" title="Total interactions">
                        <Flame className="size-3" aria-hidden="true" />
                        {post.totalInteractions.toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1" title="Engagement rate">
                        <BarChart3 className="size-3" aria-hidden="true" />
                        {post.engagementRatePct}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function InstagramTab({ data, isExpanded }: { data: InstagramAnalyticsPayload; isExpanded: boolean }) {
  if (!data.configured) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400">
              <SimpleIcon icon={siInstagram} className="size-4 fill-current" aria-hidden="true" />
            </div>
            <div>
              <a
                href="https://instagram.com/gdgjakarta"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-foreground text-xs hover:underline"
              >
                @gdgjakarta
                <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
              </a>
              <p className="text-[11px] text-muted-foreground">Instagram Business Insights</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            Not Connected
          </Badge>
        </div>

        <Alert>
          <KeyRound className="size-4" />
          <AlertTitle className="font-semibold text-xs">Connect Meta Graph API for @gdgjakarta</AlertTitle>
          <AlertDescription className="space-y-1.5 text-xs">
            <p>
              Provision a non-expiring Meta Business System User token (<code>instagram_basic</code>,{" "}
              <code>instagram_manage_insights</code>, <code>pages_read_engagement</code>) as server-side secrets:
            </p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                <code>INSTAGRAM_ACCESS_TOKEN</code> (via <code>.env.local</code> / <code>wrangler secret put</code>)
              </li>
              <li>
                <code>INSTAGRAM_BUSINESS_ACCOUNT_ID</code> (IG Business Account ID for @gdgjakarta)
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (data.error && !data.kpis) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle className="font-semibold text-xs">Instagram API Error</AlertTitle>
        <AlertDescription className="text-xs">{data.error}</AlertDescription>
      </Alert>
    );
  }

  const kpis = data.kpis;
  const rates = data.rates;
  const split = rates?.audienceSplit;
  let kpiGridCols = "grid-cols-2";
  if (isExpanded) {
    kpiGridCols = data.adsSummary ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-4";
  }

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-2.5">
          {data.profile?.profilePictureUrl ? (
            <Avatar className="size-7">
              <AvatarImage src={data.profile.profilePictureUrl} alt={`@${data.profile.username}`} />
              <AvatarFallback className="text-[10px]">IG</AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex size-7 items-center justify-center rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400">
              <SimpleIcon icon={siInstagram} className="size-4 fill-current" aria-hidden="true" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <a
              href={`https://instagram.com/${data.profile?.username || "gdgjakarta"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-foreground text-xs hover:underline"
            >
              @{data.profile?.username || "gdgjakarta"}
              <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
            </a>
            {data.profile ? (
              <Badge variant="outline" className="text-[10px] tabular-nums">
                {formatCompactNumber(data.profile.followersCount)} followers
              </Badge>
            ) : null}
          </div>
        </div>

        {rates ? (
          <div className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
            <span>Engagement Rate:</span>
            <strong className="text-foreground tabular-nums">{rates.engagementRateByReachPct}%</strong>
            <MetricInfoPopup
              title="Engagement Rate by Reach"
              description={`Calculated as (Accounts Engaged ÷ Reach) × 100. Interaction Rate by Reach (Total Interactions ÷ Reach) is ${rates.interactionRateByReachPct}%.`}
            />
          </div>
        ) : null}
      </div>

      {kpis ? (
        <div className={cn("grid gap-2.5", kpiGridCols)}>
          <KpiTile
            label="Views"
            value={formatCompactNumber(kpis.views.current)}
            deltaPct={kpis.views.deltaPct}
            subtext={kpis.views.previous !== null ? `vs ${formatCompactNumber(kpis.views.previous)}` : undefined}
            info="Total number of times @gdgjakarta Reels, Posts, and Stories were played or displayed (includes repeat views)."
          />
          <KpiTile
            label="Reach"
            value={formatCompactNumber(kpis.reach.current)}
            deltaPct={kpis.reach.deltaPct}
            subtext={data.isChunked ? "Summed per <=30d chunk" : undefined}
            info={
              data.isChunked
                ? "Unique accounts that saw your content at least once. Because Meta caps single requests at 30 days, this range is summed across <=30-day sub-windows."
                : "Unique accounts that saw your content at least once during the selected period."
            }
          />
          <KpiTile
            label="Interactions"
            value={formatCompactNumber(kpis.totalInteractions.current)}
            deltaPct={kpis.totalInteractions.deltaPct}
            subtext={rates ? `${rates.engagementRateByReachPct}% eng. rate` : undefined}
            info="Combined Likes, Comments, Shares, and Saves across Posts, Reels, Stories, and Live videos."
          />
          <KpiTile
            label="Followers"
            value={formatCompactNumber(kpis.followersCount)}
            subtext={
              kpis.netFollowerChange !== null
                ? `${kpis.netFollowerChange >= 0 ? "+" : ""}${kpis.netFollowerChange} net in period`
                : "Current account total"
            }
            info="Current total followers on @gdgjakarta. Net change equals New Follows minus Unfollows within the selected period."
          />
          {data.adsSummary ? (
            <>
              <KpiTile
                label="Active Ads"
                value={String(data.adsSummary.activeAdsCount)}
                subtext={`${data.adsSummary.totalAdsCount} total · ${data.adsSummary.boostedPostsCount} posts`}
                info="Number of currently running Meta Ads (effective status ACTIVE with end time in the future or ongoing). Total reflects ads with spend in the selected period."
              />
              <KpiTile
                label="Ad Spend"
                value={formatAdSpend(data.adsSummary.totalSpend, data.adsSummary.currency)}
                subtext={`Meta Ads (${data.adsSummary.currency})`}
                info="Total Meta Ads spend for boosted Instagram posts in the selected date window (or lifetime spend for All Time)."
              />
            </>
          ) : null}
        </div>
      ) : null}

      {/* Followers vs Non-Followers % Split Bar */}
      {split && split.metricSource !== "none" ? (
        <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">
              Audience Split ({split.metricSource === "views" ? "Views" : "Reach"})
            </span>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-pink-600 dark:text-pink-400">Followers {split.followersPct}%</span>
              <span className="text-indigo-600 dark:text-indigo-400">Non-Followers {split.nonFollowersPct}%</span>
            </div>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-pink-500" style={{ width: `${split.followersPct}%` }} />
            <div className="h-full bg-indigo-500" style={{ width: `${split.nonFollowersPct}%` }} />
          </div>
          {split.unknownCount > 0 ? (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              Excludes {split.unknownCount.toLocaleString()} unattributed impressions.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Daily Reach Chart + Interaction Mix */}
      <div className={cn("grid gap-4", isExpanded ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1")}>
        <div className={cn("rounded-lg border bg-muted/20 p-3", isExpanded && "lg:col-span-8")}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium text-foreground text-xs">Daily Reach</span>
            <span className="text-[11px] text-muted-foreground">Meta insights lag up to 48h</span>
          </div>
          {data.dailyReach.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground text-xs">
              No daily reach data returned for this window.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-40 w-full">
              <BarChart data={data.dailyReach} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} fontSize={11} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  fontSize={11}
                  tickFormatter={(v: number) => formatCompactNumber(v)}
                />
                <ChartTooltip content={<ChartTooltipContent className="[&_.justify-between]:gap-4" />} />
                <Bar dataKey="reach" fill="var(--color-reach)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        {rates && rates.interactionMix.length > 0 ? (
          <div className={cn("rounded-lg border bg-muted/20 p-3", isExpanded && "lg:col-span-4")}>
            <div className="mb-2 font-medium text-foreground text-xs">Interaction Mix</div>
            <div className="space-y-2">
              {rates.interactionMix.map((item) => {
                let mixIcon: React.ReactNode = null;
                if (item.key === "likes") mixIcon = <Heart className="size-3.5" aria-hidden="true" />;
                else if (item.key === "comments") mixIcon = <MessageCircle className="size-3.5" aria-hidden="true" />;
                else if (item.key === "shares") mixIcon = <Share2 className="size-3.5" aria-hidden="true" />;
                else if (item.key === "saves") mixIcon = <Bookmark className="size-3.5" aria-hidden="true" />;
                return (
                  <div key={item.key} className="flex items-center justify-between text-xs tabular-nums">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      {mixIcon}
                      <span>{item.label}</span>
                    </span>
                    <span className="font-medium text-foreground">
                      {item.count.toLocaleString()} <span className="text-muted-foreground">({item.pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Users Overview: Gender & Age Demographics */}
      {data.demographics ? (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
              <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Follower Demographics</span>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {data.demographics.timeframeLabel}
            </Badge>
          </div>

          <div className={cn("grid gap-4", isExpanded ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
            {/* Gender */}
            {data.demographics.gender.length > 0 ? (
              <div className="space-y-2">
                <div className="font-medium text-[11px] text-muted-foreground">Gender</div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                  {data.demographics.gender.map((g) => {
                    let barColor = "bg-slate-400";
                    if (g.key === "M") barColor = "bg-indigo-500";
                    else if (g.key === "F") barColor = "bg-pink-500";
                    return <div key={g.key} className={cn("h-full", barColor)} style={{ width: `${g.pct}%` }} />;
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
                  {data.demographics.gender.map((g) => {
                    let dotColor = "bg-slate-400";
                    if (g.key === "M") dotColor = "bg-indigo-500";
                    else if (g.key === "F") dotColor = "bg-pink-500";
                    return (
                      <div key={g.key} className="rounded-md border bg-background/60 px-2 py-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className={cn("size-2 rounded-full", dotColor)} />
                          <span>{g.label}</span>
                        </div>
                        <div className="mt-0.5 font-semibold text-foreground">
                          {g.pct}%{" "}
                          <span className="font-normal text-[10px] text-muted-foreground">
                            ({formatCompactNumber(g.count)})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Age */}
            {data.demographics.age.length > 0 ? (
              <div className="space-y-1.5">
                <div className="font-medium text-[11px] text-muted-foreground">Age Distribution</div>
                <div className="space-y-1.5">
                  {data.demographics.age.map((a) => (
                    <div key={a.key} className="flex items-center gap-2 text-xs tabular-nums">
                      <span className="w-11 shrink-0 text-[11px] text-muted-foreground">{a.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${Math.min(100, a.pct)}%` }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right text-[11px] text-foreground">
                        {a.pct}% <span className="text-muted-foreground">({formatCompactNumber(a.count)})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Top Performing Posts: Most Interacted & Highest Views / Impressions */}
      <div className={cn("grid gap-4", isExpanded ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
        <PostList
          title="Most Interacted Posts"
          icon={<Flame className="size-3.5 text-pink-600 dark:text-pink-400" aria-hidden="true" />}
          posts={data.topPostsByInteractions}
          highlightMetric="interactions"
        />
        <PostList
          title="Highest Views / Impressions"
          icon={<Eye className="size-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />}
          posts={data.topPostsByViews}
          highlightMetric="views"
        />
      </div>

      {/* Boosted Posts with Meta Ads & Total Spend */}
      {data.adsSummary && (data.boostedPosts?.length ?? 0) > 0 ? (
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
              <Megaphone className="size-3.5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
              <span>Boosted Posts (Meta Ads)</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
                {data.boostedPosts?.length ?? 0} posts · {data.adsSummary.totalAdsCount} ads
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs tabular-nums">
              {data.adsSummary.activeAdsCount > 0 ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-700 dark:text-emerald-400"
                >
                  {data.adsSummary.activeAdsCount} Active
                </Badge>
              ) : null}
              <span className="text-muted-foreground">
                Total Spend:{" "}
                <strong className="text-foreground">
                  {formatAdSpend(data.adsSummary.totalSpend, data.adsSummary.currency)}
                </strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {(data.boostedPosts ?? []).map((bp) => (
              <a
                key={`boosted-${bp.mediaId}`}
                href={bp.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 rounded-md border bg-background/60 p-2 transition-colors hover:bg-muted/40"
              >
                <Avatar className="size-10 shrink-0 rounded-md">
                  <AvatarImage src={bp.thumbnailUrl ?? undefined} alt={bp.caption} className="object-cover" />
                  <AvatarFallback className="rounded-md text-[10px]">AD</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {bp.mediaType ? (
                      <Badge
                        variant="outline"
                        className={cn("shrink-0 px-1.5 py-0 text-[9px]", getMediaTypeBadgeClass(bp.mediaType))}
                      >
                        {bp.mediaType}
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 gap-1 px-1.5 py-0 text-[9px] tabular-nums",
                        bp.activeAdCount > 0
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
                      )}
                    >
                      <Megaphone className="size-2.5" aria-hidden="true" />
                      <span>
                        {bp.activeAdCount > 0
                          ? `${bp.activeAdCount} Active`
                          : `${bp.adCount} ad${bp.adCount > 1 ? "s" : ""}`}
                      </span>
                    </Badge>
                    <span className="truncate font-medium text-foreground text-xs group-hover:underline">
                      {bp.caption}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground tabular-nums">
                    {bp.timestamp ? <span>{formatHumanDate(bp.timestamp)}</span> : null}
                    {bp.impressions > 0 ? (
                      <span className="inline-flex items-center gap-1" title="Ad impressions">
                        <Eye className="size-3" aria-hidden="true" />
                        {formatCompactNumber(bp.impressions)}
                      </span>
                    ) : null}
                    {bp.clicks > 0 ? (
                      <span className="inline-flex items-center gap-1" title="Ad clicks">
                        <MousePointerClick className="size-3" aria-hidden="true" />
                        {formatCompactNumber(bp.clicks)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <div className="font-semibold text-foreground text-xs">{formatAdSpend(bp.spend, bp.currency)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {data.adsSummary && data.adsSummary.totalSpend > 0
                      ? `${Math.round((bp.spend / data.adsSummary.totalSpend) * 1000) / 10}% of spend`
                      : "Boosted"}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {data.partialWarnings.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">{data.partialWarnings.join(" ")}</p>
      ) : null}
    </div>
  );
}
