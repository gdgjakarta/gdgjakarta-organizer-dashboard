/**
 * Short.io -> D1/KV Migration Script Test Suite (Offline)
 *
 * Verifies `scripts/migrate-shortio-to-d1.mjs` against `workers/shortlink/migrations/0001_shortlinks.sql`
 * using `node:sqlite` (`DatabaseSync`), mocked `fetch`, and temporary local fixtures with zero live network calls.
 *
 * Run:
 *   node --test tests/shortlink/migration.test.mjs
 */

import {
  buildDomainKvKey,
  buildLinkKvKey,
  buildMigrationDataset,
  buildMigrationReport,
  exportFromShortio,
  formatPasswordWarningBanner,
  generateKvBulkPayload,
  generateMigrationSql,
  mapShortioLinkToRecord,
  mergeArchivedCsvLinks,
  parseCliArgs,
  parseShortioArchivedCsv,
  runMigration,
} from "../../scripts/migrate-shortio-to-d1.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const MIGRATION_SQL_PATH = path.join(REPO_ROOT, "workers/shortlink/migrations/0001_shortlinks.sql");
const MIGRATION_SCRIPT_PATH = path.join(REPO_ROOT, "scripts/migrate-shortio-to-d1.mjs");

function openMigratedDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(MIGRATION_SQL_PATH, "utf8"));
  return db;
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "gdg-shortlink-mig-test-"));
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createBufferWriter() {
  let content = "";
  return {
    stream: {
      write(chunk) {
        content += String(chunk);
      },
    },
    read() {
      return content;
    },
  };
}

