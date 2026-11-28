import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { createRequire, registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const SRC_ROOT = path.join(REPO_ROOT, "src");
export const DEFAULT_WORKER_ENTRY_PATH = path.join(REPO_ROOT, "workers/shortlink/src/index.ts");
export const DEFAULT_MIGRATION_SQL_PATH = path.join(REPO_ROOT, "workers/shortlink/migrations/0001_shortlinks.sql");
export const DEFAULT_MIGRATION_SCRIPT_PATH = path.join(REPO_ROOT, "scripts/migrate-shortio-to-d1.mjs");

export const DEFAULT_SHORTLINKS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS short_domains (
  id INTEGER PRIMARY KEY,
  hostname TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL DEFAULT 'configured',
  link_type TEXT NOT NULL DEFAULT 'custom',
  apple_app_site_association TEXT,
  asset_links TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS short_folders (
  id TEXT PRIMARY KEY,
  domain_id INTEGER NOT NULL REFERENCES short_domains(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0693E3',
  icon TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(domain_id, name)
);

CREATE INDEX IF NOT EXISTS idx_short_folders_domain_id
  ON short_folders(domain_id);

CREATE TABLE IF NOT EXISTS short_links (
  id TEXT PRIMARY KEY,
  domain_id INTEGER NOT NULL REFERENCES short_domains(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL DEFAULT 'gdgjakarta.org',
  path TEXT NOT NULL,
  original_url TEXT NOT NULL,
  title TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  folder_id TEXT REFERENCES short_folders(id) ON DELETE SET NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  redirect_type INTEGER NOT NULL DEFAULT 302 CHECK (redirect_type IN (301, 302, 307, 308)),
  expires_at INTEGER,
  expired_url TEXT,
  password_hash TEXT,
  has_password INTEGER NOT NULL DEFAULT 0 CHECK (has_password IN (0, 1)),
  cloaking INTEGER NOT NULL DEFAULT 0 CHECK (cloaking IN (0, 1)),
  android_url TEXT,
  iphone_url TEXT,
  geo_targets_json TEXT NOT NULL DEFAULT '[]',
  utm_params_json TEXT,
  pixels_json TEXT,
  max_clicks INTEGER CHECK (max_clicks IS NULL OR max_clicks >= 0),
  clicks_count INTEGER NOT NULL DEFAULT 0 CHECK (clicks_count >= 0),
  legacy_clicks INTEGER NOT NULL DEFAULT 0 CHECK (legacy_clicks >= 0),
  link_type TEXT NOT NULL DEFAULT 'redirect' CHECK (link_type IN ('redirect', 'split', 'bundle')),
  split_targets_json TEXT NOT NULL DEFAULT '[]',
  bundle_items_json TEXT NOT NULL DEFAULT '[]',
  owner_id INTEGER,
  owner_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(hostname, path)
);

CREATE INDEX IF NOT EXISTS idx_short_links_hostname_path
  ON short_links(hostname, path);

CREATE INDEX IF NOT EXISTS idx_short_links_folder_id
  ON short_links(folder_id);

CREATE INDEX IF NOT EXISTS idx_short_links_domain_archived_created
  ON short_links(domain_id, archived, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_short_links_original_url
  ON short_links(hostname, original_url);

CREATE TABLE IF NOT EXISTS short_link_clicks (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  path TEXT NOT NULL,
  clicked_at INTEGER NOT NULL,
  country TEXT,
  city TEXT,
  browser TEXT,
  os TEXT,
  device TEXT,
  referer TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0 CHECK (is_bot IN (0, 1)),
  variant_label TEXT,
  target_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_short_link_clicks_link_clicked_at
  ON short_link_clicks(link_id, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_short_link_clicks_hostname_clicked_at
  ON short_link_clicks(hostname, clicked_at DESC);
`;

export const DEFAULT_TEST_ENV = Object.freeze({
  SHORTLINK_COOKIE_SECRET: "e2e-test-shortlink-cookie-secret-32-bytes!",
  SHORTLINK_SIGNING_SECRET: "e2e-test-shortlink-signing-secret-32-bytes!",
  SESSION_SECRET: "e2e-test-session-secret-at-least-32-bytes!",
  SHORTLINK_DEFAULT_DOMAIN: "gdgjakarta.org",
  SHORTIO_DOMAIN: "gdgjakarta.org",
  SHORTIO_DOMAIN_ID: "1516440",
  SHORTLINK_PROVIDER: "cloudflare",
  SHORTLINK_API_KEY: "test-shortlink-api-key",
  N8N_WEBHOOK_API_KEY: "test-shortlink-api-key",
  SHORTIO_API_KEY: "test_shortio_api_key",
});

// Seed default process.env keys before production modules like shortio-config.ts are imported.
for (const [key, value] of Object.entries(DEFAULT_TEST_ENV)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const pkgResolve = createRequire(path.join(REPO_ROOT, "package.json"));
let loadedMiniflarePkg = null;
let loadedEsbuildPkg = null;

async function getMiniflarePkg() {
  if (!loadedMiniflarePkg) {
    const resolved = pkgResolve.resolve("miniflare");
    loadedMiniflarePkg = await import(pathToFileURL(resolved).href);
  }
  return loadedMiniflarePkg;
}

async function getEsbuildPkg() {
  if (!loadedEsbuildPkg) {
    const resolved = pkgResolve.resolve("esbuild");
    loadedEsbuildPkg = await import(pathToFileURL(resolved).href);
  }
  return loadedEsbuildPkg;
}

// ============================================================================
// Worker TS Bundling (with Entrypoint Cache)
// ============================================================================
const bundleCache = new Map();

export function clearWorkerBundleCache() {
  bundleCache.clear();
}

const workerAliasPlugin = {
  name: "gdg-shortlink-alias",
  setup(buildApi) {
    buildApi.onResolve({ filter: /^@\// }, (args) => {
      const target = path.join(SRC_ROOT, args.path.slice(2));
      for (const suffix of ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx", "/index.mjs", "/index.js"]) {
        const candidate = `${target}${suffix}`;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return { path: candidate };
        }
      }
      return undefined;
    });
  },
};

export async function bundleWorkerTs({ workerEntryPath, workerTsSource, resolveDir = REPO_ROOT } = {}) {
  const esbuild = await getEsbuildPkg();

  if (typeof workerTsSource === "string") {
    const result = await esbuild.build({
      stdin: {
        contents: workerTsSource,
        resolveDir,
        sourcefile: workerEntryPath || "inline-worker.ts",
        loader: "ts",
      },
      bundle: true,
      write: false,
      format: "esm",
      target: "es2022",
      platform: "neutral",
      mainFields: ["module", "main"],
      conditions: ["workerd", "worker", "browser", "import"],
      external: ["node:*", "cloudflare:*"],
      plugins: [workerAliasPlugin],
    });
    return result.outputFiles[0].text;
  }

  if (!workerEntryPath) {
    throw new Error("bundleWorkerTs requires either workerEntryPath or workerTsSource.");
  }

  const absEntry = path.resolve(workerEntryPath);
  const stat = fs.statSync(absEntry);
  const cacheKey = `${absEntry}:${stat.mtimeMs}:${stat.size}`;
  const cached = bundleCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const result = await esbuild.build({
    entryPoints: [absEntry],
    bundle: true,
    write: false,
    format: "esm",
    target: "es2022",
    platform: "neutral",
    mainFields: ["module", "main"],
    conditions: ["workerd", "worker", "browser", "import"],
    external: ["node:*", "cloudflare:*"],
    plugins: [workerAliasPlugin],
  });

  const bundledText = result.outputFiles[0].text;
  bundleCache.set(cacheKey, bundledText);
  return bundledText;
}

// ============================================================================
// Fake Short.io In-Memory State Machine + Zero-Network Fetch Tripwire
// ============================================================================
function createFakeShortioStore() {
  let nextLinkSeq = 1;
  let nextFolderSeq = 1;
  let nextDomainSeq = 2000000;

  const state = {
    domains: [],
    folders: [],
    links: [],
    linkStats: new Map(),
    domainStats: new Map(),
    requests: [],
    /** @type {{ status?: number; message?: string } | null} */
    failureMode: null,
  };

  function seedDefaults() {
    state.domains = [
      {
        id: 1516440,
        hostname: "gdgjakarta.org",
        state: "configured",
        linkType: "custom",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ];
  }

  seedDefaults();

  function makeLinkObject(input, existing = null) {
    const id = existing?.id ?? `lnk_fake_${nextLinkSeq++}`;
    const hostname = String(input.domain || existing?.hostname || "gdgjakarta.org")
      .trim()
      .toLowerCase();
    const rawPath = input.path !== undefined ? String(input.path).trim().replace(/^\/+/, "") : existing?.path;
    const slug = rawPath || `auto${crypto.randomBytes(3).toString("hex")}`;
    const now = new Date().toISOString();
    const hasPassword = input.password !== undefined ? Boolean(input.password) : Boolean(existing?.hasPassword);

    return {
      id,
      idString: id,
      shortURL: `https://${hostname}/${slug}`,
      secureShortURL: `https://${hostname}/${slug}`,
      originalURL: String(input.originalURL ?? existing?.originalURL ?? ""),
      path: slug,
      displayPath: slug,
      title: input.title !== undefined ? input.title : existing?.title,
      tags: input.tags !== undefined ? input.tags : (existing?.tags ?? []),
      FolderId: input.folderId !== undefined ? (input.folderId ?? undefined) : existing?.FolderId,
      DomainId: Number(input.domainId ?? existing?.DomainId ?? 1516440),
      hostname,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      archived: input.archived !== undefined ? Boolean(input.archived) : Boolean(existing?.archived),
      clicks: Number(input.clicks ?? existing?.clicks ?? 0),
      cloaking: input.cloaking !== undefined ? Boolean(input.cloaking) : Boolean(existing?.cloaking),
      hasPassword,
      password: input.password !== undefined ? input.password : existing?.password,
      redirectType:
        input.redirectType !== undefined ? String(input.redirectType) : (existing?.redirectType ?? undefined),
      expiresAt: input.expiresAt !== undefined ? input.expiresAt : existing?.expiresAt,
      expiredURL: input.expiredURL !== undefined ? input.expiredURL : existing?.expiredURL,
      androidURL: input.androidURL !== undefined ? input.androidURL : existing?.androidURL,
      iphoneURL: input.iphoneURL !== undefined ? input.iphoneURL : existing?.iphoneURL,
    };
  }

  function reset() {
    nextLinkSeq = 1;
    nextFolderSeq = 1;
    nextDomainSeq = 2000000;
    state.folders = [];
    state.links = [];
    state.linkStats.clear();
    state.domainStats.clear();
    state.requests.length = 0;
    state.failureMode = null;
    seedDefaults();
  }

  function seed(fixtures = {}) {
    if (Array.isArray(fixtures.domains)) {
      state.domains = structuredClone(fixtures.domains);
    }
    if (Array.isArray(fixtures.folders)) {
      state.folders = structuredClone(fixtures.folders);
    }
    if (Array.isArray(fixtures.links)) {
      state.links = fixtures.links.map((item) => makeLinkObject(item, item));
    }
    if (fixtures.linkStats) {
      const entries =
        fixtures.linkStats instanceof Map ? fixtures.linkStats.entries() : Object.entries(fixtures.linkStats);
      for (const [k, v] of entries) {
        state.linkStats.set(k, structuredClone(v));
      }
    }
    if (fixtures.domainStats) {
      const entries =
        fixtures.domainStats instanceof Map ? fixtures.domainStats.entries() : Object.entries(fixtures.domainStats);
      for (const [k, v] of entries) {
        state.domainStats.set(String(k), structuredClone(v));
      }
    }
  }

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  async function handleRequest(urlStr, method, headers, rawBody) {
    const url = new URL(urlStr);
    const upperMethod = method.toUpperCase();
    let parsedBody = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }
    }

    state.requests.push({
      method: upperMethod,
      url: url.toString(),
      headers: Object.fromEntries(headers.entries()),
      body: parsedBody,
    });

    const activeFailure = state.failureMode;
    if (activeFailure !== null) {
      return jsonResponse({ error: activeFailure.message || "Simulated Short.io error" }, activeFailure.status || 500);
    }

    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname;

    if (hostname === "statistics.short.io") {
      const linkMatch = pathname.match(/^\/statistics\/link\/([^/]+)$/);
      if (upperMethod === "GET" && linkMatch) {
        const linkId = decodeURIComponent(linkMatch[1]);
        const preset = state.linkStats.get(linkId);
        if (preset) return jsonResponse(preset);
        const found = state.links.find((l) => l.id === linkId || l.idString === linkId);
        const clicks = found?.clicks ?? 0;
        return jsonResponse({
          totalClicks: clicks,
          humanClicks: clicks,
          clicks,
          clickStatistics: { datasets: [{ data: [] }] },
          country: [],
          browser: [],
          os: [],
          device: [],
          referer: [],
        });
      }

      const domainMatch = pathname.match(/^\/statistics\/domain\/([^/]+)$/);
      if (upperMethod === "GET" && domainMatch) {
        const domainId = decodeURIComponent(domainMatch[1]);
        const preset = state.domainStats.get(domainId);
        if (preset) return jsonResponse(preset);
        const total = state.links.reduce((sum, l) => sum + (Number(l.clicks) || 0), 0);
        return jsonResponse({
          totalClicks: total,
          humanClicks: total,
          clicks: total,
          clickStatistics: { datasets: [{ data: [] }] },
          country: [],
          browser: [],
          os: [],
          device: [],
          referer: [],
        });
      }

      return jsonResponse({ error: `Unhandled statistics.short.io route: ${upperMethod} ${pathname}` }, 404);
    }

    // api.short.io routes
    if (upperMethod === "GET" && pathname === "/api/links") {
      const folderId = url.searchParams.get("folderId");
      const archivedParam = url.searchParams.get("archived");
      const limit = Number(url.searchParams.get("limit") || 150);
      const offset = Number(url.searchParams.get("pageToken") || 0);

      let filtered = state.links;
      if (folderId) {
        filtered = filtered.filter((l) => l.FolderId === folderId);
      }
      if (archivedParam === "true") {
        filtered = filtered.filter((l) => Boolean(l.archived));
      } else if (archivedParam === "false") {
        filtered = filtered.filter((l) => !l.archived);
      }

      const page = filtered.slice(offset, offset + limit);
      const nextOffset = offset + page.length;
      const nextPageToken = nextOffset < filtered.length ? String(nextOffset) : undefined;
      return jsonResponse({
        count: filtered.length,
        links: page,
        ...(nextPageToken ? { nextPageToken } : {}),
      });
    }

    if (upperMethod === "GET" && pathname.startsWith("/links/folders/")) {
      const domainId = Number(pathname.split("/").pop());
      const folders = Number.isFinite(domainId)
        ? state.folders.filter((f) => Number(f.DomainId) === domainId)
        : state.folders;
      return jsonResponse({ linkFolders: folders });
    }

    if (upperMethod === "POST" && pathname === "/links/folders") {
      const body = parsedBody && typeof parsedBody === "object" ? parsedBody : {};
      const folder = {
        id: `fld_fake_${nextFolderSeq++}`,
        name: String(body.name || "Untitled"),
        color: String(body.color || "#0693E3"),
        DomainId: Number(body.domainId || 1516440),
      };
      state.folders.push(folder);
      return jsonResponse(folder);
    }

    if (upperMethod === "GET" && pathname === "/links/expand") {
      const pathSlug = (url.searchParams.get("path") || "").replace(/^\/+/, "");
      const domain = (url.searchParams.get("domain") || "gdgjakarta.org").toLowerCase();
      const found = state.links.find((l) => l.path === pathSlug && (!l.hostname || l.hostname === domain));
      if (!found) return jsonResponse({ error: "Link not found" }, 404);
      return jsonResponse(found);
    }

    if (upperMethod === "GET" && pathname === "/links/by-original-url") {
      const originalURL = url.searchParams.get("originalURL") || "";
      const domain = (url.searchParams.get("domain") || "gdgjakarta.org").toLowerCase();
      const found = state.links.find((l) => l.originalURL === originalURL && (!l.hostname || l.hostname === domain));
      if (!found) return jsonResponse({ error: "Link not found" }, 404);
      return jsonResponse(found);
    }

    if (upperMethod === "POST" && pathname === "/links/archive") {
      const body = parsedBody && typeof parsedBody === "object" ? parsedBody : {};
      const found = state.links.find((l) => l.id === body.link_id || l.idString === body.link_id);
      if (!found) return jsonResponse({ error: "Link not found" }, 404);
      found.archived = true;
      found.updatedAt = new Date().toISOString();
      return jsonResponse(found);
    }

    if (upperMethod === "POST" && pathname === "/links/archive_bulk") {
      const body = parsedBody && typeof parsedBody === "object" ? parsedBody : {};
      const ids = new Set(Array.isArray(body.link_ids) ? body.link_ids : []);
      let archivedCount = 0;
      for (const link of state.links) {
        if (ids.has(link.id) || ids.has(link.idString)) {
          link.archived = true;
          link.updatedAt = new Date().toISOString();
          archivedCount += 1;
        }
      }
      return jsonResponse({ success: true, archivedCount });
    }

    if (upperMethod === "POST" && pathname === "/links/bulk") {
      const body = parsedBody && typeof parsedBody === "object" ? parsedBody : {};
      const domain = String(body.domain || "gdgjakarta.org").toLowerCase();
      const allowDuplicates = Boolean(body.allowDuplicates);
      const items = Array.isArray(body.links) ? body.links : [];
      const created = [];
      for (const item of items) {
        const cleanPath = item.path ? String(item.path).trim().replace(/^\/+/, "") : "";
        if (!allowDuplicates && cleanPath && state.links.some((l) => l.hostname === domain && l.path === cleanPath)) {
          created.push({ error: `Duplicate path: ${cleanPath}` });
          continue;
        }
        const link = makeLinkObject({ ...item, domain });
        state.links.push(link);
        created.push(link);
      }
      return jsonResponse(created);
    }

    if (upperMethod === "POST" && pathname === "/links") {
      const body = parsedBody && typeof parsedBody === "object" ? parsedBody : {};
      const domain = String(body.domain || "gdgjakarta.org").toLowerCase();
      const cleanPath = body.path ? String(body.path).trim().replace(/^\/+/, "") : "";
      if (cleanPath && state.links.some((l) => l.hostname === domain && l.path === cleanPath)) {
        return jsonResponse({ error: "Link with this path already exists" }, 409);
      }
      const created = makeLinkObject({ ...body, domain });
      state.links.push(created);
      return jsonResponse(created);
    }

    const linkIdMatch = pathname.match(/^\/links\/([^/]+)$/);
    if (linkIdMatch) {
      const linkId = decodeURIComponent(linkIdMatch[1]);
      const idx = state.links.findIndex((l) => l.id === linkId || l.idString === linkId);
      if (idx === -1) return jsonResponse({ error: "Link not found" }, 404);

      if (upperMethod === "GET") {
        return jsonResponse(state.links[idx]);
      }
      if (upperMethod === "POST") {
        const body = parsedBody && typeof parsedBody === "object" ? parsedBody : {};
        const updated = makeLinkObject(body, state.links[idx]);
        state.links[idx] = updated;
        return jsonResponse(updated);
      }
      if (upperMethod === "DELETE") {
        state.links.splice(idx, 1);
        return jsonResponse({ success: true });
      }
    }

    if (upperMethod === "GET" && pathname === "/api/domains") {
      return jsonResponse(state.domains);
    }

    if (upperMethod === "POST" && pathname === "/domains") {
      const body = parsedBody && typeof parsedBody === "object" ? parsedBody : {};
      const host = String(body.hostname || "")
        .trim()
        .toLowerCase();
      if (!host) return jsonResponse({ error: "hostname is required" }, 400);
      if (state.domains.some((d) => d.hostname === host)) {
        return jsonResponse({ error: "Domain already exists" }, 409);
      }
      const created = {
        id: nextDomainSeq++,
        hostname: host,
        state: "configured",
        linkType: "custom",
        createdAt: new Date().toISOString(),
      };
      state.domains.push(created);
      return jsonResponse(created);
    }

    const domainIdMatch = pathname.match(/^\/domains\/(\d+)$/);
    if (upperMethod === "DELETE" && domainIdMatch) {
      const domainId = Number(domainIdMatch[1]);
      const idx = state.domains.findIndex((d) => d.id === domainId);
      if (idx === -1) return jsonResponse({ error: "Domain not found" }, 404);
      state.domains.splice(idx, 1);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: `Unhandled api.short.io route: ${upperMethod} ${pathname}` }, 404);
  }

  return {
    get state() {
      return state;
    },
    get requests() {
      return state.requests;
    },
    seed,
    reset,
    setFailureMode(mode) {
      state.failureMode = mode;
    },
    getState() {
      return {
        domains: structuredClone(state.domains),
        folders: structuredClone(state.folders),
        links: structuredClone(state.links),
        requests: structuredClone(state.requests),
      };
    },
    handleRequest,
  };
}

// ============================================================================
// Shared Harness Bridge State (used by registerHooks virtual stubs)
// ============================================================================
const HARNESS_STATE_KEY = Symbol.for("gdgjakarta.shortlink.e2e.harnessState");

function normalizeBootEnvOverrides(envInput = {}) {
  const normalized = {};
  for (const [k, v] of Object.entries(envInput)) {
    if (v === undefined || v === null) {
      normalized[k] = undefined;
    } else {
      normalized[k] = String(v);
    }
  }
  return normalized;
}

function createHarnessState() {
  const shortioStore = createFakeShortioStore();
  let activeBindings = {
    SHORTLINKS_DB: null,
    SHORTLINKS_KV: null,
    bootEnvOverrides: {},
    envOverrides: {},
    unsetEnvKeys: new Set(),
  };

  const bootProcessBaseline = new Map();
  const setEnvProcessBaseline = new Map();

  function applyProcessEnvEntries(entries, baselineMap) {
    for (const [k, v] of entries) {
      if (!baselineMap.has(k)) {
        baselineMap.set(k, {
          existed: Object.hasOwn(process.env, k),
          value: process.env[k],
        });
      }
      if (v === undefined || v === null) {
        delete process.env[k];
      } else {
        process.env[k] = String(v);
      }
    }
  }

  function restoreProcessEnvBaseline(baselineMap) {
    for (const [k, prev] of baselineMap.entries()) {
      if (prev.existed) {
        process.env[k] = prev.value;
      } else {
        delete process.env[k];
      }
    }
    baselineMap.clear();
  }

  function applyBootEnvToActiveBindings(bootEnv) {
    const cleanBoot = normalizeBootEnvOverrides(bootEnv);
    const envOverrides = {};
    const unsetEnvKeys = new Set();
    for (const [k, v] of Object.entries(cleanBoot)) {
      if (v === undefined) {
        unsetEnvKeys.add(k);
      } else {
        envOverrides[k] = v;
      }
    }
    activeBindings.bootEnvOverrides = cleanBoot;
    activeBindings.envOverrides = envOverrides;
    activeBindings.unsetEnvKeys = unsetEnvKeys;
  }

  const authState = {
    role: "organizer",
    user: {
      id: "org-e2e-001",
      name: "GDG Organizer",
      email: "organizer@gdgjakarta.com",
    },
  };

  const cookieJar = new Map();
  const requestHeaders = new Map();
  const revalidatedPaths = [];
  const revalidatedTags = [];
  const firestoreEvents = new Map();
  const firestoreCollections = new Map();
  const bevyUpdates = [];

  return {
    shortio: shortioStore,
    auth: authState,
    cookies: cookieJar,
    requestHeaders,
    revalidatedPaths,
    revalidatedTags,
    bevy: {
      updates: bevyUpdates,
      clear() {
        bevyUpdates.length = 0;
      },
    },
    firestore: {
      events: firestoreEvents,
      collections: firestoreCollections,
      seedEvent(eventId, data) {
        firestoreEvents.set(String(eventId), structuredClone(data));
      },
      getEvent(eventId) {
        const doc = firestoreEvents.get(String(eventId));
        return doc ? structuredClone(doc) : null;
      },
      seedDoc(collectionName, docId, data) {
        let col = firestoreCollections.get(collectionName);
        if (!col) {
          col = new Map();
          firestoreCollections.set(collectionName, col);
        }
        col.set(String(docId), structuredClone(data));
      },
      getDoc(collectionName, docId) {
        const doc = firestoreCollections.get(collectionName)?.get(String(docId));
        return doc ? structuredClone(doc) : null;
      },
      clear() {
        firestoreEvents.clear();
        firestoreCollections.clear();
      },
    },
    setActiveBindings(bindings) {
      restoreProcessEnvBaseline(setEnvProcessBaseline);
      restoreProcessEnvBaseline(bootProcessBaseline);

      const cleanBoot = normalizeBootEnvOverrides(bindings.envOverrides ?? {});
      applyProcessEnvEntries(Object.entries(cleanBoot), bootProcessBaseline);

      activeBindings = {
        SHORTLINKS_DB: bindings.SHORTLINKS_DB ?? null,
        SHORTLINKS_KV: bindings.SHORTLINKS_KV ?? null,
        bootEnvOverrides: cleanBoot,
        envOverrides: {},
        unsetEnvKeys: new Set(),
      };
      applyBootEnvToActiveBindings(cleanBoot);
    },
    getActiveBindings() {
      return activeBindings;
    },
    getActiveCloudflareEnv() {
      const resolved = { ...DEFAULT_TEST_ENV };
      for (const key of Object.keys(DEFAULT_TEST_ENV)) {
        if (process.env[key] !== undefined && process.env[key] !== "") {
          resolved[key] = process.env[key];
        }
      }
      for (const [key, value] of Object.entries(activeBindings.envOverrides)) {
        if (value === undefined || value === null) {
          delete resolved[key];
        } else {
          resolved[key] = String(value);
        }
      }
      for (const key of activeBindings.unsetEnvKeys) {
        delete resolved[key];
      }
      resolved.SHORTLINKS_DB = activeBindings.SHORTLINKS_DB;
      resolved.SHORTLINKS_KV = activeBindings.SHORTLINKS_KV;
      return resolved;
    },
    setEnv(overrides = {}) {
      const entries = Object.entries(overrides);
      applyProcessEnvEntries(entries, setEnvProcessBaseline);
      for (const [k, v] of entries) {
        if (v === undefined || v === null) {
          delete activeBindings.envOverrides[k];
          activeBindings.unsetEnvKeys.add(k);
        } else {
          activeBindings.unsetEnvKeys.delete(k);
          activeBindings.envOverrides[k] = String(v);
        }
      }
    },
    resetEnv() {
      restoreProcessEnvBaseline(setEnvProcessBaseline);
      applyBootEnvToActiveBindings(activeBindings.bootEnvOverrides);
    },
    setAuthRole(role, userOverrides) {
      authState.role = role;
      if (userOverrides) {
        authState.user = { ...authState.user, ...userOverrides };
      } else if (role === "executive") {
        authState.user = { id: "exec-e2e-001", name: "GDG Lead Organizer", email: "lead@gdgjakarta.com" };
      } else if (role === "organizer") {
        authState.user = { id: "org-e2e-001", name: "GDG Organizer", email: "organizer@gdgjakarta.com" };
      } else if (role === "member") {
        authState.user = { id: "mem-e2e-001", name: "GDG Member", email: "member@example.com" };
      }
    },
    setCookie(name, value) {
      cookieJar.set(name, value);
    },
    clearCookies() {
      cookieJar.clear();
    },
    resetBridgeState() {
      this.resetEnv();
      shortioStore.reset();
      authState.role = "organizer";
      authState.user = { id: "org-e2e-001", name: "GDG Organizer", email: "organizer@gdgjakarta.com" };
      cookieJar.clear();
      requestHeaders.clear();
      revalidatedPaths.length = 0;
      revalidatedTags.length = 0;
      firestoreEvents.clear();
      firestoreCollections.clear();
      bevyUpdates.length = 0;
    },
  };
}

if (!globalThis[HARNESS_STATE_KEY]) {
  globalThis[HARNESS_STATE_KEY] = createHarnessState();
}

export const harnessState = globalThis[HARNESS_STATE_KEY];

// ============================================================================
// Zero-Network globalThis.fetch Tripwire
// ============================================================================
const REAL_FETCH_KEY = Symbol.for("gdgjakarta.shortlink.e2e.realFetch");
const TRIPWIRE_INSTALLED_KEY = Symbol.for("gdgjakarta.shortlink.e2e.fetchTripwireInstalled");

if (!globalThis[REAL_FETCH_KEY]) {
  globalThis[REAL_FETCH_KEY] = globalThis.fetch.bind(globalThis);
}

function isLoopbackHost(hostname) {
  const host = hostname.toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
}

export function installFetchTripwire() {
  if (globalThis[TRIPWIRE_INSTALLED_KEY]) {
    return;
  }

  const realFetch = globalThis[REAL_FETCH_KEY];

  globalThis.fetch = async function shortlinkE2eFetch(input, init) {
    const req = input instanceof Request ? input : null;
    const rawUrl = req ? req.url : String(input instanceof URL ? input.href : input);

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new Error(`Unexpected relative/invalid fetch during zero-network E2E test: ${rawUrl}`);
    }

    const protocol = parsedUrl.protocol.toLowerCase();
    const isHttp = protocol === "http:" || protocol === "https:";
    const host = parsedUrl.hostname.toLowerCase();
    if (isHttp && (host === "api.short.io" || host === "statistics.short.io")) {
      const method = init?.method || req?.method || "GET";
      const headers = new Headers(req ? req.headers : undefined);
      if (init?.headers) {
        const extra = new Headers(init.headers);
        for (const [k, v] of extra.entries()) {
          headers.set(k, v);
        }
      }
      let rawBody = "";
      if (init?.body !== undefined && init?.body !== null) {
        rawBody = typeof init.body === "string" ? init.body : String(init.body);
      } else if (req && method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD") {
        rawBody = await req.clone().text();
      }
      return harnessState.shortio.handleRequest(parsedUrl.toString(), method, headers, rawBody);
    }

    if (isHttp && isLoopbackHost(host)) {
      return realFetch(input, init);
    }

    throw new Error(`Unexpected live network fetch attempted during zero-network E2E test: ${parsedUrl.toString()}`);
  };

  globalThis[TRIPWIRE_INSTALLED_KEY] = true;
}

