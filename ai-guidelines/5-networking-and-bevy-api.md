# Networking & Bevy API Session Spoofing

This document provides the definitive, comprehensive API specification, authentication mechanics, session spoofing architecture, and endpoint catalog for the **Bevy Community Platform** (`gdg.community.dev`) as used across **KawalEvent** and the **GDG Jakarta Organizer Dashboard**.

---

## 1. Domain Context & Background

**Google Developer Groups (GDG)** chapters host and manage their community operations and events on the **Bevy** platform ([gdg.community.dev](https://gdg.community.dev/)).

GDG operations managed via Bevy include:
- Publishing and scheduling chapter events.
- Tracking registrations and ticket tiers.
- Managing Core Team roster and organizer roles.
- Conducting on-site operations (verifying attendees, real-time check-in, walk-in registrations).

---

## 2. Why Session Spoofing is Required

Bevy does not currently provide a public, OAuth2-authenticated REST API for external third-party applications. To allow custom mobile applications (KawalEvent) and web organizer dashboards (this project) to manage chapter events directly:

1. The application interfaces directly with Bevy's private/internal API endpoints located at `https://gdg.community.dev/api/`.
2. Requests are authenticated by **Session Spoofing** using authenticated browser cookies and tokens extracted by chapter organizers.
3. Bevy's internal Django route guards enforce strict **CSRF**, **Cookie**, and **Referer** validation on mutating requests (`POST`, `PUT`, `DELETE`). Without matching headers, requests fail with `403 Forbidden` or `401 Unauthorized`.

---

## 3. Required Headers & Authentication Structure

Every HTTP request to Bevy API endpoints must supply the following headers:

| Header Name | Value / Format | Requirement | Notes |
|---|---|---|---|
| `Accept` | `application/json; version=bevy.1.0` | **Mandatory** | Required for all Bevy v1 API responses. |
| `Content-Type` | `application/json` | **Mandatory** for POST/PUT | JSON payload serialization. |
| `User-Agent` | `GDGJakarta-Dashboard/1.0.0` | **Mandatory** | Identifies client requests. |
| `Cookie` | `csrftoken=<token>; sessionid=<sessionid>` | **Authorized Endpoints** | Valid session cookie extracted from an authenticated organizer browser session. |
| `X-Csrftoken` | `<csrftoken>` | **Mutating & Authorized** | Must match the `csrftoken` value in the `Cookie` header. |
| `Referer` | See Referer URLs below | **Mutating Requests** (`PUT`, `POST`, `DELETE`) | Bevy rejects mutating requests if the Referer does not match the expected web path. |

### 3.1 Dynamic Referer URL Rules
Bevy's route guards validate the HTTP `Referer` header against the caller's context:

1. **Event & Attendee Operations** (`PUT /attendee/checkin/`, `POST /attendee/`):
   ```
   https://gdg.community.dev/events/details/google-gdg-{chapterSlug}/?event={eventId}
   ```
   *Example for GDG Jakarta (eventId 12345):*
   `https://gdg.community.dev/events/details/google-gdg-jakarta/?event=12345`

2. **Chapter Team Operations** (`POST /chapter/{id}/team/`, `PUT /chapter/{id}/team/{teamId}/`, `DELETE ...`):
   ```
   https://gdg.community.dev/dashboard/{chapterSlug}/settings/team
   ```
   *Example for GDG Jakarta:*
   `https://gdg.community.dev/dashboard/gdg-jakarta/settings/team`

---

## 4. Environment Configuration

All Bevy integration settings are configured via environment variables and initialized in `src/config/bevy-config.ts`:

```typescript
export const BEVY_CONFIG = {
  baseUrl: process.env.BEVY_API_BASE_URL || "https://gdg.community.dev/api",
  chapterSlug: process.env.BEVY_CHAPTER_SLUG || "gdg-jakarta",
  chapterId: process.env.BEVY_CHAPTER_ID || "642",
  apiToken: process.env.BEVY_API_TOKEN,
  csrfToken: process.env.BEVY_CSRF_TOKEN,
  cookie: process.env.BEVY_COOKIE,
};
```

---

## 5. Complete Bevy API Endpoint Catalog

### 5.1 Regions & Chapters

#### 1. `GET /chapter_region/`
- **Auth**: Anonymous / Public.
- **Description**: Returns all geographical GDG regions worldwide.
- **Response**: `List<RegionResponse>`
  ```json
  [
    { "id": 1, "order": 1, "title": "Asia / Oceania" }
  ]
  ```

#### 2. `GET /chapter_region/{regionId}/`
- **Auth**: Anonymous / Public.
- **Description**: Returns all chapters within a specific region.
- **Response**: `ChapterResponse` with nested `chapters` array.

#### 3. `GET /chapter/{chapterId}/`
- **Auth**: Public or Session-authorized.
- **Description**: Returns chapter details, title, city, member count, and nested `chapter_team` list.

---

### 5.2 Chapter Team & Roles (Organizer Verification)

#### 1. `GET /chapter/{chapterId}/team/`
- **Auth**: Session-authorized (`Cookie`).
- **Description**: Lists all official core team members, chapter leaders, and assigned roles. Used during post-login sync to verify organizer permissions.
- **Response**:
  ```json
  {
    "count": 12,
    "results": [
      {
        "id": 987,
        "title": "Lead Organizer",
        "role": { "id": 1, "name": "Organizer", "description": "Full chapter permissions" },
        "user": {
          "id": 12345,
          "full_name": "Fachridan T.M",
          "email": "fachridan@example.com",
          "avatar": { "url": "https://..." }
        }
      }
    ]
  }
  ```

#### 2. `POST /chapter/{chapterId}/team/`
- **Auth**: Session-authorized.
- **Requires Header**: `Referer: https://gdg.community.dev/dashboard/{chapterSlug}/settings/team`
- **Request Body**:
  ```json
  {
    "first_name": "John",
    "last_name": "Doe",
    "role": 1,
    "visible": true,
    "send_chapter_team_emails": true,
    "title": "Co-Organizer",
    "user": "54321"
  }
  ```

#### 3. `PUT /chapter/{chapterId}/team/{teamId}/`
- **Auth**: Session-authorized + `Referer`.
- **Request Body**: `UpdateChapterTeamMemberRequest`.

#### 4. `DELETE /chapter/{chapterId}/team/{teamId}/`
- **Auth**: Session-authorized + `Referer`.
- **Response**: `204 No Content`.

#### 5. `GET /chapter_role/`
- **Auth**: Session-authorized.
- **Description**: Returns all available roles (Organizer, Co-Organizer, Event Lead, Volunteer).

---

### 5.3 Community Members & Users

#### 1. `GET /chapter/{chapterId}/member/`
- **Auth**: Session-authorized.
- **Query Parameters**:
  - `page_size` (e.g. 200)
  - `page` (e.g. 1)
  - `order_by` (`"user"`, `"-created_date"`)
- **Response**: `BevyMembersResponse` containing `results: BevyChapterMember[]`.

#### 2. `GET /user/{userId}/`
- **Auth**: Session-authorized.
- **Parameters**: `userId` (Accepts numerical Bevy ID or URL-encoded email address).
- **Query Parameters**: `fields` (Comma-separated field list).
- **Response**: `BevyUser` details object.

---

### 5.4 Events

#### 1. `GET /event/`
- **Auth**: Public or Session-authorized.
- **Query Parameters**:
  - `chapter` (`chapterId`, e.g. `642`)
  - `order_by` (e.g. `"-start_date"`)
  - `page_size` (e.g. 100)
  - `page` (e.g. 1)
  - `search` (Search query string)
  - `event_type` (Event type slug)
- **Response**: `BevyEventsResponse` (`results: BevyEvent[]`).

#### 2. `GET /event_type/`
- **Auth**: Public.
- **Description**: Lists event categories (e.g. Workshop, Speaker Session, Hackathon, Study Jam).

#### 3. `GET /event/{eventId}/`
- **Auth**: Public or Session-authorized.
- **Query Parameters**: `include_agenda=true`
- **Response**: Detailed `EventDetailResponse` including venue, speaker lineup, sponsor logos, and capacity metrics.

---

### 5.5 Attendee Check-In & Operations

#### 1. `GET /event/{eventId}/attendee/`
- **Auth**: Session-authorized.
- **Requires Header**: `Referer: https://gdg.community.dev/events/details/google-gdg-{chapterSlug}/?event={eventId}`
- **Query Parameters**:
  - `order_by` (`"first_name"`, `"-created_date"`, `"-checkin_date"`)
  - `page_size` (e.g. 100)
  - `page` (e.g. 1)
- **Response**: `BaseResultsResponse<AttendeeResponse>`.

#### 2. `GET /attendee_search/`
- **Auth**: Session-authorized + `Referer`.
- **Query Parameters**:
  - `event` (`eventId`)
  - `search` (Attendee name, email, or ticket code)
  - `order_by` (e.g. `"first_name"`)
  - `page_size` (e.g. 20)
- **Response**: `BaseResultsResponse<AttendeeSearchItemResponse>`.

#### 3. `GET /attendee/{attendeeId}/`
- **Auth**: Session-authorized.
- **Description**: Retrieves single attendee profile, ticket details, survey answers, and check-in timestamp.

#### 4. `PUT /attendee/checkin/` (Check-In & Undo Check-In)
- **Auth**: Session-authorized.
- **Requires Header**: `Referer: https://gdg.community.dev/events/details/google-gdg-{chapterSlug}/?event={eventId}`
- **Request Body**:
  ```json
  {
    "event": 12345,
    "chapter": 642,
    "attendees": [
      {
        "id": 78910,
        "is_checked_in": true
      }
    ]
  }
  ```
- **Undo Operation**: Send `"is_checked_in": false` to reverse check-in.
- **Response**:
  ```json
  {
    "event": 12345,
    "attendees": [
      {
        "id": 78910,
        "is_checked_in": true
      }
    ]
  }
  ```

#### 5. `POST /attendee/` (Walk-In Doorstep Registration)
- **Auth**: Session-authorized.
- **Requires Header**: `Referer: https://gdg.community.dev/events/details/google-gdg-{chapterSlug}/?event={eventId}`
- **Query Parameters**: `event={eventId}&chapter={chapterId}`
- **Request Body**:
  ```json
  {
    "event": 12345,
    "attendees": [
      {
        "first_name": "Alice",
        "last_name": "Smith",
        "email": "alice@example.com",
        "send_event_email": true
      }
    ]
  }
  ```
- **Response**: `List<AttendeeResponse>` with created attendee and ticket ID.

---

## 6. Error Codes & Exception Handling

| Error Code | HTTP Status | Meaning | Resolution |
|---|---|---|---|
| `ERR406001` | `406 Not Acceptable` | **Attendee Already Checked In** | Display relative check-in timestamp warning; prompt user if undo is intended. |
| `ERR404001` | `404 Not Found` | **Attendee Not Found** | Query did not match any attendee in event roster. Check query or register as walk-in. |
| `401 Unauthorized` | `401 Unauthorized` | **Invalid or Expired Cookie** | Bevy session expired. Update `BEVY_COOKIE` in environment or Remote Config. |
| `403 Forbidden` | `403 Forbidden` | **CSRF or Referer Mismatch** | Verify `X-Csrftoken` matches `Cookie` and `Referer` URL matches event/team path. |
