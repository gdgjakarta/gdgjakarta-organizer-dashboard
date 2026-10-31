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

export type PrintJobStatus = "pending" | "printing" | "completed" | "failed";

/** One try of a job on one printer. A job can have several when a printer failed and another one took over. */
export interface PrintJobAttempt {
  station_id: string;
  station_name: string;
  /** Printer name as the worker reports it (`BROWSER_PRINTER_NAME` when printed through the browser dialog). */
  printer: string | null;
  started_at: string;
  ended_at?: string;
  error?: string;
}

/** Max tries per job (and per manual retry) before it is marked failed. */
export const MAX_PRINT_ATTEMPTS = 3;
/** Printer label used when a laptop has no print worker and prints through the browser dialog. */
export const BROWSER_PRINTER_NAME = "Browser print dialog";

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
  status: PrintJobStatus;
  error_message?: string;
  created_at: string;
  printed_at?: string;
  failed_at?: string;
  /** Laptop (print station) and printer that hold, or last held, this job. A job is only ever held by one. */
  assigned_station_id?: string;
  assigned_station_name?: string;
  assigned_printer?: string | null;
  assigned_at?: string;
  attempts?: PrintJobAttempt[];
  /** `printerKey()` of printers that already failed this job; they are skipped when it is handed out again. */
  excluded_printers?: string[];
  /** Index in `attempts` where the current retry budget starts (set by a manual retry). */
  retry_from_attempt?: number;
}

export interface PrintStationPrinter {
  name: string | null;
  /** CUPS device URI; printers of one laptop sharing a URI cannot be told apart and print on one device. */
  device_uri?: string | null;
  state: string;
  busy: boolean;
  /** False while the worker is skipping this printer after a failure. */
  available: boolean;
  last_error: string | null;
  /** Job this printer is printing right now. */
  current_job_id?: string | null;
}

/** A laptop with the dashboard open, written to `print_workers/{id}` as a heartbeat. */
export interface PrintStation {
  id: string;
  /** Computer name, e.g. "Fachridan's MacBook Pro". */
  name: string;
  model?: string;
  os?: string;
  worker_version?: string;
  /** False when the worker is not running and the laptop would print through the browser dialog. */
  worker_connected: boolean;
  /** True while Start Print Station is on, i.e. this laptop takes jobs. */
  station_running: boolean;
  printers: PrintStationPrinter[];
  user_email?: string;
  last_seen_at: string;
}

/** A station that has not sent a heartbeat for this long is shown as offline. */
export const PRINT_STATION_ONLINE_MS = 60_000;
/** A job held by a station silent for this long is failed (longer than online so throttled background tabs survive). */
export const PRINT_STATION_LOST_MS = 120_000;

export function isPrintStationOnline(station: PrintStation, now = Date.now()): boolean {
  return now - new Date(station.last_seen_at).getTime() <= PRINT_STATION_ONLINE_MS;
}

/** Unique id of one printer across laptops: two printers on one laptop and same-named printers on two laptops differ. */
export function printerKey(stationId: string, printerName: string | null): string {
  return `${stationId}::${printerName ?? "default"}`;
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
  answers?: Record<string, unknown>;
  [key: string]: unknown;
}
