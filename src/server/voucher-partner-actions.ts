"use server";

import { normalizeRegistrationDoc } from "@/lib/firestore/normalization";
import type { EventVoucher, MaskedVoucherRedemption, PublicPartnerVoucherReport } from "@/lib/firestore/types";
import { maskEmail, maskName, maskPhone, maskVoucherCode } from "@/lib/security/pii-mask";
import { getFirestoreEventByIdServer } from "@/server/firestore-admin";

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gdgjakarta-app";
function getFirebaseApiKey(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCVk8ECyA8Lqd7KNqdnItxYUu9jdFzoohU";
}
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

/**
 * Decodes a Firestore REST Value object into standard JavaScript primitives / objects.
 */
function decodeFirestoreValue(val: unknown): unknown {
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
      res[k] = decodeFirestoreValue(v);
    }
    return res;
  }
  if ("arrayValue" in obj) {
    const values = (obj.arrayValue as { values?: unknown[] }).values ?? [];
    return values.map(decodeFirestoreValue);
  }
  return obj;
}

/**
 * Decodes a full Firestore document object from REST.
 */
function decodeFirestoreDoc(
  doc: { fields?: Record<string, unknown>; name?: string } | null | undefined,
): Record<string, unknown> | null {
  if (!doc?.fields) return null;
  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    res[k] = decodeFirestoreValue(v);
  }
  return res;
}

/**
 * Finds an event voucher by its opaque partner share token.
 * 1. Checks `partner_shares/{shareToken}` mapping document (which allows public direct get).
 * 2. If mapping found, directly gets `event_vouchers/{voucherDocId}` (which allows public direct get).
 * 3. Falls back to runQuery if needed.
 */
async function findVoucherByShareToken(shareToken: string): Promise<EventVoucher | null> {
  const cleanToken = shareToken.trim();
  if (!cleanToken) return null;

  try {
    // 1. Direct document GET on partner_shares/{cleanToken}
    const shareUrl = `${FIRESTORE_BASE_URL}/partner_shares/${encodeURIComponent(cleanToken)}?key=${getFirebaseApiKey()}`;
    const shareRes = await fetch(shareUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6_000) : undefined,
    });

    if (shareRes.ok) {
      const shareDocRaw = (await shareRes.json()) as { fields?: Record<string, unknown> };
      const shareData = decodeFirestoreDoc(shareDocRaw);
      const voucherDocId = shareData?.voucher_doc_id as string | undefined;

      if (voucherDocId) {
        // Direct document GET on event_vouchers/{voucherDocId}
        const vUrl = `${FIRESTORE_BASE_URL}/event_vouchers/${encodeURIComponent(voucherDocId)}?key=${getFirebaseApiKey()}`;
        const vRes = await fetch(vUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6_000) : undefined,
        });

        if (vRes.ok) {
          const vDocRaw = (await vRes.json()) as { fields?: Record<string, unknown> };
          const vData = decodeFirestoreDoc(vDocRaw);
          if (vData?.code) {
            return vData as unknown as EventVoucher;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Voucher Partner] Direct partner_shares lookup error:", err);
  }

  // 2. Fallback to runQuery
  try {
    const url = `${FIRESTORE_BASE_URL}:runQuery?key=${getFirebaseApiKey()}`;
    const body = {
      structuredQuery: {
        from: [{ collectionId: "event_vouchers" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "partner_share_token" },
            op: "EQUAL",
            value: { stringValue: cleanToken },
          },
        },
        limit: 1,
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6_000) : undefined,
    });

    if (!res.ok) return null;
    const items = (await res.json()) as Array<{ document?: { name?: string; fields?: Record<string, unknown> } }>;
    if (!Array.isArray(items) || items.length === 0 || !items[0]?.document) return null;

    const decoded = decodeFirestoreDoc(items[0].document);
    if (!decoded?.code) return null;

    return decoded as unknown as EventVoucher;
  } catch (err) {
    console.error("[Voucher Partner] findVoucherByShareToken error:", err);
    return null;
  }
}

/**
 * Loads all event registrations for an event matching a specific voucher code or voucher ID.
 */
