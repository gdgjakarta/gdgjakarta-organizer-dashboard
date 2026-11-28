#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_SHORTIO_API_BASE = "https://api.short.io";
const DEFAULT_SHORTIO_STATS_BASE = "https://statistics.short.io";
const DEFAULT_DOMAIN = "gdgjakarta.org";
const DEFAULT_DOMAIN_ID = 1516440;
const VALID_REDIRECT_CODES = new Set([301, 302, 307, 308]);
const STATS_BATCH_SIZE = 50;

export function normalizeHostname(hostname) {
  return String(hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");
}

export function normalizeSlugPath(slugPath) {
  return String(slugPath ?? "")
    .trim()
    .replace(/^\/+/, "");
}

export function buildLinkKvKey(hostname, slugPath) {
  return `${normalizeHostname(hostname)}:${normalizeSlugPath(slugPath)}`;
}

export function buildDomainKvKey(hostname) {
  return `${normalizeHostname(hostname)}:__domain__`;
}

export function isEntrypoint(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) {
    return false;
  }
  try {
    const modulePath = realpathSync(fileURLToPath(metaUrl));
    const entryPath = realpathSync(resolve(argv1));
    return modulePath === entryPath;
  } catch {
    return false;
  }
}

export function formatUsage() {
  return `Usage: node scripts/migrate-shortio-to-d1.mjs [options]

Exports Short.io domains, folders, active/archived links, and historical click totals
to a local JSON backup, generates idempotent D1 SQL + Workers KV bulk JSON + migration
report, and optionally executes Wrangler against local (default) or remote D1/KV.

Options:
  --dry-run                   Preview migration & write requested output files without running Wrangler (default)
  --from-backup <file>        Load Short.io backup JSON offline (zero network calls)
  --archived-csv <file>       Merge Short.io Dashboard CSV export (captures archived links omitted by API)
  --backup <file>             Write Short.io JSON backup to <file> (default: shortio-backup-<timestamp>.json on API export)
  --out-sql <file>            Write idempotent D1 SQL statements to <file>
  --out-kv <file>             Write Wrangler KV bulk JSON array ([{ key, value }]) to <file>
  --out-report <file>         Write JSON migration report (including flaggedPasswordLinks) to <file>
  --apply-d1                  Execute generated SQL against D1 via Wrangler (requires --remote for production)
  --apply-kv                  Upload generated KV bulk payload via Wrangler (requires --remote for production)
  --local                     Target local Wrangler state (default)
  --remote                    Target remote Cloudflare D1/KV (only used with --apply-d1 / --apply-kv)
  --config <file>             Wrangler config file (default: wrangler.jsonc)
  --db <name>                 D1 database name/binding (default: gdgjakarta-shortlinks)
  --kv-binding <name>         KV namespace binding name (default: SHORTLINKS_KV)
  --kv-namespace-id <id>      Explicit KV namespace ID (overrides --kv-binding when applying)
  --domain <host>             Short.io hostname filter/fallback (default: env SHORTIO_DOMAIN or gdgjakarta.org)
  --domain-id <num>           Short.io numeric domain ID filter/fallback (default: env SHORTIO_DOMAIN_ID or 1516440)
  --fetch-geo                 Fetch per-link country geo-targeting rules via GET /link_country/{linkId}
  -h, --help                  Show this help message
`;
}

export function parseCliArgs(argv, env = process.env) {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      "dry-run": { type: "boolean", default: false },
      "from-backup": { type: "string" },
      "archived-csv": { type: "string" },
      backup: { type: "string" },
      "out-sql": { type: "string" },
      "out-kv": { type: "string" },
      "out-report": { type: "string" },
      "apply-d1": { type: "boolean", default: false },
      "apply-kv": { type: "boolean", default: false },
      local: { type: "boolean", default: false },
      remote: { type: "boolean", default: false },
      config: { type: "string", default: "wrangler.jsonc" },
      db: { type: "string", default: "gdgjakarta-shortlinks" },
      "kv-binding": { type: "string", default: "SHORTLINKS_KV" },
      "kv-namespace-id": { type: "string" },
      domain: { type: "string" },
      "domain-id": { type: "string" },
      "fetch-geo": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.local && values.remote) {
    throw new Error("Cannot pass both --local and --remote.");
  }

  const rawDomainId = values["domain-id"] || env.SHORTIO_DOMAIN_ID || String(DEFAULT_DOMAIN_ID);
  const parsedDomainId = Number(rawDomainId);
  if (!Number.isFinite(parsedDomainId) || parsedDomainId <= 0) {
    throw new Error(`Invalid --domain-id value: ${rawDomainId}`);
  }

  const domain = normalizeHostname(values.domain || env.SHORTIO_DOMAIN || DEFAULT_DOMAIN) || DEFAULT_DOMAIN;

  return {
    dryRun: Boolean(values["dry-run"]) || (!values["apply-d1"] && !values["apply-kv"]),
    explicitDryRun: Boolean(values["dry-run"]),
    fromBackup: values["from-backup"] ?? null,
    archivedCsv: values["archived-csv"] ?? null,
    backup: values.backup ?? null,
    outSql: values["out-sql"] ?? null,
    outKv: values["out-kv"] ?? null,
    outReport: values["out-report"] ?? null,
    applyD1: Boolean(values["apply-d1"]),
    applyKv: Boolean(values["apply-kv"]),
    remote: Boolean(values.remote),
    config: values.config,
    db: values.db,
    kvBinding: values["kv-binding"],
    kvNamespaceId: values["kv-namespace-id"] ?? null,
    domain,
    domainExplicit: values.domain !== undefined || values["domain-id"] !== undefined,
    domainId: Math.trunc(parsedDomainId),
    fetchGeo: Boolean(values["fetch-geo"]),
    help: Boolean(values.help),
  };
}

function deterministicId(prefix, seed) {
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  return `${prefix}${digest}`;
}

function normalizeIsoTimestamp(value, fallbackIso) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  if (typeof value === "string" && value.trim() !== "") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      return normalizeIsoTimestamp(Number(trimmed), fallbackIso);
    }
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return fallbackIso;
}

function firstValidIsoTimestamp(candidates, fallbackIso) {
  for (const candidate of candidates) {
    const resolved = normalizeIsoTimestamp(candidate, null);
    if (resolved !== null) {
      return resolved;
    }
  }
  return fallbackIso;
}

function normalizeJsonText(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  const str = String(value).trim();
  return str === "" ? null : str;
}

function normalizeEpochMs(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    return value < 1e12 ? Math.trunc(value * 1000) : Math.trunc(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return normalizeEpochMs(Number(trimmed));
    }
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

function normalizeInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  return Math.trunc(num);
}

function normalizeNonNegativeInt(value, fallback = 0) {
  const num = normalizeInteger(value);
  if (num === null || num < 0) {
    return fallback;
  }
  return num;
}

