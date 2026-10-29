import type {
  EventMerchandiseItem,
  EventMerchandiseOrder,
  FirestoreRegistration,
  MerchandiseGuideline,
  MerchandiseVariation,
} from "@/lib/firestore/types";

export interface VariationTemplatePreset {
  id: string;
  name: string;
  description: string;
  variation: MerchandiseVariation;
  defaultGuideline?: MerchandiseGuideline;
}

/**
 * Standard variation presets that organizers can apply with a single click.
 */
export const VARIATION_TEMPLATES: VariationTemplatePreset[] = [
  {
    id: "apparel-sizes",
    name: "T-Shirt / Apparel Sizes (S - 3XL)",
    description: "Standard unisex clothing sizes with optional plus-size pricing",
    variation: {
      name: "Size",
      options: ["S", "M", "L", "XL", "2XL", "3XL"],
      option_details: {
        "2XL": { stock: 25 },
        "3XL": { stock: 15 },
      },
    },
    defaultGuideline: {
      title: "T-Shirt Sizing Guideline & Measurements (Unisex)",
      text: "Size chart in cm (Chest Width x Body Length):\n• S: 48 cm x 68 cm\n• M: 50 cm x 70 cm\n• L: 52 cm x 72 cm\n• XL: 54 cm x 74 cm\n• 2XL: 56 cm x 76 cm\n• 3XL: 58 cm x 78 cm\n\nMaterial: Premium 100% Cotton Combed 24s. Preshrunk fabric.\nTolerance: ±1.5 cm due to garment manufacturing.",
      image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "hoodie-jacket-sizes",
    name: "Hoodie / Jacket Sizes (M - 2XL)",
    description: "Outerwear sizes with measurements and stock quotas",
    variation: {
      name: "Size",
      options: ["M", "L", "XL", "2XL"],
      option_details: {
        "2XL": { stock: 20 },
      },
    },
    defaultGuideline: {
      title: "Hoodie & Jacket Sizing Chart",
      text: "Measurements in cm (Chest Width x Body Length x Sleeve Length):\n• M: 52 cm x 68 cm x 60 cm\n• L: 55 cm x 71 cm x 62 cm\n• XL: 58 cm x 74 cm x 64 cm\n• 2XL: 61 cm x 77 cm x 66 cm\n\nMaterial: Heavyweight 330gsm Cotton Fleece with brushed inner lining.",
      image_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "gdg-colors",
    name: "GDG & Google Colors",
    description: "Signature Google brand and community colors",
    variation: {
      name: "Color",
      options: ["Google Blue", "Google Red", "Google Yellow", "Google Green", "Midnight Black", "Natural White"],
      option_details: {
        "Google Blue": {
          image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
        },
        "Midnight Black": {
          image_url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80",
        },
      },
    },
  },
  {
    id: "neutral-colors",
    name: "Apparel Colors (Neutral)",
    description: "Everyday wearable colorways",
    variation: {
      name: "Color",
      options: ["Charcoal Black", "Navy Blue", "Heather Grey", "Pure White"],
    },
  },
  {
    id: "materials-fabric",
    name: "Fabric / Material Type",
    description: "Cotton combed weight and eco-friendly textiles",
    variation: {
      name: "Material",
      options: ["Cotton Combed 24s", "Cotton Combed 30s", "Organic Heavy Canvas", "Heavy Fleece"],
    },
    defaultGuideline: {
      title: "Material & Fabric Care Guideline",
      text: "Fabric Specifications:\n• Cotton Combed 24s: Heavier, durable, structured drape (180-190 gsm).\n• Cotton Combed 30s: Lighter, breathable, perfect for warm climates (140-150 gsm).\n\nWashing Care:\n1. Machine wash cold with similar colors inside-out.\n2. Do not bleach or dry clean.\n3. Iron on low heat, avoid direct iron over printed graphics.",
    },
  },
  {
    id: "fit-silhouette",
    name: "Fit & Silhouette",
    description: "Apparel cut style",
    variation: {
      name: "Fit",
      options: ["Regular Fit", "Oversized Fit", "Boxy Cut", "Slim Fit"],
    },
  },
  {
    id: "sticker-finish",
    name: "Sticker & Print Finish",
    description: "Die-cut vinyl finish options",
    variation: {
      name: "Finish",
      options: ["Matte Vinyl", "Holographic Metallic", "Glossy Waterproof"],
    },
  },
  {
    id: "pack-tiers",
    name: "Bundle & Pack Tiers",
    description: "Quantity bundles with tiered pricing",
    variation: {
      name: "Pack Tier",
      options: ["Single Unit", "Pack of 3", "Pack of 5", "Complete Collector Box"],
    },
  },
  {
    id: "shoe-sizes",
    name: "Footwear / Shoe Sizes (EU)",
    description: "EU sizes 38 through 45",
    variation: {
      name: "Size",
      options: ["38", "39", "40", "41", "42", "43", "44", "45"],
    },
    defaultGuideline: {
      title: "Footwear Sizing Chart (EU / Insole cm)",
      text: "Foot length / Insole in cm:\n• EU 38: 24.0 cm\n• EU 39: 24.5 cm\n• EU 40: 25.5 cm\n• EU 41: 26.0 cm\n• EU 42: 27.0 cm\n• EU 43: 27.5 cm\n• EU 44: 28.5 cm\n• EU 45: 29.0 cm",
    },
  },
];

/**
 * Pre-configured GDG merchandise templates that organizers can quickly attach
 * to their event without typing everything from scratch.
 */
export const GDG_MERCHANDISE_TEMPLATES: EventMerchandiseItem[] = [
  {
    id: "tpl-gdg-tshirt-2026",
    name: "GDG Jakarta Developer T-Shirt 2026",
    description:
      "Official 100% Cotton Combed 24s community shirt featuring GDG Jakarta developer artwork. Soft, breathable, and durable.",
    price: 0,
    is_free: true,
    tag: "Exclusive Perk",
    image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80",
    ],
    stock: null,
    variations: [
      {
        name: "Size",
        options: ["S", "M", "L", "XL", "2XL", "3XL"],
        option_details: {
          "2XL": { stock: 30 },
          "3XL": { stock: 15 },
        },
      },
      {
        name: "Color",
        options: ["Navy Blue", "Charcoal Black", "White"],
        option_details: {
          "Navy Blue": {
            image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
          },
          "Charcoal Black": {
            image_url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80",
          },
        },
      },
    ],
    guideline: {
      title: "T-Shirt Sizing Guideline (Unisex)",
      text: "Size chart in cm (Chest Width x Body Length):\n• S: 48 cm x 68 cm\n• M: 50 cm x 70 cm\n• L: 52 cm x 72 cm\n• XL: 54 cm x 74 cm\n• 2XL: 56 cm x 76 cm\n• 3XL: 58 cm x 78 cm\n\nFabric: 100% Cotton Combed 24s. Preshrunk fabric.\nMeasurement tolerance ±1.5 cm.",
      image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
    },
    status: "active",
  },
  {
    id: "tpl-gdg-stickers",
    name: "Google Developer Tech Sticker Pack",
    description:
      "Pack of 8 waterproof die-cut vinyl stickers covering Android, Flutter, Firebase, Google Cloud, and Gemini AI.",
    price: 0,
    is_free: true,
    tag: "Free Perk",
    image_url: "https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=800&auto=format&fit=crop&q=80",
    stock: null,
    variations: [{ name: "Finish", options: ["Matte Vinyl", "Holographic Metallic"] }],
    status: "active",
  },
  {
    id: "tpl-gdg-lanyard",
    name: "GDG Jakarta Event Lanyard & Badge",
    description:
      "Custom 2cm woven polyester lanyard in Google tri-color theme with safety breakaway clip and clear acrylic badge holder.",
    price: 0,
    is_free: true,
    tag: "Included with Ticket",
    image_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    stock: null,
    variations: [{ name: "Theme", options: ["GDG Tri-color", "Midnight Dark"] }],
    status: "active",
  },
  {
    id: "tpl-gdg-tote-bag",
    name: "GDG Canvas Heavy Tote Bag",
    description:
      "14oz heavy-duty organic canvas tote with reinforced box-stitched handles and inner zipper pocket for laptops or tablets.",
    price: 0,
    is_free: true,
    tag: "Limited Perk",
    image_url: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80",
    stock: 200,
    variations: [{ name: "Color", options: ["Natural Cream", "Slate Black"] }],
    status: "active",
  },
  {
    id: "tpl-devfest-hoodie",
    name: "DevFest Jakarta Heavy Fleece Hoodie",
    description:
      "Heavyweight 330gsm cotton fleece zip hoodie with embroidered GDG chest emblem and screenprinted back typography.",
    price: 250000,
    is_free: false,
    tag: "Official Apparel",
    image_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&auto=format&fit=crop&q=80",
    ],
    stock: 100,
    variations: [
      {
        name: "Size",
        options: ["M", "L", "XL", "2XL"],
        option_details: {
          "2XL": { stock: 15 },
        },
      },
      {
        name: "Color",
        options: ["Heather Grey", "Black"],
        option_details: {
          Black: {
            image_url: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&auto=format&fit=crop&q=80",
          },
        },
      },
    ],
    guideline: {
      title: "Hoodie & Jacket Sizing Chart",
      text: "Measurements in cm (Chest Width x Body Length x Sleeve Length):\n• M: 52 cm x 68 cm x 60 cm\n• L: 55 cm x 71 cm x 62 cm\n• XL: 58 cm x 74 cm x 64 cm\n• 2XL: 61 cm x 77 cm x 66 cm\n\nMaterial: Heavyweight 330gsm Cotton Fleece with brushed inner lining.",
      image_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
    },
    status: "active",
  },
  {
    id: "tpl-gdg-tumbler",
    name: "GDG Stainless Steel Tumbler 500ml",
    description:
      "Double-wall 304 food-grade stainless steel vacuum tumbler keeping drinks cold for 24h and hot for 12h. Leak-proof lid.",
    price: 110000,
    is_free: false,
    tag: "Eco Friendly",
    image_url: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop&q=80",
    stock: 150,
    variations: [{ name: "Color", options: ["Matte Black", "Stainless Silver", "Pure White"] }],
    status: "active",
  },
  {
    id: "tpl-enamel-pins",
    name: "GDG Jakarta Collectible Enamel Pin Set",
    description:
      "Set of 2 die-struck soft enamel metal lapel pins with dual rubber clutch backings and protective glossy coating.",
    price: 35000,
    is_free: false,
    tag: "Collectible",
    image_url: "https://images.unsplash.com/photo-1617050318658-a9a3175e34cb?w=800&auto=format&fit=crop&q=80",
    stock: 300,
    variations: [{ name: "Edition", options: ["DevFest 2026 Edition", "Classic GDG Shield"] }],
    status: "active",
  },
  {
    id: "tpl-desk-mat",
    name: "Android & Gemini Developer Desk Mat",
    description: "800x300mm large micro-woven fabric desk mat with non-slip rubber base and anti-fray stitched edges.",
    price: 140000,
    is_free: false,
    tag: "Desk Accessory",
    image_url: "https://images.unsplash.com/photo-1616440347437-b1c73416efc2?w=800&auto=format&fit=crop&q=80",
    stock: 75,
    variations: [{ name: "Design", options: ["Gemini Neural Pattern", "Android Bugdroid Matrix", "Minimalist Code"] }],
    status: "active",
  },
];

