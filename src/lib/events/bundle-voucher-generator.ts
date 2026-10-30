import type { BundleIssuedVoucher, EventBundlePackage, EventTicketTier, EventVoucher } from "@/lib/firestore/types";

/**
 * Generates single-use friend vouchers for extra tickets included in a bundle package.
 * For example: A 5-ticket bundle generates 4 friend vouchers (as the buyer uses 1 for their own registration).
 */
export function generateBundleFriendVouchers(params: {
  bundle: EventBundlePackage;
  buyerRegistrationId: string;
  buyerMemberId: string;
  buyerName: string;
  buyerEmail: string;
  ticketTier?: EventTicketTier | null;
  eventStartDate?: string | null;
}): {
  newEventVouchers: EventVoucher[];
  registrationVouchers: BundleIssuedVoucher[];
} {
  const { bundle, buyerRegistrationId, buyerMemberId, buyerName, buyerEmail, ticketTier, eventStartDate } = params;

  if (!bundle.ticket_id || bundle.ticket_id === "none") {
    return { newEventVouchers: [], registrationVouchers: [] };
  }

  const totalTickets = Math.max(1, bundle.ticket_quantity ?? 1);
  // Extra tickets given to friends
  const vouchersToGenerate = Math.max(0, totalTickets - 1);

  if (vouchersToGenerate === 0) {
    return { newEventVouchers: [], registrationVouchers: [] };
  }

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const generateRandomSuffix = () => {
    let res = "";
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const now = new Date().toISOString();
  // Safe expiry date: bundle sales end date, event start date, or 30 days ahead
  const defaultEndDate = bundle.sales_end_date ?? eventStartDate ?? null;

  const newEventVouchers: EventVoucher[] = [];
  const registrationVouchers: BundleIssuedVoucher[] = [];

  const randomPrefix = generateRandomSuffix();

  for (let i = 1; i <= vouchersToGenerate; i++) {
    const voucherId = `bndl-vch-${Date.now()}-${randomPrefix}-${i}`;
    const voucherCode = `BNDL-${randomPrefix}-${i}`;

    const eventVoucher: EventVoucher = {
      id: voucherId,
      code: voucherCode,
      description: `100% Ticket Pass sponsored by ${buyerName} (${bundle.name})`,
      discount_type: "percentage",
      discount_value: 100, // 100% Free
      applies_to: "ticket",
      eligible_ticket_ids: bundle.ticket_id ? [bundle.ticket_id] : null,
      eligible_bundle_ids: null,
      eligible_merchandise_ids: null,
      usage_limit: 1, // Single-use redemption
      times_used: 0,
      min_spend: null,
      max_discount: null,
      start_date: now,
      end_date: defaultEndDate,
      status: "active",
      source_bundle_id: bundle.id,
      source_registration_id: buyerRegistrationId,
      purchaser_member_id: buyerMemberId,
      purchaser_name: buyerName,
      purchaser_email: buyerEmail,
      created_at: now,
      updated_at: now,
    };

    const regVoucher: BundleIssuedVoucher = {
      code: voucherCode,
      voucher_id: voucherId,
      ticket_id: bundle.ticket_id,
      ticket_name: ticketTier?.name ?? "Event Admission Ticket",
      status: "available",
    };

    newEventVouchers.push(eventVoucher);
    registrationVouchers.push(regVoucher);
  }

  return {
    newEventVouchers,
    registrationVouchers,
  };
}