function normalizeRedirectType(value) {
  const code = normalizeInteger(value);
  if (code !== null && VALID_REDIRECT_CODES.has(code)) {
    return code;
  }
  return 302;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function parseShortUrlParts(shortUrl) {
  if (typeof shortUrl !== "string" || !shortUrl.trim()) {
    return { hostname: "", path: "" };
  }
  try {
    const parsed = new URL(shortUrl.trim());
    return {
      hostname: normalizeHostname(parsed.hostname),
      path: normalizeSlugPath(parsed.pathname),
    };
  } catch {
    const stripped = shortUrl.trim().replace(/^https?:\/\//i, "");
    const slashIdx = stripped.indexOf("/");
    if (slashIdx === -1) {
      return { hostname: normalizeHostname(stripped), path: "" };
    }
    return {
      hostname: normalizeHostname(stripped.slice(0, slashIdx)),
      path: normalizeSlugPath(stripped.slice(slashIdx + 1)),
    };
  }
}

function normalizeTags(rawTags) {
  if (Array.isArray(rawTags)) {
    return rawTags.map((tag) => String(tag ?? "").trim()).filter(Boolean);
  }
  if (typeof rawTags === "string" && rawTags.trim()) {
    const trimmed = rawTags.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((tag) => String(tag ?? "").trim()).filter(Boolean);
        }
      } catch {
        // fall back to comma splitting
      }
    }
    return trimmed
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeGeoTargets(rawGeo) {
  if (!Array.isArray(rawGeo)) {
    return [];
  }
  const rules = [];
  for (const item of rawGeo) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const country = String(item.country ?? item.countryCode ?? "")
      .trim()
      .toUpperCase();
    const url = String(item.url ?? item.originalURL ?? item.targetUrl ?? "").trim();
    const region = item.region ? String(item.region).trim() : undefined;
    if (country && url) {
      rules.push(region ? { country, url, region } : { country, url });
    }
  }
  return rules;
}

function normalizeUtmParams(link) {
  const raw = link.utmParams && typeof link.utmParams === "object" ? link.utmParams : {};
  const utm = {
    source: raw.source ?? link.utmSource ?? undefined,
    medium: raw.medium ?? link.utmMedium ?? undefined,
    campaign: raw.campaign ?? link.utmCampaign ?? undefined,
    term: raw.term ?? link.utmTerm ?? undefined,
    content: raw.content ?? link.utmContent ?? undefined,
  };
  const cleaned = {};
  for (const [key, val] of Object.entries(utm)) {
    if (typeof val === "string" && val.trim() !== "") {
      cleaned[key] = val.trim();
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function normalizePixels(link) {
  const raw = link.pixels && typeof link.pixels === "object" ? link.pixels : {};
  const pixels = {
    metaPixelId: raw.metaPixelId ?? link.integrationFB ?? undefined,
    gtmId: raw.gtmId ?? link.integrationGTM ?? undefined,
    ga4Id: raw.ga4Id ?? link.integrationGA ?? undefined,
  };
  const cleaned = {};
  for (const [key, val] of Object.entries(pixels)) {
    if (typeof val === "string" && val.trim() !== "") {
      cleaned[key] = val.trim();
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function normalizeSplitTargets(link, originalURL) {
  if (Array.isArray(link.splitTargets) && link.splitTargets.length > 0) {
    return link.splitTargets
      .filter((t) => t && typeof t === "object" && typeof t.url === "string" && t.url.trim() !== "")
      .map((t, index) => ({
        url: t.url.trim(),
        weight: normalizeNonNegativeInt(t.weight, 50),
        label: String(t.label ?? `Variant ${index + 1}`).trim() || `Variant ${index + 1}`,
      }));
  }
  if (typeof link.splitURL === "string" && link.splitURL.trim() !== "") {
    const rawPct = Number(link.splitPercent);
    const variantWeight = Number.isFinite(rawPct) ? Math.min(100, Math.max(0, Math.trunc(rawPct))) : 50;
    const controlWeight = Math.max(0, 100 - variantWeight);
    return [
      { url: originalURL, weight: controlWeight, label: "Control" },
      { url: link.splitURL.trim(), weight: variantWeight, label: "Variant B" },
    ];
  }
  return [];
}

function normalizeBundleItems(link) {
  if (!Array.isArray(link.bundleItems)) {
    return [];
  }
  return link.bundleItems
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.title === "string" &&
        item.title.trim() !== "" &&
        typeof item.url === "string" &&
        item.url.trim() !== "",
    )
    .map((item) => ({
      title: item.title.trim(),
      url: item.url.trim(),
      ...(typeof item.description === "string" && item.description.trim()
        ? { description: item.description.trim() }
        : {}),
      ...(typeof item.icon === "string" && item.icon.trim() ? { icon: item.icon.trim() } : {}),
    }));
}

export function parseCsvRows(csvText) {
  const cleanText = String(csvText ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i += 1) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      currentRow.push(currentField);
      currentField = "";
    } else if (ch === "\r") {
      if (cleanText[i + 1] === "\n") {
        i += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else if (ch === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}

export function parseShortioArchivedCsv(
  csvText,
  defaultHostname = DEFAULT_DOMAIN,
  defaultDomainId = DEFAULT_DOMAIN_ID,
) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) =>
    header
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, ""),
  );
  const hasArchivedCol = headers.includes("archived");
  const links = [];

  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    const record = {};
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c];
      if (key) {
        record[key] = row[c] !== undefined ? row[c].trim() : "";
      }
    }

    const shortUrl = record.shorturl || record.secureshorturl || "";
    const parsedUrl = parseShortUrlParts(shortUrl);
    const hostname = normalizeHostname(record.hostname || record.domain || parsedUrl.hostname || defaultHostname);
    const path = normalizeSlugPath(record.path || record.slug || parsedUrl.path);
    const originalURL = record.originalurl || record.targeturl || record.url || "";

    if (!path || !originalURL) {
      continue;
    }

    const rawId = record.idstring || record.id || record.linkid || "";
    const id = rawId || deterministicId("lnk_csv_", `${hostname}:${path}`);
    const clicks = normalizeNonNegativeInt(record.clicks || record.totalclicks || record.legacyclicks, 0);

    links.push({
      id,
      idString: id,
      DomainId: normalizeInteger(record.domainid) ?? defaultDomainId,
      hostname,
      path,
      shortURL: shortUrl || `https://${hostname}/${path}`,
      secureShortURL: shortUrl || `https://${hostname}/${path}`,
      originalURL,
      title: record.title || undefined,
      tags: normalizeTags(record.tags),
      FolderId: record.folderid || undefined,
      archived: hasArchivedCol ? normalizeBoolean(record.archived) : true,
      clicks,
      legacyClicks: clicks,
      cloaking: normalizeBoolean(record.cloaking),
      hasPassword: normalizeBoolean(record.haspassword),
      redirectType: record.redirecttype || undefined,
      expiresAt: record.expiresat || undefined,
      expiredURL: record.expiredurl || undefined,
      androidURL: record.androidurl || undefined,
      iphoneURL: record.iphoneurl || undefined,
      createdAt: record.createdat || undefined,
      updatedAt: record.updatedat || undefined,
      source: "archived-csv",
    });
  }

  return links;
}

export function mergeArchivedCsvLinks(apiLinks, csvLinks) {
  const merged = [];
  const byId = new Map();
  const byKey = new Map();

  for (const link of apiLinks) {
    const clone = structuredClone(link);
    const id = String(clone.idString || clone.id || "").trim();
    const host = normalizeHostname(clone.hostname || parseShortUrlParts(clone.shortURL).hostname || DEFAULT_DOMAIN);
    const slug = normalizeSlugPath(clone.path || parseShortUrlParts(clone.shortURL).path);
    const key = buildLinkKvKey(host, slug);
    const idx = merged.length;
    merged.push(clone);
    if (id) {
      byId.set(id, idx);
    }
    if (slug) {
      byKey.set(key, idx);
    }
  }

  for (const csvLink of csvLinks) {
    const id = String(csvLink.idString || csvLink.id || "").trim();
    const host = normalizeHostname(csvLink.hostname || DEFAULT_DOMAIN);
    const slug = normalizeSlugPath(csvLink.path);
    const key = buildLinkKvKey(host, slug);

    const existingIdx = (id ? byId.get(id) : undefined) ?? byKey.get(key);
    if (existingIdx !== undefined) {
      const existing = merged[existingIdx];
      const existingClicks = normalizeNonNegativeInt(existing.legacyClicks ?? existing.clicks, 0);
      const csvClicks = normalizeNonNegativeInt(csvLink.legacyClicks ?? csvLink.clicks, 0);
      merged[existingIdx] = {
        ...existing,
        archived: Boolean(existing.archived || csvLink.archived),
        title: existing.title || csvLink.title,
        tags: existing.tags?.length ? existing.tags : csvLink.tags,
        FolderId: existing.FolderId ?? csvLink.FolderId,
        legacyClicks: Math.max(existingClicks, csvClicks),
        clicks: Math.max(existingClicks, csvClicks),
      };
      continue;
    }

    const newIdx = merged.length;
    merged.push(structuredClone(csvLink));
    if (id) {
      byId.set(id, newIdx);
    }
    if (slug) {
      byKey.set(key, newIdx);
    }
  }

  return merged;
}

