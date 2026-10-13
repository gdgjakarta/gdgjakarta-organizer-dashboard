import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { fetchFeaturedEventBevyListAction, type PublishedEventOption } from "./_actions/fetch-bevy-events";
import { FeaturedEventDashboard } from "./_components/featured-event-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Homepage Featured Event - ${APP_CONFIG.name}`,
  description: "Configure the featured event spotlight and autoplay video on the GDG Jakarta public homepage.",
};

export default async function Page() {
  let initialEvents: PublishedEventOption[] = [];
  try {
    const res = await fetchFeaturedEventBevyListAction();
    if (res.success && res.events) {
      initialEvents = res.events;
    }
  } catch (err) {
    console.warn("[FeaturedEventPage] Could not prefetch Bevy events on server:", err);
  }

  return <FeaturedEventDashboard initialEvents={initialEvents} />;
}
