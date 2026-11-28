import { createUnlockCookieValue, verifyLinkPassword, verifyUnlockCookieValue } from "@/lib/shortlinks/crypto";
import {
  type LinkBundleItem,
  normalizeHostname,
  normalizeSlugPath,
  type ShortlinkWorkerEnv,
} from "@/lib/shortlinks/types";

import { recordClickEvent } from "./analytics";
import {
  buildSetCookieHeader,
  extractSubmittedPassword,
  getUnlockCookieName,
  isHttpsRequest,
  parseCookieMap,
} from "./cookies";
import { consumeClickLimitIfNeeded } from "./limits";
import { decodePathnameSafely, getEdgeLink, normalizeExpiresAt } from "./lookup";
import {
  hasActiveSplitTargets,
  mergeUtmAndQueryParams,
  resolveTargetDestination,
  sanitizeSafeHttpUrl,
} from "./targeting";
import {
  renderBundlePage,
  renderCloakPage,
  renderExpiredPage,
  renderNotFoundPage,
  renderPasswordPromptPage,
  renderPixelInterstitialPage,
  sanitizePixels,
} from "./templates";
import { handleWellKnownRequest } from "./well-known";

type WorkerRequest = Request<unknown, IncomingRequestCfProperties<unknown>>;

const ROOT_REDIRECT_URL = "https://gdgjakarta.com";

function stripBodyIfHead(response: Response, method: string): Response {
  if (method !== "HEAD") {
    return response;
  }
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}

function buildExpiredFallbackResponse(
  expiredUrl: string | null | undefined,
  title: string | null | undefined,
  method: string,
): Response {
  const safeExpiredUrl = sanitizeSafeHttpUrl(expiredUrl);
  if (safeExpiredUrl) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: safeExpiredUrl,
        "Cache-Control": "no-store",
      },
    });
  }
  return stripBodyIfHead(renderExpiredPage(title), method);
}

