/**
 * Security & Penetration Test Suite — Restricted Event YouTube Stream Access
 *
 * Executes REAL TypeScript modules from `src/` via Node 22 `--experimental-strip-types`
 * and `node:module.registerHooks`, stubbing ONLY external I/O boundaries:
 *   - `@/server/firestore-admin` (in-memory Firestore with configurable async latency)
 *   - `@/server/email-template-actions` (in-memory n8n email outbox capture)
 *   - `next/headers` (controllable cookie store so REAL `auth-guard.ts` & `session-cookie.ts` run)
 *   - `next/server` (minimal `NextResponse.json` backed by standard Web `Response`)
 *
 * Zero live network calls to Firestore, Bevy, or n8n.
 * Run:
 *   node --experimental-strip-types --test tests/stream-access/security.test.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { beforeEach, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

// ============================================================================
// Controllable In-Memory Test Harness State (shared with mocked I/O modules)
// ============================================================================

const harness = {
  /** @type {Map<string, Map<string, Record<string, unknown>>>} */
  collections: new Map(),
  /** @type {Array<{ first_name: string, last_name: string, email: string, subjectEmail: string, bodyEmail: string }>} */
  sentEmails: [],
  /** @type {Map<string, string>} */
  cookies: new Map(),
  /** Simulated network latency (ms) per Firestore operation for TOCTOU tests */
  firestoreDelayMs: 0,
  /** Counters for observability */
  stats: { reads: 0, writes: 0, queries: 0 },

  reset() {
    this.collections.clear();
    this.sentEmails.length = 0;
    this.cookies.clear();
    this.firestoreDelayMs = 0;
    this.stats = { reads: 0, writes: 0, queries: 0 };
  },

  getCollection(name) {
    let col = this.collections.get(name);
    if (!col) {
      col = new Map();
      this.collections.set(name, col);
    }
    return col;
  },

  setDoc(collection, docId, data) {
    this.getCollection(collection).set(docId, structuredClone(data));
  },

  getDocRaw(collection, docId) {
    const doc = this.getCollection(collection).get(docId);
    return doc ? structuredClone(doc) : null;
  },
};

globalThis.__STREAM_SEC_HARNESS__ = harness;

// ============================================================================
// Module Resolution & External I/O Boundary Stubs via node:module.registerHooks
// ============================================================================

const VIRTUAL_PREFIX = "virtual:stream-sec-mock/";

const MOCK_MODULES = {
  "@/server/firestore-admin": `${VIRTUAL_PREFIX}firestore-admin.mjs`,
  "@/server/email-template-actions": `${VIRTUAL_PREFIX}email-template-actions.mjs`,
  "next/headers": `${VIRTUAL_PREFIX}next-headers.mjs`,
  "next/server": `${VIRTUAL_PREFIX}next-server.mjs`,
};

const MOCK_SOURCES = {
  [`${VIRTUAL_PREFIX}firestore-admin.mjs`]: `
    const h = globalThis.__STREAM_SEC_HARNESS__;
    const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

    export async function getFirestoreDoc(collection, docId) {
      h.stats.reads++;
      await sleep(h.firestoreDelayMs);
      const col = h.collections.get(collection);
      if (!col || !col.has(docId)) return null;
      return structuredClone(col.get(docId));
    }

    export async function patchFirestoreDocDetailed(collection, docId, fields, merge = true) {
      h.stats.writes++;
      await sleep(h.firestoreDelayMs);
      const col = h.getCollection(collection);
      const existing = merge && col.has(docId) ? structuredClone(col.get(docId)) : {};
      const next = merge ? { ...existing, ...structuredClone(fields) } : structuredClone(fields);
      col.set(docId, next);
      return { ok: true };
    }

    export async function queryFirestoreDocs(collection, filters = [], limit = 100) {
      h.stats.queries++;
      await sleep(h.firestoreDelayMs);
      const col = h.collections.get(collection);
      if (!col) return [];
      const results = [];
      for (const doc of col.values()) {
        let match = true;
        for (const f of filters) {
          const ff = f?.fieldFilter;
          if (!ff) continue;
          const fieldPath = ff.field?.fieldPath;
          const expected = ff.value?.stringValue ?? ff.value?.integerValue ?? ff.value?.booleanValue;
          if (ff.op === "EQUAL" && String(doc[fieldPath]) !== String(expected)) {
            match = false;
            break;
          }
        }
        if (match) {
          results.push(structuredClone(doc));
          if (results.length >= limit) break;
        }
      }
      return results;
    }
  `,
  [`${VIRTUAL_PREFIX}email-template-actions.mjs`]: `
    const h = globalThis.__STREAM_SEC_HARNESS__;
    export async function sendEmailDirectInternal(payload) {
      h.sentEmails.push(structuredClone(payload));
      return { success: true };
    }
  `,
  [`${VIRTUAL_PREFIX}next-headers.mjs`]: `
    const h = globalThis.__STREAM_SEC_HARNESS__;
    export async function cookies() {
      return {
        get(name) {
          return h.cookies.has(name) ? { name, value: h.cookies.get(name) } : undefined;
        },
      };
    }
  `,
  [`${VIRTUAL_PREFIX}next-server.mjs`]: `
    export const NextResponse = {
      json(body, init = {}) {
        return new Response(JSON.stringify(body), {
          status: init.status ?? 200,
          headers: { "content-type": "application/json", ...(init.headers ?? {}) },
        });
      },
    };
  `,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(MOCK_MODULES, specifier)) {
      return { url: MOCK_MODULES[specifier], shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const rel = specifier.slice(2);
      const base = path.join(REPO_ROOT, "src", rel);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (Object.hasOwn(MOCK_SOURCES, url)) {
      return {
        format: "module",
        source: MOCK_SOURCES[url],
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

// ============================================================================
// Import REAL Production Modules Under Test
// ============================================================================

const streamAccess = await import("@/lib/events/stream-access");
const sessionCookie = await import("@/lib/security/session-cookie");
const authGuard = await import("@/server/auth-guard");
const streamActions = await import("@/server/stream-actions");
const leaveRoute = await import("@/app/api/events/[eventId]/stream/leave/route");

// ============================================================================
// Helper Utilities
// ============================================================================

const TEST_STREAM_SECRET = "test-only-high-entropy-stream-secret-2026-0123456789abcdef";
const TEST_SESSION_SECRET = "test-only-high-entropy-session-secret-2026-fedcba9876543210";
const DEFAULT_FALLBACK_SESSION_SECRET = "gdg-jakarta-secure-hmac-session-secret-2026";

function makeDummyJwt(email = "organizer@gdgjakarta.test") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: "org-1", email, name: "GDG Organizer" })).toString("base64url");
  return `${header}.${payload}.dummysig`;
}

