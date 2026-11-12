import { type Analytics, getAnalytics, isSupported, logEvent } from "firebase/analytics";

import { app } from "@/config/firebase";

import { identifyMixpanelUser, resetMixpanelUser, trackMixpanelEvent } from "./mixpanel";

let analyticsInstance: Analytics | null = null;
let isAnalyticsInitializing = false;

/**
 * Lazily initializes Firebase Analytics in a browser environment.
 */
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (analyticsInstance) return analyticsInstance;
  if (isAnalyticsInitializing) return null;

  isAnalyticsInitializing = true;
  try {
    const supported = await isSupported();
    if (supported) {
      analyticsInstance = getAnalytics(app);
    }
  } catch (err) {
    console.warn("[Analytics] Firebase Analytics initialization warning:", err);
  } finally {
    isAnalyticsInitializing = false;
  }
  return analyticsInstance;
}

/**
 * Universal telemetry event dispatcher:
 * Logs event to both Mixpanel and Firebase Analytics with sanitized properties.
 * Includes `debug_mode: true` so events immediately appear in Firebase Console DebugView.
 */
export async function trackTelemetryEvent(eventName: string, properties?: Record<string, unknown>): Promise<void> {
  if (typeof window === "undefined") return;

  // Verbose console logging for immediate local debugging
  console.log(`[Telemetry] 📡 Event: "${eventName}"`, properties ?? {});

  // 1. Dispatch to Mixpanel
  try {
    trackMixpanelEvent(eventName, properties);
  } catch (err) {
    console.warn(`[Telemetry] Mixpanel event "${eventName}" failed:`, err);
  }

  // 2. Dispatch to Firebase Analytics
  try {
    const analytics = await getFirebaseAnalytics();
    if (analytics) {
      // Firebase analytics only accepts primitive values in event params
      // Add debug_mode: true so events instantly show in Firebase DebugView
      const sanitizedParams: Record<string, string | number | boolean> = {
        debug_mode: true,
      };
      if (properties) {
        for (const [key, val] of Object.entries(properties)) {
          if (val === null || val === undefined) {
            sanitizedParams[key] = "null";
          } else if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
            sanitizedParams[key] = val;
          } else {
            sanitizedParams[key] = JSON.stringify(val);
          }
        }
      }
      logEvent(analytics, eventName, sanitizedParams);
    }
  } catch (err) {
    console.warn(`[Telemetry] Firebase Analytics event "${eventName}" failed:`, err);
  }
}

/**
 * Associates user with telemetry providers upon login or session restore.
 */
export function identifyTelemetryUser(userId: string, traits?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    identifyMixpanelUser(userId, traits);
  } catch (err) {
    console.warn("[Telemetry] Error identifying user:", err);
  }
}

/**
 * Clears telemetry state upon sign out.
 */
export function resetTelemetryUser(): void {
  if (typeof window === "undefined") return;
  try {
    resetMixpanelUser();
  } catch (err) {
    console.warn("[Telemetry] Error resetting user:", err);
  }
}
