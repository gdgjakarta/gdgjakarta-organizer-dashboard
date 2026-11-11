export interface BevyUser {
  id: number | string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  username?: string;
  email?: string;
  avatar?: {
    url?: string;
    thumbnail_url?: string;
  };
  cropped_avatar_url?: string;
  title?: string;
  company?: string;
  bio?: string;
  role?: {
    id?: number;
    name?: string;
    description?: string;
  };
  chapters?: Array<{
    id: number;
    title: string;
    slug?: string;
    on_team?: boolean;
  }>;
  chapter_teams?: Array<{
    id: number;
    chapter?: {
      id: number;
      slug: string;
      title: string;
    };
    role?:
      | {
          id: number;
          name: string;
          description?: string;
        }
      | string;
  }>;
}

export interface BevyChapterTeamRole {
  id: number;
  name: string;
  description?: string | null;
  permissions_display?: string | null;
  user_count?: number;
  name_translated?: string | null;
  description_translated?: string | null;
}

export interface BevyChapterTeamMember {
  id: number | string;
  user_id?: number | string;
  role: string | number | BevyChapterTeamRole;
  user?: BevyUser;
  chapter_id?: number | string;
  chapter?: {
    id: number | string;
    title: string;
    chapter_location?: string;
  };
  title?: string;
  visible?: boolean;
  order?: number;
  created_date?: string;
  activated_date?: string;
  user_can_edit?: boolean;
  is_chapter_leader?: boolean;
  is_payment_lead?: boolean;
  send_chapter_team_emails?: boolean;
}

export interface BevyChapterMember {
  id: number | string;
  user: {
    id: number | string;
    full_name: string;
    email?: string;
    profile_url?: string;
    is_email_verified?: boolean;
    avatar?: {
      url?: string;
      thumbnail_url?: string;
    };
  };
  created_date?: string;
  events_registered_count?: number;
}

export interface BevyMembersResponse {
  count?: number;
  chapter_member_key?: string;
  user_key?: string;
  pagination?: {
    previous_page?: number | null;
    current_page?: number;
    next_page?: number | null;
    page_size?: number;
  };
  results?: BevyChapterMember[];
}

export interface BevySpeaker {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company?: string;
  title?: string;
  bio?: string;
  picture?: {
    url?: string;
    thumbnail_url?: string;
    path?: string;
    thumbnail_width?: number;
    thumbnail_height?: number;
    thumbnail_format?: string;
  };
  picture_url?: string;
  personal_twitter?: string;
  company_twitter?: string;
  personal_linkedin_page?: string;
  linkedin_url?: string;
  event_person_id?: number | string;
  speaker_type?: string;
}

export interface BevySpeakerGroup {
  type: string;
  title: string;
  speakers: BevySpeaker[];
}

export interface BevyPartnerLogo {
  url?: string;
  path?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  thumbnail_format?: string;
  thumbnail_url?: string;
}

export interface BevyPartner {
  id?: number | string;
  company: string;
  description?: string;
  url?: string;
  logo_url?: string;
  logo?: BevyPartnerLogo;
  tier?: string;
  tier_order?: number;
  is_global?: boolean;
  visible?: boolean;
  event_sponsor_id?: number;
}

export interface BevyAgendaItem {
  time: string;
  activity: string;
  description?: string;
  audience_type?: string;
  slides_url?: string;
  slides_title?: string;
  related_links?: Array<{ title: string; url: string }>;
}

export interface BevyAgendaDay {
  title?: string;
  items?: BevyAgendaItem[];
  agenda?: BevyAgendaItem[];
}

export interface BevyAgenda {
  multiday?: boolean;
  empty?: boolean;
  any_descriptions?: boolean;
  days?: BevyAgendaDay[];
}

export interface BevyCohostChapter {
  id?: number | string;
  title: string;
  slug?: string;
  logo_url?: string;
  city?: string;
  country?: string;
}

export interface BevyCohost {
  id?: number | string;
  chapter?: BevyCohostChapter;
  title?: string;
  chapter_title?: string;
  logo_url?: string;
  city?: string;
  country?: string;
  url?: string;
}

