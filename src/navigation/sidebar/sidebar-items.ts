import { Calendar, LayoutDashboard, type LucideIcon, SquareArrowUpRight, Users } from "lucide-react";

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
      // {
      // TODO uncomment this part if you want to add email feature
      //   id: "email",
      //   title: "Email",
      //   url: "/dashboard/mail",
      //   icon: Mail,
      // },
      // {
      // TODO uncomment this part if you want to add calendar feature
      //   id: "calendar",
      //   title: "Calendar",
      //   url: "/dashboard/calendar",
      //   icon: Calendar,
      // },
      // {
      // TODO uncomment this part if you want to add kanban feature
      //   id: "kanban",
      //   title: "Kanban",
      //   url: "/dashboard/kanban",
      //   icon: Kanban,
      // },
      // {
      // TODO uncomment this part if you want to add tasks feature
      //   id: "tasks",
      //   title: "Tasks",
      //   url: "/dashboard/tasks",
      //   icon: CheckSquare,
      // },
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
      // {
      // TODO uncomment this part if you want to add roles feature
      //   id: "roles",
      //   title: "Roles",
      //   url: "/dashboard/roles",
      //   icon: Lock,
      // },
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
        id: "events",
        title: "Events",
        url: "/dashboard/events",
        icon: Calendar,
      },
      {
        id: "community",
        title: "Community",
        url: "/dashboard/members",
        icon: Users,
      },
    ],
  },
];
