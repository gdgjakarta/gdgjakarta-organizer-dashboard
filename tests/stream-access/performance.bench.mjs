/**
 * Empirical Performance Benchmark Suite for Restricted Event YouTube Stream Access
 *
 * Benchmarks the REAL production modules:
 *   - src/lib/events/stream-access.ts
 *   - src/server/stream-actions.ts
 *   - src/lib/events/media-utils.ts
 *
 * Uses Node 22 native TypeScript stripping (`--experimental-strip-types`) and
 * `node:module.registerHooks` to stub ONLY external I/O boundaries:
 *   - @/server/firestore-admin (faithful in-memory Firestore REST wire encoder/decoder + metrics)
 *   - @/server/auth-guard (controllable organizer session)
 *   - @/server/email-template-actions (in-memory email outbox, zero live network calls)
 *
 * Run:
 *   node --experimental-strip-types tests/stream-access/performance.bench.mjs
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SRC_ROOT = path.join(REPO_ROOT, "src");

// Dedicated test secret (zero fallback to production secrets)
process.env.STREAM_ACCESS_SECRET = "perf-bench-stream-access-secret-2026-gdg-jakarta-0123456789abcdef";

// ---------------------------------------------------------------------------
// 1. Faithful Firestore REST Wire Encoder / Decoder (mirrors src/server/firestore-admin.ts)
// ---------------------------------------------------------------------------
function encodeFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeFirestoreValue) } };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = encodeFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function encodeFirestoreFields(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = encodeFirestoreValue(v);
  }
  return fields;
}

function decodeFirestoreValue(val) {
  if (!val || typeof val !== "object") return val;
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("booleanValue" in val) return Boolean(val.booleanValue);
  if ("nullValue" in val) return null;
  if ("timestampValue" in val) return val.timestampValue;
  if ("mapValue" in val) {
    const fields = val.mapValue?.fields ?? {};
    const res = {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = decodeFirestoreValue(v);
    }
    return res;
  }
  if ("arrayValue" in val) {
    const values = val.arrayValue?.values ?? [];
    return values.map(decodeFirestoreValue);
  }
  if ("bytesValue" in val) return val.bytesValue;
  if ("referenceValue" in val) return val.referenceValue;
  if ("geoPointValue" in val) return val.geoPointValue;
  return val;
}

function decodeFirestoreDoc(doc) {
  if (!doc?.fields) return null;
  const res = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    res[k] = decodeFirestoreValue(v);
  }
  return res;
}

// ---------------------------------------------------------------------------
// 2. In-Memory Firestore Store & Instrumentation Harness
// ---------------------------------------------------------------------------
const harness = {
  /** @type {Map<string, Map<string, string>>} collection -> (docId -> Firestore REST JSON string) */
  collections: new Map(),
  emailsSent: [],
  organizerAuthorized: true,
  organizerUser: {
    id: "org-perf-001",
    name: "Perf Organizer",
    email: "organizer@gdgjakarta.com",
  },
  stats: {
    gets: 0,
    patches: 0,
    queries: 0,
    queryDocsReturned: 0,
    bytesRead: 0,
    bytesWritten: 0,
  },

  resetStats() {
    this.stats.gets = 0;
    this.stats.patches = 0;
    this.stats.queries = 0;
    this.stats.queryDocsReturned = 0;
    this.stats.bytesRead = 0;
    this.stats.bytesWritten = 0;
  },

  resetAll() {
    this.collections.clear();
    this.emailsSent.length = 0;
    this.resetStats();
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
    const col = this.getCollection(collectionName);
    const wireDoc = {
      name: `projects/gdgjakarta-app/databases/(default)/documents/${collectionName}/${docId}`,
      fields: encodeFirestoreFields(data),
    };
    const json = JSON.stringify(wireDoc);
    col.set(docId, json);
    return Buffer.byteLength(json, "utf8");
  },

  getRawDocBytes(collectionName, docId) {
    const json = this.collections.get(collectionName)?.get(docId);
    return json ? Buffer.byteLength(json, "utf8") : 0;
  },

  async getFirestoreDoc(collectionName, docId) {
    this.stats.gets += 1;
    const json = this.collections.get(collectionName)?.get(docId);
    if (!json) return null;
    this.stats.bytesRead += Buffer.byteLength(json, "utf8");
    const parsed = JSON.parse(json);
    return decodeFirestoreDoc(parsed);
  },

  async patchFirestoreDocDetailed(collectionName, docId, data, merge = true) {
    this.stats.patches += 1;
    const col = this.getCollection(collectionName);
    let nextData = data;
    if (merge && col.has(docId)) {
      const existing = decodeFirestoreDoc(JSON.parse(col.get(docId))) ?? {};
      nextData = { ...existing, ...data };
    }
    const wirePayload = {
      name: `projects/gdgjakarta-app/databases/(default)/documents/${collectionName}/${docId}`,
      fields: encodeFirestoreFields(nextData),
    };
    const json = JSON.stringify(wirePayload);
    const patchBodyJson = JSON.stringify({ fields: encodeFirestoreFields(data) });
    this.stats.bytesWritten += Buffer.byteLength(patchBodyJson, "utf8");
    col.set(docId, json);
    return { ok: true, status: 200 };
  },

  async queryFirestoreDocs(collectionId, filters, limit) {
    this.stats.queries += 1;
    const col = this.collections.get(collectionId);
    if (!col) return [];

    const matchedWireItems = [];
    for (const [docId, json] of col.entries()) {
      const wireDoc = JSON.parse(json);
      const decoded = decodeFirestoreDoc(wireDoc);
      if (!decoded) continue;

      let matches = true;
      if (Array.isArray(filters)) {
        for (const f of filters) {
          const ff = f?.fieldFilter;
          if (!ff) continue;
          const fieldPath = ff.field?.fieldPath;
          const op = ff.op;
          const targetVal = decodeFirestoreValue(ff.value);
          const actualVal = decoded[fieldPath];
          if (op === "EQUAL" && actualVal !== targetVal) {
            matches = false;
            break;
          }
        }
      }
      if (!matches) continue;

      matchedWireItems.push({ document: wireDoc, docId });
      if (typeof limit === "number" && limit > 0 && matchedWireItems.length >= limit) {
        break;
      }
    }

    // Account for real runQuery REST JSON response bytes + decode cost
    const wireResponseJson = JSON.stringify(matchedWireItems.map((m) => ({ document: m.document })));
    this.stats.bytesRead += Buffer.byteLength(wireResponseJson, "utf8");
    const parsedResponse = JSON.parse(wireResponseJson);

    const results = [];
    for (const item of parsedResponse) {
      if (!item.document) continue;
      const id = item.document.name?.split("/").pop() ?? "";
      const decoded = decodeFirestoreDoc(item.document);
      if (decoded) {
        results.push({ id, ...decoded });
      }
    }
    this.stats.queryDocsReturned += results.length;
    return results;
  },
};