async function setAuthRole(role, email = "organizer@gdgjakarta.test") {
  harness.cookies.set("auth_token", makeDummyJwt(email));
  const signed = await sessionCookie.signRoleCookie(role);
  harness.cookies.set("auth_role", signed);
}

async function forgeRoleCookieWithSecret(role, rawSecret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(rawSecret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(role));
  const hex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${role}.${hex}`;
}

function extractOtpFromLastEmail() {
  const last = harness.sentEmails[harness.sentEmails.length - 1];
  assert.ok(last, "Expected an email in the fake n8n outbox");
  const match = last.subjectEmail.match(/^\[([A-Z0-9]{6})\]/);
  assert.ok(match, `Could not extract 6-char OTP from subject: ${last.subjectEmail}`);
  return match[1];
}

async function seedWhitelistedStream(eventId, { title = "DevFest Live", videoId = "dQw4w9WgXcQ", emails = [] } = {}) {
  await setAuthRole("organizer", "lead@gdgjakarta.test");
  const res = await streamActions.saveEventStreamConfigAction({
    eventId,
    enabled: true,
    title,
    youtubeUrl: `https://www.youtube.com/live/${videoId}`,
    accessMode: "whitelisted",
    watermarkEnabled: true,
    includeApprovedRegistrants: false,
    manualWhitelistRaw: emails.join("\n"),
  });
  assert.equal(res.success, true, `Failed to seed stream: ${JSON.stringify(res)}`);
  harness.cookies.clear();
}

beforeEach(() => {
  harness.reset();
  process.env.STREAM_ACCESS_SECRET = TEST_STREAM_SECRET;
  process.env.SESSION_SECRET = TEST_SESSION_SECRET;
  delete process.env.PAYMENT_WEBHOOK_SECRET;
  delete process.env.N8N_WEBHOOK_API_KEY;
  delete process.env.EVENT_REGISTRATION_WEBHOOK_API_KEY;
  delete process.env.N8N_AUTH_SECRET;
});

// ============================================================================
// ST-01: SSR / Public Projection Non-Leakage
// ============================================================================

describe("ST-01: SSR / Public Projection Non-Leakage", () => {
  test("getPublicEventStreamMetaAction never leaks videoId, sealed_video_id, emails, hashes, or organizer email", async () => {
    const secretVideoId = "dQw4w9WgXcQ";
    const whitelist = ["alice@gdgjakarta.test", "bob@gdgjakarta.test"];
    await seedWhitelistedStream("evt-st01", {
      title: "GDG Keynote",
      videoId: secretVideoId,
      emails: whitelist,
    });

    const rawPublicDoc = harness.getDocRaw("event_streams", "evt-st01");
    assert.ok(rawPublicDoc?.sealed_video_id, "Firestore doc must store sealed_video_id");
    assert.equal(rawPublicDoc.whitelist_email_hashes.length, 2);

    const meta = await streamActions.getPublicEventStreamMetaAction("evt-st01");
    assert.ok(meta, "Public meta should be returned for enabled stream");
    assert.equal(meta.enabled, true);
    assert.equal(meta.accessMode, "whitelisted");
    assert.equal(meta.publicYoutubeVideoId, null);

    const serialized = JSON.stringify(meta);
    assert.equal(serialized.includes(secretVideoId), false, "Plaintext videoId leaked!");
    assert.equal(serialized.includes("sealed_video_id"), false, "sealed_video_id key leaked!");
    assert.equal(serialized.includes(String(rawPublicDoc.sealed_video_id)), false, "sealed_video_id value leaked!");
    assert.equal(serialized.includes("whitelist_email_hashes"), false, "whitelist_email_hashes leaked!");
    for (const hash of rawPublicDoc.whitelist_email_hashes) {
      assert.equal(serialized.includes(hash), false, "Whitelist email hash leaked!");
    }
    for (const email of whitelist) {
      assert.equal(serialized.includes(email), false, "Whitelist email leaked!");
    }
    assert.equal(serialized.includes("lead@gdgjakarta.test"), false, "Organizer updated_by email leaked!");
  });

  test("watch/page.tsx statically enforces force-dynamic, noindex/nofollow, and passes only streamMeta", () => {
    const watchPagePath = path.join(REPO_ROOT, "src/app/(external)/events/[eventId]/watch/page.tsx");
    const src = fs.readFileSync(watchPagePath, "utf8");

    assert.match(src, /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/, "Missing force-dynamic");
    assert.match(src, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/, "Missing robots noindex/nofollow");
    assert.match(src, /getPublicEventStreamMetaAction/, "Must use getPublicEventStreamMetaAction");
    assert.equal(src.includes("getEventStreamConfigAction"), false, "Must never call organizer config action in SSR");
    assert.equal(src.includes("getFirestoreDoc"), false, "Must never read raw Firestore event_streams doc in SSR");
    assert.equal(src.includes("sealed_video_id"), false, "Must never reference sealed_video_id in SSR page");
    assert.match(src, /streamMeta=\{streamMeta\}/, "Must pass only streamMeta to RestrictedStreamViewer");
  });
});

// ============================================================================
// ST-02: RBAC & Forged Session Cookie PoC (SEC-4) + Secret Fallback (SEC-3)
// ============================================================================

