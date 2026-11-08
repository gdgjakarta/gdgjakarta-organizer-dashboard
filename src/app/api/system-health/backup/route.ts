import { NextResponse } from "next/server";

import { isAuthorizedOrganizerSession } from "@/server/auth-guard";
import { getSystemHealthConfigServer } from "@/server/system-health-actions";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthorizedOrganizerSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const secret = (process.env.OPS_AGENT_SECRET || "").trim();
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { ok: false, error: "OPS_AGENT_SECRET environment variable is not configured on the server." },
      { status: 503 },
    );
  }

  const config = await getSystemHealthConfigServer();

  try {
    const upstream = await fetch(`${config.opsAgentUrl}/backup/postgres`, {
      method: "GET",
      headers: {
        "X-Ops-Secret": secret,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(180000),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: errText || `Backup upstream returned HTTP ${upstream.status}` },
        { status: upstream.status || 502 },
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="gdg-jakarta-postgres-${dateStr}.dump"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to stream database backup" },
      { status: 502 },
    );
  }
}
