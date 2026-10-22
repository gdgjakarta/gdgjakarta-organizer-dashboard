import { type NextRequest, NextResponse } from "next/server";

import { getMediaObjectStream } from "@/lib/r2/client";
import { splitStorageKey } from "@/lib/r2/utils";

export const dynamic = "force-dynamic";

const SAFE_INLINE_MIME_TYPES: Record<string, true> = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
  "image/gif": true,
};

interface RouteParams {
  params: Promise<{
    path?: string[];
  }>;
}

function parseRangeHeader(rangeHeader: string | null): R2Range | undefined {
  if (!rangeHeader) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return undefined;
  const [, startStr, endStr] = match;
  if (!startStr && endStr) {
    const suffix = Number.parseInt(endStr, 10);
    return Number.isFinite(suffix) && suffix > 0 ? { suffix } : undefined;
  }
  if (startStr) {
    const offset = Number.parseInt(startStr, 10);
    if (!Number.isFinite(offset) || offset < 0) return undefined;
    if (endStr) {
      const end = Number.parseInt(endStr, 10);
      if (Number.isFinite(end) && end >= offset) {
        return { offset, length: end - offset + 1 };
      }
    }
    return { offset };
  }
  return undefined;
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
    const parsedRange = parseRangeHeader(request.headers.get("range"));
    const object = await getMediaObjectStream(rawKey, parsedRange ? { range: parsedRange } : undefined);

    if (!object) {
      return NextResponse.json({ error: "Media file not found in R2" }, { status: 404 });
    }

    const { name } = splitStorageKey(rawKey);
    const contentType = object.httpMetadata?.contentType || "application/octet-stream";
    const isSafeInline = SAFE_INLINE_MIME_TYPES[contentType.toLowerCase().trim()] === true;
    const dispositionType = isDownload || !isSafeInline ? "attachment" : "inline";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Disposition", `${dispositionType}; filename="${encodeURIComponent(name)}"`);
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    if (object.etag) {
      headers.set("ETag", `"${object.etag}"`);
    }

    let status = 200;
    const r2Range = (object as unknown as { range?: { offset: number; length: number } }).range;
    if (r2Range && typeof r2Range.offset === "number" && typeof r2Range.length === "number") {
      status = 206;
      const start = r2Range.offset;
      const end = r2Range.offset + r2Range.length - 1;
      headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`);
      headers.set("Content-Length", r2Range.length.toString());
    } else {
      headers.set("Content-Length", object.size.toString());
    }

    // Workerd / R2 stream response
    return new Response(object.body as unknown as ReadableStream, {
      status,
      headers,
    });
  } catch (error) {
    console.error("[Media Stream API] Error fetching media:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
