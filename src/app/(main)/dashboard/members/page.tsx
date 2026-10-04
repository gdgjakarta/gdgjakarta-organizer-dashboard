import { format, parseISO } from "date-fns";
import type { Metadata } from "next";

import { getBevyChapterMembers, getBevyChapterTeams } from "@/lib/bevy/client";
import { splitFullName } from "@/lib/utils";

import { members as fallbackMembers, type MemberRow } from "./_components/data";
import { Members } from "./_components/members";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Members",
  description: "Manage GDG Jakarta community members, attendees, and organizers.",
};

export default async function Page() {
  let memberRows: MemberRow[] = [];
  let totalCount: number | undefined;

  try {
    const [teamMembers, membersResponse] = await Promise.all([
      getBevyChapterTeams(),
      getBevyChapterMembers(undefined, 200, 1, "-created_date"),
    ]);

    totalCount = membersResponse?.count;

    interface TeamInfo {
      roleTitle: string;
      avatarUrl?: string;
      company?: string;
    }
    const teamMap = new Map<string, TeamInfo>();
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

      const teamInfo: TeamInfo = {
        roleTitle,
        avatarUrl: tm.user?.avatar?.url || tm.user?.avatar?.thumbnail_url,
        company: tm.user?.company,
      };

      if (email) teamMap.set(email, teamInfo);
      if (userId) teamMap.set(`id:${userId}`, teamInfo);
    }

    const fetchedMembers = membersResponse?.results || [];

    if (fetchedMembers.length > 0) {
      memberRows = fetchedMembers.map((m) => {
        const email = m.user.email || `user_${m.user.id}@community.dev`;
        const userId = String(m.user.id);
        const teamInfo = teamMap.get(email.toLowerCase()) || teamMap.get(`id:${userId}`) || null;
        const organizerRole = teamInfo?.roleTitle || null;
        const displayName = m.user.full_name?.trim() || email.split("@")[0] || "Community Member";
        const { firstName, lastName } = splitFullName(m.user.full_name?.trim() || displayName);

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

        return {
          id: m.id || m.user.id,
          bevyUserId: m.user.id,
          name: displayName,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          email: email,
          role: role,
          status: "Active" as const,
          team: team,
          joinedDate: joinedDateFormatted,
          rawCreatedDate: m.created_date,
          avatarUrl: teamInfo?.avatarUrl || m.user.avatar?.url,
          eventsCount: m.events_registered_count ?? 0,
          profileUrl: m.user.profile_url,
          isEmailVerified: Boolean(m.user.is_email_verified),
          company: teamInfo?.company,
          syncStatus: "synced" as const,
        };
      });
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