async function fetchJsonOrNull(fetchImpl, url, headers) {
  const response = await fetchImpl(url, { method: "GET", headers });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { ok: response.ok, status: response.status, body };
}

export async function exportFromShortio({
  apiKey,
  domain = DEFAULT_DOMAIN,
  domainId = DEFAULT_DOMAIN_ID,
  domainExplicit = false,
  fetchGeo = false,
  fetchImpl = fetch,
  apiBaseUrl = DEFAULT_SHORTIO_API_BASE,
  statsBaseUrl = DEFAULT_SHORTIO_STATS_BASE,
}) {
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("SHORTIO_API_KEY is required when exporting from the Short.io API.");
  }

  const headers = {
    Authorization: String(apiKey).trim(),
    Accept: "application/json",
  };
  const warnings = [];
  const normalizedTargetHost = normalizeHostname(domain);
  const targetDomainId = Math.trunc(Number(domainId));

  // 1. Export domains (paginated with limit=100&offset=<n>), with graceful fallback for domain-scoped API keys
  const rawDomains = [];
  let offset = 0;
  let domainsFallbackUsed = false;
  let hasMoreDomains = true;

  while (hasMoreDomains) {
    const res = await fetchJsonOrNull(fetchImpl, `${apiBaseUrl}/api/domains?limit=100&offset=${offset}`, headers);
    if (!res.ok) {
      if (offset === 0 && (res.status === 401 || res.status === 403 || res.status === 404)) {
        domainsFallbackUsed = true;
        warnings.push({
          code: "DOMAINS_API_FALLBACK",
          message: `GET /api/domains returned ${res.status}; falling back to configured domain ${normalizedTargetHost} (${targetDomainId}).`,
        });
        break;
      }
      throw new Error(`Short.io /api/domains failed with HTTP ${res.status}: ${JSON.stringify(res.body)}`);
    }

    let page = [];
    if (Array.isArray(res.body)) {
      page = res.body;
    } else if (Array.isArray(res.body?.domains)) {
      page = res.body.domains;
    }
    rawDomains.push(...page);
    if (page.length < 100) {
      hasMoreDomains = false;
    } else {
      offset += 100;
    }
  }

  let domains = rawDomains
    .filter((d) => d && typeof d === "object" && (d.hostname || d.id !== undefined))
    .map((d) => ({
      id: normalizeInteger(d.id) ?? targetDomainId,
      hostname: normalizeHostname(d.hostname || normalizedTargetHost),
      state: String(d.state || "configured"),
      linkType: String(d.linkType || d.link_type || "custom"),
      appleAppSiteAssociation: normalizeJsonText(d.appleAppSiteAssociation ?? d.apple_app_site_association),
      assetLinks: normalizeJsonText(d.assetLinks ?? d.asset_links),
      createdAt: d.createdAt ?? d.created_at ?? null,
      updatedAt: d.updatedAt ?? d.updated_at ?? null,
    }));

  if (domainExplicit && domains.length > 0) {
    const matched = domains.filter((d) => d.hostname === normalizedTargetHost || Number(d.id) === targetDomainId);
    if (matched.length > 0) {
      domains = matched;
    } else {
      warnings.push({
        code: "TARGET_DOMAIN_SYNTHESIZED",
        message: `Configured domain ${normalizedTargetHost} (${targetDomainId}) was not returned by /api/domains; synthesizing domain row.`,
      });
      domains = [
        {
          id: targetDomainId,
          hostname: normalizedTargetHost,
          state: "configured",
          linkType: "custom",
          appleAppSiteAssociation: null,
          assetLinks: null,
          createdAt: null,
          updatedAt: null,
        },
      ];
    }
  }

  if (domains.length === 0 || domainsFallbackUsed) {
    domains = [
      {
        id: targetDomainId,
        hostname: normalizedTargetHost,
        state: "configured",
        linkType: "custom",
        appleAppSiteAssociation: null,
        assetLinks: null,
        createdAt: null,
        updatedAt: null,
      },
    ];
  }

  // Deduplicate domains by hostname
  const uniqueDomains = [];
  const seenHosts = new Set();
  for (const dom of domains) {
    if (!seenHosts.has(dom.hostname)) {
      seenHosts.add(dom.hostname);
      uniqueDomains.push(dom);
    }
  }

  // 2. Export folders + paginated links + click totals per domain
  const folders = [];
  const seenFolderIds = new Set();
  const links = [];
  const seenLinkIds = new Set();

  for (const dom of uniqueDomains) {
    const foldersRes = await fetchJsonOrNull(fetchImpl, `${apiBaseUrl}/links/folders/${dom.id}`, headers);
    if (foldersRes.ok) {
      let folderList = [];
      if (Array.isArray(foldersRes.body?.linkFolders)) {
        folderList = foldersRes.body.linkFolders;
      } else if (Array.isArray(foldersRes.body)) {
        folderList = foldersRes.body;
      }
      for (const folder of folderList) {
        if (!folder || typeof folder !== "object" || !folder.id) {
          continue;
        }
        const folderId = String(folder.id);
        if (seenFolderIds.has(folderId)) {
          continue;
        }
        seenFolderIds.add(folderId);
        folders.push({
          id: folderId,
          DomainId: normalizeInteger(folder.DomainId) ?? dom.id,
          name: String(folder.name || "Untitled"),
          color: String(folder.color || "#0693E3"),
          icon: folder.icon ?? null,
          createdAt: folder.createdAt ?? null,
          updatedAt: folder.updatedAt ?? null,
        });
      }
    } else if (foldersRes.status !== 404) {
      warnings.push({
        code: "FOLDERS_FETCH_WARNING",
        domainId: dom.id,
        message: `GET /links/folders/${dom.id} returned HTTP ${foldersRes.status}.`,
      });
    }

    // Paginate GET /api/links?domain_id=<id>&limit=150&pageToken=<token>
    let pageToken = null;
    const seenTokens = new Set();
    const domainLinks = [];
    let hasMoreLinks = true;

    while (hasMoreLinks) {
      const url = new URL(`${apiBaseUrl}/api/links`);
      url.searchParams.set("domain_id", String(dom.id));
      url.searchParams.set("limit", "150");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const linksRes = await fetchJsonOrNull(fetchImpl, url.toString(), headers);
      if (!linksRes.ok) {
        throw new Error(
          `Short.io GET /api/links failed with HTTP ${linksRes.status}: ${JSON.stringify(linksRes.body)}`,
        );
      }

      let pageLinks = [];
      if (Array.isArray(linksRes.body?.links)) {
        pageLinks = linksRes.body.links;
      } else if (Array.isArray(linksRes.body)) {
        pageLinks = linksRes.body;
      }

      for (const rawLink of pageLinks) {
        if (!rawLink || typeof rawLink !== "object") {
          continue;
        }
        const linkId = String(rawLink.idString || rawLink.id || "").trim();
        if (linkId && seenLinkIds.has(linkId)) {
          continue;
        }
        if (linkId) {
          seenLinkIds.add(linkId);
        }
        const enriched = {
          ...rawLink,
          DomainId: normalizeInteger(rawLink.DomainId) ?? dom.id,
          hostname: normalizeHostname(
            rawLink.hostname || parseShortUrlParts(rawLink.shortURL).hostname || dom.hostname,
          ),
        };
        domainLinks.push(enriched);
      }

      const nextToken =
        typeof linksRes.body?.nextPageToken === "string" && linksRes.body.nextPageToken.trim() !== ""
          ? linksRes.body.nextPageToken.trim()
          : null;

      if (!nextToken || pageLinks.length === 0) {
        hasMoreLinks = false;
      } else if (seenTokens.has(nextToken)) {
        warnings.push({
          code: "REPEATED_PAGE_TOKEN",
          domainId: dom.id,
          pageToken: nextToken,
          message: `Pagination stopped because nextPageToken "${nextToken}" repeated.`,
        });
        hasMoreLinks = false;
      } else {
        seenTokens.add(nextToken);
        pageToken = nextToken;
      }
    }

    // Optional geo-targeting fetch
    if (fetchGeo) {
      for (const item of domainLinks) {
        const linkId = String(item.idString || item.id || "").trim();
        if (!linkId) {
          continue;
        }
        const geoRes = await fetchJsonOrNull(
          fetchImpl,
          `${apiBaseUrl}/link_country/${encodeURIComponent(linkId)}?domainId=${encodeURIComponent(String(dom.id))}`,
          headers,
        );
        if (geoRes.ok) {
          let geoList = [];
          if (Array.isArray(geoRes.body)) {
            geoList = geoRes.body;
          } else if (Array.isArray(geoRes.body?.linkCountries)) {
            geoList = geoRes.body.linkCountries;
          }
          const normalizedGeo = normalizeGeoTargets(geoList);
          if (normalizedGeo.length > 0) {
            item.geoTargets = normalizedGeo;
          }
        }
      }
    }

    // Fetch historical click totals (`legacy_clicks`) via bulk endpoint + per-link fallback
    const clickCounts = new Map();
    const linkIds = domainLinks.map((l) => String(l.idString || l.id || "").trim()).filter(Boolean);

    for (let i = 0; i < linkIds.length; i += STATS_BATCH_SIZE) {
      const batch = linkIds.slice(i, i + STATS_BATCH_SIZE);
      const bulkUrl = `${statsBaseUrl}/statistics/domain/${encodeURIComponent(String(dom.id))}/link_clicks?ids=${encodeURIComponent(batch.join(","))}`;
      const bulkRes = await fetchJsonOrNull(fetchImpl, bulkUrl, headers);
      if (bulkRes.ok && bulkRes.body && typeof bulkRes.body === "object" && !Array.isArray(bulkRes.body)) {
        for (const id of batch) {
          const entry = bulkRes.body[id];
          if (typeof entry === "number" && Number.isFinite(entry)) {
            clickCounts.set(id, Math.max(0, Math.trunc(entry)));
          } else if (entry && typeof entry === "object") {
            const val = Number(entry.totalClicks ?? entry.clicks ?? entry.humanClicks);
            if (Number.isFinite(val)) {
              clickCounts.set(id, Math.max(0, Math.trunc(val)));
            }
          }
        }
      }
    }

    // Per-link fallback for any IDs missing from bulk stats
    for (const item of domainLinks) {
      const id = String(item.idString || item.id || "").trim();
      if (!id) {
        continue;
      }
      if (!clickCounts.has(id)) {
        const singleUrl = `${statsBaseUrl}/statistics/link/${encodeURIComponent(id)}?period=total&tz=Asia%2FJakarta`;
        const singleRes = await fetchJsonOrNull(fetchImpl, singleUrl, headers);
        if (singleRes.ok && singleRes.body && typeof singleRes.body === "object") {
          const val = Number(singleRes.body.totalClicks ?? singleRes.body.clicks ?? singleRes.body.humanClicks);
          if (Number.isFinite(val)) {
            clickCounts.set(id, Math.max(0, Math.trunc(val)));
          }
        }
      }

      const fallbackClicks = normalizeNonNegativeInt(item.clicks ?? item.legacyClicks ?? item.legacy_clicks, 0);
      const resolvedClicks = clickCounts.has(id) ? clickCounts.get(id) : fallbackClicks;
      item.legacyClicks = Math.max(0, Math.trunc(resolvedClicks));
      item.clicks = item.legacyClicks;
    }

    links.push(...domainLinks);
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: "shortio-api",
    domains: uniqueDomains,
    folders,
    links,
    warnings,
  };
}

