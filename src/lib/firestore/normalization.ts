import { toISOStringSafe } from "@/lib/date-utils";
import { ensureEventTickets } from "@/lib/events/ticket-templates";
import type { EventTicketTier, FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";

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

  // Normalize status_logs
  let statusLogs = docData.status_logs;
  if (Array.isArray(statusLogs)) {
    statusLogs = statusLogs.map((log: unknown) => {
      if (typeof log === "object" && log !== null) {
        const logObj = log as Record<string, unknown>;
        return {
          ...logObj,
          changed_at:
            toISOStringSafe(logObj.changed_at) ??
            (typeof logObj.changed_at === "string" ? logObj.changed_at : new Date().toISOString()),
        };
      }
      return log;
    });
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
