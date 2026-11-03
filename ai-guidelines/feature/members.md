# Members & Core Team Management Feature

This guide outlines community member management, Core Team verification, role assignments, and directory synchronization in the **GDG Jakarta Organizer Dashboard**.

---

## 1. Overview & Scope

The Members feature maintains the complete community roster for GDG Jakarta:

1. **Community Directory**: Listing of registered GDG chapter members with profile details and registration histories.
2. **Core Team Roster**: Chapter organizers, co-organizers, event leads, and volunteers with assigned administrative responsibilities.
3. **Role & Team Assignment**: Elevation of community members to Core Team status (`POST /chapter/{id}/team/`).
4. **Member Sync Engine**: Pulling updated member records from Bevy into Firestore (`syncBevyMembersToFirestore`).

---

## 2. API Endpoints & Role Management

### 2.1 Fetch & Search Chapter Members
- **Endpoint**: `GET /chapter/{chapterId}/member/`
- **Query Params**: `page_size=200`, `page=1`, `order_by=user` (or `-created_date`).
- **Response**: `BevyMembersResponse` containing array of `BevyChapterMember` and `chapter_member_key`.
- **Full Chapter Search (Algolia)**: Bevy's `/chapter/{chapterId}/member/` REST endpoint does not filter by search query; instead, Bevy uses Algolia (`{index_prefix}_chapter_member_index_{index_suffix}` from `GET /api/config/algolia/` with `chapter_member_key`). `searchBevyChapterMembers` (`src/lib/bevy/client.ts`) and `searchBevyChapterMembersAction` (`src/server/bevy-actions.ts`) query this index (`filters: chapter_id={chapterId}`) and merge matching members into the `/dashboard/members` table alongside the full Firestore `members` collection (`getFirestoreMembers()`).

### 2.2 Core Team Management Endpoints & Dashboard UI
- **Fetch Team**: `GET /chapter/{chapterId}/team/` (`getBevyChapterTeams()` / `fetchBevyChapterTeamsAction()`)
- **Find User by Email**: `GET /api/user/{email}` (`getMemberById()` / `findBevyUserByEmailAction()`)
- **Add Team Member**: `POST /chapter/{chapterId}/team/` (`addBevyChapterTeamMember()` / `addBevyChapterTeamMemberAction()`)
  - Requires `Referer: https://gdg.community.dev/dashboard/{chapterSlug}/settings/team` and `Auth-Type: AUTHORIZED`
  - Body: `{ first_name, last_name, role: 1|2|3, visible, send_chapter_team_emails, title, user }`
- **Update Role/Visibility**: `PUT /chapter/{chapterId}/team/{teamMemberId}/` (`updateBevyChapterTeamMember()` / `updateBevyChapterTeamMemberAction()`)
  - Requires `Referer: https://gdg.community.dev/dashboard/{chapterSlug}/settings/team` and `Auth-Type: AUTHORIZED`
  - Body: `{ email, first_name, last_name, role: 1|2|3, visible, send_chapter_team_emails, title, user, chapter }`
- **Remove Team Member**: `DELETE /chapter/{chapterId}/team/{teamId}/` (`deleteBevyChapterTeamMember()` / `deleteBevyChapterTeamMemberAction()`)
  - Requires `Referer: https://gdg.community.dev/dashboard/{chapterSlug}/settings/team` and `Auth-Type: AUTHORIZED`
- **Dashboard UI (`/dashboard/members?tab=team` & `/dashboard/team`)**:
  - `ChapterTeamTab`: Roster cards with avatar, hidden icon (`EyeOff`), role badges, masked email (`d**********@gmail.com`), search filter, edit action, and delete trigger.
  - `AddTeamMemberDialog`: Stepwise modal with email search, verified user preview card (`#3386524`), 3-way role segmented buttons (`Organizer`, `Team Member`, `Check-in Staff`), visibility and email toggles.
  - `EditTeamMemberDialog`: Pre-populated edit modal for updating name, title, role, visibility, and email settings.
  - `DeleteTeamMemberDialog`: Destructive confirmation dialog before revoking team access.

### 2.3 Available Chapter Roles (`GET /chapter_role/`)
- **Organizer**: Full administrative access across events, tickets, and team management.
- **Co-Organizer**: Collaborative access to create and manage events.
- **Event Lead**: Scoped management for assigned events.
- **Volunteer / Core Team Member**: Check-in and scanning permissions on event days.

---

## 3. Firestore Synchronization (`members` Collection)

The sync service consolidates Bevy member records and team roles:
- Maps `m.user.id` to Firestore document ID.
- Resolves organizer role titles by cross-referencing `getBevyChapterTeams()`.
- Assigns `team: "Core Team"` for organizers and `team: "Community"` for general members.
- Updates metadata timestamp in `sync_metadata/bevy`.
