"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  type Firestore,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

export { deleteField };

import { app } from "@/config/firebase";
import type { FaqContent, PartnershipContent } from "@/lib/content/types";

export const db: Firestore = typeof window !== "undefined" ? getFirestore(app) : (null as unknown as Firestore);

export function isFirestoreFieldValue(val: unknown): boolean {
  return (
    val !== null &&
    typeof val === "object" &&
    ("_methodName" in val ||
      Boolean((val as { constructor?: { name?: string } }).constructor?.name?.includes("FieldValue")))
  );
}

/**
 * Recursively removes `undefined` properties from objects and arrays so Firestore writes
 * never fail with: "Unsupported field value: undefined".
 * Preserves null, Date, and Firestore FieldValues (such as deleteField()).
 */
export function sanitizeFirestoreData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined && !isFirestoreFieldValue(item))
      .map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }
  if (isFirestoreFieldValue(data) || data instanceof Date) {
    return data;
  }
  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value !== undefined) {
        result[key] = sanitizeFirestoreData(value);
      }
    }
    return result as T;
  }
  return data;
}

import type {
  AuditLogEntry,
  EventEmailTemplates,
  EventMerchandiseItem,
  EventSession,
  EventTicketTier,
  FirestoreEvent,
  FirestoreMember,
  FirestoreRegistration,
  FirestoreSyncMetadata,
  RegistrationStatus,
  RegistrationStatusLog,
} from "./types";

// ── Events ──────────────────────────────────────────────────────────────────

export async function getFirestoreEvents(maxResults = 100): Promise<FirestoreEvent[]> {
  if (typeof window === "undefined") return [];
  try {
    const eventsRef = collection(db, "events");
    const q = query(eventsRef, orderBy("start_date", "desc"), limit(maxResults));
    const snapshot = await getDocs(q);

    return (
      snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as FirestoreEvent[]
    ).filter((e) => !e.is_hidden && !(e as { hidden?: boolean }).hidden);
  } catch (error) {
    console.error("[Firestore] getFirestoreEvents error:", error);
    return [];
  }
}

export async function getFirestoreEventById(eventId: string): Promise<FirestoreEvent | null> {
  if (typeof window === "undefined") return null;
  try {
    const docRef = doc(db, "events", eventId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as FirestoreEvent;
  } catch (error) {
    console.error(`[Firestore] getFirestoreEventById error for ${eventId}:`, error);
    return null;
  }
}

export async function saveFirestoreEvent(event: Partial<FirestoreEvent> | Record<string, unknown>): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "events", String(event.id));
  const sanitized = sanitizeFirestoreData(event);
  await setDoc(docRef, sanitized, { merge: true });
}

// ── Members ─────────────────────────────────────────────────────────────────

export async function getFirestoreMembers(maxResults = 200): Promise<FirestoreMember[]> {
  if (typeof window === "undefined") return [];
  try {
    const membersRef = collection(db, "members");
    const q = query(membersRef, limit(maxResults));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as FirestoreMember[];
  } catch (error) {
    console.error("[Firestore] getFirestoreMembers error:", error);
    return [];
  }
}

export async function getFirestoreMemberById(memberId: string): Promise<FirestoreMember | null> {
  if (typeof window === "undefined") return null;
  try {
    const docRef = doc(db, "members", memberId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as FirestoreMember;
  } catch (error) {
    console.error(`[Firestore] getFirestoreMemberById error for ${memberId}:`, error);
    return null;
  }
}

export async function saveFirestoreMember(member: Partial<FirestoreMember> | Record<string, unknown>): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "members", String(member.id));
  const sanitized = sanitizeFirestoreData(member);
  await setDoc(docRef, sanitized, { merge: true });
}

export async function updateFirestoreMemberBevyId(uid: string, bevyUserId: string): Promise<void> {
  if (typeof window === "undefined" || !uid || !bevyUserId) return;
  try {
    const memberRef = doc(db, "members", uid);
    const sanitized = sanitizeFirestoreData({
      bevy_user_id: String(bevyUserId),
      updated_at: new Date().toISOString(),
    });
    await setDoc(memberRef, sanitized, { merge: true });
    console.log(`[Firestore] Updated member ${uid} with bevy_user_id: ${bevyUserId}`);
  } catch (error) {
    console.error(`[Firestore] Failed to update bevy_user_id for member ${uid}:`, error);
  }
}