describe("Short.io Paginated Export (exportFromShortio)", () => {
  test("exports domains, folders, multi-page links, archived links, geo, and bulk + fallback click stats", async () => {
    const requests = [];

    const mockFetch = async (urlStr, init = {}) => {
      const url = new URL(String(urlStr));
      requests.push({
        url: url.toString(),
        auth: init.headers?.Authorization ?? init.headers?.authorization ?? null,
      });

      if (url.hostname === "api.short.io" && url.pathname === "/api/domains") {
        return jsonResponse([
          {
            id: 1516440,
            hostname: "gdgjakarta.org",
            state: "configured",
            linkType: "custom",
            createdAt: "2025-01-01T00:00:00.000Z",
          },
        ]);
      }

      if (url.hostname === "api.short.io" && url.pathname === "/links/folders/1516440") {
        return jsonResponse({
          linkFolders: [
            { id: "fld_events", name: "Events", color: "#4285F4", DomainId: 1516440 },
            { id: "fld_social", name: "Social", color: "#34A853", DomainId: 1516440 },
          ],
        });
      }

      if (url.hostname === "api.short.io" && url.pathname === "/api/links") {
        const pageToken = url.searchParams.get("pageToken");
        if (!pageToken) {
          return jsonResponse({
            links: [
              {
                idString: "lnk_1",
                DomainId: 1516440,
                hostname: "gdgjakarta.org",
                path: "devfest26",
                originalURL: "https://gdgjakarta.com/events/devfest26",
                title: "DevFest Jakarta 2026",
                FolderId: "fld_events",
                tags: ["devfest", "flagship"],
                redirectType: "301",
                archived: false,
              },
              {
                idString: "lnk_2",
                DomainId: 1516440,
                hostname: "gdgjakarta.org",
                path: "old-event",
                originalURL: "https://gdgjakarta.com/events/2024",
                archived: true,
                FolderId: "fld_events",
              },
            ],
            nextPageToken: "page_2_cursor",
          });
        }

        if (pageToken === "page_2_cursor") {
          return jsonResponse({
            links: [
              // Duplicate idString from page 1 should be deduplicated
              {
                idString: "lnk_1",
                DomainId: 1516440,
                hostname: "gdgjakarta.org",
                path: "devfest26",
                originalURL: "https://gdgjakarta.com/events/devfest26",
              },
              {
                idString: "lnk_3",
                DomainId: 1516440,
                hostname: "gdgjakarta.org",
                path: "vip-deck",
                originalURL: "https://gdgjakarta.com/vip",
                hasPassword: true,
                clicks: 7,
              },
            ],
          });
        }
      }

      if (url.hostname === "api.short.io" && url.pathname.startsWith("/link_country/")) {
        const linkId = url.pathname.split("/").pop();
        if (linkId === "lnk_1") {
          return jsonResponse([{ country: "id", originalURL: "https://gdgjakarta.com/id/devfest26" }]);
        }
        return jsonResponse([]);
      }

      if (url.hostname === "statistics.short.io" && url.pathname === "/statistics/domain/1516440/link_clicks") {
        // Deliberately omit lnk_3 so per-link fallback is exercised
        return jsonResponse({
          lnk_1: 312,
          lnk_2: 88,
        });
      }

      if (url.hostname === "statistics.short.io" && url.pathname === "/statistics/link/lnk_3") {
        return jsonResponse({ totalClicks: 19, humanClicks: 17 });
      }

      return jsonResponse({ error: `Unexpected URL: ${url.toString()}` }, 404);
    };

    const exported = await exportFromShortio({
      apiKey: "sk_test_shortio_key",
      fetchGeo: true,
      fetchImpl: mockFetch,
    });

    // All Short.io requests must send raw Authorization header without Bearer
    assert.ok(requests.length >= 6);
    for (const req of requests) {
      assert.equal(req.auth, "sk_test_shortio_key");
    }

    assert.equal(exported.domains.length, 1);
    assert.equal(exported.domains[0].hostname, "gdgjakarta.org");
    assert.equal(exported.folders.length, 2);
    assert.equal(exported.links.length, 3);

    const lnk1 = exported.links.find((l) => l.idString === "lnk_1");
    const lnk2 = exported.links.find((l) => l.idString === "lnk_2");
    const lnk3 = exported.links.find((l) => l.idString === "lnk_3");
    assert.equal(lnk1.legacyClicks, 312);
    assert.deepEqual(lnk1.geoTargets, [{ country: "ID", url: "https://gdgjakarta.com/id/devfest26" }]);
    assert.equal(lnk2.archived, true);
    assert.equal(lnk2.legacyClicks, 88);
    assert.equal(lnk3.legacyClicks, 19);
  });

  test("falls back to configured domain on 403 and guards repeated nextPageToken loops", async () => {
    let linkCalls = 0;

    const mockFetch = async (urlStr) => {
      const url = new URL(String(urlStr));
      if (url.pathname === "/api/domains") {
        return jsonResponse({ error: "Forbidden for domain-scoped key" }, 403);
      }
      if (url.pathname === "/links/folders/1516440") {
        return jsonResponse({ linkFolders: [] });
      }
      if (url.pathname === "/api/links") {
        linkCalls += 1;
        return jsonResponse({
          links: [
            {
              idString: "lnk_loop",
              path: "loop",
              originalURL: "https://gdgjakarta.com/loop",
              clicks: 5,
            },
          ],
          nextPageToken: "stuck_cursor",
        });
      }
      if (url.pathname === "/statistics/domain/1516440/link_clicks") {
        return jsonResponse({ error: "not available" }, 404);
      }
      if (url.pathname === "/statistics/link/lnk_loop") {
        return jsonResponse({ error: "rate limited" }, 429);
      }
      return jsonResponse({}, 404);
    };

    const exported = await exportFromShortio({
      apiKey: "sk_domain_only",
      domain: "GDGJakarta.ORG.",
      domainId: 1516440,
      fetchImpl: mockFetch,
    });

    assert.equal(linkCalls, 2);
    assert.equal(exported.domains[0].hostname, "gdgjakarta.org");
    assert.equal(exported.links.length, 1);
    assert.equal(exported.links[0].legacyClicks, 5);
    assert.ok(exported.warnings.some((w) => w.code === "DOMAINS_API_FALLBACK"));
    assert.ok(exported.warnings.some((w) => w.code === "REPEATED_PAGE_TOKEN"));
  });
});

describe("Archived CSV Parsing & Merging", () => {
  test("parses RFC-4180 CSV with quoted commas/quotes and merges archived links", () => {
    const csv = `\uFEFFid,shortURL,originalURL,title,tags,archived,clicks
lnk_2,https://gdgjakarta.org/old-event,"https://gdgjakarta.com/2024?a=1,2","Old ""2024"" Event","legacy, archive",true,120
,https://gdgjakarta.org/csv-only,https://gdgjakarta.com/csv-target,"CSV Archived, Special",,true,45
`;

    const csvLinks = parseShortioArchivedCsv(csv, "gdgjakarta.org", 1516440);
    assert.equal(csvLinks.length, 2);
    assert.equal(csvLinks[0].title, 'Old "2024" Event');
    assert.deepEqual(csvLinks[0].tags, ["legacy", "archive"]);
    assert.equal(csvLinks[1].path, "csv-only");
    assert.ok(csvLinks[1].id.startsWith("lnk_csv_"));
    assert.equal(csvLinks[1].archived, true);
    assert.equal(csvLinks[1].legacyClicks, 45);

    const apiLinks = [
      {
        idString: "lnk_2",
        hostname: "gdgjakarta.org",
        path: "old-event",
        originalURL: "https://gdgjakarta.com/2024?a=1,2",
        archived: false,
        legacyClicks: 95,
      },
    ];

    const merged = mergeArchivedCsvLinks(apiLinks, csvLinks);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].archived, true);
    assert.equal(merged[0].legacyClicks, 120);
    assert.equal(merged[1].path, "csv-only");
  });
});