export interface BevyEvent {
  id: number | string;
  title: string;
  description_short?: string;
  description?: string;
  event_type_title?: string;
  event_type_slug?: string;
  audience_type?: "IN_PERSON" | "VIRTUAL" | "HYBRID" | string;
  is_virtual_event?: boolean;
  virtual_event_type?: string | null;
  attendee_virtual_venue_link?: string | null;
  join_virtual_event_url?: string | null;
  start_date: string;
  end_date: string;
  timezone?: string;
  status: "Draft" | "Published" | "Completed" | "Canceled" | string;
  picture?: {
    url?: string;
    thumbnail_url?: string;
  };
  banner?: {
    url?: string;
    thumbnail_url?: string;
  };
  cropped_banner_url?: string;
  cropped_picture_url?: string;
  picture_url?: string;
  banner_url?: string;
  event_type_logo?: {
    url?: string;
    thumbnail_url?: string;
  };
  event_type_banner?: {
    url?: string;
    thumbnail_url?: string;
  };
  allows_cohosting?: boolean;
  cohosts?: BevyCohost[];
  cohost_chapters?: BevyCohostChapter[];
  cohost_registration_url?: string;
  cohost_registration_chapter_title?: string;
  url?: string;
  static_url?: string;
  relative_url?: string;
  total_attendees?: number;
  total_capacity?: number;
  checkin_count?: number;
  total_tickets?: number;
  total_rsvps_sold?: number;
  completed?: boolean;
  tags?: string[];
  is_hidden?: boolean;
  hidden?: boolean;
  is_test?: boolean;
  chapter?: {
    id: number | string;
    title: string;
    slug?: string;
    logo_url?: string;
    city?: string;
    country?: string;
  };
  venue_name?: string;
  venue_address?: string;
  venue_city?: string;
  venue_state?: string;
  venue_zip_code?: string;
  venue_country?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  speakers?: BevySpeaker[];
  panelists?: BevySpeaker[];
  facilitators?: BevySpeaker[];
  hosts?: BevySpeaker[];
  judges?: BevySpeaker[];
  mentors?: BevySpeaker[];
  moderators?: BevySpeaker[];
  partners?: BevyPartner[];
  sponsors?: unknown[];
  partners_list?: unknown[];
  media_partners?: unknown[];
  agenda?: BevyAgenda;
  video_url?: string;
  highlight_video_url?: string;
  highlight_video_title?: string;
  photo_album_url?: string;
  photo_album_title?: string;
  recap_description?: string;
  google_maps_url?: string;
  venue_map_url?: string;
  [key: string]: unknown;
}

export interface BevyEventsResponse {
  count?: number;
  pagination?: {
    previous_page?: number | null;
    current_page?: number;
    next_page?: number | null;
    page_size?: number;
  };
  results?: BevyEvent[];
}

export interface BevyChapter {
  id: number | string;
  title: string;
  slug: string;
  description?: string;
  city?: string;
  country?: string;
  member_count?: number;
  logo?: {
    url: string;
  };
}

export interface BevySponsor {
  company: string;
  description?: string | null;
  url?: string | null;
  logo?: string | null;
  sponsor_type?: string;
  description_translated?: string | null;
}

export const ChapterRole = {
  GOOGLER: "GOOGLER",
  ORGANIZER: "ORGANIZER",
  CORE_TEAM: "CORE_TEAM",
  MEMBER: "MEMBER",
} as const;

export type ChapterRole = (typeof ChapterRole)[keyof typeof ChapterRole];

export function getChapterRoleById(id?: number | null): ChapterRole {
  switch (id) {
    case 1:
      return ChapterRole.ORGANIZER;
    case 2:
    case 3:
      return ChapterRole.CORE_TEAM;
    case 4:
      return ChapterRole.GOOGLER;
    default:
      return ChapterRole.MEMBER;
  }
}

export function isOrganizerRole(role: ChapterRole): boolean {
  return role === ChapterRole.ORGANIZER;
}

export function isCoreTeamRole(role: ChapterRole): boolean {
  return role === ChapterRole.CORE_TEAM;
}

export function isGooglerRole(role: ChapterRole): boolean {
  return role === ChapterRole.GOOGLER;
}

export function isChapterTeamRole(role: ChapterRole): boolean {
  return role === ChapterRole.ORGANIZER || role === ChapterRole.CORE_TEAM || role === ChapterRole.GOOGLER;
}

export type OrganizerValidationResult = {
  isValidOrganizer: boolean;
  role: string;
  bevyUserId: string | number | null;
  chapterRole: string | null;
  chapterRoleType?: ChapterRole;
  roleId?: number | null;
  roleTitle?: string | null;
  chapterTeamMember?: BevyChapterTeamMember;
  bevyUser?: BevyUser | null;
  wasImported?: boolean;
};

