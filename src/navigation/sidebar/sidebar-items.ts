import {
  Calendar,
  CalendarCheck,
  CreditCard,
  ExternalLink,
  Handshake,
  HardDrive,
  HelpCircle,
  House,
  Link2,
  type LucideIcon,
  Mail,
  QrCode,
  Sparkles,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";

export type NavBadge = "new" | "soon" | "preview" | (string & {});

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const organizerSidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboards",
    items: [
      {
        id: "default",
        title: "Home",
        url: "/dashboard/organizer",
        icon: House,
      },
    ],
  },
  {
    id: 2,
    label: "Pages",
    items: [
      {
        id: "events",
        title: "Events",
        url: "/dashboard/events",
        icon: Calendar,
      },
      {
        id: "my-events",
        title: "My Events",
        url: "/dashboard/my-events",
        icon: CalendarCheck,
      },
      {
        id: "email-manager",
        title: "Emails",
        url: "/dashboard/email-manager",
        icon: Mail,
      },
      {
        id: "members",
        title: "Members",
        url: "/dashboard/members",
        icon: Users,
      },
      {
        id: "referrals",
        title: "Referrals",
        url: "/dashboard/referrals",
        icon: Trophy,
      },
    ],
  },
  {
    id: 3,
    label: "Content Management",
    items: [
      {
        id: "featured-event",
        title: "Featured Event",
        url: "/dashboard/featured-event",
        icon: Sparkles,
      },
      {
        id: "partnership",
        title: "Partnership & Sponsorship",
        url: "/dashboard/partnership",
        icon: Handshake,
      },
      {
        id: "faq",
        title: "FAQ & Policy",
        url: "/dashboard/faq",
        icon: HelpCircle,
      },
    ],
  },
  {
    id: 4,
    label: "System & Tools",
    items: [
      {
        id: "links",
        title: "Short Links",
        url: "/dashboard/links",
        icon: Link2,
      },
      {
        id: "media-bucket",
        title: "Bucket Storage",
        url: "/dashboard/media",
        icon: HardDrive,
      },
      {
        id: "maintenance",
        title: "Maintenance Mode",
        url: "/dashboard/maintenance",
        icon: Wrench,
      },
    ],
  },
  {
    id: 5,
    label: "Payment (DOKU)",
    items: [
      {
        id: "doku-qris-simulator",
        title: "DOKU QRIS Simulator",
        url: "https://sandbox.doku.com/qris-simulator/customer",
        icon: QrCode,
        newTab: true,
      },
      {
        id: "doku-sandbox-dashboard",
        title: "DOKU Sandbox Dashboard",
        url: "https://sandbox.doku.com/bo/dashboard",
        icon: CreditCard,
        newTab: true,
      },
      {
        id: "doku-production-dashboard",
        title: "DOKU Production Dashboard",
        url: "https://dashboard.doku.com/bo/dashboard",
        icon: ExternalLink,
        newTab: true,
      },
    ],
  },
];

export const coreTeamSidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboards",
    items: [
      {
        id: "default",
        title: "Home",
        url: "/dashboard/member",
        icon: House,
      },
    ],
  },
  {
    id: 2,
    label: "Pages",
    items: [
      {
        id: "events",
        title: "Events",
        url: "/dashboard/events",
        icon: Calendar,
      },
      {
        id: "my-events",
        title: "My Events",
        url: "/dashboard/my-events",
        icon: CalendarCheck,
      },
    ],
  },
];

export const memberSidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboards",
    items: [
      {
        id: "default",
        title: "Home",
        url: "/dashboard/member",
        icon: House,
      },
    ],
  },
  {
    id: 2,
    label: "Pages",
    items: [
      {
        id: "my-events",
        title: "My Events",
        url: "/dashboard/member/my-events",
        icon: CalendarCheck,
      },
    ],
  },
  {
    id: 3,
    label: "Support",
    items: [
      {
        id: "partnership",
        title: "Partnership & Sponsorship",
        url: "/partnership",
        icon: Handshake,
      },
      {
        id: "faq",
        title: "FAQ & Policy",
        url: "/faq",
        icon: HelpCircle,
      },
    ],
  },
];