describe("ST-02: RBAC Enforcement, Hardcoded SESSION_SECRET Fallback (SEC-4) & n8n Secret Coupling (SEC-3)", () => {
  test("unauthenticated and member sessions are rejected by all organizer stream actions", async () => {
    await seedWhitelistedStream("evt-st02", { emails: ["viewer@gdgjakarta.test"] });

    // 1. Unauthenticated
    harness.cookies.clear();
    const unauthGet = await streamActions.getEventStreamConfigAction("evt-st02");
    const unauthSave = await streamActions.saveEventStreamConfigAction({
      eventId: "evt-st02",
      enabled: true,
      title: "Hijacked",
      youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
      accessMode: "public",
      watermarkEnabled: false,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: "",
    });
    const unauthRevoke = await streamActions.revokeStreamSessionAction("evt-st02", "strm_00000000000000000000000000000000");

    assert.equal(unauthGet.success, false);
    assert.match(unauthGet.error, /Unauthorized/i);
    assert.equal(unauthSave.success, false);
    assert.match(unauthSave.error, /Unauthorized/i);
    assert.equal(unauthRevoke.success, false);
    assert.match(unauthRevoke.error, /Unauthorized/i);

    // 2. Authenticated `member` role
    await setAuthRole("member", "member@gdgjakarta.test");
    const memGet = await streamActions.getEventStreamConfigAction("evt-st02");
    const memSave = await streamActions.saveEventStreamConfigAction({
      eventId: "evt-st02",
      enabled: false,
      title: "Member Tamper",
      youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
      accessMode: "public",
      watermarkEnabled: false,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: "",
    });
    const memRevoke = await streamActions.revokeStreamSessionAction("evt-st02", "strm_00000000000000000000000000000000");

    assert.equal(memGet.success, false);
    assert.match(memGet.error, /Unauthorized/i);
    assert.equal(memSave.success, false);
    assert.match(memSave.error, /Unauthorized/i);
    assert.equal(memRevoke.success, false);
    assert.match(memRevoke.error, /Unauthorized/i);
  });

  test("[VULN CONFIRMED: SEC-4] verifyRoleCookie & organizer actions accept forged cookie when SESSION_SECRET & PAYMENT_WEBHOOK_SECRET are unset", async () => {
    await seedWhitelistedStream("evt-sec4", { emails: ["vip@gdgjakarta.test"] });

    // Remove env secrets to trigger fallback in src/lib/security/session-cookie.ts:9
    delete process.env.SESSION_SECRET;
    delete process.env.PAYMENT_WEBHOOK_SECRET;

    const forgedRoleCookie = await forgeRoleCookieWithSecret("organizer", DEFAULT_FALLBACK_SESSION_SECRET);
    const verifiedRole = await sessionCookie.verifyRoleCookie(forgedRoleCookie);
    assert.equal(verifiedRole, "organizer", "Expected hardcoded fallback secret to verify forged cookie (SEC-4)");

    // Pair with a completely unverified dummy auth_token
    harness.cookies.set("auth_token", "unverified-dummy-token");
    harness.cookies.set("auth_role", forgedRoleCookie);

    assert.equal(await authGuard.isAuthorizedOrganizerSession(), true, "isAuthorizedOrganizerSession bypassed (SEC-4)");
    const stolenConfig = await streamActions.getEventStreamConfigAction("evt-sec4");
    assert.equal(stolenConfig.success, true, "Forged organizer cookie read private stream config (SEC-4)");
    assert.deepEqual(stolenConfig.data.manualWhitelistEmails, ["vip@gdgjakarta.test"]);

    // Verify mitigation: setting SESSION_SECRET immediately rejects the forged cookie
    process.env.SESSION_SECRET = TEST_SESSION_SECRET;
    assert.equal(await sessionCookie.verifyRoleCookie(forgedRoleCookie), null);
    const blocked = await streamActions.getEventStreamConfigAction("evt-sec4");
    assert.equal(blocked.success, false);
    assert.match(blocked.error, /Unauthorized/i);
  });

  test("[VULN CONFIRMED: SEC-3] STREAM_ACCESS_SECRET falls back to N8N_WEBHOOK_API_KEY, allowing decryption & hash derivation from leaked n8n key", async () => {
    delete process.env.STREAM_ACCESS_SECRET;
    const leakedN8nKey = "n8n-shared-webhook-key-999";
    process.env.N8N_WEBHOOK_API_KEY = leakedN8nKey;

    await seedWhitelistedStream("evt-sec3", {
      videoId: "AbCdEfGhIjK",
      emails: ["target@gdgjakarta.test"],
    });

    const publicDoc = harness.getDocRaw("event_streams", "evt-sec3");
    assert.ok(publicDoc?.sealed_video_id, "Stream saved using N8N_WEBHOOK_API_KEY fallback (SEC-3)");

    // Anyone with only the leaked n8n key + public event_streams doc can decrypt the video ID & compute codeDocId
    const decryptedVideoId = await streamAccess.unsealStreamVideoId(leakedN8nKey, publicDoc.sealed_video_id);
    assert.equal(decryptedVideoId, "AbCdEfGhIjK", "Video ID decrypted using leaked N8N_WEBHOOK_API_KEY (SEC-3)");

    const derivedEmailHash = await streamAccess.hashStreamEmail(leakedN8nKey, "evt-sec3", "target@gdgjakarta.test");
    assert.equal(publicDoc.whitelist_email_hashes.includes(derivedEmailHash), true);
  });
});

// ============================================================================
// ST-03: Cross-Event IDOR
// ============================================================================

