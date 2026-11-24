import { alpha2ToNumericId, getCountryDisplayName } from "@/lib/analytics/country-codes";
import {
  calcDeltaPct,
  calcSharePct,
  enumerateDateKeys,
  formatShortDateLabel,
  type ResolvedDateWindow,
} from "@/lib/analytics/date-range";
import type { ComparisonSeriesPoint, CountryMetricRow, KpiComparisonMetric } from "@/lib/analytics/types";

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface Ga4WebsiteResult {
  kpis: {
    pageViews: KpiComparisonMetric;
    totalUsers: KpiComparisonMetric;
    newUsers: KpiComparisonMetric;
    totalSessions: KpiComparisonMetric;
    engagedSessions: KpiComparisonMetric;
    engagementRatePct: number;
  };
  series: ComparisonSeriesPoint[];
  countries: CountryMetricRow[];
}

export function isGa4Configured(): boolean {
  return Boolean(process.env.GA4_PROPERTY_ID?.trim() && process.env.GA4_SERVICE_ACCOUNT_JSON?.trim());
}

function parseServiceAccount(raw: string): ServiceAccountJson {
  const trimmed = raw.trim();
  const jsonStr = trimmed.startsWith("{") ? trimmed : Buffer.from(trimmed, "base64").toString("utf-8");
  const parsed = JSON.parse(jsonStr) as Partial<ServiceAccountJson>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GA4_SERVICE_ACCOUNT_JSON is missing client_email or private_key.");
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
    token_uri: parsed.token_uri || "https://oauth2.googleapis.com/token",
  };
}

function base64UrlEncode(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getGoogleAccessToken(sa: ServiceAccountJson): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";

  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${payload}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  const assertion = `${signingInput}.${base64UrlEncode(signature)}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });

  const data = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Google OAuth token exchange failed (${res.status})`);
  }
  return data.access_token;
}

interface Ga4RunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  error?: { message?: string; code?: number };
}

async function runGa4Report(
  propertyId: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<Ga4RunReportResponse> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    },
  );
  const json = (await res.json()) as Ga4RunReportResponse;
  if (!res.ok) {
    throw new Error(json.error?.message || `GA4 Data API failed (${res.status})`);
  }
  return json;
}

function metricNum(row: { metricValues?: Array<{ value?: string }> } | undefined, index: number): number {
  return Number(row?.metricValues?.[index]?.value ?? 0) || 0;
}

export async function fetchGa4WebsiteAnalytics(window: ResolvedDateWindow): Promise<Ga4WebsiteResult> {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const rawSa = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim();
  if (!propertyId || !rawSa) {
    throw new Error("GA4_PROPERTY_ID or GA4_SERVICE_ACCOUNT_JSON is missing.");
  }

  const sa = parseServiceAccount(rawSa);
  const accessToken = await getGoogleAccessToken(sa);

  const dateRanges = [
    { startDate: window.sinceDate, endDate: window.apiUntilDate, name: "current" },
    { startDate: window.prevSinceDate, endDate: window.prevUntilDate, name: "previous" },
  ];

  const [summaryRes, dailyRes, countryRes] = await Promise.all([
    runGa4Report(propertyId, accessToken, {
      dateRanges,
      metrics: [
        { name: "screenPageViews" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "engagedSessions" },
      ],
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 1000,
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges: [dateRanges[0]],
      dimensions: [{ name: "countryId" }],
      metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
      limit: 100,
    }),
  ]);

  // Parse summary rows: when 2 dateRanges are passed without dimensions, GA4 adds a synthetic dateRange dimension ("current" / "previous")
  let curRow = summaryRes.rows?.[0];
  let prevRow = summaryRes.rows?.[1];
  for (const row of summaryRes.rows ?? []) {
    const rangeName = row.dimensionValues?.[0]?.value;
    if (rangeName === "current") curRow = row;
    else if (rangeName === "previous") prevRow = row;
  }

  const pageViewsCur = metricNum(curRow, 0);
  const pageViewsPrev = metricNum(prevRow, 0);
  const totalUsersCur = metricNum(curRow, 1);
  const totalUsersPrev = metricNum(prevRow, 1);
  const newUsersCur = metricNum(curRow, 2);
  const newUsersPrev = metricNum(prevRow, 2);
  const sessionsCur = metricNum(curRow, 3);
  const sessionsPrev = metricNum(prevRow, 3);
  const engagedCur = metricNum(curRow, 4);
  const engagedPrev = metricNum(prevRow, 4);

  // Parse daily series
  const curByDate = new Map<string, number>();
  const prevByDate = new Map<string, number>();
  for (const row of dailyRes.rows ?? []) {
    const rawDate = row.dimensionValues?.[0]?.value ?? "";
    const rangeName = row.dimensionValues?.[1]?.value ?? "current";
    if (rawDate.length !== 8) continue;
    const formatted = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const views = metricNum(row, 0);
    if (rangeName === "previous") prevByDate.set(formatted, views);
    else curByDate.set(formatted, views);
  }

  const currentKeys = enumerateDateKeys(window.sinceDate, window.apiUntilDate);
  const prevKeys = enumerateDateKeys(window.prevSinceDate, window.prevUntilDate);
  const series: ComparisonSeriesPoint[] = currentKeys.map((dateKey, idx) => ({
    date: dateKey,
    label: formatShortDateLabel(dateKey),
    current: curByDate.get(dateKey) ?? 0,
    previous: prevKeys[idx] ? (prevByDate.get(prevKeys[idx]) ?? 0) : 0,
  }));

  // Parse countries
  const rawCountries = (countryRes.rows ?? [])
    .map((row) => {
      const code = (row.dimensionValues?.[0]?.value ?? "").trim().toUpperCase();
      const users = metricNum(row, 0);
      const views = metricNum(row, 1);
      return {
        code,
        numericId: alpha2ToNumericId(code),
        name: getCountryDisplayName(code),
        usersOrVisits: users,
        pageViews: views,
      };
    })
    .filter((c) => c.code && c.code !== "(NOT SET)" && c.usersOrVisits > 0);

  const totalCountryUsers = rawCountries.reduce((acc, c) => acc + c.usersOrVisits, 0);
  const countries: CountryMetricRow[] = rawCountries.map((c) => ({
    ...c,
    pct: calcSharePct(c.usersOrVisits, totalCountryUsers),
  }));

  return {
    kpis: {
      pageViews: {
        current: pageViewsCur,
        previous: pageViewsPrev,
        deltaPct: calcDeltaPct(pageViewsCur, pageViewsPrev),
      },
      totalUsers: {
        current: totalUsersCur,
        previous: totalUsersPrev,
        deltaPct: calcDeltaPct(totalUsersCur, totalUsersPrev),
      },
      newUsers: { current: newUsersCur, previous: newUsersPrev, deltaPct: calcDeltaPct(newUsersCur, newUsersPrev) },
      totalSessions: {
        current: sessionsCur,
        previous: sessionsPrev,
        deltaPct: calcDeltaPct(sessionsCur, sessionsPrev),
      },
      engagedSessions: { current: engagedCur, previous: engagedPrev, deltaPct: calcDeltaPct(engagedCur, engagedPrev) },
      engagementRatePct: sessionsCur > 0 ? Math.round((engagedCur / sessionsCur) * 1000) / 10 : 0,
    },
    series,
    countries,
  };
}
