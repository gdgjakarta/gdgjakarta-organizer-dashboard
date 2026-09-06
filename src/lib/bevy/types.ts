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
  start_date: string;
  end_date: string;
  status: "Draft" | "Published" | "Completed" | "Canceled" | string;
  picture?: {
    url: string;
  };
  url?: string;
  chapter?: {
    id: number | string;
    title: string;
    slug: string;
  };
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
