/**
 * Shortlink D1 Schema, Shared Types & Web-Crypto Test Suite
 *
 * Offline verification covering:
 *   1. `workers/shortlink/migrations/0001_shortlinks.sql` DDL, defaults, indexes, UNIQUE, CHECK, and FK cascades via `node:sqlite`.
 *   2. `src/lib/shortlinks/crypto.ts` PBKDF2-SHA256 (`100_000` iterations) + HMAC-SHA256 unlock & split-test cookies.
 *   3. `src/lib/shortlinks/types.ts` KV key normalization & `src/lib/shortio/types.ts` runtime load via Node TS stripping.
 *
 * Run:
 *   node --test tests/shortlink/schema-crypto.test.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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
  PBKDF2_ITERATIONS,
  createSplitTestCookieValue,
  createUnlockCookieValue,
  hashLinkPassword,
  signHmacToken,
  timingSafeEqualHex,
  verifyHmacToken,
  verifyLinkPassword,
  verifySplitTestCookieValue,
  verifyUnlockCookieValue,
} = await import("@/lib/shortlinks/crypto");

const { DOMAIN_CONFIG_KV_KEY_SUFFIX, buildDomainKvKey, buildLinkKvKey } = await import("@/lib/shortlinks/types");

const shortioTypesModule = await import("@/lib/shortio/types");

const MIGRATION_PATH = path.join(REPO_ROOT, "workers/shortlink/migrations/0001_shortlinks.sql");

function openMigratedDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  db.exec(sql);
  return db;
}

describe("D1 Migration 0001_shortlinks.sql", () => {
  test("creates all expected tables and indexes", () => {
    const db = openMigratedDb();
    try {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map((r) => r.name);
      assert.deepEqual(tables, ["short_domains", "short_folders", "short_link_clicks", "short_links"]);

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")
        .all()
        .map((r) => r.name);
      assert.deepEqual(indexes, [
        "idx_short_folders_domain_id",
        "idx_short_link_clicks_hostname_clicked_at",
        "idx_short_link_clicks_link_clicked_at",
        "idx_short_links_domain_archived_created",
        "idx_short_links_folder_id",
        "idx_short_links_hostname_path",
        "idx_short_links_original_url",
      ]);
    } finally {
      db.close();
    }
  });

  test("applies defaults and enforces UNIQUE and CHECK constraints", () => {
    const db = openMigratedDb();
    try {
      db.prepare("INSERT INTO short_domains (id, hostname) VALUES (?, ?)").run(1516440, "gdgjakarta.org");
      const domain = db.prepare("SELECT * FROM short_domains WHERE id = ?").get(1516440);
      assert.equal(domain.state, "configured");
      assert.equal(domain.link_type, "custom");
      assert.ok(domain.created_at);

      db.prepare("INSERT INTO short_folders (id, domain_id, name) VALUES (?, ?, ?)").run(
        "fld_events",
        1516440,
        "Events",
      );
      const folder = db.prepare("SELECT * FROM short_folders WHERE id = ?").get("fld_events");
      assert.equal(folder.color, "#0693E3");

      db.prepare("INSERT INTO short_links (id, domain_id, path, original_url, folder_id) VALUES (?, ?, ?, ?, ?)").run(
        "lnk_devfest26",
        1516440,
        "devfest26",
        "https://gdgjakarta.com/events/devfest-2026",
        "fld_events",
      );

      const link = db.prepare("SELECT * FROM short_links WHERE id = ?").get("lnk_devfest26");
      assert.equal(link.hostname, "gdgjakarta.org");
      assert.equal(link.tags_json, "[]");
      assert.equal(link.archived, 0);
      assert.equal(link.redirect_type, 302);
      assert.equal(link.has_password, 0);
      assert.equal(link.cloaking, 0);
      assert.equal(link.geo_targets_json, "[]");
      assert.equal(link.clicks_count, 0);
      assert.equal(link.legacy_clicks, 0);
      assert.equal(link.link_type, "redirect");
      assert.equal(link.split_targets_json, "[]");
      assert.equal(link.bundle_items_json, "[]");

      // Duplicate (hostname, path) must fail
      assert.throws(() => {
        db.prepare("INSERT INTO short_links (id, domain_id, hostname, path, original_url) VALUES (?, ?, ?, ?, ?)").run(
          "lnk_dup",
          1516440,
          "gdgjakarta.org",
          "devfest26",
          "https://gdgjakarta.com/other",
        );
      }, /UNIQUE constraint failed/);

      // Invalid redirect_type CHECK
      assert.throws(() => {
        db.prepare(
          "INSERT INTO short_links (id, domain_id, path, original_url, redirect_type) VALUES (?, ?, ?, ?, ?)",
        ).run("lnk_bad_redir", 1516440, "bad-redir", "https://gdgjakarta.com", 404);
      }, /CHECK constraint failed/);

      // Invalid link_type CHECK
      assert.throws(() => {
        db.prepare("INSERT INTO short_links (id, domain_id, path, original_url, link_type) VALUES (?, ?, ?, ?, ?)").run(
          "lnk_bad_type",
          1516440,
          "bad-type",
          "https://gdgjakarta.com",
          "qr",
        );
      }, /CHECK constraint failed/);

      // Negative max_clicks CHECK
      assert.throws(() => {
        db.prepare(
          "INSERT INTO short_links (id, domain_id, path, original_url, max_clicks) VALUES (?, ?, ?, ?, ?)",
        ).run("lnk_neg_clicks", 1516440, "neg-clicks", "https://gdgjakarta.com", -1);
      }, /CHECK constraint failed/);
    } finally {
      db.close();
    }
  });

  test("enforces foreign key ON DELETE SET NULL and ON DELETE CASCADE", () => {
    const db = openMigratedDb();
    try {
      db.prepare("INSERT INTO short_domains (id, hostname) VALUES (?, ?)").run(1516440, "gdgjakarta.org");
      db.prepare("INSERT INTO short_folders (id, domain_id, name) VALUES (?, ?, ?)").run("fld_1", 1516440, "Campaigns");
      db.prepare("INSERT INTO short_links (id, domain_id, path, original_url, folder_id) VALUES (?, ?, ?, ?, ?)").run(
        "lnk_1",
        1516440,
        "c1",
        "https://gdgjakarta.com",
        "fld_1",
      );
      db.prepare(
        "INSERT INTO short_link_clicks (id, link_id, hostname, path, clicked_at, variant_label) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("clk_1", "lnk_1", "gdgjakarta.org", "c1", 1735689600000, "Variant A");

      // Orphan domain_id fails
      assert.throws(() => {
        db.prepare("INSERT INTO short_links (id, domain_id, path, original_url) VALUES (?, ?, ?, ?)").run(
          "lnk_orphan",
          999999,
          "orphan",
          "https://gdgjakarta.com",
        );
      }, /FOREIGN KEY constraint failed/);

      // Deleting folder sets folder_id = NULL without deleting link
      db.prepare("DELETE FROM short_folders WHERE id = ?").run("fld_1");
      const linkAfterFolderDelete = db.prepare("SELECT folder_id FROM short_links WHERE id = ?").get("lnk_1");
      assert.equal(linkAfterFolderDelete.folder_id, null);

      // Deleting link cascades to clicks
      db.prepare("DELETE FROM short_links WHERE id = ?").run("lnk_1");
      const clicksRemaining = db
        .prepare("SELECT COUNT(*) AS count FROM short_link_clicks WHERE link_id = ?")
        .get("lnk_1");
      assert.equal(clicksRemaining.count, 0);
    } finally {
      db.close();
    }
  });
});

describe("Web-Crypto Helpers (src/lib/shortlinks/crypto.ts)", () => {
  const TEST_SECRET = "shortlink-cookie-secret-for-unit-tests";

  test("uses 100,000 PBKDF2 iterations and produces unique salted pbkdf2$salt$hash values", async () => {
    assert.equal(PBKDF2_ITERATIONS, 100_000);

    const h1 = await hashLinkPassword("devfest-2026!");
    const h2 = await hashLinkPassword("devfest-2026!");

    assert.match(h1, /^pbkdf2\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    assert.match(h2, /^pbkdf2\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    assert.notEqual(h1, h2);

    assert.equal(await verifyLinkPassword("devfest-2026!", h1), true);
    assert.equal(await verifyLinkPassword("devfest-2026!", h2), true);
    assert.equal(await verifyLinkPassword("wrong-password", h1), false);
    assert.equal(await verifyLinkPassword("", h1), false);
  });

  test("rejects malformed password hashes and empty passwords", async () => {
    await assert.rejects(() => hashLinkPassword(""), /non-empty/);

    assert.equal(await verifyLinkPassword("secret", ""), false);
    assert.equal(await verifyLinkPassword("secret", null), false);
    assert.equal(await verifyLinkPassword("secret", "scrypt$abcd$ef01"), false);
    assert.equal(await verifyLinkPassword("secret", "pbkdf2$nothex$nothex"), false);
    assert.equal(await verifyLinkPassword("secret", "pbkdf2$001122$001122"), false);
    assert.equal(timingSafeEqualHex("abcd", "abcd"), true);
    assert.equal(timingSafeEqualHex("abcd", "abce"), false);
    assert.equal(timingSafeEqualHex("abc", "abcd"), false);
  });

  test("signs and verifies HMAC tokens and fails closed on tampering or missing secret", async () => {
    const payload = JSON.stringify({ hello: "gdgjakarta", n: 42 });
    const token = await signHmacToken(TEST_SECRET, payload);
    assert.equal(token.split(".").length, 2);

    assert.equal(await verifyHmacToken(TEST_SECRET, token), payload);

    // Tampered signature
    const [p, s] = token.split(".");
    const flipped = `${s.slice(0, -1)}${s.endsWith("A") ? "B" : "A"}`;
    assert.equal(await verifyHmacToken(TEST_SECRET, `${p}.${flipped}`), null);

    // Tampered payload
    const fakePayload = Buffer.from(JSON.stringify({ hello: "evil" })).toString("base64url");
    assert.equal(await verifyHmacToken(TEST_SECRET, `${fakePayload}.${s}`), null);

    // Malformed & empty inputs
    assert.equal(await verifyHmacToken(TEST_SECRET, "no-dot"), null);
    assert.equal(await verifyHmacToken(TEST_SECRET, "a.b.c"), null);
    assert.equal(await verifyHmacToken(TEST_SECRET, ""), null);
    assert.equal(await verifyHmacToken(TEST_SECRET, null), null);

    // Fail-closed secret & payload checks
    await assert.rejects(() => signHmacToken("", payload), /SHORTLINK_COOKIE_SECRET/);
    await assert.rejects(() => signHmacToken("   ", payload), /SHORTLINK_COOKIE_SECRET/);
    await assert.rejects(() => signHmacToken(TEST_SECRET, ""), /HMAC payload must not be empty/);
    assert.equal(await verifyHmacToken("", token), null);
    assert.equal(await verifyHmacToken("   ", token), null);
  });

  test("unlock cookies enforce linkId, expiry, and token kind", async () => {
    const now = 1_750_000_000_000;
    const cookie = await createUnlockCookieValue(TEST_SECRET, {
      linkId: "lnk_abc",
      ttlSeconds: 60,
      nowMs: now,
    });

    assert.equal(await verifyUnlockCookieValue(TEST_SECRET, cookie, "lnk_abc", now + 59_000), true);
    assert.equal(await verifyUnlockCookieValue(TEST_SECRET, cookie, "lnk_abc", now + 60_000), false);
    assert.equal(await verifyUnlockCookieValue(TEST_SECRET, cookie, "lnk_other", now + 1_000), false);
    assert.equal(await verifyUnlockCookieValue("", cookie, "lnk_abc", now + 1_000), false);

    // Cross-kind rejection: split cookie cannot unlock a password-protected link
    const splitCookie = await createSplitTestCookieValue(TEST_SECRET, {
      linkId: "lnk_abc",
      variantIndex: 0,
      variantLabel: "A",
      nowMs: now,
    });
    assert.equal(await verifyUnlockCookieValue(TEST_SECRET, splitCookie, "lnk_abc", now + 1_000), false);
  });

  test("split-test sticky cookies bind linkId, variantIndex, variantLabel, targetUrl, and expiry", async () => {
    const now = 1_750_000_000_000;
    const cookie = await createSplitTestCookieValue(TEST_SECRET, {
      linkId: "lnk_split",
      variantIndex: 1,
      variantLabel: "Variant B",
      targetUrl: "https://gdgjakarta.com/b",
      ttlSeconds: 120,
      nowMs: now,
    });

    const verified = await verifySplitTestCookieValue(TEST_SECRET, cookie, "lnk_split", now + 60_000);
    assert.deepEqual(verified, {
      variantIndex: 1,
      variantLabel: "Variant B",
      targetUrl: "https://gdgjakarta.com/b",
      exp: now + 120_000,
    });

    assert.equal(await verifySplitTestCookieValue(TEST_SECRET, cookie, "lnk_split", now + 120_000), null);
    assert.equal(await verifySplitTestCookieValue(TEST_SECRET, cookie, "lnk_wrong", now + 1_000), null);
    assert.equal(await verifySplitTestCookieValue("", cookie, "lnk_split", now + 1_000), null);

    // Cross-kind rejection: unlock cookie cannot pose as split-test cookie
    const unlockCookie = await createUnlockCookieValue(TEST_SECRET, {
      linkId: "lnk_split",
      nowMs: now,
    });
    assert.equal(await verifySplitTestCookieValue(TEST_SECRET, unlockCookie, "lnk_split", now + 1_000), null);
  });
});

describe("KV Key Normalization & Shared Types", () => {
  test("buildLinkKvKey and buildDomainKvKey normalize hostnames and leading slashes", () => {
    assert.equal(DOMAIN_CONFIG_KV_KEY_SUFFIX, "__domain__");
    assert.equal(buildLinkKvKey("  GDGJakarta.ORG. ", "/devfest/2026"), "gdgjakarta.org:devfest/2026");
    assert.equal(buildLinkKvKey("gdgjakarta.org", "///register"), "gdgjakarta.org:register");
    assert.equal(buildDomainKvKey(" GDGJakarta.ORG. "), "gdgjakarta.org:__domain__");
  });

  test("src/lib/shortio/types.ts loads cleanly under Node TS stripping", () => {
    assert.equal(typeof shortioTypesModule, "object");
  });
});
