# Repository & Data Layer Architecture

This guide details the dual-source **Repository & Data Layer architecture** implemented in the **GDG Jakarta Organizer Dashboard**, bridging upstream Bevy REST endpoints with local Cloud Firestore real-time collections.

---

## 1. Architectural Overview

The dashboard employs a **Dual-Source Repository Pattern**:

```
┌─────────────────────────────────────────────────────────┐
│                      Client UI                          │
│   (Server Components, Client Views, Modals, Tables)     │
└────────────┬───────────────────────────────┬────────────┘
             │ (Read/Write)                  │ (Sync/Check)
┌────────────▼──────────────┐   ┌────────────▼────────────┐
│   Server Actions Layer    │   │  Client Firestore Layer │
│   src/server/             │   │  src/lib/firestore/     │
│   ├── auth-actions.ts     │   │  ├── client.ts (CRUD)   │
│   ├── bevy-actions.ts     │   │  ├── sync-service.ts    │
│   └── server-actions.ts   │   │  └── actions.ts         │
└────────────┬──────────────┘   └────────────┬────────────┘
             │                               │
┌────────────▼──────────────┐                │ (Batch writes)
│    Remote Bevy Client     │                │
│    src/lib/bevy/client.ts ├────────────────┘
└────────────┬──────────────┘
             │ Direct HTTPS (Session Spoofing)
┌────────────▼──────────────┐
│        Bevy API           │
│  (gdg.community.dev/api)  │
└───────────────────────────┘
```

---

## 2. Responsibilities of Upstream vs. Local Storage

| Capability | Upstream Bevy API | Cloud Firestore Database |
|---|---|---|
| **Official Event Metadata** | Source of truth for published GDG events | Cached copy (`events` collection) with extended attributes |
| **Official Check-In State** | Authoritative on-site check-in via `PUT /attendee/checkin/` | Mirrors check-in timestamp (`checked_in_at`, `total_checked_in`) |
| **Core Team Permissions** | Source of truth for chapter organizers (`/chapter/{id}/team/`) | Cached member profile with role & team assignment |
| **Custom Questionnaires** | Unsupported on Bevy basic forms | Stored in `events.custom_questions` and `event_registrations.answers` |
| **Registration Approval Pipeline** | Binary RSVP on Bevy | Multi-stage pipeline (`pending` -> `approved` / `rejected` / `waitlisted`) |
| **Offline Resilience** | Unavailable if network fails | Local snapshot listener & indexed document caching |

---

## 3. Remote Data Layer (`src/lib/bevy/client.ts`)

The Bevy client encapsulates direct HTTP communications with Bevy's private endpoints:

### 3.1 Fetch Wrapper (`bevyFetch`)
- Automatically applies `Accept: application/json; version=bevy.1.0`.
- Injects `Cookie` and `X-Csrftoken` from `BEVY_CONFIG`.
- Implements `cache: "no-store"` for real-time validation checks.

### 3.2 Core Bevy Repository Methods
```typescript
// Fetch events for chapter
export async function getBevyChapterEvents(chapterId?: string, pageSize?: number, page?: number): Promise<BevyEventsResponse | null>

// Fetch full event details including agenda and registration URLs
export async function getBevyEventById(eventId: string | number): Promise<BevyEvent | null>

// Fetch chapter community members
export async function getBevyChapterMembers(chapterId?: string, pageSize?: number, page?: number): Promise<BevyMembersResponse | null>

// Fetch Core Team organizers
export async function getBevyChapterTeams(chapterId?: string): Promise<BevyChapterTeamMember[]>

// Lookup Bevy user by email or ID
export async function getBevyUserByEmail(email: string): Promise<BevyUser | null>

// Validate organizer permissions against chapter team
export async function validateBevyOrganizer(email: string, displayName?: string): Promise<OrganizerValidationResult>
```

---

## 4. Firestore Database Layer (`src/lib/firestore/client.ts`)

Direct Firestore operations are executed from the client to ensure broad compatibility across browser environments without Node.js edge runtime protobuf limitations.

### 4.1 Collections Schema
1. **`events`**:
   - Primary Key: `eventId` (String matching Bevy Event ID).
   - Fields: `title`, `start_date`, `end_date`, `status`, `picture_url`, `banner_url`, `requires_approval`, `total_registrations`, `total_approved`, `total_checked_in`, `custom_questions`.
2. **`members`**:
   - Primary Key: `userId` (String matching Bevy User ID or Firebase UID).
   - Fields: `name`, `email`, `role`, `chapter_role`, `team` (`"Core Team"` | `"Community"`), `status`, `events_registered_count`.
3. **`event_registrations`**:
   - Primary Key: `${eventId}_${memberId}`.
   - Fields: `event_id`, `event_title`, `member_id`, `member_name`, `member_email`, `status` (`pending`, `approved`, `rejected`, `waitlisted`, `attended`), `answers`, `registered_at`, `reviewed_at`, `reviewed_by_id`.
4. **`sync_metadata`**:
   - Primary Key: `"bevy"`.
   - Fields: `last_synced_events_at`, `last_synced_members_at`, `total_events_synced`, `total_members_synced`, `status` (`"idle"` | `"syncing"` | `"success"` | `"error"`).

---

## 5. Synchronization Engine (`src/lib/firestore/sync-service.ts`)

The synchronization engine performs batch upserts from Bevy into Firestore using `writeBatch(db)`:

### 5.1 Preservation of Local Fields
When syncing events or members from Bevy, local customizations (e.g. `requires_approval`, `custom_questions`, approval counters) must **never be overwritten**. The sync service achieves this via:
```typescript
// Clean undefined fields and merge with existing documents
batch.set(docRef, cleanPayload(rawEventPayload), { merge: true });
```

### 5.2 Atomic Commit & Status Updates
After writing all records in a batch, the engine updates `sync_metadata/bevy`:
```typescript
await batch.commit();
await updateSyncMetadata({
  last_synced_events_at: now,
  total_events_synced: bevyEvents.length,
  status: "success",
});
```

---

## 6. Server Actions & Cache Invalidation

Mutating actions trigger selective path revalidations using Next.js Server Actions:

```typescript
// src/server/server-actions.ts
"use server";
import { revalidatePath } from "next/cache";

export async function revalidateDashboardPath(path: string) {
  revalidatePath(path);
}
```

Whenever an attendee is checked in, registered, or approved:
1. Perform write to Firestore or Bevy API.
2. Call `revalidateDashboardPath("/dashboard/events")`.
3. Call `revalidateDashboardPath("/dashboard/organizer")`.
4. Return typed `ActionResult` with feedback for Sonner toast.