// ── Registrations & Filtration ──────────────────────────────────────────────

export async function getEventRegistrations(eventId: string): Promise<FirestoreRegistration[]> {
  if (typeof window === "undefined") return [];
  try {
    const regRef = collection(db, "event_registrations");
    const strId = String(eventId);
    const numId = Number(eventId);
    const hasNum = !Number.isNaN(numId) && String(numId) === strId;

    const snapshot = await getDocs(query(regRef, where("event_id", "==", strId)));
    const map = new Map<string, FirestoreRegistration>();

    for (const docSnap of snapshot.docs) {
      map.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as FirestoreRegistration);
    }

    if (hasNum) {
      try {
        const snapNum = await getDocs(query(regRef, where("event_id", "==", numId)));
        for (const docSnap of snapNum.docs) {
          map.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as FirestoreRegistration);
        }
      } catch {
        // Numeric query fallback ignored if index requires exact type
      }
    }

    const list = Array.from(map.values());
    return list.sort((a, b) => {
      const timeA = new Date(a.registered_at || 0).getTime();
      const timeB = new Date(b.registered_at || 0).getTime();
      return timeB - timeA;
    });
  } catch (error) {
    console.error(`[Firestore] getEventRegistrations error for ${eventId}:`, error);
    return [];
  }
}

export function subscribeEventRegistrations(
  eventId: string,
  callback: (registrations: FirestoreRegistration[]) => void,
  onError?: (error: Error) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {
      // No-op on server
    };
  }

  try {
    const regRef = collection(db, "event_registrations");
    const strId = String(eventId);
    const numId = Number(eventId);
    const hasNum = !Number.isNaN(numId) && String(numId) === strId;

    const q = hasNum
      ? query(regRef, where("event_id", "in", [strId, numId]))
      : query(regRef, where("event_id", "==", strId));

    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as FirestoreRegistration[];

        list.sort((a, b) => {
          const timeA = new Date(a.registered_at || 0).getTime();
          const timeB = new Date(b.registered_at || 0).getTime();
          return timeB - timeA;
        });

        callback(list);
      },
      (error) => {
        console.warn(`[Firestore] subscribeEventRegistrations error for ${eventId}:`, error);
        onError?.(error);
      },
    );
  } catch (err) {
    console.warn(`[Firestore] Failed to subscribe to event registrations for ${eventId}:`, err);
    return () => {
      // No-op on error
    };
  }
}

export async function getMemberRegistrations(
  memberId?: string,
  memberEmail?: string,
): Promise<FirestoreRegistration[]> {
  if (typeof window === "undefined") return [];
  try {
    const regRef = collection(db, "event_registrations");
    let registrations: FirestoreRegistration[] = [];

    if (memberEmail) {
      const normalizedEmail = memberEmail.trim().toLowerCase();
      const q = query(regRef, where("member_email", "==", normalizedEmail));
      const snapshot = await getDocs(q);
      registrations = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as FirestoreRegistration[];
    } else if (memberId) {
      const q = query(regRef, where("member_id", "==", memberId));
      const snapshot = await getDocs(q);
      registrations = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as FirestoreRegistration[];
    }

    return registrations.sort((a, b) => {
      const timeA = new Date(a.registered_at || 0).getTime();
      const timeB = new Date(b.registered_at || 0).getTime();
      return timeB - timeA;
    });
  } catch (error) {
    console.error("[Firestore] getMemberRegistrations error:", error);
    return [];
  }
}

