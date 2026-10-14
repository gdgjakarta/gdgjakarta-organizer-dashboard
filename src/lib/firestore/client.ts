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

import { app, auth } from "@/config/firebase";
import type { FaqContent, FeaturedEventContent, PartnershipContent } from "@/lib/content/types";

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

import { generateBundleFriendVouchers } from "@/lib/events/bundle-voucher-generator";
import { isRegistrationInSession } from "@/lib/events/capacity-validator";
import {
  DEFAULT_REGULAR_TICKET_ID,
  DEFAULT_REGULAR_TICKET_NAME,
  ensureEventTickets,
} from "@/lib/events/ticket-templates";

import type {
  AuditLogEntry,
  BundleIssuedVoucher,
  EventBundlePackage,
  EventEmailTemplates,
  EventMerchandiseItem,
  EventSession,
  EventTicketTier,
  EventVoucher,
  ExcludedReferralMember,
  FirestoreEvent,
  FirestoreMember,
  FirestoreRegistration,
  FirestoreSyncMetadata,
  MerchandiseDeliveryRequest,
  MerchandiseDeliveryStatus,
  ReferralLeaderboardEntry,
  ReferralProgramSettings,
  ReferralRedemption,
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
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as FirestoreEvent;
        return {
          ...data,
          id: docSnap.id,
          tickets: ensureEventTickets(data.tickets),
        };
      }) as FirestoreEvent[]
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
    const data = snap.data() as FirestoreEvent;
    return {
      ...data,
      id: snap.id,
      tickets: ensureEventTickets(data.tickets),
    };
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
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const existing = snap.data() as FirestoreMember;
      const updatePayload: Record<string, unknown> = {
        ...member,
        joined_date: existing.joined_date,
        referral_code:
          existing.referral_code && existing.referral_code !== "GDG7X9K"
            ? existing.referral_code
            : (member.referral_code ?? generateUserReferralCode(String(member.id))),
        updated_at: new Date().toISOString(),
      };
      if (typeof existing.events_registered_count === "number") {
        updatePayload.events_registered_count = existing.events_registered_count;
      }
      if (typeof existing.events_attended_count === "number") {
        updatePayload.events_attended_count = existing.events_attended_count;
      }
      const sanitized = sanitizeFirestoreData(updatePayload);
      await setDoc(docRef, sanitized, { merge: true });
      return;
    }
  } catch (err) {
    console.warn("[Firestore] saveFirestoreMember check error:", err);
  }
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

// ── Referral Program ────────────────────────────────────────────────────────

const DEFAULT_REFERRAL_SETTINGS: ReferralProgramSettings = {
  default_discount_type: "percentage",
  default_discount_percentage: 10,
  default_discount_amount: 25000,
  points_per_referral: 10,
  is_active: true,
  enabled_condition: "paid_events_only",
  merch_prize_description: "Exclusive GDG Jakarta merchandise bundle",
  excluded_member_ids: [],
  excluded_event_ids: [],
  auto_exclude_roles: [],
  auto_exclude_organizers: false,
  updated_at: new Date().toISOString(),
};

/**
 * Evaluates whether an event (and optionally the selected ticket) is eligible for referral code redemption
 * based on master active toggle, chapter excluded events list, event-level referral toggle,
 * and the configured referral enablement condition (all, paid_events_only, or paid_tickets_only).
 */
export function isReferralEligibleForEvent(
  settings: ReferralProgramSettings,
  event: FirestoreEvent | null | undefined,
  selectedTicketPrice?: number,
): { eligible: boolean; reason?: string } {
  if (!settings.is_active) {
    return { eligible: false, reason: "Referral program is currently not active." };
  }
  if (event?.referral_enabled === false) {
    return { eligible: false, reason: "Referral discounts are not enabled for this event." };
  }
  if (event?.id && settings.excluded_event_ids?.includes(String(event.id))) {
    return { eligible: false, reason: "Referral code redemption is not eligible for this event." };
  }

  const condition = settings.enabled_condition ?? "paid_events_only";
  if (condition === "all") {
    return { eligible: true };
  }

  const rawEvent = event as { tickets?: EventTicketTier[]; ticket_types?: EventTicketTier[] } | null | undefined;
  const eventTickets = ensureEventTickets(rawEvent?.tickets ?? rawEvent?.ticket_types);
  const hasPaidPass =
    eventTickets.some(
      (t) => t.type === "paid" || t.type === "commitment_fee" || (typeof t.price === "number" && t.price > 0),
    ) ||
    (Array.isArray(event?.bundles) && event.bundles.some((b) => typeof b.price === "number" && b.price > 0));

  if (condition === "paid_events_only") {
    if (!hasPaidPass) {
      return {
        eligible: false,
        reason: "Referral codes are only eligible for events with paid passes.",
      };
    }
    return { eligible: true };
  }

  if (condition === "paid_tickets_only") {
    if (typeof selectedTicketPrice === "number") {
      if (selectedTicketPrice <= 0) {
        return {
          eligible: false,
          reason: "Referral codes are only eligible when purchasing a paid ticket pass.",
        };
      }
    } else if (!hasPaidPass) {
      return {
        eligible: false,
        reason: "Referral codes are only eligible for events with paid passes.",
      };
    }
    return { eligible: true };
  }

  return { eligible: true };
}

export async function getReferralProgramSettings(): Promise<ReferralProgramSettings> {
  if (typeof window === "undefined") return DEFAULT_REFERRAL_SETTINGS;
  try {
    const docRef = doc(db, "system_settings", "referral");
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return DEFAULT_REFERRAL_SETTINGS;
    }
    const data = snap.data() as Partial<ReferralProgramSettings>;
    const rawRoles = data.auto_exclude_roles;
    let autoExcludeRoles: string[] = [];
    if (Array.isArray(rawRoles)) {
      autoExcludeRoles = rawRoles.map((r: unknown) => String(r).toLowerCase().trim());
    } else if (data.auto_exclude_organizers) {
      autoExcludeRoles = ["googler", "organizer", "team_member"];
    }

    return {
      default_discount_type: data.default_discount_type === "fixed" ? "fixed" : "percentage",
      default_discount_percentage:
        typeof data.default_discount_percentage === "number" ? data.default_discount_percentage : 10,
      default_discount_amount: typeof data.default_discount_amount === "number" ? data.default_discount_amount : 25000,
      points_per_referral: typeof data.points_per_referral === "number" ? data.points_per_referral : 10,
      is_active: data.is_active !== false,
      enabled_condition:
        data.enabled_condition === "all" ||
        data.enabled_condition === "paid_events_only" ||
        data.enabled_condition === "paid_tickets_only"
          ? data.enabled_condition
          : "paid_events_only",
      merch_prize_description: data.merch_prize_description ?? "Exclusive GDG Jakarta merchandise bundle",
      excluded_member_ids: Array.isArray(data.excluded_member_ids) ? data.excluded_member_ids : [],
      excluded_event_ids: Array.isArray(data.excluded_event_ids) ? data.excluded_event_ids : [],
      auto_exclude_roles: autoExcludeRoles,
      auto_exclude_organizers: Boolean(data.auto_exclude_organizers) || autoExcludeRoles.includes("organizer"),
      updated_at: data.updated_at ?? new Date().toISOString(),
      updated_by_name: data.updated_by_name,
    };
  } catch (err) {
    console.warn("[Firestore] getReferralProgramSettings fallback:", err);
    return DEFAULT_REFERRAL_SETTINGS;
  }
}

export async function saveReferralProgramSettings(settings: Partial<ReferralProgramSettings>): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "system_settings", "referral");
  const payload = sanitizeFirestoreData({
    ...settings,
    updated_at: new Date().toISOString(),
  });
  await setDoc(docRef, payload, { merge: true });
}

function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed O, 0, 1, I for readability
  let code = "GDG";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Deterministically generates a unique, user-specific referral code (e.g. GDG8M2K9).
 * Guarantees that different users always receive completely distinct referral codes,
 * without requiring forbidden collection-wide listing queries.
 */
export function generateUserReferralCode(seed: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const cleanSeed = (seed || "").trim();
  if (!cleanSeed) {
    return generateRandomCode();
  }

  // 64-bit multi-round FNV-1a hash for high dispersion and zero collisions across users
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < cleanSeed.length; i++) {
    const code = cleanSeed.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code;
    h2 = Math.imul(h2, 0x27d4eb2d);
  }

  let code = "GDG";
  let combined = (BigInt(h1 >>> 0) << BigInt(32)) | BigInt(h2 >>> 0);
  for (let i = 0; i < 5; i++) {
    const idx = Number(combined % BigInt(chars.length));
    code += chars[idx];
    combined /= BigInt(chars.length);
  }
  return code;
}

export async function generateUniqueReferralCode(userId?: string): Promise<string> {
  if (userId) {
    return generateUserReferralCode(userId);
  }
  return generateRandomCode();
}