export type MerchandiseSalesState = "available" | "upcoming" | "ended" | "sold_out";

export interface MerchandiseSalesStatus {
  isOpen: boolean;
  state: MerchandiseSalesState;
  badgeLabel: string;
  badgeColor: string;
  message?: string;
  formattedStart?: string | null;
  formattedEnd?: string | null;
}

/**
 * Formats a merchandise sales date string for display.
 */
export function formatMerchandiseDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Evaluates the sales window status of an event merchandise item.
 * An item is open/available for purchase only between sales_start_date and sales_end_date (if configured)
 * and when status is active.
 */
export function getMerchandiseSalesStatus(
  item: EventMerchandiseItem,
  now: number = Date.now(),
): MerchandiseSalesStatus {
  if (item.status === "hidden") {
    return {
      isOpen: false,
      state: "ended",
      badgeLabel: "Hidden",
      badgeColor: "border-muted-foreground/30 bg-muted text-muted-foreground",
      message: `The item "${item.name}" is hidden and not available for purchase.`,
    };
  }

  if (item.status === "draft") {
    return {
      isOpen: false,
      state: "ended",
      badgeLabel: "Draft",
      badgeColor: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      message: `The item "${item.name}" is a draft and not available for purchase.`,
    };
  }

  if (item.status === "out_of_stock") {
    return {
      isOpen: false,
      state: "sold_out",
      badgeLabel: "Out of Stock",
      badgeColor: "border-destructive/30 bg-destructive/10 text-destructive",
      message: `The item "${item.name}" is out of stock.`,
    };
  }

  const formattedStart =
    item.sales_start_date && item.sales_start_date.trim() !== "" ? formatMerchandiseDate(item.sales_start_date) : null;
  const formattedEnd =
    item.sales_end_date && item.sales_end_date.trim() !== "" ? formatMerchandiseDate(item.sales_end_date) : null;

  if (item.sales_start_date && item.sales_start_date.trim() !== "") {
    try {
      const startTime = new Date(item.sales_start_date).getTime();
      if (!Number.isNaN(startTime) && now < startTime) {
        return {
          isOpen: false,
          state: "upcoming",
          badgeLabel: "Sales Opens Soon",
          badgeColor: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
          message: formattedStart ? `Sales starts on ${formattedStart}.` : "Sales has not opened yet.",
          formattedStart,
          formattedEnd,
        };
      }
    } catch {
      // ignore invalid date
    }
  }

  if (item.sales_end_date && item.sales_end_date.trim() !== "") {
    try {
      const endTime = new Date(item.sales_end_date).getTime();
      if (!Number.isNaN(endTime) && now > endTime) {
        return {
          isOpen: false,
          state: "ended",
          badgeLabel: "Sales Closed",
          badgeColor: "border-muted-foreground/30 bg-muted text-muted-foreground",
          message: formattedEnd ? `Sales ended on ${formattedEnd}.` : "Sales has ended.",
          formattedStart,
          formattedEnd,
        };
      }
    } catch {
      // ignore invalid date
    }
  }

  return {
    isOpen: true,
    state: "available",
    badgeLabel: "Available",
    badgeColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    formattedStart,
    formattedEnd,
  };
}