export async function checkExistingRegistration(
  eventId: string,
  memberId?: string,
  memberEmail?: string,
): Promise<FirestoreRegistration | null> {
  if (typeof window === "undefined") return null;
  try {
    const normalizedEmail = (memberEmail ?? "").trim().toLowerCase();
    const eventIdStr = String(eventId);
    const regRef = collection(db, "event_registrations");

    // 1. Check direct doc ID: `${eventIdStr}_${memberId}`
    if (memberId) {
      const docId = `${eventIdStr}_${memberId}`;
      const directDoc = await getDoc(doc(db, "event_registrations", docId));
      if (directDoc.exists()) {
        return { id: directDoc.id, ...directDoc.data() } as FirestoreRegistration;
      }
    }

    // 2. Query scoped directly to the caller's member ID (avoids listing all event attendees)
    if (memberId) {
      const memberQuery = query(
        regRef,
        where("event_id", "==", eventIdStr),
        where("member_id", "==", String(memberId)),
      );
      const snap = await getDocs(memberQuery);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as FirestoreRegistration;
      }
    }

    // 3. Fallback scoped query by verified email
    if (normalizedEmail) {
      const emailQuery = query(
        regRef,
        where("event_id", "==", eventIdStr),
        where("member_email", "==", normalizedEmail),
      );
      const snap = await getDocs(emailQuery);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as FirestoreRegistration;
      }
    }

    return null;
  } catch (error) {
    console.warn("[Firestore] checkExistingRegistration error:", error);
    return null;
  }
}

export async function registerMemberForEvent(registration: Omit<FirestoreRegistration, "id">): Promise<string> {
  if (typeof window === "undefined") throw new Error("Registration must be performed from client");
  if (!registration.member_id || !registration.member_email.trim()) {
    throw new Error("You must join the community by signing in with Google before registering.");
  }
  const normalizedEmail = registration.member_email.trim().toLowerCase();
  const eventIdStr = String(registration.event_id);

  // 1. Check if member / email already registered for this event
  const existing = await checkExistingRegistration(eventIdStr, registration.member_id, normalizedEmail);
  if (existing) {
    throw new Error(`Email ${normalizedEmail} is already registered for this event.`);
  }

  // 2. Fetch event document to validate session capacity and evaluate curation mode
  let eventData: FirestoreEvent | null = null;
  const eventRef = doc(db, "events", eventIdStr);
  try {
    const eventSnap = await getDoc(eventRef);
    if (eventSnap.exists()) {
      eventData = eventSnap.data() as FirestoreEvent;
    }
  } catch (eventErr) {
    console.warn("[Firestore] Could not load event document in registerMemberForEvent:", eventErr);
  }

  // Validate session capacity if session_id is provided
  if (registration.session_id && eventData) {
    const matchingSession = eventData.sessions?.find((s) => s.id === registration.session_id);
    if (matchingSession && matchingSession.capacity > 0) {
      const currentCount = matchingSession.total_registered || 0;
      if (currentCount >= matchingSession.capacity) {
        throw new Error(
          `The session "${matchingSession.title}" has reached its maximum capacity (${matchingSession.capacity} attendees). Please select an alternate session.`,
        );
      }
    }
  }

  // 3. Enforce default registration status:
  // When anyone registers on the first time, their default status in the dashboard is "pending" (Pending Review).
  const resolvedStatus: RegistrationStatus = "pending";

  const regId = `${eventIdStr}_${registration.member_id}`;
  const docRef = doc(db, "event_registrations", regId);

  // Include session_id and session_title inside answers for backward compatibility
  const updatedAnswers = {
    ...(registration.answers ?? {}),
    ...(registration.session_id ? { session_id: registration.session_id } : {}),
    ...(registration.session_title ? { session_title: registration.session_title } : {}),
  };

  const cleanPayload = sanitizeFirestoreData<FirestoreRegistration>({
    ...registration,
    status: resolvedStatus,
    answers: updatedAnswers,
    event_id: eventIdStr,
    member_email: normalizedEmail,
    id: regId,
  });

  await setDoc(docRef, cleanPayload, { merge: true });

  // Update event registration counter & session total if available
  try {
    if (eventData) {
      const currentCount = typeof eventData.total_registrations === "number" ? eventData.total_registrations : 0;

      const updateData: Record<string, unknown> = {
        total_registrations: currentCount + 1,
        updated_at: new Date().toISOString(),
      };

      if (registration.session_id && Array.isArray(eventData.sessions)) {
        const updatedSessions = eventData.sessions.map((sess) => {
          if (sess.id === registration.session_id) {
            return {
              ...sess,
              total_registered: (sess.total_registered ?? 0) + 1,
            };
          }
          return sess;
        });
        updateData.sessions = updatedSessions;
      }

      if (registration.ticket_id && Array.isArray(eventData.tickets)) {
        const updatedTickets = eventData.tickets.map((t) => {
          if (t.id === registration.ticket_id) {
            return {
              ...t,
              total_registered: (t.total_registered ?? 0) + 1,
            };
          }
          return t;
        });
        updateData.tickets = updatedTickets;
      }

      await updateDoc(eventRef, sanitizeFirestoreData(updateData));
    }
  } catch (err) {
    console.warn("[Firestore] Failed to update event registration / session counters:", err);
  }

  return regId;
}

