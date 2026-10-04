"use client";

import Link from "next/link";

import { GoogleButton } from "@/app/(main)/auth/_components/social-auth/google-button";
import { GdgLogo } from "@/components/gdg-logo";
import { useNavigationProgress } from "@/components/navigation-progress-bar";
import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app-config";
import { useAuthStore } from "@/stores/auth/auth-provider";

export function PublicHeader() {
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
        <Button
          asChild
          className="relative overflow-hidden rounded-full px-5 font-medium text-[14px] shadow-xs transition-all hover:scale-[1.02]"
          style={{
            backgroundColor: "var(--theme-primary)",
            color: "var(--theme-primary-foreground)",
          }}
        >
          <Link href={user.role === "organizer" ? "/dashboard/organizer" : "/dashboard/member"}>
            <span>Dashboard</span>
            {isNavigating && <div className="shimmer-wave" aria-hidden="true" />}
          </Link>
        </Button>
      );
    }

    return (
      <GoogleButton
        size="sm"
        variant="default"
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
    <header className="sticky top-0 z-50 w-full border-b bg-background/85 backdrop-blur-md transition-colors supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <GdgLogo size={48} className="h-8 w-auto shrink-0" />
            <span className="font-medium text-lg tracking-tight">{APP_CONFIG.name}</span>
          </Link>

          {/* Pill Navigation */}
          <nav className="hidden items-center gap-1 font-medium text-[14px] md:flex">
            <Link
              href="/"
              className="rounded-full px-4 py-1.5 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/events"
              className="rounded-full px-4 py-1.5 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              Events
            </Link>
            <Link
              href="/faq"
              className="rounded-full px-4 py-1.5 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              FAQ
            </Link>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">{renderAuthAction()}</div>
      </div>
    </header>
  );
}
