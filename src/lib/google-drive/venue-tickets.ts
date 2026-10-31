"use client";

import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup } from "firebase/auth";
import { deleteField, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";

import { auth } from "@/config/firebase";
import { db, sanitizeFirestoreData } from "@/lib/firestore/client";
import type { FirestoreRegistration } from "@/lib/firestore/types";

const DRIVE_TOKEN_STORAGE_KEY = "gdg_drive_access_token_v1";
const DRIVE_TOKEN_TTL_MS = 50 * 60 * 1000; // 50 minutes

export interface DriveVenueTicketFile {
  id: string;
  name: string;
  webViewLink: string;
  sequence: number;
}

export interface DriveSpreadsheetItem {
  id: string;
  name: string;
  webViewLink: string;
  modifiedTime?: string;
  viewedByMeTime?: string;
}

export interface DriveVenueTicketGrantedShare {
  fileId: string;
  email: string;
  registrationId: string;
  sharedAt: string;
}

export interface EventVenueTicketConfig {
  id: string;
  event_id: string;
  folder_url: string;
  folder_id: string;
  files: DriveVenueTicketFile[];
  granted_shares?: DriveVenueTicketGrantedShare[];
  venue_guide_url?: string;
  vehicle_ticket_url?: string;
  updated_at: string;
}

export interface VenueTicketAssignmentItem {
  registration: FirestoreRegistration;
  file: DriveVenueTicketFile;
  isExistingAssignment: boolean;
}

export interface VenueTicketAssignmentResult {
  assignments: VenueTicketAssignmentItem[];
  unassignedRegistrants: FirestoreRegistration[];
  unassignedFiles: DriveVenueTicketFile[];
  eligibleRegistrants: FirestoreRegistration[];
  staleRegistrants: FirestoreRegistration[];
}

interface StoredDriveToken {
  accessToken: string;
  expiresAt: number;
  email?: string;
}

export function getCachedDriveAccessToken(expectedEmail?: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRIVE_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDriveToken;
    if (!parsed.accessToken || typeof parsed.expiresAt !== "number") return null;
    if (Date.now() >= parsed.expiresAt) {
      window.sessionStorage.removeItem(DRIVE_TOKEN_STORAGE_KEY);
      return null;
    }
    if (expectedEmail && parsed.email && parsed.email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) {
      return null;
    }
    return parsed.accessToken;
  } catch {
    return null;
  }
}

export function clearCachedDriveAccessToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRIVE_TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export async function requestDriveAccessToken(userEmail?: string | null, forceConsent = false): Promise<string> {
  if (!forceConsent) {
    const cached = getCachedDriveAccessToken(userEmail);
    if (cached) return cached;
  }

  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/drive");
  const hintEmail = userEmail || auth.currentUser?.email || undefined;
  const customParams: Record<string, string> = {};
  if (hintEmail) {
    customParams.login_hint = hintEmail;
  }
  if (forceConsent) {
    customParams.prompt = "consent";
  }
  if (Object.keys(customParams).length > 0) {
    provider.setCustomParameters(customParams);
  }

  const result = auth.currentUser
    ? await reauthenticateWithPopup(auth.currentUser, provider).catch(() => signInWithPopup(auth, provider))
    : await signInWithPopup(auth, provider);

  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (!accessToken) {
    throw new Error("Could not obtain Google Drive access token from Google sign-in.");
  }

  if (typeof window !== "undefined") {
    const payload: StoredDriveToken = {
      accessToken,
      expiresAt: Date.now() + DRIVE_TOKEN_TTL_MS,
      email: result.user?.email ?? hintEmail,
    };
    window.sessionStorage.setItem(DRIVE_TOKEN_STORAGE_KEY, JSON.stringify(payload));
  }

  return accessToken;
}

export function extractDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];

  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export async function listDriveFolderPdfs(folderId: string, accessToken: string): Promise<DriveVenueTicketFile[]> {
  const rawFiles: Array<{ id: string; name: string; webViewLink?: string }> = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
      fields: "nextPageToken, files(id, name, webViewLink)",
      pageSize: "500",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        clearCachedDriveAccessToken();
      }
      const errBody = await res.json().catch(() => ({}));
      const errMsg =
        (errBody as { error?: { message?: string } })?.error?.message || `Google Drive API error (${res.status})`;
      throw new Error(errMsg);
    }

    const data = (await res.json()) as {
      nextPageToken?: string;
      files?: Array<{ id: string; name: string; webViewLink?: string }>;
    };
    if (Array.isArray(data.files)) {
      rawFiles.push(...data.files);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  rawFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  return rawFiles.map((file, idx) => ({
    id: file.id,
    name: file.name,
    webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    sequence: idx + 1,
  }));
}

