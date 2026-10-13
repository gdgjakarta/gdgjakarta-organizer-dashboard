import type { EventBundlePackage, EventMerchandiseItem, EventTicketTier } from "@/lib/firestore/types";

export interface BundlePricingDetails {
  ticketSubtotal: number;
  ticketQuantity: number;
  merchSubtotal: number;
  standaloneTotal: number;
  bundlePrice: number;
  savings: number;
  discountPercentage: number;
}

export interface BundleSalesStatus {
  status: "active" | "sold_out" | "upcoming" | "ended" | "hidden";
  isAvailable: boolean;
  badgeLabel: string;
  badgeColor: string;
}

export const CUSTOM_BUNDLE_TEMPLATES_STORAGE_KEY = "gdg_custom_bundle_templates";

/**
 * Calculates total standalone price, savings amount, and discount percentage for a bundle.
 */
export function calculateBundlePricing(
  bundle: Pick<EventBundlePackage, "price" | "merchandise_items"> & {
    ticket_id?: string | null;
    ticket_quantity?: number;
  },
  tickets: EventTicketTier[] = [],
  merchandise: EventMerchandiseItem[] = [],
): BundlePricingDetails {
  const hasTicket = Boolean(bundle.ticket_id && bundle.ticket_id !== "none");
  const matchingTicket = hasTicket ? tickets.find((t) => t.id === bundle.ticket_id) : undefined;
  const ticketQuantity = hasTicket ? Math.max(1, bundle.ticket_quantity ?? 1) : 0;
  const ticketPrice = matchingTicket?.price ?? 0;
  const ticketSubtotal = ticketPrice * ticketQuantity;

  let merchTotal = 0;
  for (const item of bundle.merchandise_items ?? []) {
    const matchingMerch = merchandise.find((m) => m.id === item.merchandise_id);
    if (matchingMerch && !matchingMerch.is_free) {
      merchTotal += (matchingMerch.price || 0) * (item.quantity || 1);
    }
  }

  const standaloneTotal = ticketSubtotal + merchTotal;
  const bundlePrice = bundle.price;
  const savings = Math.max(0, standaloneTotal - bundlePrice);
  const discountPercentage = standaloneTotal > 0 ? Math.round((savings / standaloneTotal) * 100) : 0;

  return {
    ticketSubtotal,
    ticketQuantity,
    merchSubtotal: merchTotal,
    standaloneTotal,
    bundlePrice,
    savings,
    discountPercentage,
  };
}

/**
 * Resolves the real-time sales availability and status badge for a bundle package.
 */