describe("ST-03: Cross-Event Session IDOR Protection", () => {
  test("revoke, heartbeat, and /leave on event-B cannot affect active session S1 belonging to event-A", async () => {
    await seedWhitelistedStream("event-A", { videoId: "AAAAAAAAAAA", emails: ["alice@gdgjakarta.test"] });
    await seedWhitelistedStream("event-B", { videoId: "BBBBBBBBBBB", emails: ["bob@gdgjakarta.test"] });

    // Create active session S1 on event-A
    const reqRes = await streamActions.requestStreamAccessCodeAction("event-A", "alice@gdgjakarta.test");
    assert.equal(reqRes.success, true);
    const otp = extractOtpFromLastEmail();
    const redeemRes = await streamActions.redeemStreamAccessCodeAction("event-A", "alice@gdgjakarta.test", otp);
    assert.equal(redeemRes.success, true);
    const s1 = redeemRes.sessionId;

    // 1. Cross-event organizer revoke on event-B
    await setAuthRole("organizer");
    const revokeB = await streamActions.revokeStreamSessionAction("event-B", s1);
    assert.equal(revokeB.success, false);
    assert.equal(revokeB.error, "Session not found.");

    // 2. Cross-event heartbeat on event-B
    harness.cookies.clear();
    const hbB = await streamActions.heartbeatStreamSessionAction("event-B", s1);
    assert.equal(hbB.active, false);

    // 3. Cross-event POST /api/events/event-B/stream/leave
    const leaveReq = new Request("https://gdgjakarta.com/api/events/event-B/stream/leave", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: s1 }),
    });
    const leaveRes = await leaveRoute.POST(leaveReq, { params: Promise.resolve({ eventId: "event-B" }) });
    assert.equal(leaveRes.status, 200);
    const leaveJson = await leaveRes.json();
    assert.deepEqual(leaveJson, { ok: true, expired: false });

    // Verify S1 is still active on event-A
    const sessionDoc = harness.getDocRaw("event_stream_sessions", s1);
    assert.equal(sessionDoc.status, "active");
    assert.equal(sessionDoc.ended_at, null);

    const hbA = await streamActions.heartbeatStreamSessionAction("event-A", s1);
    assert.equal(hbA.active, true);
  });

  test("[VULN CONFIRMED: SEC-8] stale zombie sessions never auto-expire server-side & unauthenticated code request kicks active viewer", async () => {
    await seedWhitelistedStream("event-sec8", { videoId: "CCCCCCCCCCC", emails: ["viewer@gdgjakarta.test"] });

    // Create active session
    const req1 = await streamActions.requestStreamAccessCodeAction("event-sec8", "viewer@gdgjakarta.test");
    assert.equal(req1.success, true);
    const otp1 = extractOtpFromLastEmail();
    const redeem1 = await streamActions.redeemStreamAccessCodeAction("event-sec8", "viewer@gdgjakarta.test", otp1);
    assert.equal(redeem1.success, true);
    const sid = redeem1.sessionId;

    // (a) Simulate viewer tab crash 10 minutes ago (stale last_heartbeat_at)
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const sessionDoc = harness.getDocRaw("event_stream_sessions", sid);
    harness.setDoc("event_stream_sessions", sid, {
      ...sessionDoc,
      started_at: tenMinAgo,
      last_heartbeat_at: tenMinAgo,
    });
    const hbStale = await streamActions.heartbeatStreamSessionAction("event-sec8", sid);
    assert.equal(
      hbStale.active,
      true,
      "Confirmed SEC-8(a): 10-minute stale session still accepted as active (no server-side heartbeat TTL)",
    );

    // (b) Age rate limit timestamp past 60s cooldown so an unauthenticated party knowing the email can request a code
    const codeDocId = await streamAccess.deriveStreamCodeDocId(TEST_STREAM_SECRET, "event-sec8", "viewer@gdgjakarta.test");
    const codeDoc = harness.getDocRaw("event_stream_codes", codeDocId);
    harness.setDoc("event_stream_codes", codeDocId, {
      ...codeDoc,
      rate_limit_timestamps: [Date.now() - 65_000],
    });

    // Unauthenticated caller triggers code request for victim's email -> immediately revokes victim's active session!
    harness.cookies.clear();
    const kickReq = await streamActions.requestStreamAccessCodeAction("event-sec8", "viewer@gdgjakarta.test");
    assert.equal(kickReq.success, true);

    const afterKickDoc = harness.getDocRaw("event_stream_sessions", sid);
    assert.equal(
      afterKickDoc.status,
      "revoked",
      "Confirmed SEC-8(b): Unauthenticated OTP request immediately revoked victim's active viewing session",
    );
  });
});

// ============================================================================
// ST-04: firestore.rules Security Matrix Verification (SEC-2, SEC-7)
// ============================================================================

