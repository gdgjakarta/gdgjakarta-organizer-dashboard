"use server";

import {
  type VoucherCartContext,
  type VoucherValidationResult,
  validateVoucherForCart,
} from "@/lib/events/voucher-utils";
import type { EventVoucher, VoucherStatus } from "@/lib/firestore/types";
import { getFirestoreDoc, getFirestoreEventByIdServer } from "@/server/firestore-admin";

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gdgjakarta-app";
function getFirebaseApiKey(): string {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
  if (!key) {
    throw new Error("Configuration error: Missing NEXT_PUBLIC_FIREBASE_API_KEY environment variable.");
  }
  return key;
}
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

/**
 * Decodes a Firestore REST value.
 */
function decodeValue(val: unknown): unknown {
  if (!val || typeof val !== "object") return val;
  const obj = val as Record<string, unknown>;
  if ("stringValue" in obj) return obj.stringValue;
  if ("integerValue" in obj) return Number(obj.integerValue);
  if ("doubleValue" in obj) return Number(obj.doubleValue);
  if ("booleanValue" in obj) return Boolean(obj.booleanValue);
  if ("nullValue" in obj) return null;
  if ("timestampValue" in obj) return obj.timestampValue;
  if ("mapValue" in obj) {
    const fields = (obj.mapValue as { fields?: Record<string, unknown> }).fields ?? {};
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = decodeValue(v);
    }
    return res;
  }
  if ("arrayValue" in obj) {
    const values = (obj.arrayValue as { values?: unknown[] }).values ?? [];
    return values.map(decodeValue);
  }
  return obj;
}

/**
 * Fetches a single voucher document securely from `event_vouchers/{eventId}_{code}`.
 */
async function getVoucherDocDirect(eventId: string, code: string): Promise<EventVoucher | null> {
  try {
    const docId = `${eventId}_${code.toUpperCase()}`;
    const url = `${FIRESTORE_BASE_URL}/event_vouchers/${encodeURIComponent(docId)}?key=${getFirebaseApiKey()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[Voucher Action] GET event_vouchers/${docId} returned status ${res.status}`);
      return null;
    }

    const json = (await res.json()) as { fields?: Record<string, unknown> };
    if (!json.fields) return null;

    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(json.fields)) {
      data[k] = decodeValue(v);
    }

    return data as unknown as EventVoucher;
  } catch (err) {
    console.warn(`[Voucher Action] Failed to fetch voucher ${code} for event ${eventId}:`, err);
    return null;
  }
}

export interface ValidateVoucherActionParams {
  eventId: string;
  voucherCode: string;
  ticketPrice: number;
  merchandiseTotal: number;
  userEmail?: string;
}

export interface ValidateVoucherActionResult {
  isValid: boolean;
  error?: string;
  voucher?: {
    id: string;
    code: string;
    description?: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    applies_to: "all" | "ticket" | "merchandise";
    min_spend?: number | null;
    max_discount?: number | null;
    status: VoucherStatus;
    start_date?: string | null;
    end_date?: string | null;
    usage_limit?: number | null;
    times_used?: number;
  };
  ticketDiscount?: number;
  merchandiseDiscount?: number;
  totalDiscount?: number;
}

/**
 * Server Action: Validates an entered voucher code against private event vouchers.
 *
 * Security Guarantee:
 * - This function never returns or leaks other vouchers belonging to the event.
 * - Callers can only check a specific code they already possess.
 */
export async function validateVoucherAction(params: ValidateVoucherActionParams): Promise<ValidateVoucherActionResult> {
  const { eventId, voucherCode, ticketPrice, merchandiseTotal, userEmail } = params;

  const cleanCode = (voucherCode || "").trim().toUpperCase();
  if (!cleanCode) {
    return {
      isValid: false,
      error: "Please enter a voucher code.",
    };
  }

  if (!eventId) {
    return {
      isValid: false,
      error: "Event identifier is missing.",
    };
  }

  // 1. First look up the private voucher record in `event_vouchers/{eventId}_{code}`
  let matchedVoucher = await getVoucherDocDirect(eventId, cleanCode);

  // 2. Fallback to legacy event document if not yet migrated to event_vouchers
  if (!matchedVoucher) {
    try {
      const legacyEvent = await getFirestoreEventByIdServer(eventId, { includeVouchers: true });
      if (legacyEvent && Array.isArray(legacyEvent.vouchers)) {
        matchedVoucher = legacyEvent.vouchers.find((v) => v.code.toUpperCase() === cleanCode) ?? null;
      }
    } catch (fallbackErr) {
      console.warn("[Voucher Action] Fallback legacy event check error:", fallbackErr);
    }
  }

  if (!matchedVoucher) {
    return {
      isValid: false,
      error: `Voucher "${cleanCode}" is invalid or does not exist.`,
    };
  }

  // 3. If voucher was issued from a bundle purchase, verify that the purchaser's registration is confirmed/paid
  if (matchedVoucher.source_registration_id) {
    try {
      const parentReg = await getFirestoreDoc("event_registrations", matchedVoucher.source_registration_id);
      if (parentReg) {
        const parentStatus = (parentReg.status as string | undefined)?.toLowerCase();
        const isParentConfirmed =
          parentStatus === "paid_and_registered" || parentStatus === "approved" || parentStatus === "registered";
        if (!isParentConfirmed) {
          return {
            isValid: false,
            error: "This voucher is inactive because the original bundle package payment has not been completed.",
          };
        }
      }
    } catch (parentErr) {
      console.warn("[Voucher Action] Failed to check parent bundle registration status:", parentErr);
    }
  }

  // 4. Validate against cart rules (status, dates, limits, min_spend, applies_to)
  const cartContext: VoucherCartContext = {
    ticketPrice,
    merchandiseTotal,
    userEmail,
  };

  const validation: VoucherValidationResult = validateVoucherForCart(matchedVoucher, cartContext);

  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error ?? "This voucher cannot be applied.",
    };
  }

  // 4. Return sanitized voucher data and discount calculation
  return {
    isValid: true,
    voucher: {
      id: matchedVoucher.id,
      code: matchedVoucher.code,
      description: matchedVoucher.description,
      discount_type: matchedVoucher.discount_type,
      discount_value: matchedVoucher.discount_value,
      applies_to: matchedVoucher.applies_to,
      min_spend: matchedVoucher.min_spend ?? null,
      max_discount: matchedVoucher.max_discount ?? null,
      status: matchedVoucher.status || "active",
      start_date: matchedVoucher.start_date ?? null,
      end_date: matchedVoucher.end_date ?? null,
      usage_limit: matchedVoucher.usage_limit ?? null,
      times_used: matchedVoucher.times_used ?? 0,
    },
    ticketDiscount: validation.ticketDiscount,
    merchandiseDiscount: validation.merchandiseDiscount,
    totalDiscount: validation.totalDiscount,
  };
}
