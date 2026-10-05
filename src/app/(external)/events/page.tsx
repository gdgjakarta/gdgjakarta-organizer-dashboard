import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";
import { BEVY_CONFIG } from "@/config/bevy-config";
import { getBevyChapterEvents } from "@/lib/bevy/client";
import type { BevyEvent } from "@/lib/bevy/types";

import { EventsDirectory } from "./_components/events-directory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events Directory",
  description:
    "Discover upcoming and past Google Developer Groups Jakarta meetups, hackathons, DevFests, hands-on codelabs, and community gatherings.",
  alternates: {
    canonical: "/events",
  },
  openGraph: {
    title: "Events Directory | GDG Jakarta",
    description:
      "Discover upcoming and past Google Developer Groups Jakarta meetups, hackathons, DevFests, hands-on codelabs, and community gatherings.",
    url: "/events",
    siteName: APP_CONFIG.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Events Directory | GDG Jakarta",
    description:
      "Discover upcoming and past Google Developer Groups Jakarta meetups, hackathons, DevFests, hands-on codelabs, and community gatherings.",
  },
};

const EVENTS_PER_PAGE = 15;

export default async function EventsDirectoryPage() {
  let initialEvents: BevyEvent[] = [];
  let totalCount = 0;

  try {
    const eventsData = await getBevyChapterEvents(BEVY_CONFIG.chapterId, EVENTS_PER_PAGE, 1, false, "Published");
    initialEvents = (eventsData?.results ?? []).filter(
      (e) => !e.is_hidden && !e.hidden && (e.status ? e.status.toLowerCase() === "published" : true),
    );
    totalCount = eventsData?.count ?? initialEvents.length;
  } catch (error) {
    console.error("[Events Directory] Failed to load events:", error);
  }

  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <h1 className="font-extrabold text-4xl tracking-tight sm:text-5xl">Events Directory</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground text-xl">
          Discover all upcoming and past events hosted by GDG Jakarta.
        </p>
      </div>

      <EventsDirectory initialEvents={initialEvents} totalCount={totalCount} pageSize={EVENTS_PER_PAGE} />
    </div>
  );
}
