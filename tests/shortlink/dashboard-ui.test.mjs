/**
 * M4 Dashboard UI Pure Helpers, Pro State Mapping, Validation & Offline QR Test Suite
 *
 * Run:
 *   node --test tests/shortlink/dashboard-ui.test.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

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
});

const {
  EMPTY_ADVANCED,
  advancedFromLink,
  advancedToInput,
  applyUtm,
  buildPixelsConfig,
  buildUtmParams,
  computeSplitPercentages,
  extractProBadges,
  formatArchiveToast,
  formatClickCount,
  resolveEffectiveOriginalUrl,
  validateBundleItems,
  validateGeoTargets,
  validateMaxClicks,
  validateOptionalAdvancedUrls,
  validatePixelConfig,
  validateSplitTargets,
  validateWellKnownJson,
} = await import("@/app/(main)/dashboard/links/_components/link-form-helpers");
const { parseLinksCsv } = await import("@/app/(main)/dashboard/links/_components/parse-csv");
const { generateQrSvgDataUrl } = await import("@/lib/printers/qr-svg");

describe("M4 Dashboard UI Helpers & Offline QR", () => {
  test("1. advancedFromLink & advancedToInput round-trip all Pro fields in cloudflare mode", () => {
    const sampleLink = {
      id: "lnk_abc123",
      idString: "lnk_abc123",
      shortURL: "https://gdgjakarta.org/df26",
      secureShortURL: "https://gdgjakarta.org/df26",
      originalURL: "https://gdgjakarta.com/events/devfest-2026",
      path: "df26",
      createdAt: "2026-11-20T00:00:00.000Z",
      cloaking: true,
      hasPassword: true,
      redirectType: "308",
      expiresAt: Date.UTC(2027, 0, 15, 10, 30),
      expiredURL: "https://gdgjakarta.com/expired",
      androidURL: "https://play.google.com/store/apps/details?id=org.gdg",
      iphoneURL: "https://apps.apple.com/app/id123",
      linkType: "split",
      maxClicks: 250,
      geoTargets: [{ country: "SG", region: "Central", url: "https://gdgjakarta.com/sg" }],
      utmParams: {
        source: "instagram",
        medium: "social",
        campaign: "devfest26",
        term: "cfp",
        content: "story",
      },
      pixels: {
        metaPixelId: "1234567890",
        gtmId: "GTM-ABC123",
        ga4Id: "G-XYZ987",
      },
      splitTargets: [
        { label: "Control", url: "https://gdgjakarta.com/a", weight: 75 },
        { label: "Variant B", url: "https://gdgjakarta.com/b", weight: 25 },
      ],
      bundleItems: [],
    };

    const hydrated = advancedFromLink(sampleLink);
    assert.equal(hydrated.cloaking, true);
    assert.equal(hydrated.redirectType, "308");
    assert.equal(hydrated.password, "");
    assert.equal(hydrated.clearPassword, false);
    assert.equal(hydrated.maxClicks, "250");
    assert.equal(hydrated.linkType, "split");
    assert.equal(hydrated.utmSource, "instagram");
    assert.equal(hydrated.utmMedium, "social");
    assert.equal(hydrated.utmCampaign, "devfest26");
    assert.equal(hydrated.utmTerm, "cfp");
    assert.equal(hydrated.utmContent, "story");
    assert.equal(hydrated.metaPixelId, "1234567890");
    assert.equal(hydrated.gtmId, "GTM-ABC123");
    assert.equal(hydrated.ga4Id, "G-XYZ987");
    assert.equal(hydrated.geoTargets.length, 1);
    assert.equal(hydrated.splitTargets.length, 2);
    assert.match(hydrated.expiresAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

    const payload = advancedToInput(hydrated, true, "cloudflare");
    assert.equal(payload.redirectType, 308);
    assert.equal(payload.maxClicks, 250);
    assert.equal(payload.linkType, "split");
    assert.equal(payload.password, undefined);
    assert.equal(payload.clearPassword, undefined);
    assert.deepEqual(payload.utmParams, sampleLink.utmParams);
    assert.deepEqual(payload.pixels, sampleLink.pixels);
    assert.deepEqual(payload.geoTargets, sampleLink.geoTargets);
    assert.deepEqual(payload.splitTargets, sampleLink.splitTargets);
    assert.equal(payload.bundleItems, null);
  });

  test("2. Edit mode clears emptied Pro fields & clearPassword sends true", () => {
    const clearedState = {
      ...EMPTY_ADVANCED,
      clearPassword: true,
      password: "should-be-ignored-when-cleared",
    };

    const editPayload = advancedToInput(clearedState, true, "cloudflare");
    assert.equal(editPayload.clearPassword, true);
    assert.equal(editPayload.password, undefined);
    assert.equal(editPayload.maxClicks, null);
    assert.equal(editPayload.utmParams, null);
    assert.equal(editPayload.pixels, null);
    assert.equal(editPayload.geoTargets, null);
    assert.equal(editPayload.splitTargets, null);
    assert.equal(editPayload.bundleItems, null);
  });

  test("3. UTM handling diverges cleanly between cloudflare and shortio providers", () => {
    const withUtm = {
      ...EMPTY_ADVANCED,
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "io26",
    };

    // Fallback parsing when utmParams is absent on legacy Short.io link
    const legacyHydrated = advancedFromLink({
      id: "lnk_legacy",
      idString: "lnk_legacy",
      shortURL: "https://gdgjakarta.org/io",
      secureShortURL: "https://gdgjakarta.org/io",
      originalURL: "https://gdgjakarta.com/events/io?utm_source=x&utm_campaign=io26",
      path: "io",
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    assert.equal(legacyHydrated.utmSource, "x");
    assert.equal(legacyHydrated.utmCampaign, "io26");

    // Cloudflare preserves clean destination URL and sends structured utmParams
    const cfUrl = resolveEffectiveOriginalUrl("https://gdgjakarta.com/events/io", withUtm, "cloudflare");
    assert.equal(cfUrl.url, "https://gdgjakarta.com/events/io");
    assert.deepEqual(buildUtmParams(withUtm), { source: "newsletter", medium: "email", campaign: "io26" });

    // Short.io mutates URL with applyUtm and omits D1-only Pro keys
    const shortioUrl = resolveEffectiveOriginalUrl("https://gdgjakarta.com/events/io", withUtm, "shortio");
    assert.equal(
      shortioUrl.url,
      "https://gdgjakarta.com/events/io?utm_source=newsletter&utm_medium=email&utm_campaign=io26",
    );
    assert.equal(
      applyUtm("https://gdgjakarta.com/p?utm_source=old", withUtm),
      "https://gdgjakarta.com/p?utm_source=newsletter&utm_medium=email&utm_campaign=io26",
    );
    const shortioPayload = advancedToInput(withUtm, false, "shortio");
    assert.equal("utmParams" in shortioPayload, false);
    assert.equal("splitTargets" in shortioPayload, false);
  });

  test("4. Split & bundle links auto-fill optional destination URL and compute percentages", () => {
    assert.deepEqual(computeSplitPercentages([{ weight: 3 }, { weight: 1 }]), [75, 25]);
    assert.deepEqual(computeSplitPercentages([{ weight: 0 }, { weight: 0 }]), [0, 0]);

    const splitState = {
      ...EMPTY_ADVANCED,
      linkType: /** @type {const} */ ("split"),
      splitTargets: [
        { label: "A", url: "https://gdgjakarta.com/a", weight: 70 },
        { label: "B", url: "https://gdgjakarta.com/b", weight: 30 },
      ],
    };
    const splitResolved = resolveEffectiveOriginalUrl("", splitState, "cloudflare");
    assert.equal(splitResolved.url, "https://gdgjakarta.com/a");

    const bundleState = {
      ...EMPTY_ADVANCED,
      linkType: /** @type {const} */ ("bundle"),
      bundleItems: [{ title: "Register", url: "https://gdgjakarta.com/register", description: "Main ticket" }],
    };
    const bundleResolved = resolveEffectiveOriginalUrl("", bundleState, "cloudflare");
    assert.equal(bundleResolved.url, "https://gdgjakarta.com/register");

    const redirectMissing = resolveEffectiveOriginalUrl("", EMPTY_ADVANCED, "cloudflare");
    assert.ok(redirectMissing.error);
  });

  test("5. Client validators catch invalid geo, pixel, maxClicks, split, bundle, and deep-link JSON", () => {
    assert.equal(validateMaxClicks("").value, null);
    assert.equal(validateMaxClicks("500").value, 500);
    assert.equal(validateMaxClicks("-1").valid, false);
    assert.equal(validateMaxClicks("12.5").valid, false);

    const goodGeo = validateGeoTargets([{ country: "id", region: "JK", url: "https://gdgjakarta.com/id" }]);
    assert.equal(goodGeo.valid, true);
    assert.deepEqual(goodGeo.normalized, [{ country: "ID", region: "JK", url: "https://gdgjakarta.com/id" }]);
    assert.equal(validateGeoTargets([{ country: "IND", url: "https://gdgjakarta.com" }]).valid, false);
    assert.equal(validateGeoTargets([{ country: "ID", url: "ftp://gdgjakarta.com" }]).valid, false);

    assert.equal(validatePixelConfig(buildPixelsConfig(EMPTY_ADVANCED)).valid, true);
    assert.equal(validatePixelConfig({ metaPixelId: "123456789", gtmId: "GTM-A1B2", ga4Id: "G-123ABC" }).valid, true);
    assert.equal(validatePixelConfig({ metaPixelId: "abc" }).valid, false);
    assert.equal(validatePixelConfig({ gtmId: "BAD-123" }).valid, false);
    assert.equal(validatePixelConfig({ ga4Id: "UA-12345" }).valid, false);

    assert.equal(validateSplitTargets([], "split").valid, false);
    assert.equal(
      validateSplitTargets([{ label: "A", url: "https://gdgjakarta.com", weight: 0 }], "split").valid,
      false,
    );
    assert.equal(validateBundleItems([], "bundle").valid, false);
    assert.equal(validateBundleItems([{ title: "", url: "https://gdgjakarta.com" }], "bundle").valid, false);

    assert.equal(
      validateOptionalAdvancedUrls({ ...EMPTY_ADVANCED, expiredURL: "not-a-url" }),
      "Redirect after expiry must be a valid http:// or https:// URL.",
    );

    assert.deepEqual(validateWellKnownJson("   ", "AASA"), { valid: true, value: null });
    assert.equal(validateWellKnownJson('{"applinks":{"details":[]}}', "AASA").valid, true);
    assert.equal(validateWellKnownJson("{bad json", "AASA").valid, false);
    assert.equal(validateWellKnownJson('"just a string"', "AASA").valid, false);
  });

  test("6. Click formatting, Pro badges, archive toast & CSV parsing", () => {
    const formatted = formatClickCount({ clicksCount: 15, legacyClicks: 120, maxClicks: 500 });
    assert.equal(formatted.total, 135);
    assert.equal(formatted.capLabel, "/ 500");
    assert.equal(formatted.legacyNote, "Includes 120 legacy Short.io clicks");

    const badges = extractProBadges({
      id: "lnk_1",
      idString: "lnk_1",
      shortURL: "https://gdgjakarta.org/p",
      secureShortURL: "https://gdgjakarta.org/p",
      originalURL: "https://gdgjakarta.com",
      path: "p",
      createdAt: "2026-11-01T00:00:00Z",
      linkType: "split",
      hasPassword: true,
      cloaking: true,
      expiresAt: 1800000000000,
      maxClicks: 100,
      geoTargets: [{ country: "ID", url: "https://gdgjakarta.com/id" }],
    });
    assert.deepEqual(
      badges.map((b) => b.label),
      ["A/B Split", "Locked", "Cloaked", "Expires", "Cap", "Geo"],
    );

    assert.match(formatArchiveToast("cloudflare", 2), /Archived filter/);
    assert.match(formatArchiveToast("shortio", 1), /Short\.io dashboard/);

    const csv = parseLinksCsv(
      'originalURL,path,title,tags\nhttps://gdgjakarta.com/a,slug-a,"Hello, GDG",devfest;2026\nbad-url',
    );
    assert.equal(csv.length, 2);
    assert.equal(csv[0].error, undefined);
    assert.equal(csv[0].row.title, "Hello, GDG");
    assert.deepEqual(csv[0].row.tags, ["devfest", "2026"]);
    assert.equal(csv[1].error, "Invalid URL");
  });

  test("7. Offline QR generation produces valid SVG data URI without network calls", () => {
    const dataUrl = generateQrSvgDataUrl("https://gdgjakarta.org/devfest26");
    assert.ok(dataUrl.startsWith("data:image/svg+xml;utf8,"));
    const decodedSvg = decodeURIComponent(dataUrl.split(",")[1]);
    assert.ok(decodedSvg.startsWith("<svg "));
    assert.ok(decodedSvg.includes('viewBox="0 0 '));
    assert.ok(decodedSvg.includes("<path d="));

    const oversized = `https://gdgjakarta.org/${"a".repeat(120)}`;
    assert.throws(() => generateQrSvgDataUrl(oversized), /Version 5 capacity/);
  });
});
