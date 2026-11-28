/**
 * Shortlink Provider, D1/KV Store, Analytics, Server Actions & External API Test Suite
 *
 * Offline verification covering:
 *   1. D1/KV CRUD & synchronous KV sync (create, update, slug/host rename deletes old KV key, archive/unarchive, bulk ops, domain deep-link config & cascade delete).
 *   2. PBKDF2 password hashing on create/update, preserving existing password on empty edit, clearPassword: true, and never leaking password_hash.
 *   3. Analytics & clickstream combining short_link_clicks + legacy_clicks (total vs human is_bot=0, periods, countries, cities, browsers, OS, devices, referrers, time-series, A/B split variants, real-time clickstream, domain summary).
 *   4. Dual-mode provider toggle (unset -> "shortio", "shortio" -> Short.io API, "cloudflare" -> D1/KV with zero Short.io calls).
 *   5. Event short link generation/update/public lookup (Firestore + Bevy sync) & speaker-confirmation-actions.ts in both modes.
 *   6. /api/links/shorten fail-closed 401, x-api-key & Bearer auth, POST (201, 400, 409), GET (200 with link & null, 400).
 *   7. RBAC enforcement across organizer and executive server actions.
 *
 * Run:
 *   node --test tests/shortlink/provider-api.test.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const MIGRATION_PATH = path.join(REPO_ROOT, "workers/shortlink/migrations/0001_shortlinks.sql");

// Shared mutable test state accessed by registered ESM stub modules.
const harness = {
  cfContextEnabled: true,
  cfEnv: /** @type {Record<string, unknown>} */ ({}),
  role: /** @type {"executive" | "organizer" | "member" | "unauthenticated"} */ ("executive"),
  revalidatedPaths: /** @type {string[]} */ ([]),
  firestoreEvents: /** @type {Map<string, Record<string, unknown>>} */ (new Map()),
  firestoreShortLinkUpdates: /** @type {Array<{ eventId: string; links: Record<string, unknown> }>} */ ([]),
  bevyUpdates: /** @type {Array<{ eventId: string; payload: Record<string, unknown> }>} */ ([]),
  shortioCalls: /** @type {Array<{ method: string; url: string; body?: string }>} */ ([]),
  shortioState: {
    links: /** @type {Array<Record<string, unknown>>} */ ([]),
    folders: /** @type {Array<Record<string, unknown>>} */ ([]),
    domains: /** @type {Array<Record<string, unknown>>} */ ([
      { id: 1516440, hostname: "gdgjakarta.org", state: "configured", linkType: "custom" },
    ]),
  },
};

globalThis.__shortlinkM3TestHarness = harness;

const STUB_SOURCES = new Map([
  [
    "stub:opennext-cloudflare",
    `export async function getCloudflareContext() {
      const h = globalThis.__shortlinkM3TestHarness;
      if (!h.cfContextEnabled) {
        throw new Error("Cloudflare context is not available");
      }
      return { env: h.cfEnv, ctx: { waitUntil() {} }, cf: {} };
    }`,
  ],
  [
    "stub:next-cache",
    `export function revalidatePath(p) {
      globalThis.__shortlinkM3TestHarness.revalidatedPaths.push(p);
    }
    export function revalidateTag() {}`,
  ],
  [
    "stub:next-headers",
    `export async function cookies() {
      return { get() { return undefined; }, set() {}, delete() {} };
    }
    export async function headers() {
      return new Headers();
    }`,
  ],
  [
    "stub:next-server",
    `export class NextRequest extends Request {
      constructor(input, init) {
        super(input, init);
        this.nextUrl = new URL(typeof input === "string" ? input : input.url);
      }
    }
    export class NextResponse extends Response {
      static json(body, init = {}) {
        const headers = new Headers(init.headers);
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
        return new NextResponse(JSON.stringify(body), { ...init, headers });
      }
    }`,
  ],
  [
    "stub:auth-guard",
    `export async function isAuthorizedOrganizerSession() {
      const role = globalThis.__shortlinkM3TestHarness.role;
      return role === "executive" || role === "organizer";
    }
    export async function isAuthorizedExecutiveOrganizerSession() {
      return globalThis.__shortlinkM3TestHarness.role === "executive";
    }
    export async function getVerifiedSessionRole() {
      return globalThis.__shortlinkM3TestHarness.role;
    }
    export async function getAuthenticatedSessionUser() {
      return { id: "org_1", name: "Test Organizer", email: "organizer@gdgjakarta.org" };
    }`,
  ],
  [
    "stub:firestore-admin",
    `export async function getFirestoreEventByIdServer(eventId) {
      return globalThis.__shortlinkM3TestHarness.firestoreEvents.get(String(eventId)) ?? null;
    }
    export async function updateFirestoreEventShortLinksServer(eventId, links) {
      const h = globalThis.__shortlinkM3TestHarness;
      h.firestoreShortLinkUpdates.push({ eventId: String(eventId), links });
      const existing = h.firestoreEvents.get(String(eventId)) ?? {};
      const next = { ...existing };
      if (links.liveShortURL) {
        next.live_short_url = links.liveShortURL;
        next.short_url = links.liveShortURL;
      }
      if (links.liveShortPath) next.live_short_path = links.liveShortPath;
      if (links.bevyShortURL) next.bevy_short_url = links.bevyShortURL;
      if (links.bevyShortPath) next.bevy_short_path = links.bevyShortPath;
      h.firestoreEvents.set(String(eventId), next);
    }
    export async function deleteFirestoreDoc() {}
    export async function getFirestoreDoc() { return null; }
    export async function patchFirestoreDoc() {}
    export async function queryFirestoreDocs() { return []; }`,
  ],
  [
    "stub:bevy-client",
    `export async function updateBevyEvent(eventId, payload) {
      globalThis.__shortlinkM3TestHarness.bevyUpdates.push({ eventId: String(eventId), payload });
      return { id: Number(eventId), ...payload };
    }
    export async function createBevyPerson() { return null; }
    export async function getBevyPerson() { return null; }
    export async function updateBevyPerson() { return null; }
    export async function uploadBevyImage() { return null; }`,
  ],
  ["stub:email-template-actions", `export async function sendEmailDirectInternal() { return { success: true }; }`],
]);

const ALIAS_STUBS = new Map([
  ["@opennextjs/cloudflare", "stub:opennext-cloudflare"],
  ["next/cache", "stub:next-cache"],
  ["next/headers", "stub:next-headers"],
  ["next/server", "stub:next-server"],
  ["@/server/auth-guard", "stub:auth-guard"],
  ["@/server/firestore-admin", "stub:firestore-admin"],
  ["@/lib/bevy/client", "stub:bevy-client"],
  ["@/server/email-template-actions", "stub:email-template-actions"],
]);