export function normalizeBackupData(rawBackup, defaults = {}) {
  const defaultDomain = normalizeHostname(defaults.domain || DEFAULT_DOMAIN) || DEFAULT_DOMAIN;
  const defaultDomainId = normalizeInteger(defaults.domainId) ?? DEFAULT_DOMAIN_ID;
  const nowIso = defaults.nowIso || new Date().toISOString();

  let sourceObj = {};
  if (Array.isArray(rawBackup)) {
    sourceObj = { links: rawBackup };
  } else if (rawBackup && typeof rawBackup === "object") {
    sourceObj = rawBackup;
  }
  const backupTimestamp = firstValidIsoTimestamp([sourceObj.exportedAt], nowIso);
  const rawDomains = Array.isArray(sourceObj.domains) ? sourceObj.domains : [];
  const rawFolders = Array.isArray(sourceObj.folders) ? sourceObj.folders : [];
  const rawLinks = Array.isArray(sourceObj.links) ? sourceObj.links : [];
  const warnings = Array.isArray(sourceObj.warnings) ? [...sourceObj.warnings] : [];

  const domains =
    rawDomains.length > 0
      ? rawDomains.map((d) => ({
          id: normalizeInteger(d.id) ?? defaultDomainId,
          hostname: normalizeHostname(d.hostname || defaultDomain),
          state: String(d.state || "configured"),
          linkType: String(d.linkType || d.link_type || "custom"),
          appleAppSiteAssociation: normalizeJsonText(d.appleAppSiteAssociation ?? d.apple_app_site_association),
          assetLinks: normalizeJsonText(d.assetLinks ?? d.asset_links),
          createdAt: firstValidIsoTimestamp([d.createdAt, d.created_at, sourceObj.exportedAt], backupTimestamp),
          updatedAt: firstValidIsoTimestamp(
            [d.updatedAt, d.updated_at, d.createdAt, d.created_at, sourceObj.exportedAt],
            backupTimestamp,
          ),
        }))
      : [
          {
            id: defaultDomainId,
            hostname: defaultDomain,
            state: "configured",
            linkType: "custom",
            appleAppSiteAssociation: null,
            assetLinks: null,
            createdAt: backupTimestamp,
            updatedAt: backupTimestamp,
          },
        ];

  const folders = rawFolders
    .filter((f) => f && typeof f === "object" && (f.id || f.name))
    .map((f) => ({
      id: String(f.id || deterministicId("fld_", `${f.DomainId ?? defaultDomainId}:${f.name}`)),
      DomainId: normalizeInteger(f.DomainId ?? f.domainId ?? f.domain_id) ?? domains[0].id,
      name: String(f.name || "Untitled"),
      color: String(f.color || "#0693E3"),
      icon: f.icon ?? null,
      createdAt: firstValidIsoTimestamp([f.createdAt, f.created_at, sourceObj.exportedAt], backupTimestamp),
      updatedAt: firstValidIsoTimestamp(
        [f.updatedAt, f.updated_at, f.createdAt, f.created_at, sourceObj.exportedAt],
        backupTimestamp,
      ),
    }));

  return {
    version: 1,
    exportedAt: backupTimestamp,
    source: sourceObj.source || "backup",
    domains,
    folders,
    links: rawLinks,
    warnings,
  };
}

