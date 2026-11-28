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

function makeTempDir(prefix = "shortlink-e2e-m3-t1-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeDirQuietly(dirPath) {
  if (dirPath && fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Splits generated migration SQL into individual statements compatible with Miniflare D1.
 */
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

describe("E2E-M3 Tier 1: D1/KV Provider, Analytics, External API & Migration CLI (F11-F14)", () => {
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
  // F11: D1/KV Store, KV Sync & Dual-Mode Provider
  // =========================================================================

  it("F11.1: performs full link CRUD in cloudflare mode with synchronous KV sync and lnk_ ID parity", async () => {
    const shortioActions = await import("@/server/shortio-actions");

    const createRes = await shortioActions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/cloud-next-26",
      path: "/cloud-next-26",
      title: "Cloud Next Extended 26",
      tags: ["Cloud", "Event", "Cloud"],
      redirectType: 301,
      cloaking: true,
      androidURL: "https://play.google.com/store/apps/details?id=org.gdgjakarta",
      iphoneURL: "https://apps.apple.com/app/id123456",
      geoTargets: [{ country: "id", url: "https://gdgjakarta.com/id/cloud-next" }],
      utmParams: { source: "dashboard", medium: "shortlink", campaign: "cloud26" },
      pixels: { metaPixelId: "112233", ga4Id: "G-GDGJKT1" },
      maxClicks: 500,
    });

    assert.equal(createRes.success, true);
    const created = createRes.data;
    assert.ok(created);
    assert.match(created.id, /^lnk_|^link_/);
    assert.equal(created.id, created.idString);
    assert.equal(created.path, "cloud-next-26");
    assert.equal(created.shortURL, "https://gdgjakarta.org/cloud-next-26");
    assert.deepEqual(created.tags, ["Cloud", "Event"]);
    assert.equal(created.redirectType, "301");
    assert.equal(created.maxClicks, 500);

    const d1Row = await getLinkRow(harness.db, created.id);
    assert.equal(d1Row?.path, "cloud-next-26");
    assert.equal(d1Row?.cloaking, 1);

    const kvInitial = await getKvValue(harness.kv, "gdgjakarta.org:cloud-next-26");
    assert.equal(kvInitial?.id, created.id);
    assert.equal(kvInitial?.originalURL, "https://gdgjakarta.com/events/cloud-next-26");
    assert.equal(kvInitial?.redirectType, 301);
    assert.equal(kvInitial?.cloaking, true);
    assert.equal(kvInitial?.geoTargets?.[0]?.country, "ID");
    assert.equal(kvInitial?.utmParams?.campaign, "cloud26");
    assert.equal(kvInitial?.pixels?.ga4Id, "G-GDGJKT1");
    assert.equal(kvInitial?.maxClicks, 500);

    // Update slug and target URL -> old KV key must be deleted and new KV key written
    const updateRes = await shortioActions.updateShortLinkAction(created.id, {
      path: "cloud-next-jkt",
      originalURL: "https://gdgjakarta.com/events/cloud-next-jkt",
      redirectType: 308,
    });
    assert.equal(updateRes.success, true);
    assert.equal(updateRes.data?.path, "cloud-next-jkt");
    assert.equal(await getKvValue(harness.kv, "gdgjakarta.org:cloud-next-26"), null);

    const kvRenamed = await getKvValue(harness.kv, "gdgjakarta.org:cloud-next-jkt");
    assert.equal(kvRenamed?.id, created.id);
    assert.equal(kvRenamed?.originalURL, "https://gdgjakarta.com/events/cloud-next-jkt");
    assert.equal(kvRenamed?.redirectType, 308);

    // Fetch list
    const listRes = await shortioActions.fetchShortLinksAction({ limit: 50 });
    assert.equal(listRes.success, true);
    assert.equal(
      listRes.data?.some((l) => l.id === created.id),
      true,
    );

    // Delete removes both D1 row and KV key
    const deleteRes = await shortioActions.deleteShortLinkAction(created.id);
    assert.equal(deleteRes.success, true);
    assert.equal(await getLinkRow(harness.db, created.id), null);
    assert.equal(await getKvValue(harness.kv, "gdgjakarta.org:cloud-next-jkt"), null);
  });

  it("F11.2: manages domain CRUD and mobile deep-linking config with <hostname>:__domain__ KV sync", async () => {
    const advancedActions = await import("@/server/shortio-advanced-actions");
    const shortioActions = await import("@/server/shortio-actions");
    harnessState.setAuthRole("executive");

    const createDomRes = await advancedActions.createShortDomainAction("go.gdgjakarta.org");
    assert.equal(createDomRes.success, true);
    const domain = createDomRes.data;
    assert.ok(domain);
    assert.equal(domain.hostname, "go.gdgjakarta.org");
    assert.equal(domain.provider, "cloudflare");

    const aasaJson = JSON.stringify({
      applinks: { apps: [], details: [{ appID: "TEAM.org.gdgjakarta", paths: ["/*"] }] },
    });
    const assetLinksJson = JSON.stringify([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "org.gdgjakarta" },
      },
    ]);

    const updateDomRes = await advancedActions.updateShortDomainConfigAction(domain.id, {
      appleAppSiteAssociation: aasaJson,
      assetLinks: assetLinksJson,
      state: "configured",
    });
    assert.equal(updateDomRes.success, true);
    assert.equal(updateDomRes.data?.appleAppSiteAssociation, aasaJson);
    assert.equal(updateDomRes.data?.assetLinks, assetLinksJson);

    const domainKv = await getKvValue(harness.kv, "go.gdgjakarta.org:__domain__");
    assert.equal(domainKv?.hostname, "go.gdgjakarta.org");
    assert.equal(domainKv?.appleAppSiteAssociation, aasaJson);
    assert.equal(domainKv?.assetLinks, assetLinksJson);

    // Create a link on the secondary domain, then delete domain -> cascades KV cleanup
    const linkRes = await shortioActions.createShortLinkAction({
      hostname: "go.gdgjakarta.org",
      path: "app-launch",
      originalURL: "https://gdgjakarta.com/app",
    });
    assert.equal(linkRes.success, true);
    assert.ok(await getKvValue(harness.kv, "go.gdgjakarta.org:app-launch"));

    const listDomRes = await advancedActions.listShortDomainsAction();
    assert.equal(listDomRes.success, true);
    assert.equal(
      listDomRes.data?.some((d) => d.hostname === "go.gdgjakarta.org"),
      true,
    );

    const deleteDomRes = await advancedActions.deleteShortDomainAction(domain.id);
    assert.equal(deleteDomRes.success, true);
    assert.equal(await getKvValue(harness.kv, "go.gdgjakarta.org:__domain__"), null);
    assert.equal(await getKvValue(harness.kv, "go.gdgjakarta.org:app-launch"), null);
  });

  it("F11.3: performs folder CRUD and bulk move/delete while keeping SHORTLINKS_KV folderId synchronized", async () => {
    const shortioActions = await import("@/server/shortio-actions");

    const fCreate = await shortioActions.createShortFolderAction({
      name: "DevFest 2026",
      color: "#4285F4",
      icon: "sparkles",
    });
    assert.equal(fCreate.success, true);
    const folder = fCreate.data;
    assert.ok(folder);
    assert.match(folder.id, /^fld_/);

    const fUpdate = await shortioActions.updateShortFolderAction(folder.id, { name: "DevFest JKT", color: "#34A853" });
    assert.equal(fUpdate.success, true);
    assert.equal(fUpdate.data?.name, "DevFest JKT");
    assert.equal(fUpdate.data?.color, "#34A853");

    const fList = await shortioActions.fetchShortFoldersAction();
    assert.equal(fList.success, true);
    assert.equal(
      fList.data?.some((f) => f.id === folder.id && f.name === "DevFest JKT"),
      true,
    );

    const l1 = await shortioActions.createShortLinkAction({ path: "df-a", originalURL: "https://gdgjakarta.com/a" });
    const l2 = await shortioActions.createShortLinkAction({ path: "df-b", originalURL: "https://gdgjakarta.com/b" });
    assert.equal(l1.success && l2.success, true);

    const bulkMove = await shortioActions.bulkMoveLinksToFolderAction([l1.data.id, l2.data.id], folder.id);
    assert.equal(bulkMove.success, true);
    assert.equal(bulkMove.updatedCount, 2);

    assert.equal((await getKvValue(harness.kv, "gdgjakarta.org:df-a"))?.folderId, folder.id);
    assert.equal((await getKvValue(harness.kv, "gdgjakarta.org:df-b"))?.folderId, folder.id);

    // Deleting folder sets folder_id = NULL in D1 and refreshes KV folderId to null
    const fDel = await shortioActions.deleteShortFolderAction(folder.id);
    assert.equal(fDel.success, true);
    assert.equal((await getKvValue(harness.kv, "gdgjakarta.org:df-a"))?.folderId, null);

    // Move remaining single link back to null and bulk delete both
    const bulkDel = await shortioActions.bulkDeleteShortLinksAction([l1.data.id, l2.data.id]);
    assert.equal(bulkDel.success, true);
    assert.equal(bulkDel.deletedCount, 2);
    assert.equal(await getKvValue(harness.kv, "gdgjakarta.org:df-a"), null);
    assert.equal(await getKvValue(harness.kv, "gdgjakarta.org:df-b"), null);
  });

  it("F11.4: switches cleanly between SHORTLINK_PROVIDER=cloudflare and shortio with matching ShortLinkItem contracts", async () => {
    const shortioActions = await import("@/server/shortio-actions");
    const advancedActions = await import("@/server/shortio-advanced-actions");

    // 1. Cloudflare mode
    harnessState.setEnv({ SHORTLINK_PROVIDER: "cloudflare" });
    const cfConfig = await shortioActions.getShortlinkDashboardConfigAction();
    assert.equal(cfConfig.success, true);
    assert.equal(cfConfig.data?.provider, "cloudflare");

    const cfCreated = await shortioActions.createShortLinkAction({
      path: "cf-only-link",
      originalURL: "https://gdgjakarta.com/cf",
      title: "Cloudflare Link",
    });
    assert.equal(cfCreated.success, true);
    assert.equal(harnessState.shortio.requests.length, 0);

    // 2. Switch to Short.io mode
    harnessState.setEnv({ SHORTLINK_PROVIDER: "shortio" });
    harnessState.shortio.seed({
      links: [{ id: "lnk_shortio_seed", path: "shortio-only", originalURL: "https://gdgjakarta.com/sio", clicks: 15 }],
    });

    const sioConfig = await shortioActions.getShortlinkDashboardConfigAction();
    assert.equal(sioConfig.success, true);
    assert.equal(sioConfig.data?.provider, "shortio");

    const sioList = await shortioActions.fetchShortLinksAction({ limit: 50 });
    assert.equal(sioList.success, true);
    assert.equal(
      sioList.data?.some((l) => l.path === "shortio-only"),
      true,
    );
    assert.equal(
      sioList.data?.some((l) => l.path === "cf-only-link"),
      false,
    );

    const sioCreated = await shortioActions.createShortLinkAction({
      path: "sio-new",
      originalURL: "https://gdgjakarta.com/sio-new",
    });
    assert.equal(sioCreated.success, true);
    assert.equal(sioCreated.data?.path, "sio-new");
    assert.equal(await getLinkRow(harness.db, { hostname: "gdgjakarta.org", path: "sio-new" }), null);

    const sioBulk = await advancedActions.bulkImportShortLinksAction([
      { originalURL: "https://gdgjakarta.com/b1", path: "sio-b1" },
    ]);
    assert.equal(sioBulk.success, true);
    assert.equal(sioBulk.data?.[0]?.ok, true);
    assert.ok(harnessState.shortio.requests.length > 0);
  });

  it("F11.5: generates, updates, and retrieves event short links with Firestore + Bevy parity in cloudflare mode", async () => {
    const shortioActions = await import("@/server/shortio-actions");

    harnessState.firestore.seedEvent("evt-df26", {
      id: "evt-df26",
      title: "DevFest Jakarta 2026",
    });

    await shortioActions.createShortFolderAction({ name: "DevFest" });

    const genRes = await shortioActions.generateEventShortLinkAction({
      eventId: "evt-df26",
      type: "live",
      originalURL: "http://localhost:3000/events/evt-df26",
      title: "DevFest Jakarta 2026",
      customSlug: "df26-live",
      tags: ["DevFest"],
    });

    assert.equal(genRes.success, true);
    assert.equal(genRes.data?.shortURL, "https://gdgjakarta.org/df26-live");
    // Canonical production URL enforced over localhost
    assert.equal(genRes.data?.originalURL, "https://gdgjakarta.com/events/evt-df26");

    const cachedEvent = harnessState.firestore.getEvent("evt-df26");
    assert.equal(cachedEvent?.live_short_url, "https://gdgjakarta.org/df26-live");
    assert.equal(cachedEvent?.live_short_path, "df26-live");
    assert.equal(harnessState.bevy.updates.length, 1);
    assert.equal(harnessState.bevy.updates[0].patch.custom_tickets_url, "https://gdgjakarta.org/df26-live");

    const updRes = await shortioActions.updateEventShortLinkAction({
      eventId: "evt-df26",
      type: "live",
      linkId: genRes.data?.idString,
      newSlug: "devfest26",
    });
    assert.equal(updRes.success, true);
    assert.equal(updRes.data?.shortURL, "https://gdgjakarta.org/devfest26");
    assert.equal(await getKvValue(harness.kv, "gdgjakarta.org:df26-live"), null);
    assert.equal((await getKvValue(harness.kv, "gdgjakarta.org:devfest26"))?.id, genRes.data?.id);

    const statusRes = await shortioActions.getEventShortLinksAction({
      liveUrl: "https://gdgjakarta.com/events/evt-df26",
    });
    assert.equal(statusRes.success, true);
    assert.equal(statusRes.data?.liveShortLink?.path, "devfest26");

    harnessState.setAuthRole("unauthenticated");
    const publicRes = await shortioActions.getPublicEventShortLinksAction({
      eventId: "evt-df26",
      liveUrl: "https://gdgjakarta.com/events/evt-df26",
    });
    assert.equal(publicRes.success, true);
    assert.equal(publicRes.data?.liveShortLink?.shortURL, "https://gdgjakarta.org/devfest26");
  });

  it("F11.6: wires speaker-confirmation-actions template lookup and archive/unarchive KV sync via cloudflare provider", async () => {
    const shortioActions = await import("@/server/shortio-actions");
    const advancedActions = await import("@/server/shortio-advanced-actions");
    const speakerActions = await import("@/server/speaker-confirmation-actions");

    harnessState.setEnv({
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: undefined,
      NEXT_PUBLIC_FIREBASE_API_KEY: undefined,
    });

    const gdgTpl = await shortioActions.createShortLinkAction({
      path: "gdg-slide-template",
      originalURL: "https://docs.google.com/presentation/d/gdg-2026",
      title: "GDG Official Slide Deck 2026",
    });
    assert.equal(gdgTpl.success, true);

    const tplOptions = await speakerActions.getExistingEventSlideTemplateOptionsAction("evt-999");
    assert.equal(tplOptions.success, true);
    assert.equal(tplOptions.presets.gdg_default.label, "GDG Official Slide Deck 2026");
    assert.equal(tplOptions.presets.gdg_default.url, "https://gdgjakarta.org/gdg-slide-template");
    assert.equal(harnessState.shortio.requests.length, 0);

    // Archive and unarchive sync KV archived flag
    const archRes = await advancedActions.archiveShortLinksAction([gdgTpl.data.id]);
    assert.equal(archRes.success, true);
    assert.equal((await getKvValue(harness.kv, "gdgjakarta.org:gdg-slide-template"))?.archived, true);

    const unarchRes = await advancedActions.unarchiveShortLinksAction([gdgTpl.data.id]);
    assert.equal(unarchRes.success, true);
    assert.equal((await getKvValue(harness.kv, "gdgjakarta.org:gdg-slide-template"))?.archived, false);
  });

  // =========================================================================
  // F12: Click Analytics & Real-Time Clickstream
  // =========================================================================

  it("F12.1: combines legacy_clicks with short_link_clicks to compute totalClicks and humanClicks", async () => {
    const advancedActions = await import("@/server/shortio-advanced-actions");

    const link = await seedLink(harness.db, {
      id: "lnk_stats_1",
      path: "stats-combo",
      originalURL: "https://gdgjakarta.com/stats",
      legacyClicks: 100,
    });

    const now = Date.now();
    await seedClick(harness.db, { linkId: link.id, path: link.path, clickedAt: now - 3000, isBot: 0, country: "ID" });
    await seedClick(harness.db, { linkId: link.id, path: link.path, clickedAt: now - 2000, isBot: 0, country: "SG" });
    await seedClick(harness.db, { linkId: link.id, path: link.path, clickedAt: now - 1000, isBot: 1, country: "US" });

    const res = await advancedActions.getLinkStatsAction(link.id, "total");
    assert.equal(res.success, true);
    assert.equal(res.data?.legacyClicks, 100);
    assert.equal(res.data?.totalClicks, 103);
    assert.equal(res.data?.humanClicks, 102);
    assert.equal(res.data?.clicks, 103);
  });

  it("F12.2: aggregates country and city breakdowns sorted descending by score", async () => {
    const advancedActions = await import("@/server/shortio-advanced-actions");

    const link = await seedLink(harness.db, {
      id: "lnk_geo_1",
      path: "geo-stats",
      originalURL: "https://gdgjakarta.com/geo",
    });

    const now = Date.now();
    await seedClick(harness.db, {
      linkId: link.id,
      path: link.path,
      clickedAt: now - 4000,
      country: "ID",
      city: "Jakarta",
    });
    await seedClick(harness.db, {
      linkId: link.id,
      path: link.path,
      clickedAt: now - 3000,
      country: "ID",
      city: "Jakarta",
    });
    await seedClick(harness.db, {
      linkId: link.id,
      path: link.path,
      clickedAt: now - 2000,
      country: "ID",
      city: "Bandung",
    });
    await seedClick(harness.db, {
      linkId: link.id,
      path: link.path,
      clickedAt: now - 1000,
      country: "SG",
      city: "Singapore",
    });

    const res = await advancedActions.getLinkStatsAction(link.id, "total");
    assert.equal(res.success, true);
    assert.deepEqual(res.data?.country, [
      { country: "ID", score: 3 },
      { country: "SG", score: 1 },
    ]);
    assert.equal(res.data?.cities?.[0]?.city, "Jakarta");
    assert.equal(res.data?.cities?.[0]?.country, "ID");
    assert.equal(res.data?.cities?.[0]?.score, 2);
    assert.equal(res.data?.cities?.length, 3);
  });

  it("F12.3: aggregates browser, os, device, and referer breakdowns", async () => {
    const advancedActions = await import("@/server/shortio-advanced-actions");

    const link = await seedLink(harness.db, {
      id: "lnk_ua_1",
      path: "ua-stats",
      originalURL: "https://gdgjakarta.com/ua",
    });

    const now = Date.now();
    await seedClick(harness.db, {
      linkId: link.id,
      path: link.path,
      clickedAt: now - 3000,
      browser: "Chrome",
      os: "Android",
      device: "Mobile",
      referer: "https://t.co",
    });
    await seedClick(harness.db, {
      linkId: link.id,
      path: link.path,
      clickedAt: now - 2000,
      browser: "Chrome",
      os: "macOS",
      device: "Desktop",
      referer: "https://t.co",
    });
    await seedClick(harness.db, {
      linkId: link.id,
      path: link.path,
      clickedAt: now - 1000,
      browser: "Safari",
      os: "iOS",
      device: "Mobile",
      referer: "https://gdgjakarta.com",
    });

    const res = await advancedActions.getLinkStatsAction(link.id, "total");
    assert.equal(res.success, true);
    assert.deepEqual(res.data?.browser, [
      { browser: "Chrome", score: 2 },
      { browser: "Safari", score: 1 },
    ]);
    assert.deepEqual(res.data?.device, [
      { device: "Mobile", score: 2 },
      { device: "Desktop", score: 1 },
    ]);
    assert.equal(res.data?.os?.length, 3);
    assert.deepEqual(res.data?.referer, [
      { referer: "https://t.co", score: 2 },
      { referer: "https://gdgjakarta.com", score: 1 },
    ]);
  });

  it("F12.4: produces chronological time-series buckets for daily and hourly UTC+7 windows", async () => {
    const analyticsMod = await import("@/lib/shortlinks/analytics");

    const link = await seedLink(harness.db, {
      id: "lnk_ts_1",
      path: "ts-stats",
      originalURL: "https://gdgjakarta.com/ts",
    });

    // Fixed anchor: 2026-11-27T10:00:00+07:00 = 2026-11-27T03:00:00Z
    const anchorMs = Date.parse("2026-11-27T03:00:00.000Z");
    await seedClick(harness.db, { linkId: link.id, path: link.path, clickedAt: anchorMs - 2 * 86400_000 });
    await seedClick(harness.db, { linkId: link.id, path: link.path, clickedAt: anchorMs - 3600_000 }); // 09:00+07
    await seedClick(harness.db, { linkId: link.id, path: link.path, clickedAt: anchorMs - 1800_000 }); // 09:30+07
    await seedClick(harness.db, { linkId: link.id, path: link.path, clickedAt: anchorMs }); // 10:00+07

    const last30 = await analyticsMod.queryLinkStatsD1(harness.db, link.id, "last30", anchorMs);
    assert.deepEqual(last30.clickStatistics?.datasets?.[0]?.data, [
      { x: "2026-11-25", y: "1" },
      { x: "2026-11-27", y: "3" },
    ]);

    const today = await analyticsMod.queryLinkStatsD1(harness.db, link.id, "today", anchorMs);
    assert.deepEqual(today.clickStatistics?.datasets?.[0]?.data, [
      { x: "2026-11-27T09:00:00+07:00", y: "2" },
      { x: "2026-11-27T10:00:00+07:00", y: "1" },
    ]);
  });

  it("F12.5: returns newest-first real-time clickstream and per-variant A/B split-test analytics", async () => {
    const advancedActions = await import("@/server/shortio-advanced-actions");

    const splitLink = await seedLink(harness.db, {
      id: "lnk_split_1",
      path: "ab-promo",
      originalURL: "https://gdgjakarta.com/a",
      linkType: "split",
      splitTargets: [
        { label: "Control", url: "https://gdgjakarta.com/a", weight: 50 },
        { label: "Variant B", url: "https://gdgjakarta.com/b", weight: 50 },
      ],
    });

    const baseMs = Date.now() - 10_000;
    await seedClick(harness.db, {
      id: "clk_1",
      linkId: splitLink.id,
      path: splitLink.path,
      clickedAt: baseMs + 1000,
      variantLabel: "Control",
      targetUrl: "https://gdgjakarta.com/a",
      country: "ID",
      city: "Jakarta",
      isBot: 0,
    });
    await seedClick(harness.db, {
      id: "clk_2",
      linkId: splitLink.id,
      path: splitLink.path,
      clickedAt: baseMs + 2000,
      variantLabel: "Variant B",
      targetUrl: "https://gdgjakarta.com/b",
      country: "SG",
      isBot: 0,
    });
    await seedClick(harness.db, {
      id: "clk_3",
      linkId: splitLink.id,
      path: splitLink.path,
      clickedAt: baseMs + 3000,
      variantLabel: "Variant B",
      targetUrl: "https://gdgjakarta.com/b",
      country: "SG",
      isBot: 1,
    });

    const streamRes = await advancedActions.getLinkClickstreamAction(splitLink.id, { limit: 10 });
    assert.equal(streamRes.success, true);
    assert.deepEqual(
      streamRes.data?.map((e) => e.id),
      ["clk_3", "clk_2", "clk_1"],
    );
    assert.equal(streamRes.data?.[0]?.isBot, true);
    assert.equal(streamRes.data?.[2]?.city, "Jakarta");

    const domStream = await advancedActions.getDomainClickstreamAction({ hostname: "gdgjakarta.org", limit: 2 });
    assert.equal(domStream.success, true);
    assert.equal(domStream.data?.length, 2);

    const splitRes = await advancedActions.getSplitTestStatsAction(splitLink.id, "total");
    assert.equal(splitRes.success, true);
    assert.equal(splitRes.data?.length, 2);
    assert.equal(splitRes.data?.[0]?.variantLabel, "Variant B");
    assert.equal(splitRes.data?.[0]?.clicks, 2);
    assert.equal(splitRes.data?.[0]?.humanClicks, 1);
    assert.equal(splitRes.data?.[0]?.percentage, 66.7);
    assert.equal(splitRes.data?.[1]?.variantLabel, "Control");
    assert.equal(splitRes.data?.[1]?.clicks, 1);
    assert.equal(splitRes.data?.[1]?.humanClicks, 1);
  });

  // =========================================================================
  // F13: External Shortening API (/api/links/shorten)
  // =========================================================================

  it("F13.1: POST /api/links/shorten authenticates via x-api-key, persists to D1+KV, and omits passwordHash", async () => {
    const { NextRequest } = await import("next/server");
    const route = await import("@/app/api/links/shorten/route");

    const req = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-shortlink-api-key",
      },
      body: JSON.stringify({
        originalURL: "https://gdgjakarta.com/events/n8n-flow-1",
        password: "secret-password",
      }),
    });

    const res = await route.POST(req);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.link?.id);
    assert.equal(body.link?.id, body.link?.idString);
    assert.equal(body.link?.originalURL, "https://gdgjakarta.com/events/n8n-flow-1");
    assert.equal(body.link?.hasPassword, true);
    assert.equal("passwordHash" in body.link, false);
    assert.equal("password_hash" in body.link, false);

    const kvRecord = await getKvValue(harness.kv, `gdgjakarta.org:${body.link.path}`);
    assert.equal(kvRecord?.id, body.link.id);
    assert.ok(kvRecord?.passwordHash?.startsWith("pbkdf2$"));
  });

  it("F13.2: POST /api/links/shorten authenticates via Authorization Bearer matching N8N_WEBHOOK_API_KEY", async () => {
    const { NextRequest } = await import("next/server");
    const route = await import("@/app/api/links/shorten/route");

    const req = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-n8n-api-key",
      },
      body: JSON.stringify({
        originalURL: "https://gdgjakarta.com/events/n8n-bearer",
      }),
    });

    const res = await route.POST(req);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.link?.originalURL, "https://gdgjakarta.com/events/n8n-bearer");
  });

  it("F13.3: POST /api/links/shorten honors custom path, title, tags, redirectType, utmParams, and geoTargets", async () => {
    const { NextRequest } = await import("next/server");
    const route = await import("@/app/api/links/shorten/route");

    const req = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-shortlink-api-key",
      },
      body: JSON.stringify({
        originalURL: "https://gdgjakarta.com/events/devfest-api",
        path: "devfest-api",
        title: "DevFest via API",
        tags: ["n8n", "DevFest"],
        redirectType: 307,
        utmParams: { source: "n8n", campaign: "devfest26" },
        geoTargets: [{ country: "SG", url: "https://gdgjakarta.com/sg/devfest" }],
      }),
    });

    const res = await route.POST(req);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.link?.path, "devfest-api");
    assert.equal(body.link?.title, "DevFest via API");
    assert.deepEqual(body.link?.tags, ["n8n", "DevFest"]);
    assert.equal(body.link?.redirectType, "307");

    const kvRecord = await getKvValue(harness.kv, "gdgjakarta.org:devfest-api");
    assert.equal(kvRecord?.redirectType, 307);
    assert.equal(kvRecord?.utmParams?.source, "n8n");
    assert.equal(kvRecord?.geoTargets?.[0]?.country, "SG");
  });

  it("F13.4: GET /api/links/shorten?path=<slug> returns 200 { link } with matching link data", async () => {
    const { NextRequest } = await import("next/server");
    const route = await import("@/app/api/links/shorten/route");

    await seedLink(harness.db, {
      id: "lnk_get_path",
      path: "lookup-slug",
      originalURL: "https://gdgjakarta.com/lookup-target",
      title: "Lookup Target",
      passwordHash: "pbkdf2$0011$2233",
      hasPassword: 1,
    });

    const req = new NextRequest("https://gdgjakarta.com/api/links/shorten?path=lookup-slug", {
      method: "GET",
      headers: { "x-api-key": "test-shortlink-api-key" },
    });

    const res = await route.GET(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.link?.id, "lnk_get_path");
    assert.equal(body.link?.path, "lookup-slug");
    assert.equal(body.link?.originalURL, "https://gdgjakarta.com/lookup-target");
    assert.equal("passwordHash" in body.link, false);
  });

  it("F13.5: GET /api/links/shorten?originalURL=<url> returns 200 { link } for matching destination URL", async () => {
    const { NextRequest } = await import("next/server");
    const route = await import("@/app/api/links/shorten/route");

    await seedLink(harness.db, {
      id: "lnk_get_orig",
      path: "by-orig-slug",
      originalURL: "https://gdgjakarta.com/events/canonical-evt",
      title: "Canonical Event",
    });

    const req = new NextRequest(
      "https://gdgjakarta.com/api/links/shorten?originalURL=https%3A%2F%2Fgdgjakarta.com%2Fevents%2Fcanonical-evt",
      {
        method: "GET",
        headers: { authorization: "Bearer test-n8n-api-key" },
      },
    );

    const res = await route.GET(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.link?.id, "lnk_get_orig");
    assert.equal(body.link?.path, "by-orig-slug");
  });

  // =========================================================================
  // F14: Migration CLI (scripts/migrate-shortio-to-d1.mjs)
  // =========================================================================

  it("F14.1: exports paginated Short.io folders, active links, and archived links to explicit temp backup", async () => {
    const tmpDir = makeTempDir();
    tempDirsToClean.push(tmpDir);

    const backupFile = path.join(tmpDir, "backup.json");
    const reportFile = path.join(tmpDir, "report.json");

    // Seed 160 links so pagination (limit=150) fetches 2 pages
    const fixtureLinks = Array.from({ length: 160 }, (_, idx) => ({
      id: `lnk_pag_${idx + 1}`,
      path: `slug-${idx + 1}`,
      originalURL: `https://gdgjakarta.com/p/${idx + 1}`,
      FolderId: idx % 2 === 0 ? "fld_mig_1" : undefined,
      archived: idx >= 155,
      clicks: idx + 1,
    }));

    const cliRes = await runMigrationCli({
      args: ["--dry-run", "--backup", backupFile, "--out-report", reportFile],
      shortioFixtures: {
        folders: [{ id: "fld_mig_1", name: "Events", color: "#4285F4", DomainId: 1516440 }],
        links: fixtureLinks,
      },
    });

    assert.equal(cliRes.exitCode, 0, cliRes.stderr);
    const stdoutJson = JSON.parse(cliRes.stdout.trim());
    assert.equal(stdoutJson.mode, "dry-run");
    assert.equal(stdoutJson.summary.foldersCount, 1);
    assert.equal(stdoutJson.summary.linksCount, 160);
    assert.equal(stdoutJson.summary.activeLinksCount, 155);
    assert.equal(stdoutJson.summary.archivedLinksCount, 5);

    const savedBackup = JSON.parse(fs.readFileSync(backupFile, "utf8"));
    assert.equal(savedBackup.folders.length, 1);
    assert.equal(savedBackup.links.length, 160);

    // Verify 2 paginated /api/links calls were made
    const linkApiCalls = cliRes.requests.filter((r) => r.url.includes("/api/links?"));
    assert.equal(linkApiCalls.length, 2);
  });

  it("F14.2: preserves legacy_clicks in generated D1 SQL and executes cleanly against Miniflare D1", async () => {
    const tmpDir = makeTempDir();
    tempDirsToClean.push(tmpDir);

    const backupFile = path.join(tmpDir, "backup.json");
    const sqlFile = path.join(tmpDir, "migration.sql");
    const reportFile = path.join(tmpDir, "report.json");

    const cliRes = await runMigrationCli({
      args: ["--dry-run", "--backup", backupFile, "--out-sql", sqlFile, "--out-report", reportFile],
      shortioFixtures: {
        folders: [{ id: "fld_ev", name: "Events", color: "#0693E3", DomainId: 1516440 }],
        links: [
          {
            id: "lnk_leg_1",
            path: "legacy-hit",
            originalURL: "https://gdgjakarta.com/legacy-hit",
            FolderId: "fld_ev",
            clicks: 4321,
          },
          {
            id: "lnk_leg_2",
            path: "legacy-arch",
            originalURL: "https://gdgjakarta.com/legacy-arch",
            archived: true,
            clicks: 79,
          },
        ],
      },
    });

    assert.equal(cliRes.exitCode, 0, cliRes.stderr);
    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    assert.equal(report.summary.totalLegacyClicks, 4400);

    const sqlText = fs.readFileSync(sqlFile, "utf8");
    assert.match(sqlText, /INSERT INTO short_links/);
    assert.match(sqlText, /4321/);

    // Execute generated SQL directly in Miniflare D1 to verify end-to-end schema compatibility
    const statements = splitSqlStatements(sqlText).map((stmt) => harness.db.prepare(stmt));
    await harness.db.batch(statements);

    const row1 = await getLinkRow(harness.db, "lnk_leg_1");
    assert.equal(row1?.legacy_clicks, 4321);
    assert.equal(row1?.folder_id, "fld_ev");
    const row2 = await getLinkRow(harness.db, "lnk_leg_2");
    assert.equal(row2?.legacy_clicks, 79);
    assert.equal(row2?.archived, 1);
  });

  it("F14.3: generates Wrangler KV bulk payload keyed by <hostname>:__domain__ and <hostname>:<slug>", async () => {
    const tmpDir = makeTempDir();
    tempDirsToClean.push(tmpDir);

    const backupFile = path.join(tmpDir, "backup.json");
    const kvFile = path.join(tmpDir, "kv-bulk.json");

    const cliRes = await runMigrationCli({
      args: ["--dry-run", "--backup", backupFile, "--out-kv", kvFile],
      shortioFixtures: {
        links: [
          {
            id: "lnk_kv_1",
            path: "kv-slug",
            originalURL: "https://gdgjakarta.com/kv-target",
            redirectType: 301,
            cloaking: true,
            androidURL: "https://play.google.com/store/apps/details?id=gdg",
          },
        ],
      },
    });

    assert.equal(cliRes.exitCode, 0, cliRes.stderr);
    const kvEntries = JSON.parse(fs.readFileSync(kvFile, "utf8"));
    assert.equal(kvEntries.length, 2);

    const domainEntry = kvEntries.find((e) => e.key === "gdgjakarta.org:__domain__");
    assert.ok(domainEntry);
    assert.equal(JSON.parse(domainEntry.value).hostname, "gdgjakarta.org");

    const linkEntry = kvEntries.find((e) => e.key === "gdgjakarta.org:kv-slug");
    assert.ok(linkEntry);
    const linkVal = JSON.parse(linkEntry.value);
    assert.equal(linkVal.id, "lnk_kv_1");
    assert.equal(linkVal.originalURL, "https://gdgjakarta.com/kv-target");
    assert.equal(linkVal.redirectType, 301);
    assert.equal(linkVal.cloaking, true);
    assert.equal(linkVal.androidURL, "https://play.google.com/store/apps/details?id=gdg");
  });

  it("F14.4: flags password-protected slugs in report and emits stderr warning banner", async () => {
    const tmpDir = makeTempDir();
    tempDirsToClean.push(tmpDir);

    const backupFile = path.join(tmpDir, "backup.json");
    const sqlFile = path.join(tmpDir, "migration.sql");
    const reportFile = path.join(tmpDir, "report.json");

    const cliRes = await runMigrationCli({
      args: ["--dry-run", "--backup", backupFile, "--out-sql", sqlFile, "--out-report", reportFile],
      shortioFixtures: {
        links: [
          {
            id: "lnk_pw_1",
            path: "vip-deck",
            originalURL: "https://gdgjakarta.com/vip",
            hasPassword: true,
            clicks: 12,
          },
          {
            id: "lnk_open_1",
            path: "public-doc",
            originalURL: "https://gdgjakarta.com/doc",
            clicks: 5,
          },
        ],
      },
    });

    assert.equal(cliRes.exitCode, 0);
    assert.match(cliRes.stderr, /WARNING: 1 password-protected link\(s\) require manual password re-entry/);
    assert.match(cliRes.stderr, /gdgjakarta\.org\/vip-deck/);

    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    assert.equal(report.summary.flaggedPasswordLinksCount, 1);
    assert.equal(report.flaggedPasswordLinks[0].path, "vip-deck");
    assert.equal(report.flaggedPasswordLinks[0].id, "lnk_pw_1");

    // Verify D1 row stores has_password=1 and password_hash=NULL
    const sqlText = fs.readFileSync(sqlFile, "utf8");
    const statements = splitSqlStatements(sqlText).map((stmt) => harness.db.prepare(stmt));
    await harness.db.batch(statements);
    const pwRow = await getLinkRow(harness.db, "lnk_pw_1");
    assert.equal(pwRow?.has_password, 1);
    assert.equal(pwRow?.password_hash, null);
  });

  it("F14.5: re-runs idempotently via --from-backup offline with consistent SQL upserts and KV payload", async () => {
    const tmpDir = makeTempDir();
    tempDirsToClean.push(tmpDir);

    const backupFile = path.join(tmpDir, "backup.json");
    const sql1File = path.join(tmpDir, "run1.sql");
    const kv1File = path.join(tmpDir, "run1.kv.json");
    const sql2File = path.join(tmpDir, "run2.sql");
    const kv2File = path.join(tmpDir, "run2.kv.json");

    const run1 = await runMigrationCli({
      args: ["--dry-run", "--backup", backupFile, "--out-sql", sql1File, "--out-kv", kv1File],
      shortioFixtures: {
        folders: [{ id: "fld_idem", name: "Idem", color: "#0693E3", DomainId: 1516440 }],
        links: [
          {
            id: "lnk_idem_1",
            path: "idem-slug",
            originalURL: "https://gdgjakarta.com/idem",
            FolderId: "fld_idem",
            clicks: 250,
          },
        ],
      },
    });
    assert.equal(run1.exitCode, 0, run1.stderr);

    // Offline --from-backup re-run (must make zero Short.io API requests)
    const run2 = await runMigrationCli({
      args: ["--dry-run", "--from-backup", backupFile, "--out-sql", sql2File, "--out-kv", kv2File],
      env: { SHORTIO_API_KEY: "" },
    });
    assert.equal(run2.exitCode, 0, run2.stderr);
    assert.equal(run2.requests.length, 0);

    const kv1 = JSON.parse(fs.readFileSync(kv1File, "utf8"));
    const kv2 = JSON.parse(fs.readFileSync(kv2File, "utf8"));
    assert.equal(kv2.length, kv1.length);
    assert.equal(kv2[1].key, kv1[1].key);
    assert.equal(JSON.parse(kv2[1].value).originalURL, JSON.parse(kv1[1].value).originalURL);

    // Apply run1 SQL then run2 SQL against Miniflare D1 -> zero errors and single preserved row
    const sql1 = fs.readFileSync(sql1File, "utf8");
    const sql2 = fs.readFileSync(sql2File, "utf8");
    assert.match(sql2, /ON CONFLICT\(hostname, path\) DO UPDATE SET/);
    assert.match(sql2, /MAX\(short_links\.legacy_clicks, excluded\.legacy_clicks\)/);

    await harness.db.batch(splitSqlStatements(sql1).map((s) => harness.db.prepare(s)));
    await harness.db.batch(splitSqlStatements(sql2).map((s) => harness.db.prepare(s)));

    const rowsRes = await harness.db.prepare("SELECT COUNT(*) AS cnt FROM short_links").first();
    assert.equal(rowsRes?.cnt, 1);
    const row = await getLinkRow(harness.db, "lnk_idem_1");
    assert.equal(row?.legacy_clicks, 250);
  });
});
