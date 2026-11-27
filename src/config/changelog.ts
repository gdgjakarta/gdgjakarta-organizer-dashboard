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
    version: "1.0.72",
    releaseDate: "2026-11-27",
    title: "Phase 1 Full-Stack Cost Optimization",
    badge: "Latest",
    items: [
      {
        category: "Fixed",
        text: "Fixed Google Maps Pinpoint Dialog re-creating the map and reverse-geocoding on every click or drag, eliminated duplicate geocoding after Places Details and POI selections, and tightened Places Autocomplete session-token lifecycle and debouncing.",
      },
      {
        category: "Fixed",
        text: "Disabled Mixpanel debug mode, autocapture, and heatmaps in production with session replay defaulting to 0% (overridable via env), and restricted the client API fetch logger to development only.",
      },
      {
        category: "Improved",
        text: "Cached Tickets analytics in R2, switched active dashboard user counts to Firestore REST COUNT aggregation, removed public CMS realtime listeners, eliminated duplicate initial registration reads across event tabs, bounded unscoped print-station queries, and added Firestore TTL timestamps for ephemeral stream docs.",
      },
      {
        category: "Improved",
        text: "Added Cloudflare Workers Observability sampling (10% logs, 5% traces), set 31-day image cache TTL, removed the heavy googleapis dependency in favor of native fetch, lazy-loaded @aws-sdk/client-s3, routed Print Worker assets through R2 CDN, and added caching for CekResi, GA4 OAuth tokens, and Resmi.ID info.",
      },
    ],
  },
  {
    version: "1.0.71",
    releaseDate: "2026-11-26",
    title: "Event Short Link Canonical Destination Fix",
    items: [
      {
        category: "Fixed",
        text: "Updated event live-page destination URLs to gdgjakarta.com so Short.io shortlink lookups, generation, and slug updates match existing gdgjakarta.org shortlinks.",
      },
    ],
  },
  {
    version: "1.0.70",
    releaseDate: "2026-11-26",
    title: "Auth Loop Fix, Dynamic Organizer RBAC & Firestore Rules Hardening",
    items: [
      {
        category: "Fixed",
        text: "Resolved sign-in and organizer-to-member redirect loops with fail-loud session cookie signaling, O(1) UID-first session restoration, auth listener race guards, and removal of the stale /dashboard to /dashboard/admin redirect.",
      },
      {
        category: "Fixed",
        text: "Refactored Firestore security rules to eliminate 1,000-expression evaluation crashes blocking community organizers and Regional Leads, removed all hardcoded organizer email allowlists, and closed a referral-points self-update edge case.",
      },
      {
        category: "Improved",
        text: "Hardened Bevy masked-email sync matching with exact length and unique-match validation so clean Firestore emails are never overwritten by masked Bevy emails, and added transient Bevy outage fallback to verified Firestore UID documents.",
      },
    ],
  },
  {
    version: "1.0.69",
    releaseDate: "2026-11-26",
    title: "High-Concurrency Registration, Check-In & Payment Counter Hardening",
    items: [
      {
        category: "Fixed",
        text: "Enforced venue, session, ticket, bundle, and merchandise stock quotas atomically inside Firestore transactions to eliminate overselling during flash ticket drops.",
      },
      {
        category: "Fixed",
        text: "Handled mid-submit sold-out races cleanly by auto-waitlisting free events (skipping Bevy auto-approve) and rejecting paid checkouts with best-effort DOKU invoice cancellation, plus friendly retry prompts on high contention.",
      },
      {
        category: "Improved",
        text: "Replaced full-collection check-in recounts with O(1) atomic increment on check-in and clamped 1-read decrement on undo, cutting check-in Firestore reads by over 99% at DevFest scale.",
      },
      {
        category: "Fixed",
        text: "Switched DOKU payment approval and referral point counters to atomic server increments to prevent lost updates or double-counting under concurrent webhook bursts.",
      },
    ],
  },
  {
    version: "1.0.68",
    releaseDate: "2026-11-26",
    title: "Restricted Event YouTube Stream Access",
    items: [
      {
        category: "Added",
        text: "Added an organizer Stream tab on Event Details with Public and Whitelisted access modes, auto-synced approved registrant whitelists, manual email whitelists, and live viewing session monitoring with 1-click revoke.",
      },
      {
        category: "Added",
        text: "Added the public event watch page with server-gated single-use email OTP codes (10-minute expiry, rate limits, prior-session revocation), jittered session heartbeats with organizer kill-switch support, and immediate session expiration on page leave.",
      },
      {
        category: "Added",
        text: "Added ProtectedYoutubePlayer with click-shield deterrence, custom accessible playback controls, player load retry recovery, and a moving viewer email watermark.",
      },
      {
        category: "Improved",
        text: "Stored whitelisted email hashes in an O(1) Firestore subcollection with AES-256-GCM event-bound video ID sealing, atomic optimistic concurrency on OTP redemption, and paginated registrant syncing past 5,000 attendees.",
      },
      {
        category: "Fixed",
        text: "Hardened video URL parsing (adding YouTube Live and youtube-nocookie support while blocking unsafe schemes), eliminated email regex ReDoS, escaped OTP email titles, and removed insecure secret fallbacks.",
      },
    ],
  },
  {
    version: "1.0.67",
    releaseDate: "2026-11-25",
    title: "Certificate Verification Badge Stamping & Firestore Rules",
    items: [
      {
        category: "Added",
        text: "Added Stamp Verification Badge & QR Code toggle and corner position selector for Attendance and Speaker certificates across Google Slides, Google Drawing, and built-in templates.",
      },
      {
        category: "Added",
        text: "Added verification_badge and qr_code placement placeholders for Google Slides (backed by slide layout coordinate inspection) and Google Drawing overlays for exact badge and QR positioning.",
      },
      {
        category: "Changed",
        text: "Standardized the certificate ID placeholder to certificate_id (keeping certificate_code backward-compatible), added a border around the Issued Certificates table, and updated the auto-unlock release label.",
      },
      {
        category: "Fixed",
        text: "Added missing Firestore security rules and schema validation for the event_certificates collection, fixing speaker and attendance certificate record persistence.",
      },
    ],
  },
  {
    version: "1.0.66",
    releaseDate: "2026-11-25",
    title: "Registrants CSV Export Column Alignment",
    items: [
      {
        category: "Fixed",
        text: "Updated registrants CSV export to respect visible standard column toggles from Column Customizer (in addition to selected custom questions), keeping Name and Email always included.",
      },
      {
        category: "Fixed",
        text: "Aligned exported CSV column order with the Registrants table, gated Session Track on events with sessions, and CSV-quoted headers so question labels with commas or quotes do not shift columns.",
      },
    ],
  },
  {
    version: "1.0.65",
    releaseDate: "2026-11-25",
    title: "PERURI e-Meterai Live Placement Precision & Preview Sizing",
    items: [
      {
        category: "Fixed",
        text: "Calibrated the live canvas preview box to the measured PERURI e-Meterai square dimensions (10% × 7% on A4, ~59 × 59 pt) and hid the resize handle on fixed-size e-Meterai overlays.",
      },
      {
        category: "Fixed",
        text: "Centered Resmi.ID's 22% × 8% (~131 × 67 pt) widget box on the preview square's center in sign-pdf.ts, eliminating horizontal and vertical centering offsets between the live preview and stamped PERURI seal.",
      },
      {
        category: "Fixed",
        text: "Compacted isValidPartnerSignedDocument in firestore.rules below Firestore's 1,000 CEL expression limit, fixed Resmi.ID top-left coordinate origin and mutually exclusive corner vs x/y submission, aligned Place Signature Beside e-Meterai to keep the QR uncovered, and removed button underline inside AlertDescription.",
      },
    ],
  },
  {
    version: "1.0.64",
    releaseDate: "2026-11-24",
    title: "Cloudflare Web Analytics Window & Retention Guard",
    items: [
      {
        category: "Fixed",
        text: "Enforced Cloudflare Web Analytics hard API constraints (90-day max single query span and 180-day trailing retention horizon), eliminating wider-than-13w2d errors on All Time and wide date filters.",
      },
      {
        category: "Fixed",
        text: "Added graceful zero-metric handling for historical windows before the 180-day retention horizon and bumped the website analytics cache key to v2 to invalidate stale cached error payloads.",
      },
    ],
  },
  {
    version: "1.0.63",
    releaseDate: "2026-11-24",
    title: "Partner Removal Persistence",
    items: [
      {
        category: "Fixed",
        text: "Recorded deleted Bevy sponsor IDs in system_settings/chapter_sponsors and skipped them during Bevy sync so removed partners do not reappear on page refresh.",
      },
    ],
  },
  {
    version: "1.0.62",
    releaseDate: "2026-11-24",
    title: "Unified Platform & Community Analytics Hub",
    items: [
      {
        category: "Added",
        text: "Added full-width Platform & Community Analytics hub on /dashboard/organizer with 5 data-grounded tabs (Website, Events, Tickets, Members, Instagram @gdgjakarta), All Time / Date Range / Monthly / Yearly filters, and R2-backed caching.",
      },
      {
        category: "Added",
        text: "Added interactive offline World Choropleth Map on the Website tab with Users/Visits vs Page Views toggle, backed by GA4 Data API, Cloudflare Web Analytics, and Firestore active members.",
      },
      {
        category: "Added",
        text: "Added Copy AI Prompt dropdown generating Markdown report prompts for Sponsor Proposal, Partner Impact Report, or the active tab.",
      },
      {
        category: "Added",
        text: "Added Instagram Insights & Meta Ads Boost Tracking with views, reach, interactions, followers, demographics, top posts, Active Ads & Ad Spend KPIs, per-post Ads badges, and a Boosted Posts spend breakdown.",
      },
      {
        category: "Added",
        text: "Expanded GDGUpcomingEvents into a full-height paginated card (10 per page) with clean scrollable overflow.",
      },
    ],
  },
  {
    version: "1.0.61",
    releaseDate: "2026-11-24",
    title: "Official PERURI e-Meterai via Resmi.ID & Bolder Signatures",
    items: [
      {
        category: "Added",
        text: "Added optional PERURI e-Meterai stamping via Resmi.ID in Sign Partner PDFs with automatic Sandbox vs Live detection, live pricing, Live-mode Rp10.500 confirmation modal, draggable canvas box with corner snap presets, document type selector, and Resmi.ID Dashboard / Top-up links.",
      },
      {
        category: "Added",
        text: "Implemented async R2 webhook staging, 3s organizer auto-polling, 1-click Retry Stamp, partner email lock until stamping completes, PERURI serial verification on public signed-document pages, and Firestore rules validation for emeterai_* fields.",
      },
      {
        category: "Added",
        text: "Added Bold signature strokes (~1px ink dilation), wider Freehand Draw pen width (4px default, max 8px), and Place Signature Above e-Meterai alignment.",
      },
      {
        category: "Changed",
        text: "Changed Append E-Certificate & Audit Page default from true to false in SignDocumentsTab and /api/partnership/sign-pdf.",
      },
    ],
  },
  {
    version: "1.0.60",
    releaseDate: "2026-11-24",
    title: "Prefill Invoice from Quotation",
    items: [
      {
        category: "Added",
        text: "Added 1-click Create Invoice from Quotation action on Quotation rows and a Prefill from Quotation selector in the Invoice editor to copy billing, event metadata, tier, currency, bank details, and line items.",
      },
    ],
  },
  {
    version: "1.0.59",
    releaseDate: "2026-11-24",
    title: "Separate Partner Signatory Fields & MOU Clause Formatting",
    items: [
      {
        category: "Added",
        text: "Added optional Partner Signatory Name and Title fields in SponsorDocumentsDialog with fallback to Contact Person / Title.",
      },
      {
        category: "Fixed",
        text: "Preserved multi-line line breaks and indentation in MOU clauses across live preview and public PDF view.",
      },
    ],
  },
  {
    version: "1.0.58",
    releaseDate: "2026-11-24",
    title: "Badge Overflow Protection, Readable Name Fitting, Clear Queue & Watcher Flood Fix",
    items: [
      {
        category: "Added",
        text: "Added Clear Queue button with confirmation dialog to batch-clear pending print jobs without touching printed or active jobs.",
      },
      {
        category: "Added",
        text: "Added shimmer loading skeletons to Print Queue Activity, Connected Print Stations, and Real-Time Print Queue rows.",
      },
      {
        category: "Improved",
        text: "Upgraded badge name fitting to preserve the first 2 words, shrink gently, and drop excess trailing initials instead of collapsing into all-initials.",
      },
      {
        category: "Improved",
        text: "Added primary-role extraction, Indonesian institution abbreviation, tighter default badge typography (8pt/6.8pt/15.5mm QR), and progressive overflow sacrifice (shrink → hide Event Name → hide Ref Code → zoom).",
      },
      {
        category: "Fixed",
        text: "Fixed Real-Time Check-In Watcher cache replay flood by waiting for server snapshots, enforcing a 2-minute check-in recency window, and capping single-snapshot bursts.",
      },
    ],
  },
  {
    version: "1.0.57",
    releaseDate: "2026-11-23",
    title: "Manual Print Badge Trigger on Registrants & Application Dossier",
    items: [
      {
        category: "Added",
        text: "Added 1-click Print Badge icon button and menu action on every row in the Registrants list, plus a Print Badge button in the Application Dossier header.",
      },
    ],
  },
  {
    version: "1.0.56",
    releaseDate: "2026-11-23",
    title: "Print Queue Organizer Attribution, Live Indicator & Manual Refresh",
    items: [
      {
        category: "Added",
        text: "Added Triggered by column in the Real-Time Print Queue automatically recording the organizer's name and email on every enqueued print job.",
      },
      {
        category: "Added",
        text: "Added pulsing Live status indicator with last-updated timestamp and a manual Refresh button to the Print Queue header.",
      },
    ],
  },
  {
    version: "1.0.55",
    releaseDate: "2026-11-23",
    title: "Printer Template Quick-Pick TypeScript Fix",
    items: [
      {
        category: "Fixed",
        text: "Widened ticket_type before fallback trim in ConfigurePrinterTemplateDataDialog for strict TypeScript production builds.",
      },
    ],
  },
  {
    version: "1.0.54",
    releaseDate: "2026-11-23",
    title: "Editable Responsive Shipping Labels, BLE Portrait Rotation & Queue Pagination",
    badge: "Major",
    items: [
      {
        category: "Added",
        text: "Added editable Shipping Labels HTML/CSS tab with token bar, live preview, Maps QR toggle, Save Current as Default, and automatic rescaling across all paper presets and orientations.",
      },
      {
        category: "Added",
        text: "Added Print Queue pagination (10 / 25 / 50 per page across 200 latest jobs), transactional Cancel Queued action, Speaker Thank-You Award icon, and Bevy capacity sync on event creation.",
      },
      {
        category: "Improved",
        text: "Updated GDG Print Station.app to v2.5.0 with 90° clockwise portrait rotation on 50×30mm rolls, fixed TSPL polarity and WKWebView sizing, centered Notch HUD pills, and published to R2.",
      },
      {
        category: "Improved",
        text: "Polished Shipping Label typography and overflow fitting, redesigned the Printers header toolbar into a single row, and balanced the delivery status dialog action buttons.",
      },
    ],
  },
  {
    version: "1.0.53",
    releaseDate: "2026-11-23",
    title: "Direct Bluetooth Thermal Printing (CT221B BLE) & MOU Clause Overrides",
    badge: "Major",
    items: [
      {
        category: "Added",
        text: "Added native CoreBluetooth BLE and Web Bluetooth TSPL printing for Clabel CT221B with configurable darkness and label gap settings.",
      },
      {
        category: "Added",
        text: "Added per-document MOU clause overrides for partner agreements.",
      },
      {
        category: "Fixed",
        text: "Sent relative logo paths to Bevy with explicit sync failure reporting, and fixed Web Bluetooth BufferSource typing.",
      },
    ],
  },
  {
    version: "1.0.52",
    releaseDate: "2026-11-23",
    title: "Consolidated Partner Document Creation Dropdown",
    items: [
      {
        category: "Improved",
        text: "Consolidated Invoice, Quotation, LOA, and MOU creation buttons into a single dropdown menu in SponsorDocumentsDialog.",
      },
    ],
  },
  {
    version: "1.0.51",
    releaseDate: "2026-11-20",
    title: "Per-Document LOA Clause Overrides & Workshop Toggle",
    items: [
      {
        category: "Added",
        text: "Added dynamic per-document LOA clause overrides and an optional workshop clause toggle when generating Letters of Agreement.",
      },
    ],
  },
  {
    version: "1.0.50",
    releaseDate: "2026-11-20",
    title: "Cloudflare Workers Bundle Size Optimization",
    items: [
      {
        category: "Fixed",
        text: "Disabled sourcemap upload in wrangler.jsonc to stay below the 60 MiB Workers deployment limit.",
      },
    ],
  },
  {
    version: "1.0.49",
    releaseDate: "2026-11-20",
    title: "PDF Fontkit Dependency Fix",
    items: [
      {
        category: "Fixed",
        text: "Added @pdf-lib/fontkit to package.json dependencies for production PDF generation builds.",
      },
    ],
  },
  {
    version: "1.0.48",
    releaseDate: "2026-11-20",
    title: "Partner Email Dialog Wrapping Fix",
    items: [
      {
        category: "Fixed",
        text: "Fixed content wrapping inside the Send Document via Email dialog.",
      },
    ],
  },
  {
    version: "1.0.47",
    releaseDate: "2026-11-20",
    title: "Default Partnership Website Update",
    items: [
      {
        category: "Changed",
        text: "Set default event website to https://gdgjakarta.org/ in partnership document templates.",
      },
    ],
  },
  {
    version: "1.0.46",
    releaseDate: "2026-11-20",
    title: "Compact Sponsor Document Email Action",
    items: [
      {
        category: "Improved",
        text: "Changed the sponsor document email trigger to a compact icon button.",
      },
    ],
  },
  {
    version: "1.0.45",
    releaseDate: "2026-11-20",
    title: "Attendance & Speaker Appreciation Certificates with PKCS#7 Signing",
    badge: "Major",
    items: [
      {
        category: "Added",
        text: "Added Attendance & Speaker Appreciation event certificates with PKCS#7 digital signing, R2 hosting, and n8n email workflows.",
      },
      {
        category: "Added",
        text: "Added direct Sign Document action, custom document titles, MOU Clause 6 overrides, and CC/BCC multi-recipient email API support.",
      },
    ],
  },
  {
    version: "1.0.44",
    releaseDate: "2026-11-20",
    title: "Public Partner Confirmation Firestore Write Fix",
    items: [
      {
        category: "Fixed",
        text: "Allowed public chapter_sponsors confirmation writes and surfaced Firestore write failures cleanly.",
      },
    ],
  },
  {
    version: "1.0.43",
    releaseDate: "2026-11-19",
    title: "Partnership Tab Loading Skeletons",
    items: [
      {
        category: "Improved",
        text: "Added skeleton shimmer states while loading brand guide URLs, email headers, and confirmation links in the Partnership tab.",
      },
    ],
  },
  {
    version: "1.0.42",
    releaseDate: "2026-11-19",
    title: "Email Note Spacing & PDF Signing Canvas Refinement",
    items: [
      {
        category: "Fixed",
        text: "Preserved line spacing and emphasis in partner email custom notes and refined the PDF signing canvas layout.",
      },
    ],
  },
  {
    version: "1.0.41",
    releaseDate: "2026-11-19",
    title: "Partner Email Custom Note Font Sanitization",
    items: [
      {
        category: "Fixed",
        text: "Stripped pasted inline font styles from partner email custom note HTML.",
      },
    ],
  },
  {
    version: "1.0.40",
    releaseDate: "2026-11-19",
    title: "Rich-Text Note Editor for Partner Emails",
    items: [
      {
        category: "Added",
        text: "Added a rich-text HTML note editor to the Partner Email dialog.",
      },
    ],
  },
  {
    version: "1.0.39",
    releaseDate: "2026-11-19",
    title: "Partner PDF Signage & X.509 E-Certificate Verification Portal",
    badge: "Major",
    items: [
      {
        category: "Added",
        text: "Launched the Sign Partner PDFs studio with visual signature placement, optional A4 audit trail page, PKCS#7 X.509 signing, R2 storage, and public verification portal.",
      },
    ],
  },
  {
    version: "1.0.38",
    releaseDate: "2026-11-19",
    title: "Brand Guide URL Setting for Chapter Sponsors",
    items: [
      {
        category: "Added",
        text: "Added a configurable Brand Guide URL setting and quick-open button for non-event sponsors.",
      },
    ],
  },
  {
    version: "1.0.37",
    releaseDate: "2026-11-19",
    title: "Partner & Sponsor Management Suite, Async Check-in Rate & Delivery Tracking Fixes",
    badge: "Major",
    items: [
      {
        category: "Added",
        text: "Launched Partner & Sponsor Management with Bevy chapter/event sync, 16:9 poster logo cropper, tokenized Invoice/Quotation/LOA/MOU PDF generator, and public confirmation portals.",
      },
      {
        category: "Added",
        text: "Added async check-in rate hydration column for curation mode on the Registrants list.",
      },
      {
        category: "Fixed",
        text: "Fixed merchandise delivery courier mapping, tracking history display, and dialog action buttons.",
      },
    ],
  },
  {
    version: "1.0.36",
    releaseDate: "2026-11-16",
    title: "Live Member Detail Check-in Rate on Registrants Tab",
    items: [
      {
        category: "Improved",
        text: "Resolve live attendance stats from member details on the Registrants Tab during curation mode without touching member sync or Firestore member storage.",
      },
    ],
  },
  {
    version: "1.0.35",
    releaseDate: "2026-11-16",
    title: "Member Profiles, Personal Info Social Autocomplete & Curation Check-in Rate Sorting",
    items: [
      {
        category: "Added",
        text: "Member detail inspection modal on /dashboard/members with direct WhatsApp messaging, brand-colored social profile pills, and attendance history.",
      },
      {
        category: "Added",
        text: "Social link profiles on account settings with auto-completion into matching event registration questions.",
      },
      {
        category: "Added",
        text: "Check-in rate badge with color indications (Emerald/Amber/Rose) for applicants during event curation mode.",
      },
      {
        category: "Added",
        text: "Interactive column header and filter dropdown sorting by check-in rate (Highest vs Lowest first).",
      },
    ],
  },
  {
    version: "1.0.34",
    releaseDate: "2026-11-16",
    title: "Short.io Dashboard Analytics, Advanced Link Options & Domains",
    items: [
      {
        category: "Added",
        text: "Full Short.io dashboard integration with click stats charts, password protection, link expiration, device targeting, and bulk CSV import.",
      },
    ],
  },
  {
    version: "1.0.33",
    releaseDate: "2026-11-15",
    title: "Thermal Shipping Label Printing & Cross-Laptop Printer Selection",
    items: [
      {
        category: "Added",
        text: "Thermal shipping label printing for merchandise delivery with 1:1 preview dialog and batch printing support.",
      },
      {
        category: "Added",
        text: "Conditional Google Maps QR code on shipping labels (SCAN MAPS) when pinpoint links are present, expanding full-width when absent.",
      },
      {
        category: "Added",
        text: "Cross-laptop remote thermal printing with live printer state, device name, and organizer ownership selection.",
      },
      {
        category: "Improved",
        text: "Auto-fitting multi-line recipient names and address details with dynamic zoom fitting to prevent paper edge clipping.",
      },
      {
        category: "Fixed",
        text: "Enforced strict thermal connection guard alerting organizers when no thermal printer is available instead of falling back to browser print dialogs.",
      },
    ],
  },
  {
    version: "1.0.32",
    releaseDate: "2026-11-15",
    title: "Native macOS Print Station Menu Bar App, Notch Dynamic Island HUD & USB Auto-Print",
    items: [
      {
        category: "Added",
        text: "Built native Swift Menu Bar app (GDG Print Station.app v2.4.0) with Notch and Floating Dynamic Island HUD, replacing legacy Terminal SEA worker.",
      },
      {
        category: "Added",
        text: "Packaged signed DMG and ZIP releases on Cloudflare R2 with one-line Terminal install and Gatekeeper bypass script.",
      },
      {
        category: "Added",
        text: "Integrated background print station runner in dashboard layout for continuous printing across tab navigation and universal QR check-in auto-print.",
      },
      {
        category: "Improved",
        text: "Implemented dual-index station deduplication (hardware ID + normalized name/model) to eliminate duplicate online/offline Mac station entries.",
      },
      {
        category: "Improved",
        text: "Updated printer device copywriting and enabled word-wrapping on notch HUD to eliminate text truncation.",
      },
      {
        category: "Fixed",
        text: "Enforced physical USB presence checks before CUPS submission to prevent false successful prints when USB cables are unplugged.",
      },
      {
        category: "Fixed",
        text: "Fixed UI thread lock contention and force-close crashes when clicking refresh printers with USB devices unplugged.",
      },
    ],
  },
  {
    version: "1.0.31",
    releaseDate: "2026-11-15",
    title: "Speaker Ecosystem Badges, GDGoC/GDSC Role, Image Cropper & Public Roster Sync",
    badge: "Update",
    items: [
      {
        category: "Added",
        text: "Added AdjustImageDialog with macOS Preview-style frosted glass backdrop for transparent avatars and 0.5x–3.0x zoom-out support.",
      },
      {
        category: "Added",
        text: "Added GDGoC / GDSC (Campus Chapter) as a Google Developer Ecosystem role across speaker confirmation forms, dashboard dialogs, and public event pages.",
      },
      {
        category: "Improved",
        text: "Styled public speaker ecosystem badges with distinct color palettes (GDE, Googler, WTM, GDG, GDGoC / GDSC) stacked vertically below speaker names.",
      },
      {
        category: "Fixed",
        text: "Merged Firestore event presenters into Bevy public event tabs so manually added speakers appear on live event pages with accurate speaker counts.",
      },
      {
        category: "Fixed",
        text: "Linked confirmation_id on manually added speakers in addManualSpeakerConfirmationAction so public ecosystem badges resolve directly from speaker confirmation records.",
      },
    ],
  },
  {
    version: "1.0.30",
    releaseDate: "2026-11-15",
    title: "Speaker Bevy #ID Badge & Confirmation Details",
    badge: "Update",
    items: [
      {
        category: "Added",
        text: "Displayed Bevy #ID badge on speaker items when bevy_person_id is present.",
      },
      {
        category: "Improved",
        text: "Unified dietary restrictions selector across Add Speaker and Edit Speaker dialogs.",
      },
    ],
  },
  {
    version: "1.0.29",
    releaseDate: "2026-11-15",
    title: "Partnership Dynamic Event Tokenizer, Bevy Binding & Sponsor FAQ Automation",
    badge: "Update",
    items: [
      {
        category: "Added",
        text: "Connected partnership featured event spotlight directly to live Bevy API events with automatic tag extraction and editorial narrative overrides.",
      },
      {
        category: "Added",
        text: "Introduced dynamic event and stat parameter tokenization across partnership lead paragraphs, highlight cards, and sponsor FAQs.",
      },
      {
        category: "Improved",
        text: "Enhanced mobile responsiveness, centered highlight cards, and upgraded homepage community pass spotlight with updated community-tier ticketing copy.",
      },
      {
        category: "Fixed",
        text: "Swapped Organizer Dashboard card order so Community Organizers precedes Referral Leaderboard, and resolved layout overflow issues in partnership dashboard controls.",
      },
    ],
  },
  {
    version: "1.0.28",
    releaseDate: "2026-11-14",
    title: "Organizer Role Bootstrap, Masked Email Matching & Role Sync",
    badge: "Update",
    items: [
      {
        category: "Fixed",
        text: "Resolved Firestore permission deadlock by introducing bootstrap organizer verification and Bevy masked email matching in security rules.",
      },
      {
        category: "Fixed",
        text: "Prevented accidental organizer/staff demotions during profile saves or transient Bevy API timeouts.",
      },
      {
        category: "Improved",
        text: "Standardized Bevy role resolution and regional lead handling via centralized isGooglerRole and added 1-click role sync actions.",
      },
    ],
  },
  {
    version: "1.0.27",
    releaseDate: "2026-11-13",
    title: "Organizer Role Authority & Chapter Role Persistence",
    items: [
      {
        category: "Fixed",
        text: "Resolved role display discrepancy on the account screen by prioritizing active session organizer and core team roles over stale Firestore member records.",
      },
      {
        category: "Fixed",
        text: "Updated member persistence in Firestore to retain and preserve chapter_role alongside user profile saves.",
      },
    ],
  },
  {
    version: "1.0.26",
    releaseDate: "2026-11-13",
    title: "Google Sign-In Redirect Loop & Popup Fallback Fix",
    items: [
      {
        category: "Fixed",
        text: "Restored popup mode as default with automatic redirect fallback when popups are blocked or unsupported by the browser.",
      },
      {
        category: "Fixed",
        text: "Memoized redirect result handling and synchronized onAuthStateChanged listener to eliminate auth race conditions and premature navigation.",
      },
    ],
  },
  {
    version: "1.0.25",
    releaseDate: "2026-11-12",
    title: "17.8k Member Server Pagination & Algolia Search Fix",
    items: [
      {
        category: "Fixed",
        text: "Corrected Bevy API Accept headers and protected auth paths for /config/algolia, enabling Algolia chapter member search and real-time search hits across 17.8k members.",
      },
      {
        category: "Improved",
        text: "Implemented server-driven manual pagination with multi-ellipsis support for thousands of pages, retaining member state across tab switches.",
      },
      {
        category: "Added",
        text: "Added pulsating shimmer skeleton loading states during pagination, remote searching, and deferred tab composition.",
      },
      {
        category: "Improved",
        text: "Enhanced Google Sign-In with redirect authentication mode and /__/auth/ rewrites for WebKit and custom browsers where popups fail.",
      },
    ],
  },
  {
    version: "1.0.24",
    releaseDate: "2026-11-12",
    title: "Algolia Fast-Path for Bulk Bevy Member Sync",
    items: [
      {
        category: "Improved",
        text: "Integrated Bevy's Algolia chapter member search as an instant fast-path for Bevy ID resolution, preventing 429 rate limits and speeding up bulk member sync.",
      },
    ],
  },
  {
    version: "1.0.23",
    releaseDate: "2026-11-12",
    title: "Bevy API Rate-Limit Circuit Breaker for Bulk Sync",
    items: [
      {
        category: "Fixed",
        text: "Added graceful rate-limit (429) circuit breaker during bulk Bevy member sync, immediately halting execution and surfacing the exact count of successfully synced members.",
      },
    ],
  },
  {
    version: "1.0.22",
    releaseDate: "2026-11-12",
    title: "Streamlined Member Table Actions",
    items: [
      {
        category: "Changed",
        text: "Removed global chapter-wide sync button from the members table header, prioritizing granular table row selection and bulk Bevy ID sync action bar.",
      },
    ],
  },
  {
    version: "1.0.21",
    releaseDate: "2026-11-12",
    title: "Deduplicated Bevy Member Sync & Higher Volume Ingestion",
    items: [
      {
        category: "Fixed",
        text: "Prevented duplicate member resurrection during Bevy sync by resolving incoming Bevy users against existing Auth UID documents instead of spawning numeric ID documents.",
      },
      {
        category: "Improved",
        text: "Expanded bulk member sync to paginate Bevy records up to 1,000 members with chunked 400-doc Firestore batches, overcoming the previous 230-member single-batch cap.",
      },
    ],
  },
  {
    version: "1.0.20",
    releaseDate: "2026-11-12",
    title: "Member Merge System & Bulk Bevy Sync",
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
