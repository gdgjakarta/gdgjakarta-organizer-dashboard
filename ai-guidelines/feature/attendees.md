# Attendees Management & Walk-In Registration Feature

This guide details attendee directory operations, search capabilities, check-in mutations, walk-in registrations, and approval status workflows in the **GDG Jakarta Organizer Dashboard**.

---

## 1. Overview & Core Operations

The Attendees feature provides organizers with comprehensive control over event attendance and registrations:

1. **Attendee Directory**: Paginated, sortable list of all registered attendees for a selected event.
2. **Real-Time Debounced Search**: Fast query matching against attendee names, emails, and ticket identifiers.
3. **Manual Check-In (`PUT /attendee/checkin/`)**: One-tap check-in with optimistic state updates.
4. **Undo Check-In**: Instant reversal of accidental check-ins (`is_checked_in: false`).
5. **Walk-In Registration (`POST /attendee/`)**: Register doorstep attendees on live event days.
6. **Registration Review Pipeline**: Approve, reject, or waitlist pending registrations for events requiring organizer review.

---

## 2. API Endpoints & Server Action Contracts

### 2.1 Attendee Search
- **Endpoint**: `GET /attendee_search/`
- **Requires Header**: `Referer: https://gdg.community.dev/events/details/google-gdg-{chapterSlug}/?event={eventId}`
- **Parameters**: `event`, `search`, `order_by`, `page_size`.

### 2.2 Check-In & Undo Check-In
- **Endpoint**: `PUT /attendee/checkin/`
- **Requires Header**: `Referer: https://gdg.community.dev/events/details/google-gdg-{chapterSlug}/?event={eventId}`
- **Payload**:
  ```json
  {
    "event": 12345,
    "chapter": 642,
    "attendees": [
      {
        "id": 88990,
        "is_checked_in": true
      }
    ]
  }
  ```

### 2.3 Walk-In Registration
- **Endpoint**: `POST /attendee/`
- **Requires Header**: `Referer: https://gdg.community.dev/events/details/google-gdg-{chapterSlug}/?event={eventId}`
- **Query Params**: `event={eventId}&chapter={chapterId}`
- **Payload**:
  ```json
  {
    "event": 12345,
    "attendees": [
      {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "send_event_email": true
      }
    ]
  }
  ```

---

## 3. Firestore Registration Pipeline (`event_registrations`)

For events with `requires_approval === true`, registrations undergo manual organizer review:

```
[Member Submits Registration] ──► status: "pending"
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
           status: "approved"                    status: "rejected"
                    │
                    ▼
           (On Event Day Check-In)
                    │
                    ▼
           status: "attended"
```

### Review Actions (`src/lib/firestore/actions.ts`):
```typescript
await updateRegistrationStatusAction(
  registrationId,
  eventId,
  "approved", // or "rejected" / "waitlisted" / "attended"
  { id: organizerUserId, name: organizerName },
  "Reviewed and approved for general seating"
);
```

---

## 4. Key Implementation Rules

1. **Optimistic Updates**: Apply immediate local state updates in UI tables, reverting automatically if the server action returns an error.
2. **Referer Header Injection**: Ensure the dynamic event referer header is supplied on all mutating requests to prevent Bevy `403 Forbidden` errors.
3. **Double Check-In Protection**: If an attendee has already checked in, display a confirmation dialog before sending an undo check-in request.