export async function listDriveSpreadsheets(
  accessToken: string,
  searchQuery?: string,
): Promise<DriveSpreadsheetItem[]> {
  const escapedQuery = (searchQuery || "").trim().replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const qParts = ["mimeType = 'application/vnd.google-apps.spreadsheet'", "trashed = false"];
  if (escapedQuery) {
    qParts.push(`name contains '${escapedQuery}'`);
  }

  const params = new URLSearchParams({
    q: qParts.join(" and "),
    fields: "files(id, name, webViewLink, modifiedTime, viewedByMeTime)",
    orderBy: "viewedByMeTime desc,modifiedTime desc",
    pageSize: "30",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearCachedDriveAccessToken();
    }
    const errBody = await res.json().catch(() => ({}));
    const errMsg =
      (errBody as { error?: { message?: string } })?.error?.message || `Google Drive API error (${res.status})`;
    throw new Error(errMsg);
  }

  const data = (await res.json()) as {
    files?: Array<{
      id: string;
      name: string;
      webViewLink?: string;
      modifiedTime?: string;
      viewedByMeTime?: string;
    }>;
  };

  return (data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
    modifiedTime: f.modifiedTime,
    viewedByMeTime: f.viewedByMeTime,
  }));
}

export async function grantDriveReaderPermission(
  fileId: string,
  emailAddress: string,
  accessToken: string,
): Promise<void> {
  const cleanEmail = emailAddress.trim();
  if (!fileId || !cleanEmail) {
    throw new Error("Missing Drive file ID or recipient email address.");
  }

  const sendPermissionRequest = async (sendNotificationEmail: boolean) => {
    const params = new URLSearchParams({
      sendNotificationEmail: sendNotificationEmail ? "true" : "false",
      supportsAllDrives: "true",
    });
    return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?${params}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "user",
        emailAddress: cleanEmail,
      }),
    });
  };

  let res = await sendPermissionRequest(false);

  // If the target email is not a Google account, Drive API requires sendNotificationEmail=true
  if (!res.ok && res.status === 400) {
    res = await sendPermissionRequest(true);
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearCachedDriveAccessToken();
    }
    const errBody = await res.json().catch(() => ({}));
    const errMsg =
      (errBody as { error?: { message?: string } })?.error?.message || `Failed to grant reader access (${res.status})`;
    throw new Error(errMsg);
  }
}

export async function revokeDriveReaderPermission(
  fileId: string,
  emailAddress: string,
  accessToken: string,
): Promise<boolean> {
  const cleanFileId = fileId.trim();
  const cleanEmail = emailAddress.trim().toLowerCase();
  if (!cleanFileId || !cleanEmail || !accessToken) return false;

  const listParams = new URLSearchParams({
    fields: "permissions(id,emailAddress,role,type)",
    supportsAllDrives: "true",
  });
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanFileId)}/permissions?${listParams}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!listRes.ok) {
    if (listRes.status === 401) {
      clearCachedDriveAccessToken();
      throw new Error("Google Drive session expired (401).");
    }
    if (listRes.status === 404) return true;
    return false;
  }

  const data = (await listRes.json().catch(() => ({}))) as {
    permissions?: Array<{ id?: string; emailAddress?: string; role?: string; type?: string }>;
  };

  const targets = (data.permissions ?? []).filter((p) => {
    if (!p.id || p.role === "owner" || p.role === "organizer" || p.role === "fileOrganizer") return false;
    if (p.emailAddress) {
      return p.emailAddress.trim().toLowerCase() === cleanEmail;
    }
    return false;
  });

  for (const perm of targets) {
    if (!perm.id) continue;
    const delParams = new URLSearchParams({ supportsAllDrives: "true" });
    const delRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanFileId)}/permissions/${encodeURIComponent(perm.id)}?${delParams}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!delRes.ok && delRes.status !== 404) {
      if (delRes.status === 401) {
        clearCachedDriveAccessToken();
        throw new Error("Google Drive session expired (401).");
      }
      return false;
    }
  }

  return true;
}