describe("D1 SQL Generation, Schema Execution & Idempotency", () => {
  test("executes generated SQL on node:sqlite, handles SQL escaping, dangling folders, Pro fields, and idempotent re-runs", () => {
    const db = openMigratedDb();
    try {
      const backupPass1 = {
        domains: [
          {
            id: 1516440,
            hostname: "GDGJakarta.ORG.",
            state: "configured",
            linkType: "custom",
            appleAppSiteAssociation: '{"applinks":{"details":[]}}',
          },
        ],
        folders: [{ id: "fld_events", DomainId: 1516440, name: "Events & 'Talks'", color: "#0693E3" }],
        links: [
          {
            idString: "lnk_devfest26",
            DomainId: 1516440,
            hostname: "GDGJakarta.ORG.",
            path: "/devfest26",
            originalURL: "https://gdgjakarta.com/events/devfest?q=O'Reilly",
            title: "DevFest '26 — O'Reilly Edition",
            tags: ["devfest", "2026"],
            FolderId: "fld_events",
            redirectType: "301",
            expiresAt: 1767225600, // seconds (< 1e12) -> must convert to ms
            expiredURL: "https://gdgjakarta.com/expired",
            cloaking: true,
            androidURL: "https://play.google.com/store/apps/details?id=org.gdgjakarta",
            iphoneURL: "https://apps.apple.com/app/id123",
            geoTargets: [{ country: "id", url: "https://gdgjakarta.com/id" }],
            utmSource: "newsletter",
            utmMedium: "email",
            utmCampaign: "df26",
            integrationFB: "fb_123",
            integrationGTM: "GTM-ABC",
            integrationGA: "G-XYZ",
            clicksLimit: 500,
            splitURL: "https://gdgjakarta.com/events/devfest-b",
            splitPercent: 30,
            OwnerId: 99,
            User: { id: 99, name: "Org", email: "org@gdgjakarta.com" },
            legacyClicks: 250,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
          {
            idString: "lnk_dangling",
            DomainId: 1516440,
            path: "dangling-folder",
            originalURL: "https://gdgjakarta.com/dangling",
            FolderId: "fld_nonexistent",
            expiresAt: "2026-12-31T23:59:59.000Z",
            archived: true,
            legacyClicks: 10,
          },
          {
            idString: "lnk_pw",
            DomainId: 1516440,
            path: "secret-deck",
            originalURL: "https://gdgjakarta.com/deck",
            hasPassword: true,
            legacyClicks: 14,
          },
        ],
      };

      const dataset1 = buildMigrationDataset(backupPass1, { nowIso: "2026-05-01T00:00:00.000Z" });
      const sql1 = generateMigrationSql(dataset1);

      // Remote D1 compatibility: no explicit transaction statements
      assert.equal(/\bBEGIN\s+TRANSACTION\b/i.test(sql1), false);
      assert.equal(/\bCOMMIT\s*;/i.test(sql1), false);

      db.exec(sql1);

      const devfestRow = db
        .prepare("SELECT * FROM short_links WHERE hostname = ? AND path = ?")
        .get("gdgjakarta.org", "devfest26");
      assert.equal(devfestRow.id, "lnk_devfest26");
      assert.equal(devfestRow.title, "DevFest '26 — O'Reilly Edition");
      assert.equal(devfestRow.original_url, "https://gdgjakarta.com/events/devfest?q=O'Reilly");
      assert.equal(devfestRow.folder_id, "fld_events");
      assert.equal(devfestRow.redirect_type, 301);
      assert.equal(devfestRow.expires_at, 1767225600000);
      assert.equal(devfestRow.cloaking, 1);
      assert.equal(devfestRow.max_clicks, 500);
      assert.equal(devfestRow.legacy_clicks, 250);
      assert.equal(devfestRow.clicks_count, 0);
      assert.equal(devfestRow.link_type, "split");
      assert.deepEqual(JSON.parse(devfestRow.split_targets_json), [
        { url: "https://gdgjakarta.com/events/devfest?q=O'Reilly", weight: 70, label: "Control" },
        { url: "https://gdgjakarta.com/events/devfest-b", weight: 30, label: "Variant B" },
      ]);
      assert.deepEqual(JSON.parse(devfestRow.utm_params_json), {
        source: "newsletter",
        medium: "email",
        campaign: "df26",
      });
      assert.deepEqual(JSON.parse(devfestRow.pixels_json), {
        metaPixelId: "fb_123",
        gtmId: "GTM-ABC",
        ga4Id: "G-XYZ",
      });
      assert.equal(devfestRow.owner_id, 99);
      assert.equal(devfestRow.owner_email, "org@gdgjakarta.com");

      // Dangling FolderId must fall back to NULL and warn
      const danglingRow = db.prepare("SELECT * FROM short_links WHERE id = ?").get("lnk_dangling");
      assert.equal(danglingRow.folder_id, null);
      assert.equal(danglingRow.archived, 1);
      assert.equal(danglingRow.expires_at, Date.parse("2026-12-31T23:59:59.000Z"));
      assert.ok(dataset1.warnings.some((w) => w.code === "DANGLING_FOLDER_ID" && w.linkId === "lnk_dangling"));

      // Password-protected link must be flagged with password_hash=NULL and has_password=1
      const pwRow = db.prepare("SELECT * FROM short_links WHERE id = ?").get("lnk_pw");
      assert.equal(pwRow.has_password, 1);
      assert.equal(pwRow.password_hash, null);

      const report1 = buildMigrationReport(dataset1);
      assert.equal(report1.flaggedPasswordLinks.length, 1);
      assert.equal(report1.flaggedPasswordLinks[0].path, "secret-deck");
      const banner = formatPasswordWarningBanner(report1.flaggedPasswordLinks);
      assert.match(banner, /gdgjakarta\.org\/secret-deck/);

      // Simulate live Worker traffic & organizer password re-entry in D1
      db.prepare("UPDATE short_links SET clicks_count = 42 WHERE id = ?").run("lnk_devfest26");
      db.prepare("UPDATE short_links SET clicks_count = 9, password_hash = ? WHERE id = ?").run(
        "pbkdf2$00112233$44556677",
        "lnk_pw",
      );

      // Re-run migration with a different idString for the same (hostname, path) + updated/lower legacyClicks
      const backupPass2 = {
        ...backupPass1,
        links: [
          {
            ...backupPass1.links[0],
            idString: "lnk_different_id_should_not_overwrite",
            legacyClicks: 280, // higher -> MAX takes 280
          },
          {
            ...backupPass1.links[1],
            legacyClicks: 3, // lower than existing 10 -> MAX keeps 10
          },
          {
            ...backupPass1.links[2],
            legacyClicks: 14,
          },
        ],
      };

      const dataset2 = buildMigrationDataset(backupPass2, { nowIso: "2026-05-02T00:00:00.000Z" });
      const sql2 = generateMigrationSql(dataset2);
      db.exec(sql2);

      const devfestAfter = db
        .prepare("SELECT * FROM short_links WHERE hostname = ? AND path = ?")
        .get("gdgjakarta.org", "devfest26");
      assert.equal(devfestAfter.id, "lnk_devfest26");
      assert.equal(devfestAfter.clicks_count, 42);
      assert.equal(devfestAfter.legacy_clicks, 280);

      const danglingAfter = db.prepare("SELECT * FROM short_links WHERE id = ?").get("lnk_dangling");
      assert.equal(danglingAfter.legacy_clicks, 10);

      const pwAfter = db.prepare("SELECT * FROM short_links WHERE id = ?").get("lnk_pw");
      assert.equal(pwAfter.clicks_count, 9);
      assert.equal(pwAfter.has_password, 1);
      assert.equal(pwAfter.password_hash, "pbkdf2$00112233$44556677");

      const totalLinks = db.prepare("SELECT COUNT(*) AS count FROM short_links").get();
      assert.equal(totalLinks.count, 3);
    } finally {
      db.close();
    }
  });

  test("maps bundle linkType and preserves normalized KV bulk payload schema", () => {
    assert.equal(buildLinkKvKey("  GDGJakarta.ORG. ", "/devfest"), "gdgjakarta.org:devfest");
    assert.equal(buildDomainKvKey("  GDGJakarta.ORG. "), "gdgjakarta.org:__domain__");

    const dataset = buildMigrationDataset(
      {
        domains: [{ id: 1516440, hostname: "GDGJakarta.ORG.", state: "configured", linkType: "custom" }],
        folders: [],
        links: [
          {
            idString: "lnk_bundle",
            path: "/links",
            originalURL: "https://gdgjakarta.com",
            linkType: "bundle",
            bundleItems: [
              { title: "Website", url: "https://gdgjakarta.com", description: "Main site" },
              { title: "Registration", url: "https://gdgjakarta.com/events" },
            ],
            hasPassword: true,
          },
        ],
      },
      { nowIso: "2026-06-01T00:00:00.000Z" },
    );

    const kvPayload = generateKvBulkPayload(dataset);
    assert.equal(kvPayload.length, 2);

    const domainEntry = kvPayload.find((e) => e.key === "gdgjakarta.org:__domain__");
    assert.ok(domainEntry);
    const domainVal = JSON.parse(domainEntry.value);
    assert.equal(domainVal.hostname, "gdgjakarta.org");
    assert.equal(domainVal.id, 1516440);

    const linkEntry = kvPayload.find((e) => e.key === "gdgjakarta.org:links");
    assert.ok(linkEntry);
    const linkVal = JSON.parse(linkEntry.value);
    assert.equal(linkVal.id, "lnk_bundle");
    assert.equal(linkVal.linkType, "bundle");
    assert.equal(linkVal.bundleItems.length, 2);
    assert.equal(linkVal.passwordHash, null);
  });

  test("mapShortioLinkToRecord rejects links missing slug path or originalURL", () => {
    assert.throws(() => mapShortioLinkToRecord({ originalURL: "https://gdgjakarta.com" }), /missing slug path/);
    assert.throws(() => mapShortioLinkToRecord({ path: "abc" }), /missing originalURL/);
  });
});

describe("Offline Backup Replay, Dry-Run Safety, Wrangler Execution & CLI", () => {
  test("creates JSON backup on API export, replays --from-backup offline, and guards Wrangler calls", async () => {
    const tmpDir = makeTempDir();
    try {
      const backupFile = path.join(tmpDir, "backup.json");
      const sqlFile = path.join(tmpDir, "out.sql");
      const kvFile = path.join(tmpDir, "out-kv.json");
      const reportFile = path.join(tmpDir, "report.json");

      const mockFetch = async (urlStr) => {
        const url = new URL(String(urlStr));
        if (url.pathname === "/api/domains") {
          return jsonResponse([{ id: 1516440, hostname: "gdgjakarta.org", state: "configured" }]);
        }
        if (url.pathname === "/links/folders/1516440") {
          return jsonResponse({ linkFolders: [{ id: "fld_1", name: "Core", color: "#0693E3", DomainId: 1516440 }] });
        }
        if (url.pathname === "/api/links") {
          return jsonResponse({
            links: [
              {
                idString: "lnk_cli_1",
                path: "hello",
                originalURL: "https://gdgjakarta.com/hello",
                FolderId: "fld_1",
                hasPassword: true,
              },
            ],
          });
        }
        if (url.pathname === "/statistics/domain/1516440/link_clicks") {
          return jsonResponse({ lnk_cli_1: 77 });
        }
        return jsonResponse({}, 404);
      };

      const execCalls = [];
      const mockExecFile = async (cmd, args) => {
        execCalls.push({ cmd, args });
        return { stdout: "", stderr: "" };
      };

      // 1. Export + dry-run (default) -> writes backup, does NOT call Wrangler
      const dryOptions = parseCliArgs(
        ["--backup", backupFile, "--out-sql", sqlFile, "--out-kv", kvFile, "--out-report", reportFile],
        { SHORTIO_API_KEY: "sk_test" },
      );
      const outBuf1 = createBufferWriter();
      const errBuf1 = createBufferWriter();

      const res1 = await runMigration(dryOptions, {
        fetchImpl: mockFetch,
        execFileImpl: mockExecFile,
        cwd: tmpDir,
        env: { SHORTIO_API_KEY: "sk_test" },
        stdout: outBuf1.stream,
        stderr: errBuf1.stream,
      });

      assert.equal(execCalls.length, 0);
      assert.equal(fs.existsSync(backupFile), true);
      assert.equal(fs.existsSync(sqlFile), true);
      assert.equal(fs.existsSync(kvFile), true);
      assert.equal(fs.existsSync(reportFile), true);
      assert.match(errBuf1.read(), /gdgjakarta\.org\/hello/);
      assert.equal(res1.report.summary.totalLegacyClicks, 77);

      // 2. Replay from backup with throwing fetch (zero network calls) and --apply-d1 --apply-kv (local default)
      const localApplyOptions = parseCliArgs([
        "--from-backup",
        backupFile,
        "--out-sql",
        sqlFile,
        "--out-kv",
        kvFile,
        "--apply-d1",
        "--apply-kv",
      ]);
      const res2 = await runMigration(localApplyOptions, {
        fetchImpl: () => {
          throw new Error("Network must not be called in --from-backup mode!");
        },
        execFileImpl: mockExecFile,
        cwd: tmpDir,
        stdout: createBufferWriter().stream,
        stderr: createBufferWriter().stream,
      });

      assert.equal(res2.report.summary.totalLegacyClicks, 77);
      assert.equal(execCalls.length, 2);
      assert.deepEqual(execCalls[0], {
        cmd: "npx",
        args: [
          "wrangler",
          "d1",
          "execute",
          "gdgjakarta-shortlinks",
          "--file",
          sqlFile,
          "--yes",
          "--local",
          "-c",
          "wrangler.jsonc",
        ],
      });
      assert.deepEqual(execCalls[1], {
        cmd: "npx",
        args: ["wrangler", "kv", "bulk", "put", kvFile, "--binding=SHORTLINKS_KV", "--local", "-c", "wrangler.jsonc"],
      });

      // 3. Explicit --dry-run overrides --apply-d1 --remote
      const forcedDry = parseCliArgs(["--from-backup", backupFile, "--apply-d1", "--remote", "--dry-run"]);
      await runMigration(forcedDry, {
        fetchImpl: () => {
          throw new Error("Network must not be called!");
        },
        execFileImpl: mockExecFile,
        cwd: tmpDir,
        stdout: createBufferWriter().stream,
        stderr: createBufferWriter().stream,
      });
      assert.equal(execCalls.length, 2);

      // 4. --remote + --kv-namespace-id passes --remote and --namespace-id=<id>
      const remoteOptions = parseCliArgs([
        "--from-backup",
        backupFile,
        "--out-sql",
        sqlFile,
        "--out-kv",
        kvFile,
        "--apply-d1",
        "--apply-kv",
        "--remote",
        "--kv-namespace-id",
        "kv_ns_123",
      ]);
      await runMigration(remoteOptions, {
        fetchImpl: () => {
          throw new Error("Network must not be called!");
        },
        execFileImpl: mockExecFile,
        cwd: tmpDir,
        stdout: createBufferWriter().stream,
        stderr: createBufferWriter().stream,
      });
      assert.equal(execCalls.length, 4);
      assert.ok(execCalls[2].args.includes("--remote"));
      assert.ok(execCalls[3].args.includes("--remote"));
      assert.ok(execCalls[3].args.includes("--namespace-id=kv_ns_123"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("executes CLI child process cleanly in --from-backup --dry-run mode", async () => {
    const tmpDir = makeTempDir();
    try {
      const fixtureBackup = path.join(tmpDir, "fixture-backup.json");
      const outSql = path.join(tmpDir, "cli.sql");
      const outKv = path.join(tmpDir, "cli-kv.json");
      const outReport = path.join(tmpDir, "cli-report.json");

      fs.writeFileSync(
        fixtureBackup,
        JSON.stringify({
          domains: [{ id: 1516440, hostname: "gdgjakarta.org", state: "configured" }],
          folders: [{ id: "fld_cli", DomainId: 1516440, name: "CLI", color: "#0693E3" }],
          links: [
            {
              idString: "lnk_100",
              path: "cli-test",
              originalURL: "https://gdgjakarta.com/cli",
              FolderId: "fld_cli",
              legacyClicks: 12,
              hasPassword: true,
            },
          ],
        }),
        "utf8",
      );

      const childResult = await new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            MIGRATION_SCRIPT_PATH,
            "--from-backup",
            fixtureBackup,
            "--out-sql",
            outSql,
            "--out-kv",
            outKv,
            "--out-report",
            outReport,
            "--dry-run",
          ],
          { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
          stdout += String(chunk);
        });
        child.stderr.on("data", (chunk) => {
          stderr += String(chunk);
        });
        child.on("error", reject);
        child.on("close", (code) => resolve({ code, stdout, stderr }));
      });

      assert.equal(childResult.code, 0);
      assert.match(childResult.stderr, /gdgjakarta\.org\/cli-test/);
      const parsedOut = JSON.parse(childResult.stdout);
      assert.equal(parsedOut.mode, "dry-run");
      assert.equal(parsedOut.summary.linksCount, 1);
      assert.equal(parsedOut.summary.totalLegacyClicks, 12);
      assert.equal(parsedOut.flaggedPasswordLinks.length, 1);

      const report = JSON.parse(fs.readFileSync(outReport, "utf8"));
      assert.equal(report.flaggedPasswordLinks[0].path, "cli-test");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("M5 Iteration 2 Regression Guards", () => {
  test("handles folder rename with same id and same-name/different-id collision under PRAGMA foreign_keys = ON", () => {
    const db = openMigratedDb();
    try {
      db.prepare("INSERT INTO short_domains (id, hostname) VALUES (1516440, 'gdgjakarta.org')").run();
      db.prepare(
        "INSERT INTO short_folders (id, domain_id, name, color) VALUES ('fld_1', 1516440, 'Old Name', '#111111')",
      ).run();
      db.prepare(
        "INSERT INTO short_folders (id, domain_id, name, color) VALUES ('fld_existing', 1516440, 'Events', '#222222')",
      ).run();
      db.prepare(
        "INSERT INTO short_links (id, domain_id, hostname, path, original_url, folder_id) VALUES ('lnk_keep_folder', 1516440, 'gdgjakarta.org', 'keep', 'https://gdgjakarta.com/keep', 'fld_1')",
      ).run();

      const dataset = buildMigrationDataset(
        {
          domains: [{ id: 1516440, hostname: "gdgjakarta.org" }],
          folders: [
            { id: "fld_1", DomainId: 1516440, name: "New Name", color: "#34A853" },
            { id: "fld_shortio_dup", DomainId: 1516440, name: "Events", color: "#4285F4" },
          ],
          links: [
            {
              idString: "lnk_keep_folder",
              DomainId: 1516440,
              hostname: "gdgjakarta.org",
              path: "keep",
              originalURL: "https://gdgjakarta.com/keep",
              FolderId: "fld_1",
            },
            {
              idString: "lnk_dup_folder",
              DomainId: 1516440,
              hostname: "gdgjakarta.org",
              path: "dup-folder",
              originalURL: "https://gdgjakarta.com/dup",
              FolderId: "fld_shortio_dup",
            },
          ],
        },
        { nowIso: "2026-07-01T00:00:00.000Z" },
      );

      db.exec(generateMigrationSql(dataset));

      const renamedFolder = db.prepare("SELECT * FROM short_folders WHERE id = ?").get("fld_1");
      assert.equal(renamedFolder.name, "New Name");
      assert.equal(renamedFolder.color, "#34A853");

      const existingEventsFolder = db.prepare("SELECT * FROM short_folders WHERE id = ?").get("fld_existing");
      assert.equal(existingEventsFolder.name, "Events");
      assert.equal(existingEventsFolder.color, "#4285F4");

      const keepLink = db.prepare("SELECT folder_id FROM short_links WHERE id = ?").get("lnk_keep_folder");
      assert.equal(keepLink.folder_id, "fld_1");

      const dupLink = db.prepare("SELECT folder_id FROM short_links WHERE id = ?").get("lnk_dup_folder");
      assert.equal(dupLink.folder_id, "fld_existing");
    } finally {
      db.close();
    }
  });

  test("serializes object-valued appleAppSiteAssociation and assetLinks as valid JSON in D1 SQL and KV", () => {
    const db = openMigratedDb();
    try {
      const aasaObj = { applinks: { apps: [], details: [{ appID: "TEAM.org.gdgjakarta", paths: ["/e/*"] }] } };
      const assetLinksArr = [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: { namespace: "android_app", package_name: "org.gdgjakarta" },
        },
      ];

      const dataset = buildMigrationDataset(
        {
          domains: [
            {
              id: 1516440,
              hostname: "gdgjakarta.org",
              appleAppSiteAssociation: aasaObj,
              assetLinks: assetLinksArr,
            },
          ],
          folders: [],
          links: [],
        },
        { nowIso: "2026-07-01T00:00:00.000Z" },
      );

      db.exec(generateMigrationSql(dataset));
      const row = db
        .prepare("SELECT apple_app_site_association, asset_links FROM short_domains WHERE id = 1516440")
        .get();
      assert.deepEqual(JSON.parse(row.apple_app_site_association), aasaObj);
      assert.deepEqual(JSON.parse(row.asset_links), assetLinksArr);

      const kv = generateKvBulkPayload(dataset);
      const domainKv = JSON.parse(kv.find((entry) => entry.key === "gdgjakarta.org:__domain__").value);
      assert.deepEqual(JSON.parse(domainKv.appleAppSiteAssociation), aasaObj);
      assert.deepEqual(JSON.parse(domainKv.assetLinks), assetLinksArr);
    } finally {
      db.close();
    }
  });

  test("synthesizes missing short_domains row for unknown link hostname so D1 domain_id never violates NOT NULL", () => {
    const db = openMigratedDb();
    try {
      const dataset = buildMigrationDataset(
        {
          domains: [{ id: 1516440, hostname: "gdgjakarta.org" }],
          folders: [],
          links: [
            {
              idString: "lnk_other_host",
              DomainId: 9999999,
              hostname: "other.gdgjakarta.org",
              path: "other",
              originalURL: "https://gdgjakarta.com/other",
            },
            {
              idString: "lnk_colliding_id_host",
              DomainId: 1516440,
              hostname: "third.gdgjakarta.org",
              path: "third",
              originalURL: "https://gdgjakarta.com/third",
            },
          ],
        },
        { nowIso: "2026-07-01T00:00:00.000Z" },
      );

      assert.ok(
        dataset.warnings.some((w) => w.code === "SYNTHESIZED_LINK_DOMAIN" && w.hostname === "other.gdgjakarta.org"),
      );
      assert.ok(
        dataset.warnings.some((w) => w.code === "SYNTHESIZED_LINK_DOMAIN" && w.hostname === "third.gdgjakarta.org"),
      );

      db.exec(generateMigrationSql(dataset));

      const otherRow = db.prepare("SELECT domain_id, hostname FROM short_links WHERE id = ?").get("lnk_other_host");
      assert.equal(otherRow.domain_id, 9999999);
      assert.equal(otherRow.hostname, "other.gdgjakarta.org");

      const thirdRow = db
        .prepare("SELECT domain_id, hostname FROM short_links WHERE id = ?")
        .get("lnk_colliding_id_host");
      assert.equal(typeof thirdRow.domain_id, "number");
      assert.notEqual(thirdRow.domain_id, 1516440);
      assert.equal(thirdRow.hostname, "third.gdgjakarta.org");

      const kv = generateKvBulkPayload(dataset);
      assert.ok(kv.some((entry) => entry.key === "other.gdgjakarta.org:__domain__"));
      assert.ok(kv.some((entry) => entry.key === "third.gdgjakarta.org:__domain__"));
    } finally {
      db.close();
    }
  });

  test("produces 100% byte-identical SQL and KV JSON across repeated --from-backup replays separated in time", async () => {
    const tmpDir = makeTempDir();
    try {
      const backupFile = path.join(tmpDir, "backup.json");
      const sql1 = path.join(tmpDir, "run1.sql");
      const kv1 = path.join(tmpDir, "run1-kv.json");
      const sql2 = path.join(tmpDir, "run2.sql");
      const kv2 = path.join(tmpDir, "run2-kv.json");

      // Backup intentionally omits domain.updatedAt, folder timestamps, and link timestamps
      fs.writeFileSync(
        backupFile,
        JSON.stringify({
          version: 1,
          exportedAt: "2026-11-27T10:00:00.000Z",
          source: "shortio-api",
          domains: [
            { id: 1516440, hostname: "gdgjakarta.org", state: "configured", createdAt: "2025-01-01T00:00:00.000Z" },
          ],
          folders: [{ id: "fld_1", DomainId: 1516440, name: "Events", color: "#0693E3" }],
          links: [
            {
              idString: "lnk_replay",
              DomainId: 1516440,
              hostname: "gdgjakarta.org",
              path: "replay-check",
              originalURL: "https://gdgjakarta.com/replay",
              FolderId: "fld_1",
              legacyClicks: 42,
            },
          ],
          warnings: [],
        }),
        "utf8",
      );

      await runMigration(parseCliArgs(["--from-backup", backupFile, "--out-sql", sql1, "--out-kv", kv1, "--dry-run"]), {
        cwd: tmpDir,
        now: () => new Date("2026-11-27T11:00:00.000Z"),
        stdout: createBufferWriter().stream,
        stderr: createBufferWriter().stream,
      });

      await runMigration(parseCliArgs(["--from-backup", backupFile, "--out-sql", sql2, "--out-kv", kv2, "--dry-run"]), {
        cwd: tmpDir,
        now: () => new Date("2026-11-28T15:30:45.123Z"),
        stdout: createBufferWriter().stream,
        stderr: createBufferWriter().stream,
      });

      assert.equal(fs.readFileSync(kv1, "utf8"), fs.readFileSync(kv2, "utf8"));
      assert.equal(fs.readFileSync(sql1, "utf8"), fs.readFileSync(sql2, "utf8"));

      const kvEntries = JSON.parse(fs.readFileSync(kv1, "utf8"));
      const domainEntry = JSON.parse(kvEntries.find((e) => e.key === "gdgjakarta.org:__domain__").value);
      assert.equal(domainEntry.updatedAt, "2025-01-01T00:00:00.000Z");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("mergeArchivedCsvLinks falls back to hostname:path key when CSV link has empty id and idString", () => {
    const apiLinks = [
      {
        idString: "lnk_1",
        hostname: "gdgjakarta.org",
        path: "dup",
        originalURL: "https://gdgjakarta.com",
        archived: false,
        legacyClicks: 10,
      },
    ];
    const csvLinks = [
      {
        id: "",
        idString: "",
        hostname: "gdgjakarta.org",
        path: "dup",
        originalURL: "https://gdgjakarta.com",
        archived: true,
        legacyClicks: 25,
      },
    ];

    const merged = mergeArchivedCsvLinks(apiLinks, csvLinks);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].idString, "lnk_1");
    assert.equal(merged[0].archived, true);
    assert.equal(merged[0].legacyClicks, 25);
  });
});
