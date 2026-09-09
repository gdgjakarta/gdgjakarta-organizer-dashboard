import {
  Calendar,
  CalendarCheck,
  LayoutDashboard,
  type LucideIcon,
  ShoppingBag,
  SquareArrowUpRight,
  Users,
} from "lucide-react";

export type NavBadge = "new" | "soon";

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
        title: "Dashboard",
        url: "/dashboard/organizer",
        icon: LayoutDashboard,
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
    label: "Misc",
    items: [
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
        title: "Dashboard",
        url: "/dashboard/member",
        icon: LayoutDashboard,
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
];