export async function revokeVenueTicketAccessForItems(
  items: Array<{ fileId?: string | null; email?: string | null; registrationId?: string }>,
  options?: {
    eventId?: string;
    userEmail?: string | null;
    accessToken?: string | null;
    promptIfNeeded?: boolean;
  },
): Promise<{ revokedCount: number; accessToken: string | null }> {
  const validItems: Array<{ fileId: string; email: string; registrationId?: string }> = [];
  const seen = new Set<string>();
  for (const item of items) {
    const fileId = item.fileId?.trim();
    const email = item.email?.trim().toLowerCase();
    if (!fileId || !email) continue;
    const key = `${fileId}::${email}`;
    if (seen.has(key)) continue;
    seen.add(key);
    validItems.push({ fileId, email, registrationId: item.registrationId });
  }

  if (validItems.length === 0) {
    return { revokedCount: 0, accessToken: options?.accessToken ?? null };
  }

  let token = options?.accessToken || getCachedDriveAccessToken(options?.userEmail);
  if (!token && options?.promptIfNeeded !== false) {
    try {
      token = await requestDriveAccessToken(options?.userEmail);
    } catch (err) {
      console.warn("[revokeVenueTicketAccessForItems] Could not acquire Drive token:", err);
      return { revokedCount: 0, accessToken: null };
    }
  }

  if (!token) {
    return { revokedCount: 0, accessToken: null };
  }

  let revokedCount = 0;
  const revokedKeys = new Set<string>();

  for (const target of validItems) {
    try {
      const ok = await revokeDriveReaderPermission(target.fileId, target.email, token).catch(async () => {
        if (options?.promptIfNeeded === false) return false;
        token = await requestDriveAccessToken(options?.userEmail, true);
        return revokeDriveReaderPermission(target.fileId, target.email, token);
      });
      if (ok) {
        revokedCount += 1;
        revokedKeys.add(`${target.fileId}::${target.email}`);
      }
    } catch (err) {
      console.warn(`[revokeVenueTicketAccessForItems] Failed revoking ${target.email} on ${target.fileId}:`, err);
    }
  }

  if (options?.eventId && revokedKeys.size > 0) {
    await removeVenueTicketGrantedShares(options.eventId, revokedKeys);
  }

  return { revokedCount, accessToken: token };
}

export function isEligibleForVenueTicket(reg: FirestoreRegistration): boolean {
  const isRefundCompleted = reg.refund_request?.status === "refund_completed" || reg.payment_status === "refunded";
  if (isRefundCompleted) return false;

  const status = String(reg.status || "").toLowerCase();
  if (status === "canceled" || status === "cancelled" || status === "rejected" || status === "expired") {
    return false;
  }

  return (
    status === "approved" ||
    status === "paid_and_registered" ||
    status === "paid_registered" ||
    status === "registered" ||
    status === "attended"
  );
}

