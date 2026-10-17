"use client";

import { type ReactNode, useEffect, useState } from "react";

import { usePathname } from "next/navigation";

import type { MaintenanceConfig } from "@/config/maintenance-config";
import { isExecutiveOrganizer } from "@/lib/auth-roles";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { MaintenanceBanner } from "./maintenance-banner";
import { MaintenanceScreen } from "./maintenance-screen";

interface MaintenanceGateProps {
  initialConfig: MaintenanceConfig;
  initialIsOrganizer?: boolean;
  children: ReactNode;
}

const EXEMPT_PREFIXES = ["/dashboard/maintenance", "/auth", "/api"];

function isExemptPath(path?: string | null): boolean {
  if (!path) return false;
  return EXEMPT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function MaintenanceGate({ initialConfig, initialIsOrganizer = false, children }: MaintenanceGateProps) {
  const [config, setConfig] = useState<MaintenanceConfig>(initialConfig);
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  // Determine whether current user is an Executive Organizer (with client fallback to initial cookie state)
  const isOrganizer = user ? isExecutiveOrganizer(user) : initialIsOrganizer;

  // Real-time synchronization with Firestore
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const { subscribeMaintenanceConfigDoc } = await import("@/lib/firestore/client");
        if (!isMounted) return;
        unsubscribe = subscribeMaintenanceConfigDoc((updated) => {
          if (isMounted) {
            setConfig(updated);
          }
        });
      } catch (err) {
        console.warn("[MaintenanceGate] Realtime subscription warning:", err);
      }
    })();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  // If maintenance mode is not active, render normally
  if (!config.enabled) {
    return <>{children}</>;
  }

  // Exempt routes (such as /dashboard/maintenance to allow toggling, or /auth/login to sign in)
  if (isExemptPath(pathname)) {
    return <>{children}</>;
  }

  // If Organizer Bypass is permitted and current user is an Executive Organizer:
  // Render content with an Organizer notification banner on top
  if (config.allowOrganizerBypass && isOrganizer) {
    return (
      <div className="flex min-h-screen flex-col">
        <MaintenanceBanner />
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  // All other users and routes see the Maintenance Page
  return <MaintenanceScreen config={config} />;
}
