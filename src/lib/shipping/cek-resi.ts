import type { CourierType } from "@/lib/firestore/types";

export interface CekResiPerjalanan {
  tanggal: string;
  keterangan: string;
}

export interface CekResiTrackingData {
  expedisi: string;
  noResi: string;
  pengirim: string;
  tujuan: string;
  tanggalKirim: string;
  status: string;
  penerima: string;
  linkCekResi: string;
  perjalanan: CekResiPerjalanan[];
}

export interface CekResiTrackingResponse {
  valid: boolean;
  data?: CekResiTrackingData;
  error?: string;
  message?: string;
}

/**
 * Maps dashboard CourierType to CekResi courier expedition code.
 */
export function mapCourierToCekResiCode(courier?: CourierType | string): string {
  switch (courier?.toLowerCase()) {
    case "jne":
      return "jne";
    case "jnt":
    case "j&t":
      return "JET";
    case "sicepat":
      return "sicepat";
    case "pos":
      return "pos";
    case "anteraja":
      return "anteraja";
    case "tiki":
      return "tiki";
    case "wahana":
      return "wahana";
    case "ninja":
      return "ninja";
    case "lion":
      return "lion";
    default:
      return "JET";
  }
}

/**
 * Encrypts tracking number using AES-128-CBC matching CekResi's custom client token handshake.
 * Uses Web Crypto API for zero-dependency universal compatibility (Node.js & Cloudflare Edge).
 */
async function encryptCekResiTimers(trackingNumber: string): Promise<string> {
  const keyHex = "79540e250fdb16afac03e19c46dbdeb3";
  const ivHex = "eb2bb9425e81ffa942522e4414e95bd0";

  const keyBytes = new Uint8Array((keyHex.match(/.{1,2}/g) ?? []).map((byte) => Number.parseInt(byte, 16)));
  const ivBytes = new Uint8Array((ivHex.match(/.{1,2}/g) ?? []).map((byte) => Number.parseInt(byte, 16)));

  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt"]);

  const encoded = new TextEncoder().encode(trackingNumber);
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-CBC", iv: ivBytes }, cryptoKey, encoded);

  const base64 = Buffer.from(cipherBuffer).toString("base64");
  return encodeURIComponent(base64);
}

/**
 * Retrieves initial CSRF viewstate and secret_key tokens from cekresi.com.
 */
async function getCekResiCSRF(
  trackingNumber: string,
  courierCode: string,
): Promise<{ viewstate: string; secret_key: string }> {
  const url = `https://cekresi.com/?noresi=${encodeURIComponent(trackingNumber)}&e=${courierCode}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "id,en-US;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF tokens from cekresi.com (HTTP ${response.status})`);
  }

  const html = await response.text();
  const vsMatch = html.match(/name="viewstate"[^>]*value="([^"]+)"/i);
  const skMatch = html.match(/name="secret_key"[^>]*value="([^"]+)"/i);

  if (!vsMatch || !skMatch) {
    throw new Error("Unable to extract CSRF viewstate or secret_key from cekresi.com");
  }

  return {
    viewstate: vsMatch[1],
    secret_key: skMatch[1],
  };
}

function cleanHtmlText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, " - ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses raw HTML response from apa2.cekresi.com/cekresi/resi/initialize.php.
 */
