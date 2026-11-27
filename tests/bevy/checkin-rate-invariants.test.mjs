/**
 * Check-in Rate Invariants Test Suite
 *
 * Tests real TypeScript exports from `src/lib/bevy/client.ts` via Node's native TypeScript
 * support and `node:module.registerHooks`:
 *   1. `isEmailMatch` exact local-part length matching and rejection of cross-length / cross-domain collisions.
 *   2. `normalizeBevyMemberId` handling numeric, string, padded, and invalid inputs.
 *   3. `computeCheckInRate` rounding and [0, 100] clamping.
 *   4. Server-side TTL cache (`getCachedCheckInRate` / `setCachedCheckInRate`) hit/miss and non-caching of transient errors.
 *
 * Run:
 *   node --test tests/bevy/checkin-rate-invariants.test.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { afterEach, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

const stubModules = {
  react: `
    export function cache(fn) { return fn; }
  `,
  "@/config/bevy-config": `
    export const BEVY_CONFIG = {
      baseUrl: "https://gdg.community.dev/api",
      chapterId: "123",
      chapterSlug: "gdg-jakarta",
    };
    export async function getBevyAuthCredentials() { return { cookie: "", csrfToken: "" }; }
    export function getBevyRefererUrl() { return "https://gdg.community.dev/"; }
  `,
  "@/lib/utils": `
    export function extractApiMessage(err) { return String(err || ""); }
    export function splitFullName(name) {
      const parts = String(name || "").trim().split(/\\s+/).filter(Boolean);
      return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
    }
  `,
};

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
    if (specifier in stubModules) {
      return { shortCircuit: true, url: `stub:${encodeURIComponent(specifier)}` };
    }
    if (specifier.startsWith("@/")) {
      const candidate = path.join(REPO_ROOT, "src", specifier.slice(2));
      const resolved = resolveTsFile(candidate);
      if (resolved) return { shortCircuit: true, url: resolved };
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const candidate = path.resolve(parentDir, specifier);
      const resolved = resolveTsFile(candidate);
      if (resolved) return { shortCircuit: true, url: resolved };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("stub:")) {
      const key = decodeURIComponent(url.slice("stub:".length));
      return { shortCircuit: true, format: "module", source: stubModules[key] };
    }
    return nextLoad(url, context);
  },
});

const {
  clearCheckInRateCache,
  computeCheckInRate,
  getCachedCheckInRate,
  isEmailMatch,
  normalizeBevyMemberId,
  setCachedCheckInRate,
} = await import("@/lib/bevy/client");

describe("isEmailMatch (hardened exact-length masked matching)", () => {
  test("matches exact and exact-length masked emails", () => {
    assert.equal(isEmailMatch("alice@gmail.com", "ALICE@GMAIL.COM"), true);
    assert.equal(isEmailMatch("a***@gmail.com", "alex@gmail.com"), true);
    assert.equal(isEmailMatch("f****n@gmail.com", "faizun@gmail.com"), true);
  });

  test("rejects different-length, wrong-character, and cross-domain collisions", () => {
    assert.equal(isEmailMatch("a***@gmail.com", "ahmad@gmail.com"), false);
    assert.equal(isEmailMatch("a***@gmail.com", "al@gmail.com"), false);
    assert.equal(isEmailMatch("f****n@gmail.com", "faizux@gmail.com"), false);
    assert.equal(isEmailMatch("a***@gmail.com", "alex@yahoo.com"), false);
    assert.equal(isEmailMatch("", "alex@gmail.com"), false);
    assert.equal(isEmailMatch(null, "alex@gmail.com"), false);
  });
});

describe("normalizeBevyMemberId", () => {
  test("accepts positive numbers and non-empty strings", () => {
    assert.equal(normalizeBevyMemberId(98765), "98765");
    assert.equal(normalizeBevyMemberId(" 98765 "), "98765");
    assert.equal(normalizeBevyMemberId("abc-123"), "abc-123");
  });

  test("rejects invalid values", () => {
    assert.equal(normalizeBevyMemberId(0), null);
    assert.equal(normalizeBevyMemberId(-5), null);
    assert.equal(normalizeBevyMemberId(Number.NaN), null);
    assert.equal(normalizeBevyMemberId("   "), null);
    assert.equal(normalizeBevyMemberId(null), null);
    assert.equal(normalizeBevyMemberId(undefined), null);
  });
});

describe("computeCheckInRate", () => {
  test("rounds normally and clamps to [0, 100]", () => {
    assert.equal(computeCheckInRate(0, 0), 0);
    assert.equal(computeCheckInRate(1, 1), 100);
    assert.equal(computeCheckInRate(2, 3), 67);
    assert.equal(computeCheckInRate(5, 3), 100);
    assert.equal(computeCheckInRate(-2, 5), 0);
  });
});

describe("checkInRateLkgCache", () => {
  afterEach(() => {
    clearCheckInRateCache();
  });

  test("caches ready and unavailable results case-insensitively per chapter", () => {
    const ready = { status: "ready", registered: 4, checkedIn: 3, rate: 75, bevyMemberId: "42" };
    setCachedCheckInRate("Alice@Example.com", ready, "123");
    assert.deepEqual(getCachedCheckInRate("  alice@example.com ", "123"), ready);
    assert.equal(getCachedCheckInRate("alice@example.com", "999"), null);

    const unavailable = { status: "unavailable" };
    setCachedCheckInRate("missing@example.com", unavailable, "123");
    assert.deepEqual(getCachedCheckInRate("missing@example.com", "123"), unavailable);
  });

  test("does not cache transient error statuses", () => {
    setCachedCheckInRate("err@example.com", { status: "rate_limited" }, "123");
    setCachedCheckInRate("auth@example.com", { status: "auth_error" }, "123");
    setCachedCheckInRate("fail@example.com", { status: "error" }, "123");
    assert.equal(getCachedCheckInRate("err@example.com", "123"), null);
    assert.equal(getCachedCheckInRate("auth@example.com", "123"), null);
    assert.equal(getCachedCheckInRate("fail@example.com", "123"), null);
  });
});