export interface MerchandiseStockStatus {
  isUnlimited: boolean;
  stockLimit: number | null;
  soldCount: number;
  remainingStock: number;
  isSoldOut: boolean;
}

/**
 * Calculates stock status for a merchandise item.
 * An item is sold out if its status is "out_of_stock", or if stock is limited and total_sold >= stock.
 */
export function getMerchandiseItemStock(item: EventMerchandiseItem): MerchandiseStockStatus {
  if (item.status === "out_of_stock") {
    const sold = item.total_sold ?? 0;
    const limit = item.stock ?? null;
    return {
      isUnlimited: limit === null,
      stockLimit: limit,
      soldCount: sold,
      remainingStock: 0,
      isSoldOut: true,
    };
  }

  const isUnlimited = item.stock === null || item.stock === undefined;
  const soldCount = item.total_sold ?? 0;

  if (isUnlimited) {
    return {
      isUnlimited: true,
      stockLimit: null,
      soldCount,
      remainingStock: Number.POSITIVE_INFINITY,
      isSoldOut: false,
    };
  }

  const stockLimit = Number(item.stock);
  const remainingStock = Math.max(0, stockLimit - soldCount);
  return {
    isUnlimited: false,
    stockLimit,
    soldCount,
    remainingStock,
    isSoldOut: remainingStock <= 0,
  };
}