export async function getEventSessionRegistrationCounts(eventId: string): Promise<Record<string, number>> {
  if (typeof window === "undefined") return {};
  try {
    const registrations = await getEventRegistrations(eventId);
    const counts: Record<string, number> = {};
    for (const reg of registrations) {
      if (reg.status === "rejected") continue;
      const sId = reg.session_id ?? (reg.answers?.session_id as string | undefined);
      if (sId) {
        counts[sId] = (counts[sId] ?? 0) + 1;
      }
    }
    return counts;
  } catch (error) {
    console.warn("[Firestore] getEventSessionRegistrationCounts error:", error);
    return {};
  }
}

export async function updateRegistrationStatus(
  registrationId: string,
  eventId: string,
  status: RegistrationStatus,
  reviewer?: { id: string; name: string; email?: string },
  notes?: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "event_registrations", registrationId);
  const now = new Date().toISOString();

  let previousStatus: RegistrationStatus | undefined;
  let memberName = "";
  let memberEmail = "";
  let eventTitle = "";
  let existingLogs: RegistrationStatusLog[] = [];

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as FirestoreRegistration;
      previousStatus = data.status;
      memberName = data.member_name || "";
      memberEmail = data.member_email || "";
      eventTitle = data.event_title || "";
      existingLogs = Array.isArray(data.status_logs) ? data.status_logs : [];
    }
  } catch (readErr) {
    console.warn("[updateRegistrationStatus] Failed to read existing registration for audit log:", readErr);
  }

  const logEntry: RegistrationStatusLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status,
    previous_status: previousStatus,
    changed_at: now,
    changed_by_id: reviewer?.id ?? "unknown",
    changed_by_name: reviewer?.name ?? "Organizer",
    changed_by_email: reviewer?.email,
    notes,
  };

  const updatedLogs = [...existingLogs, logEntry];

  const isPending = status === "pending";

  const updatePayload = sanitizeFirestoreData<Record<string, unknown>>({
    status,
    ...(isPending
      ? {
          reviewed_at: deleteField(),
          reviewed_by_id: deleteField(),
          reviewed_by_name: deleteField(),
          reviewed_by_email: deleteField(),
        }
      : {
          reviewed_at: now,
          ...(reviewer
            ? {
                reviewed_by_id: reviewer.id,
                reviewed_by_name: reviewer.name,
                ...(reviewer.email ? { reviewed_by_email: reviewer.email } : { reviewed_by_email: deleteField() }),
              }
            : {}),
        }),
    ...(notes !== undefined ? { notes } : {}),
    status_logs: updatedLogs,
    updated_at: now,
  });

  await updateDoc(docRef, updatePayload);

  // Dedicated audit_logs collection entry
  try {
    const auditEntry: AuditLogEntry = {
      action: "registration_status_change",
      entity_type: "registration",
      entity_id: registrationId,
      event_id: eventId,
      event_title: eventTitle,
      member_name: memberName,
      member_email: memberEmail,
      actor_id: reviewer?.id ?? "unknown",
      actor_name: reviewer?.name ?? "Organizer",
      actor_email: reviewer?.email,
      previous_value: previousStatus,
      new_value: status,
      notes,
      timestamp: now,
    };
    await addDoc(collection(db, "audit_logs"), sanitizeFirestoreData(auditEntry));
    console.log(
      `[Organizer Review Audit] Organizer ${reviewer?.name ?? "Organizer"} (${reviewer?.email ?? "unknown"}) updated registration ${registrationId} (${memberName}) to ${status}.`,
    );
  } catch (auditErr) {
    console.warn("[updateRegistrationStatus] Failed to write audit log entry:", auditErr);
  }

  // If approved or rejected, update event approved counter
  try {
    const allRegs = await getEventRegistrations(eventId);
    const approvedCount = allRegs.filter((r) => r.status === "approved" || r.status === "attended").length;
    const eventRef = doc(db, "events", eventId);
    await updateDoc(eventRef, {
      total_approved: approvedCount,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[Firestore] Failed to recalculate approved counter:", err);
  }
}

/**
 * Updates answers and session for an existing pending registration.
 */
export async function updateRegistrationAnswers(
  registrationId: string,
  eventId: string,
  data: {
    answers: Record<string, unknown>;
    session_id?: string;
    session_title?: string;
  },
): Promise<void> {
  if (typeof window === "undefined") return;

  const docRef = doc(db, "event_registrations", registrationId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error("Registration record not found.");
  }

  const existing = snap.data() as FirestoreRegistration;
  if (existing.status === "approved" || existing.status === "attended") {
    throw new Error("Cannot edit application because it has already been accepted.");
  }
  if (existing.status === "rejected") {
    throw new Error("Cannot edit application because it has already been rejected.");
  }

  const oldSessionId = existing.session_id;
  const newSessionId = data.session_id;

  // Validate session capacity if session changed
  if (newSessionId && newSessionId !== oldSessionId) {
    try {
      const eventRef = doc(db, "events", String(eventId));
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        const eventData = eventSnap.data() as FirestoreEvent;
        const matchingSession = eventData.sessions?.find((s) => s.id === newSessionId);
        if (matchingSession && matchingSession.capacity > 0) {
          const currentCount = matchingSession.total_registered || 0;
          if (currentCount >= matchingSession.capacity) {
            throw new Error(
              `The session "${matchingSession.title}" has reached its maximum capacity (${matchingSession.capacity} attendees). Please select an alternate session.`,
            );
          }
        }
      }
    } catch (sessionErr) {
      if (sessionErr instanceof Error && sessionErr.message.includes("maximum capacity")) {
        throw sessionErr;
      }
    }
  }

  const updatedAnswers = {
    ...data.answers,
    ...(data.session_id ? { session_id: data.session_id } : {}),
    ...(data.session_title ? { session_title: data.session_title } : {}),
  };

  const updatePayload = sanitizeFirestoreData<Partial<FirestoreRegistration>>({
    answers: updatedAnswers,
    session_id: data.session_id ? data.session_id : null,
    session_title: data.session_title ? data.session_title : null,
  });

  await updateDoc(docRef, updatePayload);

  // If session changed, adjust session counters on event doc
  if (oldSessionId !== newSessionId) {
    try {
      const eventRef = doc(db, "events", String(eventId));
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        const eventData = eventSnap.data() as FirestoreEvent;
        if (eventData.sessions) {
          const updatedSessions = eventData.sessions.map((sess) => {
            if (oldSessionId && sess.id === oldSessionId) {
              return { ...sess, total_registered: Math.max(0, (sess.total_registered || 1) - 1) };
            }
            if (newSessionId && sess.id === newSessionId) {
              return { ...sess, total_registered: (sess.total_registered || 0) + 1 };
            }
            return sess;
          });
          await updateDoc(eventRef, {
            sessions: updatedSessions,
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (countErr) {
      console.warn("[Firestore] Failed to update session counter on session change:", countErr);
    }
  }
}

export async function updateRegistrationCheckIn(
  registrationId: string,
  eventId: string,
  isCheckedIn: boolean,
  bevyAttendeeId?: number | null,
  checkinDate?: string | null,
): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "event_registrations", registrationId);
  const now = new Date().toISOString();
  const updatePayload = sanitizeFirestoreData<Partial<FirestoreRegistration>>({
    is_checked_in: isCheckedIn,
    checked_in_at: isCheckedIn ? (checkinDate ?? now) : undefined,
    ...(bevyAttendeeId !== undefined ? { bevy_attendee_id: bevyAttendeeId } : {}),
    ...(checkinDate !== undefined ? { checkin_date: checkinDate } : {}),
  });

  await updateDoc(docRef, updatePayload);

  // Update event checked-in counter
  try {
    const allRegs = await getEventRegistrations(eventId);
    const checkedInCount = allRegs.filter((r) => Boolean(r.is_checked_in)).length;
    const eventRef = doc(db, "events", eventId);
    await updateDoc(eventRef, {
      total_checked_in: checkedInCount,
      updated_at: now,
    });
  } catch (err) {
    console.warn("[Firestore] Failed to recalculate checked-in counter:", err);
  }
}

/**
 * Permanently deletes an event registration document and recalculates event counters,
 * freeing up capacity and allowing the attendee to re-register again.
 */
export async function deleteEventRegistration(registrationId: string, eventId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "event_registrations", registrationId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    return;
  }
  const regData = snap.data() as FirestoreRegistration;

  // 1. Delete registration doc
  await deleteDoc(docRef);

  // 2. Decrement or recalculate event counters
  try {
    const eventIdStr = String(eventId);
    const eventRef = doc(db, "events", eventIdStr);
    const eventSnap = await getDoc(eventRef);
    if (eventSnap.exists()) {
      const eventData = eventSnap.data() as FirestoreEvent;
      const currentTotal = typeof eventData.total_registrations === "number" ? eventData.total_registrations : 1;
      const now = new Date().toISOString();

      const allRegs = await getEventRegistrations(eventIdStr);
      const approvedCount = allRegs.filter((r) => r.status === "approved" || r.status === "attended").length;
      const checkedInCount = allRegs.filter((r) => Boolean(r.is_checked_in)).length;

      const updateData: Record<string, unknown> = {
        total_registrations: Math.max(0, currentTotal - 1),
        total_approved: approvedCount,
        total_checked_in: checkedInCount,
        updated_at: now,
      };

      const sessionId = regData.session_id ?? (regData.answers?.session_id as string | undefined);
      if (sessionId && Array.isArray(eventData.sessions)) {
        updateData.sessions = eventData.sessions.map((sess) => {
          if (sess.id === sessionId) {
            return {
              ...sess,
              total_registered: Math.max(0, (sess.total_registered || 1) - 1),
            };
          }
          return sess;
        });
      }

      if (regData.ticket_id && Array.isArray(eventData.tickets)) {
        updateData.tickets = eventData.tickets.map((t) => {
          if (t.id === regData.ticket_id) {
            return {
              ...t,
              total_registered: Math.max(0, (t.total_registered || 1) - 1),
            };
          }
          return t;
        });
      }

      await updateDoc(eventRef, sanitizeFirestoreData(updateData));
    }
  } catch (err) {
    console.warn("[Firestore] Failed to update event counters on registration deletion:", err);
  }
}

/**
 * Permanently deletes multiple event registration documents in batch and recalculates event counters.
 */
export async function deleteBatchEventRegistrations(registrationIds: string[], eventId: string): Promise<void> {
  if (typeof window === "undefined" || registrationIds.length === 0) return;

  const batch = writeBatch(db);
  const regsToDelete: FirestoreRegistration[] = [];

  for (const regId of registrationIds) {
    const regRef = doc(db, "event_registrations", regId);
    const snap = await getDoc(regRef);
    if (snap.exists()) {
      regsToDelete.push(snap.data() as FirestoreRegistration);
      batch.delete(regRef);
    }
  }

  if (regsToDelete.length === 0) return;

  await batch.commit();

  // Recalculate event counters
  try {
    const eventIdStr = String(eventId);
    const eventRef = doc(db, "events", eventIdStr);
    const eventSnap = await getDoc(eventRef);
    if (eventSnap.exists()) {
      const eventData = eventSnap.data() as FirestoreEvent;
      const currentTotal =
        typeof eventData.total_registrations === "number" ? eventData.total_registrations : regsToDelete.length;
      const now = new Date().toISOString();

      const allRegs = await getEventRegistrations(eventIdStr);
      const approvedCount = allRegs.filter((r) => r.status === "approved" || r.status === "attended").length;
      const checkedInCount = allRegs.filter((r) => Boolean(r.is_checked_in)).length;

      const updateData: Record<string, unknown> = {
        total_registrations: Math.max(0, currentTotal - regsToDelete.length),
        total_approved: approvedCount,
        total_checked_in: checkedInCount,
        updated_at: now,
      };

      if (Array.isArray(eventData.sessions)) {
        const sessionCountsToRemove = new Map<string, number>();
        for (const reg of regsToDelete) {
          const sId = reg.session_id ?? (reg.answers?.session_id as string | undefined);
          if (sId) {
            sessionCountsToRemove.set(sId, (sessionCountsToRemove.get(sId) ?? 0) + 1);
          }
        }
        if (sessionCountsToRemove.size > 0) {
          updateData.sessions = eventData.sessions.map((sess) => {
            const countToRemove = sessionCountsToRemove.get(sess.id) || 0;
            return {
              ...sess,
              total_registered: Math.max(0, (sess.total_registered || 0) - countToRemove),
            };
          });
        }
      }

      if (Array.isArray(eventData.tickets)) {
        const ticketCountsToRemove = new Map<string, number>();
        for (const reg of regsToDelete) {
          if (reg.ticket_id) {
            ticketCountsToRemove.set(reg.ticket_id, (ticketCountsToRemove.get(reg.ticket_id) ?? 0) + 1);
          }
        }
        if (ticketCountsToRemove.size > 0) {
          updateData.tickets = eventData.tickets.map((t) => {
            const countToRemove = ticketCountsToRemove.get(t.id) || 0;
            return {
              ...t,
              total_registered: Math.max(0, (t.total_registered || 0) - countToRemove),
            };
          });
        }
      }

      await updateDoc(eventRef, sanitizeFirestoreData(updateData));
    }
  } catch (err) {
    console.warn("[Firestore] Failed to update event counters on batch registration deletion:", err);
  }
}

export async function updateEventTickets(
  eventId: string,
  tickets: EventTicketTier[],
  maxTicketsPerPerson?: number | null,
): Promise<void> {
  if (typeof window === "undefined") return;
  const eventRef = doc(db, "events", String(eventId));
  const updatePayload: Record<string, unknown> = {
    tickets,
    updated_at: new Date().toISOString(),
  };
  if (maxTicketsPerPerson !== undefined) {
    updatePayload.max_tickets_per_person = maxTicketsPerPerson;
  }
  const sanitized = sanitizeFirestoreData(updatePayload);
  await setDoc(eventRef, sanitized, { merge: true });
}

export async function updateEventMerchandise(
  eventId: string,
  merchandise: EventMerchandiseItem[],
  maxMerchandisePerPerson?: number | null,
): Promise<void> {
  if (typeof window === "undefined") return;
  const eventRef = doc(db, "events", String(eventId));
  const updatePayload: Record<string, unknown> = {
    merchandise,
    updated_at: new Date().toISOString(),
  };
  if (maxMerchandisePerPerson !== undefined) {
    updatePayload.max_merchandise_per_person = maxMerchandisePerPerson;
  }
  const sanitized = sanitizeFirestoreData(updatePayload);
  await setDoc(eventRef, sanitized, { merge: true });
}

export async function updateEventHighlightsMedia(
  eventId: string,
  data: {
    highlight_video_url?: string;
    highlight_video_title?: string;
    photo_album_url?: string;
    photo_album_title?: string;
    recap_description?: string;
    sessions?: EventSession[];
  },
): Promise<void> {
  if (typeof window === "undefined") return;
  const eventRef = doc(db, "events", String(eventId));
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.highlight_video_url !== undefined) {
    updatePayload.highlight_video_url = data.highlight_video_url.trim()
      ? data.highlight_video_url.trim()
      : deleteField();
  }
  if (data.highlight_video_title !== undefined) {
    updatePayload.highlight_video_title = data.highlight_video_title.trim()
      ? data.highlight_video_title.trim()
      : deleteField();
  }
  if (data.photo_album_url !== undefined) {
    updatePayload.photo_album_url = data.photo_album_url.trim() ? data.photo_album_url.trim() : deleteField();
  }
  if (data.photo_album_title !== undefined) {
    updatePayload.photo_album_title = data.photo_album_title.trim() ? data.photo_album_title.trim() : deleteField();
  }
  if (data.recap_description !== undefined) {
    updatePayload.recap_description = data.recap_description.trim() ? data.recap_description.trim() : deleteField();
  }
  if (data.sessions !== undefined) {
    updatePayload.sessions = data.sessions.length > 0 ? data.sessions : deleteField();
  }

  await setDoc(eventRef, updatePayload, { merge: true });
}

