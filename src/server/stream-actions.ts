"use server";

import { parseVideoUrl } from "@/lib/events/media-utils";
import {
  checkOtpRateLimit,
  deriveStreamCodeDocId,
  type EventStreamCodeDoc,
  type EventStreamPrivateDoc,
  type EventStreamPublicDoc,
  type EventStreamSessionDoc,
  escapeStreamHtml,
  generateStreamOtpCode,
  generateStreamSessionId,
  hashStreamEmail,
  hashStreamEmailsBatch,
  hashStreamOtpCode,
  isValidStreamEmail,
  isValidStreamEventId,
  maskStreamEmail,
  normalizeStreamEmail,
  parseWhitelistEmails,
  STREAM_OTP_MAX_ATTEMPTS,
  STREAM_OTP_TTL_MS,
  type StreamAccessMode,
  sealStreamVideoId,
  timingSafeEqualHex,
  unsealStreamVideoId,
} from "@/lib/events/stream-access";
import { getAuthenticatedSessionUser, isAuthorizedOrganizerSession } from "@/server/auth-guard";
import { sendEmailDirectInternal } from "@/server/email-template-actions";
import {
  batchCommitFirestoreWrites,
  commitFirestoreDocIfMatch,
  getFirestoreDoc,
  getFirestoreDocWithMeta,
  patchFirestoreDocDetailed,
  queryFirestoreDocs,
} from "@/server/firestore-admin";

const APPROVED_REGISTRANT_STATUSES = new Set(["approved", "paid_and_registered", "attended", "checked_in"]);

/**
 * Resolves the dedicated server-only stream signing/encryption secret (SEC-3: no fallback to third-party keys).
 */
function getStreamServerSecret(): string {
  const secret = (process.env.STREAM_ACCESS_SECRET || "").trim();
  if (!secret) {
    throw new Error("Server stream signing secret (STREAM_ACCESS_SECRET) is not configured.");
  }
  return secret;
}

export interface OrganizerStreamConfigView {
  eventId: string;
  enabled: boolean;
  title: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  accessMode: StreamAccessMode;
  watermarkEnabled: boolean;
  includeApprovedRegistrants: boolean;
  manualWhitelistEmails: string[];
  whitelistCount: number;
  updatedAt: string | null;
  updatedBy: string | null;
  sessions: EventStreamSessionDoc[];
}

export interface SaveEventStreamConfigInput {
  eventId: string;
  enabled: boolean;
  title: string;
  youtubeUrl: string;
  accessMode: StreamAccessMode;
  watermarkEnabled: boolean;
  includeApprovedRegistrants: boolean;
  manualWhitelistRaw: string;
}

export interface PublicEventStreamMeta {
  enabled: boolean;
  title: string;
  accessMode: StreamAccessMode;
  watermarkEnabled: boolean;
  publicYoutubeVideoId?: string | null;
}

/**
 * Checks whether an email hash is currently whitelisted (supports O(1) subcollection and legacy inline array).
 */
async function isEmailHashWhitelisted(
  eventId: string,
  emailHash: string,
  streamDoc: EventStreamPublicDoc,
): Promise<boolean> {
  if (streamDoc.whitelist_storage === "subcollection") {
    const doc = await getFirestoreDoc(`event_streams/${encodeURIComponent(eventId)}/whitelist`, emailHash);
    return Boolean(doc && doc.email_hash === emailHash);
  }
  const inline = Array.isArray(streamDoc.whitelist_email_hashes) ? streamDoc.whitelist_email_hashes : [];
  return inline.includes(emailHash);
}

/**
 * Fetches approved/paid/attended registrant emails using field projection + pagination past 5,000 docs (PERF-2).
 */
async function fetchApprovedRegistrantEmails(eventId: string): Promise<string[]> {
  const PAGE_SIZE = 2500;
  const MAX_PAGES = 20; // Up to 50,000 registrations
  const emails = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const docs = await queryFirestoreDocs<Record<string, unknown>>(
      "event_registrations",
      [
        {
          fieldFilter: {
            field: { fieldPath: "event_id" },
            op: "EQUAL",
            value: { stringValue: String(eventId) },
          },
        },
      ],
      PAGE_SIZE,
      undefined,
      {
        selectFields: ["status", "member_email", "email"],
        offset: page * PAGE_SIZE,
      },
    );

    for (const doc of docs) {
      const status = String(doc.status ?? "").toLowerCase();
      if (!APPROVED_REGISTRANT_STATUSES.has(status)) continue;
      const rawEmail = String(doc.member_email ?? doc.email ?? "").trim();
      if (rawEmail && isValidStreamEmail(rawEmail)) {
        emails.add(normalizeStreamEmail(rawEmail));
      }
    }

    if (docs.length < PAGE_SIZE) break;
  }

  return Array.from(emails);
}

