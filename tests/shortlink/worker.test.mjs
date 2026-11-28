import {
  bootShortlinkHarness,
  DEFAULT_TEST_ENV,
  installShortlinkHooks,
  parseSetCookie,
  parseSetCookieMap,
} from "./e2e/harness.mjs";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

installShortlinkHooks();
const cryptoMod = await import("@/lib/shortlinks/crypto");

describe("Shortlink Redirect Worker (workers/shortlink/src)", () => {
  let harness;

  before(async () => {
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

  describe("Core Routing, Method Guards, Root Redirect & 404", () => {
    it("redirects root / to https://gdgjakarta.com (302) without logging clicks", async () => {
      const res = await harness.fetchEdge("/");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com");
      assert.equal((await harness.getClickRows()).length, 0);
    });

    it("returns branded 404 for whitespace-only pathnames (/%20, /%09) instead of root redirect", async () => {
      for (const path of ["/%20", "/%09"]) {
        const res = await harness.fetchEdge(path);
        assert.equal(res.status, 404, `Expected 404 for ${path}, got ${res.status}`);
        assert.equal(res.headers.get("location"), null);
        const html = await res.text();
        assert.ok(html.includes("https://gdgjakarta.com"));
      }
      assert.equal((await harness.getClickRows()).length, 0);
    });

    it("rejects unsupported HTTP methods with 405 and handles HEAD without body or clicks", async () => {
      await harness.seedLink({
        id: "lnk_head_1",
        path: "head-test",
        originalURL: "https://gdgjakarta.com/events/head",
        redirectType: 301,
      });

      const putRes = await harness.fetchEdge("/head-test", { method: "PUT" });
      assert.equal(putRes.status, 405);
      assert.equal(putRes.headers.get("allow"), "GET, HEAD, POST");

      const postRoot = await harness.fetchEdge("/", { method: "POST" });
      assert.equal(postRoot.status, 405);

      const postNonPassword = await harness.fetchEdge("/head-test", { method: "POST" });
      assert.equal(postNonPassword.status, 405);

      const headRes = await harness.fetchEdge("/head-test", { method: "HEAD" });
      assert.equal(headRes.status, 301);
      assert.equal(headRes.headers.get("location"), "https://gdgjakarta.com/events/head");
      assert.equal(await headRes.text(), "");
      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal((await harness.getClickRows("lnk_head_1")).length, 0);
    });

    it("returns branded 404 linking to gdgjakarta.com for missing/archived slugs and escapes XSS pathnames", async () => {
      const missingRes = await harness.fetchEdge("/<script>alert(1)</script>");
      assert.equal(missingRes.status, 404);
      assert.match(missingRes.headers.get("content-type") ?? "", /text\/html/);
      const missingHtml = await missingRes.text();
      assert.ok(missingHtml.includes("https://gdgjakarta.com"));
      assert.ok(!missingHtml.includes("<script>alert(1)</script>"));
      assert.ok(missingHtml.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));

      await harness.seedLink({
        id: "lnk_arch_1",
        path: "archived-event",
        originalURL: "https://gdgjakarta.com/events/old",
        archived: true,
      });
      await harness.putKvValue("gdgjakarta.org:archived-event", {
        id: "lnk_arch_1",
        domainId: 1516440,
        hostname: "gdgjakarta.org",
        path: "archived-event",
        originalURL: "https://gdgjakarta.com/events/old",
        redirectType: 302,
        archived: true,
        expiresAt: null,
        cloaking: false,
        linkType: "redirect",
      });

      const archRes = await harness.fetchEdge("/archived-event");
      assert.equal(archRes.status, 404);
      const archHtml = await archRes.text();
      assert.ok(archHtml.includes("https://gdgjakarta.com"));
      assert.equal((await harness.getClickRows()).length, 0);
    });

    it("falls back to D1 on KV miss or corrupt KV JSON and backfills KV asynchronously", async () => {
      await harness.seedLink({
        id: "lnk_d1_only",
        path: "d1-fallback",
        originalURL: "https://gdgjakarta.com/d1-target",
        redirectType: 307,
      });
      await harness.putKvValue("gdgjakarta.org:d1-fallback", "{corrupt-json");

      const res = await harness.fetchEdge("/d1-fallback");
      assert.equal(res.status, 307);
      assert.equal(res.headers.get("location"), "https://gdgjakarta.com/d1-target");

      await harness.waitForCondition(async () => {
        const kvVal = await harness.getKvValue("gdgjakarta.org:d1-fallback");
        return kvVal && typeof kvVal === "object" && kvVal.id === "lnk_d1_only" ? kvVal : false;
      });
    });

    it("supports 301, 302, 307, and 308 redirect status codes", async () => {
      const codes = [301, 302, 307, 308];
      for (const code of codes) {
        const slug = `redir-${code}`;
        await harness.seedLink({
          id: `lnk_${code}`,
          path: slug,
          originalURL: `https://gdgjakarta.com/${slug}`,
          redirectType: code,
        });
        const res = await harness.fetchEdge(`/${slug}`);
        assert.equal(res.status, code);
        assert.equal(res.headers.get("location"), `https://gdgjakarta.com/${slug}`);
      }
    });
  });

  describe("Time Expiration & Unsafe URL Sanitization", () => {
    it("redirects to expiredURL when expired, or renders 410 HTML if unset/unsafe, with 0 clicks logged", async () => {
      const pastMs = Date.now() - 60_000;
      await harness.seedLink({
        id: "lnk_exp_redirect",
        path: "exp-redirect",
        originalURL: "https://gdgjakarta.com/active",
        expiresAt: pastMs,
        expiredURL: "https://gdgjakarta.com/expired-landing",
        maxClicks: 5,
      });

      const expRedirRes = await harness.fetchEdge("/exp-redirect");
      assert.equal(expRedirRes.status, 302);
      assert.equal(expRedirRes.headers.get("location"), "https://gdgjakarta.com/expired-landing");

      await harness.seedLink({
        id: "lnk_exp_html",
        path: "exp-html",
        title: "DevFest <2025>",
        originalURL: "https://gdgjakarta.com/active",
        expiresAt: pastMs,
        expiredURL: "javascript:alert(1)",
      });

      const expHtmlRes = await harness.fetchEdge("/exp-html");
      assert.equal(expHtmlRes.status, 410);
      const html = await expHtmlRes.text();
      assert.ok(html.includes("DevFest &lt;2025&gt;"));
      assert.ok(html.includes("https://gdgjakarta.com"));
      assert.equal((await harness.getClickRows()).length, 0);
    });

    it("fails closed on unsafe originalURL schemes (javascript:, data:, //evil.com)", async () => {
      const unsafeUrls = ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.com/phish"];
      for (let i = 0; i < unsafeUrls.length; i += 1) {
        const slug = `unsafe-${i}`;
        await harness.seedLink({
          id: `lnk_unsafe_${i}`,
          path: slug,
          originalURL: unsafeUrls[i],
        });
        const res = await harness.fetchEdge(`/${slug}`);
        assert.equal(res.status, 404);
        assert.equal(res.headers.get("location"), null);
      }
      assert.equal((await harness.getClickRows()).length, 0);
    });
  });

  describe("Password Protection & Signed Unlock Cookies", () => {
    it("enforces password prompt on GET, 401 on bad POST, 303 PRG + cookie on valid POST, and rejects tampered/cross-link cookies", async () => {
      const passwordHash = await cryptoMod.hashLinkPassword("gdg-pass-2026");
      await harness.seedLink({
        id: "lnk_pw_1",
        path: "vip-deck",
        title: "VIP <Deck>",
        originalURL: "https://gdgjakarta.com/vip-slides",
        passwordHash,
        maxClicks: 2,
      });

      // 1. Unauthenticated GET returns prompt without consuming maxClicks or logging click
      const promptRes = await harness.fetchEdge("/vip-deck");
      assert.equal(promptRes.status, 200);
      assert.equal(promptRes.headers.get("cache-control"), "no-store");
      assert.equal(promptRes.headers.get("x-content-type-options"), "nosniff");
      assert.match(promptRes.headers.get("content-security-policy") ?? "", /form-action 'self'/);
      const promptHtml = await promptRes.text();
      assert.ok(promptHtml.includes('method="POST"'));
      assert.ok(promptHtml.includes('name="password"'));
      assert.ok(promptHtml.includes("VIP &lt;Deck&gt;"));
      assert.equal((await harness.getClickRows("lnk_pw_1")).length, 0);
      assert.equal((await harness.getLinkRow("lnk_pw_1")).clicks_count, 0);

      // 2. Wrong password (form-urlencoded & JSON) -> 401, 0 clicks
      const badFormRes = await harness.fetchEdge("/vip-deck", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "password=wrong-password",
      });
      assert.equal(badFormRes.status, 401);
      assert.match(await badFormRes.text(), /Incorrect password/);

      const badJsonRes = await harness.fetchEdge("/vip-deck", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "" }),
      });
      assert.equal(badJsonRes.status, 401);
      assert.equal((await harness.getClickRows("lnk_pw_1")).length, 0);

      // 3. Tampered & cross-link cookies are rejected
      const crossLinkCookie = await cryptoMod.createUnlockCookieValue(DEFAULT_TEST_ENV.SHORTLINK_COOKIE_SECRET, {
        linkId: "lnk_other_link",
      });
      const rejectedCross = await harness.fetchEdge("/vip-deck", {
        cookies: {
          sl_unlock_lnk_pw_1: crossLinkCookie,
        },
      });
      assert.equal(rejectedCross.status, 200);
      assert.match(await rejectedCross.text(), /Password Required/);

      const rejectedTamper = await harness.fetchEdge("/vip-deck", {
        cookies: {
          sl_unlock_lnk_pw_1: "tampered.token",
        },
      });
      assert.equal(rejectedTamper.status, 200);

      // 4. Valid password POST -> 303 PRG + HttpOnly Secure SameSite=Lax unlock cookie
      const okPostRes = await harness.fetchEdge("/vip-deck?utm_source=email", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "password=gdg-pass-2026",
      });
      assert.equal(okPostRes.status, 303);
      assert.equal(okPostRes.headers.get("location"), "/vip-deck?utm_source=email");
      assert.equal(okPostRes.headers.get("cache-control"), "no-store");

      const setCookies = parseSetCookie(okPostRes);
      assert.equal(setCookies.length, 1);
      assert.equal(setCookies[0].name, "sl_unlock_lnk_pw_1");
      assert.equal(setCookies[0].httpOnly, true);
      assert.equal(setCookies[0].secure, true);
      assert.equal(setCookies[0].sameSite, "Lax");
      assert.equal(setCookies[0].maxAge, 3600);

      // 5. Unlocked GET succeeds & logs 1 click
      const unlockedRes = await harness.fetchEdge("/vip-deck?utm_source=email", {
        cookies: {
          sl_unlock_lnk_pw_1: setCookies[0].value,
        },
      });
      assert.equal(unlockedRes.status, 302);
      assert.equal(unlockedRes.headers.get("location"), "https://gdgjakarta.com/vip-slides?utm_source=email");
      await harness.waitForClickCount("lnk_pw_1", 1);
      assert.equal((await harness.getLinkRow("lnk_pw_1")).clicks_count, 1);
    });

    it("emits single-leading-slash same-origin Location on POST //evil.com?next=1", async () => {
      const passwordHash = await cryptoMod.hashLinkPassword("pass123");
      await harness.seedLink({
        id: "lnk_dbl_slash",
        path: "evil.com",
        originalURL: "https://gdgjakarta.com/internal",
        passwordHash,
      });

      const res = await harness.fetchEdge("https://gdgjakarta.org//evil.com?next=1", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "password=pass123",
      });
      assert.equal(res.status, 303);
      const location = res.headers.get("location");
      assert.equal(location, "/evil.com?next=1");
      assert.equal(new URL(location, "https://gdgjakarta.org").href, "https://gdgjakarta.org/evil.com?next=1");
    });
  });

  describe("Cloaking, OS/Geo Targeting, UTM Merging & Retargeting Pixels", () => {
    it("renders escaped iframe wrapper when cloaking is enabled", async () => {
      await harness.seedLink({
        id: "lnk_cloak_1",
        path: "cloak",
        title: 'GDG <"Showcase">',
        originalURL: "https://gdgjakarta.com/showcase?tab=info",
        cloaking: true,
      });

      const res = await harness.fetchEdge("/cloak");
      assert.equal(res.status, 200);
      assert.ok(!(res.headers.get("content-security-policy") ?? "").includes("connect-src"));
      const html = await res.text();
      assert.ok(html.includes('<iframe src="https://gdgjakarta.com/showcase?tab=info"'));
      assert.ok(html.includes("<title>GDG &lt;&quot;Showcase&quot;&gt;</title>"));
      assert.ok(html.includes('href="https://gdgjakarta.com/showcase?tab=info"'));
      await harness.waitForClickCount("lnk_cloak_1", 1);

      await harness.seedLink({
        id: "lnk_cloak_px",
        path: "cloak-px",
        title: "Cloaked Pixel",
        originalURL: "https://gdgjakarta.com/showcase",
        cloaking: true,
        pixels: { ga4Id: "G-GDGJKT2026" },
      });
      const pxCloakRes = await harness.fetchEdge("/cloak-px");
      assert.equal(pxCloakRes.status, 200);
      assert.match(pxCloakRes.headers.get("content-security-policy") ?? "", /connect-src https:/);
    });

    it("routes by OS (iOS/Android), Country/Region Geo-Targeting, and merges UTM params without clobbering", async () => {
      await harness.seedLink({
        id: "lnk_target_1",
        path: "app",
        originalURL: "https://gdgjakarta.com/web?ref=orig&utm_source=dest#agenda",
        androidURL: "https://play.google.com/store/apps/details?id=org.gdgjakarta",
        iphoneURL: "https://apps.apple.com/app/id123456",
        geoTargets: [
          { country: "ID", region: "JK", url: "https://gdgjakarta.com/jakarta-only" },
          { country: "ID", url: "https://gdgjakarta.com/indonesia" },
        ],
        utmParams: {
          source: "shortlink",
          medium: "social",
          campaign: "devfest26",
          term: "cloud",
          content: "cta",
        },
      });

      // iPhone -> iphoneURL (and UA analytics logs iOS, not macOS)
      const iosRes = await harness.fetchEdge("/app", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
        },
        cf: { country: "ID", city: "Jakarta" },
      });
      assert.equal(iosRes.status, 302);
      const iosLoc = new URL(iosRes.headers.get("location"));
      assert.equal(`${iosLoc.origin}${iosLoc.pathname}`, "https://apps.apple.com/app/id123456");
      assert.equal(iosLoc.searchParams.get("utm_source"), "shortlink");

      // Android -> androidURL (and UA analytics logs Android, not Linux)
      const androidRes = await harness.fetchEdge("/app", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
        },
      });
      assert.equal(androidRes.status, 302);
      assert.ok(
        androidRes.headers.get("location").startsWith("https://play.google.com/store/apps/details?id=org.gdgjakarta"),
      );

      // Desktop in ID/JK -> region geoTarget
      const jkRes = await harness.fetchEdge("/app", {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36" },
        cf: { country: "ID", regionCode: "JK", city: "Jakarta" },
      });
      assert.equal(jkRes.status, 302);
      assert.ok(jkRes.headers.get("location").startsWith("https://gdgjakarta.com/jakarta-only"));

      // Desktop in ID/JB -> country geoTarget
      const idRes = await harness.fetchEdge("/app", {
        headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Firefox/121.0" },
        cf: { country: "ID", regionCode: "JB", city: "Bandung" },
      });
      assert.equal(idRes.status, 302);
      assert.ok(idRes.headers.get("location").startsWith("https://gdgjakarta.com/indonesia"));

      // Desktop in US -> originalURL preserving existing query, utm_source=dest, #agenda, and forwarding non-colliding incoming params
      const usRes = await harness.fetchEdge("/app?utm_source=incoming_override&speaker=ada", {
        headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36" },
        cf: { country: "US", city: "Mountain View" },
      });
      assert.equal(usRes.status, 302);
      const usLoc = new URL(usRes.headers.get("location"));
      assert.equal(usLoc.hash, "#agenda");
      assert.equal(usLoc.searchParams.get("ref"), "orig");
      assert.equal(usLoc.searchParams.get("utm_source"), "dest");
      assert.equal(usLoc.searchParams.get("utm_medium"), "social");
      assert.equal(usLoc.searchParams.get("utm_campaign"), "devfest26");
      assert.equal(usLoc.searchParams.get("utm_term"), "cloud");
      assert.equal(usLoc.searchParams.get("utm_content"), "cta");
      assert.equal(usLoc.searchParams.get("speaker"), "ada");

      await harness.waitForClickCount("lnk_target_1", 5);
      const clicks = await harness.getClickRows("lnk_target_1");
      assert.equal(clicks[0].os, "iOS");
      assert.equal(clicks[1].os, "Android");
      assert.equal(clicks[2].os, "Windows");
      assert.equal(clicks[3].os, "macOS");
      assert.equal(clicks[4].os, "Linux");
    });

    it("renders retargeting pixel interstitial for valid IDs and drops XSS/invalid pixel IDs", async () => {
      await harness.seedLink({
        id: "lnk_px_valid",
        path: "px-ok",
        title: "DevFest Promo",
        originalURL: "https://gdgjakarta.com/tickets?promo=early",
        pixels: {
          metaPixelId: "123456789012345",
          gtmId: "GTM-GDGJKT1",
          ga4Id: "G-GDGJKT2026",
        },
      });

      const okRes = await harness.fetchEdge("/px-ok");
      assert.equal(okRes.status, 200);
      assert.equal(okRes.headers.get("cache-control"), "no-store");
      assert.match(okRes.headers.get("content-security-policy") ?? "", /connect-src https:/);
      const html = await okRes.text();
      assert.ok(html.includes("123456789012345"));
      assert.ok(html.includes("GTM-GDGJKT1"));
      assert.ok(html.includes("G-GDGJKT2026"));
      assert.ok(html.includes("window.location.replace"));
      assert.ok(html.includes('http-equiv="refresh"'));

      // Invalid/XSS pixel IDs must be rejected; with 0 valid pixels remaining, direct redirect is returned
      await harness.seedLink({
        id: "lnk_px_xss",
        path: "px-xss",
        originalURL: "https://gdgjakarta.com/safe",
        pixels: {
          metaPixelId: "12345');alert(1);//",
          gtmId: "GTM-<script>",
          ga4Id: 'G-123"onerror=alert(1)',
        },
      });

      const xssRes = await harness.fetchEdge("/px-xss");
      assert.equal(xssRes.status, 302);
      assert.equal(xssRes.headers.get("location"), "https://gdgjakarta.com/safe");
    });
  });

  describe("Atomic Click-Limit Expiration (maxClicks)", () => {
    it("handles maxClicks === 0 without incrementing and stops strictly at maxClicks without double-counting", async () => {
      await harness.seedLink({
        id: "lnk_max_zero",
        path: "max-zero",
        originalURL: "https://gdgjakarta.com/never",
        maxClicks: 0,
      });

      const zeroRes = await harness.fetchEdge("/max-zero");
      assert.equal(zeroRes.status, 410);
      assert.equal((await harness.getLinkRow("lnk_max_zero")).clicks_count, 0);
      assert.equal((await harness.getClickRows("lnk_max_zero")).length, 0);

      await harness.seedLink({
        id: "lnk_max_2",
        path: "max-two",
        originalURL: "https://gdgjakarta.com/limited",
        expiredURL: "https://gdgjakarta.com/sold-out",
        maxClicks: 2,
      });

      // HEAD does not consume quota
      const headRes = await harness.fetchEdge("/max-two", { method: "HEAD" });
      assert.equal(headRes.status, 302);
      assert.equal((await harness.getLinkRow("lnk_max_2")).clicks_count, 0);

      const r1 = await harness.fetchEdge("/max-two");
      const r2 = await harness.fetchEdge("/max-two");
      const r3 = await harness.fetchEdge("/max-two");

      assert.equal(r1.headers.get("location"), "https://gdgjakarta.com/limited");
      assert.equal(r2.headers.get("location"), "https://gdgjakarta.com/limited");
      assert.equal(r3.headers.get("location"), "https://gdgjakarta.com/sold-out");

      await harness.waitForClickCount("lnk_max_2", 2);
      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal((await harness.getLinkRow("lnk_max_2")).clicks_count, 2);
      assert.equal((await harness.getClickRows("lnk_max_2")).length, 2);
    });

    it("enforces maxClicks atomically under concurrent requests", async () => {
      await harness.seedLink({
        id: "lnk_max_conc",
        path: "max-conc",
        originalURL: "https://gdgjakarta.com/claim",
        maxClicks: 3,
      });

      const responses = await Promise.all(Array.from({ length: 6 }, () => harness.fetchEdge("/max-conc")));
      const allowed = responses.filter((r) => r.status === 302);
      const expired = responses.filter((r) => r.status === 410);

      assert.equal(allowed.length, 3);
      assert.equal(expired.length, 3);

      await harness.waitForClickCount("lnk_max_conc", 3);
      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal((await harness.getLinkRow("lnk_max_conc")).clicks_count, 3);
      assert.equal((await harness.getClickRows("lnk_max_conc")).length, 3);
    });
  });

  describe("A/B Split Testing, Link Bundles & Mobile Deep Linking", () => {
    it("routes A/B split targets with sticky signed cookie, excludes weight <= 0, and re-selects stale cookies", async () => {
      await harness.seedLink({
        id: "lnk_split_1",
        path: "ab-test",
        originalURL: "https://gdgjakarta.com/fallback",
        linkType: "split",
        splitTargets: [
          { url: "https://gdgjakarta.com/variant-a", weight: 50, label: "variant_a" },
          { url: "https://gdgjakarta.com/variant-b", weight: 50, label: "variant_b" },
          { url: "https://gdgjakarta.com/paused", weight: 0, label: "paused" },
          { url: "javascript:alert(1)", weight: 100, label: "unsafe" },
        ],
      });

      const firstRes = await harness.fetchEdge("/ab-test");
      assert.equal(firstRes.status, 302);
      const firstLoc = firstRes.headers.get("location");
      assert.ok(
        firstLoc === "https://gdgjakarta.com/variant-a" || firstLoc === "https://gdgjakarta.com/variant-b",
        `Unexpected split destination: ${firstLoc}`,
      );

      const cookieMap = parseSetCookieMap(firstRes);
      const stickyVal = cookieMap.sl_split_lnk_split_1;
      assert.ok(stickyVal);

      // Sticky reuse does not issue a new Set-Cookie and hits the exact same variant
      for (let i = 0; i < 4; i += 1) {
        const reuseRes = await harness.fetchEdge("/ab-test", {
          cookies: { sl_split_lnk_split_1: stickyVal },
        });
        assert.equal(reuseRes.status, 302);
        assert.equal(reuseRes.headers.get("location"), firstLoc);
        assert.equal(reuseRes.headers.get("set-cookie"), null);
      }

      // Stale cookie (splitTargets edited) triggers fresh selection & new Set-Cookie
      const staleCookie = await cryptoMod.createSplitTestCookieValue(DEFAULT_TEST_ENV.SHORTLINK_COOKIE_SECRET, {
        linkId: "lnk_split_1",
        variantIndex: 0,
        variantLabel: "old_label",
        targetUrl: "https://gdgjakarta.com/old-url",
      });
      const refreshedRes = await harness.fetchEdge("/ab-test", {
        cookies: { sl_split_lnk_split_1: staleCookie },
      });
      assert.equal(refreshedRes.status, 302);
      assert.ok(parseSetCookieMap(refreshedRes).sl_split_lnk_split_1);

      await harness.waitForClickCount("lnk_split_1", 6);
      const clicks = await harness.getClickRows("lnk_split_1");
      for (const click of clicks) {
        assert.ok(click.variant_label === "variant_a" || click.variant_label === "variant_b");
        assert.ok(
          click.target_url === "https://gdgjakarta.com/variant-a" ||
            click.target_url === "https://gdgjakarta.com/variant-b",
        );
      }
    });

    it("renders GDG-branded Link Bundle HTML page with UTM merge and XSS/URL safety", async () => {
      await harness.seedLink({
        id: "lnk_bundle_1",
        path: "devfest-links",
        title: "DevFest Jakarta <2026>",
        originalURL: "https://gdgjakarta.com/devfest",
        linkType: "bundle",
        utmParams: { source: "bundle", campaign: "devfest26" },
        bundleItems: [
          {
            title: "Register <Now>",
            url: "https://gdgjakarta.com/register",
            description: "Grab your & ticket",
            icon: "🎟️",
          },
          {
            title: "Evil Link",
            url: "javascript:alert(1)",
            description: "Must be dropped",
          },
        ],
      });

      const res = await harness.fetchEdge("/devfest-links");
      assert.equal(res.status, 200);
      assert.ok(!(res.headers.get("content-security-policy") ?? "").includes("connect-src"));
      const html = await res.text();
      assert.ok(html.includes("DevFest Jakarta &lt;2026&gt;"));
      assert.ok(html.includes("Register &lt;Now&gt;"));
      assert.ok(html.includes("Grab your &amp; ticket"));
      assert.ok(html.includes("https://gdgjakarta.com/register?utm_source=bundle&amp;utm_campaign=devfest26"));
      assert.ok(!html.includes("javascript:alert(1)"));
      assert.ok(!html.includes("Evil Link"));
      await harness.waitForClickCount("lnk_bundle_1", 1);

      await harness.seedLink({
        id: "lnk_bundle_px",
        path: "devfest-links-px",
        title: "DevFest Bundle Pixel",
        originalURL: "https://gdgjakarta.com/devfest",
        linkType: "bundle",
        pixels: { gtmId: "GTM-GDGJKT1" },
        bundleItems: [{ title: "Site", url: "https://gdgjakarta.com" }],
      });
      const pxBundleRes = await harness.fetchEdge("/devfest-links-px");
      assert.equal(pxBundleRes.status, 200);
      assert.match(pxBundleRes.headers.get("content-security-policy") ?? "", /connect-src https:/);
    });

    it("serves /.well-known/apple-app-site-association and assetlinks.json from KV and D1 fallback, 404 when missing/invalid, and logs 0 clicks", async () => {
      const aasaPayload = { applinks: { apps: [], details: [{ appID: "TEAM.org.gdgjakarta.app", paths: ["/*"] }] } };
      const assetLinksPayload = [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: { namespace: "android_app", package_name: "org.gdgjakarta" },
        },
      ];

      // D1 fallback when KV is empty
      await harness.seedDomain({
        id: 1516440,
        hostname: "gdgjakarta.org",
        appleAppSiteAssociation: JSON.stringify(aasaPayload),
        assetLinks: JSON.stringify(assetLinksPayload),
      });

      const aasaRes = await harness.fetchEdge("/.well-known/apple-app-site-association");
      assert.equal(aasaRes.status, 200);
      assert.equal(aasaRes.headers.get("content-type"), "application/json; charset=utf-8");
      assert.equal(aasaRes.headers.get("cache-control"), "public, max-age=300");
      assert.equal(aasaRes.headers.get("x-content-type-options"), "nosniff");
      assert.deepEqual(await aasaRes.json(), aasaPayload);

      const assetRes = await harness.fetchEdge("/.well-known/assetlinks.json");
      assert.equal(assetRes.status, 200);
      assert.deepEqual(await assetRes.json(), assetLinksPayload);

      // Missing or invalid JSON -> 404
      await harness.putKvValue("gdgjakarta.org:__domain__", {
        id: 1516440,
        hostname: "gdgjakarta.org",
        state: "configured",
        appleAppSiteAssociation: "{invalid-json",
        assetLinks: null,
      });

      assert.equal((await harness.fetchEdge("/.well-known/apple-app-site-association")).status, 404);
      assert.equal((await harness.fetchEdge("/.well-known/assetlinks.json")).status, 404);
      assert.equal((await harness.getClickRows()).length, 0);
    });

    it("persists complete click analytics fields including bot detection via ctx.waitUntil()", async () => {
      await harness.seedLink({
        id: "lnk_analytics_1",
        path: "track-me",
        originalURL: "https://gdgjakarta.com/tracked",
      });

      await harness.fetchEdge("/track-me", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
          referer: "https://twitter.com/gdgjakarta",
        },
        cf: { country: "ID", city: "Jakarta" },
      });

      await harness.fetchEdge("/track-me", {
        headers: {
          "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
        },
        cf: { country: "US", city: "Mountain View", botManagement: { verifiedBot: true } },
      });

      await harness.waitForClickCount("lnk_analytics_1", 2);
      const clicks = await harness.getClickRows("lnk_analytics_1");
      assert.equal(clicks.length, 2);

      const human = clicks.find((c) => c.is_bot === 0);
      const bot = clicks.find((c) => c.is_bot === 1);
      assert.ok(human);
      assert.ok(bot);

      assert.match(human.id, /^clk_/);
      assert.equal(human.country, "ID");
      assert.equal(human.city, "Jakarta");
      assert.equal(human.browser, "Chrome");
      assert.equal(human.os, "macOS");
      assert.equal(human.device, "Desktop");
      assert.equal(human.referer, "https://twitter.com/gdgjakarta");
      assert.equal(human.target_url, "https://gdgjakarta.com/tracked");

      assert.equal(bot.device, "Bot");
      assert.equal((await harness.getLinkRow("lnk_analytics_1")).clicks_count, 2);
    });
  });

  describe("Fail-Closed Secret Handling (SHORTLINK_COOKIE_SECRET missing/empty)", () => {
    it("returns 500 when SHORTLINK_COOKIE_SECRET is unset or empty for password & split links while allowing public redirects", async () => {
      const noSecretHarness = await bootShortlinkHarness({
        env: { SHORTLINK_COOKIE_SECRET: undefined },
      });

      try {
        await noSecretHarness.seedDomain({ id: 1516440, hostname: "gdgjakarta.org" });
        const pwHash = await cryptoMod.hashLinkPassword("secret-123");

        await noSecretHarness.seedLink({
          id: "lnk_pub_nosecret",
          path: "public-ok",
          originalURL: "https://gdgjakarta.com/public",
        });
        await noSecretHarness.seedLink({
          id: "lnk_pw_nosecret",
          path: "pw-fail",
          originalURL: "https://gdgjakarta.com/pw",
          passwordHash: pwHash,
        });
        await noSecretHarness.seedLink({
          id: "lnk_split_nosecret",
          path: "split-fail",
          originalURL: "https://gdgjakarta.com/fallback",
          linkType: "split",
          splitTargets: [{ url: "https://gdgjakarta.com/v1", weight: 100, label: "v1" }],
        });

        const pubRes = await noSecretHarness.fetchEdge("/public-ok");
        assert.equal(pubRes.status, 302);
        assert.equal(pubRes.headers.get("location"), "https://gdgjakarta.com/public");

        const pwGetRes = await noSecretHarness.fetchEdge("/pw-fail");
        assert.equal(pwGetRes.status, 500);
        assert.equal(pwGetRes.headers.get("location"), null);

        const pwPostRes = await noSecretHarness.fetchEdge("/pw-fail", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "password=secret-123",
        });
        assert.equal(pwPostRes.status, 500);
        assert.equal(pwPostRes.headers.get("set-cookie"), null);

        const splitRes = await noSecretHarness.fetchEdge("/split-fail");
        assert.equal(splitRes.status, 500);
        assert.equal(splitRes.headers.get("location"), null);
      } finally {
        await noSecretHarness.dispose();
        harness.activate();
      }
    });
  });
});
