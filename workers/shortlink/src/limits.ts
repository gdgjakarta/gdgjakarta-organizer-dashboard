import type { EdgeShortLinkRecord, ShortlinkWorkerEnv } from "@/lib/shortlinks/types";

export interface ClickLimitCheckResult {
  allowed: boolean;
  clicksIncrementedInDb: boolean;
}

export async function consumeClickLimitIfNeeded(
  env: ShortlinkWorkerEnv,
  record: EdgeShortLinkRecord,
  method: string,
): Promise<ClickLimitCheckResult> {
  if (record.maxClicks === null || record.maxClicks === undefined) {
    return { allowed: true, clicksIncrementedInDb: false };
  }

  if (!Number.isFinite(record.maxClicks) || record.maxClicks <= 0) {
    return { allowed: false, clicksIncrementedInDb: false };
  }

  if (method === "HEAD") {
    const row = await env.SHORTLINKS_DB.prepare(
      "SELECT clicks_count, max_clicks, archived FROM short_links WHERE id = ? LIMIT 1",
    )
      .bind(record.id)
      .first<{ clicks_count: number; max_clicks: number | null; archived: number }>();

    if (!row || row.archived) {
      return { allowed: false, clicksIncrementedInDb: false };
    }

    const effectiveMax =
      typeof row.max_clicks === "number" && Number.isFinite(row.max_clicks) ? row.max_clicks : record.maxClicks;
    return {
      allowed: row.clicks_count < effectiveMax,
      clicksIncrementedInDb: false,
    };
  }

  const nowIso = new Date().toISOString();
  const res = await env.SHORTLINKS_DB.prepare(
    `UPDATE short_links
     SET clicks_count = clicks_count + 1, updated_at = ?
     WHERE id = ? AND archived = 0 AND clicks_count < COALESCE(max_clicks, ?)`,
  )
    .bind(nowIso, record.id, record.maxClicks)
    .run();

  const changes = Number(res.meta?.changes ?? 0);
  return {
    allowed: changes > 0,
    clicksIncrementedInDb: changes > 0,
  };
}
