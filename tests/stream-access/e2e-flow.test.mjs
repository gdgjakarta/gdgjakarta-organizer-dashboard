/**
 * End-to-End Flow Process Test Suite — Restricted Event YouTube Stream Access
 *
 * Executes the REAL TypeScript source modules:
 *   - src/lib/events/stream-access.ts
 *   - src/lib/events/media-utils.ts
 *   - src/server/stream-actions.ts
 *   - src/app/api/events/[eventId]/stream/leave/route.ts
 *
 * Uses `node:module.registerHooks` to resolve `@/* -> ./src/*` and stub ONLY
 * external I/O boundaries (`@/server/firestore-admin`, `@/server/auth-guard`,
 * `@/server/email-template-actions`, `next/server`) against an in-memory
 * Firestore store, fake n8n outbox, and controllable organizer auth state.
 *
 * Run:
 *   node --experimental-strip-types --test tests/stream-access/e2e-flow.test.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const SRC_ROOT = path.join(REPO_ROOT, "src");

// ============================================================================
// 1. Safe Zero-Network Tripwire & Test Environment Setup
// ============================================================================
process.env.STREAM_ACCESS_SECRET = "e2e-test-stream-access-secret-32bytes-min-length!";

globalThis.fetch = async (input) => {
  throw new Error(`Unexpected live network fetch attempted during E2E test: ${String(input)}`);
};

// ============================================================================
// 2. Shared In-Memory Harness State (Firestore, Auth, n8n Outbox, Clock)
// ============================================================================
const harness = {
  /** @type {Map<string, Map<string, Record<string, unknown>>>} */
  collections: new Map(),
  metrics: {
    reads: 0,
    writes: 0,
    queries: 0,
    deletes: 0,
  },
  auth: {
    isOrganizer: true,
    user: {
      id: "org-001",
      name: "GDG Organizer",
      email: "organizer@gdgjakarta.com",
    },
  },
  /** @type {Array<{ first_name: string; last_name: string; email: string; subjectEmail: string; bodyEmail: string }>} */
  emailOutbox: [],
  emailShouldFail: false,
  reset() {
    this.collections.clear();
    this.metrics.reads = 0;
    this.metrics.writes = 0;
    this.metrics.queries = 0;
    this.metrics.deletes = 0;
    this.auth.isOrganizer = true;
    this.auth.user = {
      id: "org-001",
      name: "GDG Organizer",
      email: "organizer@gdgjakarta.com",
    };
    this.emailOutbox.length = 0;
    this.emailShouldFail = false;
  },
  getCollection(name) {
    let col = this.collections.get(name);
    if (!col) {
      col = new Map();
      this.collections.set(name, col);
    }
    return col;
  },
  seedDoc(collectionName, docId, data) {
    this.getCollection(collectionName).set(docId, structuredClone(data));
  },
  peekDoc(collectionName, docId) {
    const doc = this.getCollection(collectionName).get(docId);
    return doc ? structuredClone(doc) : null;
  },
};

globalThis.__E2E_STREAM_HARNESS__ = harness;

// Deterministic controllable clock for TTL, cooldown, and sliding-window tests
const REAL_DATE_NOW = Date.now.bind(Date);
let fakeNow = null;
Date.now = () => (fakeNow === null ? REAL_DATE_NOW() : fakeNow);

function setClock(ms) {
  fakeNow = ms;
}
function advanceClock(ms) {
  if (fakeNow === null) fakeNow = REAL_DATE_NOW();
  fakeNow += ms;
}
function resetClock() {
  fakeNow = null;
}