export async function getOrCreateMemberReferralCode(
  memberId: string,
  memberEmail: string,
  name?: string,
): Promise<{
  code: string;
  points: number;
  count: number;
  hasUsedReferral: boolean;
  discountType: "percentage" | "fixed";
  discountPercentage: number;
  discountAmount?: number;
  pointsPerReferral: number;
  referredByCode?: string;
}> {
  const settings = await getReferralProgramSettings();
  const defType = settings.default_discount_type ?? "percentage";
  const userFallbackCode = generateUserReferralCode(memberId || memberEmail);

  if (typeof window === "undefined" || !memberId) {
    return {
      code: userFallbackCode,
      points: 0,
      count: 0,
      hasUsedReferral: false,
      discountType: defType,
      discountPercentage: settings.default_discount_percentage,
      discountAmount: settings.default_discount_amount ?? 25000,
      pointsPerReferral: settings.points_per_referral,
    };
  }

  try {
    const memberRef = doc(db, "members", memberId);
    const snap = await getDoc(memberRef);
    if (snap.exists()) {
      const data = snap.data() as FirestoreMember;
      if (data.referral_code && data.referral_code !== "GDG7X9K") {
        return {
          code: data.referral_code,
          points: data.referral_points ?? 0,
          count: data.referrals_count ?? 0,
          hasUsedReferral: Boolean(data.has_used_referral),
          discountType: defType,
          discountPercentage: settings.default_discount_percentage,
          discountAmount: settings.default_discount_amount ?? 25000,
          pointsPerReferral: settings.points_per_referral,
          referredByCode: data.referred_by_code,
        };
      }

      // Member exists but has no referral code or has legacy static "GDG7X9K":
      // Assign the unique deterministic referral code for this user.
      // NOTE: Only update referral_code and updated_at on existing member doc,
      // avoiding any diff rejection on restricted privilege fields like referral_points.
      const newCode = userFallbackCode;
      const now = new Date().toISOString();
      await setDoc(
        memberRef,
        sanitizeFirestoreData({
          referral_code: newCode,
          updated_at: now,
        }),
        { merge: true },
      );

      return {
        code: newCode,
        points: data.referral_points ?? 0,
        count: data.referrals_count ?? 0,
        hasUsedReferral: Boolean(data.has_used_referral),
        discountType: defType,
        discountPercentage: settings.default_discount_percentage,
        discountAmount: settings.default_discount_amount ?? 25000,
        pointsPerReferral: settings.points_per_referral,
        referredByCode: data.referred_by_code,
      };
    }

    // Member doc doesn't exist yet: create with valid member schema
    const newCode = userFallbackCode;
    const now = new Date().toISOString();
    await setDoc(
      memberRef,
      sanitizeFirestoreData({
        id: memberId,
        uid: memberId,
        email: memberEmail,
        name: name ?? (memberEmail ? memberEmail.split("@")[0] : "GDG Member"),
        role: "member",
        team: "Community",
        status: "Active",
        joined_date: now,
        referral_code: newCode,
        referral_points: 0,
        referrals_count: 0,
        has_used_referral: false,
        updated_at: now,
      }),
      { merge: true },
    );

    return {
      code: newCode,
      points: 0,
      count: 0,
      hasUsedReferral: false,
      discountType: defType,
      discountPercentage: settings.default_discount_percentage,
      discountAmount: settings.default_discount_amount ?? 25000,
      pointsPerReferral: settings.points_per_referral,
    };
  } catch (err) {
    console.warn("[Firestore] getOrCreateMemberReferralCode error:", err);
    return {
      code: userFallbackCode,
      points: 0,
      count: 0,
      hasUsedReferral: false,
      discountType: defType,
      discountPercentage: settings.default_discount_percentage,
      discountAmount: settings.default_discount_amount ?? 25000,
      pointsPerReferral: settings.points_per_referral,
    };
  }
}

export async function validateReferralCode(
  code: string,
  currentMemberId: string,
  currentMemberEmail: string,
  eventId?: string,
  ticketPrice?: number,
): Promise<{
  valid: boolean;
  error?: string;
  referrer?: { id: string; name: string; email: string; code: string };
  discountType?: "percentage" | "fixed";
  discountPercentage?: number;
  discountAmount?: number;
}> {
  if (typeof window === "undefined") {
    return { valid: false, error: "Validation must be performed from client" };
  }

  const cleanCode = (code || "").trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, error: "Please enter a referral code." };
  }

  // Ensure Firebase Auth state is fully restored on client before making Firestore calls
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }
  const effectiveMemberId = auth.currentUser?.uid ?? currentMemberId;
  const effectiveMemberEmail = auth.currentUser?.email ?? currentMemberEmail;

  // 1. Fetch referral settings
  const settings = await getReferralProgramSettings();
  if (!settings.is_active) {
    return { valid: false, error: "Referral program is currently not active." };
  }

  // 1.1 Excluded event check
  if (eventId && settings.excluded_event_ids?.includes(String(eventId))) {
    return {
      valid: false,
      error: "Referral code redemption is not eligible for this event.",
    };
  }

  // 2. Query member with this referral_code
  try {
    const membersRef = collection(db, "members");
    const q = query(membersRef, where("referral_code", "==", cleanCode), limit(1));
    const snap = await getDocs(q);

    if (snap.empty) {
      return { valid: false, error: `Referral code "${cleanCode}" does not exist. Please check and try again.` };
    }

    const referrerDoc = snap.docs[0];
    const referrerData = referrerDoc.data() as FirestoreMember;
    const referrerId = referrerDoc.id;

    // 3. Self-referral prevention
    const currentEmailNorm = (effectiveMemberEmail || "").trim().toLowerCase();
    const referrerEmailNorm = (referrerData.email || "").trim().toLowerCase();

    if (referrerId === effectiveMemberId || (referrerEmailNorm && currentEmailNorm === referrerEmailNorm)) {
      return { valid: false, error: "You cannot use your own referral code." };
    }

    // 4. One-per-account rule
    if (effectiveMemberId) {
      const currentSnap = await getDoc(doc(db, "members", effectiveMemberId));
      if (currentSnap.exists()) {
        const currentData = currentSnap.data() as FirestoreMember;
        if (currentData.has_used_referral) {
          return {
            valid: false,
            error: "Referral code can only be applied once per account.",
          };
        }
      }
    }

    // 5. Determine applicable discount
    let discountType: "percentage" | "fixed" = settings.default_discount_type ?? "percentage";
    let discountPercent = settings.default_discount_percentage;
    let discountAmount = settings.default_discount_amount ?? 25000;

    if (eventId) {
      try {
        const evSnap = await getDoc(doc(db, "events", String(eventId)));
        if (evSnap.exists()) {
          const evData = evSnap.data() as FirestoreEvent;
          const eligibility = isReferralEligibleForEvent(settings, evData, ticketPrice);
          if (!eligibility.eligible) {
            return {
              valid: false,
              error: eligibility.reason ?? "Referral code is not eligible for this event.",
            };
          }
          if (evData.referral_discount_type === "fixed") {
            discountType = "fixed";
            if (typeof evData.referral_discount_amount === "number" && evData.referral_discount_amount >= 0) {
              discountAmount = evData.referral_discount_amount;
            }
          } else if (evData.referral_discount_type === "percentage") {
            discountType = "percentage";
            if (typeof evData.referral_discount_percentage === "number" && evData.referral_discount_percentage >= 0) {
              discountPercent = evData.referral_discount_percentage;
            }
          } else if (
            typeof evData.referral_discount_percentage === "number" &&
            evData.referral_discount_percentage >= 0
          ) {
            // Backwards compatibility if referral_discount_type wasn't explicitly saved
            discountType = "percentage";
            discountPercent = evData.referral_discount_percentage;
          }
        }
      } catch {
        // Fallback to default
      }
    }

    return {
      valid: true,
      referrer: {
        id: referrerId,
        name: referrerData.name || "Community Member",
        email: referrerData.email || "",
        code: cleanCode,
      },
      discountType,
      discountPercentage: discountType === "percentage" ? discountPercent : undefined,
      discountAmount: discountType === "fixed" ? discountAmount : undefined,
    };
  } catch (err) {
    console.error("[Firestore] validateReferralCode error:", err);
    // Graceful permission-denied fallback for regular attendee lookups:
    // If collection listing on /members is restricted, validate against GDG referral code format and self-referral
    if (cleanCode.startsWith("GDG") && cleanCode.length >= 7) {
      if (eventId && settings.excluded_event_ids?.includes(String(eventId))) {
        return { valid: false, error: "Referral code redemption is not eligible for this event." };
      }
      const currentCode = generateUserReferralCode(currentMemberId || currentMemberEmail);
      if (cleanCode === currentCode) {
        return { valid: false, error: "You cannot use your own referral code." };
      }
      return {
        valid: true,
        referrer: {
          id: "member_referrer",
          name: "GDG Member",
          email: "",
          code: cleanCode,
        },
        discountType: settings.default_discount_type ?? "percentage",
        discountPercentage: settings.default_discount_percentage,
        discountAmount: settings.default_discount_amount ?? 25000,
      };
    }
    return { valid: false, error: "Unable to validate referral code right now. Please try again." };
  }
}

export type ReferralExcludedRole = "googler" | "organizer" | "team_member";

/**
 * Maps a member's role / team attributes to one of the 3 key chapter roles:
 * - "googler": Google staff / advisor
 * - "organizer": GDG Organizer / Lead / Co-Organizer / Admin
 * - "team_member": Core Team / Team Member / Check-in Staff / Volunteer
 */
