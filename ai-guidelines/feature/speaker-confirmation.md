# Speaker Confirmation & Handbook Feature

## Overview
Replaces external Google Form and Google Sheets polling workflows with a native, event-bound Speaker Confirmation system in the GDG Jakarta Organizer Dashboard.

Features:
1. **Event-bound Speaker Confirmation Form (`/events/[eventId]/speaker-confirmation?token=spk_...`)**:
   - Collects speaker details: Full Name, Email, WhatsApp, Job Title, Company/Institution, LinkedIn/Social, Avatar/Photo URL.
   - Collects talk details: Talk Title, Talk Type (Keynote, Lightning Talk, Technical 30m/45m, Workshop, Panel), Google Ecosystem.
   - Collects logistics: Presentation Slides URL (Google Slides), Unisex T-shirt size / custom swags, Dietary restrictions.
   - Gated by unguessable event share token (`spk_...`) stored in `events/{eventId}.speaker_config.share_token`.
   - **Self-Service Response Editing**: Uses deterministic document IDs (`spkconf_${eventId}_${sanitizedEmail}`) so speakers who already submitted can either click **Edit Response** on the confirmation screen, re-submit with the same email, or use **Load My Response** by email to prefill and update their submitted details.
2. **Instant Speaker Invitation Email**:
   - Dispatched immediately upon confirmation submission via n8n (`/webhook/api/send-email`).
   - Styled session card containing speaker full name, talk title, talk type, event date, venue location with Google Maps URL, and direct link to the event's interactive Speaker Handbook.
3. **Interactive Speaker Handbook (`/events/[eventId]/speaker-handbook?token=spk_...`)**:
   - Markdown format with full HTML fallback and live preview in the dashboard.
   - Official 16:9 widescreen Google / GDG slide deck templates:
     - GDG Default Template: `https://gdgjakarta.org/gdg-slide-template`
     - DevFest 2026 Template: `https://gdgjakarta.org/devfest26-speaker-template`
     - Optional custom slide template URL configurable per event.
4. **Google Calendar Automation via n8n**:
   - Direct binding to centralized n8n webhook API (`https://n8n.gdgjakarta.com/webhook/api/speaker-calendar-invite`) authenticated via `x-api-key: N8N_WEBHOOK_API_KEY`. No manual per-event organizer configuration required.
   - Automatically creates Google Calendar event on `info@gdgjakarta.org` if it does not exist yet.
   - Dispatches Google Calendar invite to the speaker's email address matching the session stage time.
5. **Dashboard Speakers Management (`/dashboard/events/[eventId]` -> Speakers Tab)**:
   - Roster table with speaker avatar (`speaker_profile_url`), confirmation search, slide preview links, invitation status badges, **View Details** modal (`Eye` action to inspect the complete submitted form response), and resend actions.
   - 1-click sync to Bevy People roster via session spoofing (`POST /api/person/` and `PATCH /api/person/{id}/`).
   - Split-pane Monaco markdown editor with desktop/mobile live preview to customize the event's Speaker Handbook.
   - Settings tab to enable/disable confirmation submissions, toggle presentation templates, and configure n8n webhooks.
