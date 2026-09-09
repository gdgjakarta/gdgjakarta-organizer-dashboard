import { format, parseISO } from "date-fns";

import { getBevyChapterMembers, getBevyChapterTeams } from "@/lib/bevy/client";
import { getFirestoreMembers } from "@/lib/firestore/client";

import { members as fallbackMembers, type MemberRow } from "./_components/data";
import { Members } from "./_components/members";

export const dynamic = "force-dynamic";

export default async function Page() {
  let memberRows: MemberRow[] = [];
  let totalCount: number | undefined;

  try {
    // 1. Try reading from Firestore cache first
    const firestoreMembers = await getFirestoreMembers(200);

    if (firestoreMembers.length > 0) {
      totalCount = firestoreMembers.length;
      memberRows = firestoreMembers.map((m, index) => {
        let joinedDateFormatted = "Recent";
        if (m.joined_date) {
          try {
            joinedDateFormatted = format(parseISO(m.joined_date), "dd MMM yyyy, h:mm a");
          } catch {
            joinedDateFormatted = m.joined_date;
          }
        }

        let lastActiveMinutes = 3000;
        if (index < 5) {
          lastActiveMinutes = 0;
        } else if (index < 15) {
          lastActiveMinutes = 120;
        }

        return {
          id: m.id,
          name: m.name || "Community Member",
          email: m.email,
          role: m.role || "Member",
          status: m.status || "Active",
          team: m.team || "Community",
          workspace: ["GDG Jakarta"],
          joinedDate: joinedDateFormatted,
          lastActive: lastActiveMinutes,
          avatarUrl: m.avatar_url,
          eventsCount: m.events_registered_count ?? 0,
        };
      });
    } else {
      // 2. Fallback to direct Bevy API if Firestore is not yet populated
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
    }
  } catch (error) {
    console.error("[Members Page] Error loading members:", error);
  }

  // Fallback if no records returned or API fails
  if (memberRows.length === 0) {
    memberRows = fallbackMembers;
  }

  return <Members members={memberRows} totalCount={totalCount} />;
}
