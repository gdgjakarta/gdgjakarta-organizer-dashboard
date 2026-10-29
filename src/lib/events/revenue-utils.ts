import type {
  EventMerchandiseItem,
  EventMerchandiseOrder,
  EventTicketTier,
  FirestoreRegistration,
  TicketType,
} from "@/lib/firestore/types";

export interface TicketTypeRevenueSummary {
  type: TicketType;
  label: string;
  grossRevenue: number;
  netRevenue: number;
  voucherDiscount: number;
  referralDiscount: number;
  vouchersRedeemed: number;
  referralsRedeemed: number;
  ticketsSold: number;
}

export interface TicketTierRevenueSummary {
  ticketId: string;
  ticketName: string;
  ticketType: TicketType;
  grossRevenue: number;
  netRevenue: number;
  voucherDiscount: number;
  referralDiscount: number;
  vouchersRedeemed: number;
  referralsRedeemed: number;
  ticketsSold: number;
}

export interface TicketRevenueMetrics {
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalVoucherDiscount: number;
  totalReferralDiscount: number;
  totalVouchersRedeemed: number;
  totalReferralsRedeemed: number;
  totalTicketsSold: number;
  byType: Record<TicketType, TicketTypeRevenueSummary>;
  byTier: Map<string, TicketTierRevenueSummary>;
}

export interface MerchandiseItemRevenueSummary {
  merchandiseId: string;
  name: string;
  isFree: boolean;
  grossRevenue: number;
  netRevenue: number;
  voucherDiscount: number;
  vouchersRedeemed: number;
  unitsSold: number;
  ordersCount: number;
}

export interface MerchandiseRevenueMetrics {
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalVoucherDiscount: number;
  totalVouchersRedeemed: number;
  totalUnitsSold: number;
  totalOrdersCount: number;
  byItem: Map<string, MerchandiseItemRevenueSummary>;
  byType: {
    paid: { grossRevenue: number; netRevenue: number; unitsSold: number; voucherDiscount: number };
    free: { unitsClaimed: number; ordersCount: number };
  };
}

/**
 * Checks if a registration is eligible to be counted in realized revenue.
 * Excludes canceled, refunded, failed, and expired registrations.
 */
export function isEligibleRevenueRegistration(reg: FirestoreRegistration): boolean {
  const status = reg.status.toLowerCase().trim();
  const paymentStatus = (reg.payment_status || "").toLowerCase().trim();

  // Exclude invalid/canceled/refunded/failed/expired registrations
  if (
    status === "canceled" ||
    status === "cancelled" ||
    paymentStatus === "refunded" ||
    paymentStatus === "failed" ||
    paymentStatus === "expired" ||
    paymentStatus === "canceled" ||
    paymentStatus === "cancelled"
  ) {
    return false;
  }

  // Realized paid registrations
  if (status === "paid_and_registered" || paymentStatus === "paid") {
    return true;
  }

  // Confirmed free registrations without payment requirements
  if (
    (status === "approved" || status === "registered" || status === "attended") &&
    (reg.ticket_price ?? 0) <= 0 &&
    (!reg.selected_merchandise || reg.selected_merchandise.every((m) => (m.price ?? 0) <= 0))
  ) {
    return true;
  }

  return false;
}

/**
 * Calculates ticket revenue, discounts, and redemptions overall, by ticket type, and per ticket tier.
 */
