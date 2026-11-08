import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";
import { isAuthorizedOrganizerSession } from "@/server/auth-guard";
import { getSystemHealthConfigServer, getSystemHealthSnapshotAction } from "@/server/system-health-actions";

import { SystemHealthDashboard } from "./_components/system-health-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `System Health - ${APP_CONFIG.name}`,
  description:
    "Monitor n8n, PostgreSQL, and GoWA container health, RAM/Swap/Volume telemetry, and manage container restarts & updates.",
};

export default async function Page() {
  const isAuthorized = await isAuthorizedOrganizerSession();
  if (!isAuthorized) {
    redirect("/dashboard/organizer");
  }

  const [initialConfig, initialSnapshot] = await Promise.all([
    getSystemHealthConfigServer(),
    getSystemHealthSnapshotAction(),
  ]);

  return <SystemHealthDashboard initialConfig={initialConfig} initialSnapshot={initialSnapshot} />;
}
