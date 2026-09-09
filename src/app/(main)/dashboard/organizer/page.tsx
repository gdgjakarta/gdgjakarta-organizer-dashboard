import { getFirestoreEvents, getFirestoreMembers } from "@/lib/firestore/client";

import { GDGKpiCards } from "./_components/gdg-kpi-cards";
import { GDGUpcomingEvents } from "./_components/gdg-upcoming-events";
import { OrganizerHeader } from "./_components/organizer-header";
import { RecentMembersWidget } from "./_components/recent-members-widget";

export const dynamic = "force-dynamic";

export default async function Page() {
  let events = [];
  let members = [];

  try {
    const [fetchedEvents, fetchedMembers] = await Promise.all([getFirestoreEvents(50), getFirestoreMembers(50)]);
    events = fetchedEvents;
    members = fetchedMembers;
  } catch (error) {
    console.error("[Organizer Dashboard] Error fetching Firestore data:", error);
  }

  return (
    <div className="flex flex-col gap-5">
      <OrganizerHeader />

      <GDGKpiCards events={events} members={members} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <GDGUpcomingEvents events={events} />
        </div>
        <div className="xl:col-span-5">
          <RecentMembersWidget members={members} />
        </div>
      </div>
    </div>
  );
}