export function calculateTicketRevenueMetrics(
  registrations: FirestoreRegistration[],
  tickets: EventTicketTier[],
): TicketRevenueMetrics {
  const byTierMap = new Map<string, TicketTierRevenueSummary>();

  // Initialize tier map with configured event tickets
  for (const t of tickets) {
    byTierMap.set(t.id, {
      ticketId: t.id,
      ticketName: t.name,
      ticketType: t.type,
      grossRevenue: 0,
      netRevenue: 0,
      voucherDiscount: 0,
      referralDiscount: 0,
      vouchersRedeemed: 0,
      referralsRedeemed: 0,
      ticketsSold: 0,
    });
  }

  const byType: Record<TicketType, TicketTypeRevenueSummary> = {
    paid: {
      type: "paid",
      label: "Paid Pass",
      grossRevenue: 0,
      netRevenue: 0,
      voucherDiscount: 0,
      referralDiscount: 0,
      vouchersRedeemed: 0,
      referralsRedeemed: 0,
      ticketsSold: 0,
    },
    commitment_fee: {
      type: "commitment_fee",
      label: "Commitment Fee",
      grossRevenue: 0,
      netRevenue: 0,
      voucherDiscount: 0,
      referralDiscount: 0,
      vouchersRedeemed: 0,
      referralsRedeemed: 0,
      ticketsSold: 0,
    },
    free: {
      type: "free",
      label: "Free RSVP",
      grossRevenue: 0,
      netRevenue: 0,
      voucherDiscount: 0,
      referralDiscount: 0,
      vouchersRedeemed: 0,
      referralsRedeemed: 0,
      ticketsSold: 0,
    },
  };

  let totalGrossRevenue = 0;
  let totalNetRevenue = 0;
  let totalVoucherDiscount = 0;
  let totalReferralDiscount = 0;
  let totalVouchersRedeemed = 0;
  let totalReferralsRedeemed = 0;
  let totalTicketsSold = 0;

  for (const reg of registrations) {
    if (!isEligibleRevenueRegistration(reg)) continue;

    // Match registration to a ticket tier
    let matchedTier = tickets.find((t) => t.id === reg.ticket_id);
    if (!matchedTier && reg.ticket_name) {
      const regNameLower = reg.ticket_name.toLowerCase().trim();
      matchedTier = tickets.find((t) => t.name.toLowerCase().trim() === regNameLower);
    }
    if (!matchedTier && reg.ticket_tier) {
      const regTierLower = reg.ticket_tier.toLowerCase().trim();
      matchedTier = tickets.find((t) => t.name.toLowerCase().trim() === regTierLower);
    }

    const ticketType: TicketType =
      reg.ticket_type ?? matchedTier?.type ?? (reg.ticket_price && reg.ticket_price > 0 ? "paid" : "free");

    const grossPrice = typeof reg.ticket_price === "number" ? reg.ticket_price : (matchedTier?.price ?? 0);

    // Compute ticket voucher cut
    let ticketVoucherDiscount = 0;
    const hasVoucher = Boolean(reg.voucher_code?.trim() || (reg.voucher_discount_amount ?? 0) > 0);
    if (hasVoucher) {
      if (reg.voucher_applies_to === "merchandise") {
        ticketVoucherDiscount = 0;
      } else {
        ticketVoucherDiscount = Math.min(grossPrice, reg.voucher_discount_amount ?? 0);
      }
    }

    // Compute ticket referral cut
    let ticketReferralDiscount = 0;
    const hasReferral = Boolean(reg.referral_code?.trim() || (reg.referral_discount_amount ?? 0) > 0);
    if (hasReferral) {
      const remainingPrice = Math.max(0, grossPrice - ticketVoucherDiscount);
      ticketReferralDiscount = Math.min(remainingPrice, reg.referral_discount_amount ?? 0);
    }

    const netPrice = Math.max(0, grossPrice - ticketVoucherDiscount - ticketReferralDiscount);

    // Accumulate overall
    totalGrossRevenue += grossPrice;
    totalNetRevenue += netPrice;
    totalVoucherDiscount += ticketVoucherDiscount;
    totalReferralDiscount += ticketReferralDiscount;
    totalTicketsSold += 1;
    if (ticketVoucherDiscount > 0 || (hasVoucher && reg.voucher_applies_to !== "merchandise")) {
      totalVouchersRedeemed += 1;
    }
    if (ticketReferralDiscount > 0 || hasReferral) {
      totalReferralsRedeemed += 1;
    }

    // Accumulate by ticket type
    if (byType[ticketType]) {
      byType[ticketType].grossRevenue += grossPrice;
      byType[ticketType].netRevenue += netPrice;
      byType[ticketType].voucherDiscount += ticketVoucherDiscount;
      byType[ticketType].referralDiscount += ticketReferralDiscount;
      byType[ticketType].ticketsSold += 1;
      if (ticketVoucherDiscount > 0 || (hasVoucher && reg.voucher_applies_to !== "merchandise")) {
        byType[ticketType].vouchersRedeemed += 1;
      }
      if (ticketReferralDiscount > 0 || hasReferral) {
        byType[ticketType].referralsRedeemed += 1;
      }
    }

    // Accumulate by ticket tier
    const tierKey = matchedTier?.id ?? reg.ticket_id ?? reg.ticket_name ?? "legacy-pass";
    let tierSummary = byTierMap.get(tierKey);
    if (!tierSummary) {
      tierSummary = {
        ticketId: tierKey,
        ticketName: reg.ticket_name || reg.ticket_tier || "General Admission",
        ticketType,
        grossRevenue: 0,
        netRevenue: 0,
        voucherDiscount: 0,
        referralDiscount: 0,
        vouchersRedeemed: 0,
        referralsRedeemed: 0,
        ticketsSold: 0,
      };
      byTierMap.set(tierKey, tierSummary);
    }

    tierSummary.grossRevenue += grossPrice;
    tierSummary.netRevenue += netPrice;
    tierSummary.voucherDiscount += ticketVoucherDiscount;
    tierSummary.referralDiscount += ticketReferralDiscount;
    tierSummary.ticketsSold += 1;
    if (ticketVoucherDiscount > 0 || (hasVoucher && reg.voucher_applies_to !== "merchandise")) {
      tierSummary.vouchersRedeemed += 1;
    }
    if (ticketReferralDiscount > 0 || hasReferral) {
      tierSummary.referralsRedeemed += 1;
    }
  }

  return {
    totalGrossRevenue,
    totalNetRevenue,
    totalVoucherDiscount,
    totalReferralDiscount,
    totalVouchersRedeemed,
    totalReferralsRedeemed,
    totalTicketsSold,
    byType,
    byTier: byTierMap,
  };
}