export function uninstallFetchTripwire() {
  if (!globalThis[TRIPWIRE_INSTALLED_KEY]) {
    return;
  }
  globalThis.fetch = globalThis[REAL_FETCH_KEY];
  globalThis[TRIPWIRE_INSTALLED_KEY] = false;
}

// Activate zero-network tripwire immediately when harness is loaded.
installFetchTripwire();

// ============================================================================
// Next.js / OpenNext / Auth / Firestore / Bevy registerHooks Bridge
// ============================================================================
const HOOKS_INSTALLED_KEY = Symbol.for("gdgjakarta.shortlink.e2e.hooksInstalled");

const STUB_SOURCES = {
  "stub:opennext-cloudflare": `
    const h = globalThis[Symbol.for("gdgjakarta.shortlink.e2e.harnessState")];
    export function getCloudflareContext(options) {
      const ctx = {
        env: h.getActiveCloudflareEnv(),
        ctx: {
          waitUntil() {},
          passThroughOnException() {},
        },
        cf: {},
      };
      return options?.async ? Promise.resolve(ctx) : ctx;
    }
    export function initOpenNextCloudflareForDev() {}
  `,
  "stub:next-headers": `
    const h = globalThis[Symbol.for("gdgjakarta.shortlink.e2e.harnessState")];
    export async function cookies() {
      return {
        get(name) {
          if (!h.cookies.has(name)) return undefined;
          return { name, value: h.cookies.get(name) };
        },
        getAll() {
          return Array.from(h.cookies.entries()).map(([name, value]) => ({ name, value }));
        },
        has(name) {
          return h.cookies.has(name);
        },
        set(nameOrObj, value) {
          if (nameOrObj && typeof nameOrObj === "object") {
            if (nameOrObj.name) {
              h.cookies.set(String(nameOrObj.name), String(nameOrObj.value ?? ""));
            }
            return;
          }
          h.cookies.set(String(nameOrObj), String(value ?? ""));
        },
        delete(nameOrObj) {
          const targetName = nameOrObj && typeof nameOrObj === "object" ? nameOrObj.name : nameOrObj;
          if (targetName) {
            h.cookies.delete(String(targetName));
          }
        },
      };
    }
    export async function headers() {
      const hdrs = new Headers();
      for (const [k, v] of h.requestHeaders.entries()) {
        hdrs.set(k, v);
      }
      return hdrs;
    }
  `,
  "stub:next-cache": `
    const h = globalThis[Symbol.for("gdgjakarta.shortlink.e2e.harnessState")];
    export function revalidatePath(pathStr) {
      h.revalidatedPaths.push(pathStr);
    }
    export function revalidateTag(tagStr) {
      h.revalidatedTags.push(tagStr);
    }
    export function unstable_cache(fn) {
      return fn;
    }
  `,
  "stub:next-server": `
    export class NextRequest extends Request {
      constructor(input, init) {
        super(input, init);
        this.nextUrl = new URL(this.url);
        const cookieHeader = this.headers.get("cookie") || "";
        const cookieMap = new Map();
        for (const pair of cookieHeader.split(";")) {
          const trimmed = pair.trim();
          if (!trimmed) continue;
          const eq = trimmed.indexOf("=");
          if (eq <= 0) continue;
          cookieMap.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
        }
        this.cookies = {
          get(name) {
            if (!cookieMap.has(name)) return undefined;
            return { name, value: cookieMap.get(name) };
          },
          getAll() {
            return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
          },
          has(name) {
            return cookieMap.has(name);
          },
        };
      }
    }

    export class NextResponse extends Response {
      static json(body, init = {}) {
        const headers = new Headers(init.headers || {});
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
        return new NextResponse(JSON.stringify(body), { ...init, headers });
      }
      static redirect(url, initOrStatus = 307) {
        const status = typeof initOrStatus === "number" ? initOrStatus : (initOrStatus?.status ?? 307);
        const headers = new Headers(typeof initOrStatus === "object" ? initOrStatus?.headers : undefined);
        headers.set("location", String(url));
        return new NextResponse(null, {
          ...(typeof initOrStatus === "object" ? initOrStatus : {}),
          status,
          headers,
        });
      }
      static next(init = {}) {
        return new NextResponse(null, init);
      }
    }
  `,
  "stub:auth-guard": `
    const h = globalThis[Symbol.for("gdgjakarta.shortlink.e2e.harnessState")];
    export async function getVerifiedSessionRole() {
      const role = h.auth.role;
      if (role === "executive") return "organizer";
      if (role === "organizer") return "core_team";
      if (role === "member") return "member";
      return null;
    }
    export async function isAuthorizedOrganizerSession() {
      return h.auth.role === "organizer" || h.auth.role === "executive";
    }
    export async function isAuthorizedExecutiveOrganizerSession() {
      return h.auth.role === "executive";
    }
    export async function getAuthenticatedSessionUser() {
      if (!h.auth.role || h.auth.role === "unauthenticated") return null;
      return structuredClone(h.auth.user);
    }
    export async function getAuthenticatedSessionEmail() {
      if (!h.auth.role || h.auth.role === "unauthenticated") return null;
      return h.auth.user?.email ? String(h.auth.user.email).toLowerCase().trim() : null;
    }
    export async function isAuthorizedOrganizerOrSelfEmail(targetEmail) {
      if (await isAuthorizedOrganizerSession()) return true;
      if (!targetEmail) return false;
      const email = await getAuthenticatedSessionEmail();
      return Boolean(email && email === String(targetEmail).toLowerCase().trim());
    }
  `,
  "stub:firestore-admin": `
    const h = globalThis[Symbol.for("gdgjakarta.shortlink.e2e.harnessState")];

    function decodeFilterVal(v) {
      if (!v || typeof v !== "object") return v;
      if ("stringValue" in v) return v.stringValue;
      if ("integerValue" in v) return Number(v.integerValue);
      if ("doubleValue" in v) return Number(v.doubleValue);
      if ("booleanValue" in v) return Boolean(v.booleanValue);
      if ("nullValue" in v) return null;
      if ("timestampValue" in v) return v.timestampValue;
      if ("arrayValue" in v) {
        const vals = Array.isArray(v.arrayValue?.values) ? v.arrayValue.values : [];
        return vals.map(decodeFilterVal);
      }
      return v;
    }

    function readFieldPath(obj, fieldPath) {
      const parts = String(fieldPath || "").split(".");
      let cur = obj;
      for (const part of parts) {
        if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
        cur = cur[part];
      }
      return cur;
    }

    function matchesFieldFilter(doc, filter) {
      const ff = filter?.fieldFilter;
      if (!ff) return true;
      const fieldPath = ff.field?.fieldPath;
      const op = ff.op;
      const expected = decodeFilterVal(ff.value);
      const actual = readFieldPath(doc, fieldPath);
      if (op === "EQUAL") return actual === expected;
      if (op === "NOT_EQUAL") return actual !== expected;
      if (op === "IN") return Array.isArray(expected) && expected.includes(actual);
      if (op === "NOT_IN") return Array.isArray(expected) && !expected.includes(actual);
      if (op === "ARRAY_CONTAINS") return Array.isArray(actual) && actual.includes(expected);
      if (op === "LESS_THAN") return actual < expected;
      if (op === "LESS_THAN_OR_EQUAL") return actual <= expected;
      if (op === "GREATER_THAN") return actual > expected;
      if (op === "GREATER_THAN_OR_EQUAL") return actual >= expected;
      return true;
    }

    export async function getFirestoreEventByIdServer(eventId) {
      return h.firestore.getEvent(eventId);
    }

    export async function updateFirestoreEventShortLinksServer(eventId, links) {
      const existing = h.firestore.getEvent(eventId) || { id: String(eventId) };
      const next = { ...existing, updated_at: new Date().toISOString() };
      if (links?.liveShortURL) {
        next.short_url = links.liveShortURL;
        next.live_short_url = links.liveShortURL;
      }
      if (links?.liveShortPath) {
        next.live_short_path = links.liveShortPath;
      }
      if (links?.bevyShortURL) {
        next.bevy_short_url = links.bevyShortURL;
      }
      if (links?.bevyShortPath) {
        next.bevy_short_path = links.bevyShortPath;
      }
      h.firestore.events.set(String(eventId), next);
    }

    export async function getFirestoreDoc(collectionName, docId) {
      const colDoc = h.firestore.getDoc(collectionName, docId);
      if (colDoc !== null) return colDoc;
      if (collectionName === "events") return h.firestore.getEvent(docId);
      return null;
    }

    export async function patchFirestoreDocDetailed(collectionName, docId, data, merge = true) {
      const existing = (await getFirestoreDoc(collectionName, docId)) ?? null;
      const next = merge && existing ? { ...existing, ...structuredClone(data) } : structuredClone(data);
      h.firestore.seedDoc(collectionName, docId, next);
      if (collectionName === "events") {
        h.firestore.seedEvent(docId, { id: String(docId), ...next });
      }
      return { ok: true, status: 200 };
    }

    export async function patchFirestoreDoc(collectionName, docId, data, merge = true) {
      const res = await patchFirestoreDocDetailed(collectionName, docId, data, merge);
      return res.ok;
    }

    export async function deleteFirestoreDoc(collectionName, docId) {
      const col = h.firestore.collections.get(collectionName);
      if (col) {
        col.delete(String(docId));
      }
      if (collectionName === "events") {
        h.firestore.events.delete(String(docId));
      }
      return true;
    }

    export async function queryFirestoreDocs(collectionId, filters, limit, _token, options) {
      const merged = new Map();
      if (collectionId === "events") {
        for (const [id, doc] of h.firestore.events.entries()) {
          merged.set(id, doc);
        }
      }
      const col = h.firestore.collections.get(collectionId);
      if (col) {
        for (const [id, doc] of col.entries()) {
          merged.set(id, doc);
        }
      }
      const results = [];
      for (const [id, rawDoc] of merged.entries()) {
        const doc = { id, ...structuredClone(rawDoc) };
        if (Array.isArray(filters) && filters.length > 0) {
          if (!filters.every((f) => matchesFieldFilter(doc, f))) continue;
        }
        results.push(doc);
      }
      const offset = typeof options?.offset === "number" && options.offset > 0 ? options.offset : 0;
      const sliced = offset > 0 ? results.slice(offset) : results;
      return typeof limit === "number" && limit > 0 ? sliced.slice(0, limit) : sliced;
    }
  `,
  "stub:bevy-client": `
    const h = globalThis[Symbol.for("gdgjakarta.shortlink.e2e.harnessState")];
    export async function updateBevyEvent(eventId, patch) {
      const entry = { eventId: String(eventId), patch: structuredClone(patch) };
      h.bevy.updates.push(entry);
      return { success: true, data: { id: String(eventId), ...structuredClone(patch) } };
    }
    export async function createBevyPerson(_eventId, person) {
      return {
        success: true,
        data: {
          id: 9001,
          first_name: person?.first_name ?? "",
          last_name: person?.last_name ?? "",
          title: person?.title ?? "",
          bio: person?.bio ?? "",
          picture: person?.picture ?? "",
          ...structuredClone(person ?? {}),
        },
      };
    }
    export async function updateBevyPerson(personId, _eventId, person) {
      return {
        success: true,
        data: {
          id: Number(personId) || 9001,
          first_name: person?.first_name ?? "",
          last_name: person?.last_name ?? "",
          title: person?.title ?? "",
          bio: person?.bio ?? "",
          picture: person?.picture ?? "",
          ...structuredClone(person ?? {}),
        },
      };
    }
    export async function getBevyPerson(personId, _eventId) {
      return {
        success: true,
        data: {
          id: Number(personId) || 9001,
          first_name: "Test",
          last_name: "Speaker",
          title: "Speaker",
          bio: "",
          picture: "",
        },
      };
    }
    export async function uploadBevyImage(_file, _eventId, container = "events") {
      return {
        success: true,
        data: {
          url: "https://assets.gdgjakarta.org/mock-bevy-image.png",
          path: \`\${container}/mock-bevy-image.png\`,
        },
      };
    }
  `,
};

