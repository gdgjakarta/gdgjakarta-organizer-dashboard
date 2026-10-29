import { cache } from "react";

import { DEFAULT_MAINTENANCE_CONFIG, type MaintenanceConfig } from "@/config/maintenance-config";
import { buildApprovedAttendeePayload } from "@/lib/events/approved-attendee-webhook";
import { generateBundleFriendVouchers } from "@/lib/events/bundle-voucher-generator";
import { normalizeEventDoc, normalizeMerchandiseOrder, normalizeRegistrationDoc } from "@/lib/firestore/normalization";
import type {
  BundleIssuedVoucher,
  EventMerchandiseOrder,
  EventVoucher,
  FirestoreEvent,
  FirestoreRegistration,
  MerchandiseOrderStatusLog,
  RefundRequest,
  RefundStatus,
  RegistrationStatus,
  RegistrationStatusLog,
} from "@/lib/firestore/types";

/**
 * Cloud Firestore REST API configuration.
 * Using native fetch and Firestore REST eliminates Node gRPC and @grpc/proto-loader dependencies,
 * avoiding the protobufjs eval/codegen EvalError in Cloudflare Workers V8 isolates.
 */
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gdgjakarta-app";
function getFirebaseApiKey(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCVk8ECyA8Lqd7KNqdnItxYUu9jdFzoohU";
}
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

/**
 * Pure utility function to strip undefined values before serializing payload.
 */
function sanitizePayload<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.filter((item) => item !== undefined).map((item) => sanitizePayload(item)) as unknown as T;
  }
  if (typeof data === "object" && !(data instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value !== undefined) {
        result[key] = sanitizePayload(value);
      }
    }
    return result as T;
  }
  return data;
}

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
  if ("bytesValue" in obj) return obj.bytesValue;
  if ("referenceValue" in obj) return obj.referenceValue;
  if ("geoPointValue" in obj) return obj.geoPointValue;
  return obj;
}

/**
 * Decodes a Firestore document object from the REST API into a plain JavaScript dictionary.
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
 * Encodes a JavaScript value into a Firestore REST Value representation.
 */
function encodeFirestoreValue(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeFirestoreValue) } };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (typeof val === "object") {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = encodeFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Encodes an object of field-value pairs into a Firestore REST fields map.
 */
function encodeFirestoreFields(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = encodeFirestoreValue(v);
    }
  }
  return fields;
}

/**
 * Resolves Firebase Auth ID token from an explicit parameter or the HTTP-only session cookie.
 */
async function resolveAuthToken(explicitToken?: string): Promise<string | undefined> {
  if (explicitToken?.trim()) {
    return explicitToken.trim();
  }
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get("auth_token")?.value;
    if (cookieToken?.trim()) {
      return cookieToken.trim();
    }
  } catch {
    // cookies() unavailable in non-request contexts
  }
  return undefined;
}

/**
 * Fetches a single document via Firestore REST API.
 */
export async function getFirestoreDoc(
  collectionName: string,
  docId: string,
  token?: string,
): Promise<Record<string, unknown> | null> {
  try {
    const url = `${FIRESTORE_BASE_URL}/${collectionName}/${encodeURIComponent(docId)}?key=${getFirebaseApiKey()}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    const authToken = await resolveAuthToken(token);
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6_000) : undefined,
    });
    if (res.status === 404) return null;
    if (res.status === 401 && authToken) {
      // The passed/cookie auth token may be expired or invalid. Retry without Authorization header for public collections.
      const retryRes = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6_000) : undefined,
      });
      if (retryRes.ok) {
        const data = (await retryRes.json()) as { fields?: Record<string, unknown> };
        return decodeFirestoreDoc(data);
      }
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[Firestore REST] GET ${collectionName}/${docId} returned ${res.status}: ${errText}`);
      return null;
    }
    const data = (await res.json()) as { fields?: Record<string, unknown> };
    return decodeFirestoreDoc(data);
  } catch (err) {
    console.warn(`[Firestore REST] Failed fetching ${collectionName}/${docId}:`, err);
    return null;
  }
}

/**
 * Patches a document via Firestore REST API with merge support.
 */
