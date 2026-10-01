# Events Feature

This guide outlines event management, Bevy-to-Firestore synchronization, event registration workflows, and live attendance metrics in the **GDG Jakarta Organizer Dashboard**.

---

## 1. Overview & Dual-Persona Capabilities

The Events feature serves both community members and chapter organizers:

- **Admin / Organizer**:
  - View all past, live, and upcoming chapter events.
  - Trigger one-click synchronization from Bevy API into Firestore.
  - Configure registration requirements (e.g. toggle `requires_approval`).
  - Attach custom registration questions (`custom_questions: CustomQuestion[]`).
  - Monitor real-time check-in and RSVP progress bars.
  - Select an active event for live on-site scanner operations.

- **Member / User**:
  - Browse published GDG Jakarta events with rich details, venue maps, and schedules.
  - Filter events by type (In-Person, Virtual, Hybrid) and category (Workshop, Study Jam, etc.).
  - Register directly for events with modal questionnaires (`EventRegistrationModal`).
  - Track personal registration approval status (`pending`, `approved`, `waitlisted`).

---

## 2. Architecture & Data Flow

```
Bevy Platform (GET /chapter/{id}/event/)
                  │
                  ▼
         src/server/bevy-actions.ts
                  │
                  ▼
    src/lib/firestore/sync-service.ts
    (Merges upstream events into Firestore `events` collection)
                  │
                  ▼
         Firestore Client (`events`)
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
Organizer Dashboard   Member Event Hub & Modal
(/dashboard/events)   (/events & EventRegistrationModal)
```

---

## 3. Key Components & Files

1. **Pages & Routes**:
   - `src/app/(main)/dashboard/events/page.tsx`: Organizer events table and card view.
   - `src/app/(external)/events/page.tsx`: Public / Member event catalog.
   - `src/components/calendar/event-calendar-views.tsx`: Interactive monthly/weekly event calendar.

2. **Components**:
   - `src/components/event-registration-modal.tsx`: Interactive modal for member registration, handling ticket selection and dynamic custom questions.
   - `src/app/(main)/dashboard/events/_components/`:
     - `events-table.tsx`: Sortable data table with status badges and attendee counters.
     - `event-sync-button.tsx`: Triggers `triggerEventsSyncAction()`.
     - `event-card.tsx`: Visual preview card with banner, date pill, and actions.

3. **Data & Server Actions**:
   - `src/server/bevy-actions.ts`: `fetchBevyChapterEventsAction(pageSize, page)`.
   - `src/lib/firestore/actions.ts`:
     - `triggerEventsSyncAction()`
     - `registerForEventAction(registration)`
     - `checkEventRegistrationAction(eventId, memberId, email)`
   - `src/lib/firestore/client.ts`: `getFirestoreEvents()`, `getFirestoreEventById()`, `saveFirestoreEvent()`.

---

## 4. Custom Questions Schema

Organizers can attach custom questionnaire schemas to events stored in Firestore:

```typescript
export interface CustomQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox";
  options?: string[];
  required: boolean;
  placeholder?: string;
}
```

When a member registers, their answers are validated and stored in the `event_registrations.answers` document object.
