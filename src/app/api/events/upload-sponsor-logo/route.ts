import { type NextRequest, NextResponse } from "next/server";

import { uploadBevyImage } from "@/lib/bevy/client";
import { getFirestoreEventByIdServer } from "@/server/firestore-admin";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_MIME_TYPES: Record<string, true> = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
};

/**
 * POST /api/events/upload-sponsor-logo
 * Uploads cropped 16:9 sponsor logo directly to Bevy API (POST /api/image/)
 * with Referer: https://gdg.community.dev/dashboard/gdg-jakarta/sponsors/sponsors
 *
 * Gated by event sponsor share token (or organizer context).
 * User requirement: "if it's already stores to bevy image bucket using api, no need to store it again on cloudflare"
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const eventId = formData.get("eventId")?.toString()?.trim() || "";
    const token = formData.get("token")?.toString()?.trim() || "";
    const isOrganizer = formData.get("isOrganizer")?.toString() === "true";

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    // MIME type check
    const mimeType = (file.type || "").toLowerCase().trim();
    if (!ALLOWED_IMAGE_MIME_TYPES[mimeType] && mimeType !== "application/octet-stream") {
      return NextResponse.json(
        { error: "Disallowed file type. Only JPEG, PNG, and WebP images are allowed for sponsor logos." },
        { status: 400 },
      );
    }

    // Size limit: 10 MB
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `Logo file size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 10 MB limit.` },
        { status: 400 },
      );
    }

    // Verification: if public submission from sponsor confirmation link, check token against event or chapter config
    if (!isOrganizer) {
      if (!token) {
        return NextResponse.json({ error: "Missing verification token." }, { status: 400 });
      }

      if (eventId) {
        const event = await getFirestoreEventByIdServer(eventId);
        if (!event) {
          return NextResponse.json({ error: "Event not found." }, { status: 404 });
        }

        if (!event.sponsor_config?.share_token || event.sponsor_config.share_token !== token) {
          return NextResponse.json({ error: "Invalid or expired sponsor confirmation token." }, { status: 403 });
        }

        if (event.sponsor_config.enabled === false) {
          return NextResponse.json(
            { error: "Sponsor confirmations are currently closed for this event." },
            { status: 403 },
          );
        }
      } else {
        // Non-event chapter sponsor confirmation
        const { getOrInitChapterSponsorConfigAction } = await import("@/server/sponsor-actions");
        const chapterConfig = await getOrInitChapterSponsorConfigAction();
        if (
          !chapterConfig.success ||
          !chapterConfig.config?.share_token ||
          chapterConfig.config.share_token !== token
        ) {
          return NextResponse.json({ error: "Invalid or expired sponsor confirmation token." }, { status: 403 });
        }
        if (chapterConfig.config.enabled === false) {
          return NextResponse.json({ error: "Sponsor confirmations are currently closed." }, { status: 403 });
        }
      }
    }

    // Upload directly to Bevy /api/image/
    const uploadRes = await uploadBevyImage(file, eventId || undefined, "sponsors");
    if (!uploadRes.success || !uploadRes.data?.url) {
      return NextResponse.json({ error: uploadRes.error || "Failed to upload image to Bevy." }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      url: uploadRes.data.url,
      thumbnail_url: uploadRes.data.thumbnail_url || uploadRes.data.url,
      data: uploadRes.data,
    });
  } catch (err: unknown) {
    console.error("[upload-sponsor-logo] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error uploading sponsor logo." },
      { status: 500 },
    );
  }
}
