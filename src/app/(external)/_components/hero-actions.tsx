"use client";

import Link from "next/link";

import { GoogleButton } from "@/app/(main)/auth/_components/social-auth/google-button";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth/auth-provider";

export function HeroActions() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
      <Button size="lg" asChild>
        <Link href="/events">Browse Events</Link>
      </Button>
      {user ? (
        <Button size="lg" variant="outline" asChild>
          <Link href={user.role === "organizer" ? "/dashboard/organizer" : "/dashboard/member"}>Go to Dashboard</Link>
        </Button>
      ) : (
        <GoogleButton size="lg" variant="outline" className="w-auto">
          Join Community
        </GoogleButton>
      )}
    </div>
  );
}
