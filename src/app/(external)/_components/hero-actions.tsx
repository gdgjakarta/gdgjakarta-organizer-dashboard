"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { GoogleButton } from "@/app/(main)/auth/_components/social-auth/google-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface HeroActionsProps {
  className?: string;
}

export function HeroActions({ className }: HeroActionsProps) {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      setIsNavigating(false);
    }
  }, [pathname]);

  const renderDashboardAction = () => {
    if (isLoading) {
      return (
        <div className="relative h-10 w-36 overflow-hidden rounded-md border border-[var(--theme-border)] bg-muted">
          <div className="shimmer-wave" aria-hidden="true" />
        </div>
      );
    }

    if (user) {
      return (
        <Button
          size="lg"
          variant="outline"
          asChild
          className="relative overflow-hidden border-[var(--theme-border)] text-[14px] font-medium transition-colors hover:border-[var(--theme-primary)] hover:text-[var(--theme-text)]"
        >
          <Link
            href={user.role === "organizer" ? "/dashboard/organizer" : "/dashboard/member"}
            onClick={() => setIsNavigating(true)}
          >
            <span>Go to Dashboard</span>
            {isNavigating && <div className="shimmer-wave" aria-hidden="true" />}
          </Link>
        </Button>
      );
    }

    return (
      <GoogleButton
        size="lg"
        variant="outline"
        className="w-auto border-[var(--theme-border)] text-[14px] font-medium transition-colors hover:border-[var(--theme-primary)] hover:text-[var(--theme-text)]"
      >
        Join Community
      </GoogleButton>
    );
  };

  return (
    <div className={cn("mt-10 flex flex-wrap items-center gap-4", className ?? "justify-start")}>
      <Button
        size="lg"
        asChild
        className="bg-[var(--theme-primary)] text-[14px] font-medium text-[var(--theme-primary-foreground)] shadow-[var(--theme-shadow)] transition-all hover:bg-[var(--theme-primary-hover)]"
      >
        <Link href="/events">Browse Events</Link>
      </Button>
      {renderDashboardAction()}
    </div>
  );
}
