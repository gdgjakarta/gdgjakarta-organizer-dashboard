import type { Metadata } from "next";

import {
  fetchFeaturedEventBevyListAction,
  type PublishedEventOption,
} from "@/app/(main)/dashboard/featured-event/_actions/fetch-bevy-events";
import { APP_CONFIG } from "@/config/app-config";

import { PartnershipDashboard } from "./_components/partnership-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Partnership & Sponsorship Management - ${APP_CONFIG.name}`,
  description:
    "Adjust and configure featured event spotlight, partnership tiers, deliverables, and sponsorship inquiry settings from the Organizer Dashboard.",
};

export default async function Page() {
  let initialEvents: PublishedEventOption[] = [];
  try {
    const res = await fetchFeaturedEventBevyListAction();
    if (res.success && res.events) {
      initialEvents = res.events;
    }
  } catch (err) {
    console.warn("[PartnershipPage] Could not prefetch Bevy events on server:", err);
  }

  return <PartnershipDashboard initialEvents={initialEvents} />;
}
