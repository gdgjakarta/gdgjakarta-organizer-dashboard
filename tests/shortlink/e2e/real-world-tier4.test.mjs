import {
  bootShortlinkHarness,
  getClickRows,
  getKvValue,
  getLinkRow,
  harnessState,
  installShortlinkHooks,
  parseSetCookie,
  parseSetCookieMap,
  putKvValue,
  runMigrationCli,
} from "./harness.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

installShortlinkHooks();

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

async function applySqlAndKvToHarness(harness, sqlPath, kvPath) {
  const sqlContent = fs.readFileSync(sqlPath, "utf8");
  for (const stmt of splitSqlStatements(sqlContent)) {
    await harness.db.prepare(stmt).run();
  }

  const kvEntries = JSON.parse(fs.readFileSync(kvPath, "utf8"));
  for (const entry of kvEntries) {
    await putKvValue(harness.kv, entry.key, entry.value);
  }
}

describe("Shortlinks E2E Tier 4: Real-World GDG Jakarta Application Scenarios", () => {
  let harness;
  let actions;
  let advancedActions;
  let shortenRoute;
  let NextRequest;

  before(async () => {
    harness = await bootShortlinkHarness();
    actions = await import("@/server/shortio-actions");
    advancedActions = await import("@/server/shortio-advanced-actions");
    shortenRoute = await import("@/app/api/links/shorten/route");
    ({ NextRequest } = await import("next/server"));
  });

  beforeEach(async () => {
    await harness.resetState();
  });

  after(async () => {
    await harness.dispose();
  });

  it("T4-1: DevFest Jakarta Registration Campaign (OS/Geo/UTM/Pixels + diverse attendee traffic -> analytics & clickstream)", async () => {
    const folder = await actions.createShortFolderAction({ name: "DevFest 2026", color: "#4285F4" });
    assert.equal(folder.success, true);

    const created = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/devfest-2026",
      path: "df26-register",
      title: "DevFest Jakarta 2026 Registration",
      folderId: folder.data.id,
      tags: ["DevFest", "Campaign"],
      androidURL: "https://play.google.com/store/apps/details?id=com.gdgjakarta.devfest",
      iphoneURL: "https://apps.apple.com/id/app/devfest-jakarta/id987654",
      geoTargets: [
        { country: "ID", url: "https://gdgjakarta.com/id/events/devfest-2026" },
        { country: "SG", url: "https://gdgjakarta.com/sg/events/devfest-2026" },
      ],
      utmParams: {
        source: "devfest-launch",
        medium: "community",
        campaign: "df26",
      },
      pixels: {
        metaPixelId: "99887766554433",
        ga4Id: "G-DEVFEST26",
      },
    });
    assert.equal(created.success, true);
    const linkId = created.data.id;

    // 1. Android Mobile attendee in ID
    const rAndroid = await harness.fetchEdge("/df26-register", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
        referer: "https://instagram.com/",
      },
      cf: { country: "ID", city: "Jakarta" },
    });
    assert.equal(rAndroid.status, 200);
    const androidHtml = await rAndroid.text();
    assert.match(androidHtml, /99887766554433/);
    assert.match(androidHtml, /G-DEVFEST26/);
    assert.match(
      androidHtml,
      /play\.google\.com\/store\/apps\/details\?id=com\.gdgjakarta\.devfest&amp;utm_source=devfest-launch/,
    );

    // 2. iOS Mobile attendee in ID
    const rIos = await harness.fetchEdge("/df26-register", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      },
      cf: { country: "ID", city: "Depok" },
    });
    assert.equal(rIos.status, 200);
    assert.match(await rIos.text(), /apps\.apple\.com\/id\/app\/devfest-jakarta\/id987654\?utm_source=devfest-launch/);

    // 3. Desktop attendee in ID
    const rDesktopId = await harness.fetchEdge("/df26-register", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      },
      cf: { country: "ID", city: "Jakarta" },
    });
    assert.equal(rDesktopId.status, 200);
    assert.match(await rDesktopId.text(), /gdgjakarta\.com\/id\/events\/devfest-2026\?utm_source=devfest-launch/);

    // 4. Desktop attendee in SG
    const rDesktopSg = await harness.fetchEdge("/df26-register", {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/128.0",
      },
      cf: { country: "SG", city: "Singapore" },
    });
    assert.equal(rDesktopSg.status, 200);
    assert.match(await rDesktopSg.text(), /gdgjakarta\.com\/sg\/events\/devfest-2026\?utm_source=devfest-launch/);

    // 5. Desktop attendee in US (falls back to originalURL)
    const rDesktopUs = await harness.fetchEdge("/df26-register", {
      headers: {
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      },
      cf: { country: "US", city: "Mountain View" },
    });
    assert.equal(rDesktopUs.status, 200);
    assert.match(await rDesktopUs.text(), /gdgjakarta\.com\/events\/devfest-2026\?utm_source=devfest-launch/);

    // 6. Crawler/Bot UA in US
    const rBot = await harness.fetchEdge("/df26-register", {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
      cf: { country: "US", city: "San Jose" },
    });
    assert.equal(rBot.status, 200);

    await harness.waitForClickCount(linkId, 6);

    const statsRes = await advancedActions.getLinkStatsAction(linkId, "total");
    assert.equal(statsRes.success, true);
    assert.equal(statsRes.data?.totalClicks, 6);
    assert.equal(statsRes.data?.humanClicks, 5);

    const countryCounts = Object.fromEntries((statsRes.data?.country ?? []).map((c) => [c.country, c.score]));
    assert.equal(countryCounts.ID, 3);
    assert.equal(countryCounts.SG, 1);
    assert.equal(countryCounts.US, 2);

    const osCounts = Object.fromEntries((statsRes.data?.os ?? []).map((o) => [o.os, o.score]));
    assert.equal(osCounts.Android, 1);
    assert.equal(osCounts.iOS, 1);
    assert.equal(osCounts.macOS, 1);
    assert.equal(osCounts.Windows, 1);

    const deviceCounts = Object.fromEntries((statsRes.data?.device ?? []).map((d) => [d.device, d.score]));
    assert.equal(deviceCounts.Mobile, 2);
    assert.equal(deviceCounts.Desktop, 3);
    assert.equal(deviceCounts.Bot, 1);

    const streamRes = await advancedActions.getLinkClickstreamAction(linkId, { limit: 10 });
    assert.equal(streamRes.success, true);
    assert.equal(streamRes.data?.length, 6);
    assert.equal(streamRes.data?.filter((e) => e.isBot).length, 1);
  });

  it("T4-2: Speaker Handbook & VIP Materials (password-protected Link Bundle + UTM + click recording)", async () => {
    const created = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/speakers",
      path: "df26-speaker-kit",
      title: "DevFest 2026 Speaker Handbook & VIP Kit",
      linkType: "bundle",
      password: "gdg-speaker-vip-2026",
      utmParams: {
        source: "speaker-kit",
        medium: "handbook",
      },
      bundleItems: [
        {
          title: "Official Slide Deck Template",
          url: "https://gdgjakarta.com/speakers/slides",
          description: "16:9 widescreen GDG Jakarta theme",
        },
        {
          title: "Backstage & AV Check-in Guide",
          url: "https://gdgjakarta.com/speakers/av-guide",
          description: "Arrival schedule and HDMI/USB-C specs",
        },
        {
          title: "VIP Dinner Location",
          url: "https://gdgjakarta.com/speakers/vip-dinner?table=main",
        },
      ],
    });
    assert.equal(created.success, true);
    const linkId = created.data.id;

    // 1. Unauthorized GET renders password prompt and hides bundle items
    const promptRes = await harness.fetchEdge("/df26-speaker-kit");
    assert.equal(promptRes.status, 200);
    const promptHtml = await promptRes.text();
    assert.match(promptHtml, /Password Required/i);
    assert.doesNotMatch(promptHtml, /Official Slide Deck Template/);

    // 2. Wrong password POST returns 401
    const wrongPost = await harness.fetchEdge("/df26-speaker-kit", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "not-the-right-password" }).toString(),
    });
    assert.equal(wrongPost.status, 401);
    assert.match(await wrongPost.text(), /Incorrect password/i);

    // 3. Correct password POST sets HMAC unlock cookie with 303 redirect
    const okPost = await harness.fetchEdge("/df26-speaker-kit", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "gdg-speaker-vip-2026" }).toString(),
    });
    assert.equal(okPost.status, 303);
    const unlockCookieName = `sl_unlock_${linkId}`;
    const cookies = parseSetCookie(okPost);
    const unlockCookie = cookies.find((c) => c.name === unlockCookieName);
    assert.ok(unlockCookie?.value);
    assert.equal(unlockCookie?.httpOnly, true);

    // 4. Follow-up GET with unlock cookie renders branded bundle HTML with UTM-merged item URLs
    const bundleRes = await harness.fetchEdge("/df26-speaker-kit", {
      cookies: { [unlockCookieName]: unlockCookie.value },
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0.0.0 Safari/537.36",
      },
      cf: { country: "ID", city: "Jakarta" },
    });
    assert.equal(bundleRes.status, 200);
    const bundleHtml = await bundleRes.text();
    assert.match(bundleHtml, /DevFest 2026 Speaker Handbook &amp; VIP Kit/);
    assert.match(bundleHtml, /Official Slide Deck Template/);
    assert.match(bundleHtml, /Backstage &amp; AV Check-in Guide/);
    assert.match(
      bundleHtml,
      /https:\/\/gdgjakarta\.com\/speakers\/slides\?utm_source=speaker-kit&amp;utm_medium=handbook/,
    );
    assert.match(
      bundleHtml,
      /https:\/\/gdgjakarta\.com\/speakers\/vip-dinner\?table=main&amp;utm_source=speaker-kit&amp;utm_medium=handbook/,
    );

    await harness.waitForClickCount(linkId, 1);
    const stats = await advancedActions.getLinkStatsAction(linkId, "total");
    assert.equal(stats.success, true);
    assert.equal(stats.data?.humanClicks, 1);
  });

  it("T4-3: Early-Bird Ticket Drop with Hard Cap (maxClicks: 5 under 12 concurrent hits -> 5 target, 7 waitlist)", async () => {
    const created = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/devfest/early-bird",
      path: "df26-earlybird",
      title: "DevFest 2026 Early Bird (5 Slots)",
      maxClicks: 5,
      expiredURL: "https://gdgjakarta.com/events/devfest/waitlist",
    });
    assert.equal(created.success, true);
    const linkId = created.data.id;

    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, idx) =>
        harness.fetchEdge(`/df26-earlybird`, {
          headers: {
            "user-agent": `Mozilla/5.0 (Linux; Android 14; Device-${idx}) Chrome/126.0.0.0 Mobile`,
          },
          cf: { country: "ID", city: "Jakarta" },
        }),
      ),
    );

    const locations = responses.map((r) => {
      assert.equal(r.status, 302);
      return r.headers.get("location");
    });

    const targetHits = locations.filter((loc) => loc === "https://gdgjakarta.com/events/devfest/early-bird").length;
    const waitlistHits = locations.filter((loc) => loc === "https://gdgjakarta.com/events/devfest/waitlist").length;

    assert.equal(targetHits, 5);
    assert.equal(waitlistHits, 7);

    await harness.waitForClickCount(linkId, 5);
    const row = await getLinkRow(harness.db, linkId);
    assert.equal(row?.clicks_count, 5);

    const clickRows = await getClickRows(harness.db, linkId);
    assert.equal(clickRows.length, 5);

    const stats = await advancedActions.getLinkStatsAction(linkId, "total");
    assert.equal(stats.success, true);
    assert.equal(stats.data?.totalClicks, 5);
  });

  it("T4-4: Landing Page A/B Experiment (70/30 splitTargets + sticky HMAC cookie + per-variant analytics)", async () => {
    const created = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/devfest-v1",
      path: "df26-ab-landing",
      title: "DevFest Landing A/B",
      linkType: "split",
      splitTargets: [
        { url: "https://gdgjakarta.com/events/devfest-v1", weight: 70, label: "variant-a" },
        { url: "https://gdgjakarta.com/events/devfest-v2", weight: 30, label: "variant-b" },
      ],
    });
    assert.equal(created.success, true);
    const linkId = created.data.id;
    const stickyName = `sl_split_${linkId}`;

    // Returning user receives sticky assignment and keeps same variant across 4 hits without re-setting cookie
    const returningFirst = await harness.fetchEdge("/df26-ab-landing", { cf: { country: "ID" } });
    assert.equal(returningFirst.status, 302);
    const returningTarget = returningFirst.headers.get("location");
    const returningCookie = parseSetCookieMap(returningFirst)[stickyName];
    assert.ok(returningCookie);

    for (let i = 0; i < 3; i += 1) {
      const followUp = await harness.fetchEdge("/df26-ab-landing", {
        cookies: { [stickyName]: returningCookie },
        cf: { country: "ID" },
      });
      assert.equal(followUp.status, 302);
      assert.equal(followUp.headers.get("location"), returningTarget);
      assert.equal(parseSetCookie(followUp).length, 0);
    }

    // Fresh visitors exercise both variants
    const seenTargets = new Set([returningTarget]);
    let freshHits = 0;
    for (let i = 0; i < 40; i += 1) {
      const freshRes = await harness.fetchEdge("/df26-ab-landing", { cf: { country: "ID" } });
      assert.equal(freshRes.status, 302);
      const loc = freshRes.headers.get("location");
      seenTargets.add(loc);
      assert.ok(parseSetCookieMap(freshRes)[stickyName]);
      freshHits += 1;
      if (freshHits >= 20 && seenTargets.size === 2) {
        break;
      }
    }

    assert.equal(seenTargets.size, 2);
    const totalExpected = 4 + freshHits;
    await harness.waitForClickCount(linkId, totalExpected);

    const splitStats = await advancedActions.getSplitTestStatsAction(linkId, "total");
    assert.equal(splitStats.success, true);
    assert.equal(splitStats.data?.length, 2);
    const statSum = splitStats.data.reduce((sum, s) => sum + s.clicks, 0);
    assert.equal(statSum, totalExpected);
    assert.ok(splitStats.data.every((s) => s.clicks > 0 && s.percentage > 0));

    const linkStats = await advancedActions.getLinkStatsAction(linkId, "total");
    assert.equal(linkStats.success, true);
    assert.equal(linkStats.data?.totalClicks, totalExpected);
    assert.equal(linkStats.data?.splitVariants?.length, 2);
  });

  it("T4-5: Short.io-to-Cloudflare Cutover Migration (paginated >150 links, backup, idempotency, password flag, D1+KV edge & legacy_clicks)", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "t4-cutover-migration-"));
    const backupPath = path.join(tmpDir, "shortio-backup.json");
    const sqlPath = path.join(tmpDir, "cutover.sql");
    const kvPath = path.join(tmpDir, "cutover-kv.json");
    const reportPath = path.join(tmpDir, "cutover-report.json");
    const replaySqlPath = path.join(tmpDir, "replay.sql");
    const replayKvPath = path.join(tmpDir, "replay-kv.json");

    try {
      const fixturesLinks = [];
      for (let i = 1; i <= 152; i += 1) {
        fixturesLinks.push({
          id: `lnk_cutover_${i}`,
          path: `cutover-${i}`,
          originalURL: `https://gdgjakarta.com/events/item-${i}`,
          title: `Event Link ${i}`,
          folderId: i % 2 === 0 ? "fld_cut_even" : "fld_cut_odd",
          clicks: i === 1 ? 500 : 10,
          archived: false,
        });
      }
      fixturesLinks.push(
        {
          id: "lnk_cutover_arch_1",
          path: "old-archived-link",
          originalURL: "https://gdgjakarta.com/events/archived",
          archived: true,
          clicks: 33,
        },
        {
          id: "lnk_cutover_pwd_1",
          path: "vip-cutover",
          originalURL: "https://gdgjakarta.com/events/vip-cutover",
          hasPassword: true,
          clicks: 75,
        },
        {
          id: "lnk_cutover_301",
          path: "permanent-cutover",
          originalURL: "https://gdgjakarta.com/about",
          redirectType: 301,
          clicks: 120,
        },
      );

      const cliRes = await runMigrationCli({
        args: [
          "--dry-run",
          "--backup",
          backupPath,
          "--out-sql",
          sqlPath,
          "--out-kv",
          kvPath,
          "--out-report",
          reportPath,
        ],
        shortioFixtures: {
          folders: [
            { id: "fld_cut_even", name: "Even Track", color: "#4285F4", DomainId: 1516440 },
            { id: "fld_cut_odd", name: "Odd Track", color: "#34A853", DomainId: 1516440 },
          ],
          links: fixturesLinks,
        },
      });

      assert.equal(cliRes.exitCode, 0);
      assert.match(cliRes.stderr, /WARNING: 1 password-protected link\(s\)/);

      // Verify paginated Short.io export (>150 links -> >=2 /api/links requests)
      const listApiRequests = cliRes.requests.filter((r) => new URL(r.url).pathname === "/api/links");
      assert.ok(listApiRequests.length >= 2);

      const backupJson = JSON.parse(fs.readFileSync(backupPath, "utf8"));
      assert.equal(backupJson.links.length, 155);

      const reportJson = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      assert.equal(reportJson.summary.linksCount, 155);
      assert.equal(reportJson.summary.activeLinksCount, 154);
      assert.equal(reportJson.summary.archivedLinksCount, 1);
      assert.equal(reportJson.summary.flaggedPasswordLinksCount, 1);

      // Replay from backup is offline & idempotent
      const replayRes = await runMigrationCli({
        args: ["--dry-run", "--from-backup", backupPath, "--out-sql", replaySqlPath, "--out-kv", replayKvPath],
      });
      assert.equal(replayRes.exitCode, 0);
      assert.equal(replayRes.requests.length, 0);
      assert.equal(fs.readFileSync(replayKvPath, "utf8"), fs.readFileSync(kvPath, "utf8"));

      // Load generated SQL + KV into Miniflare D1 + KV twice to verify D1 ON CONFLICT idempotency
      await applySqlAndKvToHarness(harness, sqlPath, kvPath);
      await applySqlAndKvToHarness(harness, replaySqlPath, replayKvPath);

      // Active migrated link serves 302 immediately at Worker edge
      const activeRes = await harness.fetchEdge("/cutover-1", { cf: { country: "ID", city: "Jakarta" } });
      assert.equal(activeRes.status, 302);
      assert.equal(activeRes.headers.get("location"), "https://gdgjakarta.com/events/item-1");

      // 301 migrated link preserves redirectType
      const permRes = await harness.fetchEdge("/permanent-cutover");
      assert.equal(permRes.status, 301);
      assert.equal(permRes.headers.get("location"), "https://gdgjakarta.com/about");

      // Archived migrated link returns branded 404
      const archRes = await harness.fetchEdge("/old-archived-link");
      assert.equal(archRes.status, 404);
      assert.match(await archRes.text(), /gdgjakarta\.com/);

      await harness.waitForClickCount("lnk_cutover_1", 1);

      const stats = await advancedActions.getLinkStatsAction("lnk_cutover_1", "total");
      assert.equal(stats.success, true);
      assert.equal(stats.data?.legacyClicks, 500);
      assert.equal(stats.data?.totalClicks, 501);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("T4-6: n8n Automation Workflow via /api/links/shorten (fail-closed 401 -> POST cloaked+UTM -> GET lookup -> edge <iframe>)", async () => {
    // 1. Unauthenticated probes fail closed
    const badPost = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "invalid-key" },
      body: JSON.stringify({ originalURL: "https://gdgjakarta.com/rsvp", path: "rsvp-bad" }),
    });
    assert.equal((await shortenRoute.POST(badPost)).status, 401);

    const badGet = new NextRequest("https://gdgjakarta.com/api/links/shorten?path=rsvp-bad", {
      method: "GET",
    });
    assert.equal((await shortenRoute.GET(badGet)).status, 401);

    // 2. Authenticated n8n POST creates cloaked + UTM link
    const n8nPost = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-shortlink-api-key",
      },
      body: JSON.stringify({
        originalURL: "https://gdgjakarta.com/events/ai-study-jam",
        path: "n8n-study-jam",
        title: "AI Study Jam RSVP",
        cloaking: true,
        tags: ["n8n", "StudyJam"],
        utmParams: {
          source: "n8n-email",
          medium: "automation",
          campaign: "ai-study-jam",
        },
      }),
    });
    const postRes = await shortenRoute.POST(n8nPost);
    assert.equal(postRes.status, 201);
    const postPayload = await postRes.json();
    assert.equal(postPayload.shortURL, "https://gdgjakarta.org/n8n-study-jam");
    const createdId = postPayload.id;

    // 3. n8n deduplicates/looks up via GET ?originalURL=... and GET ?path=...
    const lookupByUrl = new NextRequest(
      `https://gdgjakarta.com/api/links/shorten?originalURL=${encodeURIComponent("https://gdgjakarta.com/events/ai-study-jam")}`,
      {
        method: "GET",
        headers: { authorization: "Bearer test-shortlink-api-key" },
      },
    );
    const lookupUrlRes = await shortenRoute.GET(lookupByUrl);
    assert.equal(lookupUrlRes.status, 200);
    assert.equal((await lookupUrlRes.json()).link?.id, createdId);

    const lookupBySlug = new NextRequest("https://gdgjakarta.com/api/links/shorten?path=n8n-study-jam", {
      method: "GET",
      headers: { "x-api-key": "test-shortlink-api-key" },
    });
    const lookupSlugRes = await shortenRoute.GET(lookupBySlug);
    assert.equal(lookupSlugRes.status, 200);
    assert.equal((await lookupSlugRes.json()).link?.cloaking, true);

    // 4. Immediately resolves at Worker edge with cloaked <iframe> + UTM-merged URL & logs click
    const edgeRes = await harness.fetchEdge("/n8n-study-jam", {
      cf: { country: "ID", city: "Jakarta" },
    });
    assert.equal(edgeRes.status, 200);
    const html = await edgeRes.text();
    assert.match(
      html,
      /<iframe\s+src="https:\/\/gdgjakarta\.com\/events\/ai-study-jam\?utm_source=n8n-email&amp;utm_medium=automation&amp;utm_campaign=ai-study-jam"/i,
    );

    await harness.waitForClickCount(createdId, 1);
  });

  it("T4-7: Mobile Deep Linking + Dual-Mode Safety Rollback (cloudflare -> shortio -> cloudflare without breaking edge links)", async () => {
    harnessState.setAuthRole("executive");
    const aasa = JSON.stringify({
      applinks: { apps: [], details: [{ appID: "GDG.Jakarta.App", paths: ["/events/*", "/tickets/*"] }] },
    });
    const assetLinks = JSON.stringify([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "org.gdgjakarta.companion" },
      },
    ]);

    const domainUpdate = await advancedActions.updateShortDomainConfigAction(1516440, {
      appleAppSiteAssociation: aasa,
      assetLinks,
    });
    assert.equal(domainUpdate.success, true);

    const cfLink = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/live-event",
      path: "cf-persistent",
    });
    assert.equal(cfLink.success, true);

    assert.equal((await harness.fetchEdge("/.well-known/apple-app-site-association")).status, 200);
    assert.equal((await harness.fetchEdge("/.well-known/assetlinks.json")).status, 200);
    assert.equal((await harness.fetchEdge("/cf-persistent")).status, 302);

    // Rollback toggle to Short.io provider
    harnessState.setEnv({ SHORTLINK_PROVIDER: "shortio" });

    const sioCreate = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/rollback-event",
      path: "sio-rollback",
    });
    assert.equal(sioCreate.success, true);
    assert.ok(harnessState.shortio.requests.some((r) => r.method === "POST" && r.url.includes("/links")));

    const sioList = await actions.fetchShortLinksAction();
    assert.equal(sioList.success, true);
    assert.equal(
      sioList.data?.some((l) => l.path === "sio-rollback"),
      true,
    );
    assert.equal(await getLinkRow(harness.db, { hostname: "gdgjakarta.org", path: "sio-rollback" }), null);

    // Existing D1/KV edge routes and /.well-known/* continue serving seamlessly during rollback
    const edgeStillWorks = await harness.fetchEdge("/cf-persistent");
    assert.equal(edgeStillWorks.status, 302);
    assert.equal(edgeStillWorks.headers.get("location"), "https://gdgjakarta.com/events/live-event");

    const wellKnownStillWorks = await harness.fetchEdge("/.well-known/assetlinks.json");
    assert.equal(wellKnownStillWorks.status, 200);
    assert.deepEqual(await wellKnownStillWorks.json(), JSON.parse(assetLinks));

    // Toggle back to Cloudflare mode -> resumes D1+KV writes and Worker resolution
    harnessState.setEnv({ SHORTLINK_PROVIDER: "cloudflare" });

    const cfResumed = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/resumed-event",
      path: "cf-resumed",
    });
    assert.equal(cfResumed.success, true);
    assert.ok(await getKvValue(harness.kv, "gdgjakarta.org:cf-resumed"));

    const edgeResumed = await harness.fetchEdge("/cf-resumed");
    assert.equal(edgeResumed.status, 302);
    assert.equal(edgeResumed.headers.get("location"), "https://gdgjakarta.com/events/resumed-event");
  });
});