// ============================================================================
// 3. Module Resolution & External I/O Boundary Stubs via registerHooks
// ============================================================================
const STUB_SOURCES = {
  "stub:firestore-admin": `
    const h = globalThis.__E2E_STREAM_HARNESS__;

    function decodeFilterValue(val) {
      if (!val || typeof val !== "object") return undefined;
      if ("stringValue" in val) return val.stringValue;
      if ("integerValue" in val) return Number(val.integerValue);
      if ("doubleValue" in val) return Number(val.doubleValue);
      if ("booleanValue" in val) return Boolean(val.booleanValue);
      if ("nullValue" in val) return null;
      return undefined;
    }

    export async function getFirestoreDoc(collectionName, docId) {
      h.metrics.reads++;
      const col = h.collections.get(collectionName);
      if (!col || !col.has(docId)) return null;
      return structuredClone(col.get(docId));
    }

    export async function patchFirestoreDocDetailed(collectionName, docId, data, merge = true) {
      h.metrics.writes++;
      const col = h.getCollection(collectionName);
      const clean = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) clean[k] = structuredClone(v);
      }
      if (!h.versions) h.versions = new Map();
      const vKey = collectionName + "/" + docId;
      const nextVer = String((h.versions.get(vKey) ?? 0) + 1);
      h.versions.set(vKey, Number(nextVer));
      if (merge && col.has(docId)) {
        col.set(docId, { ...structuredClone(col.get(docId)), ...clean });
      } else {
        col.set(docId, clean);
      }
      return { ok: true, status: 200 };
    }

    export async function getFirestoreDocWithMeta(collectionName, docId) {
      const data = await getFirestoreDoc(collectionName, docId);
      if (!data) return { data: null, updateTime: null };
      if (!h.versions) h.versions = new Map();
      const vKey = collectionName + "/" + docId;
      const ver = h.versions.get(vKey) ?? 1;
      return { data, updateTime: "2026-11-25T00:00:" + String(ver).padStart(2, "0") + "Z" };
    }

    export async function commitFirestoreDocIfMatch(collectionName, docId, data, expectedUpdateTime, merge = false) {
      const col = h.collections.get(collectionName);
      if (!h.versions) h.versions = new Map();
      const vKey = collectionName + "/" + docId;
      const exists = Boolean(col && col.has(docId));
      if (expectedUpdateTime === null) {
        if (exists) return { ok: false, conflict: true, status: 409, error: "ALREADY_EXISTS" };
      } else {
        const curVer = h.versions.get(vKey) ?? 1;
        const curTs = "2026-11-25T00:00:" + String(curVer).padStart(2, "0") + "Z";
        if (!exists || curTs !== expectedUpdateTime) {
          return { ok: false, conflict: true, status: 400, error: "FAILED_PRECONDITION" };
        }
      }
      return patchFirestoreDocDetailed(collectionName, docId, data, merge);
    }

    export async function batchCommitFirestoreWrites(ops) {
      for (const op of ops) {
        const parts = op.docPath.split("/");
        const docId = parts.pop();
        const colName = parts.join("/");
        if (op.type === "delete") {
          await deleteFirestoreDoc(colName, docId);
        } else {
          await patchFirestoreDocDetailed(colName, docId, op.data, false);
        }
      }
      return { ok: true };
    }

    export async function setFirestoreDocDetailed(collectionName, docId, data) {
      return patchFirestoreDocDetailed(collectionName, docId, data, false);
    }

    export async function queryFirestoreDocs(collectionId, filters = [], limit, _token, options) {
      h.metrics.queries++;
      const fullCol = options?.parentPath ? options.parentPath + "/" + collectionId : collectionId;
      const col = h.collections.get(fullCol);
      if (!col) return [];
      const results = [];
      for (const [docId, doc] of col.entries()) {
        let matched = true;
        for (const f of filters || []) {
          const ff = f?.fieldFilter;
          if (!ff) continue;
          const fieldPath = ff.field?.fieldPath;
          const expected = decodeFilterValue(ff.value);
          const actual = doc[fieldPath];
          if (ff.op === "EQUAL" && actual !== expected) {
            matched = false;
            break;
          }
          if (ff.op === "NOT_EQUAL" && actual === expected) {
            matched = false;
            break;
          }
        }
        if (matched) {
          results.push({ id: docId, ...structuredClone(doc) });
        }
      }
      const start = typeof options?.offset === "number" && options.offset > 0 ? options.offset : 0;
      const sliced = typeof limit === "number" ? results.slice(start, start + limit) : results.slice(start);
      return sliced;
    }

    export const queryFirestoreCollection = queryFirestoreDocs;

    export async function deleteFirestoreDoc(collectionName, docId) {
      h.metrics.deletes++;
      const col = h.collections.get(collectionName);
      if (!col) return false;
      return col.delete(docId);
    }
  `,
  "stub:auth-guard": `
    const h = globalThis.__E2E_STREAM_HARNESS__;
    export async function isAuthorizedOrganizerSession() {
      return Boolean(h.auth.isOrganizer);
    }
    export async function getAuthenticatedSessionUser() {
      return h.auth.isOrganizer ? structuredClone(h.auth.user) : null;
    }
  `,
  "stub:email-template-actions": `
    const h = globalThis.__E2E_STREAM_HARNESS__;
    export async function sendEmailDirectInternal(payload) {
      if (h.emailShouldFail) {
        return { success: false, error: "Simulated n8n webhook failure" };
      }
      h.emailOutbox.push(structuredClone(payload));
      return { success: true };
    }
  `,
  "stub:next-server": `
    export class NextResponse extends Response {
      static json(body, init = {}) {
        const headers = new Headers(init.headers || {});
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
        return new Response(JSON.stringify(body), { ...init, headers });
      }
    }
  `,
};

const SPECIFIER_TO_STUB = new Map([
  ["@/server/firestore-admin", "stub:firestore-admin"],
  ["@/server/auth-guard", "stub:auth-guard"],
  ["@/server/email-template-actions", "stub:email-template-actions"],
  ["next/server", "stub:next-server"],
]);