export async function updateEventEmailTemplates(eventId: string, emailTemplates: EventEmailTemplates): Promise<void> {
  if (typeof window === "undefined") return;
  const eventRef = doc(db, "events", String(eventId));
  const sanitized = sanitizeFirestoreData({
    email_templates: emailTemplates,
    updated_at: new Date().toISOString(),
  });
  await setDoc(eventRef, sanitized, { merge: true });
}

// ── Sync Metadata ───────────────────────────────────────────────────────────

export async function getSyncMetadata(): Promise<FirestoreSyncMetadata | null> {
  if (typeof window === "undefined") return null;
  try {
    const docRef = doc(db, "sync_metadata", "bevy");
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as FirestoreSyncMetadata;
  } catch (error) {
    console.error("[Firestore] getSyncMetadata error:", error);
    return null;
  }
}

export async function updateSyncMetadata(metadata: Partial<FirestoreSyncMetadata>): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "sync_metadata", "bevy");
  const sanitized = sanitizeFirestoreData({ ...metadata, id: "bevy" });
  await setDoc(docRef, sanitized, { merge: true });
}

// ── Content Settings (FAQ & Partnership) ────────────────────────────────────

export async function getFaqContentDoc(): Promise<FaqContent | null> {
  if (typeof window === "undefined") return null;
  try {
    const docRef = doc(db, "content_settings", "faq");
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as FaqContent;
  } catch (error) {
    console.error("[Firestore] getFaqContentDoc error:", error);
    return null;
  }
}

