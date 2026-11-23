"use client";

import * as React from "react";

import { usePathname } from "next/navigation";

import { subscribePrinterConfigDoc, subscribeRecentPrintQueue } from "@/lib/firestore/client";
import { DEFAULT_PRINTER_CONFIG } from "@/lib/printers/templates";
import type { PrinterConfig, PrintJob } from "@/lib/printers/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { readPersistedStationRunning, STATION_RUNNING_STORAGE_KEY, usePrintStation } from "./use-print-station";

/**
 * Background Print Station Runner (`Weakness A` fix):
 * Mounted in the main dashboard layout so that once an organizer clicks "Start Print Station" on `/dashboard/printers`,
 * navigating to `/dashboard/events/[eventId]` (or any other dashboard page) does NOT stop the print station listener
 * or drop its heartbeat.
 * When `/dashboard/printers` is open, `PrintersDashboard` manages `usePrintStation` directly, so this runner yields.
 */
export function PrintStationGlobalRunner() {
  const pathname = usePathname();
  const isOnPrintersPage = pathname?.startsWith("/dashboard/printers") ?? false;
  const [isStationRunning, setIsStationRunning] = React.useState(false);

  React.useEffect(() => {
    setIsStationRunning(readPersistedStationRunning());

    const handleCustomChange = (e: Event) => {
      const custom = e as CustomEvent<{ running?: boolean }>;
      if (typeof custom.detail?.running === "boolean") {
        setIsStationRunning(custom.detail.running);
      } else {
        setIsStationRunning(readPersistedStationRunning());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STATION_RUNNING_STORAGE_KEY) {
        setIsStationRunning(readPersistedStationRunning());
      }
    };

    window.addEventListener("gdg-print-station-running-change", handleCustomChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("gdg-print-station-running-change", handleCustomChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  if (isOnPrintersPage || !isStationRunning) {
    return null;
  }

  return <ActiveBackgroundPrintStation />;
}

function ActiveBackgroundPrintStation() {
  const user = useAuthStore((s) => s.user);
  const [config, setConfig] = React.useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);
  const [recentJobs, setRecentJobs] = React.useState<PrintJob[]>([]);

  React.useEffect(() => {
    const unsubConfig = subscribePrinterConfigDoc((updated) => {
      setConfig(updated);
    });
    const unsubRecent = subscribeRecentPrintQueue(25, (jobs) => {
      setRecentJobs(jobs);
    });
    return () => {
      unsubConfig();
      unsubRecent();
    };
  }, []);

  usePrintStation({
    isStationRunning: true,
    userEmail: user?.email,
    selectedEventId: config.selected_event_id,
    widthMm: config.paper_width_mm,
    heightMm: config.paper_height_mm,
    orientation: config.orientation,
    bluetoothDensity: config.bluetooth_density,
    bluetoothGapMm: config.bluetooth_gap_mm,
    recentJobs,
  });

  return null;
}