export async function patchFirestoreDoc(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>,
  merge = true,
  token?: string,
): Promise<boolean> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.set("key", getFirebaseApiKey());
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    if (merge) {
      for (const k of keys) {
        searchParams.append("updateMask.fieldPaths", k);
      }
    }
    const url = `${FIRESTORE_BASE_URL}/${collectionName}/${encodeURIComponent(docId)}?${searchParams.toString()}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const authToken = await resolveAuthToken(token);
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ fields: encodeFirestoreFields(data) }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[Firestore REST] PATCH ${collectionName}/${docId} returned ${res.status}: ${errText}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[Firestore REST] Failed updating ${collectionName}/${docId}:`, err);
    return false;
  }
}

/**
 * Deletes a document via Firestore REST API.
 */
export async function deleteFirestoreDoc(collectionName: string, docId: string, token?: string): Promise<boolean> {
  try {
    const url = `${FIRESTORE_BASE_URL}/${collectionName}/${encodeURIComponent(docId)}?key=${getFirebaseApiKey()}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    const authToken = await resolveAuthToken(token);
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const res = await fetch(url, {
      method: "DELETE",
      headers,
    });
    if (res.status === 404) return true; // Already deleted
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[Firestore REST] DELETE ${collectionName}/${docId} returned ${res.status}: ${errText}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[Firestore REST] Failed deleting ${collectionName}/${docId}:`, err);
    return false;
  }
}

/**
 * Queries a collection using Firestore REST runQuery.
 */
async function queryRegistrationDoc(
  fieldPath: string,
  value: string,
  token?: string,
): Promise<{ id: string; data: FirestoreRegistration } | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${getFirebaseApiKey()}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const authToken = await resolveAuthToken(token);
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const body = {
      structuredQuery: {
        from: [{ collectionId: "event_registrations" }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: "EQUAL",
            value: { stringValue: value },
          },
        },
        limit: 1,
      },
    };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const items = (await res.json()) as Array<{ document?: { name?: string; fields?: Record<string, unknown> } }>;
    if (!Array.isArray(items) || items.length === 0 || !items[0]?.document) return null;
    const doc = items[0].document;
    const id = doc.name?.split("/").pop() ?? "";
    const decoded = decodeFirestoreDoc(doc);
    return decoded ? { id, data: normalizeRegistrationDoc(decoded, id) } : null;
  } catch {
    return null;
  }
}

export interface AttendeeLookupResult {
  success: boolean;
  error?: string;
  invoiceNumber?: string;
  registrationId?: string;
  email?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  status?: RegistrationStatus;
  targetStatus?: "approved" | "registered" | "waiting_for_payment";
  curationMode?: boolean;
  bevyEventId?: string;
  bevyChapterId?: string;
  sessionName?: string;
  sessionCapacity?: number;
  subjectEmail?: string;
  bodyEmail?: string;
  eventName?: string;
  eventDate?: string;
  eventLocation?: string;
  eventLocationUrl?: string;
  eventHeaderEmailUrl?: string;
  checkinDeadline?: string;
  cancellationFormDeadline?: string;
  cancellationFormUrl?: string;
}

export interface UpdateRegistrationFromPaymentInput {
  invoiceNumber?: string;
  registrationId?: string;
  status?: RegistrationStatus;
  bevyAttendeeId?: number | string | null;
  attendeeCode?: string | null;
  amount?: number;
  paymentChannel?: string;
  paidAt?: string;
  errorReason?: string;
  isTeamAccess?: boolean;
}

/**
 * Splits a full name into first and last name for Bevy compatibility.
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  const lastName = parts.pop() ?? "";
  const firstName = parts.join(" ");
  return { firstName, lastName };
}

/**
 * Finds an event registration document by invoice number, checking:
 * 1. Direct document ID (e.g. without "INV-" prefix or exact)
 * 2. payment_invoice_number field
 * 3. answers.invoice_number field
 * 4. answers.payment_invoice_number field
 * 5. top-level invoice_number field
 */