function resolveTsFile(basePath) {
  for (const ext of ["", ".ts", ".tsx", ".mjs", ".js"]) {
    const candidate = basePath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (SPECIFIER_TO_STUB.has(specifier)) {
      return { url: SPECIFIER_TO_STUB.get(specifier), shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const target = path.join(SRC_ROOT, specifier.slice(2));
      const resolvedUrl = resolveTsFile(target);
      if (resolvedUrl) {
        return { url: resolvedUrl, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url in STUB_SOURCES) {
      return {
        format: "module",
        source: STUB_SOURCES[url],
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

// ============================================================================
// 4. Import REAL TypeScript Production Modules
// ============================================================================
const streamAccess = await import("../../src/lib/events/stream-access.ts");
const mediaUtils = await import("../../src/lib/events/media-utils.ts");
const streamActions = await import("../../src/server/stream-actions.ts");
const leaveRoute = await import("../../src/app/api/events/[eventId]/stream/leave/route.ts");

// Helper: Extract the 6-char OTP directly from the real HTML email generated by stream-actions.ts
function extractOtpFromEmailHtml(html) {
  const match = html.match(/letter-spacing:\s*8px[^>]*>([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6})<\/span>/);
  assert.ok(match?.[1], `Expected 6-char OTP inside email HTML, got:\n${html}`);
  return match[1];
}

// ============================================================================
// 5. E2E Flow Process Test Suite (E2E-01 .. E2E-08)
// ============================================================================
describe("Restricted Event YouTube Stream Access — E2E Flow Process Suite", () => {
  beforeEach(() => {
    harness.reset();
    resetClock();
  });

  // --------------------------------------------------------------------------
  // E2E-01: Organizer Public Stream Setup -> Public Watch Meta
  // --------------------------------------------------------------------------
  it("E2E-01: Organizer Public Stream Setup -> Public Watch Meta", async () => {
    const eventId = "evt-public-01";
    const liveUrl = "https://www.youtube.com/live/dQw4w9WgXcQ?si=gdgjakarta";

    // Sanity check real parseVideoUrl on youtube.com/live/
    const parsed = mediaUtils.parseVideoUrl(liveUrl);
    assert.equal(parsed?.type, "youtube");
    assert.equal(parsed?.videoId, "dQw4w9WgXcQ");

    // 1. Unauthenticated caller cannot save config
    harness.auth.isOrganizer = false;
    const unauthRes = await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: "GDG Jakarta Public Keynote",
      youtubeUrl: liveUrl,
      accessMode: "public",
      watermarkEnabled: false,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: "",
    });
    assert.equal(unauthRes.success, false);
    assert.match(unauthRes.error, /Unauthorized/i);
    assert.equal(harness.peekDoc("event_streams", eventId), null);

    // 2. Organizer saves enabled Public stream
    harness.auth.isOrganizer = true;
    const saveRes = await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: "GDG Jakarta Public Keynote",
      youtubeUrl: liveUrl,
      accessMode: "public",
      watermarkEnabled: false,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: "",
    });
    assert.equal(saveRes.success, true);
    assert.equal(saveRes.whitelistCount, 0);
    assert.equal(saveRes.syncedRegistrants, 0);

    // Verify both public and private Firestore docs persisted
    const pubDoc = harness.peekDoc("event_streams", eventId);
    const privDoc = harness.peekDoc("event_streams_private", eventId);
    assert.ok(pubDoc, "event_streams doc must exist");
    assert.ok(privDoc, "event_streams_private doc must exist");
    assert.equal(pubDoc.enabled, true);
    assert.equal(pubDoc.access_mode, "public");
    assert.equal(pubDoc.public_youtube_video_id, "dQw4w9WgXcQ");
    assert.equal(pubDoc.sealed_video_id, null);
    assert.deepEqual(pubDoc.whitelist_email_hashes, []);
    assert.equal(pubDoc.updated_by, "organizer@gdgjakarta.com");
    assert.equal(privDoc.youtube_url, liveUrl);
    assert.equal(privDoc.youtube_video_id, "dQw4w9WgXcQ");

    // 3. Public Watch Meta projection
    const meta = await streamActions.getPublicEventStreamMetaAction(eventId);
    assert.deepEqual(meta, {
      enabled: true,
      title: "GDG Jakarta Public Keynote",
      accessMode: "public",
      watermarkEnabled: false,
      publicYoutubeVideoId: "dQw4w9WgXcQ",
    });
    assert.equal("sealed_video_id" in meta, false);
    assert.equal("whitelist_email_hashes" in meta, false);
    assert.equal("updated_by" in meta, false);

    // 4. OTP request on a Public stream is rejected
    const otpOnPublic = await streamActions.requestStreamAccessCodeAction(eventId, "viewer@example.com");
    assert.equal(otpOnPublic.success, false);
    assert.match(otpOnPublic.error, /not currently accepting access codes/i);
  });

  // --------------------------------------------------------------------------
  // E2E-02: Organizer Whitelisted Setup + Approved Registrant Auto-Sync -> Zero-Leakage
  // --------------------------------------------------------------------------
  it("E2E-02: Organizer Whitelisted Setup + Approved Registrant Auto-Sync -> Public Meta Zero-Leakage", async () => {
    const eventId = "evt-whitelist-02";
    const secretVideoId = "Zx9Yw8Vu7Ts";
    const youtubeUrl = `https://youtu.be/${secretVideoId}`;

    // Seed mixed event_registrations across all statuses + another event
    harness.seedDoc("event_registrations", "reg-1", {
      event_id: eventId,
      status: "approved",
      member_email: "Approved.User@Example.com",
    });
    harness.seedDoc("event_registrations", "reg-2", {
      event_id: eventId,
      status: "paid_and_registered",
      member_email: "paid@example.com",
    });
    harness.seedDoc("event_registrations", "reg-3", {
      event_id: eventId,
      status: "attended",
      email: "attended@example.com", // tests fallback to `email` field
    });
    harness.seedDoc("event_registrations", "reg-4", {
      event_id: eventId,
      status: "checked_in",
      member_email: "checkedin@example.com",
    });
    harness.seedDoc("event_registrations", "reg-5", {
      event_id: eventId,
      status: "pending",
      member_email: "pending@example.com",
    });
    harness.seedDoc("event_registrations", "reg-6", {
      event_id: eventId,
      status: "rejected",
      member_email: "rejected@example.com",
    });
    harness.seedDoc("event_registrations", "reg-7", {
      event_id: eventId,
      status: "canceled",
      member_email: "canceled@example.com",
    });
    harness.seedDoc("event_registrations", "reg-other-event", {
      event_id: "evt-different-99",
      status: "approved",
      member_email: "other.event@example.com",
    });

    // 1. Invalid manual email must be rejected before writing
    const invalidRes = await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: "Private DevFest Workshop",
      youtubeUrl,
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: true,
      manualWhitelistRaw: "vip@example.com, not-an-email\nbad@",
    });
    assert.equal(invalidRes.success, false);
    assert.match(invalidRes.error, /Invalid email address/i);
    assert.match(invalidRes.error, /not-an-email/);
    assert.equal(harness.peekDoc("event_streams", eventId), null);

    // 2. Valid save with duplicates, casing variations, and overlap with synced registrant
    const saveRes = await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: "Private DevFest Workshop",
      youtubeUrl,
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: true,
      manualWhitelistRaw:
        "  VIP.Guest@Example.COM ; vip.guest@example.com,\nAPPROVED.USER@example.com\nspeaker@example.com ",
    });

    assert.equal(saveRes.success, true);
    // 4 approved statuses: approved, paid_and_registered, attended, checked_in
    assert.equal(saveRes.syncedRegistrants, 4);
    // Union of 4 synced + 3 manual (1 overlaps with approved.user@example.com) = 6 unique emails
    assert.equal(saveRes.whitelistCount, 6);

    // Verify Firestore storage: video ID sealed (AES-256-GCM), emails hashed (HMAC-SHA256)
    const pubDoc = harness.peekDoc("event_streams", eventId);
    assert.equal(pubDoc.access_mode, "whitelisted");
    assert.equal(pubDoc.public_youtube_video_id, null);
    assert.match(pubDoc.sealed_video_id, /^v2\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
    assert.equal(pubDoc.sealed_video_id.includes(secretVideoId), false);
    assert.equal(pubDoc.whitelist_storage, "subcollection");
    assert.equal(pubDoc.whitelist_count, 6);
    assert.equal(pubDoc.whitelist_email_hashes.length, 0);
    const subCol = harness.collections.get(`event_streams/${eventId}/whitelist`);
    assert.equal(subCol?.size, 6);
    for (const h of subCol.keys()) {
      assert.match(h, /^[a-f0-9]{64}$/);
    }

    // Verify public meta leaks ZERO sensitive fields
    const meta = await streamActions.getPublicEventStreamMetaAction(eventId);
    assert.deepEqual(meta, {
      enabled: true,
      title: "Private DevFest Workshop",
      accessMode: "whitelisted",
      watermarkEnabled: true,
      publicYoutubeVideoId: null,
    });
    const serializedMeta = JSON.stringify(meta);
    assert.equal(serializedMeta.includes(secretVideoId), false);
    assert.equal(serializedMeta.includes("sealed_video_id"), false);
    assert.equal(serializedMeta.includes("whitelist_email_hashes"), false);
    assert.equal(serializedMeta.includes("vip.guest@example.com"), false);
  });

  // --------------------------------------------------------------------------
  // E2E-03: Whitelisted 2-Step OTP Full Lifecycle
  // --------------------------------------------------------------------------
  it("E2E-03: Whitelisted 2-Step OTP Full Lifecycle (non-whitelisted, 5x lockout, fresh unlock, replay)", async () => {
    const eventId = "evt-otp-03";
    const secretVideoId = "Ab1Cd2Ef3Gh";
    setClock(1_760_000_000_000);

    // Seed pending registrant (not approved) + configure whitelisted stream
    harness.seedDoc("event_registrations", "reg-pending", {
      event_id: eventId,
      status: "pending",
      member_email: "pending@example.com",
    });

    const saveRes = await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: "Cloud Next Extended Jakarta",
      youtubeUrl: `https://www.youtube.com/watch?v=${secretVideoId}`,
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: true,
      manualWhitelistRaw: "viewer.one@example.com",
    });
    assert.equal(saveRes.success, true);

    // 1. Non-whitelisted email (and pending registrant) rejected
    const nonWhitelisted = await streamActions.requestStreamAccessCodeAction(eventId, "stranger@example.com");
    assert.equal(nonWhitelisted.success, false);
    assert.match(nonWhitelisted.error, /not on the approved whitelist/i);

    const pendingRejected = await streamActions.requestStreamAccessCodeAction(eventId, "pending@example.com");
    assert.equal(pendingRejected.success, false);
    assert.match(pendingRejected.error, /not on the approved whitelist/i);
    assert.equal(harness.emailOutbox.length, 0);

    // 2. Whitelisted email (mixed case + surrounding spaces) requests OTP
    const req1 = await streamActions.requestStreamAccessCodeAction(eventId, "  Viewer.One@Example.COM  ");
    assert.equal(req1.success, true);
    assert.equal(harness.emailOutbox.length, 1);

    const email1 = harness.emailOutbox[0];
    assert.equal(email1.email, "viewer.one@example.com");
    assert.match(email1.bodyEmail, /https:\/\/gdgjakarta\.com\/events\/evt-otp-03\/watch/);
    const otp1 = extractOtpFromEmailHtml(email1.bodyEmail);
    assert.match(otp1, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    assert.ok(email1.subjectEmail.includes(`[${otp1}]`));

    // 3. Enter wrong code 5 times -> verify remaining countdown 4, 3, 2, 1 -> lockout on 5th
    const wrongCode = otp1 === "AAAAAA" ? "BBBBBB" : "AAAAAA";
    for (let attempt = 1; attempt <= 4; attempt++) {
      const expectedRemaining = 5 - attempt;
      const wrongRes = await streamActions.redeemStreamAccessCodeAction(eventId, "viewer.one@example.com", wrongCode);
      assert.equal(wrongRes.success, false);
      assert.match(
        wrongRes.error,
        new RegExp(`${expectedRemaining} attempt${expectedRemaining === 1 ? "" : "s"} remaining`, "i"),
      );
    }

    const fifthWrong = await streamActions.redeemStreamAccessCodeAction(eventId, "viewer.one@example.com", wrongCode);
    assert.equal(fifthWrong.success, false);
    assert.match(fifthWrong.error, /Code invalidated/i);

    const codeDocId = await streamAccess.deriveStreamCodeDocId(
      process.env.STREAM_ACCESS_SECRET,
      eventId,
      "viewer.one@example.com",
    );
    const lockedDoc = harness.peekDoc("event_stream_codes", codeDocId);
    assert.equal(lockedDoc.status, "revoked");
    assert.equal(lockedDoc.attempts, 5);

    // 4. Even the real OTP1 is rejected after lockout
    const validAfterLockout = await streamActions.redeemStreamAccessCodeAction(
      eventId,
      "viewer.one@example.com",
      otp1,
    );
    assert.equal(validAfterLockout.success, false);
    assert.match(validAfterLockout.error, /already been used or invalidated/i);

    // 5. Advance clock past 60s cooldown -> request fresh code -> redeem valid code
    advanceClock(streamAccess.STREAM_OTP_COOLDOWN_MS + 1000);
    const req2 = await streamActions.requestStreamAccessCodeAction(eventId, "viewer.one@example.com");
    assert.equal(req2.success, true);
    assert.equal(harness.emailOutbox.length, 2);
    const otp2 = extractOtpFromEmailHtml(harness.emailOutbox[1].bodyEmail);

    // Redeem with lowercase + hyphen formatting to verify normalization
    const formattedOtp2 = ` ${otp2.slice(0, 3).toLowerCase()}-${otp2.slice(3).toLowerCase()} `;
    const redeemRes = await streamActions.redeemStreamAccessCodeAction(
      eventId,
      "VIEWER.ONE@EXAMPLE.COM",
      formattedOtp2,
    );
    assert.equal(redeemRes.success, true);
    assert.equal(redeemRes.youtubeVideoId, secretVideoId);
    assert.match(redeemRes.sessionId, /^strm_[a-f0-9]{32}$/);
    assert.equal(redeemRes.viewerEmail, "viewer.one@example.com");
    assert.equal(redeemRes.watermarkEnabled, true);

    // Verify code doc is marked redeemed and session doc is active
    const redeemedDoc = harness.peekDoc("event_stream_codes", codeDocId);
    assert.equal(redeemedDoc.status, "redeemed");
    assert.equal(redeemedDoc.active_session_id, redeemRes.sessionId);

    const sessionDoc = harness.peekDoc("event_stream_sessions", redeemRes.sessionId);
    assert.equal(sessionDoc.status, "active");
    assert.equal(sessionDoc.event_id, eventId);
    assert.equal(sessionDoc.viewer_email_masked, "vi***@example.com");

    // 6. Replay of already-redeemed code is rejected
    const replayRes = await streamActions.redeemStreamAccessCodeAction(eventId, "viewer.one@example.com", otp2);
    assert.equal(replayRes.success, false);
    assert.match(replayRes.error, /already been used/i);
  });

  // --------------------------------------------------------------------------
  // E2E-04: Single-Session Enforcement (New Code Revokes Prior Active Session)
  // --------------------------------------------------------------------------
  it("E2E-04: Single-Session Enforcement (New Code Revokes Prior Active Session)", async () => {
    const eventId = "evt-single-04";
    const videoId = "SingleSess1";
    setClock(1_760_010_000_000);

    await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: "Single Session Stream",
      youtubeUrl: `https://www.youtube.com/live/${videoId}`,
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: "viewer@example.com",
    });

    // Viewer A unlocks session S1
    assert.equal((await streamActions.requestStreamAccessCodeAction(eventId, "viewer@example.com")).success, true);
    const otpA = extractOtpFromEmailHtml(harness.emailOutbox[0].bodyEmail);
    const unlockA = await streamActions.redeemStreamAccessCodeAction(eventId, "viewer@example.com", otpA);
    assert.equal(unlockA.success, true);
    const s1 = unlockA.sessionId;

    // Heartbeat on S1 succeeds
    advanceClock(30_000);
    const hbA1 = await streamActions.heartbeatStreamSessionAction(eventId, s1);
    assert.deepEqual(hbA1, { active: true });

    // Advance past 60s cooldown -> same email requests a new code (Viewer B)
    advanceClock(35_000);
    const reqB = await streamActions.requestStreamAccessCodeAction(eventId, "viewer@example.com");
    assert.equal(reqB.success, true);

    // S1 must immediately be revoked in Firestore
    const s1Doc = harness.peekDoc("event_stream_sessions", s1);
    assert.equal(s1Doc.status, "revoked");
    assert.ok(typeof s1Doc.ended_at === "number" && s1Doc.ended_at > 0);

    // Viewer A's next heartbeat detects revocation
    const hbA2 = await streamActions.heartbeatStreamSessionAction(eventId, s1);
    assert.equal(hbA2.active, false);
    assert.match(hbA2.reason, /new code was requested|revoked/i);

    // Viewer B redeems new code -> gets new active session S2
    const otpB = extractOtpFromEmailHtml(harness.emailOutbox[1].bodyEmail);
    const unlockB = await streamActions.redeemStreamAccessCodeAction(eventId, "viewer@example.com", otpB);
    assert.equal(unlockB.success, true);
    assert.notEqual(unlockB.sessionId, s1);
    assert.deepEqual(await streamActions.heartbeatStreamSessionAction(eventId, unlockB.sessionId), { active: true });
  });

  // --------------------------------------------------------------------------
  // E2E-05: Organizer Live Session Monitoring & Revocation
  // --------------------------------------------------------------------------
  it("E2E-05: Organizer Live Session Monitoring & Revocation", async () => {
    const eventId = "evt-monitor-05";
    setClock(1_760_020_000_000);

    await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: "Monitored Stream",
      youtubeUrl: "https://www.youtube.com/watch?v=Monitored05",
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: "viewer@example.com",
    });

    // Unlock active session S2
    await streamActions.requestStreamAccessCodeAction(eventId, "viewer@example.com");
    const otp = extractOtpFromEmailHtml(harness.emailOutbox[0].bodyEmail);
    const unlock = await streamActions.redeemStreamAccessCodeAction(eventId, "viewer@example.com", otp);
    assert.equal(unlock.success, true);
    const s2 = unlock.sessionId;

    // Organizer fetches live config & sessions
    const cfg = await streamActions.getEventStreamConfigAction(eventId);
    assert.equal(cfg.success, true);
    assert.equal(cfg.data.sessions.length, 1);
    assert.equal(cfg.data.sessions[0].id, s2);
    assert.equal(cfg.data.sessions[0].viewer_email_masked, "vi***@example.com");
    assert.equal(cfg.data.sessions[0].status, "active");

    // Non-organizer cannot revoke
    harness.auth.isOrganizer = false;
    const unauthRevoke = await streamActions.revokeStreamSessionAction(eventId, s2);
    assert.equal(unauthRevoke.success, false);
    assert.match(unauthRevoke.error, /Unauthorized/i);

    // Organizer revokes S2
    harness.auth.isOrganizer = true;
    advanceClock(10_000);
    const revokeRes = await streamActions.revokeStreamSessionAction(eventId, s2);
    assert.equal(revokeRes.success, true);

    const revokedDoc = harness.peekDoc("event_stream_sessions", s2);
    assert.equal(revokedDoc.status, "revoked");
    assert.equal(revokedDoc.ended_at, Date.now());

    // Viewer's next heartbeat fails
    const hb = await streamActions.heartbeatStreamSessionAction(eventId, s2);
    assert.equal(hb.active, false);
    assert.match(hb.reason, /revoked/i);
  });

  // --------------------------------------------------------------------------
  // E2E-06: Page Leave Beacon Teardown (POST /api/events/[eventId]/stream/leave)
  // --------------------------------------------------------------------------
  it("E2E-06: Page Leave Beacon Teardown (POST /api/events/[eventId]/stream/leave)", async () => {
    const eventId = "evt-leave-06";
    setClock(1_760_030_000_000);

    await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: "Leave Beacon Stream",
      youtubeUrl: "https://www.youtube.com/watch?v=LeaveBeac06",
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: "leaver@example.com",
    });

    await streamActions.requestStreamAccessCodeAction(eventId, "leaver@example.com");
    const otp = extractOtpFromEmailHtml(harness.emailOutbox[0].bodyEmail);
    const unlock = await streamActions.redeemStreamAccessCodeAction(eventId, "leaver@example.com", otp);
    assert.equal(unlock.success, true);
    const s3 = unlock.sessionId;

    const makeLeaveRequest = (body) =>
      new Request(`https://gdgjakarta.com/api/events/${eventId}/stream/leave`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });

    // Malformed payloads return HTTP 400
    const emptyRes = await leaveRoute.POST(makeLeaveRequest(""), { params: Promise.resolve({ eventId }) });
    assert.equal(emptyRes.status, 400);

    const badJsonRes = await leaveRoute.POST(makeLeaveRequest("{not-json"), { params: Promise.resolve({ eventId }) });
    assert.equal(badJsonRes.status, 400);

    const badIdRes = await leaveRoute.POST(makeLeaveRequest(JSON.stringify({ sessionId: "bad-id" })), {
      params: Promise.resolve({ eventId }),
    });
    assert.equal(badIdRes.status, 400);

    // 1. First leave call expires active session S3
    advanceClock(15_000);
    const leaveTs = Date.now();
    const res1 = await leaveRoute.POST(makeLeaveRequest(JSON.stringify({ sessionId: s3 })), {
      params: Promise.resolve({ eventId }),
    });
    assert.equal(res1.status, 200);
    assert.deepEqual(await res1.json(), { ok: true, expired: true });

    const s3Doc = harness.peekDoc("event_stream_sessions", s3);
    assert.equal(s3Doc.status, "expired");
    assert.equal(s3Doc.ended_at, leaveTs);

    // Heartbeat returns active: false
    const hb = await streamActions.heartbeatStreamSessionAction(eventId, s3);
    assert.equal(hb.active, false);
    assert.match(hb.reason, /expired/i);

    // 2. Second leave call is idempotent (0 additional Firestore writes, ended_at preserved)
    // Note: leave/route.ts:43 returns { ok: true, expired: true } for an existing already-expired session
    // (only returning { ok: true, expired: false } at line 26 when session is missing or cross-event).
    advanceClock(5_000);
    const writesBefore = harness.metrics.writes;
    const res2 = await leaveRoute.POST(makeLeaveRequest(JSON.stringify({ sessionId: s3 })), {
      params: Promise.resolve({ eventId }),
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.ok, true);
    assert.equal(body2.expired, false);
    assert.equal(harness.metrics.writes, writesBefore, "Second leave must not perform redundant Firestore write");
    assert.equal(harness.peekDoc("event_stream_sessions", s3).ended_at, leaveTs);

    // 3. Nonexistent valid-format sessionId returns { ok: true, expired: false }
    const missingId = "strm_00000000000000000000000000000000";
    const resMissing = await leaveRoute.POST(makeLeaveRequest(JSON.stringify({ sessionId: missingId })), {
      params: Promise.resolve({ eventId }),
    });
    assert.equal(resMissing.status, 200);
    assert.deepEqual(await resMissing.json(), { ok: true, expired: false });
  });

  // --------------------------------------------------------------------------
  // E2E-07: OTP Expiration (10-min TTL) & Rate-Limit Window (1/60s & 5/hr)
  // --------------------------------------------------------------------------
  it("E2E-07: OTP Expiration (10-min TTL) & Rate-Limit Window (1/60s & 5/hr)", async () => {
    const eventId = "evt-limits-07";
    const t0 = 1_760_040_000_000;
    setClock(t0);

    await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: "Rate Limit & TTL Stream",
      youtubeUrl: "https://www.youtube.com/watch?v=RateLimit07",
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: "ttl-user@example.com, rate-user@example.com",
    });

    // Part A: 10-minute OTP TTL expiration
    const ttlReq = await streamActions.requestStreamAccessCodeAction(eventId, "ttl-user@example.com");
    assert.equal(ttlReq.success, true);
    const ttlOtp = extractOtpFromEmailHtml(harness.emailOutbox[0].bodyEmail);

    advanceClock(streamAccess.STREAM_OTP_TTL_MS + 1000); // 10 min + 1s
    const expiredRedeem = await streamActions.redeemStreamAccessCodeAction(eventId, "ttl-user@example.com", ttlOtp);
    assert.equal(expiredRedeem.success, false);
    assert.match(expiredRedeem.error, /expired/i);

    const ttlCodeDocId = await streamAccess.deriveStreamCodeDocId(
      process.env.STREAM_ACCESS_SECRET,
      eventId,
      "ttl-user@example.com",
    );
    assert.equal(harness.peekDoc("event_stream_codes", ttlCodeDocId).status, "expired");

    // Part B: 1/60s cooldown & 5/hr sliding window
    setClock(t0);
    harness.emailOutbox.length = 0;

    // Request #1 at t0
    assert.equal((await streamActions.requestStreamAccessCodeAction(eventId, "rate-user@example.com")).success, true);
    assert.equal(harness.emailOutbox.length, 1);

    // Request within 60s (at +25s) -> blocked with retryAfterSec = 35
    advanceClock(25_000);
    const cooldownBlocked = await streamActions.requestStreamAccessCodeAction(eventId, "rate-user@example.com");
    assert.equal(cooldownBlocked.success, false);
    assert.equal(cooldownBlocked.retryAfterSec, 35);
    assert.match(cooldownBlocked.error, /Please wait 35s/i);
    assert.equal(harness.emailOutbox.length, 1);

    // Requests #2..#5 spaced 61s apart -> all succeed
    for (let i = 2; i <= 5; i++) {
      setClock(t0 + (i - 1) * 61_000);
      const r = await streamActions.requestStreamAccessCodeAction(eventId, "rate-user@example.com");
      assert.equal(r.success, true, `Request #${i} should succeed`);
    }
    assert.equal(harness.emailOutbox.length, 5);

    // Request #6 past 60s cooldown (+305s) but still within 1 hour of t0 -> blocked by hourly limit
    setClock(t0 + 5 * 61_000);
    const hourlyBlocked = await streamActions.requestStreamAccessCodeAction(eventId, "rate-user@example.com");
    assert.equal(hourlyBlocked.success, false);
    assert.match(hourlyBlocked.error, /Too many code requests in the past hour/i);
    assert.ok(hourlyBlocked.retryAfterSec > 0);
    assert.equal(harness.emailOutbox.length, 5);

    // Advance past t0 + 1 hour + 1s -> oldest timestamp ages out -> request #7 succeeds
    setClock(t0 + streamAccess.STREAM_OTP_HOURLY_WINDOW_MS + 1000);
    const afterWindow = await streamActions.requestStreamAccessCodeAction(eventId, "rate-user@example.com");
    assert.equal(afterWindow.success, true);
    assert.equal(harness.emailOutbox.length, 6);
  });

  // --------------------------------------------------------------------------
  // E2E-08: Cross-Event Isolation & Disabled Stream Guard
  // --------------------------------------------------------------------------
  it("E2E-08: Cross-Event Isolation & Disabled Stream Guard", async () => {
    const eventA = "evt-iso-A";
    const eventB = "evt-iso-B";
    setClock(1_760_050_000_000);

    // Configure both Event A and Event B as whitelisted
    await streamActions.saveEventStreamConfigAction({
      eventId: eventA,
      enabled: true,
      title: "Event A Private",
      youtubeUrl: "https://www.youtube.com/watch?v=EventAVid01",
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: "alice@example.com",
    });
    await streamActions.saveEventStreamConfigAction({
      eventId: eventB,
      enabled: true,
      title: "Event B Private",
      youtubeUrl: "https://www.youtube.com/watch?v=EventBVid02",
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: "bob@example.com",
    });

    // Unlock session SA on Event A
    await streamActions.requestStreamAccessCodeAction(eventA, "alice@example.com");
    const otpA = extractOtpFromEmailHtml(harness.emailOutbox[0].bodyEmail);
    const unlockA = await streamActions.redeemStreamAccessCodeAction(eventA, "alice@example.com", otpA);
    assert.equal(unlockA.success, true);
    const sessionA = unlockA.sessionId;

    // 1. Cross-event heartbeat on Event B with Session A -> rejected, SA stays active
    const crossHb = await streamActions.heartbeatStreamSessionAction(eventB, sessionA);
    assert.equal(crossHb.active, false);
    assert.equal(harness.peekDoc("event_stream_sessions", sessionA).status, "active");

    // 2. Cross-event leave beacon on Event B with Session A -> expired: false, SA stays active
    const crossLeaveReq = new Request(`https://gdgjakarta.com/api/events/${eventB}/stream/leave`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionA }),
    });
    const crossLeaveRes = await leaveRoute.POST(crossLeaveReq, { params: Promise.resolve({ eventId: eventB }) });
    assert.equal(crossLeaveRes.status, 200);
    assert.deepEqual(await crossLeaveRes.json(), { ok: true, expired: false });
    assert.equal(harness.peekDoc("event_stream_sessions", sessionA).status, "active");

    // 3. Cross-event organizer revoke on Event B with Session A -> Session not found, SA stays active
    const crossRevoke = await streamActions.revokeStreamSessionAction(eventB, sessionA);
    assert.equal(crossRevoke.success, false);
    assert.equal(crossRevoke.error, "Session not found.");
    assert.equal(harness.peekDoc("event_stream_sessions", sessionA).status, "active");

    // 4. Disabled stream guard on Event A
    const disableRes = await streamActions.saveEventStreamConfigAction({
      eventId: eventA,
      enabled: false,
      title: "Event A Private",
      youtubeUrl: "https://www.youtube.com/watch?v=EventAVid01",
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: "alice@example.com",
    });
    assert.equal(disableRes.success, true);

    assert.equal(await streamActions.getPublicEventStreamMetaAction(eventA), null);

    advanceClock(streamAccess.STREAM_OTP_COOLDOWN_MS + 1000);
    const reqDisabled = await streamActions.requestStreamAccessCodeAction(eventA, "alice@example.com");
    assert.equal(reqDisabled.success, false);
    assert.match(reqDisabled.error, /not currently accepting access codes/i);

    const redeemDisabled = await streamActions.redeemStreamAccessCodeAction(eventA, "alice@example.com", otpA);
    assert.equal(redeemDisabled.success, false);
    assert.match(redeemDisabled.error, /unavailable/i);
  });
});
