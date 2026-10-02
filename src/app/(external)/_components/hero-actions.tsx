"use client";

import Link from "next/link";

import { GoogleButton } from "@/app/(main)/auth/_components/social-auth/google-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface HeroActionsProps {
  className?: string;
}

export function HeroActions({ className }: HeroActionsProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <div className={cn("mt-10 flex flex-wrap items-center gap-4", className ?? "justify-start")}>
      <Button
        size="lg"
        asChild
        className="bg-[var(--theme-primary)] text-[14px] font-medium text-[var(--theme-primary-foreground)] shadow-[var(--theme-shadow)] transition-all hover:bg-[var(--theme-primary-hover)]"
      >
        <Link href="/events">Browse Events</Link>
      </Button>
      {user ? (
        <Button
          size="lg"
          variant="outline"
          asChild
          className="border-[var(--theme-border)] text-[14px] font-medium transition-colors hover:border-[var(--theme-primary)] hover:text-[var(--theme-text)]"
        >
          <Link href={user.role === "organizer" ? "/dashboard/organizer" : "/dashboard/member"}>Go to Dashboard</Link>
        </Button>
      ) : (
        <GoogleButton
          size="lg"
          variant="outline"
          className="w-auto border-[var(--theme-border)] text-[14px] font-medium transition-colors hover:border-[var(--theme-primary)] hover:text-[var(--theme-text)]"
        >
          Join Community
        </GoogleButton>
      )}
    </div>
  );
}
