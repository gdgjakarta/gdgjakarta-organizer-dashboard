export interface BevyUser {
  id: number | string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  username?: string;
  email?: string;
  avatar?: {
    url?: string;
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

export interface BevyChapterTeamMember {
  id: number | string;
  user_id: number | string;
  role: string | { id?: number; name?: string; description?: string };
  user?: BevyUser;
  chapter_id?: number | string;
  title?: string;
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
    };
  };
  created_date?: string;
  events_registered_count?: number;
}

export interface BevyMembersResponse {
  count?: number;
  pagination?: {
    previous_page?: number | null;
    current_page?: number;
    next_page?: number | null;
    page_size?: number;
  };
  results?: BevyChapterMember[];
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
  start_date: string;
  end_date: string;
  status: "Draft" | "Published" | "Completed" | "Canceled" | string;
  picture?: {
    url?: string;
    thumbnail_url?: string;
  };
  banner?: {
    url?: string;
    thumbnail_url?: string;
  };
  url?: string;
  static_url?: string;
  relative_url?: string;
  total_attendees?: number;
  checkin_count?: number;
  total_tickets?: number;
  total_rsvps_sold?: number;
  completed?: boolean;
  tags?: string[];
  chapter?: {
    id: number | string;
    title: string;
    slug: string;
  };
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

export type OrganizerValidationResult = {
  isValidOrganizer: boolean;
  role: string;
  bevyUserId: string | number | null;
  chapterRole: string | null;
  chapterTeamMember?: BevyChapterTeamMember;
  bevyUser?: BevyUser | null;
};
