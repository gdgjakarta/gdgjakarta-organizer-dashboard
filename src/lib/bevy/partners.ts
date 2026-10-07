import type { BevyEvent, BevyPartner, BevyPartnerLogo } from "./types";

/**
 * Format raw tier string/slug (e.g. "gold-5", "platinum-4", "community-partner-6", "media_partners")
 * into clean Title Case (e.g. "Gold", "Platinum", "Community Partner", "Media Partner").
 */
export function formatTierName(slug: string): string {
  if (!slug) return "Sponsor";

  // Clean common prefixes and suffixes
  const cleaned = slug
    .replace(/^(?:sponsors?|partners?)[-_]/i, "")
    .replace(/[-_]\d+$/, "") // strip trailing "-4", "-5", etc.
    .replace(/[-_]/g, " ")
    .trim();

  if (!cleaned) return "Sponsor";

  // Handle special cases
  const lower = cleaned.toLowerCase();
  if (lower === "media") return "Media Partner";
  if (lower === "community") return "Community Partner";
  if (lower === "partners" || lower === "partner") return "Partner";
  if (lower === "sponsors" || lower === "sponsor") return "Sponsor";

  // Title case
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Determine hierarchy order for sponsor tiers so prominent tiers (Headline, Platinum, Gold)
 * display first, followed by Silver, Bronze, Community, Media, etc.
 */
export function getTierPriority(tierName: string): number {
  const lower = tierName.toLowerCase();
  if (lower.includes("headline")) return 1;
  if (lower.includes("presenting")) return 2;
  if (lower.includes("title")) return 3;
  if (lower.includes("diamond")) return 4;
  if (lower.includes("platinum")) return 5;
  if (lower.includes("gold")) return 6;
  if (lower.includes("silver")) return 7;
  if (lower.includes("bronze")) return 8;
  if (lower.includes("community")) return 9;
  if (lower.includes("partner")) return 10;
  if (lower.includes("media")) return 11;
  if (lower.includes("in-kind") || lower.includes("in kind")) return 12;
  if (lower.includes("supporter")) return 13;
  return 20;
}

export interface BevyPartnerTierGroup {
  tierName: string;
  tierOrder: number;
  partners: BevyPartner[];
}

interface RawSponsorItem {
  id?: number | string;
  company?: string;
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  website?: string;
  logo_url?: string;
  logo?: BevyPartnerLogo;
  picture?: { url?: string; thumbnail_url?: string };
  picture_url?: string;
  is_global?: boolean;
  visible?: boolean;
  event_sponsor_id?: number;
  tier?: string;
  tier_name?: string;
  tier_order?: number;
}

/**
 * Extract all event sponsors and partners from Bevy event response.
 * Bevy returns sponsors across multiple fields:
 * - Dynamic tier fields: `sponsors_gold-5`, `sponsors_platinum-4`, `sponsors_community-4`, etc.
 * - General fields: `sponsors`, `partners_list`, `media_partners`, `partners`
 */
export function extractEventPartners(event?: (Record<string, unknown> & Partial<BevyEvent>) | null): BevyPartner[] {
  if (!event || typeof event !== "object") return [];

  const partnerMap = new Map<string, BevyPartner>();

  const processItem = (item: unknown, defaultTier?: string) => {
    if (!item || typeof item !== "object") return;
    const raw = item as RawSponsorItem;

    const company = raw.company ?? raw.name ?? raw.title ?? "";
    if (!company) return;

    // Check visibility if explicitly provided as false
    if (raw.visible === false) return;

    const tierName = raw.tier ?? (defaultTier ? formatTierName(defaultTier) : "Sponsor");
    const tierPriority = raw.tier_order ?? getTierPriority(tierName);

    const logoUrl =
      raw.logo_url ??
      raw.logo?.url ??
      raw.logo?.thumbnail_url ??
      raw.picture?.thumbnail_url ??
      raw.picture?.url ??
      raw.picture_url ??
      undefined;

    const partner: BevyPartner = {
      id: raw.id ?? raw.event_sponsor_id ?? company,
      company,
      description: raw.description?.trim() ?? undefined,
      url: raw.url ?? raw.website ?? undefined,
      logo_url: logoUrl,
      logo: raw.logo,
      tier: tierName,
      tier_order: tierPriority,
      is_global: Boolean(raw.is_global),
      visible: raw.visible ?? true,
      event_sponsor_id: raw.event_sponsor_id,
    };

    // Deduplication key: prefer id or event_sponsor_id or lowercase company name
    const dedupeKey = String(raw.id ?? raw.event_sponsor_id ?? company)
      .toLowerCase()
      .trim();

    const existing = partnerMap.get(dedupeKey);
    if (!existing) {
      partnerMap.set(dedupeKey, partner);
    } else {
      // If existing has generic tier ("Sponsor" / "Partner") but new has a specific tier (e.g. "Gold"), upgrade it
      const existingIsGeneric = existing.tier === "Sponsor" || existing.tier === "Partner";
      const newIsSpecific = tierName !== "Sponsor" && tierName !== "Partner";
      if (existingIsGeneric && newIsSpecific) {
        partnerMap.set(dedupeKey, { ...existing, ...partner, tier: tierName, tier_order: tierPriority });
      }
    }
  };

  // 1. Check existing event.partners (if already parsed)
  if (Array.isArray(event.partners)) {
    for (const item of event.partners) {
      processItem(item, item.tier);
    }
  }

  // 2. Check event.partners_list
  if (Array.isArray(event.partners_list)) {
    for (const item of event.partners_list) {
      processItem(item, "Partner");
    }
  }

  // 3. Check event.sponsors
  if (Array.isArray(event.sponsors)) {
    for (const item of event.sponsors) {
      processItem(item, "Sponsor");
    }
  }

  // 4. Check event.media_partners
  if (Array.isArray(event.media_partners)) {
    for (const item of event.media_partners) {
      processItem(item, "Media Partner");
    }
  }

  // 5. Scan all dynamic keys (e.g. `sponsors_gold-5`, `sponsors_platinum-4`, `sponsors-silver`, etc.)
  for (const [key, value] of Object.entries(event)) {
    if (
      (key.startsWith("sponsors_") ||
        key.startsWith("sponsors-") ||
        key.startsWith("partners_") ||
        key.startsWith("partners-")) &&
      Array.isArray(value)
    ) {
      const tierSlug = key.replace(/^(?:sponsors?|partners?)[-_]/i, "");
      const tierName = formatTierName(tierSlug);
      for (const item of value) {
        processItem(item, tierName);
      }
    }
  }

  const partners = Array.from(partnerMap.values());

  // Sort by tier_order ascending, then by company name
  partners.sort((a, b) => {
    const orderA = a.tier_order ?? 20;
    const orderB = b.tier_order ?? 20;
    if (orderA !== orderB) return orderA - orderB;
    return a.company.localeCompare(b.company);
  });

  return partners;
}

/**
 * Group partners by tier while preserving the priority order.
 */
export function groupPartnersByTier(partners: BevyPartner[]): BevyPartnerTierGroup[] {
  const groupMap = new Map<string, BevyPartnerTierGroup>();

  for (const partner of partners) {
    const tierName = partner.tier ?? "Sponsor";
    const tierOrder = partner.tier_order ?? getTierPriority(tierName);

    if (!groupMap.has(tierName)) {
      groupMap.set(tierName, {
        tierName,
        tierOrder,
        partners: [],
      });
    }
    groupMap.get(tierName)?.partners.push(partner);
  }

  const groups = Array.from(groupMap.values());
  groups.sort((a, b) => {
    if (a.tierOrder !== b.tierOrder) return a.tierOrder - b.tierOrder;
    return a.tierName.localeCompare(b.tierName);
  });

  return groups;
}
