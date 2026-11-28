import type { ShortlinkWorkerEnv } from "@/lib/shortlinks/types";

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: string;
  isBot: boolean;
}

const BOT_UA_PATTERN =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|twitterbot|whatsapp|telegrambot|slackbot|discordbot|linkedinbot|curl|wget|python-requests|headlesschrome|lighthouse/i;

export function parseUserAgent(ua: string | null, cf?: IncomingRequestCfProperties<unknown>): ParsedUserAgent {
  const userAgent = ua ?? "";
  const isBot = Boolean(cf?.botManagement?.verifiedBot) || BOT_UA_PATTERN.test(userAgent);

  // Check iOS before macOS ("like Mac OS X") and Android before Linux.
  let os = "Other";
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    os = "iOS";
  } else if (/Android/i.test(userAgent)) {
    os = "Android";
  } else if (/Windows NT|Win64|WOW64/i.test(userAgent)) {
    os = "Windows";
  } else if (/Mac OS X|Macintosh/i.test(userAgent)) {
    os = "macOS";
  } else if (/CrOS/i.test(userAgent)) {
    os = "ChromeOS";
  } else if (/Linux/i.test(userAgent)) {
    os = "Linux";
  }

  let browser = "Other";
  if (/EdgA?\/|EdgiOS\//i.test(userAgent)) {
    browser = "Edge";
  } else if (/OPR\/|Opera/i.test(userAgent)) {
    browser = "Opera";
  } else if (/SamsungBrowser\//i.test(userAgent)) {
    browser = "Samsung Internet";
  } else if (/Firefox\/|FxiOS\//i.test(userAgent)) {
    browser = "Firefox";
  } else if (/Chrome\/|CriOS\//i.test(userAgent)) {
    browser = "Chrome";
  } else if (/Safari\//i.test(userAgent)) {
    browser = "Safari";
  } else if (/curl\//i.test(userAgent)) {
    browser = "curl";
  } else if (isBot) {
    browser = "Bot";
  }

  let device = "Desktop";
  if (isBot) {
    device = "Bot";
  } else if (
    /iPad|Tablet|PlayBook|Silk/i.test(userAgent) ||
    (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))
  ) {
    device = "Tablet";
  } else if (/Mobile|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(userAgent)) {
    device = "Mobile";
  }

  return { browser, os, device, isBot };
}

export interface RecordClickInput {
  linkId: string;
  hostname: string;
  path: string;
  userAgent: string | null;
  referer: string | null;
  cf?: IncomingRequestCfProperties<unknown>;
  variantLabel: string | null;
  targetUrl: string | null;
  clicksIncrementedInDb: boolean;
  clickedAt?: number;
}

export async function recordClickEvent(env: ShortlinkWorkerEnv, input: RecordClickInput): Promise<void> {
  const clickedAt = input.clickedAt ?? Date.now();
  const clickId = `clk_${crypto.randomUUID()}`;
  const parsed = parseUserAgent(input.userAgent, input.cf);
  const country =
    typeof input.cf?.country === "string" && input.cf.country.trim() ? input.cf.country.trim().toUpperCase() : null;
  const city = typeof input.cf?.city === "string" && input.cf.city.trim() ? input.cf.city.trim() : null;
  const trimmedReferer = input.referer?.trim();
  const referer = trimmedReferer ? trimmedReferer.slice(0, 1024) : null;

  try {
    const insertStmt = env.SHORTLINKS_DB.prepare(
      `INSERT INTO short_link_clicks (
        id, link_id, hostname, path, clicked_at, country, city, browser, os, device, referer, is_bot, variant_label, target_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      clickId,
      input.linkId,
      input.hostname,
      input.path,
      clickedAt,
      country,
      city,
      parsed.browser,
      parsed.os,
      parsed.device,
      referer,
      parsed.isBot ? 1 : 0,
      input.variantLabel,
      input.targetUrl,
    );

    if (input.clicksIncrementedInDb) {
      await insertStmt.run();
      return;
    }

    const updateStmt = env.SHORTLINKS_DB.prepare(
      "UPDATE short_links SET clicks_count = clicks_count + 1, updated_at = ? WHERE id = ?",
    ).bind(new Date(clickedAt).toISOString(), input.linkId);

    await env.SHORTLINKS_DB.batch([insertStmt, updateStmt]);
  } catch (err) {
    console.warn("Failed to record click analytics", err);
  }
}
