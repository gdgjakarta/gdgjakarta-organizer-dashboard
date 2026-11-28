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

describe("Shortlinks E2E Tier 3: Cross-Feature Pairwise Combinations (F1–F14)", () => {
  let harness;
  let actions;
  let advancedActions;
  let speakerActions;
  let shortenRoute;
  let NextRequest;

  before(async () => {
    harness = await bootShortlinkHarness();
    actions = await import("@/server/shortio-actions");
    advancedActions = await import("@/server/shortio-advanced-actions");
    speakerActions = await import("@/server/speaker-confirmation-actions");
    shortenRoute = await import("@/app/api/links/shorten/route");
    ({ NextRequest } = await import("next/server"));
  });

  beforeEach(async () => {
    await harness.resetState();
  });

  after(async () => {
    await harness.dispose();
  });

  it("T3-1 [F1,F5,F11,F12]: creates/updates link via server actions -> KV sync -> edge redirect + UTM merge -> D1 clickstream & analytics", async () => {
    const created = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/devfest?utm_source=pinned-target&ref=existing",
      path: "t3-utm-flow",
      title: "T3 UTM Flow",
      redirectType: 302,
      utmParams: {
        source: "shortlink-utm",
        medium: "qr",
        campaign: "devfest26",
      },
    });
    assert.equal(created.success, true);
    assert.ok(created.data?.id);

    const updated = await actions.updateShortLinkAction(created.data.id, {
      redirectType: 301,
      utmParams: {
        source: "shortlink-utm",
        medium: "flyer",
        campaign: "devfest26-updated",
        content: "poster",
      },
    });
    assert.equal(updated.success, true);

    const kvRecord = await getKvValue(harness.kv, "gdgjakarta.org:t3-utm-flow");
    assert.equal(kvRecord?.redirectType, 301);
    assert.equal(kvRecord?.utmParams?.medium, "flyer");
    assert.equal(kvRecord?.utmParams?.campaign, "devfest26-updated");

    const edgeRes = await harness.fetchEdge("/t3-utm-flow?utm_medium=incoming-ignored&fbclid=fb123&ref=override", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        referer: "https://gdgjakarta.com/schedule",
      },
      cf: { country: "ID", city: "Jakarta" },
    });
    assert.equal(edgeRes.status, 301);

    const loc = new URL(edgeRes.headers.get("location") ?? "");
    // Target URL params win over link utmParams, which win over incoming query params
    assert.equal(loc.searchParams.get("utm_source"), "pinned-target");
    assert.equal(loc.searchParams.get("ref"), "existing");
    assert.equal(loc.searchParams.get("utm_medium"), "flyer");
    assert.equal(loc.searchParams.get("utm_campaign"), "devfest26-updated");
    assert.equal(loc.searchParams.get("utm_content"), "poster");
    assert.equal(loc.searchParams.get("fbclid"), "fb123");

    await harness.waitForClickCount(created.data.id, 1);

    const statsRes = await advancedActions.getLinkStatsAction(created.data.id, "total");
    assert.equal(statsRes.success, true);
    assert.equal(statsRes.data?.totalClicks, 1);
    assert.equal(statsRes.data?.humanClicks, 1);
    assert.equal(statsRes.data?.country?.[0]?.country, "ID");
    assert.equal(statsRes.data?.cities?.[0]?.city, "Jakarta");

    const linkStreamRes = await advancedActions.getLinkClickstreamAction(created.data.id, { limit: 10 });
    assert.equal(linkStreamRes.success, true);
    assert.equal(linkStreamRes.data?.length, 1);
    assert.equal(linkStreamRes.data?.[0]?.country, "ID");
    assert.equal(linkStreamRes.data?.[0]?.referer, "https://gdgjakarta.com/schedule");

    const domainStreamRes = await advancedActions.getDomainClickstreamAction({ limit: 10, hostname: "gdgjakarta.org" });
    assert.equal(domainStreamRes.success, true);
    assert.equal(domainStreamRes.data?.length, 1);
    assert.equal(domainStreamRes.data?.[0]?.linkId, created.data.id);
  });

  it("T3-2 [F2,F3,F7]: enforces expiresAt before password & maxClicks, and gates maxClicks consumption behind password unlock", async () => {
    const expiredLink = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/past-vip",
      path: "t3-expired-first",
      password: "vip-password-123",
      expiresAt: Date.now() - 60_000,
      expiredURL: "https://gdgjakarta.com/events/ended",
      maxClicks: 5,
    });
    assert.equal(expiredLink.success, true);

    const expiredRes = await harness.fetchEdge("/t3-expired-first");
    assert.equal(expiredRes.status, 302);
    assert.equal(expiredRes.headers.get("location"), "https://gdgjakarta.com/events/ended");

    const expiredRow = await getLinkRow(harness.db, expiredLink.data.id);
    assert.equal(expiredRow?.clicks_count, 0);

    const cappedLink = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/limited-vip",
      path: "t3-pwd-cap",
      password: "secret-vip-pass",
      expiresAt: Date.now() + 3_600_000,
      expiredURL: "https://gdgjakarta.com/events/waitlist",
      maxClicks: 1,
    });
    assert.equal(cappedLink.success, true);

    // Unauthenticated GET returns password prompt and does NOT consume maxClicks
    const promptRes = await harness.fetchEdge("/t3-pwd-cap");
    assert.equal(promptRes.status, 200);
    assert.match(await promptRes.text(), /Password Required/i);
    assert.equal((await getLinkRow(harness.db, cappedLink.data.id))?.clicks_count, 0);

    // POST correct password -> 303 with sl_unlock_<id>
    const unlockRes = await harness.fetchEdge("/t3-pwd-cap", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "secret-vip-pass" }).toString(),
    });
    assert.equal(unlockRes.status, 303);
    const cookieMap = parseSetCookieMap(unlockRes);
    const unlockCookieName = `sl_unlock_${cappedLink.data.id}`;
    assert.ok(cookieMap[unlockCookieName]);

    // 1st unlocked GET consumes the single allowed click
    const firstAllowed = await harness.fetchEdge("/t3-pwd-cap", {
      cookies: { [unlockCookieName]: cookieMap[unlockCookieName] },
    });
    assert.equal(firstAllowed.status, 302);
    assert.equal(firstAllowed.headers.get("location"), "https://gdgjakarta.com/events/limited-vip");
    await harness.waitForClickCount(cappedLink.data.id, 1);

    // 2nd unlocked GET hits maxClicks exhaustion -> expiredURL without incrementing clicks_count
    const secondExhausted = await harness.fetchEdge("/t3-pwd-cap", {
      cookies: { [unlockCookieName]: cookieMap[unlockCookieName] },
    });
    assert.equal(secondExhausted.status, 302);
    assert.equal(secondExhausted.headers.get("location"), "https://gdgjakarta.com/events/waitlist");

    const finalRow = await getLinkRow(harness.db, cappedLink.data.id);
    assert.equal(finalRow?.clicks_count, 1);
  });

  it("T3-3 [F3,F4]: gates cloaked <iframe> HTML behind HMAC password unlock cookie", async () => {
    const created = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/handbook/secret-slides",
      path: "t3-pwd-cloak",
      title: "Secret Slides",
      password: "cloak-password-99",
      cloaking: true,
    });
    assert.equal(created.success, true);

    const unauthRes = await harness.fetchEdge("/t3-pwd-cloak");
    assert.equal(unauthRes.status, 200);
    const unauthHtml = await unauthRes.text();
    assert.match(unauthHtml, /<form method="POST">/i);
    assert.doesNotMatch(unauthHtml, /<iframe/i);

    const badPostRes = await harness.fetchEdge("/t3-pwd-cloak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong-password" }),
    });
    assert.equal(badPostRes.status, 401);
    assert.match(await badPostRes.text(), /Incorrect password/i);

    const okPostRes = await harness.fetchEdge("/t3-pwd-cloak", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "cloak-password-99" }).toString(),
    });
    assert.equal(okPostRes.status, 303);
    const setCookies = parseSetCookie(okPostRes);
    const unlockCookie = setCookies.find((c) => c.name === `sl_unlock_${created.data.id}`);
    assert.ok(unlockCookie?.value);
    assert.equal(unlockCookie?.httpOnly, true);

    const unlockedRes = await harness.fetchEdge("/t3-pwd-cloak", {
      cookies: { [unlockCookie.name]: unlockCookie.value },
    });
    assert.equal(unlockedRes.status, 200);
    const cloakedHtml = await unlockedRes.text();
    assert.match(cloakedHtml, /<iframe\s+src="https:\/\/gdgjakarta\.com\/handbook\/secret-slides"/i);
    assert.match(cloakedHtml, /<title>Secret Slides<\/title>/i);

    await harness.waitForClickCount(created.data.id, 1);
  });

  it("T3-4 [F5]: prioritizes OS targeting over geo-targeting and preserves target query params + UTM", async () => {
    const created = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/default?channel=web",
      path: "t3-os-geo-utm",
      androidURL: "https://play.google.com/store/apps/details?id=com.gdgjakarta&utm_medium=store-pinned",
      iphoneURL: "https://apps.apple.com/app/gdgjakarta/id123456?platform=ios",
      geoTargets: [
        { country: "SG", url: "https://gdgjakarta.com/sg?locale=en-SG" },
        { country: "ID", url: "https://gdgjakarta.com/id" },
      ],
      utmParams: {
        source: "gdg-short",
        medium: "social",
        campaign: "multi-target",
      },
    });
    assert.equal(created.success, true);

    // 1. Android UA in SG -> Android wins over SG geo; existing utm_medium on target is preserved
    const androidRes = await harness.fetchEdge("/t3-os-geo-utm", {
      headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36" },
      cf: { country: "SG" },
    });
    assert.equal(androidRes.status, 302);
    const androidLoc = new URL(androidRes.headers.get("location") ?? "");
    assert.equal(androidLoc.hostname, "play.google.com");
    assert.equal(androidLoc.searchParams.get("utm_source"), "gdg-short");
    assert.equal(androidLoc.searchParams.get("utm_medium"), "store-pinned");
    assert.equal(androidLoc.searchParams.get("utm_campaign"), "multi-target");

    // 2. iPhone UA in ID -> iOS wins over ID geo
    const iosRes = await harness.fetchEdge("/t3-os-geo-utm", {
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      },
      cf: { country: "ID" },
    });
    assert.equal(iosRes.status, 302);
    const iosLoc = new URL(iosRes.headers.get("location") ?? "");
    assert.equal(iosLoc.hostname, "apps.apple.com");
    assert.equal(iosLoc.searchParams.get("platform"), "ios");
    assert.equal(iosLoc.searchParams.get("utm_source"), "gdg-short");
    assert.equal(iosLoc.searchParams.get("utm_medium"), "social");

    // 3. Desktop UA in SG -> Geo SG
    const sgRes = await harness.fetchEdge("/t3-os-geo-utm", {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0" },
      cf: { country: "SG" },
    });
    assert.equal(sgRes.status, 302);
    const sgLoc = new URL(sgRes.headers.get("location") ?? "");
    assert.equal(sgLoc.pathname, "/sg");
    assert.equal(sgLoc.searchParams.get("locale"), "en-SG");
    assert.equal(sgLoc.searchParams.get("utm_campaign"), "multi-target");

    // 4. Desktop UA in US (unmatched geo) -> fallback to originalURL with UTM
    const usRes = await harness.fetchEdge("/t3-os-geo-utm", {
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0.0.0" },
      cf: { country: "US" },
    });
    assert.equal(usRes.status, 302);
    const usLoc = new URL(usRes.headers.get("location") ?? "");
    assert.equal(usLoc.pathname, "/events/default");
    assert.equal(usLoc.searchParams.get("channel"), "web");
    assert.equal(usLoc.searchParams.get("utm_source"), "gdg-short");

    await harness.waitForClickCount(created.data.id, 4);
  });

  it("T3-5 [F1,F5,F6]: serves retargeting pixels interstitial with UTM-merged redirect & logs async click", async () => {
    const created = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/io-extended",
      path: "t3-pixels-utm",
      title: "I/O Extended Pixels",
      utmParams: {
        source: "meta-ads",
        medium: "cpc",
        campaign: "io26",
      },
      pixels: {
        metaPixelId: "123456789012345",
        gtmId: "GTM-GDGJKT1",
        ga4Id: "G-GDGJKT2026",
      },
    });
    assert.equal(created.success, true);

    const res = await harness.fetchEdge("/t3-pixels-utm", {
      cf: { country: "ID", city: "Bandung" },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/i);

    const html = await res.text();
    assert.match(html, /123456789012345/);
    assert.match(html, /GTM-GDGJKT1/);
    assert.match(html, /G-GDGJKT2026/);
    assert.match(
      html,
      /<meta http-equiv="refresh" content="1;url=https:\/\/gdgjakarta\.com\/events\/io-extended\?utm_source=meta-ads&amp;utm_medium=cpc&amp;utm_campaign=io26"/i,
    );
    assert.match(
      html,
      /<a class="btn" href="https:\/\/gdgjakarta\.com\/events\/io-extended\?utm_source=meta-ads&amp;utm_medium=cpc&amp;utm_campaign=io26"/i,
    );

    await harness.waitForClickCount(created.data.id, 1);
    const clicks = await getClickRows(harness.db, created.data.id);
    assert.equal(clicks.length, 1);
    assert.equal(clicks[0].city, "Bandung");
    assert.equal(
      clicks[0].target_url,
      "https://gdgjakarta.com/events/io-extended?utm_source=meta-ads&utm_medium=cpc&utm_campaign=io26",
    );
  });

  it("T3-6 [F8,F12]: enforces sticky A/B split cookie, tracks per-variant stats, and includes legacy_clicks only in total period", async () => {
    const created = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/landing/a",
      path: "t3-ab-split",
      linkType: "split",
      splitTargets: [
        { url: "https://gdgjakarta.com/landing/a", weight: 50, label: "variant-a" },
        { url: "https://gdgjakarta.com/landing/b", weight: 50, label: "variant-b" },
      ],
    });
    assert.equal(created.success, true);
    const linkId = created.data.id;

    // Seed historical legacy_clicks on the link row
    await harness.db.prepare("UPDATE short_links SET legacy_clicks = 40 WHERE id = ?").bind(linkId).run();

    // Visitor 1 first hit -> receives Set-Cookie sticky assignment
    const v1First = await harness.fetchEdge("/t3-ab-split", { cf: { country: "ID" } });
    assert.equal(v1First.status, 302);
    const firstTarget = v1First.headers.get("location");
    assert.ok(firstTarget === "https://gdgjakarta.com/landing/a" || firstTarget === "https://gdgjakarta.com/landing/b");

    const cookieName = `sl_split_${linkId}`;
    const v1Cookies = parseSetCookieMap(v1First);
    assert.ok(v1Cookies[cookieName]);

    // Visitor 1 subsequent hits with sticky cookie -> same variant, NO Set-Cookie re-emitted
    for (let i = 0; i < 3; i += 1) {
      const repeat = await harness.fetchEdge("/t3-ab-split", {
        cookies: { [cookieName]: v1Cookies[cookieName] },
        cf: { country: "ID" },
      });
      assert.equal(repeat.status, 302);
      assert.equal(repeat.headers.get("location"), firstTarget);
      assert.equal(parseSetCookie(repeat).length, 0);
    }

    // Visitor 2 without cookie -> receives fresh sticky Set-Cookie
    const v2First = await harness.fetchEdge("/t3-ab-split", { cf: { country: "SG" } });
    assert.equal(v2First.status, 302);
    const v2Cookies = parseSetCookieMap(v2First);
    assert.ok(v2Cookies[cookieName]);

    await harness.waitForClickCount(linkId, 5);

    const splitStats = await advancedActions.getSplitTestStatsAction(linkId, "total");
    assert.equal(splitStats.success, true);
    assert.equal(splitStats.data?.length, 2);
    const totalVariantClicks = splitStats.data.reduce((sum, v) => sum + v.clicks, 0);
    assert.equal(totalVariantClicks, 5);

    const totalStats = await advancedActions.getLinkStatsAction(linkId, "total");
    assert.equal(totalStats.success, true);
    assert.equal(totalStats.data?.legacyClicks, 40);
    assert.equal(totalStats.data?.totalClicks, 45);
    assert.equal(totalStats.data?.humanClicks, 45);

    const todayStats = await advancedActions.getLinkStatsAction(linkId, "today");
    assert.equal(todayStats.success, true);
    assert.equal(todayStats.data?.totalClicks, 5);
  });

  it("T3-7 [F2,F3,F9]: gates link bundle behind password + UTM merge and respects time expiration", async () => {
    const created = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/resources",
      path: "t3-bundle-auth",
      title: "GDG Speaker Pack",
      linkType: "bundle",
      password: "bundle-secret-password",
      expiresAt: Date.now() + 3_600_000,
      utmParams: {
        source: "speaker-pack",
        medium: "bundle",
      },
      bundleItems: [
        { title: "Slide Template", url: "https://gdgjakarta.com/slides", description: "Official deck" },
        { title: "Venue Guide", url: "https://gdgjakarta.com/venue?floor=2" },
      ],
    });
    assert.equal(created.success, true);

    const promptRes = await harness.fetchEdge("/t3-bundle-auth");
    assert.equal(promptRes.status, 200);
    const promptBody = await promptRes.text();
    assert.match(promptBody, /Password Required/i);
    assert.doesNotMatch(promptBody, /Slide Template/);

    const postUnlock = await harness.fetchEdge("/t3-bundle-auth", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "bundle-secret-password" }).toString(),
    });
    assert.equal(postUnlock.status, 303);
    const cookieVal = parseSetCookieMap(postUnlock)[`sl_unlock_${created.data.id}`];
    assert.ok(cookieVal);

    const unlockedRes = await harness.fetchEdge("/t3-bundle-auth", {
      cookies: { [`sl_unlock_${created.data.id}`]: cookieVal },
    });
    assert.equal(unlockedRes.status, 200);
    const bundleHtml = await unlockedRes.text();
    assert.match(bundleHtml, /Link Bundle/i);
    assert.match(bundleHtml, /Slide Template/);
    assert.match(bundleHtml, /https:\/\/gdgjakarta\.com\/slides\?utm_source=speaker-pack&amp;utm_medium=bundle/);
    assert.match(
      bundleHtml,
      /https:\/\/gdgjakarta\.com\/venue\?floor=2&amp;utm_source=speaker-pack&amp;utm_medium=bundle/,
    );

    await harness.waitForClickCount(created.data.id, 1);

    // Expire the bundle and verify 410 takes precedence over password/bundle
    const expiredUpdate = await actions.updateShortLinkAction(created.data.id, {
      expiresAt: Date.now() - 10_000,
    });
    assert.equal(expiredUpdate.success, true);

    const expiredRes = await harness.fetchEdge("/t3-bundle-auth");
    assert.equal(expiredRes.status, 410);
    assert.match(await expiredRes.text(), /Link Expired/i);
  });

  it("T3-8 [F1,F10,F11]: configures mobile deep linking via executive action -> KV sync -> serves /.well-known/* alongside root & slug routing", async () => {
    await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/events/mobile-launch",
      path: "mobile-launch",
    });

    harnessState.setAuthRole("executive");
    const aasaPayload = JSON.stringify({
      applinks: {
        apps: [],
        details: [{ appID: "TEAM123.com.gdgjakarta.app", paths: ["/events/*"] }],
      },
    });
    const assetLinksPayload = JSON.stringify([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "com.gdgjakarta.app" },
      },
    ]);

    const domainRes = await advancedActions.updateShortDomainConfigAction(1516440, {
      appleAppSiteAssociation: aasaPayload,
      assetLinks: assetLinksPayload,
    });
    assert.equal(domainRes.success, true);

    const domainKv = await getKvValue(harness.kv, "gdgjakarta.org:__domain__");
    assert.equal(domainKv?.appleAppSiteAssociation, aasaPayload);
    assert.equal(domainKv?.assetLinks, assetLinksPayload);

    const aasaRes = await harness.fetchEdge("/.well-known/apple-app-site-association");
    assert.equal(aasaRes.status, 200);
    assert.match(aasaRes.headers.get("content-type") ?? "", /application\/json/i);
    assert.deepEqual(await aasaRes.json(), JSON.parse(aasaPayload));

    const assetRes = await harness.fetchEdge("/.well-known/assetlinks.json");
    assert.equal(assetRes.status, 200);
    assert.match(assetRes.headers.get("content-type") ?? "", /application\/json/i);
    assert.deepEqual(await assetRes.json(), JSON.parse(assetLinksPayload));

    const rootRes = await harness.fetchEdge("/");
    assert.equal(rootRes.status, 302);
    assert.equal(rootRes.headers.get("location"), "https://gdgjakarta.com");

    const slugRes = await harness.fetchEdge("/mobile-launch");
    assert.equal(slugRes.status, 302);
    assert.equal(slugRes.headers.get("location"), "https://gdgjakarta.com/events/mobile-launch");
  });

  it("T3-9 [F11]: creates link in cloudflare mode (D1+KV, 0 Short.io calls), toggles to shortio -> fake Short.io responder without mutating D1", async () => {
    const cfCreated = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/cf-mode",
      path: "cf-only-slug",
    });
    assert.equal(cfCreated.success, true);
    assert.equal(harnessState.shortio.requests.length, 0);
    assert.ok(await getLinkRow(harness.db, { hostname: "gdgjakarta.org", path: "cf-only-slug" }));
    assert.ok(await getKvValue(harness.kv, "gdgjakarta.org:cf-only-slug"));

    const edgeCfRes = await harness.fetchEdge("/cf-only-slug");
    assert.equal(edgeCfRes.status, 302);
    assert.equal(edgeCfRes.headers.get("location"), "https://gdgjakarta.com/cf-mode");

    // Toggle to Short.io mode
    harnessState.setEnv({ SHORTLINK_PROVIDER: "shortio" });

    const sioCreated = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/sio-mode",
      path: "sio-only-slug",
      title: "Short.io Mode Link",
    });
    assert.equal(sioCreated.success, true);
    assert.equal(sioCreated.data?.path, "sio-only-slug");
    assert.ok(harnessState.shortio.requests.some((req) => req.method === "POST" && req.url.includes("/links")));

    // D1 & KV remain untouched by Short.io mode mutation
    assert.equal(await getLinkRow(harness.db, { hostname: "gdgjakarta.org", path: "sio-only-slug" }), null);
    assert.equal(await getKvValue(harness.kv, "gdgjakarta.org:sio-only-slug"), null);
  });

  it("T3-10 [F1,F11]: generates event shortlinks + slide template in cloudflare mode -> Firestore/Bevy sync + Worker redirect", async () => {
    harnessState.firestore.seedEvent("evt-devfest-26", {
      id: "evt-devfest-26",
      title: "DevFest Jakarta 2026",
    });

    const folderRes = await actions.createShortFolderAction({ name: "DevFest", color: "#4285F4" });
    assert.equal(folderRes.success, true);

    const liveRes = await actions.generateEventShortLinkAction({
      eventId: "evt-devfest-26",
      type: "live",
      originalURL: "http://localhost:3000/events/evt-devfest-26",
      title: "DevFest Jakarta 2026",
      customSlug: "df26-live",
      tags: ["DevFest"],
    });
    assert.equal(liveRes.success, true);
    assert.equal(liveRes.data?.originalURL, "https://gdgjakarta.com/events/evt-devfest-26");
    assert.equal(liveRes.data?.FolderId, folderRes.data?.id);

    const bevyRes = await actions.generateEventShortLinkAction({
      eventId: "evt-devfest-26",
      type: "bevy",
      originalURL: "https://gdg.community.dev/e/mdevfest26/",
      title: "DevFest Jakarta 2026",
      customSlug: "df26-bevy",
      tags: ["DevFest"],
    });
    assert.equal(bevyRes.success, true);

    const storedEvent = harnessState.firestore.getEvent("evt-devfest-26");
    assert.equal(storedEvent?.live_short_url, "https://gdgjakarta.org/df26-live");
    assert.equal(storedEvent?.bevy_short_url, "https://gdgjakarta.org/df26-bevy");
    assert.equal(harnessState.bevy.updates.length, 1);
    assert.equal(harnessState.bevy.updates[0]?.eventId, "evt-devfest-26");
    assert.equal(harnessState.bevy.updates[0]?.patch?.custom_tickets_url, "https://gdgjakarta.org/df26-live");

    const edgeLive = await harness.fetchEdge("/df26-live");
    assert.equal(edgeLive.status, 302);
    assert.equal(edgeLive.headers.get("location"), "https://gdgjakarta.com/events/evt-devfest-26");

    const edgeBevy = await harness.fetchEdge("/df26-bevy");
    assert.equal(edgeBevy.status, 302);
    assert.equal(edgeBevy.headers.get("location"), "https://gdg.community.dev/e/mdevfest26/");

    // Speaker confirmation slide template option reflects Cloudflare-stored link dynamically
    const slideLink = await actions.createShortLinkAction({
      originalURL: "https://docs.google.com/presentation/d/cf-slide-template",
      path: "gdg-slide-template",
      title: "GDG Jakarta Official Slides 2026 (Cloudflare)",
    });
    assert.equal(slideLink.success, true);

    const templateRes = await speakerActions.getExistingEventSlideTemplateOptionsAction("evt-devfest-26");
    assert.equal(templateRes.success, true);
    assert.equal(templateRes.presets?.gdg_default?.label, "GDG Jakarta Official Slides 2026 (Cloudflare)");
    assert.equal(templateRes.presets?.gdg_default?.url, "https://gdgjakarta.org/gdg-slide-template");
  });

  it("T3-11 [F1,F11,F12,F13]: /api/links/shorten fails closed (401), creates/looks up sanitized link -> edge serving & clickstream", async () => {
    const unauthReq = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ originalURL: "https://gdgjakarta.com/n8n", path: "n8n-unauth" }),
    });
    const unauthRes = await shortenRoute.POST(unauthReq);
    assert.equal(unauthRes.status, 401);

    const postReq = new NextRequest("https://gdgjakarta.com/api/links/shorten", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-shortlink-api-key",
      },
      body: JSON.stringify({
        originalURL: "https://gdgjakarta.com/events/n8n-automation",
        path: "n8n-auto",
        title: "n8n Automation",
        password: "strip-me-from-json",
        redirectType: 307,
      }),
    });
    const postRes = await shortenRoute.POST(postReq);
    assert.equal(postRes.status, 201);
    const postJson = await postRes.json();
    assert.equal(postJson.success, true);
    assert.equal(postJson.link?.path, "n8n-auto");
    assert.equal(postJson.link?.hasPassword, true);
    assert.equal("passwordHash" in postJson.link, false);
    assert.equal("password_hash" in postJson.link, false);

    // Lookup by path and by originalURL via Bearer token
    const getByPathReq = new NextRequest("https://gdgjakarta.com/api/links/shorten?path=n8n-auto", {
      method: "GET",
      headers: { authorization: "Bearer test-shortlink-api-key" },
    });
    const getByPathRes = await shortenRoute.GET(getByPathReq);
    assert.equal(getByPathRes.status, 200);
    const byPathJson = await getByPathRes.json();
    assert.equal(byPathJson.link?.id, postJson.link.id);
    assert.equal("passwordHash" in byPathJson.link, false);

    const getByUrlReq = new NextRequest(
      `https://gdgjakarta.com/api/links/shorten?originalURL=${encodeURIComponent("https://gdgjakarta.com/events/n8n-automation")}`,
      {
        method: "GET",
        headers: { authorization: "Bearer test-shortlink-api-key" },
      },
    );
    const getByUrlRes = await shortenRoute.GET(getByUrlReq);
    assert.equal(getByUrlRes.status, 200);
    const byUrlJson = await getByUrlRes.json();
    assert.equal(byUrlJson.link?.path, "n8n-auto");

    // Unlock and follow edge redirect -> clickstream recorded
    const unlockRes = await harness.fetchEdge("/n8n-auto", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "strip-me-from-json" }),
    });
    assert.equal(unlockRes.status, 303);
    const cookieVal = parseSetCookieMap(unlockRes)[`sl_unlock_${postJson.link.id}`];

    const edgeRes = await harness.fetchEdge("/n8n-auto", {
      cookies: { [`sl_unlock_${postJson.link.id}`]: cookieVal },
    });
    assert.equal(edgeRes.status, 307);
    assert.equal(edgeRes.headers.get("location"), "https://gdgjakarta.com/events/n8n-automation");

    await harness.waitForClickCount(postJson.link.id, 1);
    const streamRes = await advancedActions.getLinkClickstreamAction(postJson.link.id, { limit: 10 });
    assert.equal(streamRes.success, true);
    assert.equal(streamRes.data?.length, 1);
  });

  it("T3-12 [F1,F12,F14]: migrates Short.io fixtures via CLI -> loads D1+KV -> Worker serves migrated link + analytics preserve legacy_clicks", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "t3-migrate-legacy-"));
    const backupPath = path.join(tmpDir, "backup.json");
    const sqlPath = path.join(tmpDir, "migrate.sql");
    const kvPath = path.join(tmpDir, "migrate-kv.json");
    const reportPath = path.join(tmpDir, "report.json");

    try {
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
          folders: [{ id: "fld_mig_1", name: "DevFest Archive", color: "#34A853", DomainId: 1516440 }],
          links: [
            {
              id: "lnk_legacy_250",
              path: "devfest-legacy",
              originalURL: "https://gdgjakarta.com/events/devfest-legacy",
              title: "Legacy DevFest; Promo's",
              folderId: "fld_mig_1",
              clicks: 250,
              redirectType: 301,
            },
          ],
        },
      });

      assert.equal(cliRes.exitCode, 0);
      assert.equal(cliRes.stderr, "");

      await applySqlAndKvToHarness(harness, sqlPath, kvPath);

      const edgeRes = await harness.fetchEdge("/devfest-legacy", {
        cf: { country: "ID", city: "Jakarta" },
      });
      assert.equal(edgeRes.status, 301);
      assert.equal(edgeRes.headers.get("location"), "https://gdgjakarta.com/events/devfest-legacy");

      await harness.waitForClickCount("lnk_legacy_250", 1);

      const totalStats = await advancedActions.getLinkStatsAction("lnk_legacy_250", "total");
      assert.equal(totalStats.success, true);
      assert.equal(totalStats.data?.legacyClicks, 250);
      assert.equal(totalStats.data?.totalClicks, 251);
      assert.equal(totalStats.data?.humanClicks, 251);

      const todayStats = await advancedActions.getLinkStatsAction("lnk_legacy_250", "today");
      assert.equal(todayStats.success, true);
      assert.equal(todayStats.data?.legacyClicks, 250);
      assert.equal(todayStats.data?.totalClicks, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("T3-13 [F1,F11]: filters by folder -> archives link (KV sync -> Worker 404) -> unarchives (KV sync -> Worker 302)", async () => {
    const folderA = await actions.createShortFolderAction({ name: "Folder Alpha", color: "#1A73E8" });
    const folderB = await actions.createShortFolderAction({ name: "Folder Beta", color: "#EA4335" });
    assert.equal(folderA.success, true);
    assert.equal(folderB.success, true);

    const linkA = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/alpha",
      path: "t3-alpha",
      folderId: folderA.data.id,
    });
    const linkB = await actions.createShortLinkAction({
      originalURL: "https://gdgjakarta.com/beta",
      path: "t3-beta",
      folderId: folderB.data.id,
    });
    assert.equal(linkA.success, true);
    assert.equal(linkB.success, true);

    const filtered = await actions.fetchShortLinksAction({ folderId: folderA.data.id });
    assert.equal(filtered.success, true);
    assert.equal(filtered.data?.length, 1);
    assert.equal(filtered.data?.[0]?.id, linkA.data.id);

    const archRes = await advancedActions.archiveShortLinksAction([linkA.data.id]);
    assert.equal(archRes.success, true);
    assert.equal((await getKvValue(harness.kv, "gdgjakarta.org:t3-alpha"))?.archived, true);

    const archivedEdge = await harness.fetchEdge("/t3-alpha");
    assert.equal(archivedEdge.status, 404);
    assert.match(await archivedEdge.text(), /Short link not found/i);

    const unarchRes = await advancedActions.unarchiveShortLinksAction([linkA.data.id]);
    assert.equal(unarchRes.success, true);
    assert.equal((await getKvValue(harness.kv, "gdgjakarta.org:t3-alpha"))?.archived, false);

    const restoredEdge = await harness.fetchEdge("/t3-alpha");
    assert.equal(restoredEdge.status, 302);
    assert.equal(restoredEdge.headers.get("location"), "https://gdgjakarta.com/alpha");
  });

  it("T3-14 [F3,F14]: flags password-protected Short.io link during migration -> re-sets password in D1/KV -> Worker unlock works", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "t3-migrate-pwd-"));
    const backupPath = path.join(tmpDir, "backup.json");
    const sqlPath = path.join(tmpDir, "migrate.sql");
    const kvPath = path.join(tmpDir, "migrate-kv.json");
    const reportPath = path.join(tmpDir, "report.json");

    try {
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
          links: [
            {
              id: "lnk_sio_pwd_1",
              path: "vip-briefing",
              originalURL: "https://gdgjakarta.com/vip/briefing",
              hasPassword: true,
              clicks: 12,
            },
          ],
        },
      });

      assert.equal(cliRes.exitCode, 0);
      assert.match(cliRes.stderr, /WARNING: 1 password-protected link\(s\) require manual password re-entry/);
      assert.match(cliRes.stderr, /gdgjakarta\.org\/vip-briefing/);

      const stdoutJson = JSON.parse(cliRes.stdout.trim());
      assert.equal(stdoutJson.flaggedPasswordLinks?.length, 1);
      assert.equal(stdoutJson.flaggedPasswordLinks?.[0]?.path, "vip-briefing");

      const reportJson = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      assert.equal(reportJson.summary?.flaggedPasswordLinksCount, 1);
      assert.equal(reportJson.flaggedPasswordLinks?.[0]?.id, "lnk_sio_pwd_1");

      await applySqlAndKvToHarness(harness, sqlPath, kvPath);

      const migratedRow = await getLinkRow(harness.db, "lnk_sio_pwd_1");
      assert.equal(migratedRow?.has_password, 1);
      assert.equal(migratedRow?.password_hash, null);

      // Re-set password via server action -> updates D1 + KV hash
      const resetRes = await actions.updateShortLinkAction("lnk_sio_pwd_1", {
        password: "new-gdg-password-2026",
      });
      assert.equal(resetRes.success, true);

      const kvAfter = await getKvValue(harness.kv, "gdgjakarta.org:vip-briefing");
      assert.ok(kvAfter?.passwordHash?.startsWith("pbkdf2$"));

      // Worker serves prompt, rejects wrong password, unlocks & redirects with new password
      const promptRes = await harness.fetchEdge("/vip-briefing");
      assert.equal(promptRes.status, 200);
      assert.match(await promptRes.text(), /Password Required/i);

      const unlockRes = await harness.fetchEdge("/vip-briefing", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ password: "new-gdg-password-2026" }).toString(),
      });
      assert.equal(unlockRes.status, 303);
      const cookieVal = parseSetCookieMap(unlockRes).sl_unlock_lnk_sio_pwd_1;
      assert.ok(cookieVal);

      const finalRes = await harness.fetchEdge("/vip-briefing", {
        cookies: { sl_unlock_lnk_sio_pwd_1: cookieVal },
      });
      assert.equal(finalRes.status, 302);
      assert.equal(finalRes.headers.get("location"), "https://gdgjakarta.com/vip/briefing");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
