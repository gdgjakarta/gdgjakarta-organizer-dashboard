import type { EventVoucher, VoucherAppliesTo, VoucherDiscountType } from "@/lib/firestore/types";

import { generateRandomVoucherCode } from "./voucher-utils";

export interface VoucherTemplate {
  id: string;
  name: string;
  description: string;
  codePrefix: string;
  discount_type: VoucherDiscountType;
  discount_value: number;
  applies_to: VoucherAppliesTo;
  min_spend?: number | null;
  max_discount?: number | null;
  usage_limit?: number | null;
}

export const PRESET_VOUCHER_TEMPLATES: VoucherTemplate[] = [
  {
    id: "tpl-scholarship-100",
    name: "100% Free Scholarship Pass",
    description: "Complimentary ticket admission for scholarship recipients, speakers, and VIPs.",
    codePrefix: "SCHOLAR",
    discount_type: "percentage",
    discount_value: 100,
    applies_to: "ticket",
    min_spend: null,
    max_discount: null,
    usage_limit: 50,
  },
  {
    id: "tpl-early-bird-25",
    name: "Early Bird 25% Off Ticket",
    description: "Special early registration 25% discount for the community.",
    codePrefix: "EARLYBIRD",
    discount_type: "percentage",
    discount_value: 25,
    applies_to: "ticket",
    min_spend: null,
    max_discount: 100000,
    usage_limit: 100,
  },
  {
    id: "tpl-student-50",
    name: "Student 50% Off Ticket",
    description: "Subsidized 50% student discount pass for university students.",
    codePrefix: "STUDENT",
    discount_type: "percentage",
    discount_value: 50,
    applies_to: "ticket",
    min_spend: null,
    max_discount: 150000,
    usage_limit: 75,
  },
  {
    id: "tpl-merch-free-100",
    name: "Complimentary Merchandise (100% Off)",
    description: "Full voucher cover for event merchandise apparel and perks.",
    codePrefix: "MERCHVIP",
    discount_type: "percentage",
    discount_value: 100,
    applies_to: "merchandise",
    min_spend: null,
    max_discount: null,
    usage_limit: 30,
  },
  {
    id: "tpl-merch-fixed-25k",
    name: "Rp 25.000 Merchandise Credit",
    description: "Flat Rp 25,000 discount voucher on all official event merchandise.",
    codePrefix: "MERCH25",
    discount_type: "fixed",
    discount_value: 25000,
    applies_to: "merchandise",
    min_spend: 50000,
    max_discount: null,
    usage_limit: 150,
  },
  {
    id: "tpl-flat-50k-all",
    name: "Rp 50.000 Community Voucher (All)",
    description: "Flat Rp 50,000 discount applicable to both tickets and merchandise.",
    codePrefix: "GDG50K",
    discount_type: "fixed",
    discount_value: 50000,
    applies_to: "all",
    min_spend: 100000,
    max_discount: null,
    usage_limit: 200,
  },
];

/**
 * Creates a new EventVoucher instance populated from a template.
 */
export function createVoucherFromTemplate(template: VoucherTemplate): EventVoucher {
  const code = generateRandomVoucherCode(template.codePrefix);
  const now = new Date().toISOString();

  return {
    id: `voucher-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code,
    description: template.description,
    discount_type: template.discount_type,
    discount_value: template.discount_value,
    applies_to: template.applies_to,
    min_spend: template.min_spend ?? null,
    max_discount: template.max_discount ?? null,
    usage_limit: template.usage_limit ?? null,
    times_used: 0,
    start_date: null,
    end_date: null,
    status: "active",
    created_at: now,
    updated_at: now,
  };
}