export function getBundleSalesStatus(bundle: EventBundlePackage): BundleSalesStatus {
  if (bundle.status === "hidden") {
    return {
      status: "hidden",
      isAvailable: false,
      badgeLabel: "Hidden",
      badgeColor: "border-muted-foreground/30 bg-muted text-muted-foreground",
    };
  }

  const isCapacityReached =
    typeof bundle.capacity === "number" && bundle.capacity > 0 && (bundle.total_registered ?? 0) >= bundle.capacity;

  if (bundle.status === "sold_out" || isCapacityReached) {
    return {
      status: "sold_out",
      isAvailable: false,
      badgeLabel: "Sold Out",
      badgeColor: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }

  const now = Date.now();

  if (bundle.sales_start_date && bundle.sales_start_date.trim() !== "") {
    const startTime = new Date(bundle.sales_start_date).getTime();
    if (!Number.isNaN(startTime) && now < startTime) {
      return {
        status: "upcoming",
        isAvailable: false,
        badgeLabel: "Upcoming",
        badgeColor: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      };
    }
  }

  if (bundle.sales_end_date && bundle.sales_end_date.trim() !== "") {
    const endTime = new Date(bundle.sales_end_date).getTime();
    if (!Number.isNaN(endTime) && now > endTime) {
      return {
        status: "ended",
        isAvailable: false,
        badgeLabel: "Sales Ended",
        badgeColor: "border-muted-foreground/30 bg-muted text-muted-foreground",
      };
    }
  }

  return {
    status: "active",
    isAvailable: true,
    badgeLabel: "Available",
    badgeColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };
}

/**
 * Guarantees an array of bundles is returned safely.
 */
export function ensureEventBundles(bundles?: EventBundlePackage[] | null): EventBundlePackage[] {
  if (Array.isArray(bundles)) return bundles;
  return [];
}

/**
 * Pre-configured GDG Jakarta bundling package templates.
 */
export const GDG_BUNDLE_TEMPLATES: Array<
  Omit<EventBundlePackage, "id" | "ticket_id" | "merchandise_items"> & {
    id: string;
    ticketTypeHint?: "paid" | "free" | "none";
    ticketQuantityHint?: number;
    merchandiseTagsHint?: string[];
    suggestedSavingsPercent: number;
  }
> = [
  {
    id: "tpl-bundle-group-5x-pass",
    name: "Group Admission Pack (5x Passes)",
    description:
      "Buy 5 tickets at a special promotional rate. Includes 1 attendee pass and 4 single-use friend vouchers (100% free) for your team.",
    price: 600000,
    original_price: 750000,
    badge: "5x Group Pass",
    status: "active",
    capacity: 20,
    ticketTypeHint: "paid",
    ticketQuantityHint: 5,
    merchandiseTagsHint: [],
    suggestedSavingsPercent: 20,
  },
  {
    id: "tpl-bundle-vip-swag-pass",
    name: "VIP Conference Pass & Full Swag Kit",
    description:
      "Includes premium conference admission, official heavyweight developer shirt, conference hoodie, and deluxe lanyard kit with 25% savings.",
    price: 350000,
    original_price: 450000,
    badge: "Best Value",
    status: "active",
    capacity: 50,
    ticketTypeHint: "paid",
    ticketQuantityHint: 1,
    merchandiseTagsHint: ["T-Shirt", "Hoodie", "Swag Kit"],
    suggestedSavingsPercent: 25,
  },
  {
    id: "tpl-bundle-earlybird-tee",
    name: "Early Bird Admission & Official 2026 T-Shirt",
    description:
      "Full event entry plus guaranteed 100% Cotton 24s official GDG Jakarta commemorative t-shirt in your chosen size.",
    price: 150000,
    original_price: 200000,
    badge: "Popular Combo",
    status: "active",
    capacity: 100,
    ticketTypeHint: "paid",
    ticketQuantityHint: 1,
    merchandiseTagsHint: ["T-Shirt"],
    suggestedSavingsPercent: 25,
  },
  {
    id: "tpl-bundle-deluxe-swag-only",
    name: "Official GDG Swag & Apparel Collector Pack",
    description:
      "Merchandise-only combo package. Includes official commemorative t-shirt, stickers, and collector pin at bundle savings.",
    price: 120000,
    original_price: 160000,
    badge: "Merch Only",
    status: "active",
    capacity: null,
    ticketTypeHint: "none",
    ticketQuantityHint: 0,
    merchandiseTagsHint: ["T-Shirt", "Stickers", "Pin"],
    suggestedSavingsPercent: 25,
  },
  {
    id: "tpl-bundle-community-supporter",
    name: "Community Supporter Pack",
    description:
      "Free community RSVP admission bundled with an exclusive die-cut holographic sticker pack and enamel collector pin.",
    price: 50000,
    original_price: 75000,
    badge: "Supporter Perk",
    status: "active",
    capacity: null,
    ticketTypeHint: "free",
    ticketQuantityHint: 1,
    merchandiseTagsHint: ["Stickers", "Pin"],
    suggestedSavingsPercent: 33,
  },
];

/**
 * Retrieves all bundle templates (system built-in + organizer custom saved).
 */
export function getAllBundleTemplates(): Array<EventBundlePackage & { is_custom?: boolean }> {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(CUSTOM_BUNDLE_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({ ...item, is_custom: true }));
    }
  } catch {
    // Ignore JSON parse errors
  }
  return [];
}

/**
 * Saves a configured bundle as a reusable custom template in localStorage.
 */
export function saveBundleAsTemplate(bundle: EventBundlePackage): void {
  if (typeof window === "undefined") return;

  try {
    const existing = getAllBundleTemplates();
    const updated = [
      {
        ...bundle,
        id: `custom-tpl-${Date.now()}`,
        is_custom: true,
        created_at: new Date().toISOString(),
      },
      ...existing.filter((t) => t.name.toLowerCase() !== bundle.name.toLowerCase()),
    ];
    localStorage.setItem(CUSTOM_BUNDLE_TEMPLATES_STORAGE_KEY, JSON.stringify(updated.slice(0, 20)));
  } catch (err) {
    console.warn("[BundleTemplates] Failed to save custom bundle template:", err);
  }
}

/**
 * Deletes a custom bundle template from localStorage.
 */
export function deleteCustomBundleTemplate(templateId: string): void {
  if (typeof window === "undefined") return;

  try {
    const existing = getAllBundleTemplates();
    const filtered = existing.filter((t) => t.id !== templateId);
    localStorage.setItem(CUSTOM_BUNDLE_TEMPLATES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn("[BundleTemplates] Failed to delete custom bundle template:", err);
  }
}
