import { BEVY_CONFIG } from "@/config/bevy-config";
import {
  calcDeltaPct,
  calcSharePct,
  enumerateDateKeys,
  formatMonthLabel,
  formatShortDateLabel,
  getTodayWibDateStr,
  type ResolvedDateWindow,
  toWibDateKey,
  wibEndIso,
  wibStartIso,
} from "@/lib/analytics/date-range";
import type {
  BreakdownItem,
  ComparisonSeriesPoint,
  EventAnalyticsPayload,
  KpiComparisonMetric,
  MemberAnalyticsPayload,
  TicketAnalyticsPayload,
} from "@/lib/analytics/types";
import { getAllEvents, getBevyChapterMembers, getBevyChapterSlim, resolveEventAudience } from "@/lib/bevy/client";

function getFirestoreRunQueryUrl(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;
}

function getFirestoreRunAggregationQueryUrl(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runAggregationQuery?key=${apiKey}`;
}

function decodeVal(val: unknown): unknown {
  if (!val || typeof val !== "object") return val;
  const obj = val as Record<string, unknown>;
  if ("stringValue" in obj) return obj.stringValue;
  if ("integerValue" in obj) return Number(obj.integerValue);
  if ("doubleValue" in obj) return Number(obj.doubleValue);
  if ("booleanValue" in obj) return Boolean(obj.booleanValue);
  if ("nullValue" in obj) return null;
  if ("timestampValue" in obj) return obj.timestampValue;
  if ("mapValue" in obj) {
    const fields = (obj.mapValue as { fields?: Record<string, unknown> }).fields ?? {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeVal(v);
    }
    return out;
  }
  if ("arrayValue" in obj) {
    const values = (obj.arrayValue as { values?: unknown[] }).values ?? [];
    return values.map(decodeVal);
  }
  return obj;
}

async function resolveBearerToken(explicitToken?: string): Promise<string | undefined> {
  if (explicitToken?.trim()) return explicitToken.trim();
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get("auth_token")?.value?.trim();
    if (!cookieToken) return undefined;
    const parts = cookieToken.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8")) as { exp?: number };
      if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now() + 10_000) {
        return undefined;
      }
    }
    return cookieToken;
  } catch {
    return undefined;
  }
}

async function runProjectedFirestoreQuery<T = Record<string, unknown>>(params: {
  collectionId: string;
  selectFields: string[];
  filters?: Array<{
    fieldFilter: {
      field: { fieldPath: string };
      op: string;
      value: Record<string, unknown>;
    };
  }>;
  limit?: number;
  token?: string;
}): Promise<T[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const authToken = await resolveBearerToken(params.token);
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: params.collectionId }],
    select: {
      fields: params.selectFields.map((fieldPath) => ({ fieldPath })),
    },
  };

  if (params.filters && params.filters.length > 0) {
    structuredQuery.where =
      params.filters.length === 1 ? params.filters[0] : { compositeFilter: { op: "AND", filters: params.filters } };
  }
  if (params.limit && params.limit > 0) {
    structuredQuery.limit = params.limit;
  }

  const res = await fetch(getFirestoreRunQueryUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify({ structuredQuery }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    console.warn(`[Firestore Analytics] Query on ${params.collectionId} returned HTTP ${res.status}`);
    return [];
  }

  const items = (await res.json()) as Array<{ document?: { name?: string; fields?: Record<string, unknown> } }>;
  if (!Array.isArray(items)) return [];

  const results: T[] = [];
  for (const item of items) {
    if (!item.document?.fields) continue;
    const decoded: Record<string, unknown> = {
      id: item.document.name?.split("/").pop() ?? "",
    };
    for (const [k, v] of Object.entries(item.document.fields)) {
      decoded[k] = decodeVal(v);
    }
    results.push(decoded as T);
  }
  return results;
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

// ---------------------------------------------------------------------------
// 1. Website Helper: Logged-in Dashboard Users (Firestore members.last_active)
// ---------------------------------------------------------------------------

async function runFirestoreCountQuery(params: {
  collectionId: string;
  filters?: Array<{
    fieldFilter: {
      field: { fieldPath: string };
      op: string;
      value: Record<string, unknown>;
    };
  }>;
  token?: string;
}): Promise<number | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const authToken = await resolveBearerToken(params.token);
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: params.collectionId }],
  };
  if (params.filters && params.filters.length > 0) {
    structuredQuery.where =
      params.filters.length === 1 ? params.filters[0] : { compositeFilter: { op: "AND", filters: params.filters } };
  }

  try {
    const res = await fetch(getFirestoreRunAggregationQueryUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery,
          aggregations: [{ alias: "total", count: {} }],
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      console.warn(`[Firestore Analytics] Count query on ${params.collectionId} returned HTTP ${res.status}`);
      return null;
    }

    const items = (await res.json()) as Array<{
      result?: { aggregateFields?: { total?: { integerValue?: string | number } } };
    }>;
    if (!Array.isArray(items)) return null;

    const rawTotal = items[0]?.result?.aggregateFields?.total?.integerValue;
    if (rawTotal === undefined || rawTotal === null) return 0;
    const parsed = Number(rawTotal);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (err) {
    console.warn(`[Firestore Analytics] Count query on ${params.collectionId} failed:`, err);
    return null;
  }
}

export async function countLoggedInDashboardUsers(
  window: ResolvedDateWindow,
  token?: string,
): Promise<KpiComparisonMetric> {
  const curStart = wibStartIso(window.sinceDate);
  const curEnd = wibEndIso(window.apiUntilDate);
  const prevStart = wibStartIso(window.prevSinceDate);
  const prevEnd = wibEndIso(window.prevUntilDate);

  const [curCount, prevCount] = await Promise.all([
    runFirestoreCountQuery({
      collectionId: "members",
      filters: [
        {
          fieldFilter: {
            field: { fieldPath: "last_active" },
            op: "GREATER_THAN_OR_EQUAL",
            value: { stringValue: curStart },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: "last_active" },
            op: "LESS_THAN_OR_EQUAL",
            value: { stringValue: curEnd },
          },
        },
      ],
      token,
    }),
    runFirestoreCountQuery({
      collectionId: "members",
      filters: [
        {
          fieldFilter: {
            field: { fieldPath: "last_active" },
            op: "GREATER_THAN_OR_EQUAL",
            value: { stringValue: prevStart },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: "last_active" },
            op: "LESS_THAN_OR_EQUAL",
            value: { stringValue: prevEnd },
          },
        },
      ],
      token,
    }),
  ]);

  if (curCount !== null && prevCount !== null) {
    return {
      current: curCount,
      previous: prevCount,
      deltaPct: calcDeltaPct(curCount, prevCount),
    };
  }

  const docs = await runProjectedFirestoreQuery<{ last_active?: string }>({
    collectionId: "members",
    selectFields: ["last_active"],
    filters: [
      {
        fieldFilter: {
          field: { fieldPath: "last_active" },
          op: "GREATER_THAN_OR_EQUAL",
          value: { stringValue: prevStart },
        },
      },
      {
        fieldFilter: { field: { fieldPath: "last_active" }, op: "LESS_THAN_OR_EQUAL", value: { stringValue: curEnd } },
      },
    ],
    limit: 5000,
    token,
  });

  let current = 0;
  let previous = 0;
  for (const doc of docs) {
    const key = toWibDateKey(doc.last_active);
    if (!key) continue;
    if (key >= window.sinceDate && key <= window.apiUntilDate) current++;
    else if (key >= window.prevSinceDate && key <= window.prevUntilDate) previous++;
  }

  return {
    current,
    previous,
    deltaPct: calcDeltaPct(current, previous),
  };
}

// ---------------------------------------------------------------------------
// 2. Event Analytics (Bevy Chapter Events + Firestore Fallback)
// ---------------------------------------------------------------------------

export async function fetchEventAnalytics(
  window: ResolvedDateWindow,
  options: { includeTest?: boolean; token?: string; cached?: boolean } = {},
): Promise<EventAnalyticsPayload> {
  const includeTest = Boolean(options.includeTest);
  const bevyRes = await getAllEvents(BEVY_CONFIG.chapterId, true, "All").catch(() => ({ results: [], count: 0 }));

  interface NormalizedEventRow {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    startKey: string | null;
    status: string;
    audienceType: string;
    attendees: number;
    checkedIn: number;
    isTest: boolean;
  }

  let rows: NormalizedEventRow[] = (bevyRes.results ?? []).map((e) => {
    const { audienceType } = resolveEventAudience(e.audience_type, e.is_virtual_event);
    return {
      id: String(e.id),
      title: e.title || "Untitled Event",
      startDate: e.start_date || "",
      endDate: e.end_date || e.start_date || "",
      startKey: toWibDateKey(e.start_date),
      status: String(e.status || "Published"),
      audienceType,
      attendees: Number(e.total_attendees ?? 0),
      checkedIn: Number(e.checkin_count ?? 0),
      isTest: Boolean(e.is_test),
    };
  });

  if (rows.length === 0) {
    const fsEvents = await runProjectedFirestoreQuery<Record<string, unknown>>({
      collectionId: "events",
      selectFields: [
        "title",
        "start_date",
        "end_date",
        "status",
        "audience_type",
        "is_virtual",
        "total_registrations",
        "total_approved",
        "total_checked_in",
        "is_test",
      ],
      limit: 500,
      token: options.token,
    });
    rows = fsEvents.map((e) => ({
      id: String(e.id),
      title: String(e.title || "Untitled Event"),
      startDate: String(e.start_date || ""),
      endDate: String(e.end_date || e.start_date || ""),
      startKey: toWibDateKey(String(e.start_date || "")),
      status: String(e.status || "Published"),
      audienceType: e.audience_type ? String(e.audience_type) : e.is_virtual ? "VIRTUAL" : "IN_PERSON",
      attendees: Number(e.total_registrations || e.total_approved || 0),
      checkedIn: Number(e.total_checked_in || 0),
      isTest: Boolean(e.is_test),
    }));
  }

  const eligible = rows.filter((e): e is NormalizedEventRow & { startKey: string } => {
    const st = e.status.toLowerCase();
    if (st === "draft" || st === "canceled" || st === "cancelled") return false;
    if (!includeTest && e.isTest) return false;
    return Boolean(e.startKey);
  });

  const isAllTime = window.mode === "all_time";
  const currentEvents = isAllTime
    ? eligible
    : eligible.filter((e) => e.startKey >= window.sinceDate && e.startKey <= window.untilDate);
  const prevEvents = isAllTime
    ? []
    : eligible.filter((e) => e.startKey >= window.prevSinceDate && e.startKey <= window.prevUntilDate);

  const curAttendees = currentEvents.reduce((s, e) => s + e.attendees, 0);
  const prevAttendees = prevEvents.reduce((s, e) => s + e.attendees, 0);
  const curCheckedIn = currentEvents.reduce((s, e) => s + e.checkedIn, 0);
  const prevCheckedIn = prevEvents.reduce((s, e) => s + e.checkedIn, 0);

  const nowIso = new Date().toISOString();
  const todayWib = getTodayWibDateStr();
  const isPastEvent = (e: NormalizedEventRow) =>
    e.status.toLowerCase() === "completed" || (e.endDate ? e.endDate < nowIso : (e.startKey ?? "") < todayWib);

  const pastEvents = currentEvents.filter(isPastEvent);
  const pastAttendees = pastEvents.reduce((s, e) => s + e.attendees, 0);
  const pastCheckedIn = pastEvents.reduce((s, e) => s + e.checkedIn, 0);

  const checkInRatePct = calcSharePct(pastCheckedIn, pastAttendees);
  const noShowRatePct = pastAttendees > 0 ? Math.round((100 - checkInRatePct) * 10) / 10 : 0;
  const avgAttendeesPerEvent = currentEvents.length > 0 ? Math.round(curAttendees / currentEvents.length) : 0;

  // Format split
  const formatCounts = new Map<string, number>([
    ["IN_PERSON", 0],
    ["HYBRID", 0],
    ["VIRTUAL", 0],
  ]);
  for (const e of currentEvents) {
    const key = e.audienceType.toUpperCase();
    formatCounts.set(key, (formatCounts.get(key) ?? 0) + 1);
  }
  const formatLabels: Record<string, string> = {
    IN_PERSON: "In-Person",
    HYBRID: "Hybrid",
    VIRTUAL: "Virtual",
  };
  const formatSplit: BreakdownItem[] = Array.from(formatCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({
      key,
      label: formatLabels[key] ?? key,
      count,
      pct: calcSharePct(count, currentEvents.length),
    }));

  // Series grouped by month (all_time) or day
  const byBucket = new Map<string, { attendees: number; checkedIn: number; events: number }>();
  for (const e of currentEvents) {
    const bucketKey = isAllTime ? e.startKey.slice(0, 7) : e.startKey;
    const prev = byBucket.get(bucketKey) ?? { attendees: 0, checkedIn: 0, events: 0 };
    prev.attendees += e.attendees;
    prev.checkedIn += e.checkedIn;
    prev.events += 1;
    byBucket.set(bucketKey, prev);
  }

  const series = isAllTime
    ? Array.from(byBucket.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-24)
        .map(([monthKey, entry]) => ({
          date: monthKey,
          label: formatMonthLabel(monthKey),
          attendees: entry.attendees,
          checkedIn: entry.checkedIn,
          events: entry.events,
        }))
    : enumerateDateKeys(window.sinceDate, window.untilDate).map((dateKey) => {
        const entry = byBucket.get(dateKey);
        return {
          date: dateKey,
          label: formatShortDateLabel(dateKey),
          attendees: entry?.attendees ?? 0,
          checkedIn: entry?.checkedIn ?? 0,
          events: entry?.events ?? 0,
        };
      });

  const topEvents = [...currentEvents]
    .sort((a, b) => b.attendees - a.attendees)
    .slice(0, 6)
    .map((e) => {
      const past = isPastEvent(e);
      return {
        id: e.id,
        title: e.title,
        startDate: e.startKey ?? e.startDate,
        audienceType: e.audienceType,
        attendees: e.attendees,
        checkedIn: e.checkedIn,
        checkInRatePct: past && e.attendees > 0 ? calcSharePct(e.checkedIn, e.attendees) : null,
        isPast: past,
      };
    });

  return {
    domain: "events",
    configured: true,
    includeTest,
    range: buildRangeMeta(window, Boolean(options.cached)),
    kpis: {
      eventsCount: {
        current: currentEvents.length,
        previous: prevEvents.length,
        deltaPct: calcDeltaPct(currentEvents.length, prevEvents.length),
      },
      pastEventsCount: pastEvents.length,
      totalAttendees: {
        current: curAttendees,
        previous: prevAttendees,
        deltaPct: calcDeltaPct(curAttendees, prevAttendees),
      },
      totalCheckedIn: {
        current: curCheckedIn,
        previous: prevCheckedIn,
        deltaPct: calcDeltaPct(curCheckedIn, prevCheckedIn),
      },
      checkInRatePct,
      noShowRatePct,
      avgAttendeesPerEvent,
    },
    formatSplit,
    series,
    topEvents,
  };
}

// ---------------------------------------------------------------------------
// 3. Ticket & Revenue Analytics (Firestore event_registrations + event_merchandise_orders)
// ---------------------------------------------------------------------------

export async function fetchTicketAnalytics(
  window: ResolvedDateWindow,
  options: { token?: string; cached?: boolean } = {},
): Promise<TicketAnalyticsPayload> {
  const prevStart = wibStartIso(window.prevSinceDate);
  const curEnd = wibEndIso(window.apiUntilDate);

  const [regs, orders] = await Promise.all([
    runProjectedFirestoreQuery<{
      status?: string;
      ticket_type?: string;
      ticket_price?: number;
      bundle_price?: number;
      payment_status?: string;
      payment_amount?: number;
      voucher_code?: string;
      voucher_discount_amount?: number;
      referral_code?: string;
      referral_discount_amount?: number;
      registered_at?: string;
    }>({
      collectionId: "event_registrations",
      selectFields: [
        "status",
        "ticket_type",
        "ticket_price",
        "bundle_price",
        "payment_status",
        "payment_amount",
        "voucher_code",
        "voucher_discount_amount",
        "referral_code",
        "referral_discount_amount",
        "registered_at",
      ],
      filters: [
        {
          fieldFilter: {
            field: { fieldPath: "registered_at" },
            op: "GREATER_THAN_OR_EQUAL",
            value: { stringValue: prevStart },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: "registered_at" },
            op: "LESS_THAN_OR_EQUAL",
            value: { stringValue: curEnd },
          },
        },
      ],
      limit: 5000,
      token: options.token,
    }),
    runProjectedFirestoreQuery<{
      payment_status?: string;
      total_amount?: number;
      created_at?: string;
      paid_at?: string;
    }>({
      collectionId: "event_merchandise_orders",
      selectFields: ["payment_status", "total_amount", "created_at", "paid_at"],
      filters: [
        {
          fieldFilter: {
            field: { fieldPath: "created_at" },
            op: "GREATER_THAN_OR_EQUAL",
            value: { stringValue: prevStart },
          },
        },
        {
          fieldFilter: { field: { fieldPath: "created_at" }, op: "LESS_THAN_OR_EQUAL", value: { stringValue: curEnd } },
        },
      ],
      limit: 3000,
      token: options.token,
    }),
  ]);

  const isPaidReg = (r: (typeof regs)[number]) => r.payment_status === "paid" || r.status === "paid_and_registered";

  const regAmount = (r: (typeof regs)[number]) =>
    Number(r.payment_amount) || Number(r.bundle_price) || Number(r.ticket_price) || 0;

  let curTickets = 0;
  let prevTickets = 0;
  let curPaidTickets = 0;
  let prevPaidTickets = 0;
  let curTicketRev = 0;
  let prevTicketRev = 0;
  let voucherCount = 0;
  let referralCount = 0;
  let totalDiscountIdr = 0;

  const statusBuckets = new Map<string, number>();
  const typeBuckets = new Map<string, number>();
  const curByDate = new Map<string, number>();
  const prevByDate = new Map<string, number>();

  for (const r of regs) {
    const key = toWibDateKey(r.registered_at);
    if (!key) continue;

    if (key >= window.sinceDate && key <= window.apiUntilDate) {
      curTickets++;
      curByDate.set(key, (curByDate.get(key) ?? 0) + 1);

      if (isPaidReg(r)) {
        curPaidTickets++;
        curTicketRev += regAmount(r);
      }

      if (r.voucher_code) {
        voucherCount++;
        totalDiscountIdr += Number(r.voucher_discount_amount ?? 0);
      }
      if (r.referral_code) {
        referralCount++;
        totalDiscountIdr += Number(r.referral_discount_amount ?? 0);
      }

      const rawStatus = (r.status || "pending").toLowerCase();
      let bucket = "Pending / Other";
      if (rawStatus === "attended") bucket = "Checked In";
      else if (rawStatus === "approved" || rawStatus === "registered" || rawStatus === "paid_and_registered")
        bucket = "Approved / Paid";
      else if (rawStatus === "waitlisted" || rawStatus === "paid_waitlisted") bucket = "Waitlisted";
      else if (rawStatus === "waiting_for_payment") bucket = "Awaiting Payment";
      else if (
        rawStatus === "canceled" ||
        rawStatus === "cancelled" ||
        rawStatus === "expired" ||
        rawStatus === "failed" ||
        rawStatus === "rejected"
      ) {
        bucket = "Cancelled / Expired";
      }
      statusBuckets.set(bucket, (statusBuckets.get(bucket) ?? 0) + 1);

      const tType = r.ticket_type || (regAmount(r) > 0 ? "paid" : "free");
      const tLabel = tType === "commitment_fee" ? "Commitment Fee" : tType === "paid" ? "Paid Ticket" : "Free Ticket";
      typeBuckets.set(tLabel, (typeBuckets.get(tLabel) ?? 0) + 1);
    } else if (key >= window.prevSinceDate && key <= window.prevUntilDate) {
      prevTickets++;
      prevByDate.set(key, (prevByDate.get(key) ?? 0) + 1);
      if (isPaidReg(r)) {
        prevPaidTickets++;
        prevTicketRev += regAmount(r);
      }
    }
  }

  let curMerchRev = 0;
  let prevMerchRev = 0;
  let curMerchPaidCount = 0;
  for (const o of orders) {
    if (o.payment_status !== "paid") continue;
    const key = toWibDateKey(o.paid_at || o.created_at);
    if (!key) continue;
    const amt = Number(o.total_amount ?? 0);
    if (key >= window.sinceDate && key <= window.apiUntilDate) {
      curMerchPaidCount++;
      curMerchRev += amt;
    } else if (key >= window.prevSinceDate && key <= window.prevUntilDate) {
      prevMerchRev += amt;
    }
  }

  const curGrossRev = curTicketRev + curMerchRev;
  const prevGrossRev = prevTicketRev + prevMerchRev;

  const statusFunnel: BreakdownItem[] = Array.from(statusBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      key: label,
      label,
      count,
      pct: calcSharePct(count, curTickets),
    }));

  const ticketTypeSplit: BreakdownItem[] = Array.from(typeBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      key: label,
      label,
      count,
      pct: calcSharePct(count, curTickets),
    }));

  const isAllTime = window.mode === "all_time";
  const series: ComparisonSeriesPoint[] = isAllTime
    ? (() => {
        const byMonth = new Map<string, number>();
        for (const [dateKey, count] of curByDate.entries()) {
          const m = dateKey.slice(0, 7);
          byMonth.set(m, (byMonth.get(m) ?? 0) + count);
        }
        return Array.from(byMonth.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-24)
          .map(([m, count]) => ({ date: m, label: formatMonthLabel(m), current: count, previous: 0 }));
      })()
    : (() => {
        const currentKeys = enumerateDateKeys(window.sinceDate, window.apiUntilDate);
        const prevKeys = enumerateDateKeys(window.prevSinceDate, window.prevUntilDate);
        return currentKeys.map((dateKey, idx) => ({
          date: dateKey,
          label: formatShortDateLabel(dateKey),
          current: curByDate.get(dateKey) ?? 0,
          previous: prevKeys[idx] ? (prevByDate.get(prevKeys[idx]) ?? 0) : 0,
        }));
      })();

  return {
    domain: "tickets",
    configured: true,
    range: buildRangeMeta(window, Boolean(options.cached)),
    kpis: {
      totalTickets: {
        current: curTickets,
        previous: prevTickets,
        deltaPct: calcDeltaPct(curTickets, prevTickets),
      },
      paidTickets: {
        current: curPaidTickets,
        previous: prevPaidTickets,
        deltaPct: calcDeltaPct(curPaidTickets, prevPaidTickets),
      },
      paidConversionPct: calcSharePct(curPaidTickets, curTickets),
      grossPaidRevenueIdr: {
        current: curGrossRev,
        previous: prevGrossRev,
        deltaPct: calcDeltaPct(curGrossRev, prevGrossRev),
      },
      ticketRevenueIdr: curTicketRev,
      merchOrderRevenueIdr: curMerchRev,
      merchOrdersPaidCount: curMerchPaidCount,
      voucherAdoptionPct: calcSharePct(voucherCount, curTickets),
      referralAdoptionPct: calcSharePct(referralCount, curTickets),
      totalDiscountIdr,
    },
    statusFunnel,
    ticketTypeSplit,
    series,
  };
}

// ---------------------------------------------------------------------------
// 4. Member Analytics (Bevy Chapter Joins + Firestore Members)
// ---------------------------------------------------------------------------

export async function fetchMemberAnalytics(
  window: ResolvedDateWindow,
  options: { token?: string; cached?: boolean } = {},
): Promise<MemberAnalyticsPayload> {
  const MAX_BEVY_MEMBER_PAGES = 15; // Up to 3,750 most recent joins (250/page)
  const PAGE_SIZE = 250;

  const [chapterSlim, fsMembers] = await Promise.all([
    getBevyChapterSlim().catch(() => null),
    runProjectedFirestoreQuery<{
      last_active?: string;
      is_email_verified?: boolean;
      bevy_user_id?: string | number | null;
      events_registered_count?: number;
      referrals_count?: number;
      has_used_referral?: boolean;
    }>({
      collectionId: "members",
      selectFields: [
        "last_active",
        "is_email_verified",
        "bevy_user_id",
        "events_registered_count",
        "referrals_count",
        "has_used_referral",
      ],
      limit: 5000,
      token: options.token,
    }),
  ]);

  // Paginate Bevy chapter members descending by -created_date until we pass prevSinceDate
  const curByDate = new Map<string, number>();
  const prevByDate = new Map<string, number>();
  let curNewJoins = 0;
  let prevNewJoins = 0;
  let partialWarning: string | undefined;

  try {
    for (let page = 1; page <= MAX_BEVY_MEMBER_PAGES; page++) {
      const res = await getBevyChapterMembers(BEVY_CONFIG.chapterId, PAGE_SIZE, page, "-created_date");
      const results = res?.results ?? [];
      if (results.length === 0) break;

      let reachedOlderThanWindow = false;
      for (const m of results) {
        const key = toWibDateKey(m.created_date);
        if (!key) continue;
        if (key < window.prevSinceDate) {
          reachedOlderThanWindow = true;
          continue;
        }
        if (key >= window.sinceDate && key <= window.apiUntilDate) {
          curNewJoins++;
          curByDate.set(key, (curByDate.get(key) ?? 0) + 1);
        } else if (key >= window.prevSinceDate && key <= window.prevUntilDate) {
          prevNewJoins++;
          prevByDate.set(key, (prevByDate.get(key) ?? 0) + 1);
        }
      }

      if (reachedOlderThanWindow || results.length < PAGE_SIZE) {
        break;
      }
      if (page === MAX_BEVY_MEMBER_PAGES) {
        partialWarning = `Stopped at ${MAX_BEVY_MEMBER_PAGES * PAGE_SIZE} most recent Bevy joins for fast loading.`;
      }
    }
  } catch (err) {
    partialWarning = err instanceof Error ? err.message : "Could not fetch recent Bevy member joins.";
  }

  let curActive = 0;
  let prevActive = 0;
  let repeatAttendees = 0;
  let emailVerified = 0;
  let bevySynced = 0;
  let referralParticipants = 0;

  for (const m of fsMembers) {
    const activeKey = toWibDateKey(m.last_active);
    if (activeKey) {
      if (activeKey >= window.sinceDate && activeKey <= window.apiUntilDate) curActive++;
      else if (activeKey >= window.prevSinceDate && activeKey <= window.prevUntilDate) prevActive++;
    }
    if ((m.events_registered_count ?? 0) >= 2) repeatAttendees++;
    if (m.is_email_verified) emailVerified++;
    if (m.bevy_user_id !== null && m.bevy_user_id !== undefined && String(m.bevy_user_id).trim() !== "") {
      bevySynced++;
    }
    if ((m.referrals_count ?? 0) > 0 || m.has_used_referral) referralParticipants++;
  }

  const fsTotal = fsMembers.length;
  const totalChapterMembers = chapterSlim?.members_count ?? fsTotal;

  const isAllTime = window.mode === "all_time";
  const series: ComparisonSeriesPoint[] = isAllTime
    ? (() => {
        const byMonth = new Map<string, number>();
        for (const [dateKey, count] of curByDate.entries()) {
          const m = dateKey.slice(0, 7);
          byMonth.set(m, (byMonth.get(m) ?? 0) + count);
        }
        return Array.from(byMonth.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-24)
          .map(([m, count]) => ({ date: m, label: formatMonthLabel(m), current: count, previous: 0 }));
      })()
    : (() => {
        const currentKeys = enumerateDateKeys(window.sinceDate, window.apiUntilDate);
        const prevKeys = enumerateDateKeys(window.prevSinceDate, window.prevUntilDate);
        return currentKeys.map((dateKey, idx) => ({
          date: dateKey,
          label: formatShortDateLabel(dateKey),
          current: curByDate.get(dateKey) ?? 0,
          previous: prevKeys[idx] ? (prevByDate.get(prevKeys[idx]) ?? 0) : 0,
        }));
      })();

  return {
    domain: "members",
    configured: true,
    range: buildRangeMeta(window, Boolean(options.cached)),
    kpis: {
      totalChapterMembers,
      newChapterMembers: {
        current: curNewJoins,
        previous: prevNewJoins,
        deltaPct: calcDeltaPct(curNewJoins, prevNewJoins),
      },
      activeDashboardMembers: {
        current: curActive,
        previous: prevActive,
        deltaPct: calcDeltaPct(curActive, prevActive),
      },
      activeDashboardPct: calcSharePct(curActive, fsTotal),
      repeatAttendeesPct: calcSharePct(repeatAttendees, fsTotal),
      emailVerifiedPct: calcSharePct(emailVerified, fsTotal),
      bevySyncedPct: calcSharePct(bevySynced, fsTotal),
      referralParticipationPct: calcSharePct(referralParticipants, fsTotal),
    },
    series,
    partialWarning,
  };
}