/**
 * Fetches active sessions first plus recent sessions so active viewers are never hidden by old expired sessions (PERF-6).
 */
async function fetchEventStreamSessions(eventId: string): Promise<EventStreamSessionDoc[]> {
  const [activeSessions, recentSessions] = await Promise.all([
    queryFirestoreDocs<EventStreamSessionDoc>(
      "event_stream_sessions",
      [
        {
          fieldFilter: {
            field: { fieldPath: "event_id" },
            op: "EQUAL",
            value: { stringValue: String(eventId) },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: "status" },
            op: "EQUAL",
            value: { stringValue: "active" },
          },
        },
      ],
      200,
    ),
    queryFirestoreDocs<EventStreamSessionDoc>(
      "event_stream_sessions",
      [
        {
          fieldFilter: {
            field: { fieldPath: "event_id" },
            op: "EQUAL",
            value: { stringValue: String(eventId) },
          },
        },
      ],
      100,
    ),
  ]);

  const merged = new Map<string, EventStreamSessionDoc>();
  for (const s of [...activeSessions, ...recentSessions]) {
    if (s.id) merged.set(s.id, s);
  }
  return Array.from(merged.values()).sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return (b.started_at ?? 0) - (a.started_at ?? 0);
  });
}

/**
 * Organizer-only: Load full stream config (including plaintext URL & manual whitelist) + sessions.
 */
export async function getEventStreamConfigAction(
  eventId: string,
): Promise<{ success: true; data: OrganizerStreamConfigView } | { success: false; error: string }> {
  if (!isValidStreamEventId(eventId)) {
    return { success: false, error: "Invalid event ID." };
  }
  const isAuth = await isAuthorizedOrganizerSession();
  if (!isAuth) {
    return { success: false, error: "Unauthorized. Organizer session required." };
  }

  try {
    const [publicDoc, privateDoc, sessions] = await Promise.all([
      getFirestoreDoc("event_streams", eventId) as Promise<EventStreamPublicDoc | null>,
      getFirestoreDoc("event_streams_private", eventId) as Promise<EventStreamPrivateDoc | null>,
      fetchEventStreamSessions(eventId),
    ]);

    return {
      success: true,
      data: {
        eventId,
        enabled: Boolean(publicDoc?.enabled ?? false),
        title: String(publicDoc?.title ?? ""),
        youtubeUrl: String(privateDoc?.youtube_url ?? ""),
        youtubeVideoId: String(privateDoc?.youtube_video_id ?? publicDoc?.public_youtube_video_id ?? ""),
        accessMode: publicDoc?.access_mode === "whitelisted" ? "whitelisted" : "public",
        watermarkEnabled: publicDoc?.watermark_enabled ?? true,
        includeApprovedRegistrants: publicDoc?.include_approved_registrants ?? true,
        manualWhitelistEmails: Array.isArray(privateDoc?.manual_whitelist_emails)
          ? privateDoc.manual_whitelist_emails
          : [],
        whitelistCount: Number(publicDoc?.whitelist_count ?? 0),
        updatedAt: publicDoc?.updated_at ?? null,
        updatedBy: publicDoc?.updated_by ?? null,
        sessions,
      },
    };
  } catch (err) {
    console.error("[Stream] Failed loading organizer config:", err);
    return { success: false, error: "Failed to load stream configuration." };
  }
}

/**
 * Organizer-only: Refresh only the viewing sessions list without overwriting unsaved form edits (BUG-2).
 */
export async function listEventStreamSessionsAction(
  eventId: string,
): Promise<{ success: true; sessions: EventStreamSessionDoc[] } | { success: false; error: string }> {
  if (!isValidStreamEventId(eventId)) {
    return { success: false, error: "Invalid event ID." };
  }
  const isAuth = await isAuthorizedOrganizerSession();
  if (!isAuth) {
    return { success: false, error: "Unauthorized." };
  }
  try {
    const sessions = await fetchEventStreamSessions(eventId);
    return { success: true, sessions };
  } catch (err) {
    console.error("[Stream] Failed refreshing sessions:", err);
    return { success: false, error: "Failed to refresh viewing sessions." };
  }
}