const handler: ExportedHandler<ShortlinkWorkerEnv> = {
  async fetch(request: WorkerRequest, env: ShortlinkWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: "GET, HEAD, POST",
        },
      });
    }

    const url = new URL(request.url);
    const hostname = normalizeHostname(url.hostname);
    const decodedPathname = decodePathnameSafely(url.pathname);
    const slug = normalizeSlugPath(decodedPathname);
    const isRootPath = url.pathname === "/" || url.pathname === "//";

    // 1. Mobile Deep Linking (/.well-known/*)
    if (url.pathname === "/.well-known/apple-app-site-association" || url.pathname === "/.well-known/assetlinks.json") {
      if (method === "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        });
      }
      const wellKnownRes = await handleWellKnownRequest(url.pathname, hostname, env, ctx);
      if (wellKnownRes) {
        return stripBodyIfHead(wellKnownRes, method);
      }
    }

    // 2. Root "/" redirect -> https://gdgjakarta.com
    if (isRootPath) {
      if (method === "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        });
      }
      return new Response(null, {
        status: 302,
        headers: {
          Location: ROOT_REDIRECT_URL,
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    // 3. Link lookup (KV -> D1 fallback + async KV backfill) & missing/archived check
    const record = await getEdgeLink(env, hostname, slug, ctx);
    if (!record || record.archived) {
      return stripBodyIfHead(renderNotFoundPage(decodedPathname), method);
    }

    const nowMs = Date.now();

    // 4. Time-based expiration (checked before password & maxClicks)
    const expiresAtMs = normalizeExpiresAt(record.expiresAt);
    if (expiresAtMs !== null && nowMs >= expiresAtMs) {
      return buildExpiredFallbackResponse(record.expiredURL, record.title, method);
    }

    // 5. Password protection gate
    const passwordHash = typeof record.passwordHash === "string" ? record.passwordHash.trim() : "";
    const isPasswordProtected = passwordHash.length > 0;
    const cookies = parseCookieMap(request.headers.get("cookie"));
    const secureCookie = isHttpsRequest(request, url);

    if (isPasswordProtected) {
      const cookieSecret = typeof env.SHORTLINK_COOKIE_SECRET === "string" ? env.SHORTLINK_COOKIE_SECRET.trim() : "";
      if (!cookieSecret) {
        return stripBodyIfHead(
          new Response("Server configuration error", {
            status: 500,
            headers: { "Cache-Control": "no-store" },
          }),
          method,
        );
      }

      if (method === "POST") {
        const submittedPassword = await extractSubmittedPassword(request);
        const passwordValid = submittedPassword ? await verifyLinkPassword(submittedPassword, passwordHash) : false;

        if (!passwordValid) {
          return renderPasswordPromptPage({
            title: record.title,
            slug: record.path,
            errorMessage: "Incorrect password. Please try again.",
            status: 401,
          });
        }

        const unlockValue = await createUnlockCookieValue(cookieSecret, {
          linkId: record.id,
          nowMs,
        });
        const setCookie = buildSetCookieHeader({
          name: getUnlockCookieName(record.id),
          value: unlockValue,
          maxAge: 3600,
          secure: secureCookie,
        });

        const safeRedirectPath = `/${normalizeSlugPath(record.path)}${url.search}`;

        return new Response(null, {
          status: 303,
          headers: {
            Location: safeRedirectPath,
            "Set-Cookie": setCookie,
            "Cache-Control": "no-store",
          },
        });
      }

      const existingUnlockCookie = cookies.get(getUnlockCookieName(record.id));
      const isUnlocked = await verifyUnlockCookieValue(cookieSecret, existingUnlockCookie, record.id, nowMs);
      if (!isUnlocked) {
        return stripBodyIfHead(
          renderPasswordPromptPage({
            title: record.title,
            slug: record.path,
            status: 200,
          }),
          method,
        );
      }
    } else if (method === "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    // Fail closed before consuming maxClicks if split testing is active without cookie secret
    if (
      hasActiveSplitTargets(record) &&
      !(typeof env.SHORTLINK_COOKIE_SECRET === "string" && env.SHORTLINK_COOKIE_SECRET.trim())
    ) {
      return stripBodyIfHead(
        new Response("Server configuration error", {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        }),
        method,
      );
    }

    // 6. Click-limit expiration (atomic D1 check-and-increment)
    const limitResult = await consumeClickLimitIfNeeded(env, record, method);
    if (!limitResult.allowed) {
      return buildExpiredFallbackResponse(record.expiredURL, record.title, method);
    }

    const sanitizedPixels = sanitizePixels(record.pixels);

    // 7A. Link Bundle response mode
    if (record.linkType === "bundle") {
      const safeBundleItems: LinkBundleItem[] = [];
      for (const item of record.bundleItems ?? []) {
        if (!item || typeof item !== "object") continue;
        const safeUrl = sanitizeSafeHttpUrl(item.url);
        if (!safeUrl) continue;
        safeBundleItems.push({
          title: item.title,
          url: mergeUtmAndQueryParams(safeUrl, record.utmParams, url.searchParams),
          description: item.description,
          icon: item.icon,
        });
      }

      const bundleRes = renderBundlePage({
        title: record.title,
        items: safeBundleItems,
        pixels: sanitizedPixels,
      });

      if (method === "GET") {
        ctx.waitUntil(
          recordClickEvent(env, {
            linkId: record.id,
            hostname,
            path: record.path,
            userAgent: request.headers.get("user-agent"),
            referer: request.headers.get("referer"),
            cf: request.cf,
            variantLabel: null,
            targetUrl: sanitizeSafeHttpUrl(record.originalURL),
            clicksIncrementedInDb: limitResult.clicksIncrementedInDb,
            clickedAt: nowMs,
          }),
        );
      }

      return stripBodyIfHead(bundleRes, method);
    }

    // 7B. Target resolution (A/B split -> OS -> Geo -> originalURL + UTM/query merge)
    const userAgent = request.headers.get("user-agent");
    const resolved = await resolveTargetDestination({
      record,
      requestCf: request.cf,
      userAgent,
      incomingSearchParams: url.searchParams,
      cookies,
      cookieSecret: env.SHORTLINK_COOKIE_SECRET,
      secureCookie,
      nowMs,
    });

    if (!resolved.ok) {
      return stripBodyIfHead(
        new Response(resolved.error, {
          status: resolved.status,
          headers: { "Cache-Control": "no-store" },
        }),
        method,
      );
    }

    let response: Response;
    if (record.cloaking) {
      response = renderCloakPage({
        targetUrl: resolved.targetUrl,
        title: record.title,
        pixels: sanitizedPixels,
      });
    } else if (sanitizedPixels) {
      response = renderPixelInterstitialPage({
        targetUrl: resolved.targetUrl,
        title: record.title,
        pixels: sanitizedPixels,
      });
    } else {
      const noStore = isPasswordProtected || record.maxClicks != null || resolved.isDynamic;
      response = new Response(null, {
        status: record.redirectType,
        headers: {
          Location: resolved.targetUrl,
          "Cache-Control": noStore ? "private, no-store" : "public, max-age=60",
        },
      });
    }

    for (const cookieHeader of resolved.setCookieHeaders) {
      response.headers.append("Set-Cookie", cookieHeader);
    }
    if (resolved.setCookieHeaders.length > 0) {
      response.headers.set("Cache-Control", "private, no-store");
    }

    // 8. Async click analytics via ctx.waitUntil() (only on GET)
    if (method === "GET") {
      ctx.waitUntil(
        recordClickEvent(env, {
          linkId: record.id,
          hostname,
          path: record.path,
          userAgent,
          referer: request.headers.get("referer"),
          cf: request.cf,
          variantLabel: resolved.variantLabel,
          targetUrl: resolved.targetUrl,
          clicksIncrementedInDb: limitResult.clicksIncrementedInDb,
          clickedAt: nowMs,
        }),
      );
    }

    return stripBodyIfHead(response, method);
  },
};

export default handler;