globalThis.__STREAM_PERF_HARNESS__ = harness;

// ---------------------------------------------------------------------------
// 3. Register Node 22 Module Hooks for `@/*` & I/O Boundary Stubs
// ---------------------------------------------------------------------------
const VIRTUAL_MODULES = {
  "bench:firestore-admin": `
    const h = globalThis.__STREAM_PERF_HARNESS__;
    export const getFirestoreDoc = (c, id, t) => h.getFirestoreDoc(c, id, t);
    export const patchFirestoreDocDetailed = (c, id, d, m, t) => h.patchFirestoreDocDetailed(c, id, d, m, t);
    export const queryFirestoreDocs = (c, f, l, t) => h.queryFirestoreDocs(c, f, l, t);
  `,
  "bench:auth-guard": `
    const h = globalThis.__STREAM_PERF_HARNESS__;
    export async function isAuthorizedOrganizerSession() { return h.organizerAuthorized; }
    export async function getAuthenticatedSessionUser() { return h.organizerUser; }
  `,
  "bench:email-template-actions": `
    const h = globalThis.__STREAM_PERF_HARNESS__;
    export async function sendEmailDirectInternal(payload) {
      h.emailsSent.push(payload);
      return { success: true };
    }
  `,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/server/firestore-admin") {
      return { url: "bench:firestore-admin", shortCircuit: true };
    }
    if (specifier === "@/server/auth-guard") {
      return { url: "bench:auth-guard", shortCircuit: true };
    }
    if (specifier === "@/server/email-template-actions") {
      return { url: "bench:email-template-actions", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const rel = specifier.slice(2);
      const candidates = [
        path.join(SRC_ROOT, `${rel}.ts`),
        path.join(SRC_ROOT, `${rel}.tsx`),
        path.join(SRC_ROOT, rel, "index.ts"),
        path.join(SRC_ROOT, rel),
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url in VIRTUAL_MODULES) {
      return {
        format: "module",
        source: VIRTUAL_MODULES[url],
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

// Import REAL production modules after hooks are registered
const streamAccess = await import("@/lib/events/stream-access");
const streamActions = await import("@/server/stream-actions");

// ---------------------------------------------------------------------------
// 4. Stats & Formatting Utilities
// ---------------------------------------------------------------------------
function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function round(n, digits = 2) {
  return Number(n.toFixed(digits));
}

function heapMB() {
  return process.memoryUsage().heapUsed / (1024 * 1024);
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 ** 2)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function generateEmails(count, prefix = "attendee") {
  const arr = new Array(count);
  for (let i = 0; i < count; i++) {
    arr[i] = `${prefix}.${String(i + 1).padStart(5, "0")}@example-gdg.id`;
  }
  return arr;
}

const FIRESTORE_MAX_DOC_BYTES = 1_048_576; // 1 MiB
const TEST_VIDEO_ID = "dQw4w9WgXcQ";
const TEST_VIDEO_URL = `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`;
const SECRET = process.env.STREAM_ACCESS_SECRET;

// Warm up V8 JIT and WebCrypto subsystem with a small throwaway run
async function warmup() {
  const s = await streamAccess.sealStreamVideoId(SECRET, TEST_VIDEO_ID);
  assert.equal(await streamAccess.unsealStreamVideoId(SECRET, s), TEST_VIDEO_ID);
  await Promise.all(
    generateEmails(20, "warmup").map((em) => streamAccess.hashStreamEmail(SECRET, "evt-warmup", em)),
  );
}

// ---------------------------------------------------------------------------
// PB-01: Whitelist HMAC Hashing Scaling
// ---------------------------------------------------------------------------
async function runPB01() {
  const tiers = [500, 2000, 5000, 10000];
  const directResults = [];
  const saveActionResults = [];

  for (const n of tiers) {
    const emails = generateEmails(n, "pb01");
    const eventId = `evt-pb01-${n}`;

    // 1a. Direct hashStreamEmail in Promise.all (mirrors stream-actions.ts:217)
    const heapBefore = heapMB();
    const t0 = performance.now();
    const hashes = await Promise.all(emails.map((em) => streamAccess.hashStreamEmail(SECRET, eventId, em)));
    const wallMs = performance.now() - t0;
    const heapDelta = heapMB() - heapBefore;

    assert.equal(hashes.length, n);
    assert.equal(hashes[0].length, 64);

    directResults.push({
      n,
      wallMs: round(wallMs, 2),
      throughputEmailsPerSec: Math.round((n / wallMs) * 1000),
      heapDeltaMB: round(heapDelta, 2),
    });

    // 1b. Full saveEventStreamConfigAction (manual whitelist)
    harness.resetAll();
    const rawWhitelist = emails.join("\n");
    const saveHeapBefore = heapMB();
    const s0 = performance.now();
    const res = await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: `DevFest Stream PB-01 (${n})`,
      youtubeUrl: TEST_VIDEO_URL,
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: rawWhitelist,
    });
    const saveWallMs = performance.now() - s0;
    const saveHeapDelta = heapMB() - saveHeapBefore;

    assert.equal(res.success, true);
    assert.equal(res.whitelistCount, n);

    saveActionResults.push({
      n,
      wallMs: round(saveWallMs, 2),
      throughputEmailsPerSec: Math.round((n / saveWallMs) * 1000),
      heapDeltaMB: round(saveHeapDelta, 2),
      firestoreBytesWritten: harness.stats.bytesWritten,
      firestorePatches: harness.stats.patches,
    });
  }

  // 1c. parseWhitelistEmails at N = 10,000 (mixed delimiters + 500 duplicates)
  const raw10k = generateEmails(10000, "parse")
    .concat(generateEmails(500, "parse"))
    .map((em, idx) => (idx % 3 === 0 ? `  ${em.toUpperCase()} ` : em))
    .join(idxSep());
  function idxSep() {
    return ",\n";
  }
  const pHeapBefore = heapMB();
  const p0 = performance.now();
  const parsed = streamAccess.parseWhitelistEmails(raw10k);
  const parseMs = performance.now() - p0;
  const parseHeapDelta = heapMB() - pHeapBefore;
  assert.equal(parsed.valid.length, 10000);
  assert.equal(parsed.invalid.length, 0);

  // 1d. Reference comparison: single cached importKey + shared TextEncoder at N = 10,000
  const emails10k = generateEmails(10000, "cached");
  const enc = new TextEncoder();
  const c0 = performance.now();
  const cachedKey = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const cachedHashes = await Promise.all(
    emails10k.map(async (em) => {
      const sig = await globalThis.crypto.subtle.sign(
        "HMAC",
        cachedKey,
        enc.encode(`email:evt-pb01-cached:${em}`),
      );
      return Buffer.from(sig).toString("hex");
    }),
  );
  const cachedWallMs = performance.now() - c0;
  assert.equal(cachedHashes.length, 10000);
  // Sanity-verify exact parity with production hashStreamEmail
  const prodHash0 = await streamAccess.hashStreamEmail(SECRET, "evt-pb01-cached", emails10k[0]);
  assert.equal(cachedHashes[0], prodHash0);

  const prod10kMs = directResults.find((r) => r.n === 10000).wallMs;
  const speedupRatio = round(prod10kMs / cachedWallMs, 2);

  return {
    directResults,
    saveActionResults,
    parseWhitelist10k: {
      inputTokens: 10500,
      uniqueValid: parsed.valid.length,
      wallMs: round(parseMs, 2),
      heapDeltaMB: round(parseHeapDelta, 2),
    },
    cachedKeyComparison10k: {
      productionPerEmailImportKeyMs: prod10kMs,
      cachedSingleImportKeyMs: round(cachedWallMs, 2),
      speedupFactor: speedupRatio,
    },
  };
}

// ---------------------------------------------------------------------------
// PB-02: AES-256-GCM Seal/Unseal Concurrency
// ---------------------------------------------------------------------------
async function runPB02() {
  const N = 1000;

  // 1,000 concurrent sealStreamVideoId calls
  const sealLatencies = new Array(N);
  const sealHeapBefore = heapMB();
  const st0 = performance.now();
  const sealedValues = await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const t = performance.now();
      const sealed = await streamAccess.sealStreamVideoId(SECRET, TEST_VIDEO_ID);
      sealLatencies[i] = performance.now() - t;
      return sealed;
    }),
  );
  const sealWallMs = performance.now() - st0;
  const sealHeapDelta = heapMB() - sealHeapBefore;

  assert.equal(sealedValues.length, N);
  assert.ok(sealedValues[0].startsWith("v1."));

  // 1,000 concurrent unsealStreamVideoId calls
  const unsealLatencies = new Array(N);
  const unsealHeapBefore = heapMB();
  const ut0 = performance.now();
  const plainValues = await Promise.all(
    sealedValues.map(async (sealed, i) => {
      const t = performance.now();
      const plain = await streamAccess.unsealStreamVideoId(SECRET, sealed);
      unsealLatencies[i] = performance.now() - t;
      return plain;
    }),
  );
  const unsealWallMs = performance.now() - ut0;
  const unsealHeapDelta = heapMB() - unsealHeapBefore;

  for (const v of plainValues) {
    assert.equal(v, TEST_VIDEO_ID);
  }

  // Sequential single-call latency (isolates per-call crypto cost from 1000x Promise.all queueing)
  const seqN = 200;
  const seqSealLatencies = new Array(seqN);
  const seqUnsealLatencies = new Array(seqN);
  for (let i = 0; i < seqN; i++) {
    const ts0 = performance.now();
    const s = await streamAccess.sealStreamVideoId(SECRET, TEST_VIDEO_ID);
    seqSealLatencies[i] = performance.now() - ts0;

    const tu0 = performance.now();
    const u = await streamAccess.unsealStreamVideoId(SECRET, s);
    seqUnsealLatencies[i] = performance.now() - tu0;
    assert.equal(u, TEST_VIDEO_ID);
  }

  return {
    concurrency: N,
    seal: {
      wallMs: round(sealWallMs, 2),
      opsPerSec: Math.round((N / sealWallMs) * 1000),
      p50Ms: round(percentile(sealLatencies, 50), 3),
      p95Ms: round(percentile(sealLatencies, 95), 3),
      p99Ms: round(percentile(sealLatencies, 99), 3),
      maxMs: round(Math.max(...sealLatencies), 3),
      heapDeltaMB: round(sealHeapDelta, 2),
    },
    unseal: {
      wallMs: round(unsealWallMs, 2),
      opsPerSec: Math.round((N / unsealWallMs) * 1000),
      p50Ms: round(percentile(unsealLatencies, 50), 3),
      p95Ms: round(percentile(unsealLatencies, 95), 3),
      p99Ms: round(percentile(unsealLatencies, 99), 3),
      maxMs: round(Math.max(...unsealLatencies), 3),
      heapDeltaMB: round(unsealHeapDelta, 2),
    },
    sequentialSingleCall: {
      samples: seqN,
      sealP50Ms: round(percentile(seqSealLatencies, 50), 3),
      sealP95Ms: round(percentile(seqSealLatencies, 95), 3),
      sealP99Ms: round(percentile(seqSealLatencies, 99), 3),
      unsealP50Ms: round(percentile(seqUnsealLatencies, 50), 3),
      unsealP95Ms: round(percentile(seqUnsealLatencies, 95), 3),
      unsealP99Ms: round(percentile(seqUnsealLatencies, 99), 3),
    },
  };
}

