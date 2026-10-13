import { type NextRequest, NextResponse } from "next/server";

import { getMediaObjectStream } from "@/lib/r2/client";
import { splitStorageKey } from "@/lib/r2/utils";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    path?: string[];
  }>;
}

/**
 * GET /api/media/[...path]
 * Streams media stored in Cloudflare R2 with aggressive HTTP caching and proper MIME headers.
 * Append ?download=1 to force attachment download.
 */
export async function GET(request: NextRequest, context: RouteParams) {
  const { path } = await context.params;

  if (!path || path.length === 0) {
    return NextResponse.json({ error: "Media path parameter is required" }, { status: 400 });
  }

  const rawKey = path.map((seg) => decodeURIComponent(seg)).join("/");
  const isDownload = request.nextUrl.searchParams.get("download") === "1";

  try {
    const object = await getMediaObjectStream(rawKey);

    if (!object) {
      return NextResponse.json({ error: "Media file not found in R2" }, { status: 404 });
    }

    const { name } = splitStorageKey(rawKey);
    const contentType = object.httpMetadata?.contentType || "application/octet-stream";
    const dispositionType = isDownload ? "attachment" : "inline";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Length", object.size.toString());
    headers.set("Content-Disposition", `${dispositionType}; filename="${encodeURIComponent(name)}"`);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    if (object.etag) {
      headers.set("ETag", `"${object.etag}"`);
    }

    // Workerd / R2 stream response
    return new Response(object.body as unknown as ReadableStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[Media Stream API] Error fetching media:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
