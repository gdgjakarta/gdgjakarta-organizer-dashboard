import type { EventMerchandiseItem, FirestoreRegistration, SelectedMerchandiseOrder } from "@/lib/firestore/types";

export interface MerchandiseVariationBadge {
  key: string;
  label: string;
  value: string;
  isSize: boolean;
}

const KNOWN_SIZE_VALUES = new Set([
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "xxl",
  "xxxl",
  "small",
  "medium",
  "large",
  "extra large",
]);

const SIZE_SORT_ORDER: Record<string, number> = {
  xs: 1,
  s: 2,
  m: 3,
  l: 4,
  xl: 5,
  "2xl": 6,
  xxl: 6,
  "3xl": 7,
  xxxl: 7,
  "4xl": 8,
  "5xl": 9,
};

/**
 * Checks if a key or value represents an apparel size.
 */
export function isSizeVariation(key: string, value: string): boolean {
  const k = key.toLowerCase().trim();
  const v = value.toLowerCase().trim();
  if (k.includes("size") || k.includes("ukuran") || k.includes("sizing")) return true;
  if (KNOWN_SIZE_VALUES.has(v)) return true;
  return false;
}

/**
 * Extracts structured badges for variations and sizes from a merchandise order.
 */
export function parseMerchandiseVariations(
  item: SelectedMerchandiseOrder,
  regAnswers?: Record<string, unknown>,
): MerchandiseVariationBadge[] {
  const badges: MerchandiseVariationBadge[] = [];
  const seenKeys = new Set<string>();

  if (item.selected_variations && typeof item.selected_variations === "object") {
    for (const [k, v] of Object.entries(item.selected_variations)) {
      if (!v) continue;
      const valStr = String(v).trim();
      const isSize = isSizeVariation(k, valStr);
      badges.push({
        key: k,
        label: k,
        value: valStr,
        isSize,
      });
      seenKeys.add(k.toLowerCase().trim());
    }
  }

  if (item.selected_size && !seenKeys.has("size")) {
    badges.push({
      key: "size",
      label: "Size",
      value: String(item.selected_size).trim(),
      isSize: true,
    });
    seenKeys.add("size");
  }

  if (item.selected_variant && !seenKeys.has("variant")) {
    const isSize = isSizeVariation("variant", String(item.selected_variant));
    badges.push({
      key: "variant",
      label: "Variant",
      value: String(item.selected_variant).trim(),
      isSize,
    });
    seenKeys.add("variant");
  }

  // Fallback check against questionnaire answers (e.g. tshirt_size or size) if no size was recorded
  if (!badges.some((b) => b.isSize) && regAnswers) {
    const itemName = (item.name || "").toLowerCase();
    const isApparel =
      itemName.includes("shirt") ||
      itemName.includes("kaos") ||
      itemName.includes("hoodie") ||
      itemName.includes("jacket") ||
      itemName.includes("apparel") ||
      itemName.includes("jersey");

    if (isApparel) {
      for (const [ansKey, ansVal] of Object.entries(regAnswers)) {
        const kLower = ansKey.toLowerCase();
        if ((kLower.includes("size") || kLower.includes("ukuran")) && ansVal) {
          const valStr = String(ansVal).trim();
          badges.push({
            key: ansKey,
            label: "Size",
            value: valStr,
            isSize: true,
          });
          break;
        }
      }
    }
  }

  return badges;
}

/**
 * Returns formatted text of all variations (e.g. "Size: XL, Color: Black")
 */
export function formatMerchandiseVariationsText(
  item: SelectedMerchandiseOrder,
  regAnswers?: Record<string, unknown>,
): string {
  const badges = parseMerchandiseVariations(item, regAnswers);
  if (badges.length === 0) return "";
  return badges.map((b) => (b.label ? `${b.label}: ${b.value}` : b.value)).join(", ");
}

/**
 * Returns formatted summary string of the merchandise item (e.g. "1x DevFest T-Shirt 2026 (Size: XL, Color: Black)")
 */