/**
 * Organizer-only: Save stream config, seal YouTube video ID with eventId AAD, and sync O(1) whitelist subcollection (PERF-1/PERF-3).
 */
export async function saveEventStreamConfigAction(
  input: SaveEventStreamConfigInput,
): Promise<{ success: true; whitelistCount: number; syncedRegistrants: number } | { success: false; error: string }> {
  if (!isValidStreamEventId(input.eventId)) {
    return { success: false, error: "Invalid event ID." };
  }
  const isAuth = await isAuthorizedOrganizerSession();
  if (!isAuth) {
    return { success: false, error: "Unauthorized. Organizer session required." };
  }

  try {
    const trimmedUrl = input.youtubeUrl.trim();
    let videoId = "";

    if (trimmedUrl) {
      const parsed = parseVideoUrl(trimmedUrl);
      if (!parsed || parsed.type !== "youtube" || !parsed.videoId) {
        return {
          success: false,
          error: "Please enter a valid YouTube stream or video URL (youtube.com/watch, youtu.be, or youtube.com/live).",
        };
      }
      videoId = parsed.videoId;
    } else if (input.enabled) {
      return { success: false, error: "A YouTube URL is required when the stream is enabled." };
    }

    const { valid: manualEmails, invalid: invalidEmails } = parseWhitelistEmails(input.manualWhitelistRaw);
    if (invalidEmails.length > 0) {
      return {
        success: false,
        error: `Invalid email address(es): ${invalidEmails.slice(0, 5).join(", ")}${invalidEmails.length > 5 ? "…" : ""}`,
      };
    }

    const registrantEmails = input.includeApprovedRegistrants ? await fetchApprovedRegistrantEmails(input.eventId) : [];
    const combinedEmails = Array.from(new Set([...manualEmails, ...registrantEmails]));

    if (combinedEmails.length > 10000) {
      return { success: false, error: "Whitelist exceeds the maximum limit of 10,000 emails." };
    }

    const secret = getStreamServerSecret();
    const sessionUser = await getAuthenticatedSessionUser();
    const nowIso = new Date().toISOString();

    const targetHashes =
      input.accessMode === "whitelisted"
        ? await hashStreamEmailsBatch(secret, input.eventId, combinedEmails)
        : [];
    const targetHashSet = new Set(targetHashes);

    // Sync O(1) whitelist subcollection diff (PERF-1: keeps main event_streams doc < 2 KB)
    const existingSubDocs = await queryFirestoreDocs<{ id: string }>(
      "whitelist",
      undefined,
      10000,
      undefined,
      {
        selectFields: ["email_hash"],
        parentPath: `event_streams/${encodeURIComponent(input.eventId)}`,
      },
    );
    const existingHashSet = new Set(existingSubDocs.map((d) => d.id));

    const batchOps: Array<
      | { type: "set"; docPath: string; data: Record<string, unknown> }
      | { type: "delete"; docPath: string }
    > = [];

    for (const hash of targetHashSet) {
      if (!existingHashSet.has(hash)) {
        batchOps.push({
          type: "set",
          docPath: `event_streams/${input.eventId}/whitelist/${hash}`,
          data: { event_id: input.eventId, email_hash: hash, updated_at: nowIso },
        });
      }
    }
    for (const oldHash of existingHashSet) {
      if (!targetHashSet.has(oldHash)) {
        batchOps.push({
          type: "delete",
          docPath: `event_streams/${input.eventId}/whitelist/${oldHash}`,
        });
      }
    }

    if (batchOps.length > 0) {
      const batchRes = await batchCommitFirestoreWrites(batchOps);
      if (!batchRes.ok) {
        return { success: false, error: batchRes.error || "Failed to sync whitelist entries." };
      }
    }

    const sealedVideoId =
      input.accessMode === "whitelisted" && videoId
        ? await sealStreamVideoId(secret, videoId, input.eventId)
        : null;

    const publicDoc: EventStreamPublicDoc = {
      event_id: input.eventId,
      enabled: Boolean(input.enabled),
      title: input.title.trim().slice(0, 200),
      access_mode: input.accessMode,
      watermark_enabled: Boolean(input.watermarkEnabled),
      include_approved_registrants: Boolean(input.includeApprovedRegistrants),
      public_youtube_video_id: input.accessMode === "public" && videoId ? videoId : null,
      sealed_video_id: sealedVideoId,
      whitelist_storage: "subcollection",
      whitelist_email_hashes: [],
      whitelist_count: combinedEmails.length,
      updated_at: nowIso,
      updated_by: sessionUser?.email ?? null,
    };

    const privateDoc: EventStreamPrivateDoc = {
      event_id: input.eventId,
      youtube_url: trimmedUrl,
      youtube_video_id: videoId,
      manual_whitelist_emails: manualEmails,
      updated_at: nowIso,
      updated_by: sessionUser?.email ?? null,
    };

    const [pubRes, privRes] = await Promise.all([
      patchFirestoreDocDetailed("event_streams", input.eventId, publicDoc as unknown as Record<string, unknown>, false),
      patchFirestoreDocDetailed(
        "event_streams_private",
        input.eventId,
        privateDoc as unknown as Record<string, unknown>,
        false,
      ),
    ]);

    if (!pubRes.ok || !privRes.ok) {
      return {
        success: false,
        error: pubRes.error || privRes.error || "Failed to save stream configuration to Firestore.",
      };
    }

    return {
      success: true,
      whitelistCount: combinedEmails.length,
      syncedRegistrants: registrantEmails.length,
    };
  } catch (err) {
    console.error("[Stream] Failed saving config:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save stream configuration.",
    };
  }
}

