import { ChapterRole } from "@/lib/bevy/types";

export interface UserRoleLike {
  role?: string | null;
  chapterRole?: string | null;
  chapterRoleType?: ChapterRole | null;
  roleId?: number | null;
}

/**
 * Checks whether user belongs to Core Team, Team Member, or Check-in Staff.
 */
export function isCoreTeamOrStaff(userOrRole?: UserRoleLike | string | null, chapterRole?: string | null): boolean {
  if (!userOrRole) return false;

  if (typeof userOrRole === "string") {
    const r = userOrRole.toLowerCase().trim();
    const cr = (chapterRole ?? "").toLowerCase().trim();
    return (
      r === "core_team" ||
      r === "core-team" ||
      r === "core team" ||
      r === "check_in_staff" ||
      r === "checkin_staff" ||
      r === "check-in staff" ||
      r === "team_member" ||
      r === "team-member" ||
      r === "team member" ||
      cr.includes("core team") ||
      cr.includes("team member") ||
      cr.includes("check-in") ||
      cr.includes("checkin") ||
      cr.includes("staff")
    );
  }

  const { role, chapterRole: cr, chapterRoleType, roleId } = userOrRole;
  if (chapterRoleType === ChapterRole.CORE_TEAM || roleId === 2 || roleId === 3) {
    return true;
  }

  return isCoreTeamOrStaff(role, cr);
}

/**
 * Checks whether user is an executive chapter organizer (Lead Organizer, Co-Organizer, Organizer, Googler).
 */
export function isExecutiveOrganizer(userOrRole?: UserRoleLike | string | null): boolean {
  if (!userOrRole) return false;
  if (isCoreTeamOrStaff(userOrRole)) return false;

  const roleStr = typeof userOrRole === "string" ? userOrRole : userOrRole.role;
  const lower = (roleStr ?? "").toLowerCase().trim();

  if (typeof userOrRole !== "string") {
    if (userOrRole.chapterRoleType === ChapterRole.ORGANIZER || userOrRole.chapterRoleType === ChapterRole.GOOGLER) {
      return true;
    }
    if (userOrRole.roleId === 1 || userOrRole.roleId === 4) {
      return true;
    }
  }

  return lower === "organizer" || lower === "googler" || lower === "admin";
}

/**
 * Checks whether user has staff/organizer permissions (either Executive Organizer or Core Team/Staff).
 */
export function hasTeamOperationalAccess(userOrRole?: UserRoleLike | string | null): boolean {
  return isExecutiveOrganizer(userOrRole) || isCoreTeamOrStaff(userOrRole);
}

/**
 * Resolves the default dashboard home path for given user or role.
 * Organizers land on /dashboard/organizer.
 * Core Team, Team Member, Check-in Staff, and Community Members land on /dashboard/member.
 */
export function getDashboardHomeUrl(userOrRole?: UserRoleLike | string | null): string {
  if (isExecutiveOrganizer(userOrRole)) {
    return "/dashboard/organizer";
  }
  return "/dashboard/member";
}