/**
 * Calculates stock status for a specific variation option (e.g. Size: M).
 * If the variation option defines its own stock override, it uses that.
 * Otherwise, it inherits the base item's stock constraint.
 */
export function getMerchandiseOptionStock(
  item: EventMerchandiseItem,
  variationName: string,
  optionValue: string,
): MerchandiseStockStatus {
  const variation = item.variations.find((v) => v.name.toLowerCase() === variationName.toLowerCase());
  const detail = variation?.option_details?.[optionValue];

  // Specific override on option
  if (detail?.stock !== null && detail?.stock !== undefined) {
    const stockLimit = Number(detail.stock);
    const soldCount = detail.total_sold ?? 0;
    const remainingStock = Math.max(0, stockLimit - soldCount);
    return {
      isUnlimited: false,
      stockLimit,
      soldCount,
      remainingStock,
      isSoldOut: remainingStock <= 0 || item.status === "out_of_stock",
    };
  }

  // Inherits base item stock
  const baseStatus = getMerchandiseItemStock(item);
  return baseStatus;
}

/**
 * Helper to check if an entire merchandise item has any selectable variations in stock.
 * If all variation options of any required variation are sold out, returns true.
 */
export function isMerchandiseItemCompletelySoldOut(item: EventMerchandiseItem): boolean {
  if (item.status === "out_of_stock") return true;
  const baseStatus = getMerchandiseItemStock(item);
  if (!baseStatus.isUnlimited && baseStatus.isSoldOut) return true;

  if (item.variations.length > 0) {
    // If there is any variation where EVERY option is sold out, the item cannot be fulfilled
    for (const v of item.variations) {
      if (v.options && v.options.length > 0) {
        const hasAnyOptionInStock = v.options.some((opt) => {
          const optStatus = getMerchandiseOptionStock(item, v.name, opt);
          return !optStatus.isSoldOut;
        });
        if (!hasAnyOptionInStock) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Returns the first in-stock option for a variation, or the first option if none is available.
 */
export function getFirstAvailableVariationOption(item: EventMerchandiseItem, variationName: string): string {
  const variation = item.variations.find((v) => v.name.toLowerCase() === variationName.toLowerCase());
  if (!variation || variation.options.length === 0) return "";

  for (const opt of variation.options) {
    const optStatus = getMerchandiseOptionStock(item, variationName, opt);
    if (!optStatus.isSoldOut) {
      return opt;
    }
  }

  return variation.options[0] ?? "";
}

export interface MerchandiseOptionStockBreakdown {
  option: string;
  quota: number | null; // null if unlimited
  sold: number;
  remaining: number | null; // null if unlimited
  isSoldOut: boolean;
}

export interface MerchandiseVariationStockBreakdown {
  variationName: string;
  hasCustomQuotas: boolean;
  options: MerchandiseOptionStockBreakdown[];
}

export interface MerchandiseComprehensiveStock {
  totalCapacity: number | null; // null if truly unlimited
  totalSold: number;
  totalRemaining: number | null; // null if truly unlimited
  isUnlimited: boolean;
  isSoldOut: boolean;
  hasVariationQuotas: boolean;
  variations: MerchandiseVariationStockBreakdown[];
}

/**
 * Extracts live units sold for each variation option across registrations and paid OTS orders.
 * Returns: { [variationName]: { [optionValue]: count } }
 */
export function extractLiveOptionSoldUnits(
  merchandise: EventMerchandiseItem[],
  registrations: FirestoreRegistration[],
  orders?: EventMerchandiseOrder[],
): Record<string, Record<string, Record<string, number>>> {
  const liveCountMap: Record<string, Record<string, Record<string, number>>> = {};

  for (const m of merchandise) {
    liveCountMap[m.id] = {};
    const variations = m.variations;
    for (const v of variations) {
      liveCountMap[m.id][v.name] = {};
      const options = v.options || [];
      for (const opt of options) {
        liveCountMap[m.id][v.name][opt] = 0;
      }
    }
  }

  // Count from eligible attendee registrations
  for (const reg of registrations) {
    if (reg.status === "cancelled" || reg.status === "canceled" || reg.status === "rejected") continue;
    for (const item of reg.selected_merchandise ?? []) {
      const matched = merchandise.find(
        (m) =>
          m.id === item.id ||
          m.id === item.merchandise_id ||
          m.name.toLowerCase().trim() === item.name?.toLowerCase().trim(),
      );
      if (!matched) continue;
      const qty = item.quantity || 1;
      const varMap = liveCountMap[matched.id];
      if (!varMap) continue;

      if (item.selected_variations && typeof item.selected_variations === "object") {
        for (const [vName, optVal] of Object.entries(item.selected_variations)) {
          if (!optVal) continue;
          for (const realVName of Object.keys(varMap)) {
            if (realVName.toLowerCase() === vName.toLowerCase()) {
              varMap[realVName][String(optVal)] = (varMap[realVName][String(optVal)] || 0) + qty;
            }
          }
        }
      }
      if (item.selected_size) {
        for (const realVName of Object.keys(varMap)) {
          if (realVName.toLowerCase().includes("size") || realVName.toLowerCase().includes("ukuran")) {
            const sizeVal = String(item.selected_size);
            varMap[realVName][sizeVal] = (varMap[realVName][sizeVal] || 0) + qty;
          }
        }
      }
    }
  }

  // Count from paid on-the-spot merchandise orders
  if (orders) {
    for (const o of orders) {
      if (o.payment_status !== "paid") continue;
      for (const it of o.items ?? []) {
        const matched = merchandise.find(
          (m) => m.id === it.merchandise_id || m.name.toLowerCase().trim() === it.name?.toLowerCase().trim(),
        );
        if (!matched) continue;
        const qty = it.quantity || 1;
        const varMap = liveCountMap[matched.id];
        if (!varMap) continue;

        if (it.selected_variations && typeof it.selected_variations === "object") {
          for (const [vName, optVal] of Object.entries(it.selected_variations)) {
            if (!optVal) continue;
            for (const realVName of Object.keys(varMap)) {
              if (realVName.toLowerCase() === vName.toLowerCase()) {
                varMap[realVName][String(optVal)] = (varMap[realVName][String(optVal)] || 0) + qty;
              }
            }
          }
        }
      }
    }
  }

  // Merge live counts with baseline item variation detail sold counts (never double-counting)
  const result: Record<string, Record<string, Record<string, number>>> = {};
  for (const m of merchandise) {
    result[m.id] = {};
    const variations = m.variations;
    for (const v of variations) {
      result[m.id][v.name] = {};
      const options = v.options || [];
      for (const opt of options) {
        const baseSold = v.option_details?.[opt]?.total_sold ?? 0;
        const liveSold = liveCountMap[m.id]?.[v.name]?.[opt] ?? 0;
        result[m.id][v.name][opt] = Math.max(baseSold, liveSold);
      }
    }
  }

  return result;
}

/**
 * Calculates comprehensive stock metrics for a merchandise item.
 * If base item stock is null, but variation options have explicit quotas (e.g. S:40, M:50, L:40, XL:20),
 * aggregates the primary variation's option quotas into total capacity and available remaining stock.
 */
export function calculateMerchandiseComprehensiveStock(
  item: EventMerchandiseItem,
  liveSoldUnits?: number,
  liveOptionSoldUnits?: Record<string, Record<string, number>>,
): MerchandiseComprehensiveStock {
  const variationsBreakdown: MerchandiseVariationStockBreakdown[] = item.variations.map((v) => {
    let hasCustomQuotas = false;
    const options: MerchandiseOptionStockBreakdown[] = v.options.map((opt) => {
      const detail = v.option_details?.[opt];
      const hasSpecificStock = detail?.stock !== null && detail?.stock !== undefined;
      if (hasSpecificStock) hasCustomQuotas = true;

      let quota: number | null = null;
      if (hasSpecificStock) {
        quota = Number(detail?.stock);
      } else if (item.stock !== null && item.stock !== undefined) {
        quota = Number(item.stock);
      }

      const rawSold = detail?.total_sold ?? 0;
      const liveSold = liveOptionSoldUnits?.[v.name]?.[opt];
      const sold = typeof liveSold === "number" ? Math.max(rawSold, liveSold) : rawSold;
      const remaining = quota !== null ? Math.max(0, quota - sold) : null;
      const isSoldOut = (quota !== null && remaining !== null && remaining <= 0) || item.status === "out_of_stock";

      return {
        option: opt,
        quota,
        sold,
        remaining,
        isSoldOut,
      };
    });

    return {
      variationName: v.name,
      hasCustomQuotas,
      options,
    };
  });

  // Check if variations have custom quotas (e.g., Size has S:25, M:25, L:25, XL:20)
  const variationWithQuotas = variationsBreakdown.find((vb) => vb.hasCustomQuotas);

  let totalCapacity: number | null = null;
  let hasVariationQuotas = false;
  let totalRemaining: number | null = null;
  let totalSold = typeof liveSoldUnits === "number" && liveSoldUnits > 0 ? liveSoldUnits : (item.total_sold ?? 0);

  if (variationWithQuotas) {
    hasVariationQuotas = true;
    let sumQuota = 0;
    let sumRemaining = 0;
    let sumOptionSold = 0;
    let hasUnlimitedOption = false;

    for (const opt of variationWithQuotas.options) {
      if (opt.quota !== null) {
        sumQuota += opt.quota;
        sumRemaining += Math.max(0, opt.remaining ?? 0);
      } else {
        hasUnlimitedOption = true;
      }
      sumOptionSold += opt.sold;
    }

    if (item.stock !== null && item.stock !== undefined) {
      totalCapacity = Number(item.stock);
    } else {
      totalCapacity = sumQuota > 0 ? sumQuota : null;
    }

    totalSold = Math.max(totalSold, sumOptionSold);
    // When an item has variation quotas, the true available remaining stock is the sum of remaining units across selectable options
    totalRemaining = hasUnlimitedOption && item.stock === null ? null : sumRemaining;
  } else if (item.stock !== null && item.stock !== undefined) {
    totalCapacity = Number(item.stock);
    totalSold = Math.max(totalSold, typeof liveSoldUnits === "number" ? liveSoldUnits : 0);
    totalRemaining = Math.max(0, totalCapacity - totalSold);
  } else {
    // Truly unlimited stock
    totalSold = Math.max(totalSold, typeof liveSoldUnits === "number" ? liveSoldUnits : 0);
    totalRemaining = null;
  }

  const isUnlimited = totalCapacity === null;
  const isSoldOut =
    item.status === "out_of_stock" ||
    (totalRemaining !== null && totalRemaining <= 0) ||
    isMerchandiseItemCompletelySoldOut(item);

  return {
    totalCapacity,
    totalSold,
    totalRemaining,
    isUnlimited,
    isSoldOut,
    hasVariationQuotas,
    variations: variationsBreakdown,
  };
}
