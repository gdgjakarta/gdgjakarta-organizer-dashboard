import { type NextRequest, NextResponse } from "next/server";

import { uploadMediaObject } from "@/lib/r2/client";
import { sanitizeStorageName } from "@/lib/r2/utils";
import { getFirestoreEventByIdServer } from "@/server/firestore-admin";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_MIME_TYPES: Record<string, true> = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
};

const ALLOWED_IMAGE_EXTENSIONS: Record<string, true> = {
  jpg: true,
  jpeg: true,
  png: true,
  webp: true,
};

/**
 * POST /api/events/upload-speaker-photo
 * Uploads a speaker profile photo directly to Cloudflare R2 bucket:
 * speakers/<event-id>/<speaker-name>-<timestamp>.<ext>
 *
 * Gated by event speaker share token, with configurable size limit (default: 5 MB).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const eventId = formData.get("eventId")?.toString()?.trim() || "";
    const token = formData.get("token")?.toString()?.trim() || "";
    const speakerName = formData.get("speakerName")?.toString()?.trim() || "speaker";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    if (!eventId || !token) {
      return NextResponse.json({ error: "Missing event ID or verification token." }, { status: 400 });
    }

    // Verify token against event's speaker_config in Firestore
    const event = await getFirestoreEventByIdServer(eventId);
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (!event.speaker_config?.share_token || event.speaker_config.share_token !== token) {
      return NextResponse.json({ error: "Invalid or expired speaker confirmation token." }, { status: 403 });
    }

    if (event.speaker_config.enabled === false) {
      return NextResponse.json({ error: "Speaker confirmations are closed for this event." }, { status: 403 });
    }

    // Path traversal check
    if (file.name.includes("..") || file.name.includes("/") || file.name.includes("\\")) {
      return NextResponse.json({ error: "Invalid filename: path traversal sequences are forbidden." }, { status: 400 });
    }

    // MIME type check - only images
    const mimeType = (file.type || "").toLowerCase().trim();
    if (!ALLOWED_IMAGE_MIME_TYPES[mimeType]) {
      return NextResponse.json(
        { error: "Disallowed file type. Only JPEG, PNG, and WebP images are allowed for speaker photos." },
        { status: 400 },
      );
    }

    // Extension check
    const lastDotIndex = file.name.lastIndexOf(".");
    const rawExt =
      lastDotIndex > 0
        ? file.name
            .slice(lastDotIndex + 1)
            .toLowerCase()
            .trim()
        : "";
    if (!ALLOWED_IMAGE_EXTENSIONS[rawExt]) {
      return NextResponse.json(
        { error: "Disallowed file extension. Only .jpg, .jpeg, .png, and .webp images are allowed." },
        { status: 400 },
      );
    }

    // Configurable size limit in MB (from event speaker config, default 5 MB, max 25 MB)
    const configuredMaxSizeMb = event.speaker_config.max_photo_size_mb ?? 5;
    const maxLimitMb = Math.max(1, Math.min(configuredMaxSizeMb, 25));
    const maxBytes = maxLimitMb * 1024 * 1024;

    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: `Photo file size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of ${maxLimitMb} MB.`,
        },
        { status: 400 },
      );
    }

    // Destination prefix: speakers/<event-id>/
    const sanitizedEventId = sanitizeStorageName(eventId, true) || "event";
    const prefix = `speakers/${sanitizedEventId}/`;

    // Construct filename: <sanitized-speaker-name>-<timestamp>.<ext>
    const cleanSpeaker = sanitizeStorageName(speakerName, true) || "speaker";
    const cleanExt = sanitizeStorageName(rawExt, false) || "jpg";
    const timestamp = Date.now();
    const finalFileName = `${cleanSpeaker}-${timestamp}.${cleanExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const res = await uploadMediaObject(prefix, finalFileName, arrayBuffer, {
      contentType: file.type || "image/jpeg",
      customMetadata: {
        originalName: file.name,
        eventId,
        speakerName,
        uploadedAt: new Date().toISOString(),
      },
    });

    if (!res.success || !res.item) {
      return NextResponse.json({ error: res.error ?? "Failed to upload photo to storage." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: res.item.url,
      key: res.item.key,
      name: res.item.name,
      size: res.item.size,
      contentType: res.item.contentType,
    });
  } catch (error) {
    console.error("[Speaker Photo Upload API] Error processing upload:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