/**
 * Organizer-only: Immediately revoke a viewer's active stream session.
 */
export async function revokeStreamSessionAction(
  eventId: string,
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isValidStreamEventId(eventId) || !/^strm_[a-f0-9]{32}$/.test(sessionId)) {
    return { success: false, error: "Invalid event or session ID." };
  }
  const isAuth = await isAuthorizedOrganizerSession();
  if (!isAuth) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const doc = (await getFirestoreDoc("event_stream_sessions", sessionId)) as EventStreamSessionDoc | null;
    if (!doc || doc.event_id !== eventId) {
      return { success: false, error: "Session not found." };
    }
    const now = Date.now();
    const res = await patchFirestoreDocDetailed(
      "event_stream_sessions",
      sessionId,
      {
        status: "revoked",
        last_heartbeat_at: now,
        ended_at: now,
      },
      true,
    );
    return res.ok ? { success: true } : { success: false, error: res.error ?? "Failed to revoke session." };
  } catch (err) {
    console.error("[Stream] Failed revoking session:", err);
    return { success: false, error: "Failed to revoke session." };
  }
}

/**
 * Public: Returns safe stream metadata for `/events/[eventId]/watch`.
 * Never exposes `sealed_video_id` or `whitelist_email_hashes`; only returns `publicYoutubeVideoId` if `access_mode === "public"`.
 */
export async function getPublicEventStreamMetaAction(eventId: string): Promise<PublicEventStreamMeta | null> {
  if (!isValidStreamEventId(eventId)) return null;
  try {
    const doc = (await getFirestoreDoc("event_streams", eventId)) as EventStreamPublicDoc | null;
    if (!doc || !doc.enabled) return null;

    return {
      enabled: true,
      title: doc.title || "",
      accessMode: doc.access_mode === "whitelisted" ? "whitelisted" : "public",
      watermarkEnabled: doc.watermark_enabled ?? true,
      publicYoutubeVideoId: doc.access_mode === "public" ? (doc.public_youtube_video_id ?? null) : null,
    };
  } catch (err) {
    console.error("[Stream] Failed reading public stream metadata:", err);
    return null;
  }
}

/**
 * Public: Request a single-use email OTP code for a whitelisted stream.
 * Uses atomic CAS (`commitFirestoreDocIfMatch`) to prevent concurrent rate-limit bypass (SEC-1)
 * and only revokes prior sessions after email delivery succeeds (CHAL-4).
 */
