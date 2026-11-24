import type {
  EventAnalyticsPayload,
  InstagramAnalyticsPayload,
  MemberAnalyticsPayload,
  TicketAnalyticsPayload,
  WebsiteAnalyticsPayload,
} from "./types";

export type ReportPromptPurpose = "proposal" | "partner_report" | "active_tab";

export interface AnalyticsPromptBundle {
  website?: WebsiteAnalyticsPayload;
  events?: EventAnalyticsPayload;
  tickets?: TicketAnalyticsPayload;
  members?: MemberAnalyticsPayload;
  instagram?: InstagramAnalyticsPayload;
}

function fmtDelta(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return "—";
  return delta > 0 ? `+${delta}%` : `${delta}%`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

function fmtIdr(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function renderWebsiteSection(w: WebsiteAnalyticsPayload): string {
  const lines: string[] = ["## 1. Website Analytics (`gdgjakarta.com`)"];
  if (!w.configured) {
    lines.push("- **External Web Traffic**: Not connected yet.");
    lines.push(
      `- **Logged-in Dashboard Users (Firestore)**: ${fmtNum(w.loggedInDashboardUsers.current)} (${fmtDelta(w.loggedInDashboardUsers.deltaPct)} vs prior)`,
    );
    return lines.join("\n");
  }

  lines.push(
    `- **Data Source**: ${w.activeProvider === "ga4" ? "Google Analytics 4 / Firebase" : "Cloudflare Web Analytics"}`,
  );
  lines.push("");
  lines.push("| Metric | Value | Change vs Prior |");
  lines.push("|---|---:|---:|");
  lines.push(`| Page Views | ${fmtNum(w.kpis.pageViews.current)} | ${fmtDelta(w.kpis.pageViews.deltaPct)} |`);
  if (w.kpis.totalUsers) {
    lines.push(`| Total Users | ${fmtNum(w.kpis.totalUsers.current)} | ${fmtDelta(w.kpis.totalUsers.deltaPct)} |`);
  }
  if (w.kpis.newUsers) {
    lines.push(`| New Users | ${fmtNum(w.kpis.newUsers.current)} | ${fmtDelta(w.kpis.newUsers.deltaPct)} |`);
  }
  lines.push(
    `| Logged-in Dashboard Users | ${fmtNum(w.loggedInDashboardUsers.current)} | ${fmtDelta(w.loggedInDashboardUsers.deltaPct)} |`,
  );
  lines.push(
    `| ${w.activeProvider === "ga4" ? "Total Sessions" : "Total Visits"} | ${fmtNum(w.kpis.totalSessions.current)} | ${fmtDelta(w.kpis.totalSessions.deltaPct)} |`,
  );
  if (w.kpis.engagedSessions) {
    lines.push(
      `| Engaged Sessions | ${fmtNum(w.kpis.engagedSessions.current)} (${w.kpis.engagementRatePct ?? 0}% rate) | ${fmtDelta(w.kpis.engagedSessions.deltaPct)} |`,
    );
  }
  if (w.countries.length > 0) {
    lines.push("");
    lines.push(
      `**Top Countries**: ${w.countries
        .slice(0, 6)
        .map((c) => `${c.name} (${fmtNum(c.usersOrVisits)}, ${c.pct}%)`)
        .join(", ")}`,
    );
  }
  return lines.join("\n");
}

function renderEventsSection(e: EventAnalyticsPayload): string {
  const lines: string[] = [
    "## 2. Event Analytics (Bevy Chapter #642)",
    "",
    "| Metric | Value | Change vs Prior |",
    "|---|---:|---:|",
    `| Events in Period | ${fmtNum(e.kpis.eventsCount.current)} (${e.kpis.pastEventsCount} completed) | ${fmtDelta(e.kpis.eventsCount.deltaPct)} |`,
    `| Total Attendees | ${fmtNum(e.kpis.totalAttendees.current)} (Avg ${fmtNum(e.kpis.avgAttendeesPerEvent)}/event) | ${fmtDelta(e.kpis.totalAttendees.deltaPct)} |`,
    `| Total Checked In | ${fmtNum(e.kpis.totalCheckedIn.current)} | ${fmtDelta(e.kpis.totalCheckedIn.deltaPct)} |`,
    `| Check-in Rate (Completed Events) | ${e.kpis.checkInRatePct}% | — |`,
    `| No-Show Rate (Completed Events) | ${e.kpis.noShowRatePct}% | — |`,
  ];

  if (e.formatSplit.length > 0) {
    lines.push("");
    lines.push(`**Event Formats**: ${e.formatSplit.map((f) => `${f.label}: ${f.count} (${f.pct}%)`).join(" · ")}`);
  }
  if (e.topEvents.length > 0) {
    lines.push("");
    lines.push("**Top Events**:");
    for (const ev of e.topEvents) {
      const rate = ev.checkInRatePct !== null ? `${ev.checkInRatePct}% checked in` : "Upcoming";
      lines.push(`- ${ev.title} (${ev.startDate}, ${ev.audienceType}): ${fmtNum(ev.attendees)} attendees, ${rate}`);
    }
  }
  return lines.join("\n");
}

function renderTicketsSection(t: TicketAnalyticsPayload): string {
  const lines: string[] = [
    "## 3. Ticket & Revenue Analytics (Firestore Registrations & Merch)",
    "",
    "| Metric | Value | Change vs Prior |",
    "|---|---:|---:|",
    `| Tickets Issued | ${fmtNum(t.kpis.totalTickets.current)} (${fmtNum(t.kpis.paidTickets.current)} paid) | ${fmtDelta(t.kpis.totalTickets.deltaPct)} |`,
    `| Paid Conversion Rate | ${t.kpis.paidConversionPct}% | ${fmtDelta(t.kpis.paidTickets.deltaPct)} |`,
    `| Gross Paid Revenue | ${fmtIdr(t.kpis.grossPaidRevenueIdr.current)} | ${fmtDelta(t.kpis.grossPaidRevenueIdr.deltaPct)} |`,
    `| Ticket Revenue / Merch Revenue | ${fmtIdr(t.kpis.ticketRevenueIdr)} / ${fmtIdr(t.kpis.merchOrderRevenueIdr)} | — |`,
    `| Voucher / Referral Adoption | ${t.kpis.voucherAdoptionPct}% / ${t.kpis.referralAdoptionPct}% (${fmtIdr(t.kpis.totalDiscountIdr)} discounted) | — |`,
  ];

  if (t.statusFunnel.length > 0) {
    lines.push("");
    lines.push(
      `**Status Funnel**: ${t.statusFunnel.map((s) => `${s.label}: ${fmtNum(s.count)} (${s.pct}%)`).join(" · ")}`,
    );
  }
  if (t.ticketTypeSplit.length > 0) {
    lines.push(`**Ticket Types**: ${t.ticketTypeSplit.map((x) => `${x.label}: ${x.pct}%`).join(" · ")}`);
  }
  return lines.join("\n");
}

function renderMembersSection(m: MemberAnalyticsPayload): string {
  const lines: string[] = [
    "## 4. Community Member Analytics (Bevy & Firestore)",
    "",
    "| Metric | Value | Change vs Prior |",
    "|---|---:|---:|",
    `| Total Chapter Members (Bevy) | ${fmtNum(m.kpis.totalChapterMembers)} | — |`,
    `| New Chapter Members Joined | ${fmtNum(m.kpis.newChapterMembers.current)} | ${fmtDelta(m.kpis.newChapterMembers.deltaPct)} |`,
    `| Active Dashboard Users | ${fmtNum(m.kpis.activeDashboardMembers.current)} (${m.kpis.activeDashboardPct}%) | ${fmtDelta(m.kpis.activeDashboardMembers.deltaPct)} |`,
    `| Repeat Attendees (2+ Events) | ${m.kpis.repeatAttendeesPct}% | — |`,
    `| Email Verified / Bevy Synced | ${m.kpis.emailVerifiedPct}% / ${m.kpis.bevySyncedPct}% | — |`,
    `| Referral Program Active | ${m.kpis.referralParticipationPct}% | — |`,
  ];
  return lines.join("\n");
}

function renderInstagramSection(ig: InstagramAnalyticsPayload): string {
  const lines: string[] = ["## 5. Instagram Platform Insights (`@gdgjakarta`)"];
  if (!ig.configured || !ig.kpis) {
    lines.push("- Instagram Insights not connected or unavailable for this period.");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("| Metric | Value | Change vs Prior |");
  lines.push("|---|---:|---:|");
  lines.push(
    `| Followers | ${fmtNum(ig.kpis.followersCount)}${ig.kpis.netFollowerChange !== null ? ` (${ig.kpis.netFollowerChange >= 0 ? "+" : ""}${ig.kpis.netFollowerChange} net)` : ""} | — |`,
  );
  lines.push(`| Views | ${fmtNum(ig.kpis.views.current)} | ${fmtDelta(ig.kpis.views.deltaPct)} |`);
  lines.push(`| Reach | ${fmtNum(ig.kpis.reach.current)} | ${fmtDelta(ig.kpis.reach.deltaPct)} |`);
  lines.push(
    `| Total Interactions | ${fmtNum(ig.kpis.totalInteractions.current)} | ${fmtDelta(ig.kpis.totalInteractions.deltaPct)} |`,
  );
  if (ig.adsSummary) {
    lines.push(
      `| Active Ads | ${ig.adsSummary.activeAdsCount} active (${ig.adsSummary.totalAdsCount} total, ${ig.adsSummary.boostedPostsCount} posts boosted) | — |`,
    );
    lines.push(
      `| Ad Spend | ${ig.adsSummary.currency === "IDR" ? fmtIdr(ig.adsSummary.totalSpend) : `${ig.adsSummary.currency} ${fmtNum(ig.adsSummary.totalSpend)}`} | — |`,
    );
  }
  if (ig.rates) {
    lines.push(
      `| Engagement Rate by Reach | ${ig.rates.engagementRateByReachPct}% (Interaction Rate: ${ig.rates.interactionRateByReachPct}%) | — |`,
    );
    if (ig.rates.audienceSplit.metricSource !== "none") {
      lines.push(
        `| Audience Split (${ig.rates.audienceSplit.metricSource}) | Followers ${ig.rates.audienceSplit.followersPct}% / Non-Followers ${ig.rates.audienceSplit.nonFollowersPct}% | — |`,
      );
    }
    if (ig.rates.interactionMix.length > 0) {
      lines.push("");
      lines.push(
        `**Interaction Mix**: ${ig.rates.interactionMix.map((i) => `${i.label}: ${fmtNum(i.count)} (${i.pct}%)`).join(" · ")}`,
      );
    }
  }

  if (ig.demographics) {
    lines.push("");
    lines.push(`**Follower Demographics (${ig.demographics.timeframeLabel})**:`);
    if (ig.demographics.gender.length > 0) {
      lines.push(
        `- Gender: ${ig.demographics.gender.map((g) => `${g.label} ${g.pct}% (${fmtNum(g.count)})`).join(", ")}`,
      );
    }
    if (ig.demographics.age.length > 0) {
      lines.push(`- Age: ${ig.demographics.age.map((a) => `${a.label}: ${a.pct}% (${fmtNum(a.count)})`).join(", ")}`);
    }
  }

  if (ig.topPostsByInteractions.length > 0) {
    lines.push("");
    lines.push("**Top Posts by Interactions**:");
    for (const p of ig.topPostsByInteractions) {
      const adTag = p.adBoost
        ? ` [Boosted: ${p.adBoost.currency === "IDR" ? fmtIdr(p.adBoost.spend) : `${p.adBoost.currency} ${fmtNum(p.adBoost.spend)}`}]`
        : "";
      lines.push(
        `- [${p.mediaType}]${adTag} "${p.caption.slice(0, 90)}${p.caption.length > 90 ? "…" : ""}" (${p.timestamp}): ${fmtNum(p.totalInteractions)} interactions (${p.engagementRatePct}% eng), ${fmtNum(p.views)} views — ${p.permalink}`,
      );
    }
  }

  if (ig.topPostsByViews.length > 0) {
    lines.push("");
    lines.push("**Top Posts by Views / Impressions**:");
    for (const p of ig.topPostsByViews) {
      const adTag = p.adBoost
        ? ` [Boosted: ${p.adBoost.currency === "IDR" ? fmtIdr(p.adBoost.spend) : `${p.adBoost.currency} ${fmtNum(p.adBoost.spend)}`}]`
        : "";
      lines.push(
        `- [${p.mediaType}]${adTag} "${p.caption.slice(0, 90)}${p.caption.length > 90 ? "…" : ""}" (${p.timestamp}): ${fmtNum(p.views)} views, ${fmtNum(p.totalInteractions)} interactions (${p.engagementRatePct}% eng) — ${p.permalink}`,
      );
    }
  }

  if (ig.boostedPosts && ig.boostedPosts.length > 0) {
    lines.push("");
    lines.push("**Boosted Posts (Meta Ads)**:");
    for (const bp of ig.boostedPosts) {
      const spendStr = bp.currency === "IDR" ? fmtIdr(bp.spend) : `${bp.currency} ${fmtNum(bp.spend)}`;
      lines.push(
        `- "${bp.caption.slice(0, 90)}${bp.caption.length > 90 ? "…" : ""}": ${spendStr} (${bp.adCount} ad${bp.adCount > 1 ? "s" : ""}, ${bp.activeAdCount} active, ${fmtNum(bp.impressions)} ad impressions, ${fmtNum(bp.clicks)} clicks) — ${bp.permalink}`,
      );
    }
  }

  if (ig.partialWarnings.length > 0) {
    lines.push("");
    lines.push(`> Note: ${ig.partialWarnings.join(" ")}`);
  }

  return lines.join("\n");
}

export function buildAnalyticsReportPrompt(params: {
  purpose: ReportPromptPurpose;
  filterLabel: string;
  bundle: AnalyticsPromptBundle;
}): string {
  const { purpose, filterLabel, bundle } = params;

  let roleInstruction =
    "You are a senior community partnership strategist for **GDG Jakarta** (Google Developer Group Jakarta, Chapter #642).";
  let taskInstruction =
    "Using ONLY the verified analytics data below, generate a polished, partner-ready **Impact & Performance Report** in Markdown format with an Executive Summary, Key Highlights, Audience & Demographics Profile, Event & Community Engagement Performance, Social Media Reach (`@gdgjakarta`), and Strategic Takeaways.";

  if (purpose === "proposal") {
    taskInstruction =
      "Using ONLY the verified analytics data below, generate a compelling **Sponsorship Proposal & Community Media Kit** in Markdown format for prospective GDG Jakarta partners/sponsors. Highlight community scale, event attendance & check-in quality, audience demographics (gender/age), website & Instagram reach/engagement, top-performing content proof points, and recommended sponsorship value propositions.";
  } else if (purpose === "active_tab") {
    roleInstruction = "You are a data analyst for **GDG Jakarta** (Google Developer Group Jakarta).";
    taskInstruction =
      "Using ONLY the verified analytics data below, summarize key insights, trends, and partner-ready talking points in concise Markdown.";
  }

  const sections: string[] = [];
  if (bundle.website) sections.push(renderWebsiteSection(bundle.website));
  if (bundle.events) sections.push(renderEventsSection(bundle.events));
  if (bundle.tickets) sections.push(renderTicketsSection(bundle.tickets));
  if (bundle.members) sections.push(renderMembersSection(bundle.members));
  if (bundle.instagram) sections.push(renderInstagramSection(bundle.instagram));

  return [
    roleInstruction,
    "",
    "### Task",
    taskInstruction,
    "",
    "### Strict Grounding Rules",
    "- **Do NOT hallucinate, estimate, or extrapolate** any numbers not present in the dataset below.",
    "- Preserve exact counts, percentages, and IDR currency figures.",
    "- If a source is marked *Not connected*, omit it gracefully instead of inventing metrics.",
    "",
    "---",
    "",
    `# GDG Jakarta Verified Analytics Data (${filterLabel})`,
    `Generated at: ${new Date().toISOString()}`,
    "",
    sections.join("\n\n---\n\n"),
  ].join("\n");
}
