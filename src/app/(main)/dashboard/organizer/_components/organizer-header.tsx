"use client";

import Link from "next/link";

import { Calendar, ExternalLink, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getBevyDashboardUrl } from "@/config/remote-config-utils";
import { useAuthStore } from "@/stores/auth/auth-provider";

export function OrganizerHeader() {
  const user = useAuthStore((s) => s.user);

  const displayName = user?.name ? user.name.split(" ")[0] : "Organizer";

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <h1 className="font-semibold text-3xl tracking-tight">Welcome back, {displayName} 👋</h1>
        <p className="text-muted-foreground text-sm">
          Here is what is happening across GDG Jakarta events, community registrations, and members.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:w-fit">
        <Button size="sm" variant="outline" asChild>
          <a href={getBevyDashboardUrl("home")} target="_blank" rel="noopener noreferrer" className="gap-1.5">
            <ExternalLink className="size-3.5" />
            Open in Bevy
          </a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/members">
            <Users className="size-3.5" />
            Members
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/dashboard/events">
            <Calendar className="size-3.5" />
            Manage Events
          </Link>
        </Button>
      </div>
    </div>
  );
}