export async function requestStreamAccessCodeAction(
  eventId: string,
  rawEmail: string,
  eventTitle?: string,
): Promise<{ success: boolean; message?: string; error?: string; retryAfterSec?: number }> {
  try {
    if (!isValidStreamEventId(eventId)) {
      return { success: false, error: "Invalid event ID." };
    }
    const email = normalizeStreamEmail(rawEmail);
    if (!isValidStreamEmail(email)) {
      return { success: false, error: "Please enter a valid email address." };
    }

    const secret = getStreamServerSecret();
    const [streamDoc, emailHash, codeDocId] = await Promise.all([
      getFirestoreDoc("event_streams", eventId) as Promise<EventStreamPublicDoc | null>,
      hashStreamEmail(secret, eventId, email),
      deriveStreamCodeDocId(secret, eventId, email),
    ]);

    if (!streamDoc || !streamDoc.enabled || streamDoc.access_mode !== "whitelisted") {
      return { success: false, error: "This stream is not currently accepting access codes." };
    }

    const [whitelisted, existingMeta] = await Promise.all([
      isEmailHashWhitelisted(eventId, emailHash, streamDoc),
      getFirestoreDocWithMeta("event_stream_codes", codeDocId),
    ]);

    if (!whitelisted) {
      return {
        success: false,
        error: "This email is not on the approved whitelist for this stream. Please contact the event organizer.",
      };
    }

    const existingCode = existingMeta.data as EventStreamCodeDoc | null;
    const now = Date.now();
    const rateCheck = checkOtpRateLimit(
      Array.isArray(existingCode?.rate_limit_timestamps) ? existingCode.rate_limit_timestamps : [],
      now,
    );
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: rateCheck.reason,
        retryAfterSec: rateCheck.retryAfterSec,
      };
    }

    const otpCode = generateStreamOtpCode(6);
    const codeHash = await hashStreamOtpCode(secret, eventId, email, otpCode);
    const priorSessionId = existingCode?.active_session_id ?? null;

    const newCodeDoc: EventStreamCodeDoc = {
      id: codeDocId,
      event_id: eventId,
      email_hash: emailHash,
      code_hash: codeHash,
      status: "pending",
      attempts: 0,
      expires_at: now + STREAM_OTP_TTL_MS,
      created_at: now,
      rate_limit_timestamps: rateCheck.updatedTimestamps,
      active_session_id: priorSessionId,
      redeemed_at: null,
    };

    // Atomic CAS write prevents concurrent OTP request bursts from bypassing rate limits (SEC-1)
    const writeRes = await commitFirestoreDocIfMatch(
      "event_stream_codes",
      codeDocId,
      newCodeDoc as unknown as Record<string, unknown>,
      existingMeta.updateTime,
      false,
    );
    if (!writeRes.ok) {
      if (writeRes.conflict) {
        return {
          success: false,
          error: "A code request is already in progress. Please wait 60 seconds before trying again.",
          retryAfterSec: 60,
        };
      }
      return { success: false, error: "Could not issue access code right now. Please try again." };
    }

    const safeTitle = escapeStreamHtml((streamDoc.title || eventTitle || "GDG Jakarta Stream").slice(0, 200));
    const watchUrl = `https://gdgjakarta.com/events/${encodeURIComponent(eventId)}/watch`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="margin: 0 0 12px; font-size: 20px;">Your Single-Use Stream Access Code</h2>
          <p style="margin: 0 0 16px; color: #4b5563;">Use the one-time code below to unlock <strong>${safeTitle}</strong>. This code expires in <strong>10 minutes</strong> and becomes invalid as soon as you leave the page.</p>
          <div style="background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">${otpCode}</span>
          </div>
          <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280;">Watch page: <a href="${watchUrl}" style="color: #2563eb;">${watchUrl}</a></p>
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">Do not share this code. Requesting a new code immediately ends any previous active viewing session.</p>
        </body>
      </html>
    `.trim();

    const emailRes = await sendEmailDirectInternal({
      first_name: email.split("@")[0] || "Viewer",
      last_name: "-",
      email,
      subjectEmail: `[${otpCode}] Your stream access code — ${streamDoc.title || "GDG Jakarta Stream"}`,
      bodyEmail: emailHtml,
    });

    if (!emailRes.success) {
      console.error("[Stream] n8n email dispatch failed:", emailRes.error);
      // Roll back rate-limit slot & invalidate undelivered code so user isn't locked out for 60s (CHAL-4)
      await patchFirestoreDocDetailed(
        "event_stream_codes",
        codeDocId,
        {
          ...newCodeDoc,
          status: "revoked",
          rate_limit_timestamps: Array.isArray(existingCode?.rate_limit_timestamps)
            ? existingCode.rate_limit_timestamps
            : [],
        } as unknown as Record<string, unknown>,
        false,
      );
      return {
        success: false,
        error: "We could not send the access code email right now. Please try again in a moment.",
      };
    }

    // Revoke any previously active session now that the replacement code has been delivered
    if (priorSessionId) {
      const prevSession = (await getFirestoreDoc(
        "event_stream_sessions",
        priorSessionId,
      )) as EventStreamSessionDoc | null;
      if (prevSession?.status === "active") {
        await patchFirestoreDocDetailed(
          "event_stream_sessions",
          priorSessionId,
          {
            status: "revoked",
            last_heartbeat_at: now,
            ended_at: now,
          },
          true,
        );
      }
    }

    return {
      success: true,
      message: "A single-use access code has been sent to your email. It expires in 10 minutes.",
    };
  } catch (err) {
    console.error("[Stream] requestStreamAccessCodeAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send access code.",
    };
  }
}

/**
 * Public: Redeem a single-use OTP code with atomic CAS (`commitFirestoreDocIfMatch`), re-verifying whitelist membership (CHAL-3).
 */
export async function redeemStreamAccessCodeAction(
  eventId: string,
  rawEmail: string,
  rawCode: string,
): Promise<
  | {
      success: true;
      sessionId: string;
      youtubeVideoId: string;
      viewerEmail: string;
      watermarkEnabled: boolean;
    }
  | { success: false; error: string }
> {
  try {
    if (!isValidStreamEventId(eventId)) {
      return { success: false, error: "Invalid event ID." };
    }
    const email = normalizeStreamEmail(rawEmail);
    const cleanedCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!isValidStreamEmail(email) || cleanedCode.length !== 6) {
      return { success: false, error: "Please enter your email and the 6-character access code." };
    }

    const secret = getStreamServerSecret();
    const [streamDoc, emailHash, codeDocId] = await Promise.all([
      getFirestoreDoc("event_streams", eventId) as Promise<EventStreamPublicDoc | null>,
      hashStreamEmail(secret, eventId, email),
      deriveStreamCodeDocId(secret, eventId, email),
    ]);

    if (!streamDoc || !streamDoc.enabled || streamDoc.access_mode !== "whitelisted" || !streamDoc.sealed_video_id) {
      return { success: false, error: "This restricted stream is unavailable." };
    }

    // Re-verify whitelist membership on redemption so removed users cannot use previously issued OTPs (CHAL-3)
    const [whitelisted, codeMeta] = await Promise.all([
      isEmailHashWhitelisted(eventId, emailHash, streamDoc),
      getFirestoreDocWithMeta("event_stream_codes", codeDocId),
    ]);

    if (!whitelisted) {
      return {
        success: false,
        error: "Your email is no longer on the approved whitelist for this stream.",
      };
    }

    const codeDoc = codeMeta.data as EventStreamCodeDoc | null;
    if (!codeDoc || !codeMeta.updateTime) {
      return { success: false, error: "No active code found for this email. Please request a new code." };
    }

    const now = Date.now();
    if (codeDoc.status !== "pending") {
      return {
        success: false,
        error: "This access code has already been used or invalidated. Please request a new code.",
      };
    }

    // Guard against NaN/corrupted expiry or attempts (NEW-SEC-3)
    const expiresAt = Number(codeDoc.expires_at);
    if (!Number.isFinite(expiresAt) || now > expiresAt) {
      await commitFirestoreDocIfMatch(
        "event_stream_codes",
        codeDocId,
        { ...codeDoc, status: "expired" } as unknown as Record<string, unknown>,
        codeMeta.updateTime,
        false,
      );
      return { success: false, error: "This access code has expired. Please request a new code." };
    }

    const currentAttempts = Number(codeDoc.attempts);
    if (!Number.isFinite(currentAttempts) || currentAttempts < 0 || currentAttempts >= STREAM_OTP_MAX_ATTEMPTS) {
      return { success: false, error: "Too many failed attempts. Please request a new access code." };
    }

    const expectedHash = await hashStreamOtpCode(secret, eventId, email, cleanedCode);
    if (!timingSafeEqualHex(expectedHash, String(codeDoc.code_hash ?? ""))) {
      const nextAttempts = currentAttempts + 1;
      const attemptRes = await commitFirestoreDocIfMatch(
        "event_stream_codes",
        codeDocId,
        {
          ...codeDoc,
          attempts: nextAttempts,
          status: nextAttempts >= STREAM_OTP_MAX_ATTEMPTS ? "revoked" : "pending",
        } as unknown as Record<string, unknown>,
        codeMeta.updateTime,
        false,
      );
      if (!attemptRes.ok && attemptRes.conflict) {
        return { success: false, error: "Please submit one verification attempt at a time." };
      }
      const remaining = Math.max(0, STREAM_OTP_MAX_ATTEMPTS - nextAttempts);
      return {
        success: false,
        error:
          remaining > 0
            ? `Invalid access code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
            : "Too many failed attempts. Code invalidated—please request a new code.",
      };
    }

    const youtubeVideoId = await unsealStreamVideoId(secret, streamDoc.sealed_video_id, eventId);
    if (!youtubeVideoId) {
      return { success: false, error: "Stream configuration could not be decrypted. Please contact the organizer." };
    }

    const sessionId = generateStreamSessionId();

    // Atomically burn the single-use code FIRST via CAS precondition (eliminates SEC-1 concurrent redemption race)
    const codeBurnRes = await commitFirestoreDocIfMatch(
      "event_stream_codes",
      codeDocId,
      {
        ...codeDoc,
        status: "redeemed",
        redeemed_at: now,
        active_session_id: sessionId,
      } as unknown as Record<string, unknown>,
      codeMeta.updateTime,
      false,
    );

    if (!codeBurnRes.ok) {
      return {
        success: false,
        error: codeBurnRes.conflict
          ? "This access code has already been redeemed. Please request a new code."
          : "Failed to verify access code. Please try again.",
      };
    }

    const sessionDoc: EventStreamSessionDoc = {
      id: sessionId,
      event_id: eventId,
      viewer_email_masked: maskStreamEmail(email),
      status: "active",
      started_at: now,
      last_heartbeat_at: now,
      ended_at: null,
    };

    const sessionCreateRes = await patchFirestoreDocDetailed(
      "event_stream_sessions",
      sessionId,
      sessionDoc as unknown as Record<string, unknown>,
      false,
    );

    if (!sessionCreateRes.ok) {
      return { success: false, error: "Failed to start viewing session. Please request a new code." };
    }

    return {
      success: true,
      sessionId,
      youtubeVideoId,
      viewerEmail: email,
      watermarkEnabled: streamDoc.watermark_enabled ?? true,
    };
  } catch (err) {
    console.error("[Stream] redeemStreamAccessCodeAction error:", err);
    return { success: false, error: "Failed to verify access code." };
  }
}