const SPECIFIER_TO_STUB = new Map([
  ["@opennextjs/cloudflare", "stub:opennext-cloudflare"],
  ["next/headers", "stub:next-headers"],
  ["next/cache", "stub:next-cache"],
  ["next/server", "stub:next-server"],
  ["@/server/auth-guard", "stub:auth-guard"],
  ["@/server/firestore-admin", "stub:firestore-admin"],
  ["@/lib/bevy/client", "stub:bevy-client"],
]);

const RELATIVE_STUB_PATHS = new Map([
  [path.join(SRC_ROOT, "server/auth-guard"), "stub:auth-guard"],
  [path.join(SRC_ROOT, "server/firestore-admin"), "stub:firestore-admin"],
  [path.join(SRC_ROOT, "lib/bevy/client"), "stub:bevy-client"],
]);

function resolveTsOrJsFile(basePath) {
  for (const suffix of ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx", "/index.mjs", "/index.js"]) {
    const candidate = `${basePath}${suffix}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

function matchStubByResolvedBase(resolvedBase) {
  const normalized = resolvedBase.replace(/\.(ts|tsx|mjs|js)$/, "");
  return RELATIVE_STUB_PATHS.get(normalized) ?? null;
}

export function installShortlinkHooks() {
  installFetchTripwire();

  if (globalThis[HOOKS_INSTALLED_KEY]) {
    return false;
  }

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (SPECIFIER_TO_STUB.has(specifier)) {
        return { url: SPECIFIER_TO_STUB.get(specifier), shortCircuit: true };
      }

      if (specifier.startsWith("@/")) {
        const target = path.join(SRC_ROOT, specifier.slice(2));
        const stub = matchStubByResolvedBase(target);
        if (stub) {
          return { url: stub, shortCircuit: true };
        }
        const resolvedUrl = resolveTsOrJsFile(target);
        if (resolvedUrl) {
          return { url: resolvedUrl, shortCircuit: true };
        }
      }

      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        context.parentURL &&
        context.parentURL.startsWith("file://")
      ) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        if (parentDir.startsWith(REPO_ROOT)) {
          const target = path.resolve(parentDir, specifier);
          const stub = matchStubByResolvedBase(target);
          if (stub) {
            return { url: stub, shortCircuit: true };
          }
          const resolvedUrl = resolveTsOrJsFile(target);
          if (resolvedUrl) {
            return { url: resolvedUrl, shortCircuit: true };
          }
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

  globalThis[HOOKS_INSTALLED_KEY] = true;
  return true;
}

// ============================================================================
// Cookie-Jar & Edge Request Helpers
// ============================================================================
export function formatCookieHeader(cookies) {
  if (!cookies) return "";
  if (typeof cookies === "string") return cookies;
  if (Array.isArray(cookies)) {
    return cookies
      .filter((item) => item?.name)
      .map((item) => `${item.name}=${item.value ?? ""}`)
      .join("; ");
  }
  return Object.entries(cookies)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([name, value]) => `${name}=${String(value)}`)
    .join("; ");
}

function extractSetCookieStrings(responseOrHeaders) {
  if (!responseOrHeaders) return [];
  if (typeof responseOrHeaders === "string") return [responseOrHeaders];
  if (Array.isArray(responseOrHeaders)) return responseOrHeaders.filter((item) => typeof item === "string");

  const headers =
    responseOrHeaders &&
    typeof responseOrHeaders === "object" &&
    "headers" in responseOrHeaders &&
    responseOrHeaders.headers
      ? responseOrHeaders.headers
      : responseOrHeaders;
  if (typeof headers?.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = typeof headers?.get === "function" ? headers.get("set-cookie") : null;
  return single ? [single] : [];
}

export function parseSetCookie(responseOrHeaders) {
  const rawList = extractSetCookieStrings(responseOrHeaders);
  return rawList
    .map((raw) => {
      const segments = raw.split(";").map((part) => part.trim());
      const [nameValue, ...attrs] = segments;
      if (!nameValue) return null;
      const eqIdx = nameValue.indexOf("=");
      if (eqIdx <= 0) return null;

      const parsed = {
        name: nameValue.slice(0, eqIdx).trim(),
        value: nameValue.slice(eqIdx + 1).trim(),
        httpOnly: false,
        secure: false,
        raw,
      };

      for (const attr of attrs) {
        const attrEq = attr.indexOf("=");
        const key = (attrEq === -1 ? attr : attr.slice(0, attrEq)).trim().toLowerCase();
        const val = attrEq === -1 ? "" : attr.slice(attrEq + 1).trim();
        if (key === "path") parsed.path = val;
        else if (key === "domain") parsed.domain = val;
        else if (key === "expires") parsed.expires = val;
        else if (key === "max-age") parsed.maxAge = Number(val);
        else if (key === "httponly") parsed.httpOnly = true;
        else if (key === "secure") parsed.secure = true;
        else if (key === "samesite") parsed.sameSite = val;
      }

      return parsed;
    })
    .filter(Boolean);
}

export function parseSetCookieMap(responseOrHeaders) {
  const map = {};
  for (const cookie of parseSetCookie(responseOrHeaders)) {
    map[cookie.name] = cookie.value;
  }
  return map;
}

export async function fetchEdgeWithMf(mf, pathOrUrl, options = {}) {
  const { method = "GET", headers, body, cf, redirect = "manual", cookies } = options;
  const targetUrl = /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : new URL(pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`, "https://gdgjakarta.org").toString();

  const mergedHeaders = new Headers(headers || {});
  const cookieHeader = formatCookieHeader(cookies);
  if (cookieHeader) {
    const existing = mergedHeaders.get("cookie");
    mergedHeaders.set("cookie", existing ? `${existing}; ${cookieHeader}` : cookieHeader);
  }

  const init = {
    method,
    headers: mergedHeaders,
    redirect,
  };
  if (body !== undefined) {
    if (typeof FormData !== "undefined" && body instanceof FormData && !mergedHeaders.has("content-type")) {
      const formReq = new Request(targetUrl, { method, body });
      const contentType = formReq.headers.get("content-type");
      if (contentType) {
        mergedHeaders.set("content-type", contentType);
      }
      init.body = await formReq.arrayBuffer();
    } else {
      init.body = body;
    }
  }
  if (cf !== undefined) {
    init.cf = cf;
  }

  return mf.dispatchFetch(targetUrl, init);
}

