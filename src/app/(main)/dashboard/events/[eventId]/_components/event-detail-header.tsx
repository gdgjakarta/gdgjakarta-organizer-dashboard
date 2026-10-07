"use client";

import { useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  MapPin,
  Radio,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBevyLiveEventUrl, getBevyManageEventUrl } from "@/config/remote-config-utils";
import { resolveEventAudience } from "@/lib/bevy/audience";
import { triggerEventsSyncAction } from "@/lib/firestore/actions";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface EventDetailHeaderProps {
  event: FirestoreEvent;
  totalRegistrations: number;
  totalApproved: number;
}

export function EventDetailHeader({ event, totalRegistrations, totalApproved }: EventDetailHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSync = () => {
    startTransition(async () => {
      toast.loading("Syncing latest event data from Bevy...", { id: "sync-detail" });
      try {
        const result = await triggerEventsSyncAction();
        if (result.success) {
          toast.success("Event updated successfully!", { id: "sync-detail" });
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to sync event.", { id: "sync-detail" });
        }
      } catch {
        toast.error("An error occurred during sync.", { id: "sync-detail" });
      }
    });
  };

  let formattedDate = event.start_date;
  try {
    formattedDate = format(parseISO(event.start_date), "EEEE, dd MMMM yyyy • h:mm a");
  } catch {
    // Keep raw string
  }

  const { isVirtual, isHybrid } = resolveEventAudience(event.audience_type, event.is_virtual);
  const liveBevyUrl = getBevyLiveEventUrl(event);

  const handleCopyLivePage = () => {
    if (!event.id) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const liveUrl = `${origin}/dashboard/member/events/${event.id}`;
    void navigator.clipboard.writeText(liveUrl);
    toast.success("Live page link copied to clipboard");
  };

  const handleCopyLiveBevyPage = () => {
    if (!liveBevyUrl) return;
    void navigator.clipboard.writeText(liveBevyUrl);
    toast.success("Live Bevy page link copied to clipboard");
  };

  return (
    <div className="flex flex-col gap-4 border-b pb-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/events">
            <ArrowLeft className="size-4" />
            Back to Events
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "border px-2 py-0.5 font-medium text-xs",
                event.status === "Published" &&
                  "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                event.status === "Draft" && "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                event.status === "Completed" && "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
                event.status === "Canceled" && "border-destructive/20 bg-destructive/10 text-destructive",
              )}
            >
              {event.status}
            </Badge>

            {event.is_test ? (
              <Badge
                variant="outline"
                className="border-purple-500/20 bg-purple-500/10 px-2 py-0.5 font-medium text-purple-600 text-xs dark:text-purple-400"
              >
                Test
              </Badge>
            ) : null}

            {isVirtual && (
              <Badge
                variant="outline"
                className="gap-1 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
              >
                <Radio className="size-3" />
                Virtual
              </Badge>
            )}

            {isHybrid && (
              <Badge
                variant="outline"
                className="gap-1 border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400"
              >
                <Globe className="size-3" />
                Hybrid
              </Badge>
            )}

            {!isVirtual && !isHybrid && (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              >
                <MapPin className="size-3" />
                In-Person
              </Badge>
            )}

            {event.event_type_title && (
              <Badge variant="secondary" className="font-normal text-xs">
                {event.event_type_title}
              </Badge>
            )}
          </div>

          <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">{event.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-4" />
              {formattedDate}
            </span>
            {event.venue?.name && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {event.venue.name}
                    {event.venue.city ? `, ${event.venue.city}` : ""}
                  </span>
                </span>
              </>
            )}
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Users className="size-4" />
              <strong className="text-foreground">{totalRegistrations}</strong> Total Registrants
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              <strong>{totalApproved}</strong> Approved
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={isPending} className="gap-1.5">
            <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
            Sync
          </Button>

          {event.id && (
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href={`/dashboard/member/events/${event.id}`} target="_blank" rel="noopener noreferrer">
                <Eye className="size-3.5" />
                Preview Live Page
              </Link>
            </Button>
          )}

          {liveBevyUrl && (
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={liveBevyUrl} target="_blank" rel="noopener noreferrer">
                <Globe className="size-3.5" />
                Preview Live Bevy Page
              </a>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Copy className="size-3.5" />
                Copy Link
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {event.id && (
                <DropdownMenuItem onClick={handleCopyLivePage}>
                  <Copy className="mr-2 size-3.5" />
                  Copy Link Live Page
                </DropdownMenuItem>
              )}
              {liveBevyUrl && (
                <DropdownMenuItem onClick={handleCopyLiveBevyPage}>
                  <Globe className="mr-2 size-3.5" />
                  Copy Link Live Bevy Page
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" asChild className="gap-1.5">
            <a href={getBevyManageEventUrl(event.id)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Manage in Bevy
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
