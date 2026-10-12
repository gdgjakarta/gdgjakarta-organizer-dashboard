import { collection, doc, getDoc, getDocs, getFirestore, increment, query, updateDoc, where } from "firebase/firestore";

import { app } from "@/config/firebase";
import { buildApprovedAttendeePayload } from "@/lib/events/approved-attendee-webhook";
import type {
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatus,
  RegistrationStatusLog,
} from "@/lib/firestore/types";

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
 * Looks up an event registration in Firestore using the unique invoiceNumber.
 * Resolves event metadata and constructs the ApprovedAttendeeWebhookPayload.
 */
export async function getAttendeeByInvoiceNumber(rawInvoiceNumber: string): Promise<AttendeeLookupResult> {
  const invoiceNumber = (rawInvoiceNumber || "").trim();
  if (!invoiceNumber) {
    return { success: false, error: "invoiceNumber parameter is required." };
  }

  const db = getFirestore(app);
  const regCollection = collection(db, "event_registrations");

  // 1. Query registration document by answers.invoice_number
  let targetDocSnap = null;
  const qAnswers = query(regCollection, where("answers.invoice_number", "==", invoiceNumber));
  const snapAnswers = await getDocs(qAnswers);

  if (!snapAnswers.empty) {
    targetDocSnap = snapAnswers.docs[0];
  } else {
    // Fallback: check top-level invoice_number or alternate key
    const qTop = query(regCollection, where("invoice_number", "==", invoiceNumber));
    const snapTop = await getDocs(qTop);
    if (!snapTop.empty) {
      targetDocSnap = snapTop.docs[0];
    }
  }

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

  const db = getFirestore(app);
  const regCollection = collection(db, "event_registrations");

  // 1. Locate registration document
  let targetDocSnap = null;
  const qAnswers = query(regCollection, where("answers.invoice_number", "==", invoiceNumber));
  const snapAnswers = await getDocs(qAnswers);

  if (!snapAnswers.empty) {
    targetDocSnap = snapAnswers.docs[0];
  } else {
    const qTop = query(regCollection, where("invoice_number", "==", invoiceNumber));
    const snapTop = await getDocs(qTop);
    if (!snapTop.empty) {
      targetDocSnap = snapTop.docs[0];
    }
  }

  if (!targetDocSnap) {
    return { success: false, error: `Registration with invoice number "${invoiceNumber}" was not found.` };
  }

  const regData = targetDocSnap.data() as FirestoreRegistration;
  const regRef = doc(db, "event_registrations", targetDocSnap.id);
  const eventIdStr = String(regData.event_id);

  // 2. Hydrate associated event to verify curation mode
  let isCurated = true;
  if (regData.event_id) {
    try {
      const eventRef = doc(db, "events", eventIdStr);
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        const eData = eventSnap.data() as FirestoreEvent;
        isCurated = eData.requires_approval === true || eData.curation_mode === true;
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
    ...(input.amount !== undefined ? { payment_amount: input.amount } : {}),
    reviewed_at: now,
    reviewed_by_name: "DOKU Payment Automation",
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
    } catch (countErr) {
      console.warn("[updateRegistrationFromPayment] Failed to increment total_approved:", countErr);
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
    const db = getFirestore(app);
    const eventRef = doc(db, "events", String(eventId));
    const snap = await getDoc(eventRef);
    if (!snap.exists()) return null;
    return {
      ...(snap.data() as FirestoreEvent),
      id: snap.id,
    };
  } catch (err) {
    console.error(`[Firestore Server] getFirestoreEventByIdServer error for ${eventId}:`, err);
    return null;
  }
}
