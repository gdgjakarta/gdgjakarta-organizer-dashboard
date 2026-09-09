import { getBevyChapterEvents } from "@/lib/bevy/client";
import { getFirestoreEvents } from "@/lib/firestore/client";
import type { FirestoreEvent } from "@/lib/firestore/types";

import { MemberEventsList } from "./_components/member-events-list";

export const dynamic = "force-dynamic";

export default async function MemberDashboardPage() {
  let events: FirestoreEvent[] = [];

  try {
    const fetched = await getFirestoreEvents(50);
    if (fetched.length > 0) {
      events = fetched;
    } else {
      const bevy = await getBevyChapterEvents();
      events = (bevy?.results ?? []).map((e) => ({
        id: String(e.id),
        title: e.title || "Untitled Event",
        description: e.description,
        description_short: e.description_short,
        status: (e.status as FirestoreEvent["status"]) || "Published",
        start_date: e.start_date || new Date().toISOString(),
        end_date: e.end_date || e.start_date || new Date().toISOString(),
        picture_url: e.picture?.thumbnail_url || e.picture?.url,
        banner_url: e.banner?.url,
        event_type_title: e.event_type_title || "Standard Event",
        audience_type: e.audience_type || (e.is_virtual_event ? "VIRTUAL" : "IN_PERSON"),
        is_virtual: Boolean(e.is_virtual_event || e.audience_type === "VIRTUAL"),
        url: e.url,
        static_url: e.static_url,
        tags: e.tags || [],
        requires_approval: false,
        total_registrations: e.total_attendees ?? 0,
        total_approved: e.total_attendees ?? 0,
        total_checked_in: e.checkin_count ?? 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.error("[Member Dashboard] Failed to load events:", error);
  }

  return (
    <div className="flex h-full flex-col p-4 md:p-6 lg:p-8">
      <MemberEventsList events={events} myRegistrations={[]} />
    </div>
  );
}
