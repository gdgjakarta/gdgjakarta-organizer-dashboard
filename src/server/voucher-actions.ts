"use server";

import {
  type VoucherCartContext,
  type VoucherValidationResult,
  validateVoucherForCart,
} from "@/lib/events/voucher-utils";
import { normalizeRegistrationDoc } from "@/lib/firestore/normalization";
import type { BundleIssuedVoucher, EventVoucher, VoucherStatus } from "@/lib/firestore/types";
import { verifyFirebaseIdToken } from "@/server/auth-actions";
import { isAuthorizedOrganizerSession } from "@/server/auth-guard";
import {
  getFirestoreDoc,
  getFirestoreEventByIdServer,
  getVouchersByRegistrationIdServer,
  patchFirestoreDoc,
} from "@/server/firestore-admin";

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
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6_000) : undefined,
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
  bundlePrice?: number;
  userEmail?: string;
}

export interface ValidateVoucherActionResult {
  isValid: boolean;
  error?: string;
  bundleTicketId?: string;
  voucher?: {
    id: string;
    code: string;
    description?: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    applies_to: "all" | "ticket" | "bundle" | "merchandise";
    eligible_ticket_ids?: string[] | null;
    eligible_bundle_ids?: string[] | null;
    eligible_merchandise_ids?: string[] | null;
    source_bundle_id?: string;
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
  bundleDiscount?: number;
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
  const { eventId, voucherCode, ticketPrice, merchandiseTotal, bundlePrice: paramBundlePrice, userEmail } = params;

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

  // 1. Look up the private voucher record in `event_vouchers/{eventId}_{code}`
  const matchedVoucher = await getVoucherDocDirect(eventId, cleanCode);

  if (!matchedVoucher) {
    return {
      isValid: false,
      error: `Voucher "${cleanCode}" is invalid or does not exist.`,
    };
  }

  // 3. If voucher was issued from a bundle purchase, verify that the purchaser's registration is confirmed/paid
  let parentBundleId: string | undefined;
  let parentTicketId: string | undefined;
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
        if (typeof parentReg.bundle_id === "string" && parentReg.bundle_id) {
          parentBundleId = parentReg.bundle_id;
        }
        if (typeof parentReg.ticket_id === "string" && parentReg.ticket_id) {
          parentTicketId = parentReg.ticket_id;
        }
      }
    } catch (parentErr) {
      console.warn("[Voucher Action] Failed to check parent bundle registration status:", parentErr);
    }
  }

  // 4. Resolve bundle ticket and its real price (always use the bundle's standalone ticket price, not any selected bundle price)
  let bundleTicketId: string | undefined;
  let effectiveTicketPrice = ticketPrice;
  let effectiveBundlePrice = paramBundlePrice ?? 0;
  const resolvedSourceBundleId = matchedVoucher.source_bundle_id || parentBundleId;

  // If voucher is bundle-only or all, and no bundlePrice was supplied, check event bundles for fallback price
  let eventDocCache: Awaited<ReturnType<typeof getFirestoreEventByIdServer>> | null = null;
  const loadEventDoc = async () => {
    if (!eventDocCache) {
      try {
        eventDocCache = await getFirestoreEventByIdServer(eventId);
      } catch (err) {
        console.warn("[Voucher Action] Failed to load eventDoc:", err);
      }
    }
    return eventDocCache;
  };

  if (resolvedSourceBundleId || parentTicketId || cleanCode.startsWith("BNDL-")) {
    try {
      const eventDoc = await loadEventDoc();
      if (eventDoc) {
        if (resolvedSourceBundleId && Array.isArray(eventDoc.bundles)) {
          const bundle = eventDoc.bundles.find((b) => b.id === resolvedSourceBundleId);
          if (bundle?.ticket_id && bundle.ticket_id !== "none") {
            bundleTicketId = bundle.ticket_id;
          }
        }
        if (!bundleTicketId && parentTicketId) {
          bundleTicketId = parentTicketId;
        }
        if (bundleTicketId && Array.isArray(eventDoc.tickets)) {
          const ticket = eventDoc.tickets.find((t) => t.id === bundleTicketId);
          if (ticket && typeof ticket.price === "number") {
            effectiveTicketPrice = ticket.price;
          }
        }
      }
    } catch (bErr) {
      console.warn("[Voucher Action] Failed to resolve bundle ticket:", bErr);
    }
  }

  // If voucher applies to bundle, but cart has no bundle selected yet (e.g. initial form state),
  // simulate an eligible bundle from event data so user can validate and auto-select the bundle
  if (matchedVoucher.applies_to === "bundle" && effectiveBundlePrice <= 0) {
    try {
      const eventDoc = await loadEventDoc();
      if (eventDoc && Array.isArray(eventDoc.bundles) && eventDoc.bundles.length > 0) {
        const eligibleBundle = eventDoc.bundles.find((b) => {
          if (Array.isArray(matchedVoucher.eligible_bundle_ids) && matchedVoucher.eligible_bundle_ids.length > 0) {
            return matchedVoucher.eligible_bundle_ids.includes(b.id);
          }
          return true;
        });
        if (eligibleBundle && typeof eligibleBundle.price === "number") {
          effectiveBundlePrice = eligibleBundle.price;
        }
      }
    } catch (simErr) {
      console.warn("[Voucher Action] Failed to resolve fallback bundle price:", simErr);
    }
  }

  // 5. Validate against cart rules (status, dates, limits, min_spend, applies_to)
  const cartContext: VoucherCartContext = {
    ticketPrice: effectiveTicketPrice,
    bundlePrice: effectiveBundlePrice,
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

  // 6. Return sanitized voucher data and discount calculation
  return {
    isValid: true,
    bundleTicketId,
    voucher: {
      id: matchedVoucher.id,
      code: matchedVoucher.code,
      description: matchedVoucher.description,
      discount_type: matchedVoucher.discount_type,
      discount_value: matchedVoucher.discount_value,
      applies_to: matchedVoucher.applies_to,
      eligible_ticket_ids: matchedVoucher.eligible_ticket_ids ?? null,
      eligible_bundle_ids: matchedVoucher.eligible_bundle_ids ?? null,
      eligible_merchandise_ids: matchedVoucher.eligible_merchandise_ids ?? null,
      source_bundle_id: resolvedSourceBundleId,
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
    bundleDiscount: validation.bundleDiscount,
    totalDiscount: validation.totalDiscount,
  };
}

export interface GetOrGenerateRegistrationBundleVouchersParams {
  eventId: string;
  registrationId: string;
  idToken?: string;
}

export interface GetOrGenerateRegistrationBundleVouchersResult {
  success: boolean;
  vouchers?: BundleIssuedVoucher[];
  error?: string;
}

/**
 * Authoritatively retrieves or generates friend vouchers for a confirmed bundle registration.
 * Checks existing registration vouchers, recovers vouchers already in event_vouchers,
 * and only generates new vouchers once if none exist yet.
 */
export async function getOrGenerateRegistrationBundleVouchersAction(
  params: GetOrGenerateRegistrationBundleVouchersParams,
): Promise<GetOrGenerateRegistrationBundleVouchersResult> {
  const { eventId, registrationId, idToken } = params;
  if (!eventId || !registrationId) {
    return { success: false, error: "eventId and registrationId are required." };
  }

  // 1. Resolve auth
  let authToken = idToken?.trim();
  if (!authToken) {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      authToken = cookieStore.get("auth_token")?.value?.trim();
    } catch {
      // Ignore in non-request contexts
    }
  }

  if (!authToken) {
    return { success: false, error: "Authentication required to access vouchers." };
  }

  const tokenVerification = await verifyFirebaseIdToken(authToken);
  if (!tokenVerification.valid || !tokenVerification.uid) {
    return { success: false, error: "Invalid or expired session. Please log in again." };
  }

  const callerUid = tokenVerification.uid;
  const callerEmail = tokenVerification.email;
  const isOrganizer = await isAuthorizedOrganizerSession();

  // 2. Fetch registration document
  const rawReg = await getFirestoreDoc("event_registrations", registrationId, authToken);
  if (!rawReg) {
    return { success: false, error: "Registration not found." };
  }
  const reg = normalizeRegistrationDoc(rawReg, registrationId);

  // Check ownership: caller must own registration or be organizer/staff
  if (!isOrganizer) {
    const regMemberId = String(reg.member_id || "");
    const regMemberEmail = String(reg.member_email || "")
      .toLowerCase()
      .trim();
    if (regMemberId !== callerUid && (!callerEmail || regMemberEmail !== callerEmail.toLowerCase().trim())) {
      return { success: false, error: "Unauthorized access to this registration." };
    }
  }

  // Check if registration is confirmed/paid
  const regStatus = (reg.status || "").toLowerCase().trim();
  const isConfirmed =
    regStatus === "paid_and_registered" ||
    regStatus === "approved" ||
    regStatus === "registered" ||
    reg.payment_status === "paid";
  if (!isConfirmed) {
    return { success: false, error: "Registration payment is not yet confirmed." };
  }

  // 3. Fetch Event Document to inspect bundle package
  const eventDoc = await getFirestoreEventByIdServer(eventId);
  if (!eventDoc) {
    return { success: false, error: "Event not found." };
  }

  const matchingBundle = eventDoc.bundles?.find(
    (b) =>
      (reg.bundle_id && b.id === reg.bundle_id) ||
      (reg.bundle_name && b.name.toLowerCase() === reg.bundle_name.toLowerCase()),
  );

  if (!matchingBundle || (matchingBundle.ticket_quantity ?? 1) <= 1 || matchingBundle.generate_vouchers === false) {
    return { success: false, error: "This registration does not include a multi-ticket voucher bundle." };
  }

  const matchingTicketTier = eventDoc.tickets?.find((t) => t.id === matchingBundle.ticket_id);
  const now = new Date().toISOString();

  // 4. If registration doc already has bundle_vouchers array stored, make sure they are in event_vouchers
  if (Array.isArray(reg.bundle_vouchers) && reg.bundle_vouchers.length > 0) {
    for (const bv of reg.bundle_vouchers) {
      if (!bv.code) continue;
      const cleanCode = bv.code.trim().toUpperCase();
      const existingDoc = await getVoucherDocDirect(eventId, cleanCode);
      if (!existingDoc) {
        const voucherDocId = `${eventId}_${cleanCode}`;
        await patchFirestoreDoc(
          "event_vouchers",
          voucherDocId,
          {
            id: bv.voucher_id || `bndl-vch-${Date.now()}-${cleanCode}`,
            event_id: eventId,
            code: cleanCode,
            description: `100% Ticket Pass sponsored by ${reg.member_name || "Friend"} (${matchingBundle.name})`,
            discount_type: "percentage",
            discount_value: 100,
            applies_to: "ticket",
            usage_limit: 1,
            times_used: bv.status === "redeemed" ? 1 : 0,
            min_spend: null,
            max_discount: null,
            start_date: reg.registered_at ?? now,
            end_date: matchingBundle.sales_end_date ?? eventDoc.start_date ?? null,
            status: "active",
            source_bundle_id: matchingBundle.id,
            source_registration_id: registrationId,
            purchaser_member_id: reg.member_id,
            purchaser_name: reg.member_name,
            purchaser_email: reg.member_email,
            created_at: reg.registered_at ?? now,
            updated_at: now,
          },
          true,
          authToken,
        );
      }
    }
    return { success: true, vouchers: reg.bundle_vouchers };
  }

  // 5. If registration doc is missing bundle_vouchers, check if event_vouchers already exist for this registration!
  const existingVouchers = await getVouchersByRegistrationIdServer(registrationId, authToken);
  if (existingVouchers.length > 0) {
    const recoveredVouchers: BundleIssuedVoucher[] = existingVouchers.map((ev) => ({
      code: ev.code.trim().toUpperCase(),
      voucher_id: ev.id,
      ticket_id: matchingBundle.ticket_id || "ticket",
      ticket_name: matchingTicketTier?.name ?? "Event Admission Ticket",
      status: (ev.times_used && ev.times_used > 0) || ev.redeemed_at ? "redeemed" : "available",
      redeemed_by_member_id: ev.redeemed_by_member_id,
      redeemed_by_name: ev.redeemed_by_name,
      redeemed_by_email: ev.redeemed_by_email,
      redeemed_at: ev.redeemed_at,
    }));

    await patchFirestoreDoc(
      "event_registrations",
      registrationId,
      {
        bundle_vouchers: recoveredVouchers,
        updated_at: now,
      },
      true,
      authToken,
    );

    return { success: true, vouchers: recoveredVouchers };
  }

  // 6. Generate fresh friend vouchers authoritatively once on server
  const { generateBundleFriendVouchers } = await import("@/lib/events/bundle-voucher-generator");
  const generated = generateBundleFriendVouchers({
    bundle: matchingBundle,
    buyerRegistrationId: registrationId,
    buyerMemberId: reg.member_id,
    buyerName: reg.member_name || "Bundle Purchaser",
    buyerEmail: reg.member_email || "",
    ticketTier: matchingTicketTier,
    eventStartDate: eventDoc.start_date,
  });

  if (generated.registrationVouchers.length === 0) {
    return { success: false, error: "Failed to generate bundle friend vouchers." };
  }

  // Save new friend vouchers into event_vouchers
  for (const fv of generated.newEventVouchers) {
    const cleanCode = fv.code.trim().toUpperCase();
    const voucherDocId = `${eventId}_${cleanCode}`;
    await patchFirestoreDoc("event_vouchers", voucherDocId, fv as unknown as Record<string, unknown>, true, authToken);
  }

  // Save generated bundle vouchers onto the registration doc
  await patchFirestoreDoc(
    "event_registrations",
    registrationId,
    {
      bundle_vouchers: generated.registrationVouchers,
      updated_at: now,
    },
    true,
    authToken,
  );

  return { success: true, vouchers: generated.registrationVouchers };
}
