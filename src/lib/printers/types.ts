export interface PaperPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
}

export const CLABEL_PAPER_PRESETS: PaperPreset[] = [
  {
    id: "clabel-50x30",
    name: "50mm × 30mm (Standard)",
    widthMm: 50,
    heightMm: 30,
    description: "Standard badge label for Clabel 221B",
  },
  {
    id: "clabel-40x30",
    name: "40mm × 30mm (Compact)",
    widthMm: 40,
    heightMm: 30,
    description: "Compact single-pass roll",
  },
  {
    id: "clabel-60x40",
    name: "60mm × 40mm (Large)",
    widthMm: 60,
    heightMm: 40,
    description: "Large event badge with extra details",
  },
];

export interface PrinterConfig {
  enabled: boolean;
  paper_width_mm: number;
  paper_height_mm: number;
  orientation: "portrait" | "landscape";
  template_html: string;
  auto_print_on_checkin: boolean;
  selected_event_id?: string;
  sample_data?: Partial<LabelTemplateData>;
  updated_at?: string;
  updated_by?: string;
}

export interface PrintJob {
  id: string;
  event_id: string;
  attendee_id: string | number;
  registration_id: string;
  member_name: string;
  member_title?: string;
  member_company?: string;
  qr_payload: string; // e.g. "eventId:attendeeId"
  rendered_html: string;
  status: "pending" | "printing" | "completed" | "failed";
  error_message?: string;
  created_at: string;
  printed_at?: string;
}

export interface LabelTemplateData {
  name: string;
  email?: string;
  title?: string;
  company?: string;
  sessionTrack?: string;
  techStack?: string;
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  eventId: string | number;
  attendeeId: string | number;
  ticketCode?: string;
  attendeeCode?: string;
  qrPayload: string;
  checkinTime?: string;
}
