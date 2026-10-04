"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  applyFeatureFlags,
  DEFAULT_FEATURE_FLAGS,
  type FeatureFlagsConfig,
  findItemFlag,
  parseFeatureFlags,
} from "@/config/feature-flags";
import { REMOTE_CONFIG_KEYS } from "@/config/remote-config-keys";
import type { NavBadge, NavGroup } from "@/navigation/sidebar/sidebar-items";

let currentFlags: FeatureFlagsConfig = DEFAULT_FEATURE_FLAGS;
let isInitialized = false;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): FeatureFlagsConfig {
  return currentFlags;
}

function getServerSnapshot(): FeatureFlagsConfig {
  return DEFAULT_FEATURE_FLAGS;
}

async function initRemoteConfigFeatureFlags() {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  try {
    const { remoteConfig } = await import("@/config/firebase");
    if (!remoteConfig) return;

    const { activate, fetchAndActivate, getValue, onConfigUpdate } = await import("firebase/remote-config");

    // Fetch and activate latest configuration from Firebase Remote Config
    await fetchAndActivate(remoteConfig).catch((_err) => {
      // Ignore initial background fetch activation errors
    });

    const val = getValue(remoteConfig, REMOTE_CONFIG_KEYS.FEATURE_FLAGS).asString();
    if (val?.trim()) {
      currentFlags = parseFeatureFlags(val);
      emitChange();
    }

    // Subscribe to real-time Remote Config updates when published from Firebase Console
    try {
      onConfigUpdate(remoteConfig, {
        next: async () => {
          await activate(remoteConfig).catch(() => {
            /* no-op */
          });
          const updatedVal = getValue(remoteConfig, REMOTE_CONFIG_KEYS.FEATURE_FLAGS).asString();
          if (updatedVal?.trim()) {
            currentFlags = parseFeatureFlags(updatedVal);
            emitChange();
          }
        },
        error: (err) => {
          console.warn("[useFeatureFlags] Remote Config update listener error:", err);
        },
        complete: () => {
          /* no-op */
        },
      });
    } catch {
      // Real-time listener fallback if not supported in the current environment
    }
  } catch (err) {
    console.warn("[useFeatureFlags] Failed to initialize Remote Config flags:", err);
  }
}

/**
 * Custom React hook to access dynamic feature flags configured in Firebase Remote Config.
 * Supports realtime config updates and synchronized UI updates across the entire application.
 */
export function useFeatureFlags() {
  const flags = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void initRemoteConfigFeatureFlags();
  }, []);

  const isVisible = useCallback(
    (idOrTitle: string) => {
      const flag = findItemFlag(idOrTitle, idOrTitle, undefined, flags);
      return flag?.visible !== false;
    },
    [flags],
  );

  const getBadge = useCallback(
    (idOrTitle: string): NavBadge | undefined => {
      const flag = findItemFlag(idOrTitle, idOrTitle, undefined, flags);
      if (!flag || !("badge" in flag)) return undefined;
      const badge = flag.badge;
      if (badge === null || badge === "" || badge === "none") return undefined;
      return badge;
    },
    [flags],
  );

  const isDisabled = useCallback(
    (idOrTitle: string): boolean | undefined => {
      const flag = findItemFlag(idOrTitle, idOrTitle, undefined, flags);
      return flag?.disabled;
    },
    [flags],
  );

  const filterNavItems = useCallback(
    (groups: readonly NavGroup[]): NavGroup[] => {
      return applyFeatureFlags(groups, flags);
    },
    [flags],
  );

  return {
    flags,
    isVisible,
    getBadge,
    isDisabled,
    filterNavItems,
  };
}
