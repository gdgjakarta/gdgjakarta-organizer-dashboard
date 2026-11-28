import type { ShortlinkWorkerEnv } from "@/lib/shortlinks/types";

import { getDomainConfig } from "./lookup";

const WELL_KNOWN_AASA_PATH = "/.well-known/apple-app-site-association";
const WELL_KNOWN_ASSETLINKS_PATH = "/.well-known/assetlinks.json";

function parseValidJsonPayload(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed === null || typeof parsed !== "object") {
      return null;
    }
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

export async function handleWellKnownRequest(
  pathname: string,
  hostname: string,
  env: ShortlinkWorkerEnv,
  ctx: ExecutionContext,
): Promise<Response | null> {
  const isAasa = pathname === WELL_KNOWN_AASA_PATH;
  const isAssetLinks = pathname === WELL_KNOWN_ASSETLINKS_PATH;

  if (!isAasa && !isAssetLinks) {
    return null;
  }

  const config = await getDomainConfig(env, hostname, ctx);
  const rawPayload = isAasa ? config?.appleAppSiteAssociation : config?.assetLinks;
  const validatedJson = parseValidJsonPayload(rawPayload);

  if (!validatedJson) {
    return new Response(JSON.stringify({ error: "Deep link configuration not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new Response(validatedJson, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