export async function saveFaqContentDoc(content: FaqContent): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "content_settings", "faq");
  const sanitized = sanitizeFirestoreData({
    ...content,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(docRef, sanitized, { merge: true });
}

export function subscribeFaqContentDoc(
  onUpdate: (content: FaqContent) => void,
  onError?: (error: Error) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {
      // noop in server or non-window environment
    };
  }
  const docRef = doc(db, "content_settings", "faq");
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as FaqContent);
      }
    },
    (err) => {
      console.warn("[Firestore] subscribeFaqContentDoc error:", err);
      onError?.(err);
    },
  );
}

export async function getPartnershipContentDoc(): Promise<PartnershipContent | null> {
  if (typeof window === "undefined") return null;
  try {
    const docRef = doc(db, "content_settings", "partnership");
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as PartnershipContent;
  } catch (error) {
    console.error("[Firestore] getPartnershipContentDoc error:", error);
    return null;
  }
}

export async function savePartnershipContentDoc(content: PartnershipContent): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "content_settings", "partnership");
  const sanitized = sanitizeFirestoreData({
    ...content,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(docRef, sanitized, { merge: true });
}

export function subscribePartnershipContentDoc(
  onUpdate: (content: PartnershipContent) => void,
  onError?: (error: Error) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {
      // noop in server or non-window environment
    };
  }
  const docRef = doc(db, "content_settings", "partnership");
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as PartnershipContent);
      }
    },
    (err) => {
      console.warn("[Firestore] subscribePartnershipContentDoc error:", err);
      onError?.(err);
    },
  );
}
