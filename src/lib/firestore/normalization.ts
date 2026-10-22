import { toISOStringSafe } from "@/lib/date-utils";
import { ensureEventTickets } from "@/lib/events/ticket-templates";
import type {
  EventTicketTier,
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatusLog,
} from "@/lib/firestore/types";

/**
 * Normalizes a Firestore event registration document, guaranteeing that all timestamp
 * fields (registered_at, reviewed_at, checked_in_at, paid_at, payment_expired_datetime,
 * status_logs, answers) are sanitized into ISO strings or strings, preventing runtime
 * React child errors caused by raw Firestore Timestamp objects `{ seconds, nanoseconds }`.
 */
export function normalizeRegistrationDoc(docData: Record<string, unknown>, id: string): FirestoreRegistration {
  const registeredAtStr = toISOStringSafe(docData.registered_at) ?? "";
  const reviewedAtStr =
    toISOStringSafe(docData.reviewed_at) ?? (typeof docData.reviewed_at === "string" ? docData.reviewed_at : undefined);
  const checkedInAtStr =
    toISOStringSafe(docData.checked_in_at) ??
    (typeof docData.checked_in_at === "string" ? docData.checked_in_at : undefined);
  const paidAtStr =
    toISOStringSafe(docData.paid_at) ?? (typeof docData.paid_at === "string" ? docData.paid_at : undefined);
  const paymentExpiredStr =
    toISOStringSafe(docData.payment_expired_datetime) ??
    (typeof docData.payment_expired_datetime === "string" ? docData.payment_expired_datetime : undefined);
  const checkinDateStr =
    toISOStringSafe(docData.checkin_date) ?? (typeof docData.checkin_date === "string" ? docData.checkin_date : null);
  const merchCollectedAtStr =
    toISOStringSafe(docData.merchandise_collected_at) ??
    (typeof docData.merchandise_collected_at === "string" ? docData.merchandise_collected_at : null);

  // Normalize status_logs
  let statusLogs: RegistrationStatusLog[] = [];
  if (Array.isArray(docData.status_logs)) {
    statusLogs = docData.status_logs.map((log: unknown) => {
      if (typeof log === "object" && log !== null) {
        const logObj = log as Record<string, unknown>;
        return {
          ...logObj,
          changed_at:
            toISOStringSafe(logObj.changed_at) ??
            (typeof logObj.changed_at === "string" ? logObj.changed_at : new Date().toISOString()),
        } as RegistrationStatusLog;
      }
      return log as RegistrationStatusLog;
    });
  }

  // Ensure paid_and_registered status log exists if registration is paid
  const isPaid =
    docData.status === "paid_and_registered" ||
    String(docData.payment_status).toLowerCase() === "paid" ||
    Boolean(paidAtStr) ||
    String((docData.answers as Record<string, unknown> | undefined)?.payment_status).toLowerCase() === "paid";

  if (isPaid) {
    const hasPaidLog = statusLogs.some((l) => l.status === "paid_and_registered");
    if (!hasPaidLog) {
      const invoiceNum =
        (docData.payment_invoice_number as string | undefined) ??
        ((docData.answers as Record<string, unknown> | undefined)?.payment_invoice_number as string | undefined) ??
        ((docData.answers as Record<string, unknown> | undefined)?.invoice_number as string | undefined) ??
        (docData.invoice_number as string | undefined);
      const paymentChannel =
        (docData.payment_channel as string | undefined) ??
        ((docData.answers as Record<string, unknown> | undefined)?.payment_channel as string | undefined) ??
        "QRIS";
      const changedAt =
        paidAtStr ||
        reviewedAtStr ||
        (toISOStringSafe(docData.updated_at) ??
          (typeof docData.updated_at === "string" ? docData.updated_at : undefined)) ||
        new Date().toISOString();

      statusLogs.push({
        id: `synthetic_paid_${id}`,
        status: "paid_and_registered",
        previous_status: "waiting_for_payment",
        changed_at: changedAt,
        changed_by_id: (docData.reviewed_by_id as string | undefined) || "doku_payment_gateway",
        changed_by_name: (docData.reviewed_by_name as string | undefined) || "DOKU Payment Gateway",
        changed_by_email: docData.reviewed_by_email as string | undefined,
        notes: `Payment confirmed via ${paymentChannel}${invoiceNum ? ` (${invoiceNum})` : ""}. Status: Paid & Registered.`,
      });
    }
  }

  // Normalize answers if any answer contains a timestamp object
  let answers = docData.answers as Record<string, unknown> | undefined;
  if (answers && typeof answers === "object") {
    let hasObject = false;
    for (const v of Object.values(answers)) {
      if (v && typeof v === "object" && !Array.isArray(v) && ("seconds" in v || "_seconds" in v || "toDate" in v)) {
        hasObject = true;
        break;
      }
    }
    if (hasObject) {
      const normalizedAnswers: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(answers)) {
        if (v && typeof v === "object" && !Array.isArray(v) && ("seconds" in v || "_seconds" in v || "toDate" in v)) {
          normalizedAnswers[k] = toISOStringSafe(v) ?? String(v);
        } else {
          normalizedAnswers[k] = v;
        }
      }
      answers = normalizedAnswers;
    }
  }

  return {
    ...docData,
    id,
    registered_at: registeredAtStr,
    reviewed_at: reviewedAtStr,
    checked_in_at: checkedInAtStr,
    paid_at: paidAtStr,
    payment_expired_datetime: paymentExpiredStr,
    checkin_date: checkinDateStr,
    merchandise_collected_at: merchCollectedAtStr,
    status_logs: statusLogs,
    answers,
  } as FirestoreRegistration;
}

/**
 * Normalizes a Firestore event document, guaranteeing that all timestamp
 * fields (start_date, end_date, registration_start_date, registration_end_date,
 * created_at, updated_at) are serialized strings rather than raw Timestamp instances.
 */
export function normalizeEventDoc(docData: Record<string, unknown>, id: string): FirestoreEvent {
  return {
    ...docData,
    id,
    start_date:
      toISOStringSafe(docData.start_date) ??
      (typeof docData.start_date === "string" ? docData.start_date : new Date().toISOString()),
    end_date:
      toISOStringSafe(docData.end_date) ??
      (typeof docData.end_date === "string" ? docData.end_date : new Date().toISOString()),
    registration_start_date:
      toISOStringSafe(docData.registration_start_date) ??
      (typeof docData.registration_start_date === "string" ? docData.registration_start_date : undefined),
    registration_end_date:
      toISOStringSafe(docData.registration_end_date) ??
      (typeof docData.registration_end_date === "string" ? docData.registration_end_date : undefined),
    created_at:
      toISOStringSafe(docData.created_at) ??
      (typeof docData.created_at === "string" ? docData.created_at : new Date().toISOString()),
    updated_at:
      toISOStringSafe(docData.updated_at) ??
      (typeof docData.updated_at === "string" ? docData.updated_at : new Date().toISOString()),
    tickets: ensureEventTickets(docData.tickets as EventTicketTier[] | undefined),
  } as FirestoreEvent;
}