/**
 * Public: Periodic session heartbeat. Checks both session status AND organizer stream kill-switch (CHAL-2).
 */
export async function heartbeatStreamSessionAction(
  eventId: string,
  sessionId: string,
): Promise<{ active: boolean; reason?: string }> {
  try {
    if (!isValidStreamEventId(eventId) || !/^strm_[a-f0-9]{32}$/.test(sessionId)) {
      return { active: false, reason: "Invalid session." };
    }
    const [doc, streamDoc] = await Promise.all([
      getFirestoreDoc("event_stream_sessions", sessionId) as Promise<EventStreamSessionDoc | null>,
      getFirestoreDoc("event_streams", eventId) as Promise<EventStreamPublicDoc | null>,
    ]);

    if (!streamDoc || !streamDoc.enabled) {
      if (doc?.status === "active") {
        const now = Date.now();
        await patchFirestoreDocDetailed(
          "event_stream_sessions",
          sessionId,
          { status: "expired", last_heartbeat_at: now, ended_at: now },
          true,
        );
      }
      return { active: false, reason: "This stream has been disabled by the event organizer." };
    }

    if (!doc || doc.event_id !== eventId || doc.status !== "active") {
      return {
        active: false,
        reason:
          doc?.status === "revoked"
            ? "Your viewing session was ended because a new code was requested or an organizer revoked access."
            : "Your viewing session has expired.",
      };
    }

    await patchFirestoreDocDetailed(
      "event_stream_sessions",
      sessionId,
      {
        status: "active",
        last_heartbeat_at: Date.now(),
      },
      true,
    );
    return { active: true };
  } catch {
    // Transient network error: don't immediately kick the viewer out
    return { active: true };
  }
}
