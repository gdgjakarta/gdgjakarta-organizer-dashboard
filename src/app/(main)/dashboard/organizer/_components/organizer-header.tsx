"use client";

import { useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Calendar, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { triggerSyncAction } from "@/server/firestore-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

export function OrganizerHeader() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const user = useAuthStore((s) => s.user);

  const displayName = user?.name ? user.name.split(" ")[0] : "Organizer";

  const handleSyncAll = () => {
    startTransition(async () => {
      toast.loading("Syncing all GDG Jakarta data from Bevy...", { id: "sync-all" });
      try {
        const result = await triggerSyncAction();
        if (result.success) {
          toast.success(
            `Sync complete! ${result.eventsSynced} events and ${result.membersSynced} members stored in Firestore.`,
            { id: "sync-all", duration: 4000 },
          );
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to sync Bevy data.", { id: "sync-all" });
        }
      } catch {
        toast.error("An unexpected error occurred during sync.", { id: "sync-all" });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <h1 className="font-semibold text-3xl tracking-tight">Welcome back, {displayName} 👋</h1>
        <p className="text-muted-foreground text-sm">
          Here is what is happening across GDG Jakarta events, community registrations, and members.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:w-fit">
        <Button size="sm" variant="outline" onClick={handleSyncAll} disabled={isPending} className="gap-1.5">
          <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
          {isPending ? "Syncing Bevy..." : "Sync Bevy Data"}
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
