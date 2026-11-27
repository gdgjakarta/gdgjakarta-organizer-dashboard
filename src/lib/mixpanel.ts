import mixpanel from "mixpanel-browser";

export const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let isInitialized = false;

/**
 * Initializes the Mixpanel SDK in the browser.
 * Safe to call multiple times (idempotent).
 */
export function initMixpanel(): void {
  if (typeof window === "undefined" || isInitialized) return;
  if (!MIXPANEL_TOKEN) {
    console.warn("[Mixpanel] Token not found. Skipping initialization.");
    return;
  }

  const rawReplayPercent = Number(process.env.NEXT_PUBLIC_MIXPANEL_REPLAY_PERCENT);
  const replayPercent = Number.isFinite(rawReplayPercent) ? Math.min(100, Math.max(0, rawReplayPercent)) : 0;

  mixpanel.init(MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV !== "production",
    track_pageview: true,
    persistence: "localStorage",
    record_heatmap_data: false,
    autocapture: false,
    record_sessions_percent: replayPercent,
  });

  isInitialized = true;
}

/**
 * Tracks a custom event in Mixpanel.
 */
export function trackMixpanelEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !isInitialized) return;
  try {
    mixpanel.track(eventName, properties);
  } catch (err) {
    console.warn(`[Mixpanel] Error tracking event "${eventName}":`, err);
  }
}

/**
 * Associates subsequent events with a specific identified user ID and sets user properties.
 */
export function identifyMixpanelUser(userId: string, traits?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !isInitialized) return;
  try {
    mixpanel.identify(userId);
    if (traits && Object.keys(traits).length > 0) {
      mixpanel.people.set(traits);
    }
  } catch (err) {
    console.warn("[Mixpanel] Error identifying user:", err);
  }
}

/**
 * Clears user identity and resets Mixpanel state (useful on sign out).
 */
export function resetMixpanelUser(): void {
  if (typeof window === "undefined" || !isInitialized) return;
  try {
    mixpanel.reset();
  } catch (err) {
    console.warn("[Mixpanel] Error resetting user:", err);
  }
}

export default mixpanel;