export function mapShortioLinkToRecord(rawLink, context = {}) {
  const nowIso = context.nowIso || new Date().toISOString();
  const defaultDomain = context.defaultDomain || { id: DEFAULT_DOMAIN_ID, hostname: DEFAULT_DOMAIN };
  const domainsById = context.domainsById instanceof Map ? context.domainsById : new Map();
  const domainsByHost = context.domainsByHost instanceof Map ? context.domainsByHost : new Map();
  const validFolderIds = context.validFolderIds instanceof Set ? context.validFolderIds : new Set();
  const foldersById = context.foldersById instanceof Map ? context.foldersById : new Map();

  const parsedShort = parseShortUrlParts(rawLink.shortURL || rawLink.secureShortURL);
  const rawDomainId = normalizeInteger(rawLink.DomainId ?? rawLink.domainId ?? rawLink.domain_id);
  const matchedDomainByHost =
    (rawLink.hostname && domainsByHost.get(normalizeHostname(rawLink.hostname))) ||
    (parsedShort.hostname && domainsByHost.get(parsedShort.hostname));
  const matchedDomainById = rawDomainId !== null ? domainsById.get(rawDomainId) : undefined;
  const resolvedDomain = matchedDomainByHost || matchedDomainById || defaultDomain;

  const hostname = normalizeHostname(rawLink.hostname || parsedShort.hostname || resolvedDomain.hostname);
  const path = normalizeSlugPath(rawLink.path ?? parsedShort.path ?? "");
  const originalURL = String(rawLink.originalURL ?? rawLink.original_url ?? "").trim();

  if (!path) {
    throw new Error(`Cannot map Short.io link missing slug path: ${JSON.stringify(rawLink)}`);
  }
  if (!originalURL) {
    throw new Error(`Cannot map Short.io link "${hostname}/${path}" missing originalURL.`);
  }

  const rawId = String(rawLink.idString || rawLink.id || "").trim();
  const id = rawId || deterministicId("lnk_mig_", `${hostname}:${path}`);

  const warnings = [];
  const rawFolderId = rawLink.FolderId ?? rawLink.folderId ?? rawLink.folder_id ?? null;
  let folderId = null;
  let folderName = null;
  if (rawFolderId !== null && String(rawFolderId).trim() !== "") {
    const candidateFolderId = String(rawFolderId).trim();
    if (validFolderIds.has(candidateFolderId)) {
      folderId = candidateFolderId;
      folderName = foldersById.get(candidateFolderId)?.name ?? null;
    } else {
      warnings.push({
        code: "DANGLING_FOLDER_ID",
        linkId: id,
        hostname,
        path,
        folderId: candidateFolderId,
        message: `Dangling FolderId "${candidateFolderId}" on ${hostname}/${path} was mapped to NULL to preserve D1 FK integrity.`,
      });
    }
  }

  let existingPasswordHash = null;
  if (typeof rawLink.passwordHash === "string" && rawLink.passwordHash.startsWith("pbkdf2$")) {
    existingPasswordHash = rawLink.passwordHash;
  } else if (typeof rawLink.password_hash === "string" && rawLink.password_hash.startsWith("pbkdf2$")) {
    existingPasswordHash = rawLink.password_hash;
  }
  const isPasswordProtected = Boolean(
    normalizeBoolean(rawLink.hasPassword ?? rawLink.has_password) || rawLink.password || existingPasswordHash,
  );
  const needsPasswordReset = isPasswordProtected && !existingPasswordHash;

  const splitTargets = normalizeSplitTargets(rawLink, originalURL);
  const bundleItems = normalizeBundleItems(rawLink);
  let linkType = "redirect";
  if (
    rawLink.linkType === "bundle" ||
    rawLink.link_type === "bundle" ||
    (bundleItems.length > 0 && rawLink.linkType !== "split")
  ) {
    linkType = "bundle";
  } else if (rawLink.linkType === "split" || rawLink.link_type === "split" || splitTargets.length > 0) {
    linkType = "split";
  }

  const geoTargets = normalizeGeoTargets(rawLink.geoTargets ?? rawLink.geo_targets);
  const utmParams = normalizeUtmParams(rawLink);
  const pixels = normalizePixels(rawLink);
  const tags = normalizeTags(rawLink.tags);
  const redirectType = normalizeRedirectType(rawLink.redirectType ?? rawLink.redirect_type);
  const archived = normalizeBoolean(rawLink.archived);
  const cloaking = normalizeBoolean(rawLink.cloaking);
  const expiresAt = normalizeEpochMs(rawLink.expiresAt ?? rawLink.expires_at);
  const expiredURL = rawLink.expiredURL ?? rawLink.expired_url ?? null;
  const androidURL = rawLink.androidURL ?? rawLink.android_url ?? null;
  const iphoneURL = rawLink.iphoneURL ?? rawLink.iphone_url ?? null;
  const maxClicksRaw = normalizeInteger(rawLink.maxClicks ?? rawLink.max_clicks ?? rawLink.clicksLimit);
  const maxClicks = maxClicksRaw !== null && maxClicksRaw >= 0 ? maxClicksRaw : null;
  const legacyClicks = normalizeNonNegativeInt(rawLink.legacyClicks ?? rawLink.legacy_clicks ?? rawLink.clicks, 0);
  const ownerId = normalizeInteger(rawLink.OwnerId ?? rawLink.ownerId ?? rawLink.owner_id ?? rawLink.User?.id);
  const ownerEmail = rawLink.User?.email || rawLink.ownerEmail || rawLink.owner_email || null;
  const title =
    rawLink.title !== undefined && rawLink.title !== null && String(rawLink.title).trim() !== ""
      ? String(rawLink.title)
      : null;
  const createdAt = firstValidIsoTimestamp([rawLink.createdAt, rawLink.created_at], nowIso);
  const updatedAt = firstValidIsoTimestamp(
    [rawLink.updatedAt, rawLink.updated_at, rawLink.createdAt, rawLink.created_at],
    nowIso,
  );

  const d1Row = {
    id,
    domain_id: resolvedDomain.id,
    hostname,
    path,
    original_url: originalURL,
    title,
    tags_json: JSON.stringify(tags),
    folder_id: folderId,
    folder_name: folderName,
    archived: archived ? 1 : 0,
    redirect_type: redirectType,
    expires_at: expiresAt,
    expired_url: expiredURL ? String(expiredURL) : null,
    password_hash: existingPasswordHash,
    has_password: isPasswordProtected ? 1 : 0,
    cloaking: cloaking ? 1 : 0,
    android_url: androidURL ? String(androidURL) : null,
    iphone_url: iphoneURL ? String(iphoneURL) : null,
    geo_targets_json: JSON.stringify(geoTargets),
    utm_params_json: utmParams ? JSON.stringify(utmParams) : null,
    pixels_json: pixels ? JSON.stringify(pixels) : null,
    max_clicks: maxClicks,
    clicks_count: 0,
    legacy_clicks: legacyClicks,
    link_type: linkType,
    split_targets_json: JSON.stringify(splitTargets),
    bundle_items_json: JSON.stringify(bundleItems),
    owner_id: ownerId,
    owner_email: ownerEmail ? String(ownerEmail) : null,
    created_at: createdAt,
    updated_at: updatedAt,
  };

  const kvRecord = {
    id,
    domainId: resolvedDomain.id,
    hostname,
    path,
    originalURL,
    redirectType,
    archived,
    expiresAt,
    expiredURL: expiredURL ? String(expiredURL) : null,
    passwordHash: existingPasswordHash,
    cloaking,
    androidURL: androidURL ? String(androidURL) : null,
    iphoneURL: iphoneURL ? String(iphoneURL) : null,
    geoTargets,
    utmParams,
    pixels,
    maxClicks,
    linkType,
    splitTargets,
    bundleItems,
    title,
    folderId,
    tags,
    updatedAt,
  };

  const flaggedPassword = needsPasswordReset
    ? {
        id,
        hostname,
        path,
        shortURL: String(rawLink.shortURL || rawLink.secureShortURL || `https://${hostname}/${path}`),
        originalURL,
      }
    : null;

  return { d1Row, kvRecord, flaggedPassword, warnings };
}

