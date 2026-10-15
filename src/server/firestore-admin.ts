import { getApps, initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore/lite";

import { firebaseConfig } from "@/config/firebase";
import { buildApprovedAttendeePayload } from "@/lib/events/approved-attendee-webhook";
import { normalizeEventDoc } from "@/lib/firestore/normalization";
import type {
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatus,
  RegistrationStatusLog,
} from "@/lib/firestore/types";

/**
 * Returns a dedicated Firestore Lite instance for server-side operations.
 * Uses a dedicated named FirebaseApp to completely isolate it from standard
 * client Firestore instances initialized on the default app.
 */
function getServerFirestoreLite() {
  const existingApp = getApps().find((a) => a.name === "server-firestore-lite");
  const serverApp = existingApp || initializeApp(firebaseConfig, "server-firestore-lite");
  return getFirestore(serverApp);
}

/**
 * Pure utility function to strip undefined values before writing to Firestore.
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
async function findRegistrationDocSnap(regCollection: ReturnType<typeof collection>, invoiceNumber: string) {
  // 1. Direct document ID checks
  const strippedId = invoiceNumber.replace(/^INV-/, "");
  try {
    const snap = await getDoc(doc(regCollection, strippedId));
    if (snap.exists()) return snap;
  } catch {
    // Ignore and proceed to alternate lookup
  }

  try {
    const snap = await getDoc(doc(regCollection, invoiceNumber));
    if (snap.exists()) return snap;
  } catch {
    // Ignore and proceed to alternate lookup
  }

  // 2. Query payment_invoice_number
  try {
    const qPayment = query(regCollection, where("payment_invoice_number", "==", invoiceNumber));
    const snapPayment = await getDocs(qPayment);
    if (!snapPayment.empty) return snapPayment.docs[0];
  } catch {
    // Ignore and proceed to alternate lookup
  }

  // 3. Query answers.invoice_number
  try {
    const qAnswers = query(regCollection, where("answers.invoice_number", "==", invoiceNumber));
    const snapAnswers = await getDocs(qAnswers);
    if (!snapAnswers.empty) return snapAnswers.docs[0];
  } catch {
    // Ignore and proceed to alternate lookup
  }

  // 4. Query answers.payment_invoice_number
  try {
    const qAnswersPayment = query(regCollection, where("answers.payment_invoice_number", "==", invoiceNumber));
    const snapAnswersPayment = await getDocs(qAnswersPayment);
    if (!snapAnswersPayment.empty) return snapAnswersPayment.docs[0];
  } catch {
    // Ignore and proceed to alternate lookup
  }

  // 5. Query top-level invoice_number
  try {
    const qTop = query(regCollection, where("invoice_number", "==", invoiceNumber));
    const snapTop = await getDocs(qTop);
    if (!snapTop.empty) return snapTop.docs[0];
  } catch {
    // Ignore and proceed to alternate lookup
  }

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

  const db = getServerFirestoreLite();
  const regCollection = collection(db, "event_registrations");

  const targetDocSnap = await findRegistrationDocSnap(regCollection, invoiceNumber);

  if (!targetDocSnap) {
    return { success: false, error: `Registration with invoice number "${invoiceNumber}" was not found.` };
  }

  const regData = { id: targetDocSnap.id, ...targetDocSnap.data() } as FirestoreRegistration;

  // 2. Hydrate associated event document
  let eventData: FirestoreEvent | undefined;
  if (regData.event_id) {
    try {
      const eventRef = doc(db, "events", String(regData.event_id));
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        eventData = { id: eventSnap.id, ...eventSnap.data() } as FirestoreEvent;
      }
    } catch (err) {
      console.warn(`[getAttendeeByInvoiceNumber] Could not fetch event ${regData.event_id}:`, err);
    }
  }

  // 3. Determine curation mode & target status
  const isCurated = eventData?.requires_approval === true || eventData?.curation_mode === true;
  const targetStatus: "approved" | "registered" = isCurated ? "approved" : "registered";

  // 4. Build Bevy-compatible payload with email template & variables
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

  const db = getServerFirestoreLite();
  const regCollection = collection(db, "event_registrations");

  // 1. Locate registration document
  const targetDocSnap = await findRegistrationDocSnap(regCollection, invoiceNumber);

  if (!targetDocSnap) {
    return { success: false, error: `Registration with invoice number "${invoiceNumber}" was not found.` };
  }

  const regData = targetDocSnap.data() as FirestoreRegistration;
  const regRef = doc(db, "event_registrations", targetDocSnap.id);
  const eventIdStr = String(regData.event_id);

  // 2. Hydrate associated event if needed
  if (regData.event_id) {
    try {
      const eventRef = doc(db, "events", eventIdStr);
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        const _eData = eventSnap.data() as FirestoreEvent;
      }
    } catch {
      // keep fallback
    }
  }

  // 3. Resolve status
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

  // 4. Update registration document
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

  await updateDoc(regRef, updatePayload);

  // 5. Increment event approved counter if transitioning to approved or paid_and_registered
  const isNowApproved =
    resolvedStatus === "approved" || resolvedStatus === "paid_and_registered" || resolvedStatus === "registered";
  const wasApproved =
    regData.status === "approved" || regData.status === "paid_and_registered" || regData.status === "registered";

  if (isNowApproved && !wasApproved) {
    try {
      const eventRef = doc(db, "events", eventIdStr);
      await updateDoc(eventRef, {
        total_approved: increment(1),
        updated_at: now,
      });

      // Ensure bundle vouchers are properly included in event.vouchers
      if (regData.bundle_id && Array.isArray(regData.bundle_vouchers) && regData.bundle_vouchers.length > 0) {
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          const evData = eventSnap.data() as FirestoreEvent;
          const currentVouchers = Array.isArray(evData.vouchers) ? [...evData.vouchers] : [];
          let hasNew = false;

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
                end_date: evData.start_date || null,
                status: "active",
                source_bundle_id: regData.bundle_id,
                source_registration_id: targetDocSnap.id,
                purchaser_member_id: regData.member_id,
                purchaser_name: regData.member_name,
                purchaser_email: regData.member_email,
                created_at: now,
                updated_at: now,
              });
              hasNew = true;
            }
          }

          if (hasNew) {
            await updateDoc(eventRef, { vouchers: currentVouchers, updated_at: now });
          }
        }
      }
    } catch (countErr) {
      console.warn("[updateRegistrationFromPayment] Failed to update event / bundle vouchers:", countErr);
    }
  }

  return {
    success: true,
    registrationId: targetDocSnap.id,
    status: resolvedStatus,
    message: `Registration successfully updated to ${resolvedStatus}`,
  };
}

/**
 * Loads an event from Firestore on the server (Node/RSC).
 */
export async function getFirestoreEventByIdServer(eventId: string): Promise<FirestoreEvent | null> {
  try {
    const db = getServerFirestoreLite();
    const eventRef = doc(db, "events", String(eventId));
    const snap = await getDoc(eventRef);
    if (!snap.exists()) return null;
    return normalizeEventDoc(snap.data() as Record<string, unknown>, snap.id);
  } catch (err) {
    console.error(`[Firestore Server] getFirestoreEventByIdServer error for ${eventId}:`, err);
    return null;
  }
}

/**
 * Updates an event's short link properties in Firestore on the server.
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
    const db = getServerFirestoreLite();
    const eventRef = doc(db, "events", String(eventId));
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
    await setDoc(eventRef, payload, { merge: true });
  } catch (err) {
    console.warn(`[Firestore Server] updateFirestoreEventShortLinksServer error for ${eventId}:`, err);
  }
}

import { DEFAULT_MAINTENANCE_CONFIG, type MaintenanceConfig } from "@/config/maintenance-config";

/**
 * Loads maintenance settings from Firestore on the server (Node/RSC).
 */
export async function getMaintenanceConfigServer(): Promise<MaintenanceConfig> {
  try {
    const db = getServerFirestoreLite();
    const docRef = doc(db, "system_settings", "maintenance");
    const snap = await getDoc(docRef);
    if (!snap.exists()) return DEFAULT_MAINTENANCE_CONFIG;
    return { ...DEFAULT_MAINTENANCE_CONFIG, ...(snap.data() as Partial<MaintenanceConfig>) };
  } catch (err) {
    console.error("[Firestore Server] getMaintenanceConfigServer error:", err);
    return DEFAULT_MAINTENANCE_CONFIG;
  }
}

/**
 * Saves maintenance settings to Firestore on the server.
 * Note: Firestore Security Rules require Organizer authentication (request.auth).
 * Since server-firestore-lite runs without client user session, writes should
 * be dispatched via saveMaintenanceConfigDoc in `@/lib/firestore/client` from an authenticated client.
 */
export async function saveMaintenanceConfigServer(config: Partial<MaintenanceConfig>): Promise<void> {
  try {
    const db = getServerFirestoreLite();
    const docRef = doc(db, "system_settings", "maintenance");
    const payload = sanitizePayload({
      ...config,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.warn(
      "[Firestore Server] saveMaintenanceConfigServer warning (write should be performed via client SDK with auth session):",
      err,
    );
  }
}