async function getVoucherRegistrationsServer(
  eventId: string,
  voucherCode: string,
  voucherId?: string,
): Promise<Array<ReturnType<typeof normalizeRegistrationDoc>>> {
  const normCode = voucherCode.trim().toUpperCase();
  const matchedList: Array<ReturnType<typeof normalizeRegistrationDoc>> = [];

  try {
    const url = `${FIRESTORE_BASE_URL}:runQuery?key=${getFirebaseApiKey()}`;
    // Query registrations by event_id
    const body = {
      structuredQuery: {
        from: [{ collectionId: "event_registrations" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "event_id" },
            op: "EQUAL",
            value: { stringValue: String(eventId) },
          },
        },
        limit: 1000,
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(10_000) : undefined,
    });

    if (res.ok) {
      const items = (await res.json()) as Array<{ document?: { name?: string; fields?: Record<string, unknown> } }>;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item.document) continue;
          const docId = item.document.name?.split("/").pop() ?? "";
          const decoded = decodeFirestoreDoc(item.document);
          if (!decoded) continue;

          const reg = normalizeRegistrationDoc(decoded, docId);
          const regVCode = reg.voucher_code ? reg.voucher_code.trim().toUpperCase() : "";
          const isCodeMatch = regVCode.length > 0 && regVCode === normCode;
          const isIdMatch = Boolean(voucherId && reg.voucher_id && reg.voucher_id === voucherId);

          if (isCodeMatch || isIdMatch) {
            matchedList.push(reg);
          }
        }
      }
    }
  } catch (err) {
    console.error(`[Voucher Partner] getVoucherRegistrationsServer error for ${eventId}:`, err);
  }

  return matchedList;
}

export type GetPartnerReportResult =
  | { success: true; report: PublicPartnerVoucherReport }
  | { success: false; error: string; requiresCode?: boolean };

/**
 * Validates the partner access code and generates a safe, zero-leak partner report.
 * All PII (emails, names, phones) is strictly masked server-side before returning.
 */
