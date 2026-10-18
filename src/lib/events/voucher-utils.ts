import type { EventVoucher } from "@/lib/firestore/types";

export interface VoucherCartContext {
  ticketPrice: number;
  merchandiseTotal: number;
  userEmail?: string;
}

export interface VoucherValidationResult {
  isValid: boolean;
  error?: string;
  ticketDiscount: number;
  merchandiseDiscount: number;
  totalDiscount: number;
}

export interface VoucherDiscountCalculation {
  ticketDiscount: number;
  merchandiseDiscount: number;
  totalDiscount: number;
}

function resolveApplicableSpend(voucher: EventVoucher, ticketPrice: number, merchandiseTotal: number): number {
  if (voucher.applies_to === "ticket") {
    return ticketPrice;
  }
  if (voucher.applies_to === "merchandise") {
    return merchandiseTotal;
  }
  return ticketPrice + merchandiseTotal;
}

/**
 * Calculates discount amounts for a given voucher and cart state.
 */
export function calculateVoucherDiscount(
  voucher: EventVoucher,
  context: { ticketPrice: number; merchandiseTotal: number },
): VoucherDiscountCalculation {
  const ticketPrice = Math.max(0, context.ticketPrice || 0);
  const merchandiseTotal = Math.max(0, context.merchandiseTotal || 0);
  const subtotal = ticketPrice + merchandiseTotal;

  if (subtotal <= 0) {
    return { ticketDiscount: 0, merchandiseDiscount: 0, totalDiscount: 0 };
  }

  if (voucher.applies_to === "ticket") {
    if (ticketPrice <= 0) {
      return { ticketDiscount: 0, merchandiseDiscount: 0, totalDiscount: 0 };
    }
    let rawDiscount =
      voucher.discount_type === "percentage"
        ? Math.round(ticketPrice * (voucher.discount_value / 100))
        : voucher.discount_value;

    if (voucher.discount_type === "percentage" && voucher.max_discount && voucher.max_discount > 0) {
      rawDiscount = Math.min(rawDiscount, voucher.max_discount);
    }

    const ticketDiscount = Math.min(ticketPrice, Math.max(0, rawDiscount));
    return {
      ticketDiscount,
      merchandiseDiscount: 0,
      totalDiscount: ticketDiscount,
    };
  }

  if (voucher.applies_to === "merchandise") {
    if (merchandiseTotal <= 0) {
      return { ticketDiscount: 0, merchandiseDiscount: 0, totalDiscount: 0 };
    }
    let rawDiscount =
      voucher.discount_type === "percentage"
        ? Math.round(merchandiseTotal * (voucher.discount_value / 100))
        : voucher.discount_value;

    if (voucher.discount_type === "percentage" && voucher.max_discount && voucher.max_discount > 0) {
      rawDiscount = Math.min(rawDiscount, voucher.max_discount);
    }

    const merchandiseDiscount = Math.min(merchandiseTotal, Math.max(0, rawDiscount));
    return {
      ticketDiscount: 0,
      merchandiseDiscount,
      totalDiscount: merchandiseDiscount,
    };
  }

  // applies_to === "all"
  let rawDiscount =
    voucher.discount_type === "percentage"
      ? Math.round(subtotal * (voucher.discount_value / 100))
      : voucher.discount_value;

  if (voucher.discount_type === "percentage" && voucher.max_discount && voucher.max_discount > 0) {
    rawDiscount = Math.min(rawDiscount, voucher.max_discount);
  }

  const totalCap = Math.min(subtotal, Math.max(0, rawDiscount));
  const ticketDiscount = Math.min(ticketPrice, totalCap);
  const remainingDiscount = totalCap - ticketDiscount;
  const merchandiseDiscount = Math.min(merchandiseTotal, remainingDiscount);

  return {
    ticketDiscount,
    merchandiseDiscount,
    totalDiscount: ticketDiscount + merchandiseDiscount,
  };
}

/**
 * Validates whether a voucher is eligible to be applied to the current cart.
 */
export function validateVoucherForCart(voucher: EventVoucher, context: VoucherCartContext): VoucherValidationResult {
  const zeroResult: VoucherValidationResult = {
    isValid: false,
    ticketDiscount: 0,
    merchandiseDiscount: 0,
    totalDiscount: 0,
  };

  const status = (voucher as Partial<EventVoucher>).status ?? "active";
  if (status !== "active") {
    return {
      ...zeroResult,
      error: status === "expired" ? "This voucher has expired." : "This voucher is inactive.",
    };
  }

  const now = Date.now();
  if (voucher.start_date) {
    const startTime = new Date(voucher.start_date).getTime();
    if (now < startTime) {
      return {
        ...zeroResult,
        error: "This voucher is not active yet.",
      };
    }
  }

  if (voucher.end_date) {
    const endTime = new Date(voucher.end_date).getTime();
    if (now > endTime) {
      return {
        ...zeroResult,
        error: "This voucher has expired.",
      };
    }
  }

  if (voucher.usage_limit !== null && voucher.usage_limit !== undefined) {
    const used = voucher.times_used ?? 0;
    if (used >= voucher.usage_limit) {
      return {
        ...zeroResult,
        error: "This voucher has reached its maximum redemption limit.",
      };
    }
  }

  const ticketPrice = Math.max(0, context.ticketPrice || 0);
  const merchandiseTotal = Math.max(0, context.merchandiseTotal || 0);

  if (voucher.applies_to === "ticket" && ticketPrice <= 0) {
    return {
      ...zeroResult,
      error: "This voucher only applies to paid event tickets.",
    };
  }

  if (voucher.applies_to === "merchandise" && merchandiseTotal <= 0) {
    return {
      ...zeroResult,
      error: "This voucher only applies to merchandise purchases.",
    };
  }

  const applicableSpend = resolveApplicableSpend(voucher, ticketPrice, merchandiseTotal);

  if (applicableSpend <= 0) {
    return {
      ...zeroResult,
      error: "Your cart does not have any eligible paid items for this voucher.",
    };
  }

  if (voucher.min_spend && voucher.min_spend > 0 && applicableSpend < voucher.min_spend) {
    return {
      ...zeroResult,
      error: `Minimum spend of Rp ${voucher.min_spend.toLocaleString("id-ID")} required for this voucher.`,
    };
  }

  const calculation = calculateVoucherDiscount(voucher, context);
  if (calculation.totalDiscount <= 0) {
    return {
      ...zeroResult,
      error: "No discount could be applied to your current selection.",
    };
  }

  return {
    isValid: true,
    ...calculation,
  };
}

/**
 * Formats a clean badge label for the discount amount (e.g. "20% OFF" or "Rp 50.000 OFF").
 */
export function formatVoucherDiscountDisplay(voucher: EventVoucher): string {
  if (voucher.discount_type === "percentage") {
    return `${voucher.discount_value}% OFF`;
  }
  return `Rp ${(voucher.discount_value || 0).toLocaleString("id-ID")} OFF`;
}

/**
 * Generates a clean, randomized uppercase promo voucher code.
 */
export function generateRandomVoucherCode(prefix = "GDG"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 5; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${randomPart}`;
}