describe("ST-04: firestore.rules Security Matrix Verification (SEC-2, SEC-7)", () => {
  const rulesText = fs.readFileSync(path.join(REPO_ROOT, "firestore.rules"), "utf8");

  function extractMatchBlock(collectionPath) {
    const marker = `match /${collectionPath}`;
    const startIdx = rulesText.indexOf(marker);
    assert.notEqual(startIdx, -1, `Could not find ${marker} in firestore.rules`);
    let depth = 0;
    let openSeen = false;
    for (let i = startIdx + marker.length; i < rulesText.length; i++) {
      if (rulesText[i] === "{") {
        depth++;
        openSeen = true;
      } else if (rulesText[i] === "}") {
        depth--;
        if (openSeen && depth === 0) {
          return rulesText.slice(startIdx, i + 1);
        }
      }
    }
    throw new Error(`Unbalanced braces for ${marker}`);
  }

  test("verifies secure invariants across all 4 stream collections in firestore.rules", () => {
    const streamsBlock = extractMatchBlock("event_streams/{eventId}");
    const privateBlock = extractMatchBlock("event_streams_private/{eventId}");
    const codesBlock = extractMatchBlock("event_stream_codes/{codeDocId}");
    const sessionsBlock = extractMatchBlock("event_stream_sessions/{sessionId}");

    // 1. event_streams_private strictly requires hasTeamAccess()
    assert.match(privateBlock, /allow\s+read,\s*write:\s*if\s+hasTeamAccess\(\);/);

    // 2. list and delete on all 3 public-get collections require hasTeamAccess()
    assert.match(streamsBlock, /allow\s+list,\s*delete:\s*if\s+hasTeamAccess\(\);/);
    assert.match(codesBlock, /allow\s+list,\s*delete:\s*if\s+hasTeamAccess\(\);/);
    assert.match(sessionsBlock, /allow\s+list,\s*delete:\s*if\s+hasTeamAccess\(\);/);

    // 3. event_streams create/update requires hasTeamAccess() and event_id == eventId
    assert.match(streamsBlock, /allow\s+create,\s*update:\s*if\s+hasTeamAccess\(\)/);
    assert.match(streamsBlock, /request\.resource\.data\.event_id\s*==\s*eventId/);

    // 4. event_stream_sessions update enforces non-resurrection and field allowlist
    assert.match(
      sessionsBlock,
      /affectedKeys\(\)\.hasOnly\(\['status',\s*'last_heartbeat_at',\s*'ended_at'\]\)/,
    );
    assert.match(
      sessionsBlock,
      /\(resource\.data\.status\s*==\s*'active'\s*\|\|\s*request\.resource\.data\.status\s*==\s*resource\.data\.status\)/,
    );

    // 5. event_stream_codes update preserves immutable id, event_id, email_hash
    assert.match(codesBlock, /request\.resource\.data\.id\s*==\s*resource\.data\.id/);
    assert.match(codesBlock, /request\.resource\.data\.event_id\s*==\s*resource\.data\.event_id/);
    assert.match(codesBlock, /request\.resource\.data\.email_hash\s*==\s*resource\.data\.email_hash/);
  });

  test("[VULN CONFIRMED: SEC-2 & SEC-7] flags unauthenticated create/update on codes/sessions (SEC-2) + UI DoS & public event_streams exposure (SEC-7)", async () => {
    const streamsBlock = extractMatchBlock("event_streams/{eventId}");
    const codesBlock = extractMatchBlock("event_stream_codes/{codeDocId}");
    const sessionsBlock = extractMatchBlock("event_stream_sessions/{sessionId}");

    // SEC-7: allow get: if true on event_streams exposes updated_by, whitelist_email_hashes, sealed_video_id
    assert.match(streamsBlock, /allow\s+get:\s*if\s+true;/, "Expected SEC-7: public get on event_streams");

    // SEC-2: allow create on event_stream_codes and event_stream_sessions lacks auth check
    const codesCreateRule = codesBlock.match(/allow\s+create:\s*if([\s\S]*?);/)?.[1] ?? "";
    const codesUpdateRule = codesBlock.match(/allow\s+update:\s*if([\s\S]*?);/)?.[1] ?? "";
    const sessionsCreateRule = sessionsBlock.match(/allow\s+create:\s*if([\s\S]*?);/)?.[1] ?? "";
    const sessionsUpdateRule = sessionsBlock.match(/allow\s+update:\s*if([\s\S]*?);/)?.[1] ?? "";

    assert.equal(/request\.auth|hasTeamAccess/.test(codesCreateRule), false, "Confirmed SEC-2: unauth codes create");
    assert.equal(/hasTeamAccess\(\)\s*\|\|/.test(codesUpdateRule), true, "Confirmed SEC-2: unauth codes update branch");
    assert.equal(
      /request\.auth|hasTeamAccess/.test(sessionsCreateRule),
      false,
      "Confirmed SEC-2: unauth sessions create",
    );
    assert.equal(
      /hasTeamAccess\(\)\s*\|\|/.test(sessionsUpdateRule),
      true,
      "Confirmed SEC-2: unauth sessions update branch",
    );

    // Empirical SEC-2 Exploit 1 (UI DoS): Attacker creates 105 fake active sessions via unauth Firestore write,
    // pushing a real viewer's active session out of the organizer's unordered `limit: 100` query!
    await seedWhitelistedStream("evt-sec2-dos", { emails: ["realviewer@gdgjakarta.test"] });
    const now = Date.now();
    for (let i = 0; i < 105; i++) {
      const fakeId = `strm_${String(i).padStart(32, "0")}`;
      harness.setDoc("event_stream_sessions", fakeId, {
        id: fakeId,
        event_id: "evt-sec2-dos",
        viewer_email_masked: `sp***@attacker.invalid`,
        status: "active",
        started_at: now - 10_000 + i,
        last_heartbeat_at: now - 10_000 + i,
        ended_at: null,
      });
    }
    // Real viewer joins after the flood
    const realSessionId = "strm_ffffffffffffffffffffffffffffffff";
    harness.setDoc("event_stream_sessions", realSessionId, {
      id: realSessionId,
      event_id: "evt-sec2-dos",
      viewer_email_masked: "re***@gdgjakarta.test",
      status: "active",
      started_at: now + 5000,
      last_heartbeat_at: now + 5000,
      ended_at: null,
    });

    await setAuthRole("organizer");
    const cfg = await streamActions.getEventStreamConfigAction("evt-sec2-dos");
    assert.equal(cfg.success, true);
    assert.equal(cfg.data.sessions.length, 100);
    const realSessionVisible = cfg.data.sessions.some((s) => s.id === realSessionId);
    assert.equal(
      realSessionVisible,
      false,
      "Confirmed SEC-2/PERF-6: 105 unauthenticated fake sessions evicted real active session from organizer UI",
    );
  });
});

// ============================================================================
// ST-05: Concurrent OTP Redemption TOCTOU Race PoC (SEC-1)
// ============================================================================

describe("ST-05: Concurrent OTP Redemption TOCTOU Race PoC (SEC-1)", () => {
  test("[VULN CONFIRMED: SEC-1] 10 concurrent redemptions of a single OTP open multiple active sessions", async () => {
    await seedWhitelistedStream("evt-st05", { emails: ["race@gdgjakarta.test"] });

    const reqRes = await streamActions.requestStreamAccessCodeAction("evt-st05", "race@gdgjakarta.test");
    assert.equal(reqRes.success, true);
    const otp = extractOtpFromLastEmail();

    // Simulate realistic 5ms Firestore REST network latency
    harness.firestoreDelayMs = 5;

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        streamActions.redeemStreamAccessCodeAction("evt-st05", "race@gdgjakarta.test", otp),
      ),
    );

    const successes = results.filter((r) => r.success);
    const uniqueSessionIds = new Set(successes.map((r) => r.sessionId));

    // Verify how many active sessions exist in Firestore vs the single active_session_id tracked on codeDoc
    const allSessions = Array.from(harness.getCollection("event_stream_sessions").values()).filter(
      (s) => s.event_id === "evt-st05" && s.status === "active",
    );
    const codeDocId = await streamAccess.deriveStreamCodeDocId(TEST_STREAM_SECRET, "evt-st05", "race@gdgjakarta.test");
    const codeDoc = harness.getDocRaw("event_stream_codes", codeDocId);

    console.log(
      `[ST-05 METRIC] Concurrent OTP redemptions succeeded: ${successes.length}/10 | ` +
        `Active sessions created: ${allSessions.length} | Tracked in codeDoc.active_session_id: 1 (${codeDoc.active_session_id}) | ` +
        `Orphaned sessions: ${allSessions.length - 1}`,
    );

    assert.ok(
      successes.length > 1,
      `Expected SEC-1 race condition (>1 success under 5ms latency), got ${successes.length}`,
    );
    assert.equal(uniqueSessionIds.size, successes.length, "Each winning race created a distinct session ID");
    assert.equal(allSessions.length, successes.length, "All winning sessions remain active in Firestore");
  });
});

