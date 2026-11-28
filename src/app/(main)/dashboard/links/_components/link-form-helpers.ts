import type {
  CreateShortLinkInput,
  GeoTargetRule,
  LinkBundleItem,
  LinkPixelConfig,
  RedirectStatusCode,
  ShortLinkItem,
  ShortLinkType,
  ShortlinkProviderName,
  SplitTestTarget,
  UpdateShortLinkInput,
  UtmParams,
} from "@/lib/shortio/types";

export interface AdvancedState {
  password: string;
  clearPassword: boolean;
  cloaking: boolean;
  redirectType: "301" | "302" | "307" | "308";
  expiresAt: string; // yyyy-MM-ddTHH:mm (local) or ""
  expiredURL: string;
  androidURL: string;
  iphoneURL: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  maxClicks: string;
  geoTargets: GeoTargetRule[];
  metaPixelId: string;
  gtmId: string;
  ga4Id: string;
  linkType: ShortLinkType;
  splitTargets: SplitTestTarget[];
  bundleItems: LinkBundleItem[];
}

export const EMPTY_ADVANCED: AdvancedState = {
  password: "",
  clearPassword: false,
  cloaking: false,
  redirectType: "301",
  expiresAt: "",
  expiredURL: "",
  androidURL: "",
  iphoneURL: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmTerm: "",
  utmContent: "",
  maxClicks: "",
  geoTargets: [],
  metaPixelId: "",
  gtmId: "",
  ga4Id: "",
  linkType: "redirect",
  splitTargets: [],
  bundleItems: [],
};

export const DEFAULT_AASA_TEMPLATE = JSON.stringify(
  {
    applinks: {
      apps: [],
      details: [
        {
          appID: "TEAMID.org.gdgjakarta.app",
          paths: ["/*"],
        },
      ],
    },
  },
  null,
  2,
);

export const DEFAULT_ASSET_LINKS_TEMPLATE = JSON.stringify(
  [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "org.gdgjakarta.app",
        sha256_cert_fingerprints: [
          "00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00",
        ],
      },
    },
  ],
  null,
  2,
);

const pad = (n: number) => String(n).padStart(2, "0");

const UTM_KEYS = [
  ["utmSource", "utm_source"],
  ["utmMedium", "utm_medium"],
  ["utmCampaign", "utm_campaign"],
  ["utmTerm", "utm_term"],
  ["utmContent", "utm_content"],
] as const;

