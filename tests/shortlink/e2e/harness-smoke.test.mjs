import {
  bootShortlinkHarness,
  bootWorkerHarness,
  DEFAULT_SHORTLINKS_SCHEMA_SQL,
  DEFAULT_WORKER_ENTRY_PATH,
  formatCookieHeader,
  getClickRows,
  getKvValue,
  getLinkRow,
  harnessState,
  installShortlinkHooks,
  parseSetCookie,
  parseSetCookieMap,
  putKvValue,
  runMigrationCli,
  seedClick,
  seedDomain,
  seedFolder,
  seedLink,
  waitForClickCount,
  waitForCondition,
} from "./harness.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const INLINE_WORKER_TS = `
import { buildLinkKvKey } from "@/lib/shortlinks/types";

interface Env {
  SHORTLINKS_DB: D1Database;
  SHORTLINKS_KV: KVNamespace;
  SHORTLINK_COOKIE_SECRET?: string;
}

interface RequestWithCf extends Request {
  cf?: {
    country?: string;
    city?: string;
  };
}

export default {
  async fetch(request: RequestWithCf, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const slug = url.pathname.replace(/^\\/+/, "");

    if (slug === "") {
      return Response.redirect("https://gdgjakarta.com/", 302);
    }

    if (slug === "cookie-check") {
      const cookieHeader = request.headers.get("cookie") || "";
      const headers = new Headers({ "content-type": "application/json" });
      headers.append("Set-Cookie", "sl_unlock=unlocked-123; Path=/; HttpOnly; Secure; SameSite=Lax");
      headers.append("Set-Cookie", "sl_ab=variant_b; Path=/; Max-Age=3600");
      return new Response(JSON.stringify({ cookieHeader, country: request.cf?.country ?? null }), {
        status: 200,
        headers,
      });
    }

    const kvKey = buildLinkKvKey(url.hostname, slug);
    const rawKv = await env.SHORTLINKS_KV.get(kvKey);
    if (!rawKv) {
      return new Response("Not found", { status: 404 });
    }

    const record = JSON.parse(rawKv) as {
      id: string;
      originalURL: string;
      redirectType?: number;
      geoTargets?: Array<{ country: string; url: string }>;
    };

    const country = request.cf?.country ?? null;
    const city = request.cf?.city ?? null;
    const geoMatch = country ? record.geoTargets?.find((g) => g.country === country) : undefined;
    const targetUrl = geoMatch ? geoMatch.url : record.originalURL;

    ctx.waitUntil(
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        await env.SHORTLINKS_DB.prepare(
          \`INSERT INTO short_link_clicks (
            id, link_id, hostname, path, clicked_at, country, city, target_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`,
        )
          .bind(
            \`clk_\${crypto.randomUUID()}\`,
            record.id,
            url.hostname.toLowerCase(),
            slug,
            Date.now(),
            country,
            city,
            targetUrl,
          )
          .run();
      })(),
    );

    return new Response(null, {
      status: record.redirectType || 302,
      headers: {
        location: targetUrl,
      },
    });
  },
};
`;

describe("Shortlink E2E Harness Smoke Suite", () => {
  let workerHarness;

  beforeEach(async () => {
    if (workerHarness) {
      await workerHarness.resetState();
    }
  });

  after(async () => {
    if (workerHarness) {
      await workerHarness.dispose();
      // Verify dispose is idempotent
      await workerHarness.dispose();
    }
  });

  it("boots Miniflare 5 with inline TS Worker, D1 schema, KV, geo cf, manual redirects, cookies & waitUntil polling", async () => {
    workerHarness = await bootWorkerHarness({
      workerTsSource: INLINE_WORKER_TS,
      migrationSql: DEFAULT_SHORTLINKS_SCHEMA_SQL,
      env: { SHORTLINK_PROVIDER: "cloudflare" },
    });

    const { db, kv } = workerHarness;

    // 1. Seed D1 domain, folder, link, and initial click
    await seedDomain(db, { id: 1516440, hostname: "gdgjakarta.org" });
    await seedFolder(db, { id: "fld_devfest", domainId: 1516440, name: "DevFest" });
    await seedLink(db, {
      id: "lnk_smoke_1",
      domainId: 1516440,
      hostname: "gdgjakarta.org",
      path: "devfest-26",
      originalURL: "https://gdgjakarta.com/events/devfest-26",
      folderId: "fld_devfest",
      redirectType: 301,
      geoTargets: [{ country: "ID", url: "https://gdgjakarta.com/id/devfest-26" }],
    });

    const seededRow = await getLinkRow(db, { hostname: "gdgjakarta.org", path: "devfest-26" });
    assert.equal(seededRow?.id, "lnk_smoke_1");
    assert.equal(seededRow?.folder_id, "fld_devfest");

    // 2. Put & read KV value
    await putKvValue(kv, "gdgjakarta.org:devfest-26", {
      id: "lnk_smoke_1",
      originalURL: "https://gdgjakarta.com/events/devfest-26",
      redirectType: 301,
      geoTargets: [{ country: "ID", url: "https://gdgjakarta.com/id/devfest-26" }],
    });
    const kvVal = await getKvValue(kv, "gdgjakarta.org:devfest-26");
    assert.equal(kvVal?.id, "lnk_smoke_1");

    // 3. Root redirect with redirect: "manual"
    const rootRes = await workerHarness.fetchEdge("/");
    assert.equal(rootRes.status, 302);
    assert.equal(rootRes.headers.get("location"), "https://gdgjakarta.com/");

    // 4. Geo-targeted redirect + async ctx.waitUntil click persistence
    const geoRes = await workerHarness.fetchEdge("/devfest-26", {
      cf: { country: "ID", city: "Jakarta" },
    });
    assert.equal(geoRes.status, 301);
    assert.equal(geoRes.headers.get("location"), "https://gdgjakarta.com/id/devfest-26");

    const count = await waitForClickCount(db, "lnk_smoke_1", 1);
    assert.equal(count, 1);

    const clicks = await getClickRows(db, "lnk_smoke_1");
    assert.equal(clicks.length, 1);
    assert.equal(clicks[0].country, "ID");
    assert.equal(clicks[0].city, "Jakarta");
    assert.equal(clicks[0].target_url, "https://gdgjakarta.com/id/devfest-26");

    // 5. Cookie helpers (formatCookieHeader + parseSetCookie + parseSetCookieMap)
    const cookieRes = await workerHarness.fetchEdge("/cookie-check", {
      cookies: { prev_cookie: "abc123", theme: "dark" },
    });
    assert.equal(cookieRes.status, 200);
    const cookiePayload = await cookieRes.json();
    assert.equal(cookiePayload.cookieHeader, formatCookieHeader({ prev_cookie: "abc123", theme: "dark" }));

    const parsedCookies = parseSetCookie(cookieRes);
    assert.equal(parsedCookies.length, 2);
    assert.equal(parsedCookies[0].name, "sl_unlock");
    assert.equal(parsedCookies[0].httpOnly, true);
    assert.equal(parsedCookies[0].secure, true);
    assert.equal(parsedCookies[0].sameSite, "Lax");
    assert.deepEqual(parseSetCookieMap(cookieRes), {
      sl_unlock: "unlocked-123",
      sl_ab: "variant_b",
    });

    // 6. seedClick + waitForCondition + resetState clears D1 & KV
    await seedClick(db, { id: "clk_manual", linkId: "lnk_smoke_1", path: "devfest-26", country: "SG" });
    const twoClicks = await waitForCondition(async () => {
      const rows = await getClickRows(db, "lnk_smoke_1");
      return rows.length === 2 ? rows : false;
    });
    assert.equal(twoClicks.length, 2);

    await workerHarness.resetState();
    assert.equal(await getLinkRow(db, "lnk_smoke_1"), null);
    assert.equal((await getClickRows(db)).length, 0);
    assert.equal(await getKvValue(kv, "gdgjakarta.org:devfest-26"), null);
  });

  it("throws ERR_SHORTLINK_TARGET_MISSING when bootShortlinkHarness target does not exist", async () => {
    await assert.rejects(
      () => bootShortlinkHarness({ workerEntryPath: path.join(os.tmpdir(), "nonexistent-shortlink-worker.ts") }),
      (err) => err instanceof Error && err.code === "ERR_SHORTLINK_TARGET_MISSING",
    );

    if (!fs.existsSync(DEFAULT_WORKER_ENTRY_PATH)) {
      await assert.rejects(
        () => bootShortlinkHarness(),
        (err) => err instanceof Error && err.code === "ERR_SHORTLINK_TARGET_MISSING",
      );
    }
  });

  it("enforces zero-network globalThis.fetch tripwire and routes Short.io SDK + raw fetch to fake Short.io", async () => {
    await assert.rejects(
      () => fetch("https://example.com/should-fail"),
      /Unexpected live network fetch attempted during zero-network E2E test/,
    );

    // Seed fake Short.io state and exercise both raw fetch and @short.io/client-node
    harnessState.shortio.seed({
      folders: [{ id: "fld_1", name: "Events", color: "#0693E3", DomainId: 1516440 }],
      links: [
        {
          id: "lnk_pre_1",
          domain: "gdgjakarta.org",
          path: "pre-seeded",
          originalURL: "https://gdgjakarta.com/events/pre",
          clicks: 42,
        },
      ],
    });

    const statsRes = await fetch("https://statistics.short.io/statistics/link/lnk_pre_1?period=total");
    assert.equal(statsRes.status, 200);
    const statsJson = await statsRes.json();
    assert.equal(statsJson.totalClicks, 42);

    const domainsRes = await fetch("https://api.short.io/api/domains?limit=100");
    assert.equal(domainsRes.status, 200);
    const domainsJson = await domainsRes.json();
    assert.equal(domainsJson[0].hostname, "gdgjakarta.org");

    const shortioSdk = await import("@short.io/client-node");
    shortioSdk.setApiKey("test_shortio_api_key");

    const listed = await shortioSdk.listLinks({ query: { domain_id: 1516440, limit: 150 } });
    assert.equal(listed.data?.links?.length, 1);
    assert.equal(listed.data?.links?.[0]?.path, "pre-seeded");

    const created = await shortioSdk.createLink({
      body: {
        domain: "gdgjakarta.org",
        originalURL: "https://gdgjakarta.com/events/new",
        path: "sdk-created",
        title: "SDK Created Link",
      },
    });
    assert.equal(created.data?.path, "sdk-created");
    assert.equal(created.data?.shortURL, "https://gdgjakarta.org/sdk-created");

    const expanded = await shortioSdk.expandLink({
      query: { domain: "gdgjakarta.org", path: "sdk-created" },
    });
    assert.equal(expanded.data?.originalURL, "https://gdgjakarta.com/events/new");
  });

  it("installs idempotent registerHooks bridge sharing Miniflare D1/KV and Next/Auth/Firestore/Bevy stubs", async () => {
    const firstInstall = installShortlinkHooks();
    const secondInstall = installShortlinkHooks();
    assert.equal(typeof firstInstall, "boolean");
    assert.equal(secondInstall, false);

    // Ensure workerHarness is active
    if (!workerHarness) {
      workerHarness = await bootWorkerHarness({
        workerTsSource: INLINE_WORKER_TS,
        migrationSql: DEFAULT_SHORTLINKS_SCHEMA_SQL,
      });
    } else {
      workerHarness.activate();
    }

    // 1. @/* alias resolves real repo TypeScript modules
    const cryptoMod = await import("@/lib/shortlinks/crypto");
    const hash = await cryptoMod.hashLinkPassword("gdg-secret-2026");
    assert.equal(await cryptoMod.verifyLinkPassword("gdg-secret-2026", hash), true);
    assert.equal(await cryptoMod.verifyLinkPassword("wrong-pass", hash), false);

    // 2. @opennextjs/cloudflare shares live Miniflare D1/KV with Worker fetchEdge
    const openNext = await import("@opennextjs/cloudflare");
    const cfCtx = await openNext.getCloudflareContext({ async: true });
    assert.equal(cfCtx.env.SHORTLINKS_DB, workerHarness.db);
    assert.equal(cfCtx.env.SHORTLINKS_KV, workerHarness.kv);

    await seedDomain(cfCtx.env.SHORTLINKS_DB, { id: 1516440, hostname: "gdgjakarta.org" });
    await seedLink(cfCtx.env.SHORTLINKS_DB, {
      id: "lnk_bridge_1",
      path: "bridge-slug",
      originalURL: "https://gdgjakarta.com/bridge",
    });
    await putKvValue(cfCtx.env.SHORTLINKS_KV, "gdgjakarta.org:bridge-slug", {
      id: "lnk_bridge_1",
      originalURL: "https://gdgjakarta.com/bridge",
      redirectType: 302,
    });

    const bridgeRedirect = await workerHarness.fetchEdge("/bridge-slug");
    assert.equal(bridgeRedirect.status, 302);
    assert.equal(bridgeRedirect.headers.get("location"), "https://gdgjakarta.com/bridge");
    await waitForClickCount(workerHarness.db, "lnk_bridge_1", 1);

    // 3. auth-guard role toggling
    const authGuard = await import("@/server/auth-guard");
    harnessState.setAuthRole("executive");
    assert.equal(await authGuard.isAuthorizedOrganizerSession(), true);
    assert.equal(await authGuard.isAuthorizedExecutiveOrganizerSession(), true);

    harnessState.setAuthRole("organizer");
    assert.equal(await authGuard.isAuthorizedOrganizerSession(), true);
    assert.equal(await authGuard.isAuthorizedExecutiveOrganizerSession(), false);

    harnessState.setAuthRole("member");
    assert.equal(await authGuard.isAuthorizedOrganizerSession(), false);
    assert.equal(await authGuard.isAuthorizedExecutiveOrganizerSession(), false);

    harnessState.setAuthRole("unauthenticated");
    assert.equal(await authGuard.getAuthenticatedSessionUser(), null);

    // 4. next/headers, next/cache, next/server, firestore-admin, bevy
    const nextHeaders = await import("next/headers");
    const cookieStore = await nextHeaders.cookies();
    cookieStore.set("auth_token", "tok_123");
    assert.equal(cookieStore.get("auth_token")?.value, "tok_123");

    const nextCache = await import("next/cache");
    nextCache.revalidatePath("/dashboard/links");
    assert.deepEqual(harnessState.revalidatedPaths, ["/dashboard/links"]);

    const nextServer = await import("next/server");
    const req = new nextServer.NextRequest("https://gdgjakarta.com/api/links/shorten?path=abc", {
      headers: { cookie: "session=xyz" },
    });
    assert.equal(req.nextUrl.searchParams.get("path"), "abc");
    assert.equal(req.cookies.get("session")?.value, "xyz");
    const jsonRes = nextServer.NextResponse.json({ ok: true }, { status: 201 });
    assert.equal(jsonRes.status, 201);
    assert.deepEqual(await jsonRes.json(), { ok: true });

    const firestoreAdmin = await import("@/server/firestore-admin");
    harnessState.firestore.seedEvent("evt-100", { id: "evt-100", title: "DevFest" });
    await firestoreAdmin.updateFirestoreEventShortLinksServer("evt-100", {
      liveShortURL: "https://gdgjakarta.org/df26",
      liveShortPath: "df26",
    });
    const updatedEvent = await firestoreAdmin.getFirestoreEventByIdServer("evt-100");
    assert.equal(updatedEvent?.live_short_url, "https://gdgjakarta.org/df26");

    const bevyClient = await import("@/lib/bevy/client");
    await bevyClient.updateBevyEvent("evt-100", { custom_tickets_url: "https://gdgjakarta.org/df26" });
    assert.equal(harnessState.bevy.updates.length, 1);
    assert.equal(harnessState.bevy.updates[0].patch.custom_tickets_url, "https://gdgjakarta.org/df26");

    // 5. Real shortio client + advanced modules work via registerHooks + fake Short.io
    const shortioClient = await import("@/lib/shortio/client");
    const shortioAdvanced = await import("@/lib/shortio/advanced");
    const createdViaRepo = await shortioClient.createShortLink({
      originalURL: "https://gdgjakarta.com/events/via-repo",
      path: "via-repo",
    });
    assert.equal(createdViaRepo?.path, "via-repo");
    const linkStats = await shortioAdvanced.getLinkStats(createdViaRepo.idString, "total");
    assert.equal(linkStats.totalClicks, 0);
  });

  it("runs migration CLI opaque-box in child process with zero-network fake Short.io preload", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shortlink-cli-fixture-"));
    const fixtureScript = path.join(tmpDir, "fake-migrate.mjs");

    try {
      fs.writeFileSync(
        fixtureScript,
        `
const foldersRes = await fetch("https://api.short.io/links/folders/1516440");
const foldersJson = await foldersRes.json();

const p1 = await fetch("https://api.short.io/api/links?domain_id=1516440&limit=1");
const j1 = await p1.json();
const p2 = await fetch("https://api.short.io/api/links?domain_id=1516440&limit=1&pageToken=" + j1.nextPageToken);
const j2 = await p2.json();

let blockedExternal = false;
try {
  await fetch("https://example.com/forbidden");
} catch {
  blockedExternal = true;
}

let blockedNonHttpShortio = false;
try {
  await fetch("ftp://api.short.io/api/domains");
} catch {
  blockedNonHttpShortio = true;
}

console.log(JSON.stringify({
  args: process.argv.slice(2),
  folderCount: foldersJson.linkFolders.length,
  exportedPaths: [...j1.links, ...j2.links].map((l) => l.path),
  blockedExternal,
  blockedNonHttpShortio,
}));
`,
        "utf8",
      );

      const cliResult = await runMigrationCli({
        scriptPath: fixtureScript,
        args: ["--dry-run", "--limit", "1"],
        shortioFixtures: {
          folders: [{ id: "fld_mig", name: "Migration", color: "#0693E3", DomainId: 1516440 }],
          links: [
            { id: "lnk_m1", path: "first", originalURL: "https://gdgjakarta.com/1", clicks: 10 },
            { id: "lnk_m2", path: "second", originalURL: "https://gdgjakarta.com/2", clicks: 25 },
          ],
        },
      });

      assert.equal(cliResult.exitCode, 0);
      assert.equal(cliResult.stderr, "");
      const output = JSON.parse(cliResult.stdout.trim());
      assert.deepEqual(output.args, ["--dry-run", "--limit", "1"]);
      assert.equal(output.folderCount, 1);
      assert.deepEqual(output.exportedPaths, ["first", "second"]);
      assert.equal(output.blockedExternal, true);
      assert.equal(output.blockedNonHttpShortio, true);
      assert.equal(cliResult.requests.length, 3);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("imports @/server/speaker-confirmation-actions and exercises extended firestore-admin & bevy-client stubs", async () => {
    installShortlinkHooks();
    if (!workerHarness) {
      workerHarness = await bootWorkerHarness({
        workerTsSource: INLINE_WORKER_TS,
        migrationSql: DEFAULT_SHORTLINKS_SCHEMA_SQL,
      });
    } else {
      workerHarness.activate();
    }

    const speakerActions = await import("@/server/speaker-confirmation-actions");
    assert.equal(typeof speakerActions.getExistingEventSlideTemplateOptionsAction, "function");
    assert.equal(typeof speakerActions.getEventSpeakerConfirmationsAction, "function");

    const firestoreAdmin = await import("@/server/firestore-admin");
    await firestoreAdmin.patchFirestoreDoc("event_speaker_confirmations", "spkconf_1", {
      event_id: "evt-200",
      full_name: "Ada Lovelace",
      speaker_email: "ada@example.com",
    });
    const queried = await firestoreAdmin.queryFirestoreDocs("event_speaker_confirmations", [
      {
        fieldFilter: {
          field: { fieldPath: "event_id" },
          op: "EQUAL",
          value: { stringValue: "evt-200" },
        },
      },
    ]);
    assert.equal(queried.length, 1);
    assert.equal(queried[0].id, "spkconf_1");
    assert.equal(queried[0].full_name, "Ada Lovelace");

    assert.equal(await firestoreAdmin.deleteFirestoreDoc("event_speaker_confirmations", "spkconf_1"), true);
    assert.equal(await firestoreAdmin.getFirestoreDoc("event_speaker_confirmations", "spkconf_1"), null);

    const bevyClient = await import("@/lib/bevy/client");
    const createdPerson = await bevyClient.createBevyPerson("evt-200", {
      first_name: "Ada",
      last_name: "Lovelace",
      title: "Staff Engineer",
    });
    assert.equal(createdPerson.success, true);
    assert.equal(createdPerson.data?.first_name, "Ada");

    const fetchedPerson = await bevyClient.getBevyPerson(9001, "evt-200");
    assert.equal(fetchedPerson.success, true);

    const updatedPerson = await bevyClient.updateBevyPerson(9001, "evt-200", { title: "Principal Engineer" });
    assert.equal(updatedPerson.success, true);
    assert.equal(updatedPerson.data?.title, "Principal Engineer");

    const uploadedImage = await bevyClient.uploadBevyImage(new Blob(["img"]), "evt-200", "events");
    assert.equal(uploadedImage.success, true);
    assert.ok(uploadedImage.data?.url);
  });

  it("isolates harnessState.setEnv across resetState/resetEnv/dispose and supports explicit undefined/null unsets", async () => {
    installShortlinkHooks();
    const openNext = await import("@opennextjs/cloudflare");

    const h1 = await bootWorkerHarness({
      workerTsSource: INLINE_WORKER_TS,
      migrationSql: DEFAULT_SHORTLINKS_SCHEMA_SQL,
      env: {
        SHORTLINK_PROVIDER: "cloudflare",
        HARNESS_ID: "h1-boot",
      },
    });

    try {
      // 1. setEnv overrides both process.env and getCloudflareContext().env
      harnessState.setEnv({
        SHORTLINK_PROVIDER: "shortio",
        TEMP_TEST_VAR: "1",
      });
      assert.equal(process.env.SHORTLINK_PROVIDER, "shortio");
      assert.equal(process.env.TEMP_TEST_VAR, "1");
      let ctx = await openNext.getCloudflareContext({ async: true });
      assert.equal(ctx.env.SHORTLINK_PROVIDER, "shortio");
      assert.equal(ctx.env.TEMP_TEST_VAR, "1");
      assert.equal(ctx.env.HARNESS_ID, "h1-boot");

      // 2. resetState() restores boot env and removes temp setEnv keys
      await h1.resetState();
      assert.equal(process.env.SHORTLINK_PROVIDER, "cloudflare");
      assert.equal(process.env.TEMP_TEST_VAR, undefined);
      assert.equal(process.env.HARNESS_ID, "h1-boot");
      ctx = await openNext.getCloudflareContext({ async: true });
      assert.equal(ctx.env.SHORTLINK_PROVIDER, "cloudflare");
      assert.equal(ctx.env.TEMP_TEST_VAR, undefined);
      assert.equal(ctx.env.HARNESS_ID, "h1-boot");

      // 3. Explicit undefined and null unset DEFAULT_TEST_ENV keys without snapping back
      harnessState.setEnv({
        SHORTLINK_API_KEY: undefined,
        N8N_WEBHOOK_API_KEY: null,
      });
      assert.equal(process.env.SHORTLINK_API_KEY, undefined);
      assert.equal(process.env.N8N_WEBHOOK_API_KEY, undefined);
      ctx = await openNext.getCloudflareContext({ async: true });
      assert.equal(ctx.env.SHORTLINK_API_KEY, undefined);
      assert.equal(ctx.env.N8N_WEBHOOK_API_KEY, undefined);

      // 4. resetState() restores DEFAULT_TEST_ENV keys
      await h1.resetState();
      assert.equal(process.env.SHORTLINK_API_KEY, "test-shortlink-api-key");
      assert.equal(process.env.N8N_WEBHOOK_API_KEY, "test-shortlink-api-key");
      ctx = await openNext.getCloudflareContext({ async: true });
      assert.equal(ctx.env.SHORTLINK_API_KEY, "test-shortlink-api-key");
      assert.equal(ctx.env.N8N_WEBHOOK_API_KEY, "test-shortlink-api-key");

      // 5. Mutate again right before dispose() to verify dispose cleans up leaks for h2
      harnessState.setEnv({
        SHORTLINK_PROVIDER: "shortio",
        LEAK_CHECK_VAR: "should-not-leak",
      });
    } finally {
      await h1.dispose();
    }

    assert.equal(process.env.HARNESS_ID, undefined);
    assert.equal(process.env.LEAK_CHECK_VAR, undefined);
    assert.equal(process.env.SHORTLINK_PROVIDER, "cloudflare");

    const h2 = await bootWorkerHarness({
      workerTsSource: INLINE_WORKER_TS,
      migrationSql: DEFAULT_SHORTLINKS_SCHEMA_SQL,
    });
    try {
      const ctx2 = await openNext.getCloudflareContext({ async: true });
      assert.equal(ctx2.env.SHORTLINK_PROVIDER, "cloudflare");
      assert.equal(ctx2.env.HARNESS_ID, undefined);
      assert.equal(ctx2.env.LEAK_CHECK_VAR, undefined);

      harnessState.setEnv({ SHORTLINK_API_KEY: undefined, EXTRA_TMP: "x" });
      harnessState.resetEnv();
      const ctxAfterReset = await openNext.getCloudflareContext({ async: true });
      assert.equal(ctxAfterReset.env.SHORTLINK_API_KEY, "test-shortlink-api-key");
      assert.equal(process.env.EXTRA_TMP, undefined);
    } finally {
      await h2.dispose();
      if (workerHarness) {
        workerHarness.activate();
      }
    }
  });

  it("handles /* ... */ SQL block comments, object-form cookies().set, and rejects non-HTTP Short.io URLs", async () => {
    installShortlinkHooks();

    // 1. /* ... */ block comments in splitSqlStatements
    const blockCommentHarness = await bootWorkerHarness({
      workerTsSource: INLINE_WORKER_TS,
      migrationSql: `
        /* Leading block comment; with semicolon and 'quote' */
        CREATE TABLE IF NOT EXISTS custom_block_test (id INTEGER PRIMARY KEY, label TEXT);
        /* Multi-line
           block comment; */
        INSERT INTO custom_block_test (id, label) VALUES (1, 'ok/*not-a-comment*/');
      `,
    });
    try {
      const row = await blockCommentHarness.db.prepare("SELECT/*inline*/id, label FROM custom_block_test").first();
      assert.equal(row?.id, 1);
      assert.equal(row?.label, "ok/*not-a-comment*/");
    } finally {
      await blockCommentHarness.dispose();
      if (workerHarness) {
        workerHarness.activate();
      }
    }

    // 2. Object-form cookies().set({ name, value }) and cookies().delete({ name })
    const nextHeaders = await import("next/headers");
    const cookieStore = await nextHeaders.cookies();
    cookieStore.set({ name: "obj_cookie", value: "obj_val", httpOnly: true, path: "/" });
    assert.equal(cookieStore.get("obj_cookie")?.value, "obj_val");
    cookieStore.delete({ name: "obj_cookie" });
    assert.equal(cookieStore.get("obj_cookie"), undefined);

    // 3. Non-HTTP scheme blocked even for api.short.io
    await assert.rejects(
      () => fetch("ftp://api.short.io/api/domains"),
      /Unexpected live network fetch attempted during zero-network E2E test/,
    );
  });
});
