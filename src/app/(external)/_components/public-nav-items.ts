export interface PublicNavItem {
  title: string;
  href: string;
}

export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { title: "Home", href: "/" },
  { title: "Events", href: "/events" },
  { title: "Partnership", href: "/partnership" },
  { title: "FAQ", href: "/faq" },
];

export function isPublicNavItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