export function isValidHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//")) return false;
  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function advancedFromLink(link: ShortLinkItem): AdvancedState {
  let expiresAt = "";
  if (link.expiresAt) {
    const d = new Date(link.expiresAt);
    if (!Number.isNaN(d.getTime())) {
      expiresAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  let utmSource = link.utmParams?.source ?? "";
  let utmMedium = link.utmParams?.medium ?? "";
  let utmCampaign = link.utmParams?.campaign ?? "";
  let utmTerm = link.utmParams?.term ?? "";
  let utmContent = link.utmParams?.content ?? "";

  if (!link.utmParams && link.originalURL) {
    try {
      const parsed = new URL(link.originalURL);
      utmSource = parsed.searchParams.get("utm_source") ?? "";
      utmMedium = parsed.searchParams.get("utm_medium") ?? "";
      utmCampaign = parsed.searchParams.get("utm_campaign") ?? "";
      utmTerm = parsed.searchParams.get("utm_term") ?? "";
      utmContent = parsed.searchParams.get("utm_content") ?? "";
    } catch {
      // Ignore unparseable originalURL
    }
  }

  const linkType: ShortLinkType = link.linkType === "split" || link.linkType === "bundle" ? link.linkType : "redirect";

  return {
    ...EMPTY_ADVANCED,
    cloaking: Boolean(link.cloaking),
    redirectType: (["301", "302", "307", "308"].includes(String(link.redirectType))
      ? String(link.redirectType)
      : "301") as AdvancedState["redirectType"],
    expiresAt,
    expiredURL: link.expiredURL ?? "",
    androidURL: link.androidURL ?? "",
    iphoneURL: link.iphoneURL ?? "",
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    maxClicks: typeof link.maxClicks === "number" ? String(link.maxClicks) : "",
    geoTargets: (link.geoTargets ?? []).map((rule) => ({
      country: rule.country,
      url: rule.url,
      ...(rule.region ? { region: rule.region } : {}),
    })),
    metaPixelId: link.pixels?.metaPixelId ?? "",
    gtmId: link.pixels?.gtmId ?? "",
    ga4Id: link.pixels?.ga4Id ?? "",
    linkType,
    splitTargets: (link.splitTargets ?? []).map((target) => ({
      label: target.label,
      url: target.url,
      weight: target.weight,
    })),
    bundleItems: (link.bundleItems ?? []).map((item) => ({
      title: item.title,
      url: item.url,
      ...(item.description ? { description: item.description } : {}),
      ...(item.icon ? { icon: item.icon } : {}),
    })),
  };
}

/** Appends the filled UTM fields to the destination URL (existing params with the same key are replaced). */
export function applyUtm(rawUrl: string, s: AdvancedState): string {
  try {
    const url = new URL(rawUrl);
    for (const [field, param] of UTM_KEYS) {
      const v = s[field].trim();
      if (v) url.searchParams.set(param, v);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function buildUtmParams(s: AdvancedState): UtmParams | null {
  const out: UtmParams = {};
  if (s.utmSource.trim()) out.source = s.utmSource.trim();
  if (s.utmMedium.trim()) out.medium = s.utmMedium.trim();
  if (s.utmCampaign.trim()) out.campaign = s.utmCampaign.trim();
  if (s.utmTerm.trim()) out.term = s.utmTerm.trim();
  if (s.utmContent.trim()) out.content = s.utmContent.trim();
  return Object.keys(out).length > 0 ? out : null;
}

export function buildPixelsConfig(s: AdvancedState): LinkPixelConfig | null {
  const out: LinkPixelConfig = {};
  if (s.metaPixelId.trim()) out.metaPixelId = s.metaPixelId.trim();
  if (s.gtmId.trim()) out.gtmId = s.gtmId.trim();
  if (s.ga4Id.trim()) out.ga4Id = s.ga4Id.trim();
  return Object.keys(out).length > 0 ? out : null;
}

export function validateMaxClicks(raw: string): { valid: boolean; value: number | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, value: null, error: "Click limit must be a non-negative integer." };
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return { valid: false, value: null, error: "Click limit must be a non-negative integer." };
  }
  return { valid: true, value: parsed };
}

export function validateGeoTargets(rules: GeoTargetRule[]): {
  valid: boolean;
  error?: string;
  normalized: GeoTargetRule[];
} {
  const normalized: GeoTargetRule[] = [];
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    const country = (rule.country ?? "").trim().toUpperCase();
    const url = (rule.url ?? "").trim();
    const region = rule.region?.trim();

    if (!/^[A-Z]{2}$/.test(country)) {
      return {
        valid: false,
        error: `Geo rule #${i + 1}: country must be a 2-letter ISO code (e.g. ID, SG, US).`,
        normalized: [],
      };
    }
    if (!isValidHttpUrl(url)) {
      return {
        valid: false,
        error: `Geo rule #${i + 1}: destination URL must start with http:// or https://.`,
        normalized: [],
      };
    }

    normalized.push({
      country,
      url,
      ...(region ? { region } : {}),
    });
  }
  return { valid: true, normalized };
}

export function validatePixelConfig(pixels: LinkPixelConfig | null): { valid: boolean; error?: string } {
  if (!pixels) return { valid: true };
  if (pixels.metaPixelId && !/^\d{5,20}$/.test(pixels.metaPixelId)) {
    return { valid: false, error: "Meta Pixel ID must be 5-20 digits." };
  }
  if (pixels.gtmId && !/^GTM-[A-Z0-9]+$/i.test(pixels.gtmId)) {
    return { valid: false, error: "GTM Container ID must match GTM-XXXXXXX." };
  }
  if (pixels.ga4Id && !/^G-[A-Z0-9]+$/i.test(pixels.ga4Id)) {
    return { valid: false, error: "GA4 Measurement ID must match G-XXXXXXXXXX." };
  }
  return { valid: true };
}

export function validateSplitTargets(
  targets: SplitTestTarget[],
  linkType: ShortLinkType,
): { valid: boolean; error?: string; normalized: SplitTestTarget[] } {
  if (linkType !== "split") {
    return { valid: true, normalized: [] };
  }
  if (targets.length === 0) {
    return { valid: false, error: "A/B Split links require at least one target.", normalized: [] };
  }
  const normalized: SplitTestTarget[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const url = (target.url ?? "").trim();
    const weight = Number(target.weight);
    const label = (target.label ?? "").trim() || `Variant ${i + 1}`;

    if (!isValidHttpUrl(url)) {
      return {
        valid: false,
        error: `Split target #${i + 1}: URL must start with http:// or https://.`,
        normalized: [],
      };
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      return {
        valid: false,
        error: `Split target #${i + 1}: weight must be a positive number.`,
        normalized: [],
      };
    }
    normalized.push({ label, url, weight });
  }
  return { valid: true, normalized };
}

export function validateBundleItems(
  items: LinkBundleItem[],
  linkType: ShortLinkType,
): { valid: boolean; error?: string; normalized: LinkBundleItem[] } {
  if (linkType !== "bundle") {
    return { valid: true, normalized: [] };
  }
  if (items.length === 0) {
    return { valid: false, error: "Link bundles require at least one bundle item.", normalized: [] };
  }
  const normalized: LinkBundleItem[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const title = (item.title ?? "").trim();
    const url = (item.url ?? "").trim();
    const description = item.description?.trim();
    const icon = item.icon?.trim();

    if (!title) {
      return {
        valid: false,
        error: `Bundle item #${i + 1}: title is required.`,
        normalized: [],
      };
    }
    if (!isValidHttpUrl(url)) {
      return {
        valid: false,
        error: `Bundle item #${i + 1}: URL must start with http:// or https://.`,
        normalized: [],
      };
    }
    normalized.push({
      title,
      url,
      ...(description ? { description } : {}),
      ...(icon ? { icon } : {}),
    });
  }
  return { valid: true, normalized };
}

export function computeSplitPercentages(targets: Pick<SplitTestTarget, "weight">[]): number[] {
  if (targets.length === 0) return [];
  const totalWeight = targets.reduce((sum, t) => sum + (Number.isFinite(t.weight) && t.weight > 0 ? t.weight : 0), 0);
  if (totalWeight <= 0) return targets.map(() => 0);
  return targets.map((t) => {
    const w = Number.isFinite(t.weight) && t.weight > 0 ? t.weight : 0;
    return Math.round((w / totalWeight) * 1000) / 10;
  });
}

export function resolveEffectiveOriginalUrl(
  rawOriginalUrl: string,
  s: AdvancedState,
  provider: ShortlinkProviderName,
): { url: string; error?: string } {
  const trimmed = rawOriginalUrl.trim();
  let fallback = "";
  if (s.linkType === "bundle") {
    fallback = s.bundleItems[0]?.url?.trim() ?? "";
  } else if (s.linkType === "split") {
    fallback = s.splitTargets[0]?.url?.trim() ?? "";
  }
  const candidate = trimmed || fallback;

  if (!candidate) {
    return {
      url: "",
      error:
        s.linkType === "redirect"
          ? "Please provide a destination URL"
          : "Provide a fallback destination URL or add at least one valid target URL",
    };
  }
  if (!isValidHttpUrl(candidate)) {
    return {
      url: "",
      error: "Invalid destination URL. Make sure it includes http:// or https://",
    };
  }

  return {
    url: provider === "shortio" ? applyUtm(candidate, s) : candidate,
  };
}

export function validateOptionalAdvancedUrls(s: AdvancedState): string | null {
  if (s.expiredURL.trim() && !isValidHttpUrl(s.expiredURL)) {
    return "Redirect after expiry must be a valid http:// or https:// URL.";
  }
  if (s.androidURL.trim() && !isValidHttpUrl(s.androidURL)) {
    return "Android destination must be a valid http:// or https:// URL.";
  }
  if (s.iphoneURL.trim() && !isValidHttpUrl(s.iphoneURL)) {
    return "iOS destination must be a valid http:// or https:// URL.";
  }
  return null;
}

/**
 * Converts UI AdvancedState into Create/UpdateShortLinkInput payload.
 * Create sends only set values; edit sends `null` to clear optional/Pro fields.
 */
export function advancedToInput(
  s: AdvancedState,
  isEdit: false,
  provider?: ShortlinkProviderName,
): Omit<CreateShortLinkInput, "originalURL">;
export function advancedToInput(
  s: AdvancedState,
  isEdit: true,
  provider?: ShortlinkProviderName,
): Omit<UpdateShortLinkInput, "originalURL">;
export function advancedToInput(
  s: AdvancedState,
  isEdit: boolean,
  provider: ShortlinkProviderName = "shortio",
): Omit<CreateShortLinkInput, "originalURL"> | Omit<UpdateShortLinkInput, "originalURL"> {
  const maxClicksCheck = validateMaxClicks(s.maxClicks);
  const utmParams = buildUtmParams(s);
  const pixels = buildPixelsConfig(s);
  const geoCheck = validateGeoTargets(s.geoTargets);
  const splitCheck = validateSplitTargets(s.splitTargets, s.linkType);
  const bundleCheck = validateBundleItems(s.bundleItems, s.linkType);

  if (!isEdit) {
    const baseCreate: Omit<CreateShortLinkInput, "originalURL"> = {
      cloaking: s.cloaking,
      redirectType: Number(s.redirectType) as RedirectStatusCode,
      password: s.password || undefined,
      expiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : undefined,
      expiredURL: s.expiredURL.trim() || undefined,
      androidURL: s.androidURL.trim() || undefined,
      iphoneURL: s.iphoneURL.trim() || undefined,
    };

    if (provider !== "cloudflare") {
      return baseCreate;
    }

    return {
      ...baseCreate,
      maxClicks: maxClicksCheck.value !== null ? maxClicksCheck.value : undefined,
      utmParams: utmParams ?? undefined,
      pixels: pixels ?? undefined,
      geoTargets: geoCheck.normalized.length > 0 ? geoCheck.normalized : undefined,
      linkType: s.linkType,
      splitTargets: s.linkType === "split" ? splitCheck.normalized : undefined,
      bundleItems: s.linkType === "bundle" ? bundleCheck.normalized : undefined,
    };
  }

  const baseEdit: Omit<UpdateShortLinkInput, "originalURL"> = {
    cloaking: s.cloaking,
    redirectType: Number(s.redirectType) as RedirectStatusCode,
    password: s.clearPassword ? undefined : s.password || undefined,
    expiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : null,
    expiredURL: s.expiredURL.trim() || null,
    androidURL: s.androidURL.trim() || null,
    iphoneURL: s.iphoneURL.trim() || null,
  };

  if (provider !== "cloudflare") {
    return baseEdit;
  }

  return {
    ...baseEdit,
    ...(s.clearPassword ? { clearPassword: true } : {}),
    maxClicks: maxClicksCheck.value !== null ? maxClicksCheck.value : null,
    utmParams: utmParams ?? null,
    pixels: pixels ?? null,
    geoTargets: geoCheck.normalized.length > 0 ? geoCheck.normalized : null,
    linkType: s.linkType,
    splitTargets: s.linkType === "split" ? splitCheck.normalized : null,
    bundleItems: s.linkType === "bundle" ? bundleCheck.normalized : null,
  };
}

export function validateWellKnownJson(
  raw: string,
  fieldName: string,
): { valid: boolean; value: string | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: true, value: null };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object") {
      return { valid: false, value: null, error: `${fieldName} must be a JSON object or array.` };
    }
    return { valid: true, value: trimmed };
  } catch (err) {
    return {
      valid: false,
      value: null,
      error: `${fieldName} contains invalid JSON: ${err instanceof Error ? err.message : "parse error"}`,
    };
  }
}