export async function findRegistrationDoc(
  invoiceNumber: string,
  token?: string,
): Promise<{ id: string; data: FirestoreRegistration } | null> {
  const strippedId = invoiceNumber.replace(/^INV-/, "");
  try {
    const data = await getFirestoreDoc("event_registrations", strippedId, token);
    if (data) return { id: strippedId, data: normalizeRegistrationDoc(data, strippedId) };
  } catch {
    // Ignore and proceed to alternate lookup
  }

  try {
    const data = await getFirestoreDoc("event_registrations", invoiceNumber, token);
    if (data) return { id: invoiceNumber, data: normalizeRegistrationDoc(data, invoiceNumber) };
  } catch {
    // Ignore and proceed to alternate lookup
  }

  const matchPayment = await queryRegistrationDoc("payment_invoice_number", invoiceNumber, token);
  if (matchPayment) return matchPayment;

  const matchAnswers = await queryRegistrationDoc("answers.invoice_number", invoiceNumber, token);
  if (matchAnswers) return matchAnswers;

  const matchAnswersPayment = await queryRegistrationDoc("answers.payment_invoice_number", invoiceNumber, token);
  if (matchAnswersPayment) return matchAnswersPayment;

  const matchTop = await queryRegistrationDoc("invoice_number", invoiceNumber, token);
  if (matchTop) return matchTop;

  return null;
}

/**
 * Queries event_vouchers collection for all vouchers originating from a specific registration.
 */
