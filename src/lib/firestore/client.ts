import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";

import { db } from "@/config/firebase";

import type {
  FirestoreEvent,
  FirestoreMember,
  FirestoreRegistration,
  FirestoreSyncMetadata,
  RegistrationStatus,
} from "./types";

// ── Events ──────────────────────────────────────────────────────────────────

export async function getFirestoreEvents(maxResults = 100): Promise<FirestoreEvent[]> {
  try {
    const eventsRef = collection(db, "events");
    const q = query(eventsRef, orderBy("start_date", "desc"), limit(maxResults));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as FirestoreEvent[];
  } catch (error) {
    console.error("[Firestore] getFirestoreEvents error:", error);
    return [];
  }
}

export async function getFirestoreEventById(eventId: string): Promise<FirestoreEvent | null> {
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

export async function saveFirestoreEvent(event: FirestoreEvent): Promise<void> {
  const docRef = doc(db, "events", String(event.id));
  await setDoc(docRef, event, { merge: true });
}

// ── Members ─────────────────────────────────────────────────────────────────

export async function getFirestoreMembers(maxResults = 200): Promise<FirestoreMember[]> {
  try {
    const membersRef = collection(db, "members");
    const q = query(membersRef, orderBy("name", "asc"), limit(maxResults));
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

export async function saveFirestoreMember(member: FirestoreMember): Promise<void> {
  const docRef = doc(db, "members", String(member.id));
  await setDoc(docRef, member, { merge: true });
}

// ── Registrations & Filtration ──────────────────────────────────────────────

export async function getEventRegistrations(eventId: string): Promise<FirestoreRegistration[]> {
  try {
    const regRef = collection(db, "event_registrations");
    const q = query(regRef, where("event_id", "==", String(eventId)));
    const snapshot = await getDocs(q);

    const list = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as FirestoreRegistration[];

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

export async function getMemberRegistrations(
  memberId?: string,
  memberEmail?: string,
): Promise<FirestoreRegistration[]> {
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
  memberId: string,
  memberEmail: string,
): Promise<FirestoreRegistration | null> {
  try {
    const normalizedEmail = memberEmail.trim().toLowerCase();
    const regRef = collection(db, "event_registrations");

    // Check by event_id and email
    const emailQuery = query(
      regRef,
      where("event_id", "==", String(eventId)),
      where("member_email", "==", normalizedEmail),
    );
    const emailSnap = await getDocs(emailQuery);
    if (!emailSnap.empty) {
      const docSnap = emailSnap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as FirestoreRegistration;
    }

    // Also check direct document ID (${eventId}_${memberId})
    const docId = `${eventId}_${memberId}`;
    const directDoc = await getDoc(doc(db, "event_registrations", docId));
    if (directDoc.exists()) {
      return { id: directDoc.id, ...directDoc.data() } as FirestoreRegistration;
    }

    return null;
  } catch (error) {
    console.error("[Firestore] checkExistingRegistration error:", error);
    return null;
  }
}

export async function registerMemberForEvent(registration: Omit<FirestoreRegistration, "id">): Promise<string> {
  const normalizedEmail = registration.member_email.trim().toLowerCase();
  const eventIdStr = String(registration.event_id);

  // 1. Check if member / email already registered for this event
  const existing = await checkExistingRegistration(eventIdStr, registration.member_id, normalizedEmail);
  if (existing) {
    throw new Error(`Email ${normalizedEmail} is already registered for this event.`);
  }

  const regId = `${eventIdStr}_${registration.member_id}`;
  const docRef = doc(db, "event_registrations", regId);

  const cleanPayload = {
    ...registration,
    event_id: eventIdStr,
    member_email: normalizedEmail,
    id: regId,
  };

  await setDoc(docRef, cleanPayload, { merge: true });

  // Update event registration counter
  try {
    const eventRef = doc(db, "events", eventIdStr);
    const eventSnap = await getDoc(eventRef);
    if (eventSnap.exists()) {
      const currentCount = eventSnap.data()?.total_registrations || 0;
      await updateDoc(eventRef, {
        total_registrations: currentCount + 1,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("[Firestore] Failed to increment total_registrations count:", err);
  }

  return regId;
}

export async function updateRegistrationStatus(
  registrationId: string,
  eventId: string,
  status: RegistrationStatus,
  reviewer?: { id: string; name: string },
  notes?: string,
): Promise<void> {
  const docRef = doc(db, "event_registrations", registrationId);
  const updatePayload: Partial<FirestoreRegistration> = {
    status,
    reviewed_at: new Date().toISOString(),
    ...(reviewer ? { reviewed_by_id: reviewer.id, reviewed_by_name: reviewer.name } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };

  await updateDoc(docRef, updatePayload);

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

// ── Sync Metadata ───────────────────────────────────────────────────────────

export async function getSyncMetadata(): Promise<FirestoreSyncMetadata | null> {
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
  const docRef = doc(db, "sync_metadata", "bevy");
  await setDoc(docRef, { ...metadata, id: "bevy" }, { merge: true });
}
