import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { FeaturedEventDashboard } from "./_components/featured-event-dashboard";

export const metadata: Metadata = {
  title: `Homepage Featured Event - ${APP_CONFIG.name}`,
  description: "Configure the featured event spotlight and autoplay video on the GDG Jakarta public homepage.",
};

export default function Page() {
  return <FeaturedEventDashboard />;
}