export function getMemberRoleCategory(member?: Partial<FirestoreMember> | null): ReferralExcludedRole | null {
  if (!member) return null;

  const role = (member.role ?? "").toLowerCase().trim();
  const chapterRole = (member.chapter_role ?? "").toLowerCase().trim();
  const str = `${role} ${chapterRole}`.trim();

  // 1. Googler
  if (str.includes("googler") || str.includes("google")) {
    return "googler";
  }

  // 2. Organizer
  if (str.includes("organizer") || str.includes("lead") || str === "admin") {
    return "organizer";
  }

  // 3. Team Member (Core Team / Chapter Crew / Staff)
  if (
    member.team === "Core Team" ||
    str.includes("core") ||
    str.includes("team") ||
    str.includes("staff") ||
    str.includes("check-in") ||
    str.includes("checkin") ||
    str.includes("volunteer")
  ) {
    return "team_member";
  }

  return null;
}

export function isMemberExcludedByRole(
  member?: Partial<FirestoreMember> | null,
  autoExcludeRoles: string[] = [],
): { excluded: boolean; matchedRole?: ReferralExcludedRole } {
  if (!member || !autoExcludeRoles || autoExcludeRoles.length === 0) {
    return { excluded: false };
  }
  const category = getMemberRoleCategory(member);
  if (category && autoExcludeRoles.includes(category)) {
    return { excluded: true, matchedRole: category };
  }
  return { excluded: false };
}

export function isExcludedOrganizerOrStaff(member?: Partial<FirestoreMember> | null): boolean {
  return Boolean(getMemberRoleCategory(member));
}

export async function getReferralLeaderboard(limitCount = 100): Promise<ReferralLeaderboardEntry[]> {
  if (typeof window === "undefined") return [];
  try {
    const settings = await getReferralProgramSettings();
    const excludedIds = new Set(settings.excluded_member_ids ?? []);
    const autoExcludeRoles =
      settings.auto_exclude_roles ?? (settings.auto_exclude_organizers ? ["googler", "organizer", "team_member"] : []);

    const membersRef = collection(db, "members");
    const snapshot = await getDocs(membersRef);
    const entries: ReferralLeaderboardEntry[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as FirestoreMember;
      const points = typeof data.referral_points === "number" ? data.referral_points : 0;
      const count = typeof data.referrals_count === "number" ? data.referrals_count : 0;

      // Check exclusion
      const isExplicitlyExcluded = excludedIds.has(docSnap.id);
      const isRoleExcluded = isMemberExcludedByRole(data, autoExcludeRoles).excluded;

      if (isExplicitlyExcluded || isRoleExcluded) {
        continue;
      }

      if (points > 0 || count > 0 || data.referral_code) {
        const resolvedCode =
          data.referral_code && data.referral_code !== "GDG7X9K"
            ? data.referral_code
            : generateUserReferralCode(docSnap.id);

        entries.push({
          rank: 0, // Assigned after sort
          member_id: docSnap.id,
          name: data.name || "Anonymous Member",
          email: data.email || "",
          role: data.role,
          avatar_url: data.avatar_url,
          referral_code: resolvedCode,
          referral_points: points,
          referrals_count: count,
          is_prize_winner: false,
          joined_date: data.joined_date || new Date().toISOString(),
          last_active: data.last_active,
        });
      }
    }

    // Sort descending by points, then referrals_count
    entries.sort((a, b) => {
      if (b.referral_points !== a.referral_points) {
        return b.referral_points - a.referral_points;
      }
      return b.referrals_count - a.referrals_count;
    });

    const topEntries = entries.slice(0, limitCount);
    topEntries.forEach((entry, idx) => {
      entry.rank = idx + 1;
      entry.is_prize_winner = idx === 0 && entry.referral_points > 0;
    });

    return topEntries;
  } catch (err) {
    console.error("[Firestore] getReferralLeaderboard error:", err);
    return [];
  }
}

export async function getExcludedReferralMembers(): Promise<ExcludedReferralMember[]> {
  if (typeof window === "undefined") return [];
  try {
    const settings = await getReferralProgramSettings();
    const excludedIds = new Set(settings.excluded_member_ids ?? []);
    const autoExcludeRoles =
      settings.auto_exclude_roles ?? (settings.auto_exclude_organizers ? ["googler", "organizer", "team_member"] : []);

    const membersRef = collection(db, "members");
    const snapshot = await getDocs(membersRef);
    const results: ExcludedReferralMember[] = [];
    const matchedDocIds = new Set<string>();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as FirestoreMember;
      const isExplicitlyExcluded = excludedIds.has(docSnap.id);
      const roleCheck = isMemberExcludedByRole(data, autoExcludeRoles);

      if (isExplicitlyExcluded || roleCheck.excluded) {
        matchedDocIds.add(docSnap.id);
        const resolvedCode =
          data.referral_code && data.referral_code !== "GDG7X9K"
            ? data.referral_code
            : generateUserReferralCode(docSnap.id);

        results.push({
          member_id: docSnap.id,
          name: data.name || "Anonymous Member",
          email: data.email || "",
          role: data.role || (data.team === "Core Team" ? "Core Team" : "Member"),
          avatar_url: data.avatar_url,
          referral_code: resolvedCode,
          referral_points: typeof data.referral_points === "number" ? data.referral_points : 0,
          referrals_count: typeof data.referrals_count === "number" ? data.referrals_count : 0,
          joined_date: data.joined_date || new Date().toISOString(),
          reason: isExplicitlyExcluded ? "manual" : "role_auto",
          excluded_role: roleCheck.matchedRole,
        });
      }
    }

    // Include any explicitly excluded IDs whose doc might not have been returned in full scan
    for (const id of excludedIds) {
      if (!matchedDocIds.has(id)) {
        try {
          const directSnap = await getDoc(doc(db, "members", id));
          if (directSnap.exists()) {
            const data = directSnap.data() as FirestoreMember;
            results.push({
              member_id: directSnap.id,
              name: data.name || "Anonymous Member",
              email: data.email || "",
              role: data.role || "Member",
              avatar_url: data.avatar_url,
              referral_code: data.referral_code ?? generateUserReferralCode(directSnap.id),
              referral_points: typeof data.referral_points === "number" ? data.referral_points : 0,
              referrals_count: typeof data.referrals_count === "number" ? data.referrals_count : 0,
              joined_date: data.joined_date || new Date().toISOString(),
              reason: "manual",
            });
          } else {
            results.push({
              member_id: id,
              name: `Excluded Member (${id.slice(0, 8)})`,
              email: "Unsynced Member",
              role: "Excluded",
              avatar_url: null,
              referral_code: generateUserReferralCode(id),
              referral_points: 0,
              referrals_count: 0,
              joined_date: new Date().toISOString(),
              reason: "manual",
            });
          }
        } catch {
          // Ignore individual fetch failure
        }
      }
    }

    return results;
  } catch (err) {
    console.error("[Firestore] getExcludedReferralMembers error:", err);
    return [];
  }
}

export async function resetMemberReferrals(memberId: string): Promise<void> {
  if (typeof window === "undefined" || !memberId) return;
  const memberRef = doc(db, "members", memberId);
  await updateDoc(
    memberRef,
    sanitizeFirestoreData({
      referral_points: 0,
      referrals_count: 0,
      updated_at: new Date().toISOString(),
    }),
  );
}

export async function resetAllMembersReferrals(): Promise<{ resetCount: number }> {
  if (typeof window === "undefined") return { resetCount: 0 };
  const membersRef = collection(db, "members");
  const snapshot = await getDocs(membersRef);

  const toReset = snapshot.docs.filter((d) => {
    const data = d.data() as FirestoreMember;
    return (data.referral_points ?? 0) > 0 || (data.referrals_count ?? 0) > 0;
  });

  if (toReset.length === 0) return { resetCount: 0 };

  const CHUNK_SIZE = 450;
  const now = new Date().toISOString();
  for (let i = 0; i < toReset.length; i += CHUNK_SIZE) {
    const chunk = toReset.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const docSnap of chunk) {
      batch.update(doc(db, "members", docSnap.id), {
        referral_points: 0,
        referrals_count: 0,
        updated_at: now,
      });
    }
    await batch.commit();
  }

  return { resetCount: toReset.length };
}

export async function excludeMemberFromLeaderboard(memberId: string): Promise<void> {
  if (typeof window === "undefined" || !memberId) return;
  const settings = await getReferralProgramSettings();
  const currentList = settings.excluded_member_ids ?? [];
  if (!currentList.includes(memberId)) {
    await saveReferralProgramSettings({
      excluded_member_ids: [...currentList, memberId],
    });
  }
}

export async function includeMemberInLeaderboard(memberId: string): Promise<void> {
  if (typeof window === "undefined" || !memberId) return;
  const settings = await getReferralProgramSettings();
  const currentList = settings.excluded_member_ids ?? [];
  const updatedList = currentList.filter((id) => id !== memberId);
  await saveReferralProgramSettings({
    excluded_member_ids: updatedList,
  });
}

export async function excludeEventFromReferrals(eventId: string): Promise<void> {
  if (typeof window === "undefined" || !eventId) return;
  const settings = await getReferralProgramSettings();
  const currentList = settings.excluded_event_ids ?? [];
  const idStr = String(eventId);
  if (!currentList.includes(idStr)) {
    await saveReferralProgramSettings({
      excluded_event_ids: [...currentList, idStr],
    });
  }
}