export function formatMerchandiseSummary(item: SelectedMerchandiseOrder, regAnswers?: Record<string, unknown>): string {
  const variationsText = formatMerchandiseVariationsText(item, regAnswers);
  const qty = item.quantity || 1;
  const name = item.name || "Merchandise";
  return `${qty}x ${name}${variationsText ? ` (${variationsText})` : ""}`;
}

export interface MerchandiseItemOption {
  id: string;
  name: string;
  count: number;
}

export interface MerchandiseVariantOption {
  value: string;
  label: string;
  isSize: boolean;
  count: number;
}

/**
 * Discovers and counts all merchandise products and variation options across registrations.
 */
export function collectMerchandiseFilterOptions(
  registrations: FirestoreRegistration[],
  eventMerchandise?: EventMerchandiseItem[],
): {
  items: MerchandiseItemOption[];
  sizes: MerchandiseVariantOption[];
  variants: MerchandiseVariantOption[];
  totalWithMerch: number;
  totalWithoutMerch: number;
} {
  const itemCounts = new Map<string, { id: string; name: string; count: number }>();
  const sizeCounts = new Map<string, number>();
  const variantCounts = new Map<string, number>();

  let totalWithMerch = 0;
  let totalWithoutMerch = 0;

  // Seed defined event merchandise
  if (eventMerchandise) {
    for (const em of eventMerchandise) {
      if (em.name) {
        itemCounts.set(em.name.toLowerCase().trim(), {
          id: em.id || em.name,
          name: em.name,
          count: 0,
        });
      }
    }
  }

  for (const reg of registrations) {
    const orders = reg.selected_merchandise ?? [];
    if (orders.length > 0) {
      totalWithMerch += 1;
      const seenRegItems = new Set<string>();
      const seenRegSizes = new Set<string>();
      const seenRegVariants = new Set<string>();

      for (const order of orders) {
        const orderName = (order.name || "").trim();
        const lowerName = orderName.toLowerCase();
        if (orderName && !seenRegItems.has(lowerName)) {
          seenRegItems.add(lowerName);
          const existing = itemCounts.get(lowerName);
          if (existing) {
            existing.count += 1;
          } else {
            itemCounts.set(lowerName, {
              id: order.id || orderName,
              name: orderName,
              count: 1,
            });
          }
        }

        const badges = parseMerchandiseVariations(order, reg.answers);
        for (const b of badges) {
          if (b.isSize) {
            const sizeVal = b.value.toUpperCase().trim();
            if (!seenRegSizes.has(sizeVal)) {
              seenRegSizes.add(sizeVal);
              sizeCounts.set(sizeVal, (sizeCounts.get(sizeVal) || 0) + 1);
            }
          } else {
            const varVal = `${b.label}: ${b.value}`;
            if (!seenRegVariants.has(varVal)) {
              seenRegVariants.add(varVal);
              variantCounts.set(varVal, (variantCounts.get(varVal) || 0) + 1);
            }
          }
        }
      }
    } else {
      totalWithoutMerch += 1;
    }
  }

  const items = Array.from(itemCounts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const sizes: MerchandiseVariantOption[] = Array.from(sizeCounts.entries())
    .map(([val, count]) => ({
      value: val,
      label: `Size: ${val}`,
      isSize: true,
      count,
    }))
    .sort((a, b) => {
      const orderA = SIZE_SORT_ORDER[a.value.toLowerCase()] ?? 99;
      const orderB = SIZE_SORT_ORDER[b.value.toLowerCase()] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.value.localeCompare(b.value);
    });

  const variants: MerchandiseVariantOption[] = Array.from(variantCounts.entries())
    .map(([val, count]) => ({
      value: val,
      label: val,
      isSize: false,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    items,
    sizes,
    variants,
    totalWithMerch,
    totalWithoutMerch,
  };
}

export {
  calculateMerchandiseComprehensiveStock,
  getFirstAvailableVariationOption,
  getMerchandiseItemStock,
  getMerchandiseOptionStock,
  isMerchandiseItemCompletelySoldOut,
  type MerchandiseComprehensiveStock,
  type MerchandiseOptionStockBreakdown,
  type MerchandiseStockStatus,
  type MerchandiseVariationStockBreakdown,
} from "@/lib/events/merchandise-templates";
