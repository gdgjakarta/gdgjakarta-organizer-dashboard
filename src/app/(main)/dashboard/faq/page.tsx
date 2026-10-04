import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { FaqDashboard } from "./_components/faq-dashboard";

export const metadata: Metadata = {
  title: `FAQ & Policy Management - ${APP_CONFIG.name}`,
  description: "Configure and adjust FAQ items, anti-fraud notices, and categories from the Organizer Dashboard.",
};

export default function Page() {
  return <FaqDashboard />;
}