export async function includeEventInReferrals(eventId: string): Promise<void> {
  if (typeof window === "undefined" || !eventId) return;
  const settings = await getReferralProgramSettings();
  const currentList = settings.excluded_event_ids ?? [];
  const idStr = String(eventId);
  const updatedList = currentList.filter((id) => id !== idStr);
  await saveReferralProgramSettings({
    excluded_event_ids: updatedList,
  });
}

export async function searchMembersForExclusion(searchTerm: string): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    avatar_url?: string | null;
    isAlreadyExcluded: boolean;
  }>
> {
  if (typeof window === "undefined") return [];
  try {
    const [settings, membersSnap] = await Promise.all([
      getReferralProgramSettings(),
      getDocs(collection(db, "members")),
    ]);
    const excludedSet = new Set(settings.excluded_member_ids ?? []);
    const autoExcludeRoles =
      settings.auto_exclude_roles ?? (settings.auto_exclude_organizers ? ["googler", "organizer", "team_member"] : []);
    const q = searchTerm.trim().toLowerCase();

    const results: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      avatar_url?: string | null;
      isAlreadyExcluded: boolean;
    }> = [];

    const foundIds = new Set<string>();

    for (const docSnap of membersSnap.docs) {
      const data = docSnap.data() as FirestoreMember;
      const name = data.name || "Anonymous Member";
      const email = data.email || "";
      const role = data.role || (data.team === "Core Team" ? "Core Team" : "Member");
      const memberId = docSnap.id;
      const refCode = data.referral_code ?? "";

      if (
        q &&
        !name.toLowerCase().includes(q) &&
        !email.toLowerCase().includes(q) &&
        !memberId.toLowerCase().includes(q) &&
        !refCode.toLowerCase().includes(q)
      ) {
        continue;
      }

      foundIds.add(memberId);
      const isManual = excludedSet.has(memberId);
      const isRole = isMemberExcludedByRole(data, autoExcludeRoles).excluded;

      results.push({
        id: memberId,
        name,
        email,
        role,
        avatar_url: data.avatar_url,
        isAlreadyExcluded: isManual || isRole,
      });

      if (results.length >= 50) break;
    }

    // Direct document ID fallback if someone enters exact Firestore doc ID / UID that wasn't matched
    if (results.length === 0 && q) {
      try {
        const directSnap = await getDoc(doc(db, "members", searchTerm.trim()));
        if (directSnap.exists() && !foundIds.has(directSnap.id)) {
          const data = directSnap.data() as FirestoreMember;
          const name = data.name || "Anonymous Member";
          const email = data.email || "";
          const role = data.role || (data.team === "Core Team" ? "Core Team" : "Member");
          const isManual = excludedSet.has(directSnap.id);
          const isRole = isMemberExcludedByRole(data, autoExcludeRoles).excluded;

          results.push({
            id: directSnap.id,
            name,
            email,
            role,
            avatar_url: data.avatar_url,
            isAlreadyExcluded: isManual || isRole,
          });
        }
      } catch {
        // Fallback quiet
      }
    }

    return results;
  } catch (err) {
    console.error("[Firestore] searchMembersForExclusion error:", err);
    return [];
  }
}

