const COURIER_LABELS: Record<string, string> = {
  jne: "JNE",
  jnt: "J&T",
  paxel: "Paxel",
  sicepat: "SiCepat",
  gojek: "Gojek",
  grab: "GrabExpress",
  anteraja: "AnterAja",
  pos: "Pos Indonesia",
  lion_parcel: "Lion Parcel",
  other: "Other",
};

const OFFICIAL_COURIER_TRACKING_URLS: Record<string, (encodedTrackingNumber: string) => string> = {
  lion_parcel: (q) => (q ? `https://lionparcel.com/track/stt?q=${q}` : "https://lionparcel.com/track/stt"),
  lion: (q) => (q ? `https://lionparcel.com/track/stt?q=${q}` : "https://lionparcel.com/track/stt"),
  jne: () => "https://www.jne.co.id/tracking-package",
  jnt: () => "https://jet.co.id/track",
  "j&t": () => "https://jet.co.id/track",
  sicepat: () => "https://www.sicepat.com/checkAwb",
  paxel: () => "https://paxel.co/id/lacak-pengiriman",
  anteraja: () => "https://anteraja.id/id/tracking",
  pos: () => "https://www.posindonesia.co.id/id/tracking",
  grab: () => "https://express.grab.com/track/orders",
};

export function formatCourierName(courier?: string | null, fallback = "Standard"): string {
  const raw = courier?.trim();
  if (!raw) return fallback;

  const key = raw.toLowerCase();
  if (COURIER_LABELS[key]) return COURIER_LABELS[key];

  return raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getCekResiFallbackUrl(trackingNumber?: string | null): string {
  const clean = trackingNumber?.trim();
  return clean ? `https://cekresi.com/?r=w&noresi=${encodeURIComponent(clean)}` : "https://cekresi.com/";
}

export function hasOfficialCourierTrackingWebsite(courier?: string | null): boolean {
  const key = courier?.trim().toLowerCase() ?? "";
  return Boolean(OFFICIAL_COURIER_TRACKING_URLS[key]);
}

export function getCourierTrackingUrl(courier?: string | null, trackingNumber?: string | null): string {
  const key = courier?.trim().toLowerCase() ?? "";
  const clean = trackingNumber?.trim() ?? "";
  const buildOfficialUrl = OFFICIAL_COURIER_TRACKING_URLS[key];

  if (buildOfficialUrl) {
    return buildOfficialUrl(clean ? encodeURIComponent(clean) : "");
  }

  return getCekResiFallbackUrl(clean);
}

/**
 * Resolves the external tracking website URL to open.
 * Preserves custom organizer-provided URLs (e.g. Gojek/Grab share links),
 * while upgrading missing or auto-generated cekresi.com URLs to the official courier page.
 */
export function resolveCourierTrackingUrl(
  courier?: string | null,
  trackingNumber?: string | null,
  savedTrackingUrl?: string | null,
): string | undefined {
  const saved = savedTrackingUrl?.trim();
  const isCekResiUrl = Boolean(saved && /^https?:\/\/(www\.)?cekresi\.com/i.test(saved));

  if (saved && !isCekResiUrl) {
    return saved;
  }

  if (trackingNumber?.trim() || hasOfficialCourierTrackingWebsite(courier)) {
    return getCourierTrackingUrl(courier, trackingNumber);
  }

  return saved || undefined;
}