export async function getVouchersByRegistrationIdServer(
  registrationId: string,
  token?: string,
): Promise<EventVoucher[]> {
  try {
    const url = `${FIRESTORE_BASE_URL}:runQuery?key=${getFirebaseApiKey()}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const authToken = await resolveAuthToken(token);
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const body = {
      structuredQuery: {
        from: [{ collectionId: "event_vouchers" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "source_registration_id" },
            op: "EQUAL",
            value: { stringValue: registrationId },
          },
        },
      },
    };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const items = (await res.json()) as Array<{ document?: { name?: string; fields?: Record<string, unknown> } }>;
    if (!Array.isArray(items)) return [];
    const vouchers: EventVoucher[] = [];
    for (const item of items) {
      if (!item.document) continue;
      const decoded = decodeFirestoreDoc(item.document);
      if (decoded && decoded.code) {
        vouchers.push(decoded as unknown as EventVoucher);
      }
    }
    return vouchers;
  } catch (err) {
    console.warn(`[Firestore REST] Failed querying vouchers by registration ${registrationId}:`, err);
    return [];
  }
}

/**
 * Executes a structured query against event_merchandise_orders collection.
 */
async function queryMerchandiseOrderDoc(
  fieldPath: string,
  value: string,
  token?: string,
): Promise<{ id: string; data: EventMerchandiseOrder } | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${getFirebaseApiKey()}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const authToken = await resolveAuthToken(token);
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const body = {
      structuredQuery: {
        from: [{ collectionId: "event_merchandise_orders" }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: "EQUAL",
            value: { stringValue: value },
          },
        },
        limit: 1,
      },
    };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const items = (await res.json()) as Array<{ document?: { name?: string; fields?: Record<string, unknown> } }>;
    if (!Array.isArray(items) || items.length === 0 || !items[0]?.document) return null;
    const doc = items[0].document;
    const id = doc.name?.split("/").pop() ?? "";
    const decoded = decodeFirestoreDoc(doc);
    return decoded ? { id, data: normalizeMerchandiseOrder(decoded, id) } : null;
  } catch {
    return null;
  }
}

/**
 * Finds an on-the-spot merchandise order document by invoice number or document ID.
 */
export async function findMerchandiseOrderDoc(
  invoiceNumber: string,
  token?: string,
): Promise<{ id: string; data: EventMerchandiseOrder } | null> {
  const strippedId = invoiceNumber.replace(/^INV-/, "");
  try {
    const data = await getFirestoreDoc("event_merchandise_orders", strippedId, token);
    if (data) return { id: strippedId, data: normalizeMerchandiseOrder(data, strippedId) };
  } catch {
    // Ignore and proceed
  }

  try {
    const data = await getFirestoreDoc("event_merchandise_orders", invoiceNumber, token);
    if (data) return { id: invoiceNumber, data: normalizeMerchandiseOrder(data, invoiceNumber) };
  } catch {
    // Ignore and proceed
  }

  const matchPaymentInvoice = await queryMerchandiseOrderDoc("payment_invoice_number", invoiceNumber, token);
  if (matchPaymentInvoice) return matchPaymentInvoice;

  const matchOrderNumber = await queryMerchandiseOrderDoc("order_number", invoiceNumber, token);
  if (matchOrderNumber) return matchOrderNumber;

  return null;
}

export interface UpdateMerchandiseOrderFromPaymentInput {
  invoiceNumber: string;
  orderId?: string;
  amount?: number;
  paymentChannel?: string;
  paidAt?: string;
  errorReason?: string;
  isTeamAccess?: boolean;
}

/**
 * Reconciles an on-the-spot merchandise order upon payment confirmation.
 * Marks payment as 'paid' while keeping collection status manual.
 */
export async function updateMerchandiseOrderFromPayment(
  input: UpdateMerchandiseOrderFromPaymentInput,
  token?: string,
): Promise<{ success: boolean; error?: string; order?: EventMerchandiseOrder }> {
  const invoiceNumber = (input.invoiceNumber || "").trim();
  const orderId = (input.orderId || "").trim();
  if (!invoiceNumber && !orderId) {
    return { success: false, error: "invoiceNumber or orderId is required." };
  }

  let targetDoc: { id: string; data: EventMerchandiseOrder } | null = null;
  if (orderId) {
    const directDoc = await getFirestoreDoc("event_merchandise_orders", orderId, token);
    if (directDoc) {
      targetDoc = { id: orderId, data: normalizeMerchandiseOrder(directDoc, orderId) };
    }
  }

  if (!targetDoc && invoiceNumber) {
    targetDoc = await findMerchandiseOrderDoc(invoiceNumber, token);
  }

  if (!targetDoc) {
    return { success: false, error: `Merchandise order with invoice "${invoiceNumber || orderId}" not found.` };
  }

  const orderData = targetDoc.data;
  const now = new Date().toISOString();
  const isFailed = Boolean(input.errorReason);
  const nextPaymentStatus = isFailed ? "failed" : "paid";

  const existingLogs = Array.isArray(orderData.status_logs) ? orderData.status_logs : [];
  const logEntry: MerchandiseOrderStatusLog = {
    id: `log_${Date.now()}_doku`,
    action: isFailed ? "payment_failed" : "payment_confirmed",
    timestamp: now,
    actor_id: input.isTeamAccess ? "organizer_doku_check" : "doku_automation",
    actor_name: "DOKU Payment Gateway",
    notes: isFailed
      ? `Payment notification: ${input.errorReason}`
      : `Payment confirmed via ${input.paymentChannel || "QRIS"} (${invoiceNumber || targetDoc.id}).`,
  };

  const updatePayload = sanitizePayload<Record<string, unknown>>({
    payment_status: nextPaymentStatus,
    ...(isFailed ? {} : { paid_at: input.paidAt || now }),
    ...(input.paymentChannel ? { payment_channel: input.paymentChannel } : {}),
    ...(invoiceNumber ? { payment_invoice_number: invoiceNumber } : {}),
    updated_at: now,
    status_logs: [...existingLogs, logEntry],
  });

  const patchSuccess = await patchFirestoreDoc("event_merchandise_orders", targetDoc.id, updatePayload, true, token);
  if (!patchSuccess) {
    return { success: false, error: "Failed to patch merchandise order document." };
  }

  return {
    success: true,
    order: {
      ...orderData,
      payment_status: nextPaymentStatus,
      paid_at: isFailed ? orderData.paid_at : input.paidAt || now,
      payment_channel: input.paymentChannel || orderData.payment_channel,
      status_logs: [...existingLogs, logEntry],
      updated_at: now,
    },
  };
}

/**
 * Looks up an event registration in Firestore using the unique invoiceNumber.
 * Resolves event metadata and constructs the ApprovedAttendeeWebhookPayload.
 */
export async function getAttendeeByInvoiceNumber(
  rawInvoiceNumber: string,
  token?: string,
): Promise<AttendeeLookupResult> {
  const invoiceNumber = (rawInvoiceNumber || "").trim();
  if (!invoiceNumber) {
    return { success: false, error: "invoiceNumber parameter is required." };
  }

  const targetDoc = await findRegistrationDoc(invoiceNumber, token);
  if (!targetDoc) {
    return { success: false, error: `Registration with invoice number "${invoiceNumber}" was not found.` };
  }

  const regData = targetDoc.data;

  // Hydrate associated event document
  let eventData: FirestoreEvent | undefined;
  if (regData.event_id) {
    try {
      const ev = await getFirestoreEventByIdServer(String(regData.event_id));
      if (ev) eventData = ev;
    } catch (err) {
      console.warn(`[getAttendeeByInvoiceNumber] Could not fetch event ${regData.event_id}:`, err);
    }
  }

  const isCurated = eventData?.requires_approval === true || eventData?.curation_mode === true;
  const targetStatus: "approved" | "registered" = isCurated ? "approved" : "registered";

  const approvedPayload = buildApprovedAttendeePayload(regData, eventData);
  const { firstName, lastName } = splitName(approvedPayload.fullName);

  return {
    success: true,
    invoiceNumber,
    registrationId: regData.id,
    email: approvedPayload.email,
    fullName: approvedPayload.fullName,
    firstName,
    lastName,
    status: regData.status,
    targetStatus,
    curationMode: isCurated,
    bevyEventId: approvedPayload.bevyEventId,
    bevyChapterId: approvedPayload.bevyChapterId,
    sessionName: approvedPayload.sessionName,
    sessionCapacity: approvedPayload.sessionCapacity,
    subjectEmail: approvedPayload.subjectEmail,
    bodyEmail: approvedPayload.bodyEmail,
    eventName: approvedPayload.eventName,
    eventDate: approvedPayload.bevyEventDate,
    eventLocation: approvedPayload.bevyEventLocation,
    eventLocationUrl: approvedPayload.bevyEventLocationUrl,
    eventHeaderEmailUrl: approvedPayload.eventHeaderEmailUrl,
    checkinDeadline: approvedPayload.checkinDeadline,
  };
}

/**
 * Reconciles payment notification: updates registration status, sets attendee code & Bevy ID,
 * marks payment as PAID, and increments event counters.
 */
export async function updateRegistrationFromPayment(input: UpdateRegistrationFromPaymentInput, token?: string) {
  const invoiceNumber = (input.invoiceNumber || "").trim();
  const registrationId = (input.registrationId || "").trim();
  if (!invoiceNumber && !registrationId) {
    return { success: false, error: "invoiceNumber or registrationId is required." };
  }

  let targetDoc: { id: string; data: FirestoreRegistration } | null = null;
  if (registrationId) {
    const directDoc = await getFirestoreDoc("event_registrations", registrationId, token);
    if (directDoc) {
      targetDoc = {
        id: registrationId,
        data: normalizeRegistrationDoc(directDoc, registrationId),
      };
    }
  }

  if (!targetDoc && invoiceNumber) {
    targetDoc = await findRegistrationDoc(invoiceNumber, token);
  }

  if (!targetDoc) {
    return {
      success: false,
      error: `Registration with invoice number "${invoiceNumber || registrationId}" was not found.`,
    };
  }

  const regData = targetDoc.data;
  const eventIdStr = String(regData.event_id);

  const currentStatus = (regData.status ? String(regData.status) : "").toLowerCase().trim();
  const terminalStatuses = ["cancelled", "canceled", "rejected", "refunded"];
  if (terminalStatuses.includes(currentStatus)) {
    console.warn(
      `[updateRegistrationFromPayment] Refusing to overwrite terminal status "${regData.status}" on registration ${targetDoc.id}`,
    );
    return {
      success: false,
      error: `Registration is in terminal status "${regData.status}". Cannot overwrite via payment status check.`,
    };
  }

  const resolvedStatus: RegistrationStatus =
    input.status ?? (input.errorReason ? ("failed" as const) : ("paid_and_registered" as const));
  const now = new Date().toISOString();
  const existingLogs = Array.isArray(regData.status_logs) ? regData.status_logs : [];

  const statusChanged = regData.status !== resolvedStatus;
  const hasPaidLog = existingLogs.some((l) => l.status === "paid_and_registered");
  const shouldAddLog = statusChanged || (resolvedStatus === "paid_and_registered" && !hasPaidLog);

  let statusLogs = existingLogs;
  let logEntry: RegistrationStatusLog | undefined;

  if (shouldAddLog) {
    logEntry = {
      id: `log_${Date.now()}_doku`,
      status: resolvedStatus,
      previous_status: regData.status,
      changed_at: now,
      changed_by_id: input.isTeamAccess ? "organizer_doku_check" : "doku_automation",
      changed_by_name: "DOKU Payment Gateway",
      notes: input.errorReason
        ? `Payment notification: ${input.errorReason}`
        : `Payment confirmed via ${input.paymentChannel || "QRIS"} (${invoiceNumber || targetDoc.id}). Status: ${resolvedStatus}.`,
    };
    statusLogs = [...existingLogs, logEntry];
  }

  const isTeam = input.isTeamAccess ?? false;

  const updatePayload = sanitizePayload<Record<string, unknown>>({
    status: resolvedStatus,
    payment_status: input.errorReason ? "failed" : "paid",
    ...(invoiceNumber ? { payment_invoice_number: invoiceNumber } : {}),
    ...(input.amount !== undefined ? { payment_amount: input.amount } : {}),
    ...(input.paymentChannel ? { payment_channel: input.paymentChannel } : {}),
    ...(input.paidAt ? { paid_at: input.paidAt } : { paid_at: now }),
    ...(isTeam
      ? {
          reviewed_at: now,
          reviewed_by_name: "DOKU Payment Gateway",
          ...(input.bevyAttendeeId ? { bevy_attendee_id: input.bevyAttendeeId } : {}),
          ...(input.attendeeCode ? { attendee_code: input.attendeeCode } : {}),
        }
      : {}),
    answers: {
      ...(regData.answers ?? {}),
      ...(invoiceNumber ? { invoice_number: invoiceNumber } : {}),
      payment_status: input.errorReason ? "FAILED" : "PAID",
      ...(input.paymentChannel ? { payment_channel: input.paymentChannel } : {}),
      ...(input.paidAt ? { paid_at: input.paidAt } : { paid_at: now }),
      ...(input.amount !== undefined ? { payment_amount: input.amount } : {}),
      ...(input.errorReason ? { error_reason: input.errorReason } : {}),
    },
    status_logs: statusLogs,
    updated_at: now,
  });

  await patchFirestoreDoc("event_registrations", targetDoc.id, updatePayload, true, token);

  const isNowApproved =
    resolvedStatus === "approved" || resolvedStatus === "paid_and_registered" || resolvedStatus === "registered";
  const wasApproved =
    regData.status === "approved" || regData.status === "paid_and_registered" || regData.status === "registered";

  if (
    isNowApproved &&
    (!wasApproved || !Array.isArray(regData.bundle_vouchers) || regData.bundle_vouchers.length === 0)
  ) {
    try {
      const evData = await getFirestoreEventByIdServer(eventIdStr);
      const currentApproved = typeof evData?.total_approved === "number" ? evData.total_approved : 0;

      // Handle bundle friend voucher generation upon confirmed payment/approval
      let vouchersToIssue: BundleIssuedVoucher[] = Array.isArray(regData.bundle_vouchers)
        ? [...regData.bundle_vouchers]
        : [];

      if ((regData.bundle_id || regData.bundle_name) && evData?.bundles) {
        const matchingBundle = evData.bundles.find(
          (b) =>
            (regData.bundle_id && b.id === regData.bundle_id) ||
            (regData.bundle_name && b.name.toLowerCase() === regData.bundle_name.toLowerCase()),
        );
        if (matchingBundle && (matchingBundle.ticket_quantity ?? 1) > 1 && matchingBundle.generate_vouchers !== false) {
          // If vouchers were not generated during initial registration (e.g. waiting_for_payment), generate now
          if (vouchersToIssue.length === 0) {
            const matchingTicketTier = evData.tickets?.find((t) => t.id === matchingBundle.ticket_id);
            const generated = generateBundleFriendVouchers({
              bundle: matchingBundle,
              buyerRegistrationId: targetDoc.id,
              buyerMemberId: regData.member_id,
              buyerName: regData.member_name || "Bundle Purchaser",
              buyerEmail: regData.member_email,
              ticketTier: matchingTicketTier,
              eventStartDate: evData.start_date,
            });

            vouchersToIssue = generated.registrationVouchers;

            // Persist the generated bundle vouchers on the purchaser's registration doc
            await patchFirestoreDoc(
              "event_registrations",
              targetDoc.id,
              {
                bundle_vouchers: generated.registrationVouchers,
                updated_at: now,
              },
              true,
              token,
            );

            // Persist new friend vouchers to event_vouchers collection
            for (const fv of generated.newEventVouchers) {
              const cleanCode = fv.code.trim().toUpperCase();
              const voucherDocId = `${eventIdStr}_${cleanCode}`;
              await patchFirestoreDoc(
                "event_vouchers",
                voucherDocId,
                fv as unknown as Record<string, unknown>,
                true,
                token,
              );
            }
          }
        }
      }

      // If vouchers already existed on regData, ensure they are synced to event_vouchers
      if (
        regData.bundle_id &&
        vouchersToIssue.length > 0 &&
        Array.isArray(regData.bundle_vouchers) &&
        regData.bundle_vouchers.length > 0
      ) {
        for (const bv of vouchersToIssue) {
          const cleanCode = bv.code.trim().toUpperCase();
          const voucherDocId = `${eventIdStr}_${cleanCode}`;
          const friendVoucherPayload = {
            id: bv.voucher_id,
            event_id: eventIdStr,
            code: cleanCode,
            description: `100% Ticket Pass sponsored by ${regData.member_name || "Friend"}`,
            discount_type: "percentage",
            discount_value: 100,
            applies_to: "ticket",
            usage_limit: 1,
            times_used: 0,
            min_spend: null,
            max_discount: null,
            start_date: now,
            end_date: evData?.start_date ?? null,
            status: "active",
            source_bundle_id: regData.bundle_id,
            source_registration_id: targetDoc.id,
            purchaser_member_id: regData.member_id,
            purchaser_name: regData.member_name,
            purchaser_email: regData.member_email,
            created_at: now,
            updated_at: now,
          };

          await patchFirestoreDoc("event_vouchers", voucherDocId, friendVoucherPayload, true, token);
        }
      }

      await patchFirestoreDoc(
        "events",
        eventIdStr,
        {
          total_approved: currentApproved + 1,
          updated_at: now,
        },
        true,
        token,
      );
    } catch (countErr) {
      console.warn("[updateRegistrationFromPayment] Failed to update event / bundle vouchers:", countErr);
    }
  }

  return {
    success: true,
    registrationId: targetDoc.id,
    status: resolvedStatus,
    message: `Registration successfully updated to ${resolvedStatus}`,
    statusLogs,
    logEntry,
  };
}

/**
 * Loads an event from Firestore on the server (Node/RSC/Cloudflare Worker) via native REST.
 */
export const getFirestoreEventByIdServer = cache(
  async (eventId: string, options?: { includeVouchers?: boolean }): Promise<FirestoreEvent | null> => {
    try {
      const data = await getFirestoreDoc("events", String(eventId));
      if (!data) return null;
      const normalized = normalizeEventDoc(data, String(eventId));
      if (!options?.includeVouchers && normalized && "vouchers" in normalized) {
        const { vouchers: _stripped, ...safe } = normalized;
        return safe as FirestoreEvent;
      }
      return normalized;
    } catch (err) {
      console.error(`[Firestore Server] getFirestoreEventByIdServer error for ${eventId}:`, err);
      return null;
    }
  },
);

/**
 * Updates an event's short link properties in Firestore on the server via native REST.
 */
export async function updateFirestoreEventShortLinksServer(
  eventId: string,
  links: {
    liveShortURL?: string;
    liveShortPath?: string;
    bevyShortURL?: string;
    bevyShortPath?: string;
  },
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (links.liveShortURL) {
      payload.short_url = links.liveShortURL;
      payload.live_short_url = links.liveShortURL;
    }
    if (links.liveShortPath) {
      payload.live_short_path = links.liveShortPath;
    }
    if (links.bevyShortURL) {
      payload.bevy_short_url = links.bevyShortURL;
    }
    if (links.bevyShortPath) {
      payload.bevy_short_path = links.bevyShortPath;
    }
    await patchFirestoreDoc("events", String(eventId), payload, true);
  } catch (err) {
    console.warn(`[Firestore Server] updateFirestoreEventShortLinksServer error for ${eventId}:`, err);
  }
}

/**
 * Loads maintenance settings from Firestore on the server (Node/RSC/Cloudflare Worker) via native REST.
 */
export async function getMaintenanceConfigServer(): Promise<MaintenanceConfig> {
  try {
    const data = await getFirestoreDoc("system_settings", "maintenance");
    if (!data) return DEFAULT_MAINTENANCE_CONFIG;
    return { ...DEFAULT_MAINTENANCE_CONFIG, ...(data as Partial<MaintenanceConfig>) };
  } catch (err) {
    console.error("[Firestore Server] getMaintenanceConfigServer error:", err);
    return DEFAULT_MAINTENANCE_CONFIG;
  }
}

/**
 * Saves maintenance settings to Firestore on the server.
 * Note: Firestore Security Rules require Organizer authentication (request.auth).
 * Since server REST runs without client user session, writes should
 * be dispatched via saveMaintenanceConfigDoc in `@/lib/firestore/client` from an authenticated client.
 */
export async function saveMaintenanceConfigServer(config: Partial<MaintenanceConfig>): Promise<void> {
  try {
    const payload = sanitizePayload({
      ...config,
      updatedAt: new Date().toISOString(),
    });
    await patchFirestoreDoc("system_settings", "maintenance", payload as Record<string, unknown>, true);
  } catch (err) {
    console.warn(
      "[Firestore Server] saveMaintenanceConfigServer warning (write should be performed via client SDK with auth session):",
      err,
    );
  }
}

/**
 * Updates refund request status on the server using Firestore REST API.
 * Ensures status is updated to 'canceled' and payment_status to 'refunded' upon refund completion.
 */
export async function updateRefundStatusServer(
  registrationId: string,
  status: RefundStatus,
  details?: Partial<RefundRequest>,
  reviewer?: { id: string; name: string; email?: string },
  token?: string,
): Promise<boolean> {
  try {
    const rawDoc = await getFirestoreDoc("event_registrations", registrationId, token);
    if (!rawDoc) {
      console.warn(`[updateRefundStatusServer] Registration ${registrationId} not found`);
      return false;
    }
    const existing = rawDoc as unknown as FirestoreRegistration;
    const existingRequest = existing.refund_request;
    if (!existingRequest) {
      console.warn(`[updateRefundStatusServer] Registration ${registrationId} has no active refund request`);
      return false;
    }

    const now = new Date().toISOString();
    const mergedRequest: RefundRequest = {
      ...existingRequest,
      ...(details ?? {}),
      status,
      updated_at: now,
    };

    const updatePayload: Record<string, unknown> = {
      refund_request: mergedRequest,
      updated_at: now,
    };

    if (status === "refund_completed") {
      updatePayload.payment_status = "refunded";
      updatePayload.status = "canceled";
    }

    const existingLogs = Array.isArray(existing.status_logs) ? existing.status_logs : [];
    const logEntry: RegistrationStatusLog = {
      id: `log_${Date.now()}_refund_${status}`,
      status: status === "refund_completed" ? "canceled" : existing.status,
      changed_at: now,
      changed_by_id: reviewer?.id ?? details?.completed_by_id ?? details?.rejected_by_id ?? "organizer",
      changed_by_name: reviewer?.name ?? details?.completed_by_name ?? details?.rejected_by_name ?? "Organizer",
      changed_by_email: reviewer?.email ?? details?.completed_by_email ?? details?.rejected_by_email,
      notes: (() => {
        if (status === "refund_completed") {
          return `Refund completed. Proof uploaded by ${reviewer?.name ?? "organizer"}.`;
        }
        if (status === "rejected") {
          return `Refund rejected: ${details?.rejection_reason ?? "No reason specified"}`;
        }
        return "Refund request resubmitted.";
      })(),
    };
    updatePayload.status_logs = [...existingLogs, logEntry];

    return await patchFirestoreDoc("event_registrations", registrationId, sanitizePayload(updatePayload), true, token);
  } catch (err) {
    console.error(`[updateRefundStatusServer] Error updating refund status for ${registrationId}:`, err);
    return false;
  }
}
