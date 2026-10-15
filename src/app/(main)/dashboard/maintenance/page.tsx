import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";
import { getMaintenanceConfigServer } from "@/server/firestore-admin";

import { MaintenanceDashboard } from "./_components/maintenance-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Maintenance Mode - ${APP_CONFIG.name}`,
  description: "Configure and toggle global platform maintenance mode for GDG Jakarta.",
};

export default async function Page() {
  const initialConfig = await getMaintenanceConfigServer();
  return <MaintenanceDashboard initialConfig={initialConfig} />;
}