// ============================================================================
// ST-06: Concurrent Brute-Force Attempt Lockout Bypass PoC (SEC-1)
// ============================================================================

describe("ST-06: Concurrent Brute-Force Attempt Lockout Bypass PoC (SEC-1)", () => {
  test("[VULN CONFIRMED: SEC-1] 15 concurrent wrong OTP guesses bypass 5-attempt lockout due to lost-update race", async () => {
    await seedWhitelistedStream("evt-st06", { emails: ["brute@gdgjakarta.test"] });

    const reqRes = await streamActions.requestStreamAccessCodeAction("evt-st06", "brute@gdgjakarta.test");
    assert.equal(reqRes.success, true);
    const realOtp = extractOtpFromLastEmail();

    harness.firestoreDelayMs = 5;

    const wrongAttempts = await Promise.all(
      Array.from({ length: 15 }, (_, idx) =>
        streamActions.redeemStreamAccessCodeAction("evt-st06", "brute@gdgjakarta.test", `BAD${String(idx).padStart(3, "2")}`),
      ),
    );

    const slippedPastLockout = wrongAttempts.filter((r) => !r.success && /remaining/i.test(r.error));
    const codeDocId = await streamAccess.deriveStreamCodeDocId(TEST_STREAM_SECRET, "evt-st06", "brute@gdgjakarta.test");
    const codeDoc = harness.getDocRaw("event_stream_codes", codeDocId);

    console.log(
      `[ST-06 METRIC] Concurrent wrong guesses: 15 | Slipped past lockout: ${slippedPastLockout.length} | ` +
        `Persisted codeDoc.attempts: ${codeDoc.attempts} (expected >=5 if atomic) | codeDoc.status: ${codeDoc.status}`,
    );

    assert.ok(slippedPastLockout.length > 5, `Expected >5 guesses to slip past lockout (SEC-1), got ${slippedPastLockout.length}`);
    assert.ok(codeDoc.attempts < 5, `Expected lost-update counter < 5 (SEC-1), got ${codeDoc.attempts}`);
    assert.equal(codeDoc.status, "pending", "Code remained pending despite 15 wrong guesses (SEC-1)");

    // Prove the OTP is still redeemable even after 15 failed guesses!
    harness.firestoreDelayMs = 0;
    const postBruteRedeem = await streamActions.redeemStreamAccessCodeAction("evt-st06", "brute@gdgjakarta.test", realOtp);
    assert.equal(postBruteRedeem.success, true, "OTP still redeemed after 15 concurrent wrong attempts (SEC-1)");
  });
});

// ============================================================================
// ST-07: Concurrent Rate-Limit Bypass PoC (SEC-1)
// ============================================================================

describe("ST-07: Concurrent Rate-Limit Bypass PoC (SEC-1)", () => {
  test("[VULN CONFIRMED: SEC-1] 10 concurrent OTP requests bypass 60s cooldown & 5/hr cap, causing email-bombing", async () => {
    await seedWhitelistedStream("evt-st07", { emails: ["flood@gdgjakarta.test"] });
    harness.sentEmails.length = 0;
    harness.firestoreDelayMs = 5;

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        streamActions.requestStreamAccessCodeAction("evt-st07", "flood@gdgjakarta.test"),
      ),
    );

    const succeeded = results.filter((r) => r.success).length;
    const emailsDispatched = harness.sentEmails.length;

    console.log(
      `[ST-07 METRIC] Concurrent OTP requests: 10 | Succeeded: ${succeeded} | Emails dispatched to n8n: ${emailsDispatched} (limit should be 1/60s, 5/hr)`,
    );

    assert.ok(succeeded > 1, `Expected SEC-1 rate-limit bypass (>1 success), got ${succeeded}`);
    assert.ok(emailsDispatched > 5, `Expected >5 emails bypassing both 60s cooldown and 5/hr cap, got ${emailsDispatched}`);
  });
});

// ============================================================================
// ST-08: Email HTML Injection (SEC-5) & Whitelist Enumeration (SEC-6) PoC
// ============================================================================

describe("ST-08: Email HTML Injection (SEC-5) & Whitelist Enumeration (SEC-6)", () => {
  test("[VULN CONFIRMED: SEC-5] unescaped caller-supplied eventTitle injects raw HTML into OTP email when stream title is empty", async () => {
    await seedWhitelistedStream("evt-st08", {
      title: "", // Empty stream title triggers fallback to caller-supplied eventTitle
      emails: ["victim@gdgjakarta.test"],
    });
    harness.sentEmails.length = 0;

    const injectedTitle = '<a href="https://evil.test">Verify Account</a>';
    const res = await streamActions.requestStreamAccessCodeAction("evt-st08", "victim@gdgjakarta.test", injectedTitle);
    assert.equal(res.success, true);
    assert.equal(harness.sentEmails.length, 1);

    const email = harness.sentEmails[0];
    assert.equal(
      email.bodyEmail.includes(`<strong>${injectedTitle}</strong>`),
      true,
      "Confirmed SEC-5: Raw HTML injected unescaped into OTP email body",
    );
    assert.equal(
      email.subjectEmail.includes(injectedTitle),
      true,
      "Confirmed SEC-5: Untrusted caller eventTitle interpolated into email subject",
    );
  });

  test("[VULN CONFIRMED: SEC-6] rapid probing of 20 non-whitelisted emails returns distinct oracle error with zero rate limiting", async () => {
    await seedWhitelistedStream("evt-st08-enum", { emails: ["real-attendee@gdgjakarta.test"] });

    let distinctOracleCount = 0;
    let rateLimitedCount = 0;

    for (let i = 0; i < 20; i++) {
      const res = await streamActions.requestStreamAccessCodeAction("evt-st08-enum", `probe${i}@external.test`);
      assert.equal(res.success, false);
      if (res.error === "This email is not on the approved whitelist for this stream. Please contact the event organizer.") {
        distinctOracleCount++;
      }
      if (res.retryAfterSec !== undefined) {
        rateLimitedCount++;
      }
    }

    console.log(
      `[ST-08 METRIC] Non-whitelisted probes: 20 | Distinct oracle responses: ${distinctOracleCount} | Rate-limited: ${rateLimitedCount}`,
    );

    assert.equal(distinctOracleCount, 20, "Confirmed SEC-6: All 20 probes received distinct non-whitelisted oracle error");
    assert.equal(rateLimitedCount, 0, "Confirmed SEC-6: Zero rate limiting on whitelist enumeration probes");
  });
});