export function formatClickCount(link: Pick<ShortLinkItem, "clicks" | "clicksCount" | "legacyClicks" | "maxClicks">): {
  total: number;
  totalFormatted: string;
  capLabel: string | null;
  legacyNote: string | null;
} {
  const total = link.clicks ?? (link.clicksCount ?? 0) + (link.legacyClicks ?? 0);
  const legacy = link.legacyClicks ?? 0;
  return {
    total,
    totalFormatted: total.toLocaleString(),
    capLabel: link.maxClicks != null ? `/ ${link.maxClicks.toLocaleString()}` : null,
    legacyNote: legacy > 0 ? `Includes ${legacy.toLocaleString()} legacy Short.io clicks` : null,
  };
}

export function extractProBadges(link: ShortLinkItem): Array<{ key: string; label: string }> {
  const badges: Array<{ key: string; label: string }> = [];
  if (link.linkType === "split") badges.push({ key: "split", label: "A/B Split" });
  if (link.linkType === "bundle") badges.push({ key: "bundle", label: "Bundle" });
  if (link.hasPassword) badges.push({ key: "locked", label: "Locked" });
  if (link.cloaking) badges.push({ key: "cloaked", label: "Cloaked" });
  if (link.expiresAt) badges.push({ key: "expires", label: "Expires" });
  if (link.maxClicks != null) badges.push({ key: "cap", label: "Cap" });
  if ((link.geoTargets?.length ?? 0) > 0) badges.push({ key: "geo", label: "Geo" });
  return badges;
}

export function formatArchiveToast(provider: ShortlinkProviderName, count = 1): string {
  const noun = count === 1 ? "Link" : `${count} links`;
  if (provider === "cloudflare") {
    return `${noun} archived. Switch to the Archived filter to restore.`;
  }
  return `${noun} archived. Restore from the Short.io dashboard.`;
}