function getRegistrationTimestampMs(reg: FirestoreRegistration): number {
  if (typeof reg.registered_at_millis === "number" && Number.isFinite(reg.registered_at_millis)) {
    return reg.registered_at_millis;
  }
  if (reg.registered_at) {
    const parsed = new Date(reg.registered_at).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Number.MAX_SAFE_INTEGER;
}

export function sortEligibleRegistrantsByTime(registrations: FirestoreRegistration[]): FirestoreRegistration[] {
  return registrations
    .filter(isEligibleForVenueTicket)
    .slice()
    .sort((a, b) => {
      const diff = getRegistrationTimestampMs(a) - getRegistrationTimestampMs(b);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
}

/**
 * Deterministic 1-to-1 Venue Ticket mapping:
 * 1. Sorts eligible registrants (approved / paid_and_registered / registered / attended) by registration time ascending.
 * 2. Preserves assignments that were already delivered (`venue_ticket_sent_at`), or all existing assignments when `preserveUnsent` is true.
 * 3. Assigns remaining available files in natural sequence order to unassigned eligible registrants.
 * 4. Identifies cancelled/ineligible or overflow registrations that still hold a stale `venue_ticket_file_id`.
 */
export function computeSequencePdfAssignments(
  registrations: FirestoreRegistration[],
  driveFiles: DriveVenueTicketFile[],
  options?: { preserveUnsent?: boolean },
): VenueTicketAssignmentResult {
  const preserveUnsent = options?.preserveUnsent ?? false;
  const eligibleRegistrants = sortEligibleRegistrantsByTime(registrations);
  const eligibleIds = new Set(eligibleRegistrants.map((r) => r.id));
  const filesById = new Map(driveFiles.map((f) => [f.id, f]));
  const usedFileIds = new Set<string>();
  const assignedRegIds = new Set<string>();
  const assignmentsByRegId = new Map<string, VenueTicketAssignmentItem>();

  // Pass 1: preserve already-sent (or optionally unsent) valid assignments on eligible registrants
  for (const reg of eligibleRegistrants) {
    const existingFileId = reg.venue_ticket_file_id?.trim();
    const shouldPreserve = preserveUnsent || Boolean(reg.venue_ticket_sent_at);
    if (shouldPreserve && existingFileId && filesById.has(existingFileId) && !usedFileIds.has(existingFileId)) {
      const file = filesById.get(existingFileId)!;
      usedFileIds.add(file.id);
      assignedRegIds.add(reg.id);
      assignmentsByRegId.set(reg.id, {
        registration: reg,
        file,
        isExistingAssignment: true,
      });
    }
  }

  // Pass 2: assign remaining files in sequence order to unassigned eligible registrants
  const availableFiles = driveFiles.filter((f) => !usedFileIds.has(f.id));
  let fileCursor = 0;

  for (const reg of eligibleRegistrants) {
    if (assignedRegIds.has(reg.id)) continue;
    const nextFile = availableFiles[fileCursor];
    if (!nextFile) break;
    fileCursor += 1;
    usedFileIds.add(nextFile.id);
    assignedRegIds.add(reg.id);
    assignmentsByRegId.set(reg.id, {
      registration: reg,
      file: nextFile,
      isExistingAssignment: reg.venue_ticket_file_id === nextFile.id,
    });
  }

  const assignments = eligibleRegistrants
    .map((reg) => assignmentsByRegId.get(reg.id))
    .filter((item): item is VenueTicketAssignmentItem => Boolean(item));

  const unassignedRegistrants = eligibleRegistrants.filter((reg) => !assignedRegIds.has(reg.id));
  const unassignedFiles = driveFiles.filter((f) => !usedFileIds.has(f.id));
  const staleRegistrants = registrations.filter(
    (reg) =>
      Boolean(reg.venue_ticket_file_id) &&
      (!eligibleIds.has(reg.id) || (!assignedRegIds.has(reg.id) && !reg.venue_ticket_sent_at)),
  );

  return {
    assignments,
    unassignedRegistrants,
    unassignedFiles,
    eligibleRegistrants,
    staleRegistrants,
  };
}

export async function getEventVenueTicketConfig(eventId: string): Promise<EventVenueTicketConfig | null> {
  if (!db || !eventId) return null;
  try {
    const docId = `venue_tickets_${eventId}`;
    const snap = await getDoc(doc(db, "system_settings", docId));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<EventVenueTicketConfig>;
    return {
      id: docId,
      event_id: String(data.event_id || eventId),
      folder_url: String(data.folder_url || ""),
      folder_id: String(data.folder_id || ""),
      files: Array.isArray(data.files) ? data.files : [],
      granted_shares: Array.isArray(data.granted_shares) ? data.granted_shares : [],
      venue_guide_url: data.venue_guide_url ? String(data.venue_guide_url) : undefined,
      vehicle_ticket_url: data.vehicle_ticket_url ? String(data.vehicle_ticket_url) : undefined,
      updated_at: String(data.updated_at || ""),
    };
  } catch (err) {
    console.warn("[getEventVenueTicketConfig] Could not load venue ticket config:", err);
    return null;
  }
}

export async function recordVenueTicketGrantedShare(
  eventId: string,
  share: DriveVenueTicketGrantedShare,
): Promise<void> {
  if (!db || !eventId || !share.fileId || !share.email) return;
  try {
    const docId = `venue_tickets_${eventId}`;
    const ref = doc(db, "system_settings", docId);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as Partial<EventVenueTicketConfig>) : {};
    const list = Array.isArray(existing.granted_shares) ? [...existing.granted_shares] : [];
    const cleanEmail = share.email.trim().toLowerCase();
    const cleanFileId = share.fileId.trim();
    const filtered = list.filter((s) => !(s.fileId === cleanFileId && s.email.trim().toLowerCase() === cleanEmail));
    filtered.push({
      fileId: cleanFileId,
      email: cleanEmail,
      registrationId: share.registrationId,
      sharedAt: share.sharedAt,
    });
    await setDoc(
      ref,
      sanitizeFirestoreData({
        id: docId,
        event_id: eventId,
        granted_shares: filtered,
        updated_at: new Date().toISOString(),
      }),
      { merge: true },
    );
  } catch (err) {
    console.warn("[recordVenueTicketGrantedShare] Failed to record granted share:", err);
  }
}

export async function removeVenueTicketGrantedShares(eventId: string, revokedKeys: Set<string>): Promise<void> {
  if (!db || !eventId || revokedKeys.size === 0) return;
  try {
    const docId = `venue_tickets_${eventId}`;
    const ref = doc(db, "system_settings", docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const existing = snap.data() as Partial<EventVenueTicketConfig>;
    const list = Array.isArray(existing.granted_shares) ? existing.granted_shares : [];
    const nextList = list.filter((s) => !revokedKeys.has(`${s.fileId.trim()}::${s.email.trim().toLowerCase()}`));
    if (nextList.length !== list.length) {
      await setDoc(
        ref,
        sanitizeFirestoreData({
          granted_shares: nextList,
          updated_at: new Date().toISOString(),
        }),
        { merge: true },
      );
    }
  } catch (err) {
    console.warn("[removeVenueTicketGrantedShares] Failed to update granted shares:", err);
  }
}

export function findOrphanedVenueTicketShares(
  registrations: FirestoreRegistration[],
  config?: EventVenueTicketConfig | null,
): Array<{ fileId: string; email: string; registrationId?: string }> {
  const activePairs = new Set<string>();
  for (const reg of registrations) {
    if (isEligibleForVenueTicket(reg) && reg.venue_ticket_file_id && reg.member_email) {
      activePairs.add(`${reg.venue_ticket_file_id.trim()}::${reg.member_email.trim().toLowerCase()}`);
    }
  }

  const toRevoke: Array<{ fileId: string; email: string; registrationId?: string }> = [];
  for (const reg of registrations) {
    if (!isEligibleForVenueTicket(reg) && reg.venue_ticket_file_id && reg.member_email) {
      const key = `${reg.venue_ticket_file_id.trim()}::${reg.member_email.trim().toLowerCase()}`;
      if (!activePairs.has(key)) {
        toRevoke.push({
          fileId: reg.venue_ticket_file_id,
          email: reg.member_email,
          registrationId: reg.id,
        });
      }
    }
  }

  for (const share of config?.granted_shares ?? []) {
    const key = `${share.fileId.trim()}::${share.email.trim().toLowerCase()}`;
    if (!activePairs.has(key)) {
      toRevoke.push({
        fileId: share.fileId,
        email: share.email,
        registrationId: share.registrationId,
      });
    }
  }

  return toRevoke;
}

export async function saveEventVenueTicketConfig(
  eventId: string,
  folderUrl: string,
  folderId: string,
  files: DriveVenueTicketFile[],
  links?: { venueGuideUrl?: string; vehicleTicketUrl?: string },
): Promise<EventVenueTicketConfig> {
  const docId = `venue_tickets_${eventId}`;
  const existing = await getEventVenueTicketConfig(eventId);
  const config: EventVenueTicketConfig = {
    id: docId,
    event_id: eventId,
    folder_url: folderUrl.trim(),
    folder_id: folderId,
    files,
    granted_shares: existing?.granted_shares ?? [],
    venue_guide_url: links?.venueGuideUrl?.trim() || undefined,
    vehicle_ticket_url: links?.vehicleTicketUrl?.trim() || undefined,
    updated_at: new Date().toISOString(),
  };
  await setDoc(doc(db, "system_settings", docId), sanitizeFirestoreData(config), { merge: true });
  return config;
}

export async function saveRegistrationVenueTicketAssignments(
  items: VenueTicketAssignmentItem[],
  staleRegistrations: FirestoreRegistration[] = [],
): Promise<Map<string, Partial<FirestoreRegistration>>> {
  const updatesByRegId = new Map<string, Partial<FirestoreRegistration>>();
  const now = new Date().toISOString();

  const toWrite = items.filter(
    ({ registration, file }) =>
      registration.venue_ticket_file_id !== file.id ||
      registration.venue_ticket_file_name !== file.name ||
      registration.venue_ticket_url !== file.webViewLink ||
      registration.venue_ticket_sequence !== file.sequence,
  );

  type BatchOp =
    | { kind: "assign"; registration: FirestoreRegistration; file: DriveVenueTicketFile }
    | { kind: "clear"; registration: FirestoreRegistration };

  const ops: BatchOp[] = [
    ...toWrite.map(({ registration, file }): BatchOp => ({ kind: "assign", registration, file })),
    ...staleRegistrations.map((registration): BatchOp => ({ kind: "clear", registration })),
  ];

  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.kind === "clear") {
        const clearedPatch: Partial<FirestoreRegistration> = {
          venue_ticket_file_id: undefined,
          venue_ticket_file_name: undefined,
          venue_ticket_url: undefined,
          venue_ticket_sequence: undefined,
          venue_ticket_assigned_at: undefined,
          venue_ticket_shared_at: undefined,
          venue_ticket_sent_at: undefined,
        };
        updatesByRegId.set(op.registration.id, clearedPatch);
        batch.update(doc(db, "event_registrations", op.registration.id), {
          venue_ticket_file_id: deleteField(),
          venue_ticket_file_name: deleteField(),
          venue_ticket_url: deleteField(),
          venue_ticket_sequence: deleteField(),
          venue_ticket_assigned_at: deleteField(),
          venue_ticket_shared_at: deleteField(),
          venue_ticket_sent_at: deleteField(),
        });
        continue;
      }

      const { registration, file } = op;
      const fileChanged = registration.venue_ticket_file_id !== file.id;
      const patch: Partial<FirestoreRegistration> = {
        venue_ticket_file_id: file.id,
        venue_ticket_file_name: file.name,
        venue_ticket_url: file.webViewLink,
        venue_ticket_sequence: file.sequence,
        venue_ticket_assigned_at: fileChanged ? now : (registration.venue_ticket_assigned_at ?? now),
      };
      updatesByRegId.set(registration.id, patch);

      const firestorePayload: Record<string, unknown> = {
        ...patch,
      };
      if (fileChanged) {
        firestorePayload.venue_ticket_shared_at = deleteField();
        firestorePayload.venue_ticket_sent_at = deleteField();
        patch.venue_ticket_shared_at = undefined;
        patch.venue_ticket_sent_at = undefined;
      }

      batch.update(doc(db, "event_registrations", registration.id), sanitizeFirestoreData(firestorePayload));
    }
    await batch.commit();
  }

  return updatesByRegId;
}

