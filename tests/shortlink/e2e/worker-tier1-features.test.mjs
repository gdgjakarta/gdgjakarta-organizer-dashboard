import { bootShortlinkHarness, installShortlinkHooks, parseSetCookie, parseSetCookieMap } from "./harness.mjs";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

const TEST_COOKIE_SECRET = "e2e-test-shortlink-cookie-secret-32-bytes!";

async function assertNoClicksLogged(harness, linkId) {
  await new Promise((resolve) => setTimeout(resolve, 40));
  const clicks = await harness.getClickRows(linkId);
  assert.equal(clicks.length, 0);
}

describe("Edge Redirect Worker E2E — Tier 1: Feature Coverage (F1–F10)", () => {
  let harness;
  let cryptoMod;

  before(async () => {
    installShortlinkHooks();
    cryptoMod = await import("@/lib/shortlinks/crypto");
    harness = await bootShortlinkHarness();
  });

  beforeEach(async () => {
    await harness.resetState();
    await harness.seedDomain({ id: 1516440, hostname: "gdgjakarta.org" });
  });

  after(async () => {
    if (harness) {
      await harness.dispose();
    }
  });

  // =========================================================================
  // F1: Worker Core, Root Redirect, Branded 404, ctx.waitUntil() Clicks, Archived
  // =========================================================================
  describe("F1: Core KV+D1 Lookup, Root Redirect, Branded 404 & Click Logging", () => {
    it("F1.1: resolves a link from SHORTLINKS_KV hit and logs click asynchronously", async () => {
      await harness.seedLink({
        id: "lnk_f1_kv",
        path: "kv-hit",
        originalURL: "https://gdgjakarta.com/events/kv-hit",
        redirectType: 302,
      });
      await harness.putKvValue("gdgjakarta.org:kv-hit", {
        id: "lnk_f1_kv",
        domainId: 1516440,
        hostname: "gdgjakarta.org",
        path: "kv-hit",
        originalURL: "https://gdgjakarta.com/events/kv-hit",
        redirectType: 302,
        archived: false,
      });

      const res = await harness.fetchEdge("/kv-hit");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/events/kv-hit");

      await harness.waitForClickCount("lnk_f1_kv", 1);
      const clicks = await harness.getClickRows("lnk_f1_kv");
      assert.equal(clicks.length, 1);
      assert.equal(clicks[0].target_url, "https://gdgjakarta.com/events/kv-hit");

      const row = await harness.getLinkRow("lnk_f1_kv");
      assert.equal(row?.clicks_count, 1);
    });

    it("F1.2: falls back to D1 on KV miss and asynchronously backfills SHORTLINKS_KV", async () => {
      await harness.seedLink({
        id: "lnk_f1_d1",
        path: "d1-fallback",
        originalURL: "https://gdgjakarta.com/events/d1-fallback",
        redirectType: 302,
      });
      assert.equal(await harness.getKvValue("gdgjakarta.org:d1-fallback"), null);

      const res = await harness.fetchEdge("/d1-fallback");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/events/d1-fallback");

      const backfilled = await harness.waitForCondition(() => harness.getKvValue("gdgjakarta.org:d1-fallback"));
      assert.equal(backfilled.id, "lnk_f1_d1");
      assert.equal(backfilled.originalURL, "https://gdgjakarta.com/events/d1-fallback");
      await harness.waitForClickCount("lnk_f1_d1", 1);
    });

    it("F1.3: resolves trailing-slash slug lookup with case-insensitive hostname", async () => {
      await harness.seedLink({
        id: "lnk_f1_norm",
        path: "devfest-jakarta",
        originalURL: "https://gdgjakarta.com/devfest",
        redirectType: 302,
      });

      const res = await harness.fetchEdge("https://GDGJAKARTA.ORG/devfest-jakarta/");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/devfest");

      await harness.waitForClickCount("lnk_f1_norm", 1);
      const clicks = await harness.getClickRows("lnk_f1_norm");
      assert.equal(clicks[0].hostname, "gdgjakarta.org");
      assert.equal(clicks[0].path, "devfest-jakarta");
    });

    it("F1.4: redirects root https://gdgjakarta.org/ to https://gdgjakarta.com with 302", async () => {
      const res = await harness.fetchEdge("https://gdgjakarta.org/");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com");
      assert.equal(res.headers.get("cache-control"), "public, max-age=300");

      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal((await harness.getClickRows()).length, 0);
    });

    it("F1.5: serves branded 404 HTML linking to https://gdgjakarta.com for unknown slugs", async () => {
      const res = await harness.fetchEdge("/unknown-campaign-slug");
      assert.equal(res.status, 404);
      assert.match(res.headers.get("content-type") ?? "", /text\/html/i);
      assert.equal(res.headers.get("cache-control"), "no-store");

      const html = await res.text();
      assert.match(html, /Short link not found/);
      assert.match(html, /https:\/\/gdgjakarta\.com/);
      assert.match(html, /\/unknown-campaign-slug/);

      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal((await harness.getClickRows()).length, 0);
    });

    it("F1.6: logs UA, geo, and referer metadata in short_link_clicks via ctx.waitUntil()", async () => {
      await harness.seedLink({
        id: "lnk_f1_meta",
        path: "meta-track",
        originalURL: "https://gdgjakarta.com/meta",
        redirectType: 302,
      });

      const res = await harness.fetchEdge("/meta-track", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          referer: "https://gdgjakarta.com/events",
        },
        cf: { country: "ID", city: "Jakarta" },
      });
      assert.equal(res.status, 302);

      await harness.waitForClickCount("lnk_f1_meta", 1);
      const [click] = await harness.getClickRows("lnk_f1_meta");
      assert.equal(click.country, "ID");
      assert.equal(click.city, "Jakarta");
      assert.equal(click.browser, "Chrome");
      assert.equal(click.os, "macOS");
      assert.equal(click.device, "Desktop");
      assert.equal(click.referer, "https://gdgjakarta.com/events");
      assert.equal(click.is_bot, 0);
    });

    it("F1.7: returns branded 404 and logs 0 clicks for archived links", async () => {
      await harness.seedLink({
        id: "lnk_f1_arch",
        path: "archived-link",
        originalURL: "https://gdgjakarta.com/old",
        archived: true,
      });

      const res = await harness.fetchEdge("/archived-link");
      assert.equal(res.status, 404);
      const html = await res.text();
      assert.match(html, /Short link not found/);
      assert.match(html, /https:\/\/gdgjakarta\.com/);

      await assertNoClicksLogged(harness, "lnk_f1_arch");
    });
  });

  // =========================================================================
  // F2: Redirect Status Codes (301/302/307/308) & Time-Based Expiration
  // =========================================================================
  describe("F2: Redirect Status Codes & Time-Based Expiration", () => {
    it("F2.1: serves 301 Moved Permanently with Location and Cache-Control", async () => {
      await harness.seedLink({
        id: "lnk_f2_301",
        path: "redir-301",
        originalURL: "https://gdgjakarta.com/301",
        redirectType: 301,
      });

      const res = await harness.fetchEdge("/redir-301");
      assert.equal(res.status, 301);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/301");
      assert.equal(res.headers.get("cache-control"), "public, max-age=60");
      await harness.waitForClickCount("lnk_f2_301", 1);
    });

    it("F2.2: serves 302 Found with Location and Cache-Control", async () => {
      await harness.seedLink({
        id: "lnk_f2_302",
        path: "redir-302",
        originalURL: "https://gdgjakarta.com/302",
        redirectType: 302,
      });

      const res = await harness.fetchEdge("/redir-302");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/302");
      assert.equal(res.headers.get("cache-control"), "public, max-age=60");
      await harness.waitForClickCount("lnk_f2_302", 1);
    });

    it("F2.3: serves 307 Temporary Redirect with Location and Cache-Control", async () => {
      await harness.seedLink({
        id: "lnk_f2_307",
        path: "redir-307",
        originalURL: "https://gdgjakarta.com/307",
        redirectType: 307,
      });

      const res = await harness.fetchEdge("/redir-307");
      assert.equal(res.status, 307);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/307");
      assert.equal(res.headers.get("cache-control"), "public, max-age=60");
      await harness.waitForClickCount("lnk_f2_307", 1);
    });

    it("F2.4: serves 308 Permanent Redirect with Location and Cache-Control", async () => {
      await harness.seedLink({
        id: "lnk_f2_308",
        path: "redir-308",
        originalURL: "https://gdgjakarta.com/308",
        redirectType: 308,
      });

      const res = await harness.fetchEdge("/redir-308");
      assert.equal(res.status, 308);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/308");
      assert.equal(res.headers.get("cache-control"), "public, max-age=60");
      await harness.waitForClickCount("lnk_f2_308", 1);
    });

    it("F2.5: redirects normally when expiresAt is in the future", async () => {
      await harness.seedLink({
        id: "lnk_f2_future",
        path: "future-expiry",
        originalURL: "https://gdgjakarta.com/active",
        expiresAt: Date.now() + 300_000,
        expiredURL: "https://gdgjakarta.com/closed",
      });

      const res = await harness.fetchEdge("/future-expiry");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/active");
      await harness.waitForClickCount("lnk_f2_future", 1);
    });

    it("F2.6: redirects via 302 to expiredURL with 0 clicks when past expiresAt", async () => {
      await harness.seedLink({
        id: "lnk_f2_exp_url",
        path: "past-with-url",
        originalURL: "https://gdgjakarta.com/active",
        expiresAt: Date.now() - 60_000,
        expiredURL: "https://gdgjakarta.com/closed",
      });

      const res = await harness.fetchEdge("/past-with-url");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/closed");
      assert.equal(res.headers.get("cache-control"), "no-store");
      await assertNoClicksLogged(harness, "lnk_f2_exp_url");
    });

    it("F2.7: serves 410 branded expired HTML with 0 clicks when past expiresAt without expiredURL", async () => {
      await harness.seedLink({
        id: "lnk_f2_exp_html",
        path: "past-no-url",
        title: "Early Bird",
        originalURL: "https://gdgjakarta.com/active",
        expiresAt: Date.now() - 60_000,
      });

      const res = await harness.fetchEdge("/past-no-url");
      assert.equal(res.status, 410);
      assert.equal(res.headers.get("cache-control"), "no-store");
      const html = await res.text();
      assert.match(html, /Early Bird has expired/);
      assert.match(html, /https:\/\/gdgjakarta\.com/);
      await assertNoClicksLogged(harness, "lnk_f2_exp_html");
    });
  });

  // =========================================================================
  // F3: Password-Protected Links
  // =========================================================================
  describe("F3: Password-Protected Links", () => {
    it("F3.1: GET without unlock cookie renders 200 HTML password prompt form", async () => {
      const passwordHash = await cryptoMod.hashLinkPassword("gdg-vip-2026");
      await harness.seedLink({
        id: "lnk_f3_prompt",
        path: "vip-prompt",
        title: "VIP Slides",
        originalURL: "https://gdgjakarta.com/vip-slides",
        passwordHash,
      });

      const res = await harness.fetchEdge("/vip-prompt");
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /text\/html/i);
      assert.equal(res.headers.get("cache-control"), "no-store");

      const html = await res.text();
      assert.match(html, /<form method="POST">/i);
      assert.match(html, /name="password"/i);
      assert.match(html, /VIP Slides/);
      await assertNoClicksLogged(harness, "lnk_f3_prompt");
    });

    it("F3.2: POST form-urlencoded valid password returns 303 and HttpOnly SameSite=Lax Secure cookie", async () => {
      const passwordHash = await cryptoMod.hashLinkPassword("secret-pass");
      await harness.seedLink({
        id: "lnk_f3_form",
        path: "vip-form",
        originalURL: "https://gdgjakarta.com/vip",
        passwordHash,
      });

      const res = await harness.fetchEdge("/vip-form?ref=email", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ password: "secret-pass" }).toString(),
      });

      assert.equal(res.status, 303);
      assert.equal(res.headers.get("location"), "/vip-form?ref=email");
      assert.equal(res.headers.get("cache-control"), "no-store");

      const cookies = parseSetCookie(res);
      const unlockCookie = cookies.find((c) => c.name === "sl_unlock_lnk_f3_form");
      assert.ok(unlockCookie);
      assert.equal(unlockCookie.httpOnly, true);
      assert.equal(unlockCookie.sameSite, "Lax");
      assert.equal(unlockCookie.secure, true);
      assert.equal(unlockCookie.maxAge, 3600);
      assert.equal(
        await cryptoMod.verifyUnlockCookieValue(TEST_COOKIE_SECRET, unlockCookie.value, "lnk_f3_form"),
        true,
      );
      await assertNoClicksLogged(harness, "lnk_f3_form");
    });

    it("F3.3: POST application/json valid password returns 303 and unlock cookie", async () => {
      const passwordHash = await cryptoMod.hashLinkPassword("json-secret");
      await harness.seedLink({
        id: "lnk_f3_json",
        path: "vip-json",
        originalURL: "https://gdgjakarta.com/vip-json",
        passwordHash,
      });

      const res = await harness.fetchEdge("/vip-json", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "json-secret" }),
      });

      assert.equal(res.status, 303);
      const cookieMap = parseSetCookieMap(res);
      assert.ok(cookieMap.sl_unlock_lnk_f3_json);
      assert.equal(
        await cryptoMod.verifyUnlockCookieValue(TEST_COOKIE_SECRET, cookieMap.sl_unlock_lnk_f3_json, "lnk_f3_json"),
        true,
      );
    });

    it("F3.4: GET with valid unlock cookie redirects to target and logs 1 click", async () => {
      const passwordHash = await cryptoMod.hashLinkPassword("cookie-pass");
      await harness.seedLink({
        id: "lnk_f3_cookie",
        path: "vip-cookie",
        originalURL: "https://gdgjakarta.com/vip-unlocked",
        passwordHash,
      });

      const token = await cryptoMod.createUnlockCookieValue(TEST_COOKIE_SECRET, {
        linkId: "lnk_f3_cookie",
      });
      const res = await harness.fetchEdge("/vip-cookie", {
        cookies: { sl_unlock_lnk_f3_cookie: token },
      });

      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/vip-unlocked");
      assert.equal(res.headers.get("cache-control"), "private, no-store");
      await harness.waitForClickCount("lnk_f3_cookie", 1);
    });

    it("F3.5: full GET prompt -> POST unlock -> GET redirect flow logs exactly 1 click (none on POST)", async () => {
      const passwordHash = await cryptoMod.hashLinkPassword("flow-pass");
      await harness.seedLink({
        id: "lnk_f3_flow",
        path: "vip-flow",
        originalURL: "https://gdgjakarta.com/vip-flow",
        passwordHash,
      });

      const promptRes = await harness.fetchEdge("/vip-flow");
      assert.equal(promptRes.status, 200);

      const postRes = await harness.fetchEdge("/vip-flow", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "password=flow-pass",
      });
      assert.equal(postRes.status, 303);
      const cookies = parseSetCookieMap(postRes);
      await assertNoClicksLogged(harness, "lnk_f3_flow");

      const followRes = await harness.fetchEdge("/vip-flow", {
        cookies: { sl_unlock_lnk_f3_flow: cookies.sl_unlock_lnk_f3_flow },
      });
      assert.equal(followRes.status, 302);
      assert.equal(followRes.headers.get("location"), "https://gdgjakarta.com/vip-flow");
      await harness.waitForClickCount("lnk_f3_flow", 1);
      assert.equal((await harness.getClickRows("lnk_f3_flow")).length, 1);
    });

    it("F3.6: POST multipart/form-data valid password returns 303 and unlock cookie", async () => {
      const passwordHash = await cryptoMod.hashLinkPassword("multi-pass");
      await harness.seedLink({
        id: "lnk_f3_multi",
        path: "vip-multi",
        originalURL: "https://gdgjakarta.com/vip-multi",
        passwordHash,
      });

      const form = new FormData();
      form.set("password", "multi-pass");
      const res = await harness.fetchEdge("/vip-multi", {
        method: "POST",
        body: form,
      });

      assert.equal(res.status, 303);
      const cookieMap = parseSetCookieMap(res);
      assert.ok(cookieMap.sl_unlock_lnk_f3_multi);
    });
  });

  // =========================================================================
  // F4: Link Cloaking (<iframe>)
  // =========================================================================
  describe("F4: Link Cloaking (<iframe>)", () => {
    it("F4.1: renders 200 HTML page with <iframe> pointing to target URL", async () => {
      await harness.seedLink({
        id: "lnk_f4_iframe",
        path: "cloak-basic",
        originalURL: "https://gdgjakarta.com/schedule",
        cloaking: true,
      });

      const res = await harness.fetchEdge("/cloak-basic");
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /text\/html/i);
      const html = await res.text();
      assert.match(html, /<iframe\s+src="https:\/\/gdgjakarta\.com\/schedule"/i);
    });

    it("F4.2: sets custom title on both <title> and <iframe title=...>", async () => {
      await harness.seedLink({
        id: "lnk_f4_title",
        path: "cloak-title",
        title: "DevFest Schedule",
        originalURL: "https://gdgjakarta.com/schedule",
        cloaking: true,
      });

      const res = await harness.fetchEdge("/cloak-title");
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /<title>DevFest Schedule<\/title>/);
      assert.match(html, /<iframe[^>]*title="DevFest Schedule"/i);
    });

    it("F4.3: renders fallback anchor inside <iframe> and <noscript> block", async () => {
      await harness.seedLink({
        id: "lnk_f4_fallback",
        path: "cloak-fallback",
        title: "GDG Docs",
        originalURL: "https://gdgjakarta.com/docs",
        cloaking: true,
      });

      const res = await harness.fetchEdge("/cloak-fallback");
      const html = await res.text();
      assert.match(html, /<a href="https:\/\/gdgjakarta\.com\/docs"[^>]*>Continue to GDG Docs<\/a>/);
      assert.match(html, /<noscript>.*<a href="https:\/\/gdgjakarta\.com\/docs"[^>]*>Open GDG Docs<\/a>.*<\/noscript>/);
    });

    it("F4.4: sets Cache-Control: private, no-store and CSP frame-src headers", async () => {
      await harness.seedLink({
        id: "lnk_f4_headers",
        path: "cloak-headers",
        originalURL: "https://gdgjakarta.com/headers",
        cloaking: true,
      });

      const res = await harness.fetchEdge("/cloak-headers");
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("cache-control"), "private, no-store");
      assert.match(res.headers.get("content-security-policy") ?? "", /frame-src https: http:/);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    });

    it("F4.5: logs click asynchronously via ctx.waitUntil() on cloaked GET", async () => {
      await harness.seedLink({
        id: "lnk_f4_click",
        path: "cloak-click",
        originalURL: "https://gdgjakarta.com/cloaked-target",
        cloaking: true,
      });

      const res = await harness.fetchEdge("/cloak-click");
      assert.equal(res.status, 200);
      await harness.waitForClickCount("lnk_f4_click", 1);
      const [click] = await harness.getClickRows("lnk_f4_click");
      assert.equal(click.target_url, "https://gdgjakarta.com/cloaked-target");
    });
  });

  // =========================================================================
  // F5: OS Targeting, Country Geo-Targeting & UTM Parameter Merge
  // =========================================================================
  describe("F5: OS Targeting, Country Geo-Targeting & UTM Merge", () => {
    it("F5.1: routes Android User-Agent to androidURL", async () => {
      await harness.seedLink({
        id: "lnk_f5_android",
        path: "app-download",
        originalURL: "https://gdgjakarta.com/app",
        androidURL: "https://play.google.com/store/apps/details?id=org.gdgjakarta",
        iphoneURL: "https://apps.apple.com/app/id123456",
      });

      const res = await harness.fetchEdge("/app-download", {
        headers: {
          "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36",
        },
      });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://play.google.com/store/apps/details?id=org.gdgjakarta");
      await harness.waitForClickCount("lnk_f5_android", 1);
      const [click] = await harness.getClickRows("lnk_f5_android");
      assert.equal(click.os, "Android");
    });

    it("F5.2: routes iPhone and iPad User-Agents to iphoneURL", async () => {
      await harness.seedLink({
        id: "lnk_f5_ios",
        path: "ios-download",
        originalURL: "https://gdgjakarta.com/app",
        androidURL: "https://play.google.com/store/apps/details?id=org.gdgjakarta",
        iphoneURL: "https://apps.apple.com/app/id123456",
      });

      const iphoneRes = await harness.fetchEdge("/ios-download", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
        },
      });
      assert.equal(iphoneRes.status, 302);
      assert.equal(iphoneRes.headers.get("location"), "https://apps.apple.com/app/id123456");

      const ipadRes = await harness.fetchEdge("/ios-download", {
        headers: {
          "user-agent": "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
        },
      });
      assert.equal(ipadRes.status, 302);
      assert.equal(ipadRes.headers.get("location"), "https://apps.apple.com/app/id123456");
      await harness.waitForClickCount("lnk_f5_ios", 2);
    });

    it("F5.3: falls back to originalURL for desktop User-Agent", async () => {
      await harness.seedLink({
        id: "lnk_f5_desktop",
        path: "desktop-fallback",
        originalURL: "https://gdgjakarta.com/web-app",
        androidURL: "https://play.google.com/store/apps/details?id=org.gdgjakarta",
        iphoneURL: "https://apps.apple.com/app/id123456",
      });

      const res = await harness.fetchEdge("/desktop-fallback", {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/127.0",
        },
      });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/web-app");
    });

    it("F5.4: routes matching request.cf.country (ID / SG) to country geoTarget URL", async () => {
      await harness.seedLink({
        id: "lnk_f5_geo",
        path: "geo-event",
        originalURL: "https://gdgjakarta.com/global",
        geoTargets: [
          { country: "ID", url: "https://gdgjakarta.com/id" },
          { country: "SG", url: "https://gdgjakarta.com/sg" },
        ],
      });

      const idRes = await harness.fetchEdge("/geo-event", { cf: { country: "ID" } });
      assert.equal(idRes.status, 302);
      assert.equal(idRes.headers.get("location"), "https://gdgjakarta.com/id");

      const sgRes = await harness.fetchEdge("/geo-event", { cf: { country: "SG" } });
      assert.equal(sgRes.status, 302);
      assert.equal(sgRes.headers.get("location"), "https://gdgjakarta.com/sg");
    });

    it("F5.5: routes matching request.cf.country + regionCode to region-specific geoTarget URL", async () => {
      await harness.seedLink({
        id: "lnk_f5_region",
        path: "geo-region",
        originalURL: "https://gdgjakarta.com/global",
        geoTargets: [
          { country: "ID", url: "https://gdgjakarta.com/id-default" },
          { country: "ID", region: "JK", url: "https://gdgjakarta.com/jakarta" },
        ],
      });

      const res = await harness.fetchEdge("/geo-region", {
        cf: { country: "ID", regionCode: "JK" },
      });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/jakarta");
    });

    it("F5.6: merges all 5 utmParams into target URL while preserving hash fragment", async () => {
      await harness.seedLink({
        id: "lnk_f5_utm",
        path: "utm-campaign",
        originalURL: "https://gdgjakarta.com/devfest?track=cloud#schedule",
        utmParams: {
          source: "instagram",
          medium: "social",
          campaign: "devfest26",
          term: "flutter",
          content: "story",
        },
      });

      const res = await harness.fetchEdge("/utm-campaign");
      assert.equal(res.status, 302);
      const location = new URL(res.headers.get("location"));
      assert.equal(location.origin + location.pathname, "https://gdgjakarta.com/devfest");
      assert.equal(location.searchParams.get("track"), "cloud");
      assert.equal(location.searchParams.get("utm_source"), "instagram");
      assert.equal(location.searchParams.get("utm_medium"), "social");
      assert.equal(location.searchParams.get("utm_campaign"), "devfest26");
      assert.equal(location.searchParams.get("utm_term"), "flutter");
      assert.equal(location.searchParams.get("utm_content"), "story");
      assert.equal(location.hash, "#schedule");
    });
  });

  // =========================================================================
  // F6: Retargeting Pixels Interstitial
  // =========================================================================
  describe("F6: Retargeting Pixels Interstitial", () => {
    it("F6.1: fires Meta Pixel (fbevents.js + fbq init) in 200 no-store interstitial and logs click", async () => {
      await harness.seedLink({
        id: "lnk_f6_meta",
        path: "pixel-meta",
        originalURL: "https://gdgjakarta.com/register",
        pixels: { metaPixelId: "1234567890" },
      });

      const res = await harness.fetchEdge("/pixel-meta");
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("cache-control"), "no-store");
      const html = await res.text();
      assert.match(html, /https:\/\/connect\.facebook\.net\/en_US\/fbevents\.js/);
      assert.match(html, /fbq\('init', "1234567890"\)/);
      assert.match(html, /<meta http-equiv="refresh" content="1;url=https:\/\/gdgjakarta\.com\/register"/);
      assert.match(html, /window\.location\.replace\("https:\/\/gdgjakarta\.com\/register"\)/);
      await harness.waitForClickCount("lnk_f6_meta", 1);
    });

    it("F6.2: fires Google Tag Manager (gtm.js?id=...) in 200 interstitial", async () => {
      await harness.seedLink({
        id: "lnk_f6_gtm",
        path: "pixel-gtm",
        originalURL: "https://gdgjakarta.com/gtm-target",
        pixels: { gtmId: "GTM-GDG2026" },
      });

      const res = await harness.fetchEdge("/pixel-gtm");
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=/);
      assert.match(html, /"GTM-GDG2026"/);
      assert.match(html, /https:\/\/gdgjakarta\.com\/gtm-target/);
    });

    it("F6.3: fires Google Analytics 4 (gtag/js?id=... + gtag config) in 200 interstitial", async () => {
      await harness.seedLink({
        id: "lnk_f6_ga4",
        path: "pixel-ga4",
        originalURL: "https://gdgjakarta.com/ga4-target",
        pixels: { ga4Id: "G-GDGJKT2026" },
      });

      const res = await harness.fetchEdge("/pixel-ga4");
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-GDGJKT2026/);
      assert.match(html, /gtag\('config', "G-GDGJKT2026"\)/);
    });

    it("F6.4: fires all three pixels (Meta Pixel, GTM, and GA4) together in interstitial", async () => {
      await harness.seedLink({
        id: "lnk_f6_all",
        path: "pixel-all",
        originalURL: "https://gdgjakarta.com/all-pixels",
        pixels: {
          metaPixelId: "9988776655",
          gtmId: "GTM-ALL1234",
          ga4Id: "G-ALL123456",
        },
      });

      const res = await harness.fetchEdge("/pixel-all");
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /fbq\('init', "9988776655"\)/);
      assert.match(html, /"GTM-ALL1234"/);
      assert.match(html, /gtag\('config', "G-ALL123456"\)/);
      await harness.waitForClickCount("lnk_f6_all", 1);
    });

    it("F6.5: combines pixels with cloaking (<iframe> page containing pixel scripts)", async () => {
      await harness.seedLink({
        id: "lnk_f6_cloak",
        path: "pixel-cloak",
        title: "Cloaked Pixel Page",
        originalURL: "https://gdgjakarta.com/embed",
        cloaking: true,
        pixels: { metaPixelId: "5555512345", ga4Id: "G-CLOAK1234" },
      });

      const res = await harness.fetchEdge("/pixel-cloak");
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-security-policy") ?? "", /frame-src https: http:/);
      assert.match(res.headers.get("content-security-policy") ?? "", /https:\/\/www\.googletagmanager\.com/);

      const html = await res.text();
      assert.match(html, /<iframe src="https:\/\/gdgjakarta\.com\/embed"/i);
      assert.match(html, /fbq\('init', "5555512345"\)/);
      assert.match(html, /gtag\('config', "G-CLOAK1234"\)/);
      await harness.waitForClickCount("lnk_f6_cloak", 1);
    });
  });

  // =========================================================================
  // F7: Click-Limit Expiration (maxClicks)
  // =========================================================================
  describe("F7: Click-Limit Expiration (maxClicks)", () => {
    it("F7.1: allows request under maxClicks, increments clicks_count once without double-counting", async () => {
      await harness.seedLink({
        id: "lnk_f7_single",
        path: "limit-single",
        originalURL: "https://gdgjakarta.com/ticket",
        maxClicks: 5,
      });

      const res = await harness.fetchEdge("/limit-single");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/ticket");
      assert.equal(res.headers.get("cache-control"), "private, no-store");

      await harness.waitForClickCount("lnk_f7_single", 1);
      // Wait briefly to confirm no second increment occurs
      await new Promise((resolve) => setTimeout(resolve, 40));
      const row = await harness.getLinkRow("lnk_f7_single");
      assert.equal(row?.clicks_count, 1);
      assert.equal((await harness.getClickRows("lnk_f7_single")).length, 1);
    });

    it("F7.2: allows sequential hits up to maxClicks and blocks the next hit", async () => {
      await harness.seedLink({
        id: "lnk_f7_seq",
        path: "limit-seq",
        originalURL: "https://gdgjakarta.com/early-bird",
        maxClicks: 2,
      });

      const r1 = await harness.fetchEdge("/limit-seq");
      assert.equal(r1.status, 302);
      const r2 = await harness.fetchEdge("/limit-seq");
      assert.equal(r2.status, 302);
      const r3 = await harness.fetchEdge("/limit-seq");
      assert.equal(r3.status, 410);

      await harness.waitForClickCount("lnk_f7_seq", 2);
      const row = await harness.getLinkRow("lnk_f7_seq");
      assert.equal(row?.clicks_count, 2);
      assert.equal((await harness.getClickRows("lnk_f7_seq")).length, 2);
    });

    it("F7.3: redirects exhausted link via 302 to expiredURL with 0 additional clicks", async () => {
      await harness.seedLink({
        id: "lnk_f7_exp_url",
        path: "limit-exp-url",
        originalURL: "https://gdgjakarta.com/early-bird",
        expiredURL: "https://gdgjakarta.com/sold-out",
        maxClicks: 2,
        clicksCount: 2,
      });

      const res = await harness.fetchEdge("/limit-exp-url");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/sold-out");
      assert.equal(res.headers.get("cache-control"), "no-store");
      await assertNoClicksLogged(harness, "lnk_f7_exp_url");
    });

    it("F7.4: serves 410 branded expired page when exhausted without expiredURL", async () => {
      await harness.seedLink({
        id: "lnk_f7_exp_410",
        path: "limit-exp-410",
        title: "Workshop Seat",
        originalURL: "https://gdgjakarta.com/workshop",
        maxClicks: 1,
        clicksCount: 1,
      });

      const res = await harness.fetchEdge("/limit-exp-410");
      assert.equal(res.status, 410);
      const html = await res.text();
      assert.match(html, /Workshop Seat has expired/);
      assert.match(html, /https:\/\/gdgjakarta\.com/);
      await assertNoClicksLogged(harness, "lnk_f7_exp_410");
    });

    it("F7.5: enforces atomic D1 quota under concurrent burst (10 parallel hits with maxClicks=3)", async () => {
      await harness.seedLink({
        id: "lnk_f7_burst",
        path: "limit-burst",
        originalURL: "https://gdgjakarta.com/flash-drop",
        expiredURL: "https://gdgjakarta.com/flash-ended",
        maxClicks: 3,
      });

      const responses = await Promise.all(Array.from({ length: 10 }, () => harness.fetchEdge("/limit-burst")));
      const locations = responses.map((r) => r.headers.get("location"));
      const allowedCount = locations.filter((loc) => loc === "https://gdgjakarta.com/flash-drop").length;
      const blockedCount = locations.filter((loc) => loc === "https://gdgjakarta.com/flash-ended").length;

      assert.equal(allowedCount, 3);
      assert.equal(blockedCount, 7);

      await harness.waitForClickCount("lnk_f7_burst", 3);
      await new Promise((resolve) => setTimeout(resolve, 40));
      const row = await harness.getLinkRow("lnk_f7_burst");
      assert.equal(row?.clicks_count, 3);
      assert.equal((await harness.getClickRows("lnk_f7_burst")).length, 3);
    });
  });

  // =========================================================================
  // F8: A/B Split Testing (splitTargets)
  // =========================================================================
  describe("F8: A/B Split Testing (splitTargets)", () => {
    it("F8.1: deterministically routes single active variant (100/0 split) to that variant", async () => {
      await harness.seedLink({
        id: "lnk_f8_det",
        path: "split-det",
        originalURL: "https://gdgjakarta.com/fallback",
        linkType: "split",
        splitTargets: [
          { url: "https://gdgjakarta.com/variant-a", weight: 100, label: "Control" },
          { url: "https://gdgjakarta.com/variant-b", weight: 0, label: "Paused" },
        ],
      });

      const res = await harness.fetchEdge("/split-det");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/variant-a");
    });

    it("F8.2: sets sticky HMAC sl_split_<id> cookie on first visit", async () => {
      await harness.seedLink({
        id: "lnk_f8_cookie",
        path: "split-cookie",
        originalURL: "https://gdgjakarta.com/fallback",
        linkType: "split",
        splitTargets: [
          { url: "https://gdgjakarta.com/lp-a", weight: 50, label: "A" },
          { url: "https://gdgjakarta.com/lp-b", weight: 50, label: "B" },
        ],
      });

      const res = await harness.fetchEdge("/split-cookie");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("cache-control"), "private, no-store");

      const cookies = parseSetCookie(res);
      const splitCookie = cookies.find((c) => c.name === "sl_split_lnk_f8_cookie");
      assert.ok(splitCookie);
      assert.equal(splitCookie.httpOnly, true);
      assert.equal(splitCookie.sameSite, "Lax");
      assert.equal(splitCookie.secure, true);

      const verified = await cryptoMod.verifySplitTestCookieValue(
        TEST_COOKIE_SECRET,
        splitCookie.value,
        "lnk_f8_cookie",
      );
      assert.ok(verified);
      assert.equal(verified.targetUrl, res.headers.get("location"));
    });

    it("F8.3: routes subsequent visit with sticky cookie to the same variant without re-issuing Set-Cookie", async () => {
      await harness.seedLink({
        id: "lnk_f8_sticky",
        path: "split-sticky",
        originalURL: "https://gdgjakarta.com/fallback",
        linkType: "split",
        splitTargets: [
          { url: "https://gdgjakarta.com/v1", weight: 50, label: "V1" },
          { url: "https://gdgjakarta.com/v2", weight: 50, label: "V2" },
        ],
      });

      const firstRes = await harness.fetchEdge("/split-sticky");
      const firstLocation = firstRes.headers.get("location");
      const firstCookie = parseSetCookieMap(firstRes).sl_split_lnk_f8_sticky;
      assert.ok(firstCookie);

      for (let i = 0; i < 4; i += 1) {
        const nextRes = await harness.fetchEdge("/split-sticky", {
          cookies: { sl_split_lnk_f8_sticky: firstCookie },
        });
        assert.equal(nextRes.status, 302);
        assert.equal(nextRes.headers.get("location"), firstLocation);
        assert.equal(parseSetCookie(nextRes).length, 0);
      }
      await harness.waitForClickCount("lnk_f8_sticky", 5);
    });

    it("F8.4: records variant_label and target_url in short_link_clicks", async () => {
      await harness.seedLink({
        id: "lnk_f8_track",
        path: "split-track",
        originalURL: "https://gdgjakarta.com/fallback",
        linkType: "split",
        utmParams: { source: "split-test" },
        splitTargets: [{ url: "https://gdgjakarta.com/winner", weight: 100, label: "HeroBlue" }],
      });

      const res = await harness.fetchEdge("/split-track");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/winner?utm_source=split-test");

      await harness.waitForClickCount("lnk_f8_track", 1);
      const [click] = await harness.getClickRows("lnk_f8_track");
      assert.equal(click.variant_label, "HeroBlue");
      assert.equal(click.target_url, "https://gdgjakarta.com/winner?utm_source=split-test");
    });

    it("F8.5: weighted distribution across fresh requests routes traffic to both variants", async () => {
      await harness.seedLink({
        id: "lnk_f8_dist",
        path: "split-dist",
        originalURL: "https://gdgjakarta.com/fallback",
        linkType: "split",
        splitTargets: [
          { url: "https://gdgjakarta.com/alpha", weight: 50, label: "Alpha" },
          { url: "https://gdgjakarta.com/beta", weight: 50, label: "Beta" },
        ],
      });

      const seenLocations = new Set();
      for (let i = 0; i < 30; i += 1) {
        const res = await harness.fetchEdge("/split-dist");
        assert.equal(res.status, 302);
        seenLocations.add(res.headers.get("location"));
      }

      assert.equal(seenLocations.has("https://gdgjakarta.com/alpha"), true);
      assert.equal(seenLocations.has("https://gdgjakarta.com/beta"), true);
    });
  });

  // =========================================================================
  // F9: Link Bundles (linkType: "bundle")
  // =========================================================================
  describe("F9: Link Bundles", () => {
    it("F9.1: renders 200 GDG-branded responsive HTML page with Link Bundle badge", async () => {
      await harness.seedLink({
        id: "lnk_f9_brand",
        path: "speaker-kit",
        title: "Speaker Kit",
        originalURL: "https://gdgjakarta.com/speakers",
        linkType: "bundle",
        bundleItems: [{ title: "Handbook", url: "https://gdgjakarta.com/handbook" }],
      });

      const res = await harness.fetchEdge("/speaker-kit");
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /text\/html/i);
      assert.equal(res.headers.get("cache-control"), "private, no-store");

      const html = await res.text();
      assert.match(html, /GDG Jakarta/);
      assert.match(html, /Link Bundle/);
      assert.match(html, /<h1>Speaker Kit<\/h1>/);
      assert.match(html, /name="viewport"/);
    });

    it("F9.2: renders all valid bundleItems with title, url, description, and icon", async () => {
      await harness.seedLink({
        id: "lnk_f9_items",
        path: "community-hub",
        title: "GDG Links",
        originalURL: "https://gdgjakarta.com",
        linkType: "bundle",
        bundleItems: [
          {
            title: "Website",
            url: "https://gdgjakarta.com",
            description: "Official community site",
            icon: "🌐",
          },
          {
            title: "RSVP",
            url: "https://gdgjakarta.com/events",
            description: "Upcoming meetups",
            icon: "🎟️",
          },
        ],
      });

      const res = await harness.fetchEdge("/community-hub");
      const html = await res.text();
      assert.match(html, /href="https:\/\/gdgjakarta\.com\/"/);
      assert.match(html, /🌐 Website/);
      assert.match(html, /Official community site/);
      assert.match(html, /href="https:\/\/gdgjakarta\.com\/events"/);
      assert.match(html, /🎟️ RSVP/);
      assert.match(html, /Upcoming meetups/);
    });

    it("F9.3: applies utmParams and incoming query params to bundle item URLs", async () => {
      await harness.seedLink({
        id: "lnk_f9_utm",
        path: "bundle-utm",
        originalURL: "https://gdgjakarta.com",
        linkType: "bundle",
        utmParams: { source: "bio", medium: "linktree" },
        bundleItems: [
          { title: "Events", url: "https://gdgjakarta.com/events" },
          { title: "Docs", url: "https://gdgjakarta.com/docs?utm_source=manual#top" },
        ],
      });

      const res = await harness.fetchEdge("/bundle-utm?ref=qr");
      const html = await res.text();
      assert.match(html, /href="https:\/\/gdgjakarta\.com\/events\?utm_source=bio&amp;utm_medium=linktree&amp;ref=qr"/);
      assert.match(
        html,
        /href="https:\/\/gdgjakarta\.com\/docs\?utm_source=manual&amp;utm_medium=linktree&amp;ref=qr#top"/,
      );
    });

    it("F9.4: ignores cloaking and splitTargets when linkType is bundle", async () => {
      await harness.seedLink({
        id: "lnk_f9_precedence",
        path: "bundle-over-cloak",
        title: "Bundle Wins",
        originalURL: "https://gdgjakarta.com/hub",
        linkType: "bundle",
        cloaking: true,
        splitTargets: [{ url: "https://gdgjakarta.com/should-not-redirect", weight: 100, label: "X" }],
        bundleItems: [{ title: "Main Hub", url: "https://gdgjakarta.com/hub" }],
      });

      const res = await harness.fetchEdge("/bundle-over-cloak");
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.doesNotMatch(html, /<iframe/i);
      assert.match(html, /Bundle Wins/);
      assert.match(html, /Main Hub/);
    });

    it("F9.5: logs 1 click in short_link_clicks on bundle GET", async () => {
      await harness.seedLink({
        id: "lnk_f9_click",
        path: "bundle-click",
        originalURL: "https://gdgjakarta.com/bundle-home",
        linkType: "bundle",
        bundleItems: [{ title: "Item 1", url: "https://gdgjakarta.com/1" }],
      });

      const res = await harness.fetchEdge("/bundle-click");
      assert.equal(res.status, 200);
      await harness.waitForClickCount("lnk_f9_click", 1);
      const [click] = await harness.getClickRows("lnk_f9_click");
      assert.equal(click.variant_label, null);
      assert.equal(click.target_url, "https://gdgjakarta.com/bundle-home");
    });
  });

  // =========================================================================
  // F10: Mobile Deep Linking (/.well-known/*)
  // =========================================================================
  describe("F10: Mobile Deep Linking (/.well-known/*)", () => {
    it("F10.1: serves /.well-known/apple-app-site-association from D1 as 200 JSON", async () => {
      const aasaPayload = {
        applinks: {
          apps: [],
          details: [{ appID: "ABCDE12345.org.gdgjakarta.app", paths: ["/events/*", "/df26"] }],
        },
      };
      await harness.seedDomain({
        id: 1516440,
        hostname: "gdgjakarta.org",
        appleAppSiteAssociation: aasaPayload,
      });

      const res = await harness.fetchEdge("/.well-known/apple-app-site-association");
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
      assert.equal(res.headers.get("cache-control"), "public, max-age=300");
      assert.deepEqual(await res.json(), aasaPayload);
    });

    it("F10.2: serves /.well-known/assetlinks.json from D1 as 200 JSON", async () => {
      const assetLinksPayload = [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: "org.gdgjakarta.app",
            sha256_cert_fingerprints: ["AA:BB:CC:DD"],
          },
        },
      ];
      await harness.seedDomain({
        id: 1516440,
        hostname: "gdgjakarta.org",
        assetLinks: assetLinksPayload,
      });

      const res = await harness.fetchEdge("/.well-known/assetlinks.json");
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
      assert.deepEqual(await res.json(), assetLinksPayload);
    });

    it("F10.3: serves KV <hostname>:__domain__ hit and backfills KV on D1 fallback", async () => {
      const kvAasa = { applinks: { details: [{ appID: "KV.app", paths: ["/kv"] }] } };
      await harness.putKvValue("gdgjakarta.org:__domain__", {
        id: 1516440,
        hostname: "gdgjakarta.org",
        appleAppSiteAssociation: JSON.stringify(kvAasa),
        assetLinks: null,
      });

      const kvHitRes = await harness.fetchEdge("/.well-known/apple-app-site-association");
      assert.equal(kvHitRes.status, 200);
      assert.deepEqual(await kvHitRes.json(), kvAasa);

      // Now clear and test D1 -> KV async backfill on second domain
      const d1AssetLinks = [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "web" } }];
      await harness.seedDomain({
        id: 2000001,
        hostname: "go.gdgjakarta.org",
        assetLinks: d1AssetLinks,
      });
      assert.equal(await harness.getKvValue("go.gdgjakarta.org:__domain__"), null);

      const d1Res = await harness.fetchEdge("https://go.gdgjakarta.org/.well-known/assetlinks.json");
      assert.equal(d1Res.status, 200);
      assert.deepEqual(await d1Res.json(), d1AssetLinks);

      const backfilled = await harness.waitForCondition(() => harness.getKvValue("go.gdgjakarta.org:__domain__"));
      assert.equal(backfilled.hostname, "go.gdgjakarta.org");
    });

    it("F10.4: isolates deep link configurations across gdgjakarta.org and go.gdgjakarta.org", async () => {
      await harness.seedDomain({
        id: 1516440,
        hostname: "gdgjakarta.org",
        appleAppSiteAssociation: { applinks: { details: [{ appID: "MAIN.app", paths: ["*"] }] } },
      });
      await harness.seedDomain({
        id: 2000002,
        hostname: "go.gdgjakarta.org",
        appleAppSiteAssociation: { applinks: { details: [{ appID: "GO.app", paths: ["/go/*"] }] } },
      });

      const mainRes = await harness.fetchEdge("https://gdgjakarta.org/.well-known/apple-app-site-association");
      const goRes = await harness.fetchEdge("https://go.gdgjakarta.org/.well-known/apple-app-site-association");

      assert.equal(mainRes.status, 200);
      assert.equal(goRes.status, 200);
      assert.equal((await mainRes.json()).applinks.details[0].appID, "MAIN.app");
      assert.equal((await goRes.json()).applinks.details[0].appID, "GO.app");
    });

    it("F10.5: HEAD on /.well-known/* returns 200 with JSON headers, empty body, and 0 clicks logged", async () => {
      await harness.seedDomain({
        id: 1516440,
        hostname: "gdgjakarta.org",
        appleAppSiteAssociation: { applinks: { apps: [], details: [] } },
      });

      const res = await harness.fetchEdge("/.well-known/apple-app-site-association", {
        method: "HEAD",
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
      assert.equal(await res.text(), "");

      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal((await harness.getClickRows()).length, 0);
    });
  });
});