function parseCekResiHtml(html: string, fallbackNumber: string, fallbackCourier: string): CekResiTrackingData {
  const alertMatch = html.match(
    /<div class="alert alert-success">[\s\S]*?paket <strong>(.*?)<\/strong> Anda dengan no resi <strong>(.*?)<\/strong>.*?status <strong>(.*?)<\/strong>/i,
  );
  const rawExpedisi = alertMatch ? alertMatch[1].trim() : fallbackCourier;
  const noResi = alertMatch ? alertMatch[2].trim() : fallbackNumber;
  const alertStatus = alertMatch ? alertMatch[3].trim() : "";

  const pengirimMatch = html.match(
    /Dikirim oleh[\s\S]*?<\/td>[\s\S]*?<td[^>]*>:<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i,
  );
  const tujuanMatch = html.match(/Dikirim ke[\s\S]*?<\/td>[\s\S]*?<td[^>]*>:<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
  const tanggalKirimMatch = html.match(
    /Dikirim tanggal[\s\S]*?<\/td>[\s\S]*?<td[^>]*>:<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i,
  );
  const statusMatch = html.match(/id="status_resi"[^>]*><b>(.*?)<\/b>/i);
  const receiverMatch = html.match(/id="last_position"[^>]*>([\s\S]*?)<\/div>/i);
  const linkMatch = html.match(/name="linkcekresi"[^>]*value="([^"]+)"/i);

  const perjalanan: CekResiPerjalanan[] = [];
  const tableMatch = html.match(/id="collapseTwo"[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  if (tableMatch) {
    const rowRegex = /<tr>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
    let match = rowRegex.exec(tableMatch[1]);
    while (match !== null) {
      const tanggal = cleanHtmlText(match[1]);
      const keterangan = cleanHtmlText(match[2]);
      if (tanggal && keterangan && tanggal.toLowerCase() !== "tanggal") {
        perjalanan.push({ tanggal, keterangan });
      }
      match = rowRegex.exec(tableMatch[1]);
    }
  }

  const status = statusMatch ? cleanHtmlText(statusMatch[1]) : alertStatus || "Unknown";

  return {
    expedisi: cleanHtmlText(rawExpedisi),
    noResi,
    pengirim: cleanHtmlText(pengirimMatch?.[1]),
    tujuan: cleanHtmlText(tujuanMatch?.[1]),
    tanggalKirim: cleanHtmlText(tanggalKirimMatch?.[1]),
    status: status || "On Process",
    penerima: cleanHtmlText(receiverMatch?.[1]),
    linkCekResi: linkMatch ? linkMatch[1] : `https://cekresi.com/?r=w&noresi=${encodeURIComponent(noResi)}`,
    perjalanan,
  };
}

/**
 * Tracks a package using the CekResi API engine (Leuthra/cek-resi pattern).
 */
export async function trackPackageWithCekResi(
  trackingNumber: string,
  courier?: CourierType | string,
): Promise<CekResiTrackingResponse> {
  const cleanNumber = trackingNumber.trim().replace(/\s+/g, "");
  if (!cleanNumber) {
    return {
      valid: false,
      error: "Tracking / resi number cannot be empty.",
    };
  }

  const courierCode = mapCourierToCekResiCode(courier);

  try {
    const [csrf, timers] = await Promise.all([
      getCekResiCSRF(cleanNumber, courierCode),
      encryptCekResiTimers(cleanNumber),
    ]);

    const postData = `viewstate=${encodeURIComponent(csrf.viewstate)}&secret_key=${encodeURIComponent(
      csrf.secret_key,
    )}&e=${courierCode}&noresi=${encodeURIComponent(cleanNumber)}&timers=${timers}`;

    const randomSuffix = Math.random().toString(36).substring(7);
    const trackingUrl = `https://apa2.cekresi.com/cekresi/resi/initialize.php?ui=dad9643acec71f85853608db54345ada&p=1&w=${randomSuffix}`;

    const trackResponse = await fetch(trackingUrl, {
      method: "POST",
      headers: {
        Host: "apa2.cekresi.com",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0",
        Accept: "*/*",
        "Accept-Language": "id,en-US;q=0.8,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: "https://cekresi.com",
        Referer: "https://cekresi.com/",
        "Cache-Control": "max-age=0",
      },
      body: postData,
      signal: AbortSignal.timeout(12000),
    });

    if (!trackResponse.ok) {
      throw new Error(`CekResi tracking service returned HTTP ${trackResponse.status}`);
    }

    const html = await trackResponse.text();

    if (html.includes("Pengecekan resi belum bisa dilakukan") || html.includes("tidak ditemukan")) {
      return {
        valid: false,
        message: "Nomor resi tidak ditemukan atau belum tercatat pada sistem ekspedisi.",
      };
    }

    const data = parseCekResiHtml(html, cleanNumber, courierCode.toUpperCase());

    return {
      valid: true,
      data,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while tracking package";
    return {
      valid: false,
      error: message,
    };
  }
}
