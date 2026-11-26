import { NextResponse } from "next/server";

import { type EventStreamSessionDoc, isValidStreamEventId } from "@/lib/events/stream-access";
import { getFirestoreDoc, patchFirestoreDocDetailed } from "@/server/firestore-admin";

const MAX_BEACON_BODY_BYTES = 1024;

/**
 * Beacon / keepalive endpoint called on `pagehide` / `beforeunload` to expire an active viewing session immediately.
 */
export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await context.params;
    if (!isValidStreamEventId(eventId)) {
      return NextResponse.json({ ok: false, error: "Invalid eventId" }, { status: 400 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BEACON_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }

    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ ok: false, error: "Empty body" }, { status: 400 });
    }
    if (rawBody.length > MAX_BEACON_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }

    const parsed = JSON.parse(rawBody) as { sessionId?: string };
    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId.trim() : "";

    if (!/^strm_[a-f0-9]{32}$/.test(sessionId)) {
      return NextResponse.json({ ok: false, error: "Invalid sessionId" }, { status: 400 });
    }

    const doc = (await getFirestoreDoc("event_stream_sessions", sessionId)) as EventStreamSessionDoc | null;
    if (!doc || doc.event_id !== eventId) {
      return NextResponse.json({ ok: true, expired: false });
    }

    if (doc.status !== "active") {
      return NextResponse.json({ ok: true, expired: false });
    }

    const now = Date.now();
    await patchFirestoreDocDetailed(
      "event_stream_sessions",
      sessionId,
      {
        status: "expired",
        last_heartbeat_at: now,
        ended_at: now,
      },
      true,
    );

    return NextResponse.json({ ok: true, expired: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