// ---------------------------------------------------------------------------
// PB-03: Firestore Payload Size & Read Amplification
// ---------------------------------------------------------------------------
async function runPB03() {
  const tiers = [100, 1000, 5000, 10000];
  const results = [];

  for (const n of tiers) {
    harness.resetAll();
    const eventId = `evt-pb03-${n}`;
    const emails = generateEmails(n, "pb03");
    const targetEmail = emails[n - 1]; // worst-case linear scan in Array.includes()

    const saveRes = await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: `GDG Keynote (${n} whitelist)`,
      youtubeUrl: TEST_VIDEO_URL,
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: false,
      manualWhitelistRaw: emails.join("\n"),
    });
    assert.equal(saveRes.success, true);

    const docBytes = harness.getRawDocBytes("event_streams", eventId);
    const pctOf1MiB = round((docBytes / FIRESTORE_MAX_DOC_BYTES) * 100, 2);

    // Measure getPublicEventStreamMetaAction (average over 20 runs for stable latency)
    harness.resetStats();
    const metaRuns = 20;
    const m0 = performance.now();
    for (let i = 0; i < metaRuns; i++) {
      const meta = await streamActions.getPublicEventStreamMetaAction(eventId);
      assert.equal(meta?.accessMode, "whitelisted");
      assert.equal(meta?.publicYoutubeVideoId, null);
    }
    const metaAvgMs = (performance.now() - m0) / metaRuns;
    const metaBytesPerCall = Math.round(harness.stats.bytesRead / metaRuns);

    // Measure requestStreamAccessCodeAction
    harness.resetStats();
    harness.emailsSent.length = 0;
    const r0 = performance.now();
    const reqRes = await streamActions.requestStreamAccessCodeAction(eventId, targetEmail, "Keynote");
    const reqMs = performance.now() - r0;
    assert.equal(reqRes.success, true);
    const reqBytesRead = harness.stats.bytesRead;
    const reqGets = harness.stats.gets;
    const reqPatches = harness.stats.patches;

    // Extract issued OTP from captured email subject `[ABCDEF] ...`
    assert.equal(harness.emailsSent.length, 1);
    const otpMatch = harness.emailsSent[0].subjectEmail.match(/^\[([A-Z0-9]{6})\]/);
    assert.ok(otpMatch, "Expected 6-char OTP in email subject");
    const otpCode = otpMatch[1];

    // Measure redeemStreamAccessCodeAction
    harness.resetStats();
    const d0 = performance.now();
    const redeemRes = await streamActions.redeemStreamAccessCodeAction(eventId, targetEmail, otpCode);
    const redeemMs = performance.now() - d0;
    assert.equal(redeemRes.success, true);
    assert.equal(redeemRes.youtubeVideoId, TEST_VIDEO_ID);
    const redeemBytesRead = harness.stats.bytesRead;
    const redeemGets = harness.stats.gets;
    const redeemPatches = harness.stats.patches;

    // 1 viewer full launch: 2x getPublicEventStreamMetaAction (double SSR fetch in watch/page.tsx:24,42)
    //                     + 1x requestStreamAccessCodeAction
    //                     + 1x redeemStreamAccessCodeAction
    const bytesPerViewerLaunch = 2 * metaBytesPerCall + reqBytesRead + redeemBytesRead;
    const projected1000ViewersBytes = bytesPerViewerLaunch * 1000;
    const projected1000ViewersReads = (2 * 1 + reqGets + redeemGets) * 1000;

    results.push({
      whitelistSize: n,
      eventStreamDocBytes: docBytes,
      eventStreamDocFormatted: formatBytes(docBytes),
      pctOfFirestore1MiBLimit: pctOf1MiB,
      metaAvgMs: round(metaAvgMs, 3),
      metaBytesPerCall,
      doubleSsrMetaBytes: metaBytesPerCall * 2,
      requestCodeMs: round(reqMs, 3),
      requestCodeBytesRead: reqBytesRead,
      requestCodeOps: { gets: reqGets, patches: reqPatches },
      redeemCodeMs: round(redeemMs, 3),
      redeemCodeBytesRead: redeemBytesRead,
      redeemCodeOps: { gets: redeemGets, patches: redeemPatches },
      bytesPerViewerLaunch,
      projected1000ViewersEgressBytes: projected1000ViewersBytes,
      projected1000ViewersEgressFormatted: formatBytes(projected1000ViewersBytes),
      projected1000ViewersFirestoreGets: projected1000ViewersReads,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// PB-04: Approved Registrant Auto-Sync Scaling & Silent 5,000-Doc Truncation (PERF-2)
// ---------------------------------------------------------------------------
async function runPB04() {
  const tiers = [500, 2000, 5500];
  const results = [];
  const statuses = [
    "approved",
    "paid_and_registered",
    "attended",
    "checked_in",
    "pending",
    "rejected",
    "canceled",
    "waitlisted",
  ];
  const approvedSet = new Set(["approved", "paid_and_registered", "attended", "checked_in"]);

  // Realistic registration doc payload (~4 KB per doc with form answers + banner metadata)
  const sampleBio = "Software engineer attending GDG Jakarta community conference. ".repeat(15);
  const samplePictureMeta = "https://assets.gdgjakarta.org/events/devfest-2026/banner-hero-v2.webp?w=1200&q=85";

  for (const totalDocs of tiers) {
    harness.resetAll();
    const eventId = `evt-pb04-${totalDocs}`;
    let totalApprovedSeeded = 0;
    let approvedPast5000 = 0;

    for (let i = 0; i < totalDocs; i++) {
      // Ensure docs past #5000 include approved registrants to empirically test PERF-2
      const status = i >= 5000 ? "approved" : statuses[i % statuses.length];
      if (approvedSet.has(status)) {
        totalApprovedSeeded += 1;
        if (i >= 5000) approvedPast5000 += 1;
      }

      harness.seedDoc("event_registrations", `reg_${String(i + 1).padStart(6, "0")}`, {
        event_id: eventId,
        status,
        member_email: `registrant.${String(i + 1).padStart(6, "0")}@gdg-member.id`,
        member_name: `Attendee Number ${i + 1}`,
        phone: `+62812${String(1000000 + i)}`,
        company: "Jakarta Tech Corp",
        role: "Senior Engineer",
        event_picture_url: samplePictureMeta,
        event_banner_url: samplePictureMeta,
        answers: {
          motivation: sampleBio,
          dietary: "Halal",
          tshirt_size: "L",
          experience_years: "5+",
          topics_of_interest: ["Cloud", "AI/ML", "Web", "Android", "Security"],
          referral_source: "GDG Jakarta Community Telegram",
          notes: sampleBio,
        },
        created_at: "2026-11-01T10:00:00.000Z",
      });
    }

    harness.resetStats();
    const heapBefore = heapMB();
    const t0 = performance.now();
    const res = await streamActions.saveEventStreamConfigAction({
      eventId,
      enabled: true,
      title: `Auto-Sync Event (${totalDocs} regs)`,
      youtubeUrl: TEST_VIDEO_URL,
      accessMode: "whitelisted",
      watermarkEnabled: true,
      includeApprovedRegistrants: true,
      manualWhitelistRaw: "",
    });
    const wallMs = performance.now() - t0;
    const heapDelta = heapMB() - heapBefore;

    assert.equal(res.success, true);

    const silentlyTruncated = totalApprovedSeeded - res.syncedRegistrants;

    results.push({
      totalRegistrationsSeeded: totalDocs,
      totalApprovedSeeded,
      approvedSeededPastLimit5000: approvedPast5000,
      syncedRegistrantsReturned: res.syncedRegistrants,
      silentlyTruncatedApprovedCount: silentlyTruncated,
      truncationReproduced: silentlyTruncated > 0,
      wallMs: round(wallMs, 2),
      heapDeltaMB: round(heapDelta, 2),
      firestoreDocsReturnedByQuery: harness.stats.queryDocsReturned,
      firestoreBytesRead: harness.stats.bytesRead,
      firestoreBytesReadFormatted: formatBytes(harness.stats.bytesRead),
      firestoreBytesWritten: harness.stats.bytesWritten,
      firestoreBytesWrittenFormatted: formatBytes(harness.stats.bytesWritten),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// PB-05: 30s Heartbeat Fan-Out Simulation
// ---------------------------------------------------------------------------
async function runPB05() {
  const tiers = [100, 500, 1000];
  const results = [];

  for (const n of tiers) {
    harness.resetAll();
    const eventId = `evt-pb05-${n}`;
    const now = Date.now();
    const sessionIds = new Array(n);

    for (let i = 0; i < n; i++) {
      const sid = streamAccess.generateStreamSessionId();
      sessionIds[i] = sid;
      harness.seedDoc("event_stream_sessions", sid, {
        id: sid,
        event_id: eventId,
        viewer_email_masked: `vi***@example.com`,
        status: "active",
        started_at: now - 60_000,
        last_heartbeat_at: now - 30_000,
        ended_at: null,
      });
    }

    harness.resetStats();
    const latencies = new Array(n);
    const heapBefore = heapMB();
    const t0 = performance.now();
    const responses = await Promise.all(
      sessionIds.map(async (sid, i) => {
        const st = performance.now();
        const r = await streamActions.heartbeatStreamSessionAction(eventId, sid);
        latencies[i] = performance.now() - st;
        return r;
      }),
    );
    const wallMs = performance.now() - t0;
    const heapDelta = heapMB() - heapBefore;

    for (const r of responses) {
      assert.equal(r.active, true);
    }

    const wavesPerHour = 3600 / 30; // 120 waves/hr at 30s interval
    const opsPerWave = harness.stats.gets + harness.stats.patches;
    const projectedFirestoreOpsPerHour = opsPerWave * wavesPerHour;
    const projectedWorkerInvocationsPerHour = n * wavesPerHour;
    const sustainedRps = round(n / 30, 2);

    results.push({
      activeSessions: n,
      waveWallMs: round(wallMs, 2),
      p50Ms: round(percentile(latencies, 50), 3),
      p95Ms: round(percentile(latencies, 95), 3),
      p99Ms: round(percentile(latencies, 99), 3),
      maxMs: round(Math.max(...latencies), 3),
      waveThroughputOpsPerSec: Math.round((n / wallMs) * 1000),
      heapDeltaMB: round(heapDelta, 2),
      firestoreGetsPerWave: harness.stats.gets,
      firestorePatchesPerWave: harness.stats.patches,
      firestoreTotalOpsPerWave: opsPerWave,
      sustainedHeartbeatRpsAt30s: sustainedRps,
      projectedWorkerInvocationsPerHour,
      projectedFirestoreOpsPerHour,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// PB-06: Organizer Session Listing Under Historical Growth (PERF-6)
// ---------------------------------------------------------------------------
async function runPB06() {
  harness.resetAll();
  const eventId = "evt-pb06-history";

  // Seed stream config
  await streamActions.saveEventStreamConfigAction({
    eventId,
    enabled: true,
    title: "Long-Running Conference Stream",
    youtubeUrl: TEST_VIDEO_URL,
    accessMode: "whitelisted",
    watermarkEnabled: true,
    includeApprovedRegistrants: false,
    manualWhitelistRaw: "viewer@gdgjakarta.com",
  });

  const now = Date.now();
  const expiredCount = 200;
  const activeCount = 50;

  // Insert 200 older expired sessions FIRST (lexicographically / insertion-order earlier)
  for (let i = 0; i < expiredCount; i++) {
    const sid = `strm_${String(i).padStart(32, "0")}`;
    harness.seedDoc("event_stream_sessions", sid, {
      id: sid,
      event_id: eventId,
      viewer_email_masked: `ol***@example.com`,
      status: "expired",
      started_at: now - (expiredCount - i + 60) * 60_000,
      last_heartbeat_at: now - (expiredCount - i + 50) * 60_000,
      ended_at: now - (expiredCount - i + 50) * 60_000,
    });
  }

  // Insert 50 recent active sessions AFTER
  for (let i = 0; i < activeCount; i++) {
    const sid = `strm_${String(1000 + i).padStart(32, "0")}`;
    harness.seedDoc("event_stream_sessions", sid, {
      id: sid,
      event_id: eventId,
      viewer_email_masked: `ac***@example.com`,
      status: "active",
      started_at: now - (activeCount - i) * 1000,
      last_heartbeat_at: now - 5_000,
      ended_at: null,
    });
  }

  harness.resetStats();
  const t0 = performance.now();
  const res = await streamActions.getEventStreamConfigAction(eventId);
  const wallMs = performance.now() - t0;

  assert.equal(res.success, true);
  const returnedSessions = res.data.sessions;
  const returnedActive = returnedSessions.filter((s) => s.status === "active").length;
  const returnedExpired = returnedSessions.filter((s) => s.status === "expired").length;
  const activeHidden = activeCount - returnedActive;

  return {
    totalSeeded: expiredCount + activeCount,
    expiredSeeded: expiredCount,
    activeSeeded: activeCount,
    queryLimit: 100,
    sessionsReturned: returnedSessions.length,
    activeReturned: returnedActive,
    expiredReturned: returnedExpired,
    activeSessionsHidden: activeHidden,
    activeLossPct: round((activeHidden / activeCount) * 100, 1),
    defectPerf6Reproduced: activeHidden > 0,
    wallMs: round(wallMs, 3),
    firestoreBytesRead: harness.stats.bytesRead,
  };
}

// ---------------------------------------------------------------------------
// 5. Execute All Benchmarks & Report
// ---------------------------------------------------------------------------
async function main() {
  console.log("=".repeat(88));
  console.log("GDG Jakarta Restricted Event YouTube Stream Access — Performance Benchmark Suite");
  console.log(`Runtime: Node ${process.version} | Platform: ${process.platform} ${process.arch}`);
  console.log("=".repeat(88));

  await warmup();

  const pb01 = await runPB01();
  console.log("\n[PB-01] Whitelist HMAC Hashing Scaling (hashStreamEmail + saveEventStreamConfigAction)");
  console.table(pb01.directResults);
  console.log("  End-to-End saveEventStreamConfigAction (whitelisted, manual):");
  console.table(pb01.saveActionResults);
  console.log(
    `  parseWhitelistEmails(10,500 tokens -> 10,000 unique): ${pb01.parseWhitelist10k.wallMs} ms (heap delta: ${pb01.parseWhitelist10k.heapDeltaMB} MB)`,
  );
  console.log(
    `  PERF-3 Reference Comparison (N=10,000): prod per-email importKey = ${pb01.cachedKeyComparison10k.productionPerEmailImportKeyMs} ms vs cached single importKey = ${pb01.cachedKeyComparison10k.cachedSingleImportKeyMs} ms (${pb01.cachedKeyComparison10k.speedupFactor}x faster)`,
  );

  const pb02 = await runPB02();
  console.log("\n[PB-02] AES-256-GCM Seal / Unseal Concurrency (N = 1,000)");
  console.table([
    { op: "sealStreamVideoId", ...pb02.seal },
    { op: "unsealStreamVideoId", ...pb02.unseal },
  ]);
  console.log(
    `  Sequential single-call (${pb02.sequentialSingleCall.samples} samples): seal p50=${pb02.sequentialSingleCall.sealP50Ms}ms / p95=${pb02.sequentialSingleCall.sealP95Ms}ms / p99=${pb02.sequentialSingleCall.sealP99Ms}ms | unseal p50=${pb02.sequentialSingleCall.unsealP50Ms}ms / p95=${pb02.sequentialSingleCall.unsealP95Ms}ms / p99=${pb02.sequentialSingleCall.unsealP99Ms}ms`,
  );

  const pb03 = await runPB03();
  console.log("\n[PB-03] Firestore Payload Size & Read Amplification (event_streams/{eventId})");
  console.table(
    pb03.map((r) => ({
      whitelistSize: r.whitelistSize,
      docSize: r.eventStreamDocFormatted,
      pctOf1MiB: `${r.pctOfFirestore1MiBLimit}%`,
      metaAvgMs: r.metaAvgMs,
      doubleSsrBytes: formatBytes(r.doubleSsrMetaBytes),
      reqCodeMs: r.requestCodeMs,
      redeemMs: r.redeemCodeMs,
      egress1000Viewers: r.projected1000ViewersEgressFormatted,
      gets1000Viewers: r.projected1000ViewersFirestoreGets,
    })),
  );

  const pb04 = await runPB04();
  console.log("\n[PB-04] Approved Registrant Auto-Sync Scaling & Silent 5,000-Doc Truncation (PERF-2)");
  console.table(
    pb04.map((r) => ({
      seededTotal: r.totalRegistrationsSeeded,
      seededApproved: r.totalApprovedSeeded,
      synced: r.syncedRegistrantsReturned,
      silentlyTruncated: r.silentlyTruncatedApprovedCount,
      wallMs: r.wallMs,
      heapDeltaMB: r.heapDeltaMB,
      bytesRead: r.firestoreBytesReadFormatted,
    })),
  );

  const pb05 = await runPB05();
  console.log("\n[PB-05] 30s Heartbeat Fan-Out Simulation (heartbeatStreamSessionAction)");
  console.table(
    pb05.map((r) => ({
      sessions: r.activeSessions,
      waveWallMs: r.waveWallMs,
      p50Ms: r.p50Ms,
      p95Ms: r.p95Ms,
      p99Ms: r.p99Ms,
      opsPerWave: r.firestoreTotalOpsPerWave,
      rpsAt30s: r.sustainedHeartbeatRpsAt30s,
      workerInvocHr: r.projectedWorkerInvocationsPerHour,
      firestoreOpsHr: r.projectedFirestoreOpsPerHour,
    })),
  );

  const pb06 = await runPB06();
  console.log("\n[PB-06] Organizer Session Listing Under Historical Growth (PERF-6)");
  console.table([pb06]);

  console.log("\n--- RAW_JSON_METRICS_BEGIN ---");
  console.log(JSON.stringify({ pb01, pb02, pb03, pb04, pb05, pb06 }, null, 2));
  console.log("--- RAW_JSON_METRICS_END ---");
}

await main();