export async function getPartnerVoucherReportAction(
  shareToken: string,
  accessCode?: string,
): Promise<GetPartnerReportResult> {
  const cleanToken = (shareToken || "").trim();
  if (!cleanToken) {
    return { success: false, error: "Invalid or missing share link." };
  }

  // 1. Direct GET lookup from pre-computed partner_voucher_reports collection
  try {
    const reportUrl = `${FIRESTORE_BASE_URL}/partner_voucher_reports/${encodeURIComponent(cleanToken)}?key=${getFirebaseApiKey()}`;
    const reportRes = await fetch(reportUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6_000) : undefined,
    });

    if (reportRes.ok) {
      const rawDoc = (await reportRes.json()) as { fields?: Record<string, unknown> };
      const docData = decodeFirestoreDoc(rawDoc);
      if (docData) {
        const storedAccessCode = String(docData.partner_access_code || "").trim();
        const providedCode = (accessCode || "").trim();

        if (storedAccessCode) {
          if (!providedCode) {
            return {
              success: false,
              error: "Access code is required to view this partner report.",
              requiresCode: true,
            };
          }
          if (providedCode.toUpperCase() !== storedAccessCode.toUpperCase()) {
            return {
              success: false,
              error: "Incorrect access code. Please check with the organizer.",
              requiresCode: true,
            };
          }
        }

        // Return verified report
        const report: PublicPartnerVoucherReport = {
          partner_name: (docData.partner_name as string) || undefined,
          event_id: String(docData.event_id || ""),
          event_title: String(docData.event_title || "GDG Jakarta Event"),
          event_start_date: (docData.event_start_date as string) ?? null,
          event_end_date: (docData.event_end_date as string) ?? null,
          event_banner_url: (docData.event_banner_url as string) || undefined,
          voucher_display_code: String(docData.voucher_display_code || "PROMO"),
          is_code_masked: Boolean(docData.is_code_masked),
          discount_display: String(docData.discount_display || ""),
          discount_type: (docData.discount_type as "percentage" | "fixed") || "fixed",
          discount_value: Number(docData.discount_value) || 0,
          applies_to: (docData.applies_to as "all" | "ticket" | "bundle" | "merchandise") || "all",
          status: (docData.status as "active" | "inactive" | "expired") || "active",
          usage_limit: docData.usage_limit != null ? Number(docData.usage_limit) : null,
          times_used: Number(docData.times_used) || 0,
          percent_used: Number(docData.percent_used) || 0,
          total_discount_given: Number(docData.total_discount_given) || 0,
          redemptions: Array.isArray(docData.redemptions) ? (docData.redemptions as MaskedVoucherRedemption[]) : [],
        };

        return { success: true, report };
      }
    }
  } catch (err) {
    console.warn("[Voucher Partner] Direct partner_voucher_reports lookup error:", err);
  }

  // 2. Fallback to voucher document lookup
  const voucher = await findVoucherByShareToken(cleanToken);
  if (!voucher) {
    return { success: false, error: "Voucher report not found or link has expired." };
  }

  if (!voucher.partner_share_enabled) {
    return { success: false, error: "Partner sharing has been disabled by the event organizer." };
  }

  const storedAccessCode = (voucher.partner_access_code || "").trim();
  const providedCode = (accessCode || "").trim();

  // If access code is configured on the voucher, enforce matching
  if (storedAccessCode) {
    if (!providedCode) {
      return {
        success: false,
        error: "Access code is required to view this partner report.",
        requiresCode: true,
      };
    }

    if (providedCode.toUpperCase() !== storedAccessCode.toUpperCase()) {
      return {
        success: false,
        error: "Incorrect access code. Please check with the organizer.",
        requiresCode: true,
      };
    }
  }

  // Load event info for display
  const eventId = voucher.event_id || "";
  const event = eventId ? await getFirestoreEventByIdServer(eventId) : null;
  const eventTitle = event?.title || "GDG Jakarta Event";

  // Fetch registrations that redeemed this voucher
  const registrations = eventId ? await getVoucherRegistrationsServer(eventId, voucher.code, voucher.id) : [];

  // If no registrations matched via event_registrations query, check if single voucher has direct redemption metadata
  let finalRedemptions: MaskedVoucherRedemption[] = [];

  if (registrations.length > 0) {
    finalRedemptions = registrations.map((reg, index) => {
      // Determine discount amount
      let discountAmount: number | undefined;
      if (typeof reg.voucher_discount_amount === "number") {
        discountAmount = reg.voucher_discount_amount;
      } else if (voucher.discount_type === "fixed") {
        discountAmount = voucher.discount_value;
      }

      return {
        id: `red-${index + 1}`, // Obfuscated sequence ID
        registered_at: reg.registered_at || new Date().toISOString(),
        masked_name: maskName(reg.member_name),
        masked_email: maskEmail(reg.member_email),
        masked_phone: reg.member_phone ? maskPhone(reg.member_phone) : undefined,
        ticket_name: reg.ticket_name || reg.ticket_tier || "Registration Pass",
        ticket_type: reg.ticket_type,
        status: reg.status,
        discount_amount: discountAmount,
      };
    });
  } else if (voucher.redeemed_by_name || voucher.redeemed_by_email) {
    finalRedemptions = [
      {
        id: "red-1",
        registered_at: voucher.redeemed_at || voucher.updated_at || new Date().toISOString(),
        masked_name: maskName(voucher.redeemed_by_name),
        masked_email: maskEmail(voucher.redeemed_by_email),
        ticket_name: "Registration Pass",
        status: "approved",
        discount_amount: voucher.discount_type === "fixed" ? voucher.discount_value : undefined,
      },
    ];
  }

  // Calculate aggregate metrics
  const totalRedeemed = Math.max(voucher.times_used || 0, finalRedemptions.length);
  const usageLimit = voucher.usage_limit ?? null;
  const percentUsed =
    usageLimit && usageLimit > 0 ? Math.min(100, Math.round((totalRedeemed / usageLimit) * 100)) : 100;

  const totalDiscountGiven = finalRedemptions.reduce((sum, item) => sum + (item.discount_amount || 0), 0);

  // Voucher promo code display: Respect partner_show_voucher_code
  const isCodeMasked = voucher.partner_show_voucher_code !== true;
  const voucherDisplayCode = isCodeMasked ? maskVoucherCode(voucher.code) : voucher.code;

  // Format discount display
  const discountDisplay =
    voucher.discount_type === "percentage"
      ? `${voucher.discount_value}% OFF`
      : `Rp ${voucher.discount_value.toLocaleString("id-ID")} OFF`;

  const report: PublicPartnerVoucherReport = {
    partner_name: voucher.partner_name || undefined,
    event_id: eventId,
    event_title: eventTitle,
    event_start_date: event?.start_date ?? null,
    event_end_date: event?.end_date ?? null,
    event_banner_url: event?.picture_url || event?.banner_url || event?.banner?.url || event?.picture?.url,
    voucher_display_code: voucherDisplayCode,
    is_code_masked: isCodeMasked,
    discount_display: discountDisplay,
    discount_type: voucher.discount_type,
    discount_value: voucher.discount_value,
    applies_to: voucher.applies_to,
    status: voucher.status,
    usage_limit: usageLimit,
    times_used: totalRedeemed,
    percent_used: percentUsed,
    total_discount_given: totalDiscountGiven,
    redemptions: finalRedemptions,
  };

  return {
    success: true,
    report,
  };
}
