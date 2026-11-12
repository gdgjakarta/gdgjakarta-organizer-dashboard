export interface ChangelogItem {
  category: "Added" | "Fixed" | "Improved" | "Changed";
  text: string;
}

export interface ChangelogRelease {
  version: string;
  releaseDate: string;
  title: string;
  badge?: "Latest" | "Major" | "Update";
  items: ChangelogItem[];
}

/**
 * Structured releases mirroring CHANGELOG.md for zero-latency client/edge rendering.
 */
export const CHANGELOG_RELEASES: ChangelogRelease[] = [
  {
    version: "1.0.20",
    releaseDate: "2026-11-12",
    title: "Member Merge System & Bulk Bevy Sync",
    badge: "Latest",
    items: [
      {
        category: "Added",
        text: "Added individual and bulk duplicate member merge tools on the Members page with automatic cluster detection, registration re-linking, and clean secondary doc deletion.",
      },
      {
        category: "Added",
        text: "Added chapter-wide bulk sync button to refresh members and chapter team roster directly from Bevy into Firestore.",
      },
      {
        category: "Fixed",
        text: "Eliminated synthetic fallback Bevy User IDs in auth resolution to ensure unsynced accounts are cleanly marked as not synced and prevent ID collisions.",
      },
    ],
  },
  {
    version: "1.0.16",
    releaseDate: "2026-11-12",
    title: "Regional Lead & Community Manager Dashboard Access",
    badge: "Latest",
    items: [
      {
        category: "Fixed",
        text: "Normalized Bevy roleId=4 (Googler / Regional Lead) and custom titles (e.g. Community Manager) to executive organizer permissions.",
      },
      {
        category: "Fixed",
        text: "Ensured Community Managers and Regional Leads have full access to view event registrants, check-ins, and analytics on dashboard.",
      },
      {
        category: "Improved",
        text: "Added defensive session and Firestore doc guards so legacy sessions self-heal without requiring manual re-login.",
      },
    ],
  },
  {
    version: "1.0.15",
    releaseDate: "2026-11-11",
    title: "Transactions & QRIS Dashboard and Bulk Verification",
    items: [
      {
        category: "Added",
        text: "Real-time Transactions & QRIS Payments dashboard with DOKU webhook ingest and email status tracking.",
      },
      {
        category: "Added",
        text: "Individual and bulk live DOKU payment status checking with audit trail and auto-reconciliation.",
      },
      {
        category: "Improved",
        text: "Standardized table filtration container, status pill selectors, and batch action toolbar matching registrants tab.",
      },
    ],
  },
  {
    version: "1.0.14",
    releaseDate: "2026-11-11",
    title: "Agenda Slide Autofill & Domain Standard",
    badge: "Update",
    items: [
      {
        category: "Fixed",
        text: "Autofill presentation slides URL from confirmed speaker data with manual override support.",
      },
      {
        category: "Fixed",
        text: "Synchronize speaker confirmation session slot and slides URL when binding agenda activities.",
      },
      {
        category: "Fixed",
        text: "Updated speaker handbook links across invitation emails and templates to canonical gdgjakarta.com.",
      },
      {
        category: "Added",
        text: "Enforced domain usage standard reserving gdgjakarta.org strictly for Short.io redirects and gdgjakarta.com for web applications.",
      },
    ],
  },
  {
    version: "1.0.13",
    releaseDate: "2026-11-09",
    title: "Cloudflare Workers SSR Stream Hang Fix",
    badge: "Update",
    items: [
      {
        category: "Fixed",
        text: "Resolved Cloudflare Workers request cancellation by inlining NEXT_PUBLIC_FIREBASE_API_KEY into Next.js env and restoring resilient server-side resolution.",
      },
    ],
  },
  {
    version: "1.0.12",
    releaseDate: "2026-11-09",
    title: "Observability Issues & Config Hardening",
    badge: "Update",
    items: [
      {
        category: "Added",
        text: "Enabled real-time Issues tracking under Cloudflare Workers observability in wrangler.jsonc.",
      },
      {
        category: "Improved",
        text: "Enforced strict environment variable loading for Firebase configuration and synchronized wrangler variables.",
      },
    ],
  },
  {
    version: "1.0.11",
    releaseDate: "2026-11-09",
    title: "In-Person Event Creation Fix",
    badge: "Update",
    items: [
      {
        category: "Fixed",
        text: "Fixed in-person event creation failure by omitting virtual event fields from the Bevy payload for IN_PERSON events.",
      },
    ],
  },
  {
    version: "1.0.10",
    releaseDate: "2026-11-09",
    title: "Event Creation & Feedback Dialog Polish",
    badge: "Update",
    items: [
      {
        category: "Fixed",
        text: "Unchecked 'Show event on chapter page', 'Disable social sharing', and 'Allow automated emails' options by default during event creation.",
      },
      {
        category: "Fixed",
        text: "Added responsive spacing between Cancel and Give Feedback actions in the feedback modal.",
      },
    ],
  },
  {
    version: "1.0.9",
    releaseDate: "2026-11-09",
    title: "Jakarta e2-medium Migration & Container Logs Dialog Fix",
    badge: "Update",
    items: [
      {
        category: "Improved",
        text: "Migrated gdg-jakarta-automation stack to a 4 GB RAM (e2-medium) GCP instance in asia-southeast2-a (Jakarta) with gdg-gateway edge reverse proxy support.",
      },
      {
        category: "Fixed",
        text: "Fixed Docker container logs popup dialog width constraint on screens above 640px to ensure wide terminal display.",
      },
    ],
  },
  {
    version: "1.0.8",
    releaseDate: "2026-11-09",
    title: "Changelog Dialog Polish",
    badge: "Update",
    items: [
      {
        category: "Improved",
        text: "Cleaned up What's New / Changelog dialog UI by removing bottom action bar to maximize content view.",
      },
    ],
  },
  {
    version: "1.0.7",
    releaseDate: "2026-11-09",
    title: "System Health Redesign & HTML Error Inspection",
    badge: "Update",
    items: [
      {
        category: "Added",
        text: "One-click HTML Error Page inspection for public service health probes and Docker Ops Agent.",
      },
      {
        category: "Added",
        text: "Streamlined organizer System Health dashboard with real-time status chips and modal settings configuration.",
      },
      {
        category: "Improved",
        text: "Redesigned Auto-refresh toggle button with live pulsing status indicator and mono interval badge.",
      },
      {
        category: "Improved",
        text: "Added explicit Settings trigger action to manage public service URLs and probe parameters.",
      },
    ],
  },
  {
    version: "1.0.6",
    releaseDate: "2026-11-09",
    title: "Agenda Sync, Copy Agenda & System Health",
    badge: "Update",
    items: [
      {
        category: "Added",
        text: "Unified Agenda & Breakout Sessions synchronization with Bevy API live sessions.",
      },
      {
        category: "Added",
        text: "Interactive Copy Agenda Dialog to duplicate schedules across stages and dates.",
      },
      {
        category: "Added",
        text: "System Health Dashboard (/dashboard/health) with live Docker container metrics, logs, and 1-click PostgreSQL backup.",
      },
      {
        category: "Added",
        text: "Event Tags Input and rich Google Maps pinpoint picker for venue addresses.",
      },
      {
        category: "Improved",
        text: "Short link button generation for event URLs with instant click-to-copy.",
      },
      {
        category: "Improved",
        text: "Expanded date and time pickers with intuitive wheel and keyboard selection.",
      },
    ],
  },
  {
    version: "1.0.5",
    releaseDate: "2026-11-08",
    title: "Events Directory Search & Ticket Badges",
    badge: "Update",
    items: [
      {
        category: "Added",
        text: "Instant search and find features on the public events directory page (/events).",
      },
      {
        category: "Added",
        text: "Dynamic my-events email link interpolation with live attendee authentication context.",
      },
      {
        category: "Fixed",
        text: "Prevented ticket tier badge text from clipping and overflow on smaller cards.",
      },
      {
        category: "Fixed",
        text: "Ensured consistent ticket status badges across member event views.",
      },
    ],
  },
  {
    version: "1.0.4",
    releaseDate: "2026-11-07",
    title: "Voucher Cleanup & Event Hyperlinks",
    badge: "Update",
    items: [
      {
        category: "Added",
        text: "Automatic bundle voucher cleanup upon registration cancellation, deleting unredeemed friend vouchers.",
      },
      {
        category: "Added",
        text: "Pre-filled Bevy highlight video URL and enabled opening recap video in a new tab.",
      },
      {
        category: "Fixed",
        text: "Enforced styled blue hyperlinks and target='_blank' on public event description content.",
      },
      {
        category: "Fixed",
        text: "Hardened Firestore security rules for partner voucher redemptions and registration records.",
      },
    ],
  },
  {
    version: "1.0.3",
    releaseDate: "2026-11-04",
    title: "Chapter Team Management & Algolia Search",
    badge: "Update",
    items: [
      {
        category: "Added",
        text: "Full-chapter member search powered by Bevy's Algolia index across all chapter members.",
      },
      {
        category: "Added",
        text: "Dedicated Chapter Team Management tab with Add, Edit, and Delete team member dialogs.",
      },
      {
        category: "Added",
        text: "Real-time member sync with Bevy user lookup by email.",
      },
      {
        category: "Improved",
        text: "Display unmasked email addresses for verified organizers and check-in staff.",
      },
      {
        category: "Improved",
        text: "Masked emails in team roster table for attendees and privacy protection.",
      },
    ],
  },
  {
    version: "1.0.2",
    releaseDate: "2026-11-03",
    title: "Breakout Sessions & Delivery Counters",
    badge: "Update",
    items: [
      {
        category: "Added",
        text: "Merchandise delivery counters in event header and tabs (<total> Merchandise Delivery (<pending> pending)).",
      },
      {
        category: "Added",
        text: "Loading shimmer skeletons for breakout session registrant rosters.",
      },
      {
        category: "Added",
        text: "WhatsApp direct message and quick copy actions to breakout session attendee rosters.",
      },
      {
        category: "Added",
        text: "Preserved breakout session states during agenda edits and saves.",
      },
      {
        category: "Fixed",
        text: "Replaced nested scroll areas with native scroll containers to fix link truncation in links manager.",
      },
      {
        category: "Fixed",
        text: "Expanded bulk link action dialog sizing to prevent modal clipping.",
      },
      {
        category: "Fixed",
        text: "Excluded static partner fields from dynamic sponsorship tier parsing.",
      },
    ],
  },
  {
    version: "1.0.1",
    releaseDate: "2026-11-03",
    title: "Fulfillment Timeline & Recording Links",
    badge: "Update",
    items: [
      {
        category: "Added",
        text: "Configurable merchandise fulfillment and production timelines (lead time & courier shipping weeks).",
      },
      {
        category: "Added",
        text: "Attendee fulfillment announcement notes on registration and order dialogs.",
      },
      {
        category: "Added",
        text: "Automatic virtual stream button transition to 'View Recording' when event concludes.",
      },
      {
        category: "Added",
        text: "Excluded test and hidden events from public and member event listings.",
      },
      {
        category: "Fixed",
        text: "Handled Bevy pagination using pagination.next_page URL parameter.",
      },
      {
        category: "Fixed",
        text: "Adjusted event detail header counters to full width with drop percentage positioning.",
      },
    ],
  },
  {
    version: "1.0.0",
    releaseDate: "2026-11-02",
    title: "Maps Delivery, Variant Exchange & Printers",
    badge: "Major",
    items: [
      {
        category: "Added",
        text: "Google Maps interactive pinpointing and direct location link for merchandise delivery addresses.",
      },
      {
        category: "Added",
        text: "Merchandise variant exchange support on on-the-spot attendee item collection.",
      },
      {
        category: "Added",
        text: "Refund and delivery flows for uncollected merchandise post-event.",
      },
      {
        category: "Added",
        text: "Label Station and thermal printer setup configuration with local worker download guidance.",
      },
      {
        category: "Added",
        text: "Main Event default session selection and distinctive Bevy RSVP tags.",
      },
      {
        category: "Improved",
        text: "Moved merchandise delivery fee configuration into an organizer modal dialog.",
      },
      {
        category: "Improved",
        text: "Added entropy and deduplication for fallback attendee merchandise status logs.",
      },
    ],
  },
];

