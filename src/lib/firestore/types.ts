export type RegistrationStatus = "pending" | "approved" | "rejected" | "waitlisted" | "attended";

export interface CustomQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox";
  options?: string[];
  required: boolean;
  placeholder?: string;
}

export interface FirestoreEvent {
  id: string; // Bevy Event ID or generated ID
  title: string;
  description?: string;
  description_short?: string;
  status: "Draft" | "Published" | "Completed" | "Canceled";
  start_date: string;
  end_date: string;
  picture_url?: string;
  banner_url?: string;
  event_type_title?: string;
  audience_type?: "IN_PERSON" | "VIRTUAL" | "HYBRID" | string;
  is_virtual?: boolean;
  venue?: {
    name?: string;
    address?: string;
    city?: string;
  };
  url?: string;
  static_url?: string;
  tags?: string[];
  is_hidden?: boolean;
  is_test?: boolean;

  // Dashboard & Registration Extensions
  requires_approval: boolean;
  max_attendees?: number;
  total_registrations: number;
  total_approved: number;
  total_checked_in: number;
  custom_questions?: CustomQuestion[];

  // Metadata
  synced_from_bevy_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FirestoreMember {
  id: string; // Bevy User ID or Firebase UID
  uid?: string;
  bevy_user_id?: string | number | null;
  bevy_member_id?: string | number | null;
  name: string; // Full name (first_name + last_name)
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  company?: string | null; // e.g. "PT. Lumio Inovasi Technology"
  title?: string | null; // Job Title, e.g. "Software Engineer"
  role: string; // Chapter role: "Organizer" | "Core Team" | "Check-in Staff" | "Member"
  chapter_role?: string | null;
  team?: "Core Team" | "Community";
  status: "Active" | "Inactive";
  joined_date: string;
  raw_created_date?: string; // Exact ISO timestamp from Bevy (created_date)
  events_registered_count?: number;

  // Custom Dashboard Extensions (not in Bevy CSV)
  avatar_url?: string | null;
  profile_url?: string | null;
  is_email_verified?: boolean;
  company_or_institution?: string;
  phone?: string;
  events_attended_count?: number; // Tracked through on-site scanner/check-ins
  last_active?: string | null;
  notes?: string;

  // Sync Metadata
  synced_from_bevy_at?: string;
  updated_at: string;
}

export interface FirestoreRegistration {
  id: string; // `${event_id}_${member_id}`
  event_id: string;
  event_title: string;
  member_id: string;
  member_name: string;
  member_email: string;
  member_avatar?: string;
  member_role?: string;
  status: RegistrationStatus;
  answers?: Record<string, unknown>;
  notes?: string;
  ticket_tier?: string;
  registered_at: string;
  reviewed_at?: string;
  reviewed_by_id?: string;
  reviewed_by_name?: string;
  checked_in_at?: string;
}

export interface FirestoreSyncMetadata {
  id: "bevy";
  last_synced_events_at?: string;
  last_synced_members_at?: string;
  total_events_synced?: number;
  total_members_synced?: number;
  status: "idle" | "syncing" | "success" | "error";
  error_message?: string;
  synced_by?: string;
}
