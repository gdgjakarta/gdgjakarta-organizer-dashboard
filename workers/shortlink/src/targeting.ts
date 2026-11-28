import { createSplitTestCookieValue, verifySplitTestCookieValue } from "@/lib/shortlinks/crypto";
import type { EdgeShortLinkRecord, SplitTestTarget, UtmParams } from "@/lib/shortlinks/types";

import { buildSetCookieHeader, getSplitCookieName } from "./cookies";

function hasAsciiControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

const UTM_FIELD_MAP: ReadonlyArray<[keyof UtmParams, string]> = [
  ["source", "utm_source"],
  ["medium", "utm_medium"],
  ["campaign", "utm_campaign"],
  ["term", "utm_term"],
  ["content", "utm_content"],
];

export function sanitizeSafeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  if (hasAsciiControlChar(raw)) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//")) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function mergeUtmAndQueryParams(
  targetUrl: string,
  utmParams?: UtmParams | null,
  incomingSearchParams?: URLSearchParams,
): string {
  const dest = new URL(targetUrl);

  if (utmParams) {
    for (const [field, queryKey] of UTM_FIELD_MAP) {
      const val = utmParams[field];
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed && !dest.searchParams.has(queryKey)) {
          dest.searchParams.set(queryKey, trimmed);
        }
      }
    }
  }

  if (incomingSearchParams) {
    for (const [key, value] of incomingSearchParams.entries()) {
      if (!dest.searchParams.has(key)) {
        dest.searchParams.set(key, value);
      }
    }
  }

  return dest.toString();
}

interface NormalizedSplitCandidate {
  originalIndex: number;
  label: string;
  weight: number;
  safeUrl: string;
}

export function hasActiveSplitTargets(record: EdgeShortLinkRecord): boolean {
  if (record.linkType === "bundle") {
    return false;
  }
  if (record.linkType !== "split" && (record.splitTargets?.length ?? 0) === 0) {
    return false;
  }
  return getActiveSplitCandidates(record.splitTargets).length > 0;
}

function getActiveSplitCandidates(targets: SplitTestTarget[] | undefined): NormalizedSplitCandidate[] {
  if (!Array.isArray(targets) || targets.length === 0) {
    return [];
  }

  const active: NormalizedSplitCandidate[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    if (!target || typeof target !== "object") continue;
    const safeUrl = sanitizeSafeHttpUrl(target.url);
    if (!safeUrl) continue;
    if (typeof target.weight !== "number" || !Number.isFinite(target.weight) || target.weight <= 0) {
      continue;
    }
    active.push({
      originalIndex: i,
      label: typeof target.label === "string" && target.label.trim() ? target.label.trim() : `variant_${i + 1}`,
      weight: target.weight,
      safeUrl,
    });
  }
  return active;
}

