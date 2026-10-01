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

### 2.1 Fetch Chapter Members
- **Endpoint**: `GET /chapter/{chapterId}/member/`
- **Query Params**: `page_size=200`, `page=1`, `order_by=user`.
- **Response**: `BevyMembersResponse` containing array of `BevyChapterMember`.

### 2.2 Core Team Management Endpoints
- **Fetch Team**: `GET /chapter/{chapterId}/team/`
- **Add Team Member**: `POST /chapter/{chapterId}/team/`
  - Requires `Referer: https://gdg.community.dev/dashboard/{chapterSlug}/settings/team`
  - Body: `AddChapterTeamMemberRequest`
- **Update Role/Visibility**: `PUT /chapter/{chapterId}/team/{teamId}/`
  - Body: `UpdateChapterTeamMemberRequest`
- **Remove Team Member**: `DELETE /chapter/{chapterId}/team/{teamId}/`

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