function deterministicDomainId(hostname, usedIds) {
  const digest = createHash("sha256").update(hostname).digest();
  let candidate = digest.readUInt32BE(0) & 0x7fffffff || 1;
  while (usedIds.has(candidate)) {
    candidate = candidate >= 0x7fffffff ? 1 : candidate + 1;
  }
  return candidate;
}

export function buildMigrationDataset(rawBackup, defaults = {}) {
  const exportedAtIso =
    rawBackup && !Array.isArray(rawBackup) && typeof rawBackup === "object"
      ? firstValidIsoTimestamp([rawBackup.exportedAt], null)
      : null;
  const nowIso = defaults.nowIso || exportedAtIso || new Date().toISOString();
  const normalized = normalizeBackupData(rawBackup, { ...defaults, nowIso });

  const domainsById = new Map();
  const domainsByHost = new Map();
  const domains = [];

  for (const dom of normalized.domains) {
    if (domainsByHost.has(dom.hostname)) {
      continue;
    }
    const cleanDom = {
      id: dom.id,
      hostname: dom.hostname,
      state: dom.state,
      link_type: dom.linkType || "custom",
      apple_app_site_association: normalizeJsonText(dom.appleAppSiteAssociation),
      asset_links: normalizeJsonText(dom.assetLinks),
      created_at: dom.createdAt || nowIso,
      updated_at: dom.updatedAt || nowIso,
    };
    domains.push(cleanDom);
    domainsById.set(cleanDom.id, cleanDom);
    domainsByHost.set(cleanDom.hostname, cleanDom);
  }

  const folders = [];
  const foldersById = new Map();
  const seenFolderDomainNames = new Set();

  for (const folder of normalized.folders) {
    const parentDomain = domainsById.get(folder.DomainId) || domains[0];
    const domainNameKey = `${parentDomain.hostname}::${folder.name}`;
    if (foldersById.has(folder.id) || seenFolderDomainNames.has(domainNameKey)) {
      continue;
    }
    seenFolderDomainNames.add(domainNameKey);
    const cleanFolder = {
      id: folder.id,
      domain_id: parentDomain.id,
      hostname: parentDomain.hostname,
      name: folder.name,
      color: folder.color || "#0693E3",
      icon: folder.icon ?? null,
      created_at: folder.createdAt || nowIso,
      updated_at: folder.updatedAt || nowIso,
    };
    folders.push(cleanFolder);
    foldersById.set(cleanFolder.id, cleanFolder);
  }

  const validFolderIds = new Set(folders.map((f) => f.id));
  const warnings = [...normalized.warnings];
  const flaggedPasswordLinks = [];
  const linkRecordsByKey = new Map();

  for (const rawLink of normalized.links) {
    if (rawLink && typeof rawLink === "object") {
      const parsedShort = parseShortUrlParts(rawLink.shortURL || rawLink.secureShortURL);
      const explicitHost = normalizeHostname(rawLink.hostname || parsedShort.hostname);
      if (explicitHost && !domainsByHost.has(explicitHost)) {
        const rawDomainId = normalizeInteger(rawLink.DomainId ?? rawLink.domainId ?? rawLink.domain_id);
        const synthesizedId =
          rawDomainId !== null && rawDomainId > 0 && !domainsById.has(rawDomainId)
            ? rawDomainId
            : deterministicDomainId(explicitHost, domainsById);
        const synthesizedDom = {
          id: synthesizedId,
          hostname: explicitHost,
          state: "configured",
          link_type: "custom",
          apple_app_site_association: null,
          asset_links: null,
          created_at: normalized.exportedAt || nowIso,
          updated_at: normalized.exportedAt || nowIso,
        };
        domains.push(synthesizedDom);
        domainsById.set(synthesizedDom.id, synthesizedDom);
        domainsByHost.set(synthesizedDom.hostname, synthesizedDom);
        warnings.push({
          code: "SYNTHESIZED_LINK_DOMAIN",
          hostname: explicitHost,
          domainId: synthesizedId,
          message: `Link references unregistered hostname "${explicitHost}"; synthesized short_domains entry (id=${synthesizedId}).`,
        });
      }
    }

    const rawSlug = normalizeSlugPath(rawLink.path ?? "");
    if (!rawSlug) {
      warnings.push({
        code: "SKIPPED_ROOT_LINK",
        hostname: normalizeHostname(rawLink.hostname || domains[0]?.hostname || "gdgjakarta.org"),
        originalURL: rawLink.originalURL ?? null,
        legacyClicks: Number(rawLink.legacyClicks ?? rawLink.clicks ?? 0),
        message: `Skipped Short.io root-domain link (path=""): handled natively by Worker root "/" redirect.`,
      });
      continue;
    }

    const mapped = mapShortioLinkToRecord(rawLink, {
      nowIso,
      defaultDomain: domains[0],
      domainsById,
      domainsByHost,
      validFolderIds,
      foldersById,
    });
    warnings.push(...mapped.warnings);

    const key = buildLinkKvKey(mapped.d1Row.hostname, mapped.d1Row.path);
    const existing = linkRecordsByKey.get(key);
    if (existing) {
      const mergedLegacyClicks = Math.max(existing.d1Row.legacy_clicks, mapped.d1Row.legacy_clicks);
      const mergedArchived = existing.d1Row.archived || mapped.d1Row.archived ? 1 : 0;
      mapped.d1Row.legacy_clicks = mergedLegacyClicks;
      mapped.d1Row.archived = mergedArchived;
      mapped.kvRecord.archived = mergedArchived === 1;
      warnings.push({
        code: "DUPLICATE_SLUG_MERGED",
        key,
        message: `Duplicate link for ${key} merged (legacy_clicks=${mergedLegacyClicks}).`,
      });
    }
    linkRecordsByKey.set(key, mapped);
  }

  const links = [];
  const kvRecords = [];
  for (const mapped of linkRecordsByKey.values()) {
    links.push(mapped.d1Row);
    kvRecords.push(mapped.kvRecord);
    if (mapped.flaggedPassword) {
      flaggedPasswordLinks.push(mapped.flaggedPassword);
    }
  }

  return {
    generatedAt: nowIso,
    source: normalized.source,
    domains,
    folders,
    links,
    kvRecords,
    flaggedPasswordLinks,
    warnings,
  };
}

