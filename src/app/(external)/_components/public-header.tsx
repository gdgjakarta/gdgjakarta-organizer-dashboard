"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LayoutDashboard, LogOut } from "lucide-react";

import { GoogleButton } from "@/app/(main)/auth/_components/social-auth/google-button";
import { GdgLogo } from "@/components/gdg-logo";
import { useNavigationProgress } from "@/components/navigation-progress-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_CONFIG } from "@/config/app-config";
import { getDashboardHomeUrl } from "@/lib/auth-roles";
import { getInitials } from "@/lib/utils";
import { signOutOrganizer, useAuthStore } from "@/stores/auth/auth-provider";

import { PublicMobileNav } from "./public-mobile-nav";
import { isPublicNavItemActive, PUBLIC_NAV_ITEMS } from "./public-nav-items";

export function PublicHeader() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { isNavigating } = useNavigationProgress();

  const renderAuthAction = () => {
    if (isLoading) {
      return (
        <div className="relative h-10 w-28 overflow-hidden rounded-full bg-muted">
          <div className="shimmer-wave" aria-hidden="true" />
        </div>
      );
    }

    if (user) {
      return (
        <div className="flex items-center gap-2">
          <Button
            asChild
            className="relative overflow-hidden rounded-full px-5 font-medium text-[14px] shadow-xs transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: "var(--theme-primary)",
              color: "var(--theme-primary-foreground)",
            }}
          >
            <Link href={getDashboardHomeUrl(user)}>
              <span>Dashboard</span>
              {isNavigating && <div className="shimmer-wave" aria-hidden="true" />}
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="flex size-10 shrink-0 items-center justify-center rounded-full outline-none ring-offset-background transition-all hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Avatar className="size-10 border">
                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                  <AvatarFallback className="font-medium text-xs">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56 rounded-xl">
              <DropdownMenuLabel className="font-normal">
                <div className="grid text-left leading-tight">
                  <span className="truncate font-medium text-sm">{user.name}</span>
                  <span className="truncate text-muted-foreground text-xs">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href={getDashboardHomeUrl(user)}>
                  <LayoutDashboard />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void signOutOrganizer()}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    return (
      <GoogleButton
        size="sm"
        variant="default"
        callbackUrl={typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined}
        className="h-10 w-auto rounded-full px-5 font-medium text-[14px] shadow-xs transition-all hover:scale-[1.02]"
        style={{
          backgroundColor: "var(--theme-primary)",
          color: "var(--theme-primary-foreground)",
        }}
      >
        Join Community
      </GoogleButton>
    );
  };

  return (
    <header className="print:hidden sticky top-0 z-50 w-full border-b bg-background/85 backdrop-blur-md transition-colors supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <GdgLogo size={48} className="h-8 w-auto shrink-0" />
            <span className="font-medium text-lg tracking-tight">{APP_CONFIG.name}</span>
          </Link>

          {/* Pill Navigation */}
          <nav aria-label="Main navigation" className="hidden items-center gap-1 font-medium text-[14px] md:flex">
            {PUBLIC_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isPublicNavItemActive(pathname, item.href) ? "page" : undefined}
                className="rounded-full px-4 py-1.5 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center sm:flex">{renderAuthAction()}</div>
          <PublicMobileNav authAction={renderAuthAction()} />
        </div>
      </div>
    </header>
  );
}