function resolveTsFile(candidateBase) {
  for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
    const full = candidateBase.endsWith(ext) ? candidateBase : `${candidateBase}${ext}`;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return pathToFileURL(full).href;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (ALIAS_STUBS.has(specifier)) {
      return { url: ALIAS_STUBS.get(specifier), shortCircuit: true };
    }

    if (context.parentURL?.includes("/src/server/") && specifier === "./auth-guard") {
      return { url: "stub:auth-guard", shortCircuit: true };
    }
    if (context.parentURL?.includes("/src/server/") && specifier === "./firestore-admin") {
      return { url: "stub:firestore-admin", shortCircuit: true };
    }
    if (context.parentURL?.includes("/src/server/") && specifier === "./email-template-actions") {
      return { url: "stub:email-template-actions", shortCircuit: true };
    }

    if (specifier.startsWith("@/")) {
      const target = path.join(REPO_ROOT, "src", specifier.slice(2));
      const resolved = resolveTsFile(target);
      if (resolved) {
        return { url: resolved, shortCircuit: true };
      }
    }

    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file://")) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const resolved = resolveTsFile(path.resolve(parentDir, specifier));
      if (resolved) {
        return { url: resolved, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (STUB_SOURCES.has(url)) {
      return {
        format: "module",
        source: STUB_SOURCES.get(url),
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

function createD1Shim() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec(fs.readFileSync(MIGRATION_PATH, "utf8"));

  function makePrepared(sql, boundArgs = []) {
    const assertMaxParams = (args) => {
      if (args.length > 100) {
        throw new Error(`D1_ERROR: too many SQL variables (${args.length} > 100)`);
      }
    };
    return {
      _sql: sql,
      _args: boundArgs,
      bind(...args) {
        assertMaxParams(args);
        for (const arg of args) {
          if (arg === undefined) {
            throw new TypeError("D1_TYPE_ERROR: Type 'undefined' not supported for value");
          }
        }
        return makePrepared(sql, args);
      },
      async first(colName) {
        assertMaxParams(boundArgs);
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...boundArgs);
        if (!row) return null;
        if (colName) return row[colName] ?? null;
        return { ...row };
      },
      async all() {
        assertMaxParams(boundArgs);
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...boundArgs).map((r) => ({ ...r }));
        return { results: rows, success: true, meta: {} };
      },
      async run() {
        assertMaxParams(boundArgs);
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...boundArgs);
        return {
          success: true,
          meta: {
            changes: info.changes ?? 0,
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
      async raw() {
        assertMaxParams(boundArgs);
        const stmt = sqlite.prepare(sql);
        return stmt.all(...boundArgs).map((r) => Object.values(r));
      },
    };
  }

  return {
    sqlite,
    prepare(sql) {
      return makePrepared(sql);
    },
    async batch(statements) {
      sqlite.exec("BEGIN;");
      try {
        const results = [];
        for (const stmt of statements) {
          const isSelect = /^\s*select/i.test(stmt._sql);
          if (isSelect) {
            results.push(await stmt.all());
          } else {
            const info = await stmt.run();
            results.push({ results: [], success: true, meta: info.meta });
          }
        }
        sqlite.exec("COMMIT;");
        return results;
      } catch (err) {
        sqlite.exec("ROLLBACK;");
        throw err;
      }
    },
    async exec(sql) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    close() {
      sqlite.close();
    },
  };
}

function createKvShim() {
  const store = new Map();
  return {
    store,
    async get(key, type) {
      const value = store.get(key);
      if (value === undefined) return null;
      if (type === "json") return JSON.parse(value);
      return value;
    },
    async put(key, value) {
      store.set(key, typeof value === "string" ? value : String(value));
    },
    async delete(key) {
      store.delete(key);
    },
    async list(options) {
      const prefix = options?.prefix ?? "";
      const keys = Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
  };
}

// Install fetch interceptor so Short.io mode works offline and any stray external fetch fails immediately.
globalThis.fetch = async (input, init) => {
  let urlStr = "";
  if (typeof input === "string") {
    urlStr = input;
  } else if (input instanceof URL) {
    urlStr = input.toString();
  } else {
    urlStr = input.url;
  }
  const method = (
    init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")
  ).toUpperCase();
  let body;
  if (typeof init?.body === "string") {
    body = init.body;
  } else if (typeof input === "object" && "text" in input && method !== "GET") {
    body = await input
      .clone()
      .text()
      .catch(() => undefined);
  }

  if (urlStr.startsWith("https://api.short.io/") || urlStr.startsWith("https://statistics.short.io/")) {
    harness.shortioCalls.push({ method, url: urlStr, body });
    const parsedUrl = new URL(urlStr);

    if (parsedUrl.hostname === "statistics.short.io") {
      return new Response(
        JSON.stringify({
          totalClicks: 42,
          humanClicks: 40,
          clicks: 42,
          clickStatistics: { datasets: [{ data: [{ x: "2026-11-26", y: "42" }] }] },
          country: [{ country: "ID", score: 42 }],
          browser: [{ browser: "Chrome", score: 42 }],
          os: [{ os: "macOS", score: 42 }],
          device: [{ device: "Desktop", score: 42 }],
          referer: [{ referer: "Direct", score: 42 }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (parsedUrl.pathname === "/api/links" && method === "GET") {
      return new Response(
        JSON.stringify({ count: harness.shortioState.links.length, links: harness.shortioState.links }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (parsedUrl.pathname === "/links" && method === "POST") {
      const payload = body ? JSON.parse(body) : {};
      const slug = payload.path || `s_${harness.shortioState.links.length + 1}`;
      const created = {
        id: `lnk_shortio_${harness.shortioState.links.length + 1}`,
        idString: `lnk_shortio_${harness.shortioState.links.length + 1}`,
        shortURL: `https://${payload.domain || "gdgjakarta.org"}/${slug}`,
        secureShortURL: `https://${payload.domain || "gdgjakarta.org"}/${slug}`,
        originalURL: payload.originalURL,
        path: slug,
        title: payload.title,
        tags: payload.tags ?? [],
        createdAt: new Date().toISOString(),
      };
      harness.shortioState.links.push(created);
      return new Response(JSON.stringify(created), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (parsedUrl.pathname === "/links/expand" && method === "GET") {
      const pathParam = parsedUrl.searchParams.get("path");
      const found = harness.shortioState.links.find((l) => l.path === pathParam);
      if (!found) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      return new Response(JSON.stringify(found), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (parsedUrl.pathname === "/links/by-original-url" && method === "GET") {
      const orig = parsedUrl.searchParams.get("originalURL");
      const found = harness.shortioState.links.find((l) => l.originalURL === orig);
      if (!found) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      return new Response(JSON.stringify(found), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (parsedUrl.pathname === "/api/domains" && method === "GET") {
      return new Response(JSON.stringify(harness.shortioState.domains), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }

  throw new Error(`Unexpected external fetch in offline test: ${method} ${urlStr}`);
};

// Pre-seed process.env for SHORTIO_CONFIG compatibility before importing Short.io modules
process.env.SHORTIO_API_KEY = "test-shortio-key";
process.env.SHORTIO_DOMAIN = "gdgjakarta.org";
process.env.SHORTIO_DOMAIN_ID = "1516440";

const { verifyLinkPassword } = await import("@/lib/shortlinks/crypto");
const { queryDomainStatsD1 } = await import("@/lib/shortlinks/analytics");
const { findLinkByOriginalUrlD1, ShortlinkNotFoundError } = await import("@/lib/shortlinks/d1-store");
const { buildDomainKvKey, buildLinkKvKey } = await import("@/lib/shortlinks/types");
const { getShortlinkProvider } = await import("@/lib/shortlinks/env");
const {
  bulkDeleteShortLinksAction,
  bulkMoveLinksToFolderAction,
  createShortFolderAction,
  createShortLinkAction,
  deleteShortFolderAction,
  deleteShortLinkAction,
  fetchShortFoldersAction,
  fetchShortLinksAction,
  generateEventShortLinkAction,
  getEventShortLinksAction,
  getPublicEventShortLinksAction,
  getShortlinkDashboardConfigAction,
  moveLinkToFolderAction,
  updateEventShortLinkAction,
  updateShortFolderAction,
  updateShortLinkAction,
} = await import("@/server/shortio-actions");
const {
  archiveShortLinksAction,
  bulkImportShortLinksAction,
  createShortDomainAction,
  deleteShortDomainAction,
  getDomainClickstreamAction,
  getDomainStatsAction,
  getLinkClickstreamAction,
  getLinkStatsAction,
  getSplitTestStatsAction,
  listShortDomainsAction,
  unarchiveShortLinksAction,
  updateShortDomainConfigAction,
} = await import("@/server/shortio-advanced-actions");
const { getExistingEventSlideTemplateOptionsAction } = await import("@/server/speaker-confirmation-actions");
const { GET: shortenGet, POST: shortenPost } = await import("@/app/api/links/shorten/route");
const { NextRequest } = await import("next/server");

let activeD1 = null;
let activeKv = null;

function resetHarness(provider = "cloudflare") {
  activeD1?.close();
  activeD1 = createD1Shim();
  activeKv = createKvShim();

  harness.cfContextEnabled = true;
  harness.cfEnv = {
    SHORTLINKS_DB: activeD1,
    SHORTLINKS_KV: activeKv,
    SHORTLINK_PROVIDER: provider,
    SHORTIO_DOMAIN: "gdgjakarta.org",
    SHORTIO_DOMAIN_ID: "1516440",
    SHORTIO_API_KEY: "test-shortio-key",
    SHORTLINK_API_KEY: "test-shortlink-api-key",
    N8N_WEBHOOK_API_KEY: "test-n8n-api-key",
  };
  harness.role = "executive";
  harness.revalidatedPaths = [];
  harness.firestoreEvents.clear();
  harness.firestoreShortLinkUpdates = [];
  harness.bevyUpdates = [];
  harness.shortioCalls = [];
  harness.shortioState.links = [];
  harness.shortioState.folders = [];
  harness.shortioState.domains = [{ id: 1516440, hostname: "gdgjakarta.org", state: "configured", linkType: "custom" }];

  delete process.env.SHORTLINK_PROVIDER;
  delete process.env.SHORTLINK_API_KEY;
  delete process.env.N8N_WEBHOOK_API_KEY;
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
}

describe("M3 Shortlinks Provider, D1/KV Store & API", () => {
  beforeEach(() => {
    resetHarness("cloudflare");
  });

  afterEach(() => {
    activeD1?.close();
    activeD1 = null;
    activeKv = null;
  });

  test("1. D1/KV CRUD, lnk_ IDs, synchronous KV sync, slug rename cleanup, archive/unarchive & bulk ops", async () => {
    const configRes = await getShortlinkDashboardConfigAction();
    assert.equal(configRes.success, true);
    assert.deepEqual(configRes.data, { provider: "cloudflare", domain: "gdgjakarta.org", domainId: 1516440 });

    // Create folder
    const folderRes = await createShortFolderAction({ name: "DevFest 2026", color: "#4285F4" });
    assert.equal(folderRes.success, true);
    assert.ok(folderRes.data?.id.startsWith("fld_"));

    // Primary domain should now exist in KV
    const domainKvRaw = await activeKv.get(buildDomainKvKey("gdgjakarta.org"));
    assert.ok(domainKvRaw, "Primary domain should be synced to KV");

    // Create link with Pro features + explicit slug
    const createRes = await createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/devfest-2026",
      path: "/devfest26",
      title: "DevFest 2026 Main",
      folderId: folderRes.data.id,
      tags: ["DevFest", "Event"],
      redirectType: 301,
      cloaking: true,
      expiresAt: "2027-01-01T00:00:00.000Z",
      expiredURL: "https://gdgjakarta.com/expired",
      androidURL: "https://play.google.com/store/apps/details?id=org.gdgjakarta",
      iphoneURL: "https://apps.apple.com/app/id123456",
      maxClicks: 500,
      linkType: "split",
      geoTargets: [{ country: "sg", url: "https://gdgjakarta.com/sg" }],
      utmParams: { source: "instagram", medium: "social", campaign: "df26" },
      pixels: { metaPixelId: "123456789", ga4Id: "G-TEST123" },
      splitTargets: [
        { url: "https://gdgjakarta.com/a", weight: 70, label: "Control" },
        { url: "https://gdgjakarta.com/b", weight: 30, label: "Variant B" },
      ],
    });

    assert.equal(createRes.success, true);
    const created = createRes.data;
    assert.ok(created);
    assert.match(created.id, /^lnk_/);
    assert.equal(created.id, created.idString);
    assert.equal(created.path, "devfest26");
    assert.equal(created.shortURL, "https://gdgjakarta.org/devfest26");
    assert.equal(created.redirectType, "301");
    assert.equal(created.maxClicks, 500);
    assert.equal(created.linkType, "split");
    assert.deepEqual(created.geoTargets, [{ country: "SG", url: "https://gdgjakarta.com/sg" }]);

    // Verify KV sync
    const kvCreated = await activeKv.get(buildLinkKvKey("gdgjakarta.org", "devfest26"), "json");
    assert.equal(kvCreated.id, created.id);
    assert.equal(kvCreated.redirectType, 301);
    assert.equal(kvCreated.cloaking, true);
    assert.equal(kvCreated.maxClicks, 500);
    assert.equal(kvCreated.archived, false);
    assert.equal(kvCreated.splitTargets.length, 2);

    // Auto-generated slug when path omitted
    const autoSlugRes = await createShortLinkAction({ originalURL: "https://gdgjakarta.com/auto" });
    assert.equal(autoSlugRes.success, true);
    assert.ok(autoSlugRes.data?.path && autoSlugRes.data.path.length >= 6);
    assert.ok(await activeKv.get(buildLinkKvKey("gdgjakarta.org", autoSlugRes.data.path)));

    // Slug rename deletes old KV key and writes new KV key
    const renameRes = await updateShortLinkAction(created.id, {
      path: "df26-renamed",
      redirectType: 308,
    });
    assert.equal(renameRes.success, true);
    assert.equal(renameRes.data?.shortURL, "https://gdgjakarta.org/df26-renamed");
    assert.equal(await activeKv.get(buildLinkKvKey("gdgjakarta.org", "devfest26")), null);
    const kvRenamed = await activeKv.get(buildLinkKvKey("gdgjakarta.org", "df26-renamed"), "json");
    assert.equal(kvRenamed.redirectType, 308);

    // Archive & unarchive sync KV archived flag and filter default listing
    const archRes = await archiveShortLinksAction([created.id]);
    assert.equal(archRes.success, true);
    assert.equal((await activeKv.get(buildLinkKvKey("gdgjakarta.org", "df26-renamed"), "json")).archived, true);

    const activeList = await fetchShortLinksAction();
    assert.equal(
      activeList.data?.some((l) => l.id === created.id),
      false,
    );
    const archivedList = await fetchShortLinksAction({ archived: true });
    assert.equal(
      archivedList.data?.some((l) => l.id === created.id),
      true,
    );

    const unarchRes = await unarchiveShortLinksAction([created.id]);
    assert.equal(unarchRes.success, true);
    assert.equal((await activeKv.get(buildLinkKvKey("gdgjakarta.org", "df26-renamed"), "json")).archived, false);

    // Pagination + search
    const page1 = await fetchShortLinksAction({ limit: 1 });
    assert.equal(page1.count, 2);
    assert.equal(page1.data?.length, 1);
    assert.equal(page1.nextPageToken, "1");
    const page2 = await fetchShortLinksAction({ limit: 1, pageToken: page1.nextPageToken });
    assert.equal(page2.data?.length, 1);
    assert.equal(page2.nextPageToken, undefined);

    const searchRes = await fetchShortLinksAction({ search: "df26-renamed" });
    assert.equal(searchRes.data?.length, 1);

    // Folder update & delete re-syncs affected link KV records
    const updFolderRes = await updateShortFolderAction(folderRes.data.id, { name: "DevFest ID", color: "#EA4335" });
    assert.equal(updFolderRes.success, true);
    assert.equal(updFolderRes.data?.name, "DevFest ID");

    const moveRes = await moveLinkToFolderAction(autoSlugRes.data.id, folderRes.data.id);
    assert.equal(moveRes.success, true);
    assert.equal(
      (await activeKv.get(buildLinkKvKey("gdgjakarta.org", autoSlugRes.data.path), "json")).folderId,
      folderRes.data.id,
    );

    const delFolderRes = await deleteShortFolderAction(folderRes.data.id);
    assert.equal(delFolderRes.success, true);
    assert.equal((await activeKv.get(buildLinkKvKey("gdgjakarta.org", "df26-renamed"), "json")).folderId, null);

    // Bulk move & bulk delete
    const secondFolder = (await createShortFolderAction({ name: "BWAI" })).data;
    const bulkMoveRes = await bulkMoveLinksToFolderAction([created.id, autoSlugRes.data.id], secondFolder.id);
    assert.equal(bulkMoveRes.success, true);
    assert.equal(bulkMoveRes.updatedCount, 2);

    const bulkDelRes = await bulkDeleteShortLinksAction([autoSlugRes.data.id]);
    assert.equal(bulkDelRes.success, true);
    assert.equal(bulkDelRes.deletedCount, 1);
    assert.equal(await activeKv.get(buildLinkKvKey("gdgjakarta.org", autoSlugRes.data.path)), null);

    // Single delete removes D1 + KV
    const delRes = await deleteShortLinkAction(created.id);
    assert.equal(delRes.success, true);
    assert.equal(await activeKv.get(buildLinkKvKey("gdgjakarta.org", "df26-renamed")), null);

    // Domain create, mobile deep link config, primary protection & cascade KV delete
    const domCreateRes = await createShortDomainAction("go.gdgjakarta.org");
    assert.equal(domCreateRes.success, true);
    const secondaryId = domCreateRes.data.id;
    assert.ok(await activeKv.get(buildDomainKvKey("go.gdgjakarta.org")));

    const aasa = JSON.stringify({ applinks: { apps: [], details: [{ appID: "TEAM.org.gdgjakarta", paths: ["/*"] }] } });
    const assetLinks = JSON.stringify([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "org.gdgjakarta" },
      },
    ]);
    const domCfgRes = await updateShortDomainConfigAction(secondaryId, {
      appleAppSiteAssociation: aasa,
      assetLinks,
    });
    assert.equal(domCfgRes.success, true);
    const kvDom = await activeKv.get(buildDomainKvKey("go.gdgjakarta.org"), "json");
    assert.equal(kvDom.appleAppSiteAssociation, aasa);
    assert.equal(kvDom.assetLinks, assetLinks);

    // Create a link on secondary domain then delete domain -> cascades D1 & removes all KV keys
    await createShortLinkAction({
      originalURL: "https://gdgjakarta.com/sec",
      path: "sec-slug",
      hostname: "go.gdgjakarta.org",
    });
    assert.ok(await activeKv.get(buildLinkKvKey("go.gdgjakarta.org", "sec-slug")));

    const primaryDelAttempt = await deleteShortDomainAction(1516440);
    assert.equal(primaryDelAttempt.success, false);

    const domDelRes = await deleteShortDomainAction(secondaryId);
    assert.equal(domDelRes.success, true);
    assert.equal(await activeKv.get(buildDomainKvKey("go.gdgjakarta.org")), null);
    assert.equal(await activeKv.get(buildLinkKvKey("go.gdgjakarta.org", "sec-slug")), null);

    // Zero Short.io calls in cloudflare mode
    assert.equal(harness.shortioCalls.length, 0);
  });

  test("2. PBKDF2 password hashing, preservation on empty edit, clearPassword, and zero password_hash leakage", async () => {
    const createRes = await createShortLinkAction({
      originalURL: "https://gdgjakarta.com/secret-deck",
      path: "secret-deck",
      password: "gdg-secret-pass",
    });
    assert.equal(createRes.success, true);
    const item = createRes.data;
    assert.equal(item.hasPassword, true);
    assert.equal("password_hash" in item, false);
    assert.equal("passwordHash" in item, false);

    // Verify D1 stored PBKDF2 hash & KV has passwordHash for edge verification
    const dbRow = activeD1.sqlite
      .prepare("SELECT password_hash, has_password FROM short_links WHERE id = ?")
      .get(item.id);
    assert.equal(dbRow.has_password, 1);
    assert.match(dbRow.password_hash, /^pbkdf2\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    assert.equal(await verifyLinkPassword("gdg-secret-pass", dbRow.password_hash), true);
    assert.equal(await verifyLinkPassword("wrong-pass", dbRow.password_hash), false);

    const kvRec = await activeKv.get(buildLinkKvKey("gdgjakarta.org", "secret-deck"), "json");
    assert.equal(kvRec.passwordHash, dbRow.password_hash);

    // Edit with undefined/empty password MUST preserve existing password_hash
    const editKeepRes = await updateShortLinkAction(item.id, { title: "Updated Title", password: "" });
    assert.equal(editKeepRes.success, true);
    assert.equal(editKeepRes.data?.hasPassword, true);
    assert.equal("password_hash" in editKeepRes.data, false);
    const dbRowAfterKeep = activeD1.sqlite.prepare("SELECT password_hash FROM short_links WHERE id = ?").get(item.id);
    assert.equal(dbRowAfterKeep.password_hash, dbRow.password_hash);

    // Edit with new password re-hashes
    const editNewPassRes = await updateShortLinkAction(item.id, { password: "new-password-2026" });
    assert.equal(editNewPassRes.success, true);
    const dbRowNew = activeD1.sqlite.prepare("SELECT password_hash FROM short_links WHERE id = ?").get(item.id);
    assert.notEqual(dbRowNew.password_hash, dbRow.password_hash);
    assert.equal(await verifyLinkPassword("new-password-2026", dbRowNew.password_hash), true);

    // Edit with clearPassword: true clears hash & KV passwordHash
    const clearRes = await updateShortLinkAction(item.id, { clearPassword: true });
    assert.equal(clearRes.success, true);
    assert.equal(clearRes.data?.hasPassword, false);
    const dbCleared = activeD1.sqlite
      .prepare("SELECT password_hash, has_password FROM short_links WHERE id = ?")
      .get(item.id);
    assert.equal(dbCleared.password_hash, null);
    assert.equal(dbCleared.has_password, 0);
    assert.equal((await activeKv.get(buildLinkKvKey("gdgjakarta.org", "secret-deck"), "json")).passwordHash, null);
  });

  test("3. Analytics & clickstream combine short_link_clicks + legacy_clicks across periods & breakdowns", async () => {
    const link = (
      await createShortLinkAction({
        originalURL: "https://gdgjakarta.com/split",
        path: "split-test",
        linkType: "split",
        splitTargets: [
          { url: "https://gdgjakarta.com/a", weight: 50, label: "Variant A" },
          { url: "https://gdgjakarta.com/b", weight: 50, label: "Variant B" },
        ],
      })
    ).data;

    // Seed legacy_clicks = 120
    activeD1.sqlite.prepare("UPDATE short_links SET legacy_clicks = 120, clicks_count = 4 WHERE id = ?").run(link.id);

    // Verify mapped ShortLinkItem sums clicks = clicks_count + legacy_clicks
    const fetched = (await fetchShortLinksAction()).data?.find((l) => l.id === link.id);
    assert.equal(fetched?.clicks, 124);
    assert.equal(fetched?.clicksCount, 4);
    assert.equal(fetched?.legacyClicks, 120);

    const now = Date.now();
    const insertClick = activeD1.sqlite.prepare(
      `INSERT INTO short_link_clicks
       (id, link_id, hostname, path, clicked_at, country, city, browser, os, device, referer, is_bot, variant_label, target_url)
       VALUES (?, ?, 'gdgjakarta.org', 'split-test', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insertClick.run(
      "clk_1",
      link.id,
      now - 10_000,
      "ID",
      "Jakarta",
      "Chrome",
      "Android",
      "Mobile",
      "https://instagram.com",
      0,
      "Variant A",
      "https://gdgjakarta.com/a",
    );
    insertClick.run(
      "clk_2",
      link.id,
      now - 2 * 86_400_000,
      "ID",
      "Bandung",
      "Safari",
      "iOS",
      "Mobile",
      "Direct",
      0,
      "Variant B",
      "https://gdgjakarta.com/b",
    );
    insertClick.run(
      "clk_3",
      link.id,
      now - 10 * 86_400_000,
      "SG",
      "Singapore",
      "Chrome",
      "macOS",
      "Desktop",
      "https://google.com",
      0,
      "Variant A",
      "https://gdgjakarta.com/a",
    );
    insertClick.run(
      "clk_4",
      link.id,
      now - 45 * 86_400_000,
      "US",
      "Mountain View",
      "BotUA",
      "Linux",
      "Bot",
      "Direct",
      1,
      "Variant B",
      "https://gdgjakarta.com/b",
    );

    // Total period includes legacy_clicks (4 + 120 = 124 total, 3 + 120 = 123 human)
    const totalStats = await getLinkStatsAction(link.id, "total");
    assert.equal(totalStats.success, true);
    assert.equal(totalStats.data?.totalClicks, 124);
    assert.equal(totalStats.data?.humanClicks, 123);
    assert.equal(totalStats.data?.legacyClicks, 120);
    assert.equal(totalStats.data?.country?.[0]?.country, "ID");
    assert.equal(totalStats.data?.country?.[0]?.score, 2);
    assert.ok(totalStats.data?.cities?.some((c) => c.city === "Jakarta" && c.country === "ID" && c.score === 1));
    assert.ok(totalStats.data?.browser?.some((b) => b.browser === "Chrome" && b.score === 2));
    assert.ok(totalStats.data?.os?.some((o) => o.os === "Android" && o.score === 1));
    assert.ok(totalStats.data?.device?.some((d) => d.device === "Mobile" && d.score === 2));
    assert.ok(totalStats.data?.referer?.some((r) => r.referer === "https://instagram.com" && r.score === 1));
    assert.ok((totalStats.data?.clickStatistics?.datasets?.[0]?.data?.length ?? 0) >= 3);
    assert.equal(totalStats.data?.clickstream?.[0]?.id, "clk_1");
    assert.equal(totalStats.data?.splitVariants?.length, 2);

    // Bounded last7 period excludes 10d and 45d clicks and does not add legacy_clicks to period total
    const last7Stats = await getLinkStatsAction(link.id, "last7");
    assert.equal(last7Stats.success, true);
    assert.equal(last7Stats.data?.totalClicks, 2);
    assert.equal(last7Stats.data?.humanClicks, 2);
    assert.equal(last7Stats.data?.legacyClicks, 120);

    // Split test stats
    const splitRes = await getSplitTestStatsAction(link.id, "total");
    assert.equal(splitRes.success, true);
    assert.equal(splitRes.data?.find((v) => v.variantLabel === "Variant A")?.clicks, 2);
    assert.equal(splitRes.data?.find((v) => v.variantLabel === "Variant A")?.percentage, 50);

    // Real-time clickstream actions
    const linkStream = await getLinkClickstreamAction(link.id, { limit: 2 });
    assert.equal(linkStream.success, true);
    assert.deepEqual(
      linkStream.data?.map((e) => e.id),
      ["clk_1", "clk_2"],
    );

    const domainStream = await getDomainClickstreamAction({ limit: 10 });
    assert.equal(domainStream.success, true);
    assert.equal(domainStream.data?.length, 4);

    // Domain summary combines across links
    const domainStats = await getDomainStatsAction("total");
    assert.equal(domainStats.success, true);
    assert.equal(domainStats.data?.totalClicks, 124);
    assert.equal(domainStats.data?.humanClicks, 123);
  });

  test("4. Dual-mode provider toggle defaults to shortio when unset and switches dynamically", async () => {
    delete harness.cfEnv.SHORTLINK_PROVIDER;
    delete process.env.SHORTLINK_PROVIDER;
    assert.equal(await getShortlinkProvider(), "shortio");

    // In shortio mode, creating a link hits mocked Short.io API and leaves D1 untouched
    const shortioRes = await createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/shortio-test",
      path: "shortio-only",
      title: "Short.io Link",
    });
    assert.equal(shortioRes.success, true);
    assert.equal(shortioRes.data?.id, "lnk_shortio_1");
    assert.equal(harness.shortioCalls.length, 1);
    assert.equal(activeD1.sqlite.prepare("SELECT COUNT(*) AS c FROM short_links").get().c, 0);

    // Switch dynamically to cloudflare mode
    harness.cfEnv.SHORTLINK_PROVIDER = "cloudflare";
    assert.equal(await getShortlinkProvider(), "cloudflare");
    harness.shortioCalls = [];

    const cfRes = await createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/cf-test",
      path: "cf-only",
    });
    assert.equal(cfRes.success, true);
    assert.match(cfRes.data.id, /^lnk_/);
    assert.equal(harness.shortioCalls.length, 0);
    assert.equal(activeD1.sqlite.prepare("SELECT COUNT(*) AS c FROM short_links").get().c, 1);
  });

  test("5. Event short-link actions (Firestore + Bevy sync) and speaker-confirmation-actions in both modes", async () => {
    const folder = (await createShortFolderAction({ name: "DevFest" })).data;

    // Generate live event short link
    const genRes = await generateEventShortLinkAction({
      eventId: "9988",
      type: "live",
      originalURL: "http://localhost:3000/events/9988",
      title: "DevFest Jakarta 2026",
      customSlug: "dfjkt26",
      tags: ["Community"],
    });
    assert.equal(genRes.success, true);
    assert.equal(genRes.data?.originalURL, "https://gdgjakarta.com/events/9988");
    assert.equal(genRes.data?.FolderId, folder.id);
    assert.equal(genRes.data?.shortURL, "https://gdgjakarta.org/dfjkt26");

    // Verify Firestore cache + Bevy custom_tickets_url sync
    assert.equal(harness.firestoreShortLinkUpdates.length, 1);
    assert.equal(harness.firestoreEvents.get("9988")?.live_short_url, "https://gdgjakarta.org/dfjkt26");
    assert.equal(harness.bevyUpdates.length, 1);
    assert.equal(harness.bevyUpdates[0].payload.custom_tickets_url, "https://gdgjakarta.org/dfjkt26");

    // Update event short link resolving linkId automatically from currentPath
    const updEventRes = await updateEventShortLinkAction({
      eventId: "9988",
      type: "live",
      currentPath: "dfjkt26",
      newSlug: "devfest-jkt-26",
    });
    assert.equal(updEventRes.success, true);
    assert.equal(updEventRes.data?.shortURL, "https://gdgjakarta.org/devfest-jkt-26");
    assert.equal(await activeKv.get(buildLinkKvKey("gdgjakarta.org", "dfjkt26")), null);
    assert.ok(await activeKv.get(buildLinkKvKey("gdgjakarta.org", "devfest-jkt-26")));
    assert.equal(harness.bevyUpdates[1].payload.custom_tickets_url, "https://gdgjakarta.org/devfest-jkt-26");

    // Public lookup works when unauthenticated (reads Firestore cache, or discovers from D1)
    harness.role = "unauthenticated";
    harness.firestoreEvents.delete("9988");
    const pubRes = await getPublicEventShortLinksAction({ eventId: "9988" });
    assert.equal(pubRes.success, true);
    assert.equal(pubRes.data?.liveShortLink?.shortURL, "https://gdgjakarta.org/devfest-jkt-26");
    assert.equal(harness.firestoreEvents.get("9988")?.live_short_url, "https://gdgjakarta.org/devfest-jkt-26");

    // Organizer lookup
    harness.role = "organizer";
    const orgEvtRes = await getEventShortLinksAction({ liveUrl: "https://gdgjakarta.com/events/9988" });
    assert.equal(orgEvtRes.success, true);
    assert.equal(orgEvtRes.data?.liveShortLink?.path, "devfest-jkt-26");

    // Speaker confirmation slide presets in cloudflare mode
    await createShortLinkAction({
      originalURL: "https://docs.google.com/presentation/d/gdg-tpl",
      path: "gdg-slide-template",
      title: "GDG Jakarta Official Deck 2026",
    });
    await createShortLinkAction({
      originalURL: "https://docs.google.com/presentation/d/df26-tpl",
      path: "devfest26-slide-template",
      title: "DevFest 2026 Speaker Deck",
    });

    const slideOptsCf = await getExistingEventSlideTemplateOptionsAction("9988");
    assert.equal(slideOptsCf.success, true);
    assert.equal(slideOptsCf.presets.gdg_default.label, "GDG Jakarta Official Deck 2026");
    assert.equal(slideOptsCf.presets.gdg_default.url, "https://gdgjakarta.org/gdg-slide-template");
    assert.equal(slideOptsCf.presets.devfest26.label, "DevFest 2026 Speaker Deck");

    // Speaker confirmation slide presets in shortio mode
    harness.cfEnv.SHORTLINK_PROVIDER = "shortio";
    harness.shortioState.links = [
      {
        path: "gdg-slide-template",
        title: "Short.io GDG Deck",
        secureShortURL: "https://gdgjakarta.org/gdg-slide-template",
      },
    ];
    const slideOptsShortio = await getExistingEventSlideTemplateOptionsAction("9988");
    assert.equal(slideOptsShortio.success, true);
    assert.equal(slideOptsShortio.presets.gdg_default.label, "Short.io GDG Deck");
  });

  test("6. /api/links/shorten enforces fail-closed auth, validation, POST (201/400/409) & GET (200/400)", async () => {
    // Fail-closed when no API keys configured
    delete harness.cfEnv.SHORTLINK_API_KEY;
    delete harness.cfEnv.N8N_WEBHOOK_API_KEY;
    const unconfiguredReq = new NextRequest("https://gdgjakarta.com/api/links/shorten?path=test", {
      headers: { "x-api-key": "anything" },
    });
    assert.equal((await shortenGet(unconfiguredReq)).status, 401);

    // Restore configured secrets
    harness.cfEnv.SHORTLINK_API_KEY = "test-shortlink-api-key";
    harness.cfEnv.N8N_WEBHOOK_API_KEY = "test-n8n-api-key";

    // Reject wrong key
    const badKeyReq = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: { "x-api-key": "wrong-key", "content-type": "application/json" },
      body: JSON.stringify({ originalURL: "https://gdgjakarta.com" }),
    });
    assert.equal((await shortenPost(badKeyReq)).status, 401);

    // 400 on invalid URL
    const badUrlReq = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: { "x-api-key": "test-shortlink-api-key", "content-type": "application/json" },
      body: JSON.stringify({ originalURL: "javascript:alert(1)" }),
    });
    assert.equal((await shortenPost(badUrlReq)).status, 400);

    // 201 on valid POST with x-api-key (including password -> never leaked)
    const createReq = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: { "x-api-key": "test-shortlink-api-key", "content-type": "application/json" },
      body: JSON.stringify({
        originalURL: "https://gdgjakarta.com/api-target",
        slug: "n8n-link",
        title: "Created via API",
        password: "api-password",
      }),
    });
    const createRes = await shortenPost(createReq);
    assert.equal(createRes.status, 201);
    const createJson = await createRes.json();
    assert.equal(createJson.success, true);
    assert.equal(createJson.shortURL, "https://gdgjakarta.org/n8n-link");
    assert.equal(createJson.link.hasPassword, true);
    assert.equal("password_hash" in createJson.link, false);
    assert.equal("passwordHash" in createJson.link, false);
    assert.ok(await activeKv.get(buildLinkKvKey("gdgjakarta.org", "n8n-link")));

    // 409 on duplicate slug
    const dupReq = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: { authorization: "Bearer test-n8n-api-key", "content-type": "application/json" },
      body: JSON.stringify({
        originalURL: "https://gdgjakarta.com/other",
        path: "n8n-link",
      }),
    });
    assert.equal((await shortenPost(dupReq)).status, 409);

    // GET 400 when neither path nor originalURL supplied
    const missingParamsGet = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      headers: { authorization: "Bearer test-n8n-api-key" },
    });
    assert.equal((await shortenGet(missingParamsGet)).status, 400);

    // GET 200 by ?path=
    const getByPathReq = new NextRequest(
      "https://gdgjakarta.com/api/links/shorten?path=n8n-link&domain=gdgjakarta.org",
      {
        headers: { authorization: "Bearer test-n8n-api-key" },
      },
    );
    const getByPathRes = await shortenGet(getByPathReq);
    assert.equal(getByPathRes.status, 200);
    const getByPathJson = await getByPathRes.json();
    assert.equal(getByPathJson.link.id, createJson.link.id);
    assert.equal("password_hash" in getByPathJson.link, false);

    // GET 200 by ?originalURL=
    const getByOrigReq = new NextRequest(
      "https://gdgjakarta.com/api/links/shorten?originalURL=https%3A%2F%2Fgdgjakarta.com%2Fapi-target",
      { headers: { "x-api-key": "test-shortlink-api-key" } },
    );
    const getByOrigRes = await shortenGet(getByOrigReq);
    assert.equal(getByOrigRes.status, 200);
    assert.equal((await getByOrigRes.json()).link.path, "n8n-link");

    // GET 200 with link: null when missing
    const getMissingReq = new NextRequest("https://gdgjakarta.com/api/links/shorten?path=does-not-exist", {
      headers: { "x-api-key": "test-shortlink-api-key" },
    });
    const getMissingRes = await shortenGet(getMissingReq);
    assert.equal(getMissingRes.status, 200);
    assert.equal((await getMissingRes.json()).link, null);
  });

  test("7. RBAC enforces organizer vs executive organizer privileges", async () => {
    for (const deniedRole of ["unauthenticated", "member"]) {
      harness.role = deniedRole;
      assert.equal((await fetchShortLinksAction()).success, false);
      assert.equal((await fetchShortFoldersAction()).success, false);
      assert.equal((await createShortLinkAction({ originalURL: "https://gdgjakarta.com" })).success, false);
      assert.equal((await getLinkStatsAction("lnk_123", "total")).success, false);
      assert.equal((await archiveShortLinksAction(["lnk_123"])).success, false);
      assert.equal((await bulkImportShortLinksAction([{ originalURL: "https://gdgjakarta.com" }])).success, false);
      assert.equal((await listShortDomainsAction()).success, false);
      assert.equal((await updateShortFolderAction("fld_1", { name: "X" })).success, false);
      assert.equal((await deleteShortFolderAction("fld_1")).success, false);
    }

    // Standard organizer can manage links & list domains, but CANNOT mutate domains
    harness.role = "organizer";
    assert.equal((await fetchShortLinksAction()).success, true);
    assert.equal((await listShortDomainsAction()).success, true);

    const orgCreateDom = await createShortDomainAction("sub.gdgjakarta.org");
    assert.equal(orgCreateDom.success, false);
    assert.match(orgCreateDom.error ?? "", /Executive organizer/i);

    const orgCfgDom = await updateShortDomainConfigAction(1516440, { linkType: "custom" });
    assert.equal(orgCfgDom.success, false);
    assert.match(orgCfgDom.error ?? "", /Executive organizer/i);

    // Executive organizer can create & delete secondary domains
    harness.role = "executive";
    const execCreateDom = await createShortDomainAction("sub.gdgjakarta.org");
    assert.equal(execCreateDom.success, true);
    const execDelDom = await deleteShortDomainAction(execCreateDom.data.id);
    assert.equal(execDelDom.success, true);
  });

  test("8. Chunked bulk operations (>100 and 1000 links) respect D1 100-param limit and keep D1/KV in sync", async () => {
    // Verify the D1 shim itself rejects >100 bound params
    assert.throws(
      () =>
        activeD1
          .prepare(`SELECT id FROM short_links WHERE id IN (${new Array(101).fill("?").join(", ")})`)
          .bind(...new Array(101).fill("x")),
      /D1_ERROR: too many SQL variables/,
    );

    const folder = (await createShortFolderAction({ name: "Bulk 1000" })).data;
    assert.ok(folder?.id);

    // Seed 1000 links directly in D1 + KV (via createShortLinkAction for the first 120, fast SQLite insert + KV put for remaining)
    const ids = [];
    const paths = [];
    for (let i = 0; i < 120; i += 1) {
      const slug = `bulk-${i}`;
      const res = await createShortLinkAction({
        originalURL: `https://gdgjakarta.com/bulk/${i}`,
        path: slug,
      });
      assert.equal(res.success, true);
      ids.push(res.data.id);
      paths.push(slug);
    }

    // Exercise 120-link bulk archive, unarchive, move, folder delete, and bulk delete
    const arch120 = await archiveShortLinksAction(ids);
    assert.equal(arch120.success, true);
    for (const slug of paths) {
      const kvRec = await activeKv.get(buildLinkKvKey("gdgjakarta.org", slug), "json");
      assert.equal(kvRec.archived, true);
    }
    const archivedCount120 = activeD1.sqlite
      .prepare("SELECT COUNT(*) AS c FROM short_links WHERE archived = 1")
      .get().c;
    assert.equal(archivedCount120, 120);

    const unarch120 = await unarchiveShortLinksAction(ids);
    assert.equal(unarch120.success, true);
    for (const slug of paths) {
      const kvRec = await activeKv.get(buildLinkKvKey("gdgjakarta.org", slug), "json");
      assert.equal(kvRec.archived, false);
    }

    const move120 = await bulkMoveLinksToFolderAction(ids, folder.id);
    assert.equal(move120.success, true);
    assert.equal(move120.updatedCount, 120);
    for (const slug of paths) {
      const kvRec = await activeKv.get(buildLinkKvKey("gdgjakarta.org", slug), "json");
      assert.equal(kvRec.folderId, folder.id);
    }

    // Deleting a folder with 120 links clears folderId in D1 and KV without hitting >100 SQL variable error
    const delFolderRes = await deleteShortFolderAction(folder.id);
    assert.equal(delFolderRes.success, true);
    for (const slug of paths) {
      const kvRec = await activeKv.get(buildLinkKvKey("gdgjakarta.org", slug), "json");
      assert.equal(kvRec.folderId, null);
    }

    const del120 = await bulkDeleteShortLinksAction(ids);
    assert.equal(del120.success, true);
    assert.equal(del120.deletedCount, 120);
    assert.equal(activeD1.sqlite.prepare("SELECT COUNT(*) AS c FROM short_links").get().c, 0);
    for (const slug of paths) {
      assert.equal(await activeKv.get(buildLinkKvKey("gdgjakarta.org", slug)), null);
    }

    // Scale check up to the 1000-link action ceiling
    const folder1000 = (await createShortFolderAction({ name: "Scale 1000" })).data;
    const ids1000 = [];
    const insertStmt = activeD1.sqlite.prepare(
      `INSERT INTO short_links (id, domain_id, hostname, path, original_url, created_at, updated_at)
       VALUES (?, 1516440, 'gdgjakarta.org', ?, ?, datetime('now'), datetime('now'))`,
    );
    activeD1.sqlite.exec("BEGIN;");
    for (let i = 0; i < 1000; i += 1) {
      const id = `lnk_scale_${i}`;
      const slug = `scale-${i}`;
      insertStmt.run(id, slug, `https://gdgjakarta.com/scale/${i}`);
      ids1000.push(id);
    }
    activeD1.sqlite.exec("COMMIT;");

    assert.equal((await archiveShortLinksAction(ids1000)).success, true);
    assert.equal(activeD1.sqlite.prepare("SELECT COUNT(*) AS c FROM short_links WHERE archived = 1").get().c, 1000);
    assert.equal((await activeKv.get(buildLinkKvKey("gdgjakarta.org", "scale-999"), "json")).archived, true);

    const move1000 = await bulkMoveLinksToFolderAction(ids1000, folder1000.id);
    assert.equal(move1000.success, true);
    assert.equal(move1000.updatedCount, 1000);
    assert.equal((await activeKv.get(buildLinkKvKey("gdgjakarta.org", "scale-0"), "json")).folderId, folder1000.id);

    const del1000 = await bulkDeleteShortLinksAction(ids1000);
    assert.equal(del1000.success, true);
    assert.equal(del1000.deletedCount, 1000);
    assert.equal(activeD1.sqlite.prepare("SELECT COUNT(*) AS c FROM short_links").get().c, 0);
    assert.equal(await activeKv.get(buildLinkKvKey("gdgjakarta.org", "scale-999")), null);
  });

  test("9. URL validation rejects ASCII control characters in D1 store and /api/links/shorten", async () => {
    const badUrls = [
      "https://gdgjakarta.com/foo\nbar",
      "https://gdgjakarta.com/foo\rbar",
      "https://gdgjakarta.com/foo\tbar",
      "https://gdgjakarta.com/foo\x00bar",
      "https://gdgjakarta.com/foo\x7fbar",
      "https://gdgjakarta.com/trailing\n",
    ];

    for (const bad of badUrls) {
      assert.equal((await createShortLinkAction({ originalURL: bad })).success, false);
      const apiPost = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
        method: "POST",
        headers: { "x-api-key": "test-shortlink-api-key", "content-type": "application/json" },
        body: JSON.stringify({ originalURL: bad }),
      });
      assert.equal((await shortenPost(apiPost)).status, 400);
    }

    // Secondary URL fields also reject control chars
    assert.equal(
      (
        await createShortLinkAction({
          originalURL: "https://gdgjakarta.com",
          expiredURL: "https://gdgjakarta.com/e\nx",
        })
      ).success,
      false,
    );
    assert.equal(
      (
        await createShortLinkAction({
          originalURL: "https://gdgjakarta.com",
          androidURL: "https://gdgjakarta.com/a\tx",
        })
      ).success,
      false,
    );
    assert.equal(
      (await createShortLinkAction({ originalURL: "https://gdgjakarta.com", iphoneURL: "https://gdgjakarta.com/i\rx" }))
        .success,
      false,
    );
    assert.equal(
      (
        await createShortLinkAction({
          originalURL: "https://gdgjakarta.com",
          geoTargets: [{ country: "ID", url: "https://gdgjakarta.com/id\x7f" }],
        })
      ).success,
      false,
    );
    assert.equal(
      (
        await createShortLinkAction({
          originalURL: "https://gdgjakarta.com",
          linkType: "split",
          splitTargets: [{ url: "https://gdgjakarta.com/s\n", weight: 1, label: "A" }],
        })
      ).success,
      false,
    );
    assert.equal(
      (
        await createShortLinkAction({
          originalURL: "https://gdgjakarta.com",
          linkType: "bundle",
          bundleItems: [{ title: "Deck", url: "https://gdgjakarta.com/b\t" }],
        })
      ).success,
      false,
    );

    const apiExpiredBad = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: { "x-api-key": "test-shortlink-api-key", "content-type": "application/json" },
      body: JSON.stringify({ originalURL: "https://gdgjakarta.com/ok", expiredURL: "https://gdgjakarta.com/bad\n" }),
    });
    assert.equal((await shortenPost(apiExpiredBad)).status, 400);

    const apiGetBad = new NextRequest(
      `https://gdgjakarta.com/api/links/shorten?originalURL=${encodeURIComponent("https://gdgjakarta.com/foo\nbar")}`,
      { headers: { "x-api-key": "test-shortlink-api-key" } },
    );
    assert.equal((await shortenGet(apiGetBad)).status, 400);
  });

  test("10. findLinkByOriginalUrlD1 excludes archived links by default across event actions & API", async () => {
    const created = (
      await createShortLinkAction({
        originalURL: "https://gdgjakarta.com/events/arch-evt",
        path: "arch-evt",
      })
    ).data;
    assert.ok(created);
    assert.equal((await archiveShortLinksAction([created.id])).success, true);

    const pubRes = await getPublicEventShortLinksAction({ eventId: "arch-evt" });
    assert.equal(pubRes.success, true);
    assert.equal(pubRes.data?.liveShortLink, null);

    const orgRes = await getEventShortLinksAction({ liveUrl: "https://gdgjakarta.com/events/arch-evt" });
    assert.equal(orgRes.success, true);
    assert.equal(orgRes.data?.liveShortLink, null);

    const apiGet = new NextRequest(
      `https://gdgjakarta.com/api/links/shorten?originalURL=${encodeURIComponent("https://gdgjakarta.com/events/arch-evt")}`,
      { headers: { "x-api-key": "test-shortlink-api-key" } },
    );
    const apiRes = await shortenGet(apiGet);
    assert.equal(apiRes.status, 200);
    assert.equal((await apiRes.json()).link, null);

    const explicit = await findLinkByOriginalUrlD1(activeD1, "https://gdgjakarta.com/events/arch-evt", undefined, {
      includeArchived: true,
    });
    assert.equal(explicit?.id, created.id);
    assert.equal(explicit?.archived, true);
  });

  test("11. getExistingEventSlideTemplateOptionsAction finds official template slugs even when >150 newer links exist", async () => {
    await createShortLinkAction({
      originalURL: "https://docs.google.com/presentation/d/gdg-old",
      path: "gdg-slide-template",
      title: "Dynamic GDG Deck Beyond 150",
    });
    await createShortLinkAction({
      originalURL: "https://docs.google.com/presentation/d/df-old",
      path: "devfest26-slide-template",
      title: "Dynamic DevFest Deck Beyond 150",
    });
    activeD1.sqlite
      .prepare(
        "UPDATE short_links SET created_at = '2025-01-01T00:00:00.000Z' WHERE path IN ('gdg-slide-template', 'devfest26-slide-template')",
      )
      .run();

    const insertNewer = activeD1.sqlite.prepare(
      `INSERT INTO short_links (id, domain_id, hostname, path, original_url, created_at, updated_at)
       VALUES (?, 1516440, 'gdgjakarta.org', ?, ?, '2026-11-27T00:00:00.000Z', '2026-11-27T00:00:00.000Z')`,
    );
    for (let i = 0; i < 160; i += 1) {
      insertNewer.run(`lnk_newer_${i}`, `newer-${i}`, `https://gdgjakarta.com/newer/${i}`);
    }

    const opts = await getExistingEventSlideTemplateOptionsAction("9988");
    assert.equal(opts.success, true);
    assert.equal(opts.presets.gdg_default.label, "Dynamic GDG Deck Beyond 150");
    assert.equal(opts.presets.gdg_default.url, "https://gdgjakarta.org/gdg-slide-template");
    assert.equal(opts.presets.devfest26.label, "Dynamic DevFest Deck Beyond 150");
    assert.equal(opts.presets.devfest26.url, "https://gdgjakarta.org/devfest26-slide-template");
  });

  test("12. updateLinkD1 clears stale splitTargets and bundleItems when switching linkType to redirect", async () => {
    const splitLink = (
      await createShortLinkAction({
        originalURL: "https://gdgjakarta.com/default-dest",
        path: "split-to-redir",
        linkType: "split",
        splitTargets: [
          { url: "https://gdgjakarta.com/var-a", weight: 50, label: "Var A" },
          { url: "https://gdgjakarta.com/var-b", weight: 50, label: "Var B" },
        ],
      })
    ).data;
    assert.equal(splitLink.splitTargets?.length, 2);

    const switchedToRedirect = (await updateShortLinkAction(splitLink.id, { linkType: "redirect" })).data;
    assert.equal(switchedToRedirect.linkType, "redirect");
    assert.deepEqual(switchedToRedirect.splitTargets, []);
    const kvSplit = await activeKv.get(buildLinkKvKey("gdgjakarta.org", "split-to-redir"), "json");
    assert.equal(kvSplit.linkType, "redirect");
    assert.deepEqual(kvSplit.splitTargets, []);

    const bundleLink = (
      await createShortLinkAction({
        originalURL: "https://gdgjakarta.com/bundle-main",
        path: "bundle-to-redir",
        linkType: "bundle",
        bundleItems: [{ title: "Item 1", url: "https://gdgjakarta.com/item-1" }],
      })
    ).data;
    assert.equal(bundleLink.bundleItems?.length, 1);

    const switchedBundle = (await updateShortLinkAction(bundleLink.id, { linkType: "redirect" })).data;
    assert.equal(switchedBundle.linkType, "redirect");
    assert.deepEqual(switchedBundle.bundleItems, []);
    const kvBundle = await activeKv.get(buildLinkKvKey("gdgjakarta.org", "bundle-to-redir"), "json");
    assert.deepEqual(kvBundle.bundleItems, []);
  });

  test("13. Unknown domainId throws NotFound, NaN limit normalizes cleanly, and deleteShortDomainAction checks auth first", async () => {
    // Unknown numeric domainId throws ShortlinkNotFoundError instead of returning primary stats
    await createShortLinkAction({ originalURL: "https://gdgjakarta.com/s", path: "dom-check" });
    activeD1.sqlite.prepare("UPDATE short_links SET legacy_clicks = 55 WHERE path = 'dom-check'").run();

    await assert.rejects(() => queryDomainStatsD1(activeD1, 999999, "total"), ShortlinkNotFoundError);
    await assert.rejects(() => queryDomainStatsD1(activeD1, Number.NaN, "total"), ShortlinkNotFoundError);

    // NaN limit falls back cleanly in listLinksD1 and queryClickstreamD1
    const linksRes = await fetchShortLinksAction({ limit: Number.NaN });
    assert.equal(linksRes.success, true);
    assert.equal(linksRes.data?.length, 1);

    const streamRes = await getDomainClickstreamAction({ limit: Number.NaN });
    assert.equal(streamRes.success, true);
    assert.deepEqual(streamRes.data, []);

    // deleteShortDomainAction checks executive auth before primary domain check
    for (const deniedRole of ["unauthenticated", "member", "organizer"]) {
      harness.role = deniedRole;
      const res = await deleteShortDomainAction(1516440);
      assert.equal(res.success, false);
      assert.match(res.error ?? "", /Unauthorized: Executive organizer privileges required/);
    }

    harness.role = "executive";
    const execPrimaryRes = await deleteShortDomainAction(1516440);
    assert.equal(execPrimaryRes.success, false);
    assert.match(execPrimaryRes.error ?? "", /primary domain/i);
  });
});
