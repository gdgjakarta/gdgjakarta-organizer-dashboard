import { getBevyChapterEvents, getBevyChapterMembers, getBevyChapterTeams } from "@/lib/bevy/client";
import type { FirestoreEvent, FirestoreMember } from "@/lib/firestore/types";

import { GDGKpiCards } from "./_components/gdg-kpi-cards";
import { GDGUpcomingEvents } from "./_components/gdg-upcoming-events";
import { OrganizerHeader } from "./_components/organizer-header";
import { RecentMembersWidget } from "./_components/recent-members-widget";

export const dynamic = "force-dynamic";

export default async function Page() {
  let events: FirestoreEvent[] = [];
  let members: FirestoreMember[] = [];

  try {
    const [eventsResponse, teamMembers, membersResponse] = await Promise.all([
      getBevyChapterEvents(undefined, 50, 1),
      getBevyChapterTeams(),
      getBevyChapterMembers(undefined, 50, 1),
    ]);

    events = (eventsResponse?.results ?? []).map((e) => ({
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

    const teamMap = new Map<string, string>();
    for (const tm of teamMembers) {
      const email = tm.user?.email?.toLowerCase();
      const userId = tm.user?.id ? String(tm.user.id) : String(tm.user_id || "");
      let roleTitle = "Organizer";
      if (typeof tm.role === "object" && tm.role !== null && "name" in tm.role && tm.role.name) {
        roleTitle = tm.role.name;
      } else if (typeof tm.role === "string" && tm.role) {
        roleTitle = tm.role;
      } else if (tm.title) {
        roleTitle = tm.title;
      }
      if (email) teamMap.set(email, roleTitle);
      if (userId) teamMap.set(`id:${userId}`, roleTitle);
    }

    const now = new Date().toISOString();
    members = (membersResponse?.results ?? []).map((m) => {
      const email = m.user.email || `user_${m.user.id}@community.dev`;
      const userId = String(m.user.id);
      const organizerRole = teamMap.get(email.toLowerCase()) || teamMap.get(`id:${userId}`) || null;

      return {
        id: userId,
        bevy_user_id: m.user.id,
        name: m.user.full_name || "Community Member",
        email,
        role: (organizerRole ? "Organizer" : "Member") as FirestoreMember["role"],
        chapter_role: organizerRole,
        team: organizerRole ? "Core Team" : "Community",
        status: "Active" as const,
        joined_date: m.created_date || now,
        avatar_url: m.user.avatar?.url,
        events_registered_count: m.events_registered_count ?? 0,
        synced_from_bevy_at: now,
        updated_at: now,
      };
    });
  } catch (error) {
    console.error("[Organizer Dashboard] Error fetching data:", error);
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