// ============================================================================
// ST-09: /api/events/[eventId]/stream/leave Input Validation & Body-Size Abuse (SEC-9)
// ============================================================================

describe("ST-09: /api/events/[eventId]/stream/leave Input Validation & Body-Size Abuse (SEC-9)", () => {
  async function postLeave(eventId, rawBody) {
    const req = new Request(`https://gdgjakarta.com/api/events/${eventId}/stream/leave`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rawBody,
    });
    return leaveRoute.POST(req, { params: Promise.resolve({ eventId }) });
  }

  test("rejects empty body, invalid JSON, path traversal, and SQL/NoSQL injection payloads with HTTP 400", async () => {
    // 1. Empty body
    const emptyRes = await postLeave("evt-st09", "");
    assert.equal(emptyRes.status, 400);
    assert.deepEqual(await emptyRes.json(), { ok: false, error: "Empty body" });

    // 2. Invalid JSON
    const badJsonRes = await postLeave("evt-st09", "{not valid json");
    assert.equal(badJsonRes.status, 400);
    assert.deepEqual(await badJsonRes.json(), { ok: false });

    // 3. Path traversal
    const traversalRes = await postLeave("evt-st09", JSON.stringify({ sessionId: "../other" }));
    assert.equal(traversalRes.status, 400);
    assert.deepEqual(await traversalRes.json(), { ok: false, error: "Invalid sessionId" });

    // 4. SQL injection payload
    const sqliRes = await postLeave("evt-st09", JSON.stringify({ sessionId: "strm_' OR '1'='1" }));
    assert.equal(sqliRes.status, 400);
    assert.deepEqual(await sqliRes.json(), { ok: false, error: "Invalid sessionId" });

    // 5. NoSQL object injection payload
    const nosqliRes = await postLeave("evt-st09", JSON.stringify({ sessionId: { $ne: "" } }));
    assert.equal(nosqliRes.status, 400);
    assert.deepEqual(await nosqliRes.json(), { ok: false, error: "Invalid sessionId" });
  });

  test("[VULN CONFIRMED: SEC-9] accepts and fully buffers a 2 MB request body without HTTP 413 guard", async () => {
    const validSessionId = streamAccess.generateStreamSessionId();
    const now = Date.now();
    harness.setDoc("event_stream_sessions", validSessionId, {
      id: validSessionId,
      event_id: "evt-st09",
      viewer_email_masked: "al***@gdgjakarta.test",
      status: "active",
      started_at: now,
      last_heartbeat_at: now,
      ended_at: null,
    });

    const twoMbPadding = "A".repeat(2 * 1024 * 1024);
    const oversizedBody = JSON.stringify({ sessionId: validSessionId, pad: twoMbPadding });
    assert.ok(oversizedBody.length > 2 * 1024 * 1024, "Payload must exceed 2 MB");

    const res = await postLeave("evt-st09", oversizedBody);
    const json = await res.json();

    console.log(
      `[ST-09 METRIC] Oversized body (${(oversizedBody.length / (1024 * 1024)).toFixed(2)} MB) -> HTTP ${res.status} ${JSON.stringify(json)}`,
    );

    // Currently buffers & processes the full 2 MB body (returns 200 instead of 413 Payload Too Large)
    assert.equal(res.status, 200, "Confirmed SEC-9: /leave lacks body-size cap and processed a >2 MB payload");
    assert.deepEqual(json, { ok: true, expired: true });
  });
});

// ============================================================================
// ST-10: Cryptographic Tamper & Statistical Uniformity Tests
// ============================================================================

