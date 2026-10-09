import {
  Calendar,
  CalendarCheck,
  Handshake,
  HelpCircle,
  House,
  type LucideIcon,
  Mail,
  ShoppingBag,
  SquareArrowUpRight,
  Users,
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
        badge: "new",
      },
    ],
  },
  {
    id: 3,
    label: "Content Management",
    items: [
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
      {
        id: "others",
        title: "Others",
        url: "/dashboard/coming-soon",
        icon: SquareArrowUpRight,
        badge: "soon",
        disabled: true,
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
      {
        id: "my-purchases",
        title: "My Purchases",
        url: "/dashboard/member/purchases",
        icon: ShoppingBag,
        badge: "soon",
        disabled: true,
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
