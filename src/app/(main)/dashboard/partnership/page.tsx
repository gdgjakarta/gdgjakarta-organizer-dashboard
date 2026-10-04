import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { PartnershipDashboard } from "./_components/partnership-dashboard";

export const metadata: Metadata = {
  title: `Partnership & Sponsorship Management - ${APP_CONFIG.name}`,
  description:
    "Adjust and configure DevFest partnership tiers, deliverables, and sponsorship inquiry settings from the Organizer Dashboard.",
};

export default function Page() {
  return <PartnershipDashboard />;
}