export const CURRENT_APP_VERSION = CHANGELOG_RELEASES[0]?.version ?? "1.0.5";
export const FIRST_SEEN_CUTOFF_DATE = "2026-11-02";
export const LAST_SEEN_VERSION_STORAGE_KEY = "gdg_last_seen_app_version";

/**
 * Compare two semantic versions (e.g., "1.0.3" and "1.0.5").
 * Returns:
 *  - negative if v1 < v2
 *  - 0 if v1 === v2
 *  - positive if v1 > v2
 */
export function compareSemver(v1: string, v2: string): number {
  const cleanV1 = v1.replace(/^v/, "").trim();
  const cleanV2 = v2.replace(/^v/, "").trim();

  const parts1 = cleanV1.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const parts2 = cleanV2.split(".").map((n) => Number.parseInt(n, 10) || 0);

  const length = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < length; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 !== p2) {
      return p1 - p2;
    }
  }
  return 0;
}

/**
 * Filter changelog releases:
 * - If lastSeenVersion is null or empty (first time opening):
 *   Return all releases from FIRST_SEEN_CUTOFF_DATE onwards.
 * - If lastSeenVersion is provided:
 *   Return releases where version > lastSeenVersion (up to latest).
 */
export function getChangelogDiff(lastSeenVersion: string | null): ChangelogRelease[] {
  if (!lastSeenVersion) {
    return CHANGELOG_RELEASES.filter((r) => r.releaseDate >= FIRST_SEEN_CUTOFF_DATE);
  }

  return CHANGELOG_RELEASES.filter((r) => compareSemver(r.version, lastSeenVersion) > 0);
}