export interface BevyChapterSlim {
  id?: number | string;
  title?: string;
  city?: string;
  country?: string;
  country_name?: string;
  members_count?: number;
  logo?: string;
  cropped_banner_url?: string;
  cropped_logo_url?: string;
  url?: string;
  website?: string;
  instagram_handle?: string;
  twitter_handle?: string;
  linkedin_page?: string;
}

export interface BevyAttendee {
  id: number;
  attendee_code?: string | null;
  attendee_uuid?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  email: string;
  is_checked_in: boolean;
  checkin_date?: string | null;
  ticket_title?: string | null;
  order_id?: string | null;
  status?: string | null;
  user_id?: number | null;
  created_date?: string | null;
  avatar?: {
    url?: string | null;
    thumbnail_url?: string | null;
  } | null;
  [key: string]: unknown;
}

export interface BevyAttendeesResponse {
  count?: number;
  pagination?: {
    previous_page?: number | null;
    current_page?: number;
    next_page?: number | null;
    page_size?: number;
  };
  results?: BevyAttendee[];
}

export interface BevyAttendeeCheckInRequest {
  event: number;
  chapter: number;
  attendees: Array<{
    id: number;
    is_checked_in: boolean;
  }>;
}

export interface BevyAttendeeCheckInResponse {
  event?: number;
  attendees?: Array<{
    id: number;
    is_checked_in: boolean;
  }>;
}

export interface BevyCreateEventInput {
  title: string;
  description: string;
  description_short?: string | null;
  start_date: string;
  end_date: string;
  timezone?: string;
  audience_type: "IN_PERSON" | "VIRTUAL" | "HYBRID" | string;
  total_capacity: number | string;
  is_test?: boolean;
  is_hidden?: boolean;
  visible_on_parent_chapter_only?: boolean;
  sharing_disabled?: boolean;
  allow_automated_emails_when_hidden?: boolean;
  status?: "Draft" | "Published" | string;
  custom_tickets_url?: string;
  venue_name?: string;
  venue_address?: string;
  venue_city?: string;
  venue_zip_code?: string;
  venue_country?: string;
  venue_state?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  show_map?: boolean;
  virtual_event_instructions?: string;
  virtual_event_type?: "internal" | "external" | string;
  virtual_venue_link?: string;
  automatically_record_event?: boolean;
  moderated_qa_enabled?: boolean;
  chat_disabled?: boolean;
  is_many_to_many_virtual_event?: boolean;
  tags?: string[];
}

export const BEVY_PREDEFINED_TAGS: readonly string[] = [
  "DevFest",
  "Conference",
  "Hackathon",
  "Tech Talk / Meetup",
  "Workshop / hands-on session",
  "Accessibility",
  "AI",
  "AI - AI Studio",
  "AI - Gemini",
  "AI - Gemini Enterprise Agent Platform",
  "AI - Gemma",
  "Android",
  "Angular",
  "AR/VR",
  "Build with AI",
  "Career Development",
  "Certification Study Group",
  "Community Building",
  "Earth Engine",
  "Firebase",
  "Flutter",
  "Get Certified",
  "Google Cloud",
  "Google I/O Extended",
  "Google Maps Platform",
  "Google Play",
  "Google Workspace",
  "Networking",
  "UX / UI Design",
  "Web",
] as const;

export type BevyUpdateEventInput = Partial<BevyCreateEventInput> & {
  custom_tickets_url?: string;
  total_capacity?: number | string;
  status?: "Draft" | "Published" | string;
  agenda?: BevyAgenda | string;
  hide_agenda_on_event_page?: boolean;
  tags?: string[];
  event_type?: number;
  meetup_announce?: boolean;
  chapter?: number | string;
  speakers?: BevySpeaker[];
  mentors?: BevySpeaker[];
  facilitators?: BevySpeaker[];
  panelists?: BevySpeaker[];
  judges?: BevySpeaker[];
  moderators?: BevySpeaker[];
  hosts?: BevySpeaker[];
};

export interface BevyAiEventGenerationResponse {
  title?: string;
  description?: string;
  description_short?: string;
  [key: string]: unknown;
}

export interface BevyAiContentModificationParams {
  field: "title" | "description" | string;
  change?: "regenerate" | "shorter" | "longer" | "rewrite" | string;
  title: string;
  description: string;
  objectId?: string | number;
  maxLength?: number;
  minLength?: number;
}

export interface BevyAiContentModificationResponse {
  result?: string;
  modified_content?: string;
  text?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}