describe("ST-10: Cryptographic Tamper, Missing AAD (SEC-9), timingSafeEqualHex & OTP Uniformity", () => {
  test("unsealStreamVideoId rejects bit-flipped ciphertext, bit-flipped IV, truncated IV, wrong secret, and wrong version prefix", async () => {
    const secret = TEST_STREAM_SECRET;
    const videoId = "dQw4w9WgXcQ";
    const sealed1 = await streamAccess.sealStreamVideoId(secret, videoId);
    const sealed2 = await streamAccess.sealStreamVideoId(secret, videoId);

    // Roundtrip + random IV check
    assert.equal(await streamAccess.unsealStreamVideoId(secret, sealed1), videoId);
    assert.notEqual(sealed1, sealed2, "Fresh 12-byte random IV must produce distinct ciphertexts");

    const [version, b64Iv, b64Ct] = sealed1.split(".");
    assert.equal(version, "v1");

    // 1. Bit-flipped ciphertext
    const ctBytes = Buffer.from(b64Ct, "base64");
    ctBytes[0] ^= 0x01;
    const tamperedCt = `v1.${b64Iv}.${ctBytes.toString("base64")}`;
    assert.equal(await streamAccess.unsealStreamVideoId(secret, tamperedCt), null);

    // 2. Bit-flipped IV
    const ivBytes = Buffer.from(b64Iv, "base64");
    ivBytes[0] ^= 0x80;
    const tamperedIv = `v1.${ivBytes.toString("base64")}.${b64Ct}`;
    assert.equal(await streamAccess.unsealStreamVideoId(secret, tamperedIv), null);

    // 3. Truncated IV (6 bytes instead of 12)
    const truncatedIv = `v1.${Buffer.from(b64Iv, "base64").subarray(0, 6).toString("base64")}.${b64Ct}`;
    assert.equal(await streamAccess.unsealStreamVideoId(secret, truncatedIv), null);

    // 4. Wrong secret
    assert.equal(await streamAccess.unsealStreamVideoId(`${secret}-wrong`, sealed1), null);

    // 5. Wrong version prefix
    assert.equal(await streamAccess.unsealStreamVideoId(secret, `v2.${b64Iv}.${b64Ct}`), null);

    // 6. Malformed inputs
    assert.equal(await streamAccess.unsealStreamVideoId(secret, ""), null);
    assert.equal(await streamAccess.unsealStreamVideoId(secret, "v1.onlytwo"), null);
    assert.equal(await streamAccess.unsealStreamVideoId(secret, "v1.!!!.???"), null);
  });

  test("[VULN CONFIRMED: SEC-9] cross-event ciphertext replay succeeds due to missing eventId AAD in AES-GCM", async () => {
    // Seal videoId intended for event-A (notice API takes no eventId / AAD)
    const sealedForEventA = await streamAccess.sealStreamVideoId(TEST_STREAM_SECRET, "SECRET_EVT_A");

    // Replay the exact ciphertext into event-B's stream doc
    const eventBEmailHash = await streamAccess.hashStreamEmail(TEST_STREAM_SECRET, "event-B", "bob@gdgjakarta.test");
    harness.setDoc("event_streams", "event-B", {
      event_id: "event-B",
      enabled: true,
      title: "Event B",
      access_mode: "whitelisted",
      watermark_enabled: true,
      include_approved_registrants: false,
      public_youtube_video_id: null,
      sealed_video_id: sealedForEventA, // Replayed ciphertext from event-A!
      whitelist_email_hashes: [eventBEmailHash],
      whitelist_count: 1,
      updated_at: new Date().toISOString(),
      updated_by: null,
    });

    const reqRes = await streamActions.requestStreamAccessCodeAction("event-B", "bob@gdgjakarta.test");
    assert.equal(reqRes.success, true);
    const otp = extractOtpFromLastEmail();
    const redeemRes = await streamActions.redeemStreamAccessCodeAction("event-B", "bob@gdgjakarta.test", otp);
    assert.equal(redeemRes.success, true);
    assert.equal(
      redeemRes.youtubeVideoId,
      "SECRET_EVT_A",
      "Confirmed SEC-9: Ciphertext from event-A decrypted cleanly under event-B (missing AAD)",
    );
  });

  test("timingSafeEqualHex handles equal, single-bit diff, length mismatch, and empty strings", () => {
    const h1 = "a".repeat(64);
    const h2 = `${"a".repeat(63)}b`;
    const h3 = `b${"a".repeat(63)}`;

    assert.equal(streamAccess.timingSafeEqualHex(h1, h1), true);
    assert.equal(streamAccess.timingSafeEqualHex(h1, h2), false);
    assert.equal(streamAccess.timingSafeEqualHex(h1, h3), false);
    assert.equal(streamAccess.timingSafeEqualHex(h1, h1.slice(0, 63)), false);
    assert.equal(streamAccess.timingSafeEqualHex("", ""), true);
    assert.equal(streamAccess.timingSafeEqualHex("", "a"), false);
  });

  test("generateStreamOtpCode produces 100,000 samples with zero forbidden chars and Pearson chi-squared < 45 (df=31, p > 0.05)", () => {
    const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    const FORBIDDEN = new Set(["0", "O", "1", "I"]);
    const SAMPLES = 100_000;
    const CODE_LEN = 6;
    const TOTAL_CHARS = SAMPLES * CODE_LEN;
    const EXPECTED = TOTAL_CHARS / ALPHABET.length; // 18,750

    function runUniformityTrial() {
      /** @type {Map<string, number>} */
      const counts = new Map();
      for (const ch of ALPHABET) counts.set(ch, 0);

      for (let i = 0; i < SAMPLES; i++) {
        const code = streamAccess.generateStreamOtpCode(CODE_LEN);
        assert.equal(code.length, CODE_LEN);
        for (let j = 0; j < CODE_LEN; j++) {
          const ch = code[j];
          assert.equal(FORBIDDEN.has(ch), false, `Forbidden ambiguous character found: ${ch}`);
          assert.equal(counts.has(ch), true, `Unexpected character outside 32-char alphabet: ${ch}`);
          counts.set(ch, counts.get(ch) + 1);
        }
      }

      let chiSquared = 0;
      let minCount = Infinity;
      let maxCount = -Infinity;
      for (const count of counts.values()) {
        chiSquared += (count - EXPECTED) ** 2 / EXPECTED;
        if (count < minCount) minCount = count;
        if (count > maxCount) maxCount = count;
      }
      return { chiSquared, minCount, maxCount };
    }

    // A true uniform CSPRNG exceeds chi2=44.985 (df=31, alpha=0.05) 5% of the time.
    // Re-running once on a tail event reduces false-positive flake rate to 0.25% while any real modulo bias fails both.
    let result = runUniformityTrial();
    let trials = 1;
    if (result.chiSquared >= 45) {
      result = runUniformityTrial();
      trials = 2;
    }

    console.log(
      `[ST-10 METRIC] OTP uniformity (${SAMPLES.toLocaleString()} codes = ${TOTAL_CHARS.toLocaleString()} chars, 32-char alphabet, df=31, trials=${trials}): ` +
        `chi2=${result.chiSquared.toFixed(3)} (critical p=0.05 is 44.985) | min=${result.minCount}, max=${result.maxCount}, expected=${EXPECTED}`,
    );

    assert.ok(
      result.chiSquared < 45,
      `OTP distribution failed chi-squared uniformity test across ${trials} trials: chi2=${result.chiSquared.toFixed(3)} >= 45`,
    );
  });
});