// ============================================================================
// Deterministic Polling Helpers for ctx.waitUntil()
// ============================================================================
export async function waitForCondition(fn, { timeoutMs = 2000, intervalMs = 15 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() <= deadline) {
    try {
      const value = await fn();
      if (value) {
        return value;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  const suffix = lastError instanceof Error ? ` (last error: ${lastError.message})` : "";
  throw new Error(`waitForCondition timed out after ${timeoutMs}ms${suffix}`);
}

export async function waitForClickCount(db, linkId, expectedCount, opts = {}) {
  return waitForCondition(async () => {
    const row = await db
      .prepare("SELECT COUNT(*) AS count FROM short_link_clicks WHERE link_id = ?")
      .bind(linkId)
      .first();
    const count = Number(row?.count ?? 0);
    return count >= expectedCount ? count : false;
  }, opts);
}

// ============================================================================
// Direct D1 & KV Seeding / Inspection Helpers
// ============================================================================
function toJsonString(value, fallback) {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return fallback;
  return JSON.stringify(value);
}

function toSqlIntFlag(value, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  return value ? 1 : 0;
}

export async function seedDomain(db, domain = {}) {
  const now = new Date().toISOString();
  const id = Number(domain.id ?? 1516440);
  const hostname = String(domain.hostname ?? "gdgjakarta.org")
    .trim()
    .toLowerCase();
  const state = String(domain.state ?? "configured");
  const linkType = String(domain.linkType ?? domain.link_type ?? "custom");
  const aasa =
    domain.appleAppSiteAssociation !== undefined
      ? domain.appleAppSiteAssociation
      : (domain.apple_app_site_association ?? null);
  const assetLinks = domain.assetLinks !== undefined ? domain.assetLinks : (domain.asset_links ?? null);
  const createdAt = domain.createdAt ?? domain.created_at ?? now;
  const updatedAt = domain.updatedAt ?? domain.updated_at ?? now;

  await db
    .prepare(
      `INSERT OR REPLACE INTO short_domains (
        id, hostname, state, link_type, apple_app_site_association, asset_links, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      hostname,
      state,
      linkType,
      aasa !== null && typeof aasa !== "string" ? JSON.stringify(aasa) : aasa,
      assetLinks !== null && typeof assetLinks !== "string" ? JSON.stringify(assetLinks) : assetLinks,
      createdAt,
      updatedAt,
    )
    .run();

  return { id, hostname, state, link_type: linkType };
}

export async function seedFolder(db, folder = {}) {
  const now = new Date().toISOString();
  const id = String(folder.id ?? `fld_${crypto.randomBytes(4).toString("hex")}`);
  const domainId = Number(folder.domainId ?? folder.domain_id ?? 1516440);
  const name = String(folder.name ?? "General");
  const color = String(folder.color ?? "#0693E3");
  const icon = folder.icon ?? null;
  const createdAt = folder.createdAt ?? folder.created_at ?? now;
  const updatedAt = folder.updatedAt ?? folder.updated_at ?? now;

  await db
    .prepare(
      `INSERT OR REPLACE INTO short_folders (
        id, domain_id, name, color, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, domainId, name, color, icon, createdAt, updatedAt)
    .run();

  return { id, domain_id: domainId, name, color, icon };
}

export async function seedLink(db, link = {}) {
  const now = new Date().toISOString();
  const id = String(link.id ?? `lnk_${crypto.randomBytes(6).toString("hex")}`);
  const domainId = Number(link.domainId ?? link.domain_id ?? 1516440);
  const hostname = String(link.hostname ?? "gdgjakarta.org")
    .trim()
    .toLowerCase();
  const pathSlug = String(link.path ?? `slug-${crypto.randomBytes(3).toString("hex")}`)
    .trim()
    .replace(/^\/+/, "");
  const originalUrl = String(link.originalURL ?? link.original_url ?? "https://gdgjakarta.com");
  const title = link.title ?? null;
  const tagsJson = toJsonString(link.tags ?? link.tags_json, "[]");
  const folderId = link.folderId !== undefined ? link.folderId : (link.folder_id ?? null);
  const archived = toSqlIntFlag(link.archived, 0);
  const redirectType = Number(link.redirectType ?? link.redirect_type ?? 302);
  const expiresAt = link.expiresAt !== undefined ? link.expiresAt : (link.expires_at ?? null);
  const expiredUrl = link.expiredURL !== undefined ? link.expiredURL : (link.expired_url ?? null);
  const passwordHash = link.passwordHash !== undefined ? link.passwordHash : (link.password_hash ?? null);
  const explicitHasPassword = link.hasPassword ?? link.has_password;
  let hasPassword = passwordHash ? 1 : 0;
  if (explicitHasPassword !== undefined) {
    hasPassword = toSqlIntFlag(explicitHasPassword, 0);
  }
  const cloaking = toSqlIntFlag(link.cloaking, 0);
  const androidUrl = link.androidURL !== undefined ? link.androidURL : (link.android_url ?? null);
  const iphoneUrl = link.iphoneURL !== undefined ? link.iphoneURL : (link.iphone_url ?? null);
  const geoTargetsJson = toJsonString(link.geoTargets ?? link.geo_targets_json, "[]");
  const utmParamsJson =
    link.utmParams !== undefined || link.utm_params_json !== undefined
      ? toJsonString(link.utmParams ?? link.utm_params_json, null)
      : null;
  const pixelsJson =
    link.pixels !== undefined || link.pixels_json !== undefined
      ? toJsonString(link.pixels ?? link.pixels_json, null)
      : null;
  const maxClicks = link.maxClicks !== undefined ? link.maxClicks : (link.max_clicks ?? null);
  const clicksCount = Number(link.clicksCount ?? link.clicks_count ?? 0);
  const legacyClicks = Number(link.legacyClicks ?? link.legacy_clicks ?? 0);
  const linkType = String(link.linkType ?? link.link_type ?? "redirect");
  const splitTargetsJson = toJsonString(link.splitTargets ?? link.split_targets_json, "[]");
  const bundleItemsJson = toJsonString(link.bundleItems ?? link.bundle_items_json, "[]");
  const ownerId = link.ownerId !== undefined ? link.ownerId : (link.owner_id ?? null);
  const ownerEmail = link.ownerEmail !== undefined ? link.ownerEmail : (link.owner_email ?? null);
  const createdAt = link.createdAt ?? link.created_at ?? now;
  const updatedAt = link.updatedAt ?? link.updated_at ?? now;

  await db
    .prepare(
      `INSERT OR REPLACE INTO short_links (
        id, domain_id, hostname, path, original_url, title, tags_json, folder_id,
        archived, redirect_type, expires_at, expired_url, password_hash, has_password,
        cloaking, android_url, iphone_url, geo_targets_json, utm_params_json,
        pixels_json, max_clicks, clicks_count, legacy_clicks, link_type,
        split_targets_json, bundle_items_json, owner_id, owner_email, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      domainId,
      hostname,
      pathSlug,
      originalUrl,
      title,
      tagsJson,
      folderId,
      archived,
      redirectType,
      expiresAt,
      expiredUrl,
      passwordHash,
      hasPassword,
      cloaking,
      androidUrl,
      iphoneUrl,
      geoTargetsJson,
      utmParamsJson,
      pixelsJson,
      maxClicks,
      clicksCount,
      legacyClicks,
      linkType,
      splitTargetsJson,
      bundleItemsJson,
      ownerId,
      ownerEmail,
      createdAt,
      updatedAt,
    )
    .run();

  return { id, domain_id: domainId, hostname, path: pathSlug, original_url: originalUrl };
}

export async function seedClick(db, click = {}) {
  const id = String(click.id ?? `clk_${crypto.randomBytes(6).toString("hex")}`);
  const linkId = String(click.linkId ?? click.link_id ?? "");
  const hostname = String(click.hostname ?? "gdgjakarta.org")
    .trim()
    .toLowerCase();
  const pathSlug = String(click.path ?? "")
    .trim()
    .replace(/^\/+/, "");
  const clickedAt = Number(click.clickedAt ?? click.clicked_at ?? Date.now());
  const country = click.country ?? null;
  const city = click.city ?? null;
  const browser = click.browser ?? null;
  const osName = click.os ?? null;
  const device = click.device ?? null;
  const referer = click.referer ?? null;
  const isBot = toSqlIntFlag(click.isBot ?? click.is_bot, 0);
  const variantLabel = click.variantLabel ?? click.variant_label ?? null;
  const targetUrl = click.targetUrl ?? click.target_url ?? null;

  await db
    .prepare(
      `INSERT OR REPLACE INTO short_link_clicks (
        id, link_id, hostname, path, clicked_at, country, city, browser, os, device, referer, is_bot, variant_label, target_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      linkId,
      hostname,
      pathSlug,
      clickedAt,
      country,
      city,
      browser,
      osName,
      device,
      referer,
      isBot,
      variantLabel,
      targetUrl,
    )
    .run();

  return { id, link_id: linkId, clicked_at: clickedAt };
}

export async function getClickRows(db, linkId) {
  if (linkId) {
    const res = await db
      .prepare("SELECT * FROM short_link_clicks WHERE link_id = ? ORDER BY clicked_at ASC, id ASC")
      .bind(linkId)
      .all();
    return res.results ?? [];
  }
  const res = await db.prepare("SELECT * FROM short_link_clicks ORDER BY clicked_at ASC, id ASC").all();
  return res.results ?? [];
}

export async function getLinkRow(db, idOrKey) {
  if (typeof idOrKey === "string") {
    return (await db.prepare("SELECT * FROM short_links WHERE id = ?").bind(idOrKey).first()) ?? null;
  }
  const hostname = String(idOrKey?.hostname ?? "gdgjakarta.org")
    .trim()
    .toLowerCase();
  const pathSlug = String(idOrKey?.path ?? "")
    .trim()
    .replace(/^\/+/, "");
  return (
    (await db.prepare("SELECT * FROM short_links WHERE hostname = ? AND path = ?").bind(hostname, pathSlug).first()) ??
    null
  );
}

export async function getKvValue(kv, key, type = "json") {
  return kv.get(key, type);
}

export async function putKvValue(kv, key, value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  await kv.put(key, serialized);
}

// ============================================================================
// Miniflare 5 Worker Harness Boot, Reset & Dispose
// ============================================================================
function buildMiniflareTextEnv(envInput) {
  const merged = { ...DEFAULT_TEST_ENV, ...envInput };
  const bindings = {
    SHORTLINKS_DB: { type: "d1", id: "shortlinks-db-e2e" },
    SHORTLINKS_KV: { type: "kv", id: "shortlinks-kv-e2e" },
  };
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== null) {
      bindings[key] = { type: "text", value: String(value) };
    }
  }
  return { bindings, mergedEnv: merged };
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (!inSingleQuote && ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        i += 1;
      }
      continue;
    }

    if (!inSingleQuote && ch === "/" && next === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) {
        i += 1;
      }
      if (i < sql.length) {
        i += 2;
      }
      if (current && !/\s$/.test(current)) {
        current += " ";
      }
      continue;
    }

    if (ch === "'") {
      current += ch;
      if (inSingleQuote && next === "'") {
        current += next;
        i += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      i += 1;
      continue;
    }

    if (!inSingleQuote && ch === ";") {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = "";
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }
  return statements;
}

async function applySqlMigration(db, sql) {
  const statements = splitSqlStatements(sql);
  for (const stmt of statements) {
    await db.prepare(stmt).run();
  }
}

async function clearD1Tables(db) {
  const tablesResult = await db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name IN ('short_link_clicks', 'short_links', 'short_folders', 'short_domains')`,
    )
    .all();
  const existing = new Set((tablesResult.results ?? []).map((row) => row.name));
  const deleteOrder = ["short_link_clicks", "short_links", "short_folders", "short_domains"];
  for (const tableName of deleteOrder) {
    if (existing.has(tableName)) {
      await db.prepare(`DELETE FROM ${tableName}`).run();
    }
  }
}

async function clearKvNamespace(kv) {
  let cursor;
  do {
    const listed = await kv.list(cursor ? { cursor } : undefined);
    for (const entry of listed.keys ?? []) {
      await kv.delete(entry.name);
    }
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);
}

export async function bootWorkerHarness({
  workerEntryPath,
  workerTsSource,
  migrationSql,
  migrationSqlPath,
  env = {},
  outboundHandler,
  name = "shortlink-worker-e2e",
  skipMigration = false,
} = {}) {
  const bootEnvSnapshot = normalizeBootEnvOverrides(env);
  const { Miniflare, Log, LogLevel } = await getMiniflarePkg();
  const bundledCode = await bundleWorkerTs({ workerEntryPath, workerTsSource });
  const { bindings, mergedEnv } = buildMiniflareTextEnv(bootEnvSnapshot);

  const workerDef = {
    config: {
      name,
      compatibilityDate: "2024-12-30",
      compatibilityFlags: ["nodejs_compat"],
      manifest: {
        mainModule: "index.mjs",
        modules: {
          "index.mjs": { type: "esm", contents: bundledCode },
        },
      },
      env: bindings,
    },
  };

  if (outboundHandler) {
    workerDef.dev = {
      outboundService: {
        type: "fetcher",
        handler: outboundHandler,
      },
    };
  }

  const mf = new Miniflare({
    log: new Log(LogLevel.WARN),
    workers: [workerDef],
  });

  let db;
  let kv;
  let disposed = false;

  try {
    db = await mf.getD1Database("SHORTLINKS_DB");
    kv = await mf.getKVNamespace("SHORTLINKS_KV");

    if (!skipMigration) {
      let sqlToExec = migrationSql;
      if (!sqlToExec && migrationSqlPath && fs.existsSync(migrationSqlPath)) {
        sqlToExec = fs.readFileSync(migrationSqlPath, "utf8");
      }
      if (!sqlToExec && fs.existsSync(DEFAULT_MIGRATION_SQL_PATH)) {
        sqlToExec = fs.readFileSync(DEFAULT_MIGRATION_SQL_PATH, "utf8");
      }
      if (sqlToExec) {
        await applySqlMigration(db, sqlToExec);
      }
    }

    const activate = () => {
      harnessState.setActiveBindings({
        SHORTLINKS_DB: db,
        SHORTLINKS_KV: kv,
        envOverrides: bootEnvSnapshot,
      });
    };

    activate();

    const resetState = async () => {
      await clearD1Tables(db);
      await clearKvNamespace(kv);
      harnessState.resetBridgeState();
    };

    const dispose = async () => {
      if (disposed) return;
      disposed = true;
      try {
        await mf.dispose();
      } finally {
        const active = harnessState.getActiveBindings();
        if (active.SHORTLINKS_DB === db) {
          harnessState.setActiveBindings({ SHORTLINKS_DB: null, SHORTLINKS_KV: null, envOverrides: {} });
        }
      }
    };

    return {
      mf,
      db,
      kv,
      env: mergedEnv,
      activate,
      fetchEdge: (pathOrUrl, init) => fetchEdgeWithMf(mf, pathOrUrl, init),
      resetState,
      dispose,
      waitForCondition,
      waitForClickCount: (linkId, expectedCount, opts) => waitForClickCount(db, linkId, expectedCount, opts),
      seedDomain: (domain) => seedDomain(db, domain),
      seedFolder: (folder) => seedFolder(db, folder),
      seedLink: (link) => seedLink(db, link),
      seedClick: (click) => seedClick(db, click),
      getClickRows: (linkId) => getClickRows(db, linkId),
      getLinkRow: (idOrKey) => getLinkRow(db, idOrKey),
      getKvValue: (key, type) => getKvValue(kv, key, type),
      putKvValue: (key, value) => putKvValue(kv, key, value),
    };
  } catch (err) {
    try {
      await mf.dispose();
    } catch (disposeErr) {
      console.warn("[shortlink-e2e] Failed to dispose Miniflare after boot error:", disposeErr);
    }
    throw err;
  }
}

export async function bootShortlinkHarness(options = {}) {
  const entryPath = options.workerEntryPath ? path.resolve(options.workerEntryPath) : DEFAULT_WORKER_ENTRY_PATH;
  if (!options.workerTsSource && !fs.existsSync(entryPath)) {
    const err = new Error(`Shortlink worker entrypoint not found: ${entryPath}`);
    err.code = "ERR_SHORTLINK_TARGET_MISSING";
    throw err;
  }

  return bootWorkerHarness({
    ...options,
    workerEntryPath: options.workerTsSource ? undefined : entryPath,
    migrationSqlPath: options.migrationSqlPath ?? DEFAULT_MIGRATION_SQL_PATH,
  });
}

// ============================================================================
// Opaque-Box Migration CLI Runner (Zero-Network Child Process + Loopback Fake Short.io)
// ============================================================================
function buildCliPreloadSource(port) {
  return `
const ORIGIN = "http://127.0.0.1:${port}";
const REAL_FETCH = globalThis.fetch.bind(globalThis);

function isLoopback(hostname) {
  const h = hostname.toLowerCase();
  return h === "127.0.0.1" || h === "localhost" || h === "::1" || h === "[::1]";
}

globalThis.fetch = async function cliZeroNetworkFetch(input, init) {
  const req = input instanceof Request ? input : null;
  const rawUrl = req ? req.url : String(input instanceof URL ? input.href : input);
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("CLI zero-network violation: invalid/relative fetch URL " + rawUrl);
  }

  const protocol = parsed.protocol.toLowerCase();
  const isHttp = protocol === "http:" || protocol === "https:";
  const host = parsed.hostname.toLowerCase();
  if (isHttp && (host === "api.short.io" || host === "statistics.short.io")) {
    const targetUrl = ORIGIN + "/__shortio/" + host + parsed.pathname + parsed.search;
    if (req) {
      const clonedInit = {
        method: req.method,
        headers: req.headers,
        redirect: req.redirect,
      };
      if (req.method !== "GET" && req.method !== "HEAD") {
        clonedInit.body = await req.clone().text();
      }
      return REAL_FETCH(targetUrl, clonedInit);
    }
    return REAL_FETCH(targetUrl, init);
  }

  if (isHttp && isLoopback(host)) {
    return REAL_FETCH(input, init);
  }

  throw new Error("CLI zero-network violation: live fetch blocked for " + parsed.toString());
};
`;
}

export async function runMigrationCli({
  args = [],
  env = {},
  shortioFixtures,
  scriptPath = DEFAULT_MIGRATION_SCRIPT_PATH,
  timeoutMs = 15_000,
  extraHandler,
} = {}) {
  const resolvedScript = path.resolve(scriptPath);
  if (!fs.existsSync(resolvedScript)) {
    const err = new Error(`Migration script not found: ${resolvedScript}`);
    err.code = "ERR_MIGRATION_SCRIPT_MISSING";
    throw err;
  }

  const store = createFakeShortioStore();
  if (shortioFixtures) {
    store.seed(shortioFixtures);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const reqUrl = req.url || "/";
      const shortioMatch = reqUrl.match(/^\/__shortio\/(api\.short\.io|statistics\.short\.io)(\/.*)?$/);

      let response;
      if (shortioMatch) {
        const targetHost = shortioMatch[1];
        const targetPath = shortioMatch[2] || "/";
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === "string") headers.set(k, v);
          else if (Array.isArray(v)) headers.set(k, v.join(", "));
        }
        response = await store.handleRequest(
          `https://${targetHost}${targetPath}`,
          req.method || "GET",
          headers,
          rawBody,
        );
      } else if (extraHandler) {
        response = await extraHandler(req, rawBody);
      } else {
        response = new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }

      res.statusCode = response.status;
      for (const [k, v] of response.headers.entries()) {
        res.setHeader(k, v);
      }
      const text = await response.text();
      res.end(text);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gdg-shortlink-cli-"));
  const preloadPath = path.join(tmpDir, "preload.mjs");

  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    fs.writeFileSync(preloadPath, buildCliPreloadSource(port), "utf8");
    const preloadUrl = pathToFileURL(preloadPath).href;

    const childEnv = {
      ...process.env,
      SHORTIO_API_KEY: DEFAULT_TEST_ENV.SHORTIO_API_KEY,
      SHORTIO_DOMAIN: DEFAULT_TEST_ENV.SHORTIO_DOMAIN,
      SHORTIO_DOMAIN_ID: DEFAULT_TEST_ENV.SHORTIO_DOMAIN_ID,
      ...env,
    };

    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", preloadUrl, resolvedScript, ...args], {
        cwd: REPO_ROOT,
        env: childEnv,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(new Error(`runMigrationCli timed out after ${timeoutMs}ms\nstdout:\n${stdout}\nstderr:\n${stderr}`));
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          code: code ?? 1,
          exitCode: code ?? 1,
          signal,
          stdout,
          stderr,
          requests: store.requests,
          fakeShortioState: store.getState(),
        });
      });
    });

    return result;
  } finally {
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
