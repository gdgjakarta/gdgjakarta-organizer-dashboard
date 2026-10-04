import type { Metadata } from "next";

import { BEVY_CONFIG } from "@/config/bevy-config";
import { organizers as fallbackOrganizers } from "@/data/organizers";
import {
  getAllEvents,
  getBevyChapterMembers,
  getBevyChapterSlim,
  getChapterTeam,
  isEventActive,
} from "@/lib/bevy/client";
import type { FirestoreEvent, FirestoreMember } from "@/lib/firestore/types";

import { GDGKpiCards } from "./_components/gdg-kpi-cards";
import { GDGUpcomingEvents } from "./_components/gdg-upcoming-events";
import { OrganizerHeader } from "./_components/organizer-header";
import { type CommunityOrganizerItem, RecentMembersWidget } from "./_components/recent-members-widget";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home",
  description: "GDG Jakarta organizer dashboard overview and quick actions.",
};

export default async function Page() {
  let events: FirestoreEvent[] = [];
  let members: FirestoreMember[] = [];
  let organizersList: CommunityOrganizerItem[] = [];
  let totalEventsCount: number | undefined;
  let totalMembersCount: number | undefined;
  let activeEventsCount = 0;

  try {
    const [eventsResponse, teamMembers, membersResponse, chapterSlim] = await Promise.all([
      getAllEvents(BEVY_CONFIG.chapterId, false, "All"),
      getChapterTeam(BEVY_CONFIG.chapterId),
      getBevyChapterMembers(undefined, 50, 1),
      getBevyChapterSlim(),
    ]);

    const rawEvents = eventsResponse?.results ?? [];
    totalEventsCount = eventsResponse?.count ?? rawEvents.length;
    totalMembersCount = chapterSlim?.members_count ?? membersResponse?.count;

    events = rawEvents
      .filter((e) => !e.is_hidden && !(e as { hidden?: boolean }).hidden)
      .map((e) => ({
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
        is_hidden: Boolean(e.is_hidden || (e as { hidden?: boolean }).hidden),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

    activeEventsCount = events.filter(isEventActive).length;

    // Map Chapter Team from Bevy
    const teamMap = new Map<string, string>();
    for (const tm of teamMembers) {
      const email = tm.user?.email?.toLowerCase();
      const userId = tm.user?.id ? String(tm.user.id) : String(tm.user_id || "");
      let roleTitle = "Organizer";
      if (tm.title?.trim()) {
        roleTitle = tm.title.trim();
      } else if (typeof tm.role === "object" && tm.role !== null && "name" in tm.role && tm.role.name) {
        roleTitle = tm.role.name;
      } else if (typeof tm.role === "string" && tm.role) {
        roleTitle = tm.role;
      }
      if (email) teamMap.set(email, roleTitle);
      if (userId) teamMap.set(`id:${userId}`, roleTitle);
    }

    organizersList = teamMembers.map((tm, idx) => {
      const email = tm.user?.email || "";
      let userId = String(tm.user_id || idx);
      if (tm.id) {
        userId = String(tm.id);
      } else if (tm.user?.id) {
        userId = `${tm.user.id}-${idx}`;
      }

      let roleTitle = "Organizer";
      if (tm.title?.trim()) {
        roleTitle = tm.title.trim();
      } else if (typeof tm.role === "object" && tm.role !== null && "name" in tm.role && tm.role.name) {
        roleTitle = tm.role.name;
      } else if (typeof tm.role === "string" && tm.role) {
        roleTitle = tm.role;
      }

      const name =
        tm.user?.full_name?.trim() ||
        [tm.user?.first_name, tm.user?.last_name].filter(Boolean).join(" ").trim() ||
        "Community Organizer";

      const avatarUrl = tm.user?.cropped_avatar_url || tm.user?.avatar?.url || tm.user?.avatar?.thumbnail_url;

      return {
        id: userId,
        name,
        email,
        company: tm.user?.company || tm.user?.title,
        role: roleTitle,
        avatar_url: avatarUrl,
      };
    });

    // Fallback if teamMembers is empty
    if (organizersList.length === 0 && fallbackOrganizers.length > 0) {
      organizersList = fallbackOrganizers.map((o, idx) => ({
        id: `fallback-org-${idx}`,
        name: o.name,
        email: `${o.name.toLowerCase().replace(/[^a-z0-9]/g, ".")}@gdgjakarta.org`,
        role: o.role,
        avatar_url: o.avatar,
      }));
    }

    const now = new Date().toISOString();
    members = (membersResponse?.results ?? []).map((m) => {
      const email = m.user.email || `user_${m.user.id}@community.dev`;
      const userId = String(m.user.id);
      const organizerRole = teamMap.get(email.toLowerCase()) ?? teamMap.get(`id:${userId}`) ?? undefined;

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

      <GDGKpiCards
        events={events}
        members={members}
        totalEventsCount={totalEventsCount}
        totalMembersCount={totalMembersCount}
        activeEventsCount={activeEventsCount}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <GDGUpcomingEvents events={events} />
        </div>
        <div className="xl:col-span-5">
          <RecentMembersWidget organizers={organizersList} members={members} />
        </div>
      </div>
    </div>
  );
}
