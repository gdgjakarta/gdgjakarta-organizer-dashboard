import { format, parseISO } from "date-fns";

import { getBevyChapterMembers, getBevyChapterTeams } from "@/lib/bevy/client";

import { members as fallbackMembers, type MemberRow } from "./_components/data";
import { Members } from "./_components/members";

export const dynamic = "force-dynamic";

export default async function Page() {
  let memberRows: MemberRow[] = [];
  let totalCount: number | undefined;

  try {
    // Fetch chapter team (organizers) and chapter community members in parallel
    const [teamMembers, membersResponse] = await Promise.all([
      getBevyChapterTeams(),
      getBevyChapterMembers(undefined, 200, 1),
    ]);

    totalCount = membersResponse?.count;

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

    const fetchedMembers = membersResponse?.results || [];

    if (fetchedMembers.length > 0) {
      memberRows = fetchedMembers.map((m, index) => {
        const email = m.user.email || `user_${m.user.id}@community.dev`;
        const userId = String(m.user.id);
        const organizerRole = teamMap.get(email.toLowerCase()) || teamMap.get(`id:${userId}`) || null;

        let joinedDateFormatted = "Recent";
        if (m.created_date) {
          try {
            joinedDateFormatted = format(parseISO(m.created_date), "dd MMM yyyy, h:mm a");
          } catch {
            joinedDateFormatted = m.created_date;
          }
        }

        const role = organizerRole ? organizerRole : "Member";
        const team = organizerRole ? "Core Team" : "Community";

        let lastActive = 3000;
        if (index < 5) {
          lastActive = 0;
        } else if (index < 15) {
          lastActive = 120;
        }

        return {
          id: m.id || m.user.id,
          name: m.user.full_name || "Community Member",
          email: email,
          role: role,
          status: "Active",
          team: team,
          workspace: ["GDG Jakarta"],
          joinedDate: joinedDateFormatted,
          lastActive,
          avatarUrl: m.user.avatar?.url,
          eventsCount: m.events_registered_count ?? 0,
          profileUrl: m.user.profile_url,
        };
      });
    }
  } catch (error) {
    console.error("[Members Page] Error fetching Bevy members:", error);
  }

  // Fallback if no records returned or API fails
  if (memberRows.length === 0) {
    memberRows = fallbackMembers;
  }

  return <Members members={memberRows} totalCount={totalCount} />;
}
