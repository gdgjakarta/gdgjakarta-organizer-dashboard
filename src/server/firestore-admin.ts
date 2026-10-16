import { DEFAULT_MAINTENANCE_CONFIG, type MaintenanceConfig } from "@/config/maintenance-config";
import { buildApprovedAttendeePayload } from "@/lib/events/approved-attendee-webhook";
import { normalizeEventDoc } from "@/lib/firestore/normalization";
import type {
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatus,
  RegistrationStatusLog,
} from "@/lib/firestore/types";

/**
 * Cloud Firestore REST API configuration.
 * Using native fetch and Firestore REST eliminates Node gRPC and @grpc/proto-loader dependencies,
 * avoiding the protobufjs eval/codegen EvalError in Cloudflare Workers V8 isolates.
 */
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gdgjakarta-app";
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCVk8ECyA8Lqd7KNqdnItxYUu9jdFzoohU";
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
 * Fetches a single document via Firestore REST API.
 */
async function getFirestoreDoc(collectionName: string, docId: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `${FIRESTORE_BASE_URL}/${collectionName}/${encodeURIComponent(docId)}?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 404) return null;
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
async function patchFirestoreDoc(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>,
  merge = true,
): Promise<boolean> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.set("key", FIREBASE_API_KEY);
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    if (merge) {
      for (const k of keys) {
        searchParams.append("updateMask.fieldPaths", k);
      }
    }
    const url = `${FIRESTORE_BASE_URL}/${collectionName}/${encodeURIComponent(docId)}?${searchParams.toString()}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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
 * Queries a collection using Firestore REST runQuery.
 */
async function queryRegistrationDoc(
  fieldPath: string,
  value: string,
): Promise<{ id: string; data: FirestoreRegistration } | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
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
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const items = (await res.json()) as Array<{ document?: { name?: string; fields?: Record<string, unknown> } }>;
    if (!Array.isArray(items) || items.length === 0 || !items[0]?.document) return null;
    const doc = items[0].document;
    const id = doc.name?.split("/").pop() ?? "";
    const decoded = decodeFirestoreDoc(doc);
    return decoded ? { id, data: { id, ...decoded } as unknown as FirestoreRegistration } : null;
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
  invoiceNumber: string;
  status?: RegistrationStatus;
  bevyAttendeeId?: number | null;
  attendeeCode?: string | null;
  amount?: number;
  paymentChannel?: string;
  paidAt?: string;
  errorReason?: string;
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
async function findRegistrationDoc(invoiceNumber: string): Promise<{ id: string; data: FirestoreRegistration } | null> {
  const strippedId = invoiceNumber.replace(/^INV-/, "");
  try {
    const data = await getFirestoreDoc("event_registrations", strippedId);
    if (data) return { id: strippedId, data: { id: strippedId, ...data } as unknown as FirestoreRegistration };
  } catch {
    // Ignore and proceed to alternate lookup
  }

  try {
    const data = await getFirestoreDoc("event_registrations", invoiceNumber);
    if (data) return { id: invoiceNumber, data: { id: invoiceNumber, ...data } as unknown as FirestoreRegistration };
  } catch {
    // Ignore and proceed to alternate lookup
  }

  const matchPayment = await queryRegistrationDoc("payment_invoice_number", invoiceNumber);
  if (matchPayment) return matchPayment;

  const matchAnswers = await queryRegistrationDoc("answers.invoice_number", invoiceNumber);
  if (matchAnswers) return matchAnswers;

  const matchAnswersPayment = await queryRegistrationDoc("answers.payment_invoice_number", invoiceNumber);
  if (matchAnswersPayment) return matchAnswersPayment;

  const matchTop = await queryRegistrationDoc("invoice_number", invoiceNumber);
  if (matchTop) return matchTop;

  return null;
}

/**
 * Looks up an event registration in Firestore using the unique invoiceNumber.
 * Resolves event metadata and constructs the ApprovedAttendeeWebhookPayload.
 */
export async function getAttendeeByInvoiceNumber(rawInvoiceNumber: string): Promise<AttendeeLookupResult> {
  const invoiceNumber = (rawInvoiceNumber || "").trim();
  if (!invoiceNumber) {
    return { success: false, error: "invoiceNumber parameter is required." };
  }

  const targetDoc = await findRegistrationDoc(invoiceNumber);
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
export async function updateRegistrationFromPayment(input: UpdateRegistrationFromPaymentInput) {
  const invoiceNumber = (input.invoiceNumber || "").trim();
  if (!invoiceNumber) {
    return { success: false, error: "invoiceNumber is required." };
  }

  const targetDoc = await findRegistrationDoc(invoiceNumber);
  if (!targetDoc) {
    return { success: false, error: `Registration with invoice number "${invoiceNumber}" was not found.` };
  }

  const regData = targetDoc.data;
  const eventIdStr = String(regData.event_id);

  const resolvedStatus: RegistrationStatus =
    input.status ?? (input.errorReason ? ("failed" as const) : ("paid_and_registered" as const));

  const now = new Date().toISOString();
  const existingLogs = Array.isArray(regData.status_logs) ? regData.status_logs : [];

  const logEntry: RegistrationStatusLog = {
    id: `log_${Date.now()}_n8n`,
    status: resolvedStatus,
    previous_status: regData.status,
    changed_at: now,
    changed_by_id: "doku_automation",
    changed_by_name: "DOKU & Bevy Automation (n8n)",
    notes: input.errorReason
      ? `Payment notification: ${input.errorReason}`
      : `Payment confirmed (${invoiceNumber}). Status: ${resolvedStatus}. Synced to Bevy.`,
  };

  const updatePayload = sanitizePayload<Record<string, unknown>>({
    status: resolvedStatus,
    payment_status: input.errorReason ? "failed" : "paid",
    payment_invoice_number: invoiceNumber,
    ...(input.amount !== undefined ? { payment_amount: input.amount } : {}),
    ...(input.paymentChannel ? { payment_channel: input.paymentChannel } : {}),
    ...(input.paidAt ? { paid_at: input.paidAt } : { paid_at: now }),
    reviewed_at: now,
    reviewed_by_name: "DOKU Payment Automation (n8n)",
    ...(input.bevyAttendeeId ? { bevy_attendee_id: input.bevyAttendeeId } : {}),
    ...(input.attendeeCode ? { attendee_code: input.attendeeCode } : {}),
    answers: {
      ...(regData.answers ?? {}),
      invoice_number: invoiceNumber,
      payment_status: input.errorReason ? "FAILED" : "PAID",
      ...(input.paymentChannel ? { payment_channel: input.paymentChannel } : {}),
      ...(input.paidAt ? { paid_at: input.paidAt } : { paid_at: now }),
      ...(input.amount !== undefined ? { payment_amount: input.amount } : {}),
      ...(input.errorReason ? { error_reason: input.errorReason } : {}),
    },
    status_logs: [...existingLogs, logEntry],
    updated_at: now,
  });

  await patchFirestoreDoc("event_registrations", targetDoc.id, updatePayload, true);

  const isNowApproved =
    resolvedStatus === "approved" || resolvedStatus === "paid_and_registered" || resolvedStatus === "registered";
  const wasApproved =
    regData.status === "approved" || regData.status === "paid_and_registered" || regData.status === "registered";

  if (isNowApproved && !wasApproved) {
    try {
      const evData = await getFirestoreEventByIdServer(eventIdStr);
      const currentApproved = typeof evData?.total_approved === "number" ? evData.total_approved : 0;
      const currentVouchers = Array.isArray(evData?.vouchers) ? [...evData.vouchers] : [];
      let hasNew = false;

      if (regData.bundle_id && Array.isArray(regData.bundle_vouchers) && regData.bundle_vouchers.length > 0) {
        for (const bv of regData.bundle_vouchers) {
          if (!currentVouchers.some((cv) => cv.code.toUpperCase() === bv.code.toUpperCase())) {
            currentVouchers.push({
              id: bv.voucher_id,
              code: bv.code,
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
            });
            hasNew = true;
          }
        }
      }

      await patchFirestoreDoc(
        "events",
        eventIdStr,
        {
          total_approved: currentApproved + 1,
          updated_at: now,
          ...(hasNew ? { vouchers: currentVouchers } : {}),
        },
        true,
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
  };
}

/**
 * Loads an event from Firestore on the server (Node/RSC/Cloudflare Worker) via native REST.
 */
export async function getFirestoreEventByIdServer(eventId: string): Promise<FirestoreEvent | null> {
  try {
    const data = await getFirestoreDoc("events", String(eventId));
    if (!data) return null;
    return normalizeEventDoc(data, String(eventId));
  } catch (err) {
    console.error(`[Firestore Server] getFirestoreEventByIdServer error for ${eventId}:`, err);
    return null;
  }
}

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
