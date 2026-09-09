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
  id: string; // UID or Bevy User ID
  uid?: string;
  bevy_user_id?: string | number | null;
  name: string;
  email: string;
  avatar_url?: string;
  role: string; // e.g. "organizer", "co-organizer", "member"
  chapter_role?: string;
  team?: "Core Team" | "Community";
  status: "Active" | "Inactive";
  joined_date: string;
  company_or_institution?: string;
  phone?: string;
  events_registered_count?: number;
  events_attended_count?: number;
  last_active?: string;
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
