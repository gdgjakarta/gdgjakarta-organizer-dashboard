import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";
import { DEFAULT_PRINTER_CONFIG } from "@/lib/printers/templates";
import type { PrinterConfig } from "@/lib/printers/types";
import { isAuthorizedOrganizerSession } from "@/server/auth-guard";
import { getFirestoreDoc } from "@/server/firestore-admin";

import { PrintersDashboard } from "./_components/printers-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Printers & Label Station - ${APP_CONFIG.name}`,
  description: "Configure thermal label printers, customize badge HTML templates, and run the automated print station.",
};

export default async function Page() {
  const isAuthorized = await isAuthorizedOrganizerSession();
  if (!isAuthorized) {
    redirect("/dashboard/organizer");
  }

  let initialConfig: PrinterConfig = DEFAULT_PRINTER_CONFIG;
  try {
    const remoteData = await getFirestoreDoc("system_settings", "printer");
    if (remoteData) {
      initialConfig = { ...DEFAULT_PRINTER_CONFIG, ...(remoteData as Partial<PrinterConfig>) };
    }
  } catch (err) {
    console.warn("[Printers Page] Failed to fetch printer config from Firestore REST:", err);
  }

  return <PrintersDashboard initialConfig={initialConfig} />;
}