export async function assignSingleRegistrationVenueTicket(
  registrationId: string,
  file: DriveVenueTicketFile | null,
): Promise<Partial<FirestoreRegistration>> {
  const ref = doc(db, "event_registrations", registrationId);
  if (!file) {
    await updateDoc(ref, {
      venue_ticket_file_id: deleteField(),
      venue_ticket_file_name: deleteField(),
      venue_ticket_url: deleteField(),
      venue_ticket_sequence: deleteField(),
      venue_ticket_assigned_at: deleteField(),
      venue_ticket_shared_at: deleteField(),
      venue_ticket_sent_at: deleteField(),
    });
    return {
      venue_ticket_file_id: undefined,
      venue_ticket_file_name: undefined,
      venue_ticket_url: undefined,
      venue_ticket_sequence: undefined,
      venue_ticket_assigned_at: undefined,
      venue_ticket_shared_at: undefined,
      venue_ticket_sent_at: undefined,
    };
  }

  const now = new Date().toISOString();
  const patch: Partial<FirestoreRegistration> = {
    venue_ticket_file_id: file.id,
    venue_ticket_file_name: file.name,
    venue_ticket_url: file.webViewLink,
    venue_ticket_sequence: file.sequence,
    venue_ticket_assigned_at: now,
    venue_ticket_shared_at: undefined,
    venue_ticket_sent_at: undefined,
  };

  await updateDoc(ref, {
    venue_ticket_file_id: file.id,
    venue_ticket_file_name: file.name,
    venue_ticket_url: file.webViewLink,
    venue_ticket_sequence: file.sequence,
    venue_ticket_assigned_at: now,
    venue_ticket_shared_at: deleteField(),
    venue_ticket_sent_at: deleteField(),
  });

  return patch;
}

export async function markRegistrationVenueTicketDelivered(
  registrationId: string,
  options: { sharedAt?: string; sentAt?: string },
): Promise<Partial<FirestoreRegistration>> {
  const patch: Partial<FirestoreRegistration> = {};
  if (options.sharedAt) patch.venue_ticket_shared_at = options.sharedAt;
  if (options.sentAt) patch.venue_ticket_sent_at = options.sentAt;
  await updateDoc(doc(db, "event_registrations", registrationId), sanitizeFirestoreData(patch));
  return patch;
}