/**
 * Calculates merchandise revenue, discounts, and orders overall, by category, and per merchandise item.
 */
export function calculateMerchandiseRevenueMetrics(
  registrations: FirestoreRegistration[],
  merchandise: EventMerchandiseItem[],
  merchandiseOrders?: EventMerchandiseOrder[],
): MerchandiseRevenueMetrics {
  const byItemMap = new Map<string, MerchandiseItemRevenueSummary>();

  // Pre-seed defined event merchandise items
  for (const item of merchandise) {
    byItemMap.set(item.id, {
      merchandiseId: item.id,
      name: item.name,
      isFree: Boolean(item.is_free),
      grossRevenue: 0,
      netRevenue: 0,
      voucherDiscount: 0,
      vouchersRedeemed: 0,
      unitsSold: 0,
      ordersCount: 0,
    });
  }

  let totalGrossRevenue = 0;
  let totalNetRevenue = 0;
  let totalVoucherDiscount = 0;
  let totalVouchersRedeemed = 0;
  let totalUnitsSold = 0;
  let totalOrdersCount = 0;

  const byType = {
    paid: { grossRevenue: 0, netRevenue: 0, unitsSold: 0, voucherDiscount: 0 },
    free: { unitsClaimed: 0, ordersCount: 0 },
  };

  for (const reg of registrations) {
    if (!isEligibleRevenueRegistration(reg)) continue;

    const merchOrders = reg.selected_merchandise ?? [];
    if (merchOrders.length === 0) continue;

    totalOrdersCount += 1;

    // Calculate gross merchandise total for this registration
    let regGrossMerch = 0;
    const orderItems: Array<{
      orderId: string;
      orderName: string;
      unitPrice: number;
      quantity: number;
      grossItemTotal: number;
      itemDef?: EventMerchandiseItem;
    }> = [];

    for (const order of merchOrders) {
      const matchedDef =
        merchandise.find((m) => m.id === order.id || m.id === order.merchandise_id) ??
        merchandise.find((m) => m.name.toLowerCase().trim() === order.name.toLowerCase().trim());

      const qty = Math.max(1, order.quantity || 1);
      const isFree = Boolean(matchedDef?.is_free || order.price === 0);
      const unitPrice = isFree ? 0 : (order.price ?? matchedDef?.price ?? 0);
      const grossItemTotal = unitPrice * qty;

      regGrossMerch += grossItemTotal;
      orderItems.push({
        orderId: matchedDef?.id ?? order.id,
        orderName: matchedDef?.name ?? order.name,
        unitPrice,
        quantity: qty,
        grossItemTotal,
        itemDef: matchedDef,
      });
    }

    // Determine voucher discount applicable to merchandise in this registration
    let regMerchVoucherDiscount = 0;
    const hasVoucher = Boolean(reg.voucher_code?.trim() || (reg.voucher_discount_amount ?? 0) > 0);

    if (hasVoucher && regGrossMerch > 0) {
      if (reg.voucher_applies_to === "merchandise") {
        regMerchVoucherDiscount = Math.min(regGrossMerch, reg.voucher_discount_amount ?? 0);
      } else if (reg.voucher_applies_to === "ticket") {
        regMerchVoucherDiscount = 0;
      } else {
        // "all" or undefined: ticket gets first cut, remaining cuts merchandise
        const ticketGross = reg.ticket_price ?? 0;
        const remainingForMerch = Math.max(0, (reg.voucher_discount_amount ?? 0) - ticketGross);
        regMerchVoucherDiscount = Math.min(regGrossMerch, remainingForMerch);
      }
    }

    const regNetMerch = Math.max(0, regGrossMerch - regMerchVoucherDiscount);

    totalGrossRevenue += regGrossMerch;
    totalNetRevenue += regNetMerch;
    totalVoucherDiscount += regMerchVoucherDiscount;
    if (regMerchVoucherDiscount > 0 || (hasVoucher && reg.voucher_applies_to === "merchandise")) {
      totalVouchersRedeemed += 1;
    }

    // Distribute proportionally across individual merchandise items
    for (const order of orderItems) {
      const itemGross = order.grossItemTotal;
      let itemVoucherCut = 0;
      if (regGrossMerch > 0 && regMerchVoucherDiscount > 0) {
        itemVoucherCut = Math.round((itemGross / regGrossMerch) * regMerchVoucherDiscount);
      }
      const itemNet = Math.max(0, itemGross - itemVoucherCut);

      totalUnitsSold += order.quantity;

      const isItemFree = Boolean(order.itemDef?.is_free || order.unitPrice === 0);
      if (isItemFree) {
        byType.free.unitsClaimed += order.quantity;
        byType.free.ordersCount += 1;
      } else {
        byType.paid.grossRevenue += itemGross;
        byType.paid.netRevenue += itemNet;
        byType.paid.voucherDiscount += itemVoucherCut;
        byType.paid.unitsSold += order.quantity;
      }

      // Update per-item map
      let itemSummary = byItemMap.get(order.orderId);
      if (!itemSummary) {
        itemSummary = {
          merchandiseId: order.orderId,
          name: order.orderName,
          isFree: isItemFree,
          grossRevenue: 0,
          netRevenue: 0,
          voucherDiscount: 0,
          vouchersRedeemed: 0,
          unitsSold: 0,
          ordersCount: 0,
        };
        byItemMap.set(order.orderId, itemSummary);
      }

      itemSummary.grossRevenue += itemGross;
      itemSummary.netRevenue += itemNet;
      itemSummary.voucherDiscount += itemVoucherCut;
      itemSummary.unitsSold += order.quantity;
      itemSummary.ordersCount += 1;
      if (itemVoucherCut > 0 || (hasVoucher && reg.voucher_applies_to === "merchandise")) {
        itemSummary.vouchersRedeemed += 1;
      }
    }
  }

  // Account for on-the-spot (OTS) merchandise sales that have been paid
  if (merchandiseOrders && merchandiseOrders.length > 0) {
    for (const mo of merchandiseOrders) {
      if (mo.payment_status !== "paid") continue;

      totalOrdersCount += 1;
      const orderTotal = mo.total_amount ?? 0;
      totalGrossRevenue += orderTotal;
      totalNetRevenue += orderTotal;

      for (const it of mo.items) {
        const qty = it.quantity || 1;
        totalUnitsSold += qty;

        const itPrice = it.price ?? 0;
        const itGross = itPrice * qty;

        byType.paid.grossRevenue += itGross;
        byType.paid.netRevenue += itGross;
        byType.paid.unitsSold += qty;

        let itemSummary = byItemMap.get(it.merchandise_id);
        if (!itemSummary) {
          itemSummary = {
            merchandiseId: it.merchandise_id,
            name: it.name,
            isFree: false,
            grossRevenue: 0,
            netRevenue: 0,
            voucherDiscount: 0,
            vouchersRedeemed: 0,
            unitsSold: 0,
            ordersCount: 0,
          };
          byItemMap.set(it.merchandise_id, itemSummary);
        }

        itemSummary.grossRevenue += itGross;
        itemSummary.netRevenue += itGross;
        itemSummary.unitsSold += qty;
        itemSummary.ordersCount += 1;
      }
    }
  }

  return {
    totalGrossRevenue,
    totalNetRevenue,
    totalVoucherDiscount,
    totalVouchersRedeemed,
    totalUnitsSold,
    totalOrdersCount,
    byItem: byItemMap,
    byType,
  };
}