export function sqlEscapeString(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  const clean = String(value).replace(/\0/g, "").replace(/'/g, "''");
  return `'${clean}'`;
}

export function sqlEscapeInt(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid numeric SQL value: ${String(value)}`);
  }
  return String(Math.trunc(num));
}

export function generateMigrationSql(dataset) {
  const lines = [
    "-- Generated by scripts/migrate-shortio-to-d1.mjs",
    `-- Generated at: ${dataset.generatedAt || new Date().toISOString()}`,
    "-- Explicit transaction blocks are omitted for Cloudflare D1 remote compatibility.",
    "",
  ];

  for (const domain of dataset.domains) {
    lines.push(
      `INSERT INTO short_domains (id, hostname, state, link_type, apple_app_site_association, asset_links, created_at, updated_at)
VALUES (${sqlEscapeInt(domain.id)}, ${sqlEscapeString(domain.hostname)}, ${sqlEscapeString(domain.state)}, ${sqlEscapeString(domain.link_type)}, ${sqlEscapeString(domain.apple_app_site_association)}, ${sqlEscapeString(domain.asset_links)}, ${sqlEscapeString(domain.created_at)}, ${sqlEscapeString(domain.updated_at)})
ON CONFLICT(hostname) DO UPDATE SET
  state = excluded.state,
  link_type = excluded.link_type,
  apple_app_site_association = COALESCE(excluded.apple_app_site_association, short_domains.apple_app_site_association),
  asset_links = COALESCE(excluded.asset_links, short_domains.asset_links),
  updated_at = excluded.updated_at;`,
    );
  }

  if (dataset.folders.length > 0) {
    lines.push("");
  }

  for (const folder of dataset.folders) {
    const domainLookup = `(SELECT id FROM short_domains WHERE hostname = ${sqlEscapeString(folder.hostname)})`;
    lines.push(
      `INSERT INTO short_folders (id, domain_id, name, color, icon, created_at, updated_at)
VALUES (${sqlEscapeString(folder.id)}, ${domainLookup}, ${sqlEscapeString(folder.name)}, ${sqlEscapeString(folder.color)}, ${sqlEscapeString(folder.icon)}, ${sqlEscapeString(folder.created_at)}, ${sqlEscapeString(folder.updated_at)})
ON CONFLICT(id) DO UPDATE SET
  domain_id = CASE
    WHEN EXISTS (
      SELECT 1 FROM short_folders f
      WHERE f.domain_id = excluded.domain_id AND f.name = excluded.name AND f.id != excluded.id
    ) THEN short_folders.domain_id
    ELSE excluded.domain_id
  END,
  name = CASE
    WHEN EXISTS (
      SELECT 1 FROM short_folders f
      WHERE f.domain_id = excluded.domain_id AND f.name = excluded.name AND f.id != excluded.id
    ) THEN short_folders.name
    ELSE excluded.name
  END,
  color = excluded.color,
  icon = excluded.icon,
  updated_at = excluded.updated_at
ON CONFLICT(domain_id, name) DO UPDATE SET
  color = excluded.color,
  icon = excluded.icon,
  updated_at = excluded.updated_at;`,
    );
  }

  if (dataset.links.length > 0) {
    lines.push("");
  }

  for (const link of dataset.links) {
    const domainLookup = `(SELECT id FROM short_domains WHERE hostname = ${sqlEscapeString(link.hostname)})`;
    let folderExpr = "NULL";
    if (link.folder_id) {
      if (link.folder_name) {
        folderExpr = `(SELECT id FROM short_folders WHERE id = ${sqlEscapeString(link.folder_id)} OR (domain_id = ${domainLookup} AND name = ${sqlEscapeString(link.folder_name)}) LIMIT 1)`;
      } else {
        folderExpr = `(SELECT id FROM short_folders WHERE id = ${sqlEscapeString(link.folder_id)} LIMIT 1)`;
      }
    }

    lines.push(
      `INSERT INTO short_links (
  id, domain_id, hostname, path, original_url, title, tags_json, folder_id,
  archived, redirect_type, expires_at, expired_url, password_hash, has_password,
  cloaking, android_url, iphone_url, geo_targets_json, utm_params_json, pixels_json,
  max_clicks, clicks_count, legacy_clicks, link_type, split_targets_json, bundle_items_json,
  owner_id, owner_email, created_at, updated_at
)
VALUES (
  ${sqlEscapeString(link.id)},
  ${domainLookup},
  ${sqlEscapeString(link.hostname)},
  ${sqlEscapeString(link.path)},
  ${sqlEscapeString(link.original_url)},
  ${sqlEscapeString(link.title)},
  ${sqlEscapeString(link.tags_json)},
  ${folderExpr},
  ${sqlEscapeInt(link.archived)},
  ${sqlEscapeInt(link.redirect_type)},
  ${sqlEscapeInt(link.expires_at)},
  ${sqlEscapeString(link.expired_url)},
  ${sqlEscapeString(link.password_hash)},
  ${sqlEscapeInt(link.has_password)},
  ${sqlEscapeInt(link.cloaking)},
  ${sqlEscapeString(link.android_url)},
  ${sqlEscapeString(link.iphone_url)},
  ${sqlEscapeString(link.geo_targets_json)},
  ${sqlEscapeString(link.utm_params_json)},
  ${sqlEscapeString(link.pixels_json)},
  ${sqlEscapeInt(link.max_clicks)},
  ${sqlEscapeInt(link.clicks_count)},
  ${sqlEscapeInt(link.legacy_clicks)},
  ${sqlEscapeString(link.link_type)},
  ${sqlEscapeString(link.split_targets_json)},
  ${sqlEscapeString(link.bundle_items_json)},
  ${sqlEscapeInt(link.owner_id)},
  ${sqlEscapeString(link.owner_email)},
  ${sqlEscapeString(link.created_at)},
  ${sqlEscapeString(link.updated_at)}
)
ON CONFLICT(hostname, path) DO UPDATE SET
  domain_id = excluded.domain_id,
  original_url = excluded.original_url,
  title = excluded.title,
  tags_json = excluded.tags_json,
  folder_id = excluded.folder_id,
  archived = excluded.archived,
  redirect_type = excluded.redirect_type,
  expires_at = excluded.expires_at,
  expired_url = excluded.expired_url,
  password_hash = COALESCE(excluded.password_hash, short_links.password_hash),
  has_password = CASE
    WHEN short_links.password_hash IS NOT NULL OR excluded.password_hash IS NOT NULL THEN 1
    ELSE excluded.has_password
  END,
  cloaking = excluded.cloaking,
  android_url = excluded.android_url,
  iphone_url = excluded.iphone_url,
  geo_targets_json = excluded.geo_targets_json,
  utm_params_json = excluded.utm_params_json,
  pixels_json = excluded.pixels_json,
  max_clicks = excluded.max_clicks,
  legacy_clicks = MAX(short_links.legacy_clicks, excluded.legacy_clicks),
  link_type = excluded.link_type,
  split_targets_json = excluded.split_targets_json,
  bundle_items_json = excluded.bundle_items_json,
  owner_id = excluded.owner_id,
  owner_email = excluded.owner_email,
  updated_at = excluded.updated_at;`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

export function generateKvBulkPayload(dataset) {
  const entries = [];

  for (const domain of dataset.domains) {
    const value = {
      id: domain.id,
      hostname: domain.hostname,
      state: domain.state,
      linkType: domain.link_type ?? "custom",
      appleAppSiteAssociation: domain.apple_app_site_association ?? null,
      assetLinks: domain.asset_links ?? null,
      updatedAt: domain.updated_at,
    };
    entries.push({
      key: buildDomainKvKey(domain.hostname),
      value: JSON.stringify(value),
    });
  }

  for (const record of dataset.kvRecords) {
    entries.push({
      key: buildLinkKvKey(record.hostname, record.path),
      value: JSON.stringify(record),
    });
  }

  return entries;
}

export function buildMigrationReport(dataset) {
  let activeLinks = 0;
  let archivedLinks = 0;
  let totalLegacyClicks = 0;

  for (const link of dataset.links) {
    if (link.archived === 1) {
      archivedLinks += 1;
    } else {
      activeLinks += 1;
    }
    totalLegacyClicks += link.legacy_clicks || 0;
  }

  return {
    generatedAt: dataset.generatedAt,
    source: dataset.source,
    summary: {
      domainsCount: dataset.domains.length,
      foldersCount: dataset.folders.length,
      linksCount: dataset.links.length,
      activeLinksCount: activeLinks,
      archivedLinksCount: archivedLinks,
      totalLegacyClicks,
      flaggedPasswordLinksCount: dataset.flaggedPasswordLinks.length,
      warningsCount: dataset.warnings.length,
    },
    flaggedPasswordLinks: dataset.flaggedPasswordLinks,
    warnings: dataset.warnings,
  };
}

export function formatPasswordWarningBanner(flaggedPasswordLinks) {
  if (!Array.isArray(flaggedPasswordLinks) || flaggedPasswordLinks.length === 0) {
    return "";
  }
  const lines = [
    "",
    "================================================================================",
    `WARNING: ${flaggedPasswordLinks.length} password-protected link(s) require manual password re-entry`,
    "Short.io does not export plaintext passwords or password hashes. These links were",
    "imported with has_password = 1 and password_hash = NULL. Re-enter their passwords",
    "in /dashboard/links BEFORE cutting over DNS to Cloudflare:",
  ];
  for (const item of flaggedPasswordLinks) {
    lines.push(`  - ${item.hostname}/${item.path} (id=${item.id}) -> ${item.originalURL}`);
  }
  lines.push("================================================================================", "");
  return lines.join("\n");
}

async function writeTextFile(filePath, content) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

function makeDefaultStamp(nowDate) {
  return nowDate.toISOString().replace(/[:.]/g, "-");
}

export async function runMigration(
  cliOptions,
  {
    fetchImpl = fetch,
    execFileImpl = execFileAsync,
    cwd = process.cwd(),
    env = process.env,
    stdout = process.stdout,
    stderr = process.stderr,
    now = () => new Date(),
  } = {},
) {
  const nowDate = now();
  const nowIso = nowDate.toISOString();
  const stamp = makeDefaultStamp(nowDate);

  let backupData;
  let backupPathWritten = null;
  let effectiveNowIso = nowIso;

  if (cliOptions.fromBackup) {
    const backupAbs = resolve(cwd, cliOptions.fromBackup);
    if (!existsSync(backupAbs)) {
      throw new Error(`Backup file not found: ${backupAbs}`);
    }
    const rawText = await readFile(backupAbs, "utf8");
    const parsedBackup = JSON.parse(rawText);
    if (parsedBackup && !Array.isArray(parsedBackup) && typeof parsedBackup === "object") {
      effectiveNowIso = firstValidIsoTimestamp([parsedBackup.exportedAt], nowIso);
    }
    backupData = normalizeBackupData(parsedBackup, {
      domain: cliOptions.domain,
      domainId: cliOptions.domainId,
      nowIso: effectiveNowIso,
    });
  } else {
    backupData = await exportFromShortio({
      apiKey: env.SHORTIO_API_KEY,
      domain: cliOptions.domain,
      domainId: cliOptions.domainId,
      domainExplicit: cliOptions.domainExplicit,
      fetchGeo: cliOptions.fetchGeo,
      fetchImpl,
    });
    const backupTarget = cliOptions.backup
      ? resolve(cwd, cliOptions.backup)
      : resolve(cwd, `shortio-backup-${stamp}.json`);
    await writeTextFile(backupTarget, `${JSON.stringify(backupData, null, 2)}\n`);
    backupPathWritten = backupTarget;
  }

  if (cliOptions.archivedCsv) {
    const csvAbs = resolve(cwd, cliOptions.archivedCsv);
    if (!existsSync(csvAbs)) {
      throw new Error(`Archived CSV file not found: ${csvAbs}`);
    }
    const csvText = await readFile(csvAbs, "utf8");
    const csvLinks = parseShortioArchivedCsv(csvText, cliOptions.domain, cliOptions.domainId);
    backupData = {
      ...backupData,
      links: mergeArchivedCsvLinks(backupData.links, csvLinks),
    };
    if (backupPathWritten) {
      await writeTextFile(backupPathWritten, `${JSON.stringify(backupData, null, 2)}\n`);
    }
  }

  const dataset = buildMigrationDataset(backupData, {
    domain: cliOptions.domain,
    domainId: cliOptions.domainId,
    nowIso: effectiveNowIso,
  });
  const sql = generateMigrationSql(dataset);
  const kvBulk = generateKvBulkPayload(dataset);
  const report = buildMigrationReport(dataset);

  const shouldExecuteWrangler = !cliOptions.dryRun && (cliOptions.applyD1 || cliOptions.applyKv);

  let sqlPathWritten = null;
  if (cliOptions.outSql || (shouldExecuteWrangler && cliOptions.applyD1)) {
    sqlPathWritten = resolve(cwd, cliOptions.outSql || `shortio-migration-${stamp}.sql`);
    await writeTextFile(sqlPathWritten, sql);
  }

  let kvPathWritten = null;
  if (cliOptions.outKv || (shouldExecuteWrangler && cliOptions.applyKv)) {
    kvPathWritten = resolve(cwd, cliOptions.outKv || `shortio-kv-bulk-${stamp}.json`);
    await writeTextFile(kvPathWritten, `${JSON.stringify(kvBulk, null, 2)}\n`);
  }

  let reportPathWritten = null;
  if (cliOptions.outReport) {
    reportPathWritten = resolve(cwd, cliOptions.outReport);
    await writeTextFile(reportPathWritten, `${JSON.stringify(report, null, 2)}\n`);
  }

  const wranglerCommands = [];
  if (shouldExecuteWrangler) {
    const targetFlag = cliOptions.remote ? "--remote" : "--local";
    if (cliOptions.applyD1 && sqlPathWritten) {
      const d1Args = [
        "wrangler",
        "d1",
        "execute",
        cliOptions.db,
        "--file",
        sqlPathWritten,
        "--yes",
        targetFlag,
        "-c",
        cliOptions.config,
      ];
      wranglerCommands.push({ cmd: "npx", args: d1Args });
      await execFileImpl("npx", d1Args, { cwd });
    }

    if (cliOptions.applyKv && kvPathWritten) {
      const kvTargetArg = cliOptions.kvNamespaceId
        ? `--namespace-id=${cliOptions.kvNamespaceId}`
        : `--binding=${cliOptions.kvBinding}`;
      const kvArgs = ["wrangler", "kv", "bulk", "put", kvPathWritten, kvTargetArg, targetFlag];
      if (!cliOptions.kvNamespaceId) {
        kvArgs.push("-c", cliOptions.config);
      }
      wranglerCommands.push({ cmd: "npx", args: kvArgs });
      await execFileImpl("npx", kvArgs, { cwd });
    }
  }

  const warningBanner = formatPasswordWarningBanner(report.flaggedPasswordLinks);
  if (warningBanner && stderr) {
    stderr.write(warningBanner);
  }

  let runMode = "dry-run";
  if (shouldExecuteWrangler) {
    runMode = cliOptions.remote ? "apply-remote" : "apply-local";
  }

  if (stdout) {
    stdout.write(
      `${JSON.stringify(
        {
          mode: runMode,
          backupPath: backupPathWritten,
          sqlPath: sqlPathWritten,
          kvPath: kvPathWritten,
          reportPath: reportPathWritten,
          summary: report.summary,
          flaggedPasswordLinks: report.flaggedPasswordLinks,
        },
        null,
        2,
      )}\n`,
    );
  }

  return {
    backupData,
    dataset,
    sql,
    kvBulk,
    report,
    paths: {
      backup: backupPathWritten,
      sql: sqlPathWritten,
      kv: kvPathWritten,
      report: reportPathWritten,
    },
    wranglerCommands,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv, process.env);
  if (options.help) {
    process.stdout.write(formatUsage());
    return;
  }
  await runMigration(options);
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`Migration failed: ${message}\n`);
    process.exitCode = 1;
  });
}
