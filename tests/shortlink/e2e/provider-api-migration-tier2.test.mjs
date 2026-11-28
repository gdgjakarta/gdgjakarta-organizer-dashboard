import {
  bootShortlinkHarness,
  getKvValue,
  getLinkRow,
  harnessState,
  installShortlinkHooks,
  runMigrationCli,
  seedClick,
  seedDomain,
  seedLink,
} from "./harness.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

function makeTempDir(prefix = "shortlink-e2e-m3-t2-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeDirQuietly(dirPath) {
  if (dirPath && fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function splitSqlStatements(sqlText) {
  const statements = [];
  let current = "";
  let inSingle = false;
  let inLineComment = false;

  for (let i = 0; i < sqlText.length; i += 1) {
    const ch = sqlText[i];
    const next = sqlText[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (!inSingle && ch === "-" && next === "-") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === "'") {
      current += ch;
      if (inSingle && next === "'") {
        current += next;
        i += 1;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }

    if (!inSingle && ch === ";") {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }
  return statements;
}

describe("E2E-M3 Tier 2: Boundaries, Edge Cases, RBAC & Negative Paths (F11-F14)", () => {
  let harness;
  const tempDirsToClean = [];

  before(async () => {
    installShortlinkHooks();
    harness = await bootShortlinkHarness({
      env: {
        SHORTLINK_PROVIDER: "cloudflare",
        SHORTLINK_API_KEY: "test-shortlink-api-key",
        N8N_WEBHOOK_API_KEY: "test-n8n-api-key",
      },
    });
  });

  beforeEach(async () => {
    await harness.resetState();
    await seedDomain(harness.db, { id: 1516440, hostname: "gdgjakarta.org" });
    harnessState.setAuthRole("organizer");
  });

  after(async () => {
    for (const dir of tempDirsToClean) {
      removeDirQuietly(dir);
    }
    if (harness) {
      await harness.dispose();
    }
  });

  // =========================================================================
  // F11: Boundaries, RBAC & Negative Cases
  // =========================================================================

  it("F11.T2.1: defaults SHORTLINK_PROVIDER to 'shortio' when unset", async () => {
    const envMod = await import("@/lib/shortlinks/env");
    const shortioActions = await import("@/server/shortio-actions");

    harnessState.setEnv({ SHORTLINK_PROVIDER: undefined });
    assert.equal(await envMod.getShortlinkProvider(), "shortio");

    harnessState.shortio.seed({
      links: [{ id: "lnk_default_sio", path: "default-sio", originalURL: "https://gdgjakarta.com/sio" }],
    });

    const cfg = await shortioActions.getShortlinkDashboardConfigAction();
    assert.equal(cfg.success, true);
    assert.equal(cfg.data?.provider, "shortio");

    const listRes = await shortioActions.fetchShortLinksAction({ limit: 20 });
    assert.equal(listRes.success, true);
    assert.equal(listRes.data?.[0]?.path, "default-sio");
    assert.ok(harnessState.shortio.requests.length >= 1);
  });

  it("F11.T2.2: enforces RBAC rejecting unauthenticated/member callers and non-executive domain mutations", async () => {
    const shortioActions = await import("@/server/shortio-actions");
    const advancedActions = await import("@/server/shortio-advanced-actions");

    for (const role of ["unauthenticated", "member"]) {
      harnessState.setAuthRole(role);
      const createRes = await shortioActions.createShortLinkAction({
        path: "rbac-deny",
        originalURL: "https://gdgjakarta.com/deny",
      });
      assert.equal(createRes.success, false);
      assert.match(createRes.error ?? "", /Unauthorized/);

      const listRes = await shortioActions.fetchShortLinksAction();
      assert.equal(listRes.success, false);
      assert.match(listRes.error ?? "", /Unauthorized/);

      const folderRes = await shortioActions.createShortFolderAction({ name: "Forbidden" });
      assert.equal(folderRes.success, false);
      assert.match(folderRes.error ?? "", /Unauthorized/);

      const archRes = await advancedActions.archiveShortLinksAction(["lnk_any"]);
      assert.equal(archRes.success, false);
      assert.match(archRes.error ?? "", /Unauthorized/);
    }

    // Standard organizer (non-executive) cannot create/update/delete domains
    harnessState.setAuthRole("organizer");
    const domCreate = await advancedActions.createShortDomainAction("sub.gdgjakarta.org");
    assert.equal(domCreate.success, false);
    assert.match(domCreate.error ?? "", /Executive organizer privileges required/);

    const domUpdate = await advancedActions.updateShortDomainConfigAction(1516440, { state: "configured" });
    assert.equal(domUpdate.success, false);
    assert.match(domUpdate.error ?? "", /Executive organizer privileges required/);

    const domDelete = await advancedActions.deleteShortDomainAction(2000001);
    assert.equal(domDelete.success, false);
    assert.match(domDelete.error ?? "", /Executive organizer privileges required/);
  });

  it("F11.T2.3: rejects duplicate custom slugs and invalid link inputs without corrupting existing D1/KV records", async () => {
    const shortioActions = await import("@/server/shortio-actions");

    const first = await shortioActions.createShortLinkAction({
      path: "unique-slug",
      originalURL: "https://gdgjakarta.com/original",
    });
    assert.equal(first.success, true);

    // Duplicate slug
    const dup = await shortioActions.createShortLinkAction({
      path: "unique-slug",
      originalURL: "https://gdgjakarta.com/hijack",
    });
    assert.equal(dup.success, false);
    assert.match(dup.error ?? "", /already exists/i);
    assert.equal(
      (await getKvValue(harness.kv, "gdgjakarta.org:unique-slug"))?.originalURL,
      "https://gdgjakarta.com/original",
    );

    // Non-HTTP URL
    const badProto = await shortioActions.createShortLinkAction({
      path: "bad-proto",
      originalURL: "javascript:alert(1)",
    });
    assert.equal(badProto.success, false);

    // Invalid redirectType
    const badRedirect = await shortioActions.createShortLinkAction({
      path: "bad-redir",
      originalURL: "https://gdgjakarta.com/ok",
      redirectType: 404,
    });
    assert.equal(badRedirect.success, false);
    assert.match(badRedirect.error ?? "", /redirectType/);

    // Invalid slug characters ('?' or whitespace)
    const badSlug = await shortioActions.createShortLinkAction({
      path: "bad slug?x=1",
      originalURL: "https://gdgjakarta.com/ok",
    });
    assert.equal(badSlug.success, false);

    // Empty split/bundle payloads
    const emptySplit = await shortioActions.createShortLinkAction({
      path: "empty-split",
      originalURL: "https://gdgjakarta.com/ok",
      linkType: "split",
      splitTargets: [],
    });
    assert.equal(emptySplit.success, false);
  });

  it("F11.T2.4: handles missing link/folder targets, primary domain protection, and invalid deep-link JSON", async () => {
    const shortioActions = await import("@/server/shortio-actions");
    const advancedActions = await import("@/server/shortio-advanced-actions");

    const updMissing = await shortioActions.updateShortLinkAction("lnk_nonexistent", { title: "Nope" });
    assert.equal(updMissing.success, false);
    assert.match(updMissing.error ?? "", /not found/i);

    const delMissing = await shortioActions.deleteShortLinkAction("lnk_nonexistent");
    assert.equal(delMissing.success, false);

    const delFolderMissing = await shortioActions.deleteShortFolderAction("fld_nonexistent");
    assert.equal(delFolderMissing.success, false);

    harnessState.setAuthRole("executive");
    const delPrimary = await advancedActions.deleteShortDomainAction(1516440);
    assert.equal(delPrimary.success, false);
    assert.match(delPrimary.error ?? "", /primary domain/i);

    const badAasa = await advancedActions.updateShortDomainConfigAction(1516440, {
      appleAppSiteAssociation: "{not-valid-json",
    });
    assert.equal(badAasa.success, false);
    assert.match(badAasa.error ?? "", /valid JSON/);
  });

  it("F11.T2.5: handles bulk validation boundaries, archive/unarchive on empty/mixed IDs, and missing Cloudflare bindings", async () => {
    const shortioActions = await import("@/server/shortio-actions");
    const advancedActions = await import("@/server/shortio-advanced-actions");

    const emptyBulkMove = await shortioActions.bulkMoveLinksToFolderAction([], null);
    assert.equal(emptyBulkMove.success, false);

    const emptyBulkDel = await shortioActions.bulkDeleteShortLinksAction([]);
    assert.equal(emptyBulkDel.success, false);

    const emptyArchive = await advancedActions.archiveShortLinksAction([]);
    assert.equal(emptyArchive.success, false);

    const badBulkImport = await advancedActions.bulkImportShortLinksAction([
      { originalURL: "ftp://invalid.example.com", path: "bad-ftp" },
    ]);
    assert.equal(badBulkImport.success, false);
    assert.match(badBulkImport.error ?? "", /Invalid URL/);

    const badStatsId = await advancedActions.getLinkStatsAction("not_a_link_id", "total");
    assert.equal(badStatsId.success, false);
    assert.equal(badStatsId.error, "Invalid request");

    // Verify missing Cloudflare bindings fail clearly in cloudflare mode
    const activeBefore = harnessState.getActiveBindings();
    harnessState.setActiveBindings({ SHORTLINKS_DB: null, SHORTLINKS_KV: null });
    try {
      const noBindingsRes = await shortioActions.fetchShortLinksAction();
      assert.equal(noBindingsRes.success, false);
      assert.match(noBindingsRes.error ?? "", /SHORTLINKS_DB|Cloudflare/i);
    } finally {
      harnessState.setActiveBindings({
        SHORTLINKS_DB: activeBefore.SHORTLINKS_DB,
        SHORTLINKS_KV: activeBefore.SHORTLINKS_KV,
      });
    }
  });

  it("F11.T2.6: syncs archived status to KV and preserves KV deletion consistency on archive/delete", async () => {
    const shortioActions = await import("@/server/shortio-actions");
    const advancedActions = await import("@/server/shortio-advanced-actions");

    const created = await shortioActions.createShortLinkAction({
      path: "archive-kv-test",
      originalURL: "https://gdgjakarta.com/archive-kv",
    });
    assert.equal(created.success, true);

    await advancedActions.archiveShortLinksAction([created.data.id]);
    const kvArchived = await getKvValue(harness.kv, "gdgjakarta.org:archive-kv-test");
    assert.equal(kvArchived?.archived, true);

    // Archived links are excluded from default fetchShortLinksAction unless archived=true or "all"
    const activeOnly = await shortioActions.fetchShortLinksAction({ archived: false });
    assert.equal(
      activeOnly.data?.some((l) => l.id === created.data.id),
      false,
    );

    const archivedOnly = await shortioActions.fetchShortLinksAction({ archived: true });
    assert.equal(
      archivedOnly.data?.some((l) => l.id === created.data.id),
      true,
    );

    await shortioActions.deleteShortLinkAction(created.data.id);
    assert.equal(await getKvValue(harness.kv, "gdgjakarta.org:archive-kv-test"), null);
  });

  // =========================================================================
  // F12: Click Analytics & Clickstream Boundaries
  // =========================================================================

  it("F12.T2.1: handles zero-click empty links and legacy-only links across period windows", async () => {
    const advancedActions = await import("@/server/shortio-advanced-actions");

    const zeroLink = await seedLink(harness.db, {
      id: "lnk_zero_0",
      path: "zero-clicks",
      originalURL: "https://gdgjakarta.com/zero",
      legacyClicks: 0,
    });

    const zeroRes = await advancedActions.getLinkStatsAction(zeroLink.id, "total");
    assert.equal(zeroRes.success, true);
    assert.equal(zeroRes.data?.totalClicks, 0);
    assert.equal(zeroRes.data?.humanClicks, 0);
    assert.deepEqual(zeroRes.data?.country, []);
    assert.deepEqual(zeroRes.data?.cities, []);
    assert.deepEqual(zeroRes.data?.clickstream, []);

    const legacyOnly = await seedLink(harness.db, {
      id: "lnk_leg_only",
      path: "legacy-only",
      originalURL: "https://gdgjakarta.com/legacy-only",
      legacyClicks: 250,
    });

    const totalRes = await advancedActions.getLinkStatsAction(legacyOnly.id, "total");
    assert.equal(totalRes.success, true);
    assert.equal(totalRes.data?.totalClicks, 250);
    assert.equal(totalRes.data?.humanClicks, 250);
    assert.equal(totalRes.data?.legacyClicks, 250);

    // Legacy Short.io historical count is only added to "total", not "today" or "last7"
    const todayRes = await advancedActions.getLinkStatsAction(legacyOnly.id, "today");
    assert.equal(todayRes.success, true);
    assert.equal(todayRes.data?.totalClicks, 0);
    assert.equal(todayRes.data?.legacyClicks, 250);
  });

  it("F12.T2.2: computes humanClicks === 0 under 100% bot traffic including split-test variants", async () => {
    const advancedActions = await import("@/server/shortio-advanced-actions");

    const botLink = await seedLink(harness.db, {
      id: "lnk_bots_only",
      path: "bots-only",
      originalURL: "https://gdgjakarta.com/bots",
      linkType: "split",
      splitTargets: [
        { label: "A", url: "https://gdgjakarta.com/a", weight: 50 },
        { label: "B", url: "https://gdgjakarta.com/b", weight: 50 },
      ],
    });

    const now = Date.now();
    await seedClick(harness.db, {
      linkId: botLink.id,
      path: botLink.path,
      clickedAt: now - 2000,
      isBot: 1,
      variantLabel: "A",
    });
    await seedClick(harness.db, {
      linkId: botLink.id,
      path: botLink.path,
      clickedAt: now - 1000,
      isBot: 1,
      variantLabel: "B",
    });

    const stats = await advancedActions.getLinkStatsAction(botLink.id, "total");
    assert.equal(stats.success, true);
    assert.equal(stats.data?.totalClicks, 2);
    assert.equal(stats.data?.humanClicks, 0);
    assert.equal(stats.data?.splitVariants?.length, 2);
    assert.equal(stats.data?.splitVariants?.[0]?.humanClicks, 0);
    assert.equal(stats.data?.splitVariants?.[1]?.humanClicks, 0);
  });

  it("F12.T2.3: enforces period window cutoff boundaries and clickstream limit clamping [1..200]", async () => {
    const analyticsMod = await import("@/lib/shortlinks/analytics");

    const link = await seedLink(harness.db, {
      id: "lnk_win_1",
      path: "window-bounds",
      originalURL: "https://gdgjakarta.com/window",
    });

    // Anchor: 2026-11-27 12:00:00+07:00 = 2026-11-27T05:00:00.000Z
    const anchorMs = Date.parse("2026-11-27T05:00:00.000Z");
    const todayStartMs = analyticsMod.getPeriodStartMs("today", anchorMs);
    const last7StartMs = analyticsMod.getPeriodStartMs("last7", anchorMs);

    await seedClick(harness.db, { id: "clk_in_today", linkId: link.id, path: link.path, clickedAt: todayStartMs });
    await seedClick(harness.db, {
      id: "clk_before_today",
      linkId: link.id,
      path: link.path,
      clickedAt: todayStartMs - 1,
    });
    await seedClick(harness.db, { id: "clk_in_last7", linkId: link.id, path: link.path, clickedAt: last7StartMs });
    await seedClick(harness.db, {
      id: "clk_before_last7",
      linkId: link.id,
      path: link.path,
      clickedAt: last7StartMs - 1,
    });

    const todayStats = await analyticsMod.queryLinkStatsD1(harness.db, link.id, "today", anchorMs);
    assert.equal(todayStats.totalClicks, 1);

    const last7Stats = await analyticsMod.queryLinkStatsD1(harness.db, link.id, "last7", anchorMs);
    assert.equal(last7Stats.totalClicks, 3);

    const totalStats = await analyticsMod.queryLinkStatsD1(harness.db, link.id, "total", anchorMs);
    assert.equal(totalStats.totalClicks, 4);

    // Limit clamping: 0 clamps to 1
    const clampedMin = await analyticsMod.queryClickstreamD1(harness.db, { linkId: link.id, limit: 0 });
    assert.equal(clampedMin.length, 1);
  });

  it("F12.T2.4: normalizes null/missing geo, UA, and referer fields without throwing", async () => {
    const advancedActions = await import("@/server/shortio-advanced-actions");

    const link = await seedLink(harness.db, {
      id: "lnk_null_meta",
      path: "null-meta",
      originalURL: "https://gdgjakarta.com/null-meta",
    });

    await seedClick(harness.db, {
      linkId: link.id,
      path: link.path,
      clickedAt: Date.now(),
      country: null,
      city: null,
      browser: null,
      os: null,
      device: null,
      referer: null,
    });

    const stats = await advancedActions.getLinkStatsAction(link.id, "total");
    assert.equal(stats.success, true);
    assert.deepEqual(stats.data?.country, [{ country: "Unknown", score: 1 }]);
    assert.equal(stats.data?.cities?.[0]?.city, "Unknown");
    assert.deepEqual(stats.data?.browser, [{ browser: "Unknown", score: 1 }]);
    assert.deepEqual(stats.data?.os, [{ os: "Unknown", score: 1 }]);
    assert.deepEqual(stats.data?.device, [{ device: "Unknown", score: 1 }]);
    assert.deepEqual(stats.data?.referer, [{ referer: "Direct", score: 1 }]);
  });

  it("F12.T2.5: aggregates domain stats across active + archived links and rejects invalid periods/RBAC", async () => {
    const advancedActions = await import("@/server/shortio-advanced-actions");

    const active = await seedLink(harness.db, {
      id: "lnk_dom_active",
      path: "dom-a",
      originalURL: "https://gdgjakarta.com/a",
      legacyClicks: 30,
      archived: 0,
    });
    const archived = await seedLink(harness.db, {
      id: "lnk_dom_arch",
      path: "dom-b",
      originalURL: "https://gdgjakarta.com/b",
      legacyClicks: 70,
      archived: 1,
    });

    const now = Date.now();
    await seedClick(harness.db, { linkId: active.id, path: active.path, clickedAt: now - 1000, isBot: 0 });
    await seedClick(harness.db, { linkId: archived.id, path: archived.path, clickedAt: now - 500, isBot: 1 });

    const domStats = await advancedActions.getDomainStatsAction("total");
    assert.equal(domStats.success, true);
    assert.equal(domStats.data?.legacyClicks, 100);
    assert.equal(domStats.data?.totalClicks, 102);
    assert.equal(domStats.data?.humanClicks, 101);

    // Invalid period
    const badPeriod = await advancedActions.getDomainStatsAction("yearly");
    assert.equal(badPeriod.success, false);
    assert.equal(badPeriod.error, "Invalid period");

    // Non-existent link stats
    const missingStats = await advancedActions.getLinkStatsAction("lnk_missing_stats", "total");
    assert.equal(missingStats.success, false);
    assert.match(missingStats.error ?? "", /not found/i);

    // RBAC denial for member
    harnessState.setAuthRole("member");
    const memberDomStats = await advancedActions.getDomainStatsAction("total");
    assert.equal(memberDomStats.success, false);
    assert.match(memberDomStats.error ?? "", /Unauthorized/);
  });

  // =========================================================================
  // F13: External Shortening API (/api/links/shorten) Auth & Validation
  // =========================================================================

  it("F13.T2.1: fails closed with 401 on POST and GET when both SHORTLINK_API_KEY and N8N_WEBHOOK_API_KEY are unset", async () => {
    const { NextRequest } = await import("next/server");
    const route = await import("@/app/api/links/shorten/route");

    harnessState.setEnv({
      SHORTLINK_API_KEY: undefined,
      N8N_WEBHOOK_API_KEY: undefined,
    });

    const postReq = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "any-random-key",
      },
      body: JSON.stringify({ originalURL: "https://gdgjakarta.com/fail-closed" }),
    });
    const postRes = await route.POST(postReq);
    assert.equal(postRes.status, 401);

    const getReq = new NextRequest("https://gdgjakarta.com/api/links/shorten?path=anything", {
      method: "GET",
      headers: { authorization: "Bearer any-random-key" },
    });
    const getRes = await route.GET(getReq);
    assert.equal(getRes.status, 401);
  });

  it("F13.T2.2: returns 401 on wrong API key, missing header, or malformed Authorization scheme", async () => {
    const { NextRequest } = await import("next/server");
    const route = await import("@/app/api/links/shorten/route");

    const cases = [
      new NextRequest("https://gdgjakarta.com/api/links/shorten", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ originalURL: "https://gdgjakarta.com/a" }),
      }),
      new NextRequest("https://gdgjakarta.com/api/links/shorten", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": "wrong-key" },
        body: JSON.stringify({ originalURL: "https://gdgjakarta.com/a" }),
      }),
      new NextRequest("https://gdgjakarta.com/api/links/shorten", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Basic dXNlcjpwYXNz" },
        body: JSON.stringify({ originalURL: "https://gdgjakarta.com/a" }),
      }),
      new NextRequest("https://gdgjakarta.com/api/links/shorten?path=test", {
        method: "GET",
        headers: { authorization: "Bearer wrong-key" },
      }),
    ];

    for (const req of cases) {
      const res = req.method === "POST" ? await route.POST(req) : await route.GET(req);
      assert.equal(res.status, 401);
    }
  });

  it("F13.T2.3: returns 400 on malformed JSON, missing originalURL, non-HTTP URL, or invalid redirectType", async () => {
    const { NextRequest } = await import("next/server");
    const route = await import("@/app/api/links/shorten/route");

    const badJsonReq = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test-shortlink-api-key" },
      body: "{broken-json",
    });
    assert.equal((await route.POST(badJsonReq)).status, 400);

    const payloads = [
      {},
      { originalURL: "ftp://gdgjakarta.com/file" },
      { originalURL: "javascript:alert(1)" },
      { originalURL: "https://gdgjakarta.com/ok", redirectType: 303 },
      { originalURL: "https://gdgjakarta.com/ok", geoTargets: [{ country: "IDN", url: "https://gdgjakarta.com" }] },
    ];

    for (const payload of payloads) {
      const req = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": "test-shortlink-api-key" },
        body: JSON.stringify(payload),
      });
      const res = await route.POST(req);
      assert.equal(res.status, 400);
    }
  });

  it("F13.T2.4: returns 409 Conflict on duplicate custom slug without overwriting existing D1/KV link", async () => {
    const { NextRequest } = await import("next/server");
    const route = await import("@/app/api/links/shorten/route");

    const firstReq = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test-shortlink-api-key" },
      body: JSON.stringify({
        originalURL: "https://gdgjakarta.com/original-v1",
        path: "taken-slug",
      }),
    });
    assert.equal((await route.POST(firstReq)).status, 201);

    const dupReq = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test-shortlink-api-key" },
      body: JSON.stringify({
        originalURL: "https://gdgjakarta.com/overwrite-v2",
        path: "taken-slug",
      }),
    });
    const dupRes = await route.POST(dupReq);
    assert.equal(dupRes.status, 409);

    const kvRecord = await getKvValue(harness.kv, "gdgjakarta.org:taken-slug");
    assert.equal(kvRecord?.originalURL, "https://gdgjakarta.com/original-v1");
  });

  it("F13.T2.5: GET /api/links/shorten returns 400 on missing/invalid params and 200 { link: null } when not found", async () => {
    const { NextRequest } = await import("next/server");
    const route = await import("@/app/api/links/shorten/route");

    const missingParams = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "GET",
      headers: { "x-api-key": "test-shortlink-api-key" },
    });
    assert.equal((await route.GET(missingParams)).status, 400);

    const badOrigUrl = new NextRequest("https://gdgjakarta.com/api/links/shorten?originalURL=not-a-url", {
      method: "GET",
      headers: { "x-api-key": "test-shortlink-api-key" },
    });
    assert.equal((await route.GET(badOrigUrl)).status, 400);

    const notFoundPath = new NextRequest("https://gdgjakarta.com/api/links/shorten?path=does-not-exist", {
      method: "GET",
      headers: { "x-api-key": "test-shortlink-api-key" },
    });
    const nfPathRes = await route.GET(notFoundPath);
    assert.equal(nfPathRes.status, 200);
    assert.equal((await nfPathRes.json()).link, null);

    const notFoundOrig = new NextRequest(
      "https://gdgjakarta.com/api/links/shorten?originalURL=https%3A%2F%2Fgdgjakarta.com%2Fnever-created",
      {
        method: "GET",
        headers: { "x-api-key": "test-shortlink-api-key" },
      },
    );
    const nfOrigRes = await route.GET(notFoundOrig);
    assert.equal(nfOrigRes.status, 200);
    assert.equal((await nfOrigRes.json()).link, null);
  });

  // =========================================================================
  // F14: Migration CLI Edge Cases & Failure Modes
  // =========================================================================

  it("F14.T2.1: fails non-zero when SHORTIO_API_KEY is missing without --from-backup", async () => {
    const tmpDir = makeTempDir();
    tempDirsToClean.push(tmpDir);
    const backupPath = path.join(tmpDir, "should-not-exist.json");

    const cliRes = await runMigrationCli({
      args: ["--dry-run", "--backup", backupPath],
      env: { SHORTIO_API_KEY: "" },
    });

    assert.notEqual(cliRes.exitCode, 0);
    assert.match(cliRes.stderr, /SHORTIO_API_KEY is required/);
    assert.equal(fs.existsSync(backupPath), false);
    assert.equal(cliRes.requests.length, 0);
  });

  it("F14.T2.2: handles empty domain (0 folders, 0 links) cleanly without stderr warnings", async () => {
    const tmpDir = makeTempDir();
    tempDirsToClean.push(tmpDir);

    const backupFile = path.join(tmpDir, "empty-backup.json");
    const sqlFile = path.join(tmpDir, "empty.sql");
    const kvFile = path.join(tmpDir, "empty.kv.json");
    const reportFile = path.join(tmpDir, "empty.report.json");

    const cliRes = await runMigrationCli({
      args: ["--dry-run", "--backup", backupFile, "--out-sql", sqlFile, "--out-kv", kvFile, "--out-report", reportFile],
      shortioFixtures: {
        folders: [],
        links: [],
      },
    });

    assert.equal(cliRes.exitCode, 0, cliRes.stderr);
    assert.equal(cliRes.stderr, "");

    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    assert.equal(report.summary.domainsCount, 1);
    assert.equal(report.summary.foldersCount, 0);
    assert.equal(report.summary.linksCount, 0);
    assert.equal(report.summary.totalLegacyClicks, 0);

    const kv = JSON.parse(fs.readFileSync(kvFile, "utf8"));
    assert.equal(kv.length, 1);
    assert.equal(kv[0].key, "gdgjakarta.org:__domain__");
  });

  it("F14.T2.3: surfaces Short.io API 429/500 failure cleanly without writing or corrupting backup", async () => {
    const tmpDir = makeTempDir();
    tempDirsToClean.push(tmpDir);
    const migrateMod = await import("../../../scripts/migrate-shortio-to-d1.mjs");

    const backupFile = path.join(tmpDir, "existing-backup.json");
    const sentinelContent = JSON.stringify({ sentinel: true });
    fs.writeFileSync(backupFile, sentinelContent, "utf8");

    const failingFetch = async (url) => {
      if (String(url).includes("/api/domains")) {
        return new Response(JSON.stringify([{ id: 1516440, hostname: "gdgjakarta.org" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (String(url).includes("/links/folders/")) {
        return new Response(JSON.stringify({ linkFolders: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    };

    const options = migrateMod.parseCliArgs(["--dry-run", "--backup", backupFile], {
      SHORTIO_API_KEY: "fake-key",
    });

    await assert.rejects(
      () =>
        migrateMod.runMigration(options, {
          fetchImpl: failingFetch,
          cwd: tmpDir,
          env: { SHORTIO_API_KEY: "fake-key" },
        }),
      /HTTP 429/,
    );

    // Pre-existing backup file must remain untouched
    assert.equal(fs.readFileSync(backupFile, "utf8"), sentinelContent);
  });

  it("F14.T2.4: fails cleanly on malformed --from-backup JSON or missing backup file path", async () => {
    const tmpDir = makeTempDir();
    tempDirsToClean.push(tmpDir);

    const malformedFile = path.join(tmpDir, "bad.json");
    fs.writeFileSync(malformedFile, "{not-valid-json", "utf8");

    const badJsonRes = await runMigrationCli({
      args: ["--dry-run", "--from-backup", malformedFile],
    });
    assert.notEqual(badJsonRes.exitCode, 0);
    assert.match(badJsonRes.stderr, /Migration failed:/);

    const missingFile = path.join(tmpDir, "missing.json");
    const missingRes = await runMigrationCli({
      args: ["--dry-run", "--from-backup", missingFile],
    });
    assert.notEqual(missingRes.exitCode, 0);
    assert.match(missingRes.stderr, /Backup file not found/);
  });

  it("F14.T2.5: merges --archived-csv, normalizes leading slashes, handles dangling FolderId, zero clicks & duplicate slugs", async () => {
    const tmpDir = makeTempDir();
    tempDirsToClean.push(tmpDir);

    const backupFile = path.join(tmpDir, "merged-backup.json");
    const csvFile = path.join(tmpDir, "archived.csv");
    const sqlFile = path.join(tmpDir, "merged.sql");
    const kvFile = path.join(tmpDir, "merged.kv.json");
    const reportFile = path.join(tmpDir, "merged.report.json");

    fs.writeFileSync(
      csvFile,
      [
        "idString,shortURL,originalURL,path,title,clicks,archived",
        'lnk_csv_only,https://gdgjakarta.org/old-promo,https://gdgjakarta.com/old-promo,/old-promo,"Old Promo, 2024",180,true',
        'lnk_dup_1,https://gdgjakarta.org/dup-slug,https://gdgjakarta.com/dup,/dup-slug,"Dup CSV",95,true',
      ].join("\n"),
      "utf8",
    );

    const cliRes = await runMigrationCli({
      args: [
        "--dry-run",
        "--backup",
        backupFile,
        "--archived-csv",
        csvFile,
        "--out-sql",
        sqlFile,
        "--out-kv",
        kvFile,
        "--out-report",
        reportFile,
      ],
      shortioFixtures: {
        links: [
          {
            id: "lnk_dup_1",
            path: "/dup-slug",
            originalURL: "https://gdgjakarta.com/dup",
            FolderId: "fld_dangling_missing",
            clicks: 40,
          },
          {
            id: "lnk_dup_api_a",
            path: "dup-api",
            originalURL: "https://gdgjakarta.com/dup-api-1",
            clicks: 15,
          },
          {
            id: "lnk_dup_api_b",
            path: "/dup-api",
            originalURL: "https://gdgjakarta.com/dup-api-2",
            clicks: 65,
          },
          {
            id: "lnk_zero_mig",
            path: "/zero-mig",
            originalURL: "https://gdgjakarta.com/zero-mig",
            clicks: 0,
          },
        ],
      },
    });

    assert.equal(cliRes.exitCode, 0, cliRes.stderr);
    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    assert.equal(report.summary.linksCount, 4);
    assert.equal(report.summary.archivedLinksCount, 2);
    assert.equal(report.summary.totalLegacyClicks, 340); // 180 + max(95, 40) + max(15, 65) + 0
    assert.equal(
      report.warnings.some((w) => w.code === "DANGLING_FOLDER_ID"),
      true,
    );
    assert.equal(
      report.warnings.some((w) => w.code === "DUPLICATE_SLUG_MERGED"),
      true,
    );

    const kv = JSON.parse(fs.readFileSync(kvFile, "utf8"));
    const slugKeys = kv.map((e) => e.key);
    assert.equal(slugKeys.includes("gdgjakarta.org:old-promo"), true);
    assert.equal(slugKeys.includes("gdgjakarta.org:dup-slug"), true);
    assert.equal(slugKeys.includes("gdgjakarta.org:dup-api"), true);
    assert.equal(slugKeys.includes("gdgjakarta.org:zero-mig"), true);

    const sqlText = fs.readFileSync(sqlFile, "utf8");
    await harness.db.batch(splitSqlStatements(sqlText).map((s) => harness.db.prepare(s)));
    const dupRow = await getLinkRow(harness.db, { hostname: "gdgjakarta.org", path: "dup-slug" });
    assert.equal(dupRow?.folder_id, null);
    assert.equal(dupRow?.legacy_clicks, 95);
    assert.equal(dupRow?.archived, 1);

    const dupApiRow = await getLinkRow(harness.db, { hostname: "gdgjakarta.org", path: "dup-api" });
    assert.equal(dupApiRow?.legacy_clicks, 65);
  });

  it("F14.T2.6: rejects conflicting --local --remote flags and safely escapes SQL single quotes and null bytes", async () => {
    const tmpDir = makeTempDir();
    tempDirsToClean.push(tmpDir);

    const conflictRes = await runMigrationCli({
      args: ["--local", "--remote"],
    });
    assert.notEqual(conflictRes.exitCode, 0);
    assert.match(conflictRes.stderr, /Cannot pass both --local and --remote/);

    // Special characters in title/tags via --from-backup execute cleanly in D1
    const trickyBackup = path.join(tmpDir, "tricky-backup.json");
    const trickySql = path.join(tmpDir, "tricky.sql");
    fs.writeFileSync(
      trickyBackup,
      JSON.stringify({
        domains: [{ id: 1516440, hostname: "gdgjakarta.org" }],
        folders: [],
        links: [
          {
            id: "lnk_escape_1",
            path: "quote-test",
            originalURL: "https://gdgjakarta.com/events?q=O'Reilly",
            title: "Speaker's Guide \u0000 Edition",
            clicks: 7,
          },
        ],
      }),
      "utf8",
    );

    const escapeRes = await runMigrationCli({
      args: ["--dry-run", "--from-backup", trickyBackup, "--out-sql", trickySql],
    });
    assert.equal(escapeRes.exitCode, 0, escapeRes.stderr);

    const sqlText = fs.readFileSync(trickySql, "utf8");
    await harness.db.batch(splitSqlStatements(sqlText).map((s) => harness.db.prepare(s)));
    const row = await getLinkRow(harness.db, "lnk_escape_1");
    assert.equal(row?.original_url, "https://gdgjakarta.com/events?q=O'Reilly");
    assert.equal(row?.title, "Speaker's Guide  Edition");
    assert.equal(row?.legacy_clicks, 7);
  });
});
