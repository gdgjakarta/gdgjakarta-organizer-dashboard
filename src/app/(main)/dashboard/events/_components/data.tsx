export type EventStatus = "Published" | "Draft" | "Completed" | "Canceled";

export type EventAudience = "IN_PERSON" | "VIRTUAL" | "HYBRID";

export type EventRow = {
  id: string | number;
  title: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
  eventType: string;
  audienceType: string;
  isVirtual: boolean;
  totalAttendees: number;
  checkinCount: number;
  url?: string;
  staticUrl?: string;
  pictureUrl?: string;
  bannerUrl?: string;
  tags: string[];
  isUpcoming: boolean;
};

export const eventFilters = {
  status: ["All", "Upcoming", "Past", "Published", "Draft", "Canceled"],
  eventType: [
    "All",
    "External registration",
    "Free registration",
    "Paid registration",
    "Free registration with Bevy Virtual Conference",
  ],
  audienceType: ["All", "IN_PERSON", "VIRTUAL", "HYBRID"],
};

export const eventStatusMeta: Record<EventStatus, { badgeClass: string; dotClass: string }> = {
  Published: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  Draft: {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  Completed: {
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  Canceled: {
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
};

export const fallbackEvents: EventRow[] = [
  {
    id: "128808",
    title: "DevSync x AIML DevLab: Accelerate Your AI Journey",
    startDate: "05 Sep 2026, 12:00 PM",
    endDate: "05 Sep 2026, 6:30 PM",
    status: "Published",
    eventType: "External registration",
    audienceType: "IN_PERSON",
    isVirtual: false,
    totalAttendees: 112,
    checkinCount: 97,
    url: "https://gdg.community.dev/events/details/google-gdg-jakarta-presents-devsync-x-aiml-devlab-accelerate-your-ai-journey/",
    tags: ["AI", "Machine Learning"],
    isUpcoming: false,
  },
];
