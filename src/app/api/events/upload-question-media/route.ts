import { type NextRequest, NextResponse } from "next/server";

import { uploadMediaObject } from "@/lib/r2/client";
import { sanitizeStorageName } from "@/lib/r2/utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/upload-question-media
 * Uploads attendee response media to bucket storage in folder:
 * temp/<event-name>/<uploaded-file-name>-<timestamp>.<ext>
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const rawEventName = formData.get("eventName")?.toString()?.trim() || "";
    const rawMaxSizeMb = formData.get("maxSizeMb")?.toString();

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No valid file provided in upload payload" }, { status: 400 });
    }

    // Configurable maximum size check (default 10 MB, cap at 50 MB)
    const configuredMaxSizeMb = rawMaxSizeMb && !Number.isNaN(Number(rawMaxSizeMb)) ? Number(rawMaxSizeMb) : 10;
    const maxLimitMb = Math.max(1, Math.min(configuredMaxSizeMb, 50));
    const maxBytes = maxLimitMb * 1024 * 1024;

    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of ${maxLimitMb} MB`,
        },
        { status: 400 },
      );
    }

    // Construct destination folder: temp/<event-name>/
    const sanitizedEventName = sanitizeStorageName(rawEventName || "event", true) || "event";
    const prefix = `temp/${sanitizedEventName}/`;

    // Construct file name: <uploaded-file-name>-<timestamp>.<ext>
    const lastDotIndex = file.name.lastIndexOf(".");
    const rawBase = lastDotIndex > 0 ? file.name.slice(0, lastDotIndex) : file.name;
    const rawExt = lastDotIndex > 0 ? file.name.slice(lastDotIndex + 1) : "";

    const cleanBase = sanitizeStorageName(rawBase, false) || "uploaded-file";
    const cleanExt = rawExt ? sanitizeStorageName(rawExt, false) : "";
    const timestamp = Date.now();
    const finalFileName = cleanExt ? `${cleanBase}-${timestamp}.${cleanExt}` : `${cleanBase}-${timestamp}`;

    const arrayBuffer = await file.arrayBuffer();
    const res = await uploadMediaObject(prefix, finalFileName, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      customMetadata: {
        originalName: file.name,
        eventName: rawEventName,
        uploadedAt: new Date().toISOString(),
      },
    });

    if (!res.success || !res.item) {
      return NextResponse.json({ error: res.error ?? "Failed to upload file to storage" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: res.item.url,
      key: res.item.key,
      name: res.item.name,
      originalName: file.name,
      size: res.item.size,
      contentType: res.item.contentType,
    });
  } catch (error) {
    console.error("[Question Media Upload API] Error processing upload:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