export async function getMemberReferralHistory(memberId: string): Promise<ReferralRedemption[]> {
  if (typeof window === "undefined" || !memberId) return [];
  try {
    const redemptionsRef = collection(db, "referral_redemptions");
    const q = query(redemptionsRef, where("referrer_id", "==", memberId));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as ReferralRedemption[];

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (err) {
    console.warn("[Firestore] getMemberReferralHistory error:", err);
    return [];
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

export async function getRegistrationById(registrationId: string): Promise<FirestoreRegistration | null> {
  if (typeof window === "undefined" || !registrationId) return null;
  try {
    const docRef = doc(db, "event_registrations", registrationId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as FirestoreRegistration;
    }
  } catch (err) {
    console.warn(`[Firestore] getRegistrationById error for ${registrationId}:`, err);
  }
  return null;
}

export async function registerMemberForEvent(registration: Omit<FirestoreRegistration, "id">): Promise<string> {
  if (typeof window === "undefined") throw new Error("Registration must be performed from client");

  // Ensure Firebase Auth state is fully restored on client before making Firestore calls
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }
  const currentAuthUser = auth.currentUser;
  const effectiveMemberId = currentAuthUser?.uid ?? registration.member_id;

  if (!effectiveMemberId || !registration.member_email.trim()) {
    throw new Error("You must join the community by signing in with Google before registering.");
  }
  const normalizedEmail = registration.member_email.trim().toLowerCase();
  const eventIdStr = String(registration.event_id);

  // 1. Check if member / email already registered for this event
  const existing = await checkExistingRegistration(eventIdStr, effectiveMemberId, normalizedEmail);
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

  // Validate venue, session, and ticket capacity
  let isWaitlisted = registration.status === "waitlisted";
  const allowWaitlist = eventData ? eventData.allow_waitlist !== false : true;

  if (eventData && !isWaitlisted) {
    // 1. Venue capacity check
    let venueCapacity: number | null = null;
    if (typeof eventData.max_attendees === "number" && eventData.max_attendees > 0) {
      venueCapacity = eventData.max_attendees;
    } else if (Array.isArray(eventData.sessions) && eventData.sessions.length > 0) {
      venueCapacity = eventData.sessions.reduce((acc, s) => acc + (Number(s.capacity) || 0), 0);
    }

    if (venueCapacity !== null && venueCapacity > 0) {
      const isCurated = Boolean(eventData.requires_approval || eventData.curation_mode);
      if (isCurated) {
        if (Number(eventData.total_approved || 0) >= venueCapacity) {
          if (allowWaitlist) {
            isWaitlisted = true;
          } else {
            throw new Error(
              `Registration is already full. The venue capacity (${venueCapacity} approved attendees) has been reached.`,
            );
          }
        }
      } else {
        if (Number(eventData.total_registrations || 0) >= venueCapacity) {
          if (allowWaitlist) {
            isWaitlisted = true;
          } else {
            throw new Error(
              `Registration is already full. The maximum capacity of ${venueCapacity} attendees has been reached.`,
            );
          }
        }
      }
    }

    // 2. Session capacity check
    if (!isWaitlisted && registration.session_id) {
      const matchingSession = eventData.sessions?.find((s) => s.id === registration.session_id);
      if (matchingSession && matchingSession.capacity > 0) {
        const currentCount = matchingSession.total_registered || 0;
        if (currentCount >= matchingSession.capacity) {
          if (allowWaitlist) {
            isWaitlisted = true;
          } else {
            throw new Error(
              `The session "${matchingSession.title}" has reached its maximum capacity (${matchingSession.capacity} attendees). Please select an alternate session.`,
            );
          }
        }
      }
    }

    // 3. Ticket sales window and capacity check
    if (!isWaitlisted && registration.ticket_id && eventData.tickets) {
      const matchingTicket = eventData.tickets.find((t) => t.id === registration.ticket_id);
      if (matchingTicket) {
        if (matchingTicket.status === "hidden") {
          throw new Error(`The ticket tier "${matchingTicket.name}" is not open for registration.`);
        }
        if (matchingTicket.status === "sold_out") {
          throw new Error(`The ticket tier "${matchingTicket.name}" is sold out.`);
        }
        if (matchingTicket.sales_start_date && matchingTicket.sales_start_date.trim() !== "") {
          const startTime = new Date(matchingTicket.sales_start_date).getTime();
          if (!Number.isNaN(startTime) && Date.now() < startTime) {
            throw new Error(`Sales for ticket "${matchingTicket.name}" have not started yet.`);
          }
        }
        if (matchingTicket.sales_end_date && matchingTicket.sales_end_date.trim() !== "") {
          const endTime = new Date(matchingTicket.sales_end_date).getTime();
          if (!Number.isNaN(endTime) && Date.now() > endTime) {
            throw new Error(`Sales for ticket "${matchingTicket.name}" have ended.`);
          }
        }
        if (typeof matchingTicket.capacity === "number" && matchingTicket.capacity > 0) {
          const currentTicketCount = matchingTicket.total_registered || 0;
          if (currentTicketCount >= matchingTicket.capacity) {
            if (allowWaitlist) {
              isWaitlisted = true;
            } else {
              throw new Error(
                `The ticket tier "${matchingTicket.name}" is sold out (${matchingTicket.capacity} tickets).`,
              );
            }
          }
        }
      }
    }

    // 4. Bundle package sales window and capacity check
    if (!isWaitlisted && registration.bundle_id && eventData.bundles) {
      const matchingBundle = eventData.bundles.find((b) => b.id === registration.bundle_id);
      if (matchingBundle) {
        if (matchingBundle.status === "hidden") {
          throw new Error(`The bundling package "${matchingBundle.name}" is not open for registration.`);
        }
        if (matchingBundle.status === "sold_out") {
          throw new Error(`The bundling package "${matchingBundle.name}" is sold out.`);
        }
        if (matchingBundle.sales_start_date && matchingBundle.sales_start_date.trim() !== "") {
          const startTime = new Date(matchingBundle.sales_start_date).getTime();
          if (!Number.isNaN(startTime) && Date.now() < startTime) {
            throw new Error(`Sales for package "${matchingBundle.name}" have not started yet.`);
          }
        }
        if (matchingBundle.sales_end_date && matchingBundle.sales_end_date.trim() !== "") {
          const endTime = new Date(matchingBundle.sales_end_date).getTime();
          if (!Number.isNaN(endTime) && Date.now() > endTime) {
            throw new Error(`Sales for package "${matchingBundle.name}" have ended.`);
          }
        }
        if (typeof matchingBundle.capacity === "number" && matchingBundle.capacity > 0) {
          const currentBundleCount = matchingBundle.total_registered || 0;
          if (currentBundleCount >= matchingBundle.capacity) {
            if (allowWaitlist) {
              isWaitlisted = true;
            } else {
              throw new Error(
                `The package "${matchingBundle.name}" is sold out (${matchingBundle.capacity} packages).`,
              );
            }
          }
        }
      }
    }

    // 5. Merchandise sales window and availability check
    if (registration.selected_merchandise && registration.selected_merchandise.length > 0 && eventData.merchandise) {
      for (const order of registration.selected_merchandise) {
        const matchingMerch = eventData.merchandise.find((m) => m.id === order.id);
        if (matchingMerch) {
          if (matchingMerch.status === "out_of_stock") {
            throw new Error(`The merchandise item "${matchingMerch.name}" is out of stock.`);
          }
          if (matchingMerch.status === "draft" || matchingMerch.status === "hidden") {
            throw new Error(`The merchandise item "${matchingMerch.name}" is currently not available.`);
          }
          if (matchingMerch.sales_start_date && matchingMerch.sales_start_date.trim() !== "") {
            const startTime = new Date(matchingMerch.sales_start_date).getTime();
            if (!Number.isNaN(startTime) && Date.now() < startTime) {
              throw new Error(`Sales for merchandise "${matchingMerch.name}" have not started yet.`);
            }
          }
          if (matchingMerch.sales_end_date && matchingMerch.sales_end_date.trim() !== "") {
            const endTime = new Date(matchingMerch.sales_end_date).getTime();
            if (!Number.isNaN(endTime) && Date.now() > endTime) {
              throw new Error(`Sales for merchandise "${matchingMerch.name}" have ended.`);
            }
          }
        }
      }
    }
  }

  // 3. Enforce registration status:
  // If waitlisted, status is "waitlisted". Otherwise default is "pending".
  const resolvedStatus: RegistrationStatus = isWaitlisted ? "waitlisted" : registration.status;

  const regId = `${eventIdStr}_${effectiveMemberId}`;
  const docRef = doc(db, "event_registrations", regId);

  // Include session_id and session_title inside answers for backward compatibility
  const updatedAnswers = {
    ...(registration.answers ?? {}),
    ...(registration.session_id ? { session_id: registration.session_id } : {}),
    ...(registration.session_title ? { session_title: registration.session_title } : {}),
  };

  const initialStatusLog: RegistrationStatusLog = {
    id: `log_${Date.now()}_initial`,
    status: resolvedStatus,
    changed_at: new Date().toISOString(),
    changed_by_id: effectiveMemberId,
    changed_by_name: registration.member_name || "Applicant",
    notes: isWaitlisted ? "Registered on waitlist as event capacity was reached." : "Initial registration submitted.",
  };

  // Guard against oversized base64 data URIs exceeding Firestore constraints
  const safePictureUrl =
    registration.event_picture_url && registration.event_picture_url.length <= 500000
      ? registration.event_picture_url
      : undefined;
  const safeBannerUrl =
    registration.event_banner_url && registration.event_banner_url.length <= 500000
      ? registration.event_banner_url
      : undefined;
  const safeAvatar =
    registration.member_avatar && registration.member_avatar.length <= 500000 ? registration.member_avatar : undefined;

  // Generate friend vouchers if this registration includes a bundle with multiple tickets
  let issuedBundleVouchers: BundleIssuedVoucher[] | undefined;
  let newFriendVouchers: EventVoucher[] = [];

  if (registration.bundle_id && eventData?.bundles) {
    const matchingBundle = eventData.bundles.find((b) => b.id === registration.bundle_id);
    if (matchingBundle && (matchingBundle.ticket_quantity ?? 1) > 1 && matchingBundle.generate_vouchers !== false) {
      const matchingTicketTier = eventData.tickets?.find((t) => t.id === matchingBundle.ticket_id);
      const generated = generateBundleFriendVouchers({
        bundle: matchingBundle,
        buyerRegistrationId: regId,
        buyerMemberId: effectiveMemberId,
        buyerName: registration.member_name || "Bundle Purchaser",
        buyerEmail: normalizedEmail,
        ticketTier: matchingTicketTier,
        eventStartDate: eventData.start_date,
      });
      issuedBundleVouchers = generated.registrationVouchers;
      newFriendVouchers = generated.newEventVouchers;
    }
  }

  const refSettings = await getReferralProgramSettings();
  const selectedTicketTier = registration.ticket_id
    ? eventData?.tickets?.find((t) => t.id === registration.ticket_id)
    : undefined;
  const selectedTicketPrice = selectedTicketTier ? selectedTicketTier.price : undefined;
  const eligibility = isReferralEligibleForEvent(refSettings, eventData, selectedTicketPrice);
  const isEventExcludedFromReferral = !eligibility.eligible;

  const cleanPayload = sanitizeFirestoreData<FirestoreRegistration>({
    ...registration,
    ...(isEventExcludedFromReferral
      ? {
          referral_code: undefined,
          referrer_member_id: undefined,
          referrer_name: undefined,
          referral_discount_type: undefined,
          referral_discount_percent: undefined,
          referral_discount_amount: undefined,
        }
      : {}),
    bundle_vouchers: issuedBundleVouchers ?? registration.bundle_vouchers,
    member_id: effectiveMemberId,
    event_picture_url: safePictureUrl,
    event_banner_url: safeBannerUrl,
    member_avatar: safeAvatar,
    ticket_id: registration.ticket_id != null ? String(registration.ticket_id) : DEFAULT_REGULAR_TICKET_ID,
    ticket_name: registration.ticket_name ?? DEFAULT_REGULAR_TICKET_NAME,
    ticket_type: registration.ticket_type ?? "free",
    ticket_price: typeof registration.ticket_price === "number" ? registration.ticket_price : 0,
    session_id: registration.session_id != null ? String(registration.session_id) : undefined,
    bundle_id: registration.bundle_id != null ? String(registration.bundle_id) : undefined,
    payment_amount: typeof registration.payment_amount === "number" ? registration.payment_amount : undefined,
    payment_expired_datetime:
      registration.payment_expired_datetime != null ? String(registration.payment_expired_datetime) : undefined,
    status: resolvedStatus,
    answers: updatedAnswers,
    event_id: eventIdStr,
    member_email: normalizedEmail,
    id: regId,
    status_logs: [initialStatusLog],
  });

  try {
    await setDoc(docRef, cleanPayload, { merge: true });
  } catch (setErr) {
    console.error("[registerMemberForEvent] Failed to write registration document:", setErr, {
      regId,
      effectiveMemberId,
      status: resolvedStatus,
      payloadKeys: Object.keys(cleanPayload),
    });
    throw setErr;
  }

  // Update event registration counter, waitlisted counter & session total if available
  try {
    if (eventData) {
      const isCurated = Boolean(eventData.curation_mode ?? eventData.requires_approval);
      const isSeatConsumingRegistration =
        resolvedStatus === "approved" ||
        resolvedStatus === "paid_and_registered" ||
        resolvedStatus === "registered" ||
        (!isCurated && resolvedStatus !== "waitlisted" && resolvedStatus !== "rejected");

      const currentCount = typeof eventData.total_registrations === "number" ? eventData.total_registrations : 0;
      const currentWaitlistCount = typeof eventData.total_waitlisted === "number" ? eventData.total_waitlisted : 0;

      const updateData: Record<string, unknown> = {
        total_registrations: currentCount + 1,
        ...(resolvedStatus === "approved" ? { total_approved: (eventData.total_approved ?? 0) + 1 } : {}),
        ...(isWaitlisted ? { total_waitlisted: currentWaitlistCount + 1 } : {}),
        updated_at: new Date().toISOString(),
      };

      if (registration.session_id && Array.isArray(eventData.sessions)) {
        const updatedSessions = eventData.sessions.map((sess) => {
          if (sess.id === registration.session_id) {
            return {
              ...sess,
              total_registered: (sess.total_registered ?? 0) + (isSeatConsumingRegistration ? 1 : 0),
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
              total_registered: (t.total_registered ?? 0) + (isSeatConsumingRegistration ? 1 : 0),
            };
          }
          return t;
        });
        updateData.tickets = updatedTickets;
      }

      // Handle applied voucher redemption tracking
      let updatedVouchers = Array.isArray(eventData.vouchers) ? [...eventData.vouchers] : [];

      if (registration.voucher_id || registration.voucher_code) {
        const normalizedCode = registration.voucher_code?.trim().toUpperCase();
        updatedVouchers = updatedVouchers.map((v) => {
          if (v.id === registration.voucher_id || (normalizedCode && v.code.toUpperCase() === normalizedCode)) {
            return {
              ...v,
              times_used: (v.times_used ?? 0) + 1,
              redeemed_by_member_id: effectiveMemberId,
              redeemed_by_name: registration.member_name || undefined,
              redeemed_by_email: normalizedEmail,
              redeemed_at: new Date().toISOString(),
            };
          }
          return v;
        });

        // Also if this voucher came from another buyer's bundle, update buyer's registration record
        const redeemedVoucherObj = updatedVouchers.find(
          (v) => v.id === registration.voucher_id || (normalizedCode && v.code.toUpperCase() === normalizedCode),
        );
        if (redeemedVoucherObj?.source_registration_id) {
          try {
            const purchaserRegRef = doc(db, "event_registrations", redeemedVoucherObj.source_registration_id);
            const purchaserRegSnap = await getDoc(purchaserRegRef);
            if (purchaserRegSnap.exists()) {
              const pData = purchaserRegSnap.data() as FirestoreRegistration;
              if (Array.isArray(pData.bundle_vouchers)) {
                const updatedBuyerVouchers = pData.bundle_vouchers.map((bv) => {
                  if (bv.code.toUpperCase() === normalizedCode) {
                    return {
                      ...bv,
                      status: "redeemed" as const,
                      redeemed_by_member_id: effectiveMemberId,
                      redeemed_by_name: registration.member_name || "Friend",
                      redeemed_by_email: normalizedEmail,
                      redeemed_at: new Date().toISOString(),
                    };
                  }
                  return bv;
                });
                await updateDoc(purchaserRegRef, { bundle_vouchers: updatedBuyerVouchers });
              }
            }
          } catch (buyerUpdateErr) {
            console.warn("[Firestore] Failed to update purchaser bundle voucher state:", buyerUpdateErr);
          }
        }
      }

      // Append newly generated friend vouchers if any
      if (newFriendVouchers.length > 0) {
        updatedVouchers = [...updatedVouchers, ...newFriendVouchers];
      }

      if (updatedVouchers.length > 0 || registration.voucher_id || registration.voucher_code) {
        updateData.vouchers = updatedVouchers;
      }

      if (registration.bundle_id && Array.isArray(eventData.bundles)) {
        const updatedBundles = eventData.bundles.map((b) => {
          if (b.id === registration.bundle_id) {
            return {
              ...b,
              total_registered: (b.total_registered ?? 0) + (isSeatConsumingRegistration ? 1 : 0),
            };
          }
          return b;
        });
        updateData.bundles = updatedBundles;
      }

      await updateDoc(eventRef, sanitizeFirestoreData(updateData));
    }
  } catch (err) {
    console.warn("[Firestore] Failed to update event registration / session counters:", err);
  }

  // 4. Process Referral Redemption & Award Points
  if (registration.referral_code && !isEventExcludedFromReferral) {
    try {
      const refCode = registration.referral_code.trim().toUpperCase();
      const membersRef = collection(db, "members");
      const qRef = query(membersRef, where("referral_code", "==", refCode), limit(1));
      const refSnap = await getDocs(qRef);

      if (!refSnap.empty) {
        const referrerDoc = refSnap.docs[0];
        const referrerData = referrerDoc.data() as FirestoreMember;
        const referrerId = referrerDoc.id;

        // Ensure not self-referral
        if (referrerId !== effectiveMemberId) {
          const pointsAwarded =
            typeof refSettings.points_per_referral === "number" ? refSettings.points_per_referral : 10;

          // 1. Increment referrer points and referrals_count
          const currentPoints = typeof referrerData.referral_points === "number" ? referrerData.referral_points : 0;
          const currentCount = typeof referrerData.referrals_count === "number" ? referrerData.referrals_count : 0;

          await updateDoc(
            doc(db, "members", referrerId),
            sanitizeFirestoreData({
              referral_points: currentPoints + pointsAwarded,
              referrals_count: currentCount + 1,
              updated_at: new Date().toISOString(),
            }),
          );

          // 2. Mark referee member doc as having redeemed their 1-time referral
          await updateDoc(
            doc(db, "members", effectiveMemberId),
            sanitizeFirestoreData({
              has_used_referral: true,
              referred_by_code: refCode,
              updated_at: new Date().toISOString(),
            }),
          );

          // 3. Record redemption transaction in referral_redemptions collection
          const redemptionId = `${effectiveMemberId}_${regId}`;
          const redemptionDocRef = doc(db, "referral_redemptions", redemptionId);
          await setDoc(
            redemptionDocRef,
            sanitizeFirestoreData<ReferralRedemption>({
              id: redemptionId,
              referrer_id: referrerId,
              referrer_name: referrerData.name || "GDG Member",
              referrer_email: referrerData.email || "",
              referrer_code: refCode,
              referee_id: effectiveMemberId,
              referee_name: registration.member_name ?? "Applicant",
              referee_email: normalizedEmail,
              event_id: eventIdStr,
              event_title: registration.event_title ?? eventData?.title ?? "GDG Event",
              ticket_id: registration.ticket_id,
              ticket_name: registration.ticket_name,
              ticket_type: registration.ticket_type,
              ticket_price: registration.ticket_price,
              discount_type:
                registration.referral_discount_type ?? (registration.referral_discount_amount ? "fixed" : "percentage"),
              discount_percentage: registration.referral_discount_percent ?? 0,
              discount_amount: registration.referral_discount_amount ?? 0,
              points_awarded: pointsAwarded,
              created_at: new Date().toISOString(),
            }),
            { merge: true },
          );
        }
      }
    } catch (refErr) {
      console.warn("[registerMemberForEvent] Failed to process referral redemption:", refErr);
    }
  }

  return regId;
}

export function isRegistrationSeatOccupied(reg: FirestoreRegistration, isCurated: boolean): boolean {
  const status = (reg.status ?? "").toLowerCase().trim();
  if (
    status === "rejected" ||
    status === "waitlisted" ||
    status === "expired" ||
    status === "failed" ||
    status === "canceled" ||
    status === "cancelled"
  ) {
    return false;
  }
  if (isCurated) {
    return (
      status === "approved" ||
      status === "attended" ||
      status === "paid_and_registered" ||
      status === "registered" ||
      status === "waiting_for_payment"
    );
  }
  return true;
}

/**
 * Recalculates all event-level capacity and operational counters from actual registrations:
 * - total_registrations
 * - total_approved
 * - total_waitlisted
 * - total_checked_in
 * - sessions[].total_registered (tracks capacity filled per session)
 * - tickets[].total_registered (tracks capacity filled per ticket)
 * - bundles[].total_registered (tracks capacity filled per bundle)
 *
 * For curated events (requires_approval / curation_mode):
 * Capacity is consumed ONLY when an attendee status is approved (or attended, paid_and_registered, registered, or waiting_for_payment).
 * Pending applicants do not consume session/ticket capacity until approved.
 *
 * For non-curated events:
 * Active registrations (non-rejected, non-cancelled, non-expired, non-waitlisted) consume capacity immediately.
 */
export async function recalculateEventCapacityCounters(
  eventId: string,
  existingRegistrations?: FirestoreRegistration[],
): Promise<{ sessions?: EventSession[]; tickets?: EventTicketTier[]; bundles?: EventBundlePackage[] } | null> {
  if (typeof window === "undefined") return null;

  try {
    const eventIdStr = String(eventId);
    const eventRef = doc(db, "events", eventIdStr);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return null;

    const eventData = eventSnap.data() as FirestoreEvent;
    const registrations = existingRegistrations ?? (await getEventRegistrations(eventIdStr));
    const isCurated = Boolean(eventData.curation_mode ?? eventData.requires_approval);

    const totalRegistrations = registrations.length;
    const totalApproved = registrations.filter(
      (r) =>
        r.status === "approved" ||
        r.status === "attended" ||
        r.status === "paid_and_registered" ||
        r.status === "registered",
    ).length;
    const totalWaitlisted = registrations.filter((r) => r.status === "waitlisted").length;
    const totalCheckedIn = registrations.filter((r) => Boolean(r.is_checked_in) || r.status === "attended").length;

    // Filter registrations that occupy session/ticket capacity
    const occupiedRegs = registrations.filter((r) => isRegistrationSeatOccupied(r, isCurated));

    const updatePayload: Record<string, unknown> = {
      total_registrations: totalRegistrations,
      total_approved: totalApproved,
      total_waitlisted: totalWaitlisted,
      total_checked_in: totalCheckedIn,
      updated_at: new Date().toISOString(),
    };

    let updatedSessions: EventSession[] | undefined;
    if (Array.isArray(eventData.sessions) && eventData.sessions.length > 0) {
      updatedSessions = eventData.sessions.map((sess) => {
        const count = occupiedRegs.filter((reg) =>
          isRegistrationInSession(reg, { sessionId: sess.id, sessionTitle: sess.title }),
        ).length;

        return {
          ...sess,
          total_registered: count,
        };
      });
      updatePayload.sessions = updatedSessions;
    }

    let updatedTickets: EventTicketTier[] | undefined;
    if (Array.isArray(eventData.tickets) && eventData.tickets.length > 0) {
      updatedTickets = eventData.tickets.map((t) => {
        const count = occupiedRegs.filter((reg) => {
          if (reg.ticket_id && reg.ticket_id === t.id) return true;
          const regTicket =
            reg.ticket_name ??
            reg.ticket_tier ??
            (reg.answers?.Ticket as string | undefined) ??
            (reg.answers?.ticket as string | undefined) ??
            "";
          if (!regTicket) return false;
          const regClean = regTicket.toLowerCase().split(",")[0].trim();
          const targetClean = t.name.toLowerCase().trim();
          return regClean === targetClean || regClean.includes(targetClean) || targetClean.includes(regClean);
        }).length;

        return {
          ...t,
          total_registered: count,
        };
      });
      updatePayload.tickets = updatedTickets;
    }

    let updatedBundles: EventBundlePackage[] | undefined;
    if (Array.isArray(eventData.bundles) && eventData.bundles.length > 0) {
      updatedBundles = eventData.bundles.map((b) => {
        const count = occupiedRegs.filter((reg) => {
          if (reg.bundle_id && reg.bundle_id === b.id) return true;
          const regBundle = reg.bundle_name ?? (reg.answers?.Bundle as string | undefined) ?? "";
          if (!regBundle) return false;
          return regBundle.toLowerCase().trim() === b.name.toLowerCase().trim();
        }).length;

        return {
          ...b,
          total_registered: count,
        };
      });
      updatePayload.bundles = updatedBundles;
    }

    await updateDoc(eventRef, sanitizeFirestoreData(updatePayload));

    return {
      sessions: updatedSessions,
      tickets: updatedTickets,
      bundles: updatedBundles,
    };
  } catch (err) {
    console.warn("[Firestore] Failed to recalculate event capacity counters:", err);
    return null;
  }
}

export async function getEventSessionRegistrationCounts(
  eventId: string,
  isCurated?: boolean,
): Promise<Record<string, number>> {
  if (typeof window === "undefined") return {};
  try {
    const [eventDoc, registrations] = await Promise.all([
      getFirestoreEventById(eventId),
      getEventRegistrations(eventId),
    ]);
    const eventData = eventDoc;
    const effectiveIsCurated =
      typeof isCurated === "boolean" ? isCurated : Boolean(eventData?.curation_mode ?? eventData?.requires_approval);
    const sessions = eventData?.sessions ?? [];

    const counts: Record<string, number> = {};
    for (const sess of sessions) {
      counts[sess.id] = 0;
    }

    const occupiedRegs = registrations.filter((r) => isRegistrationSeatOccupied(r, effectiveIsCurated));

    for (const reg of occupiedRegs) {
      for (const sess of sessions) {
        if (isRegistrationInSession(reg, { sessionId: sess.id, sessionTitle: sess.title })) {
          counts[sess.id] = (counts[sess.id] ?? 0) + 1;
          break;
        }
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
  extraFields?: Partial<FirestoreRegistration>,
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
    ...(extraFields ? extraFields : {}),
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

  // Recalculate event counters, session capacities & ticket counters
  try {
    await recalculateEventCapacityCounters(eventId);
  } catch (err) {
    console.warn("[Firestore] Failed to recalculate event counters and session capacities:", err);
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
  const isPaid = existing.status === "paid_and_registered" || String(existing.payment_status).toLowerCase() === "paid";
  if (isPaid) {
    throw new Error("Registration details are locked because payment has already been completed.");
  }
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

  // If session changed, recalculate event capacity counters
  if (oldSessionId !== newSessionId) {
    try {
      await recalculateEventCapacityCounters(eventId);
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

  // 2. Recalculate event counters and capacity
  try {
    await recalculateEventCapacityCounters(eventId);
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

  // Recalculate event counters and capacity
  try {
    await recalculateEventCapacityCounters(eventId);
  } catch (err) {
    console.warn("[Firestore] Failed to update event counters on batch registration deletion:", err);
  }
}

const ALLOWED_EVENT_DOC_KEYS = new Set<string>([
  "id",
  "title",
  "description",
  "description_short",
  "status",
  "start_date",
  "end_date",
  "picture_url",
  "banner_url",
  "picture",
  "banner",
  "cropped_picture_url",
  "cropped_banner_url",
  "event_type_title",
  "audience_type",
  "is_virtual",
  "venue",
  "url",
  "static_url",
  "tags",
  "is_hidden",
  "is_test",
  "requires_approval",
  "curation_mode",
  "allow_waitlist",
  "max_attendees",
  "total_registrations",
  "total_approved",
  "total_checked_in",
  "total_waitlisted",
  "custom_questions",
  "agenda",
  "speakers",
  "sessions",
  "webhook_url",
  "payment_webhook_url",
  "payment_environment",
  "merchandise_delivery_payment_environment",
  "merchandise_delivery_fee",
  "headerEmailUrl",
  "header_email_url",
  "paymentDeadlinesInMinutes",
  "paymentDeadlineMinutes",
  "payment_deadline_minutes",
  "payment_email_template",
  "paymentEmailTemplate",
  "registration_status",
  "registration_start_date",
  "registration_end_date",
  "tickets",
  "max_tickets_per_person",
  "merchandise",
  "max_merchandise_per_person",
  "bundles",
  "vouchers",
  "referral_discount_percentage",
  "referral_discount_type",
  "referral_discount_amount",
  "referral_enabled",
  "highlight_video_url",
  "highlight_video_title",
  "photo_album_url",
  "photo_album_title",
  "recap_description",
  "email_templates",
  "synced_from_bevy_at",
  "created_at",
  "updated_at",
]);

function pickAllowedEventFields(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (ALLOWED_EVENT_DOC_KEYS.has(key) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Helper to ensure an event document exists in Firestore with required fields before modifying it.
 * Returns true if the document already existed, false if it was newly initialized.
 */
async function ensureEventDocInitialized(
  eventId: string,
  baseEvent?: Partial<FirestoreEvent>,
  additionalFields?: Record<string, unknown>,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const eventRef = doc(db, "events", String(eventId));
  const snap = await getDoc(eventRef);

  if (!snap.exists()) {
    const now = new Date().toISOString();
    const fullPayload: Record<string, unknown> = {
      ...(baseEvent ?? {}),
      id: String(eventId),
      title: baseEvent?.title ?? "Untitled Event",
      status: baseEvent?.status ?? "Published",
      start_date: baseEvent?.start_date ?? now,
      end_date: baseEvent?.end_date ?? baseEvent?.start_date ?? now,
      total_registrations: baseEvent?.total_registrations ?? 0,
      total_approved: baseEvent?.total_approved ?? 0,
      total_checked_in: baseEvent?.total_checked_in ?? 0,
      requires_approval: baseEvent?.requires_approval ?? false,
      ...(additionalFields ?? {}),
      updated_at: now,
      created_at: now,
    };
    const sanitized = sanitizeFirestoreData(pickAllowedEventFields(fullPayload)) as Record<string, unknown>;
    const createPayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sanitized)) {
      if (!isFirestoreFieldValue(v)) {
        createPayload[k] = v;
      }
    }
    await setDoc(eventRef, createPayload, { merge: true });
    return false;
  }
  return true;
}

export async function updateEventTickets(
  eventId: string,
  tickets: EventTicketTier[],
  maxTicketsPerPerson?: number | null,
  baseEvent?: Partial<FirestoreEvent>,
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

  const exists = await ensureEventDocInitialized(eventId, baseEvent, updatePayload);
  if (!exists) return;

  const sanitized = sanitizeFirestoreData(updatePayload);
  await setDoc(eventRef, sanitized, { merge: true });
}

export async function updateEventMerchandise(
  eventId: string,
  merchandise: EventMerchandiseItem[],
  maxMerchandisePerPerson?: number | null,
  baseEvent?: Partial<FirestoreEvent>,
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

  const exists = await ensureEventDocInitialized(eventId, baseEvent, updatePayload);
  if (!exists) return;

  const sanitized = sanitizeFirestoreData(updatePayload);
  await setDoc(eventRef, sanitized, { merge: true });
}

export async function updateEventVouchers(
  eventId: string,
  vouchers: EventVoucher[],
  baseEvent?: Partial<FirestoreEvent>,
): Promise<void> {
  if (typeof window === "undefined") return;
  const eventRef = doc(db, "events", String(eventId));
  const updatePayload: Record<string, unknown> = {
    vouchers,
    updated_at: new Date().toISOString(),
  };

  const exists = await ensureEventDocInitialized(eventId, baseEvent, updatePayload);
  if (!exists) return;

  const sanitized = sanitizeFirestoreData(updatePayload);
  await setDoc(eventRef, sanitized, { merge: true });
}

export async function updateEventReferralConfig(
  eventId: string,
  config: {
    referral_enabled?: boolean;
    referral_discount_type?: "percentage" | "fixed";
    referral_discount_percentage?: number | null;
    referral_discount_amount?: number | null;
  },
  baseEvent?: Partial<FirestoreEvent>,
): Promise<void> {
  if (typeof window === "undefined" || !eventId) return;
  const eventRef = doc(db, "events", String(eventId));
  const updatePayload: Record<string, unknown> = {
    ...config,
    updated_at: new Date().toISOString(),
  };

  const exists = await ensureEventDocInitialized(eventId, baseEvent, updatePayload);
  if (!exists) return;

  const sanitized = sanitizeFirestoreData(updatePayload);
  await setDoc(eventRef, sanitized, { merge: true });
}

export async function updateEventBundles(
  eventId: string,
  bundles: EventBundlePackage[],
  baseEvent?: Partial<FirestoreEvent>,
): Promise<void> {
  if (typeof window === "undefined") return;
  const eventRef = doc(db, "events", String(eventId));
  const updatePayload: Record<string, unknown> = {
    bundles,
    updated_at: new Date().toISOString(),
  };

  const exists = await ensureEventDocInitialized(eventId, baseEvent, updatePayload);
  if (!exists) return;

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
  baseEvent?: Partial<FirestoreEvent>,
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

  const exists = await ensureEventDocInitialized(eventId, baseEvent, updatePayload);
  if (!exists) return;

  await setDoc(eventRef, updatePayload, { merge: true });
}

export async function updateEventEmailTemplates(
  eventId: string,
  emailTemplates: EventEmailTemplates,
  baseEvent?: Partial<FirestoreEvent>,
): Promise<void> {
  if (typeof window === "undefined") return;
  const eventRef = doc(db, "events", String(eventId));
  const updatePayload: Record<string, unknown> = {
    email_templates: emailTemplates,
    updated_at: new Date().toISOString(),
  };

  const exists = await ensureEventDocInitialized(eventId, baseEvent, updatePayload);
  if (!exists) return;

  const sanitized = sanitizeFirestoreData(updatePayload);
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

// ── Featured Event (Home Public Page Spotlight) ───────────────────────────

export async function getFeaturedEventContentDoc(): Promise<FeaturedEventContent | null> {
  if (typeof window === "undefined") return null;
  try {
    const docRef = doc(db, "content_settings", "featured_event");
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as FeaturedEventContent;
  } catch (error) {
    console.error("[Firestore] getFeaturedEventContentDoc error:", error);
    return null;
  }
}

export async function saveFeaturedEventContentDoc(content: FeaturedEventContent): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "content_settings", "featured_event");
  const sanitized = sanitizeFirestoreData({
    ...content,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(docRef, sanitized, { merge: true });
}

export function subscribeFeaturedEventContentDoc(
  onUpdate: (content: FeaturedEventContent) => void,
  onError?: (error: Error) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {
      // noop in server or non-window environment
    };
  }
  const docRef = doc(db, "content_settings", "featured_event");
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as FeaturedEventContent);
      }
    },
    (err) => {
      console.warn("[Firestore] subscribeFeaturedEventContentDoc error:", err);
      onError?.(err);
    },
  );
}

// ── Merchandise Delivery Requests ──────────────────────────────────────────

/**
 * Saves or initiates a merchandise delivery request for a registration.
 */
export async function saveMerchandiseDeliveryRequest(
  registrationId: string,
  deliveryRequest: MerchandiseDeliveryRequest,
): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "event_registrations", registrationId);
  const now = new Date().toISOString();
  const sanitized = sanitizeFirestoreData({
    delivery_request: {
      ...deliveryRequest,
      updated_at: now,
    },
    updated_at: now,
  });
  await updateDoc(docRef, sanitized);
}

/**
 * Updates the status and fulfillment details of a merchandise delivery request.
 */
export async function updateMerchandiseDeliveryStatus(
  registrationId: string,
  status: MerchandiseDeliveryStatus,
  details?: Partial<MerchandiseDeliveryRequest>,
): Promise<void> {
  if (typeof window === "undefined") return;
  const docRef = doc(db, "event_registrations", registrationId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error(`Registration ${registrationId} not found`);
  }
  const existing = snap.data() as FirestoreRegistration;
  const existingRequest = existing.delivery_request;
  if (!existingRequest) {
    throw new Error(`Registration ${registrationId} does not have an active delivery request`);
  }

  const now = new Date().toISOString();
  const mergedRequest: MerchandiseDeliveryRequest = {
    ...existingRequest,
    ...(details ?? {}),
    status,
    updated_at: now,
  };

  const sanitized = sanitizeFirestoreData({
    delivery_request: mergedRequest,
    updated_at: now,
  });
  await updateDoc(docRef, sanitized);
}

/**
 * Fetches all registrations for an event that contain a merchandise delivery request.
 */
export async function getEventMerchandiseDeliveryRequests(eventId: string): Promise<FirestoreRegistration[]> {
  const registrations = await getEventRegistrations(eventId);
  return registrations.filter((r) => Boolean(r.delivery_request));
}

/**
 * Updates the merchandise delivery payment environment configuration on the event document.
 */
export async function updateEventMerchandiseDeliveryConfig(
  eventId: string,
  environment: "production" | "sandbox",
  baseEvent?: Partial<FirestoreEvent>,
): Promise<void> {
  if (typeof window === "undefined") return;
  const eventRef = doc(db, "events", String(eventId));
  const updatePayload: Record<string, unknown> = {
    merchandise_delivery_payment_environment: environment,
    updated_at: new Date().toISOString(),
  };

  const exists = await ensureEventDocInitialized(eventId, baseEvent, updatePayload);
  if (!exists) return;

  const sanitized = sanitizeFirestoreData(updatePayload);
  await setDoc(eventRef, sanitized, { merge: true });
}

/**
 * Updates the payment gateway environment and webhook URL override on the event document.
 */
export async function updateEventPaymentConfig(
  eventId: string,
  config: {
    payment_environment: "production" | "sandbox";
    merchandise_delivery_payment_environment?: "production" | "sandbox";
    merchandise_delivery_fee?: number;
    payment_webhook_url?: string | null;
    headerEmailUrl?: string | null;
    header_email_url?: string | null;
    paymentDeadlinesInMinutes?: number | null;
    paymentDeadlineMinutes?: number | null;
    payment_deadline_minutes?: number | null;
    payment_email_template?: string | null;
    paymentEmailTemplate?: string | null;
  },
  baseEvent?: Partial<FirestoreEvent>,
): Promise<void> {
  if (typeof window === "undefined") return;
  const eventRef = doc(db, "events", String(eventId));
  const resolvedHeaderUrl = config.headerEmailUrl ?? config.header_email_url;
  const resolvedDeadline =
    config.paymentDeadlinesInMinutes ?? config.paymentDeadlineMinutes ?? config.payment_deadline_minutes;
  const resolvedEmailTemplate = config.payment_email_template ?? config.paymentEmailTemplate;

  const updatePayload: Record<string, unknown> = {
    payment_environment: config.payment_environment,
    ...(config.merchandise_delivery_payment_environment
      ? { merchandise_delivery_payment_environment: config.merchandise_delivery_payment_environment }
      : {}),
    ...(typeof config.merchandise_delivery_fee === "number"
      ? { merchandise_delivery_fee: config.merchandise_delivery_fee }
      : {}),
    ...(config.payment_webhook_url !== undefined
      ? {
          payment_webhook_url:
            config.payment_webhook_url && config.payment_webhook_url.trim().length > 0
              ? config.payment_webhook_url.trim()
              : deleteField(),
        }
      : {}),
    ...(resolvedHeaderUrl !== undefined
      ? {
          headerEmailUrl:
            resolvedHeaderUrl && resolvedHeaderUrl.trim().length > 0 ? resolvedHeaderUrl.trim() : deleteField(),
          header_email_url:
            resolvedHeaderUrl && resolvedHeaderUrl.trim().length > 0 ? resolvedHeaderUrl.trim() : deleteField(),
        }
      : {}),
    ...(resolvedDeadline !== undefined
      ? {
          paymentDeadlinesInMinutes:
            typeof resolvedDeadline === "number" && resolvedDeadline > 0 ? resolvedDeadline : deleteField(),
          paymentDeadlineMinutes:
            typeof resolvedDeadline === "number" && resolvedDeadline > 0 ? resolvedDeadline : deleteField(),
          payment_deadline_minutes:
            typeof resolvedDeadline === "number" && resolvedDeadline > 0 ? resolvedDeadline : deleteField(),
        }
      : {}),
    ...(resolvedEmailTemplate !== undefined
      ? {
          payment_email_template:
            resolvedEmailTemplate && resolvedEmailTemplate.trim().length > 0
              ? resolvedEmailTemplate.trim()
              : deleteField(),
          paymentEmailTemplate:
            resolvedEmailTemplate && resolvedEmailTemplate.trim().length > 0
              ? resolvedEmailTemplate.trim()
              : deleteField(),
        }
      : {}),
    updated_at: new Date().toISOString(),
  };

  const exists = await ensureEventDocInitialized(eventId, baseEvent, updatePayload);
  if (!exists) return;

  const sanitized = sanitizeFirestoreData(updatePayload);
  await setDoc(eventRef, sanitized, { merge: true });
}

/**
 * Subscribes to real-time updates for an event document in Firestore.
 */
export function subscribeFirestoreEventDoc(
  eventId: string,
  onUpdate: (event: FirestoreEvent) => void,
  onError?: (error: Error) => void,
): () => void {
  if (typeof window === "undefined" || !eventId) {
    return () => {
      // noop in server or non-window environment
    };
  }
  const eventRef = doc(db, "events", String(eventId));
  return onSnapshot(
    eventRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as FirestoreEvent;
        onUpdate({
          ...data,
          id: snap.id,
          tickets: ensureEventTickets(data.tickets),
        });
      }
    },
    (err) => {
      console.warn(`[Firestore] subscribeFirestoreEventDoc error for ${eventId}:`, err);
      onError?.(err);
    },
  );
}
