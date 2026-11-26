/**
 * Auth & Sync Invariants Test Suite
 *
 * Tests real TypeScript modules from `src/` via Node's native TypeScript support
 * and `node:module.registerHooks` (stubbing only Firebase/Next.js I/O boundaries):
 *   1. `signRoleCookie` / `verifyRoleCookie` round-trip, tamper rejection, and fail-closed throw without `SESSION_SECRET`.
 *   2. `isMaskedEmailMatch` exact local-part length matching and rejection of partial/cross-domain matches.
 *   3. `isExecutiveOrganizer` & `isCoreTeamOrStaff` across `organizer`, `googler`, `core_team`, `check_in_staff`, `member`.
 *
 * Run:
 *   node --test tests/auth/auth-sync-invariants.test.mjs
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
  "firebase/firestore": `
    export function collection() { return {}; }
    export function doc() { return {}; }
    export async function getDocs() { return { docs: [] }; }
    export function writeBatch() { return { set() {}, commit: async () => {} }; }
  `,
  "@/server/bevy-actions": `
    export async function fetchAllBevyChapterMembersAction() { return { results: [] }; }
    export async function fetchBevyChapterEventsAction() { return { results: [] }; }
    export async function fetchBevyChapterTeamsAction() { return []; }
  `,
  "@/lib/firestore/client": `
    export const db = {};
    export function sanitizeFirestoreData(obj) { return obj; }
    export async function updateSyncMetadata() {}
  `,
  "@/lib/utils": `
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
      return { url: `stub:${specifier}`, shortCircuit: true };
    }

    if (specifier === "./client" && context.parentURL?.endsWith("/src/lib/firestore/sync-service.ts")) {
      return { url: "stub:@/lib/firestore/client", shortCircuit: true };
    }

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

  load(url, context, nextLoad) {
    if (url.startsWith("stub:")) {
      const key = url.slice("stub:".length);
      return { format: "module", source: stubModules[key], shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { signRoleCookie, verifyRoleCookie } = await import("@/lib/security/session-cookie");
const { isMaskedEmailMatch } = await import("@/lib/firestore/sync-service");
const { isExecutiveOrganizer, isCoreTeamOrStaff } = await import("@/lib/auth-roles");

describe("Session Cookie Signing & Verification (session-cookie.ts)", () => {
  const prevSessionSecret = process.env.SESSION_SECRET;
  const prevPaymentSecret = process.env.PAYMENT_WEBHOOK_SECRET;

  afterEach(() => {
    if (prevSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSessionSecret;
    if (prevPaymentSecret === undefined) delete process.env.PAYMENT_WEBHOOK_SECRET;
    else process.env.PAYMENT_WEBHOOK_SECRET = prevPaymentSecret;
  });

  test("round-trips signed roles accurately", async () => {
    process.env.SESSION_SECRET = "test-session-secret-for-unit-tests";
    for (const role of ["organizer", "core_team", "check_in_staff", "member"]) {
      const signed = await signRoleCookie(role);
      assert.ok(signed.startsWith(`${role}.`));
      const verified = await verifyRoleCookie(signed);
      assert.equal(verified, role);
    }
  });

  test("rejects tampered role or tampered signature", async () => {
    process.env.SESSION_SECRET = "test-session-secret-for-unit-tests";
    const signedMember = await signRoleCookie("member");
    const [, sig] = signedMember.split(".");

    // Role swap attack: member -> organizer with original signature
    assert.equal(await verifyRoleCookie(`organizer.${sig}`), null);

    // Signature bit-flip attack
    const tamperedSig = `${sig.slice(0, -1)}${sig.endsWith("0") ? "1" : "0"}`;
    assert.equal(await verifyRoleCookie(`member.${tamperedSig}`), null);

    // Malformed values
    assert.equal(await verifyRoleCookie("organizer"), null);
    assert.equal(await verifyRoleCookie(""), null);
    assert.equal(await verifyRoleCookie(null), null);
  });

  test("fails closed (throws on sign, returns null on verify) when SESSION_SECRET is unset", async () => {
    delete process.env.SESSION_SECRET;
    delete process.env.PAYMENT_WEBHOOK_SECRET;

    await assert.rejects(() => signRoleCookie("organizer"), /SESSION_SECRET is not configured/);
    assert.equal(await verifyRoleCookie("organizer.deadbeef"), null);
  });
});

describe("Masked Email Matching (sync-service.ts)", () => {
  test("matches exact local-part length, prefix, and domain", () => {
    assert.equal(isMaskedEmailMatch("d***********@gmail.com", "danangjeffry@gmail.com"), true);
    assert.equal(isMaskedEmailMatch("m********@google.com", "muhammadp@google.com"), true);
    assert.equal(isMaskedEmailMatch("D***********@GMAIL.COM", "  danangjeffry@gmail.com "), true);
    assert.equal(isMaskedEmailMatch("f****n@gmail.com", "faizun@gmail.com"), true);
  });

  test("rejects shorter/longer local-parts and wrong domains", () => {
    assert.equal(isMaskedEmailMatch("d***********@gmail.com", "dan@gmail.com"), false);
    assert.equal(isMaskedEmailMatch("d***********@gmail.com", "danangjeffry123@gmail.com"), false);
    assert.equal(isMaskedEmailMatch("d***********@gmail.com", "danangjeffry@yahoo.com"), false);
    assert.equal(isMaskedEmailMatch("m********@google.com", "muhammad@google.com"), false);
    assert.equal(isMaskedEmailMatch("f****n@gmail.com", "faizux@gmail.com"), false);
    assert.equal(isMaskedEmailMatch("plain@gmail.com", "other@gmail.com"), false);
  });
});

describe("Role Predicates (auth-roles.ts)", () => {
  test("isExecutiveOrganizer recognizes organizer and googler but excludes staff/member", () => {
    assert.equal(isExecutiveOrganizer("organizer"), true);
    assert.equal(isExecutiveOrganizer("googler"), true);
    assert.equal(isExecutiveOrganizer({ role: "organizer", chapterRole: "Organizer" }), true);
    assert.equal(isExecutiveOrganizer({ role: "organizer", chapterRole: "Googler" }), true);
    assert.equal(isExecutiveOrganizer({ roleId: 1 }), true);
    assert.equal(isExecutiveOrganizer({ roleId: 4 }), true);

    assert.equal(isExecutiveOrganizer("core_team"), false);
    assert.equal(isExecutiveOrganizer("check_in_staff"), false);
    assert.equal(isExecutiveOrganizer("member"), false);
    assert.equal(isExecutiveOrganizer(null), false);
  });

  test("isCoreTeamOrStaff recognizes core_team and check_in_staff but excludes organizer/googler/member", () => {
    assert.equal(isCoreTeamOrStaff("core_team"), true);
    assert.equal(isCoreTeamOrStaff("check_in_staff"), true);
    assert.equal(isCoreTeamOrStaff({ role: "core_team", chapterRole: "Core Team" }), true);
    assert.equal(isCoreTeamOrStaff({ role: "check_in_staff", chapterRole: "Check-in Staff" }), true);
    assert.equal(isCoreTeamOrStaff({ roleId: 2 }), true);
    assert.equal(isCoreTeamOrStaff({ roleId: 3 }), true);

    assert.equal(isCoreTeamOrStaff("organizer"), false);
    assert.equal(isCoreTeamOrStaff("googler"), false);
    assert.equal(isCoreTeamOrStaff("member"), false);
    assert.equal(isCoreTeamOrStaff(null), false);
  });
});
