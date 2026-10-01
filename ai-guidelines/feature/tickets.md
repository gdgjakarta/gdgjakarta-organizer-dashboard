# Tickets & Capacity Management Feature

This guide documents ticket tiers, registration capacity limits, questionnaire configuration, and ticket verification in the **GDG Jakarta Organizer Dashboard**.

---

## 1. Overview & Core Functions

The Tickets feature manages attendee access, tiers, and registration limits:

1. **Ticket Tiers**: Standard GDG community tiers (Free General Admission, Volunteer, Speaker/VIP, Workshop Participant).
2. **Capacity Controls**: Setting RSVP caps (`max_attendees`) to prevent venue overbooking.
3. **Approval Workflows**: Enforcing mandatory manual review (`requires_approval`) for restricted ticket tiers.
4. **Custom Questionnaires**: Attaching field requirements (dietary restrictions, T-shirt size, experience level) directly to ticket registration flows.

---

## 2. Data Schema & Integration

### 2.1 Event Capacity Fields (`FirestoreEvent`)
- `max_attendees`: Maximum capacity of the venue.
- `total_registrations`: Current total submitted registrations.
- `total_approved`: Number of attendees cleared for entry.
- `total_checked_in`: Number of attendees verified at the venue door.

### 2.2 Registration Ticket Association (`FirestoreRegistration`)
- `ticket_tier`: Selected ticket category name.
- `answers`: Key-value map of submitted answers to custom event questions.
- `status`: Verification status (`pending` -> `approved` -> `attended`).

---

## 3. Implementation Rules

1. Validate capacity limits before confirming member registrations in `registerMemberForEvent`.
2. Clearly display remaining ticket availability badges on public event pages.
3. Ensure ticket tier labels appear prominently on attendee badges in the check-in and QR scanner interfaces.