function selectWeightedCandidate(candidates: NormalizedSplitCandidate[]): NormalizedSplitCandidate {
  if (candidates.length === 1) {
    return candidates[0];
  }

  let totalWeight = 0;
  for (const candidate of candidates) {
    totalWeight += candidate.weight;
  }

  const randBuf = new Uint32Array(1);
  crypto.getRandomValues(randBuf);
  const unitRandom = randBuf[0] / 4_294_967_296;
  let threshold = unitRandom * totalWeight;

  for (const candidate of candidates) {
    threshold -= candidate.weight;
    if (threshold < 0) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}

export interface TargetResolutionInput {
  record: EdgeShortLinkRecord;
  requestCf?: IncomingRequestCfProperties<unknown>;
  userAgent: string | null;
  incomingSearchParams: URLSearchParams;
  cookies: Map<string, string>;
  cookieSecret?: string;
  secureCookie: boolean;
  nowMs: number;
}

export type TargetResolutionResult =
  | {
      ok: true;
      targetUrl: string;
      variantLabel: string | null;
      setCookieHeaders: string[];
      isDynamic: boolean;
    }
  | {
      ok: false;
      status: 404 | 500;
      error: string;
    };

export async function resolveTargetDestination(input: TargetResolutionInput): Promise<TargetResolutionResult> {
  const { record, requestCf, userAgent, incomingSearchParams, cookies, cookieSecret, secureCookie, nowMs } = input;
  const setCookieHeaders: string[] = [];
  let variantLabel: string | null = null;
  let baseTargetUrl: string | null = null;
  let isDynamic = false;

  const splitActive =
    record.linkType !== "bundle" && (record.linkType === "split" || (record.splitTargets?.length ?? 0) > 0);

  if (splitActive) {
    const candidates = getActiveSplitCandidates(record.splitTargets);
    if (candidates.length > 0) {
      const secret = typeof cookieSecret === "string" ? cookieSecret.trim() : "";
      if (!secret) {
        return {
          ok: false,
          status: 500,
          error: "Server configuration error",
        };
      }

      isDynamic = true;
      const cookieName = getSplitCookieName(record.id);
      const existingCookie = cookies.get(cookieName);
      const verified = existingCookie
        ? await verifySplitTestCookieValue(secret, existingCookie, record.id, nowMs)
        : null;

      let chosen: NormalizedSplitCandidate | undefined;
      if (verified) {
        chosen = candidates.find(
          (candidate) =>
            candidate.originalIndex === verified.variantIndex &&
            candidate.label === verified.variantLabel &&
            candidate.safeUrl === verified.targetUrl,
        );
      }

      if (!chosen) {
        chosen = selectWeightedCandidate(candidates);
        const signedValue = await createSplitTestCookieValue(secret, {
          linkId: record.id,
          variantIndex: chosen.originalIndex,
          variantLabel: chosen.label,
          targetUrl: chosen.safeUrl,
          nowMs,
        });
        setCookieHeaders.push(
          buildSetCookieHeader({
            name: cookieName,
            value: signedValue,
            maxAge: 30 * 24 * 3600,
            secure: secureCookie,
          }),
        );
      }

      variantLabel = chosen.label;
      baseTargetUrl = chosen.safeUrl;
    }
  }

  // OS targeting (when not overridden by active A/B split selection).
  if (!baseTargetUrl && userAgent) {
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      const safeIos = sanitizeSafeHttpUrl(record.iphoneURL);
      if (safeIos) {
        baseTargetUrl = safeIos;
        isDynamic = true;
      }
    } else if (/Android/i.test(userAgent)) {
      const safeAndroid = sanitizeSafeHttpUrl(record.androidURL);
      if (safeAndroid) {
        baseTargetUrl = safeAndroid;
        isDynamic = true;
      }
    }
  }

  // Country/region geo-targeting (when not overridden by split or OS).
  if (!baseTargetUrl && Array.isArray(record.geoTargets) && record.geoTargets.length > 0) {
    const country = typeof requestCf?.country === "string" ? requestCf.country.trim().toUpperCase() : "";
    const region = typeof requestCf?.regionCode === "string" ? requestCf.regionCode.trim().toUpperCase() : "";

    if (country) {
      let matchedRule =
        region.length > 0
          ? record.geoTargets.find(
              (rule) =>
                typeof rule.country === "string" &&
                rule.country.trim().toUpperCase() === country &&
                typeof rule.region === "string" &&
                rule.region.trim().toUpperCase() === region &&
                sanitizeSafeHttpUrl(rule.url) !== null,
            )
          : undefined;

      if (!matchedRule) {
        matchedRule = record.geoTargets.find(
          (rule) =>
            typeof rule.country === "string" &&
            rule.country.trim().toUpperCase() === country &&
            !rule.region?.trim() &&
            sanitizeSafeHttpUrl(rule.url) !== null,
        );
      }

      if (matchedRule) {
        baseTargetUrl = sanitizeSafeHttpUrl(matchedRule.url);
        isDynamic = true;
      }
    }
  }

  // Default destination fallback.
  if (!baseTargetUrl) {
    baseTargetUrl = sanitizeSafeHttpUrl(record.originalURL);
  }

  if (!baseTargetUrl) {
    return {
      ok: false,
      status: 404,
      error: "Invalid or unsafe destination URL",
    };
  }

  const finalTargetUrl = mergeUtmAndQueryParams(baseTargetUrl, record.utmParams, incomingSearchParams);
  return {
    ok: true,
    targetUrl: finalTargetUrl,
    variantLabel,
    setCookieHeaders,
    isDynamic,
  };
}
