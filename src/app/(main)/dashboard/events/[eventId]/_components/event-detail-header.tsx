"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  Globe,
  Hourglass,
  MapPin,
  QrCode,
  Radio,
  RefreshCw,
  RotateCcw,
  TrendingDown,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Shimmer } from "@/components/shimmer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBevyLiveEventUrl, getBevyManageEventUrl } from "@/config/remote-config-utils";
import { isExecutiveOrganizer } from "@/lib/auth-roles";
import { resolveEventAudience } from "@/lib/bevy/audience";
import { formatFirestoreDate } from "@/lib/date-utils";
import { isEventCurationMode } from "@/lib/events/payment-deadline";
import { expandRefundRecords } from "@/lib/events/refund-utils";
import { triggerEventsSyncAction } from "@/lib/firestore/actions";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { EventShortLinkButton } from "./event-short-link-button";

function getDropRateColorClass(rate: number): string {
  if (rate > 60) return "text-rose-600 dark:text-rose-400";
  if (rate > 35) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

interface EventDetailHeaderProps {
  event: FirestoreEvent;
  totalRegistrations: number;
  totalApproved: number;
  totalRejected?: number;
  totalPending?: number;
  totalWaitlisted?: number;
  totalCheckedIn?: number;
  totalRefunds?: number;
  initialRole?: string;
}

export function EventDetailHeader({
  event,
  totalRegistrations,
  totalApproved: initialTotalApproved,
  totalRejected = 0,
  totalPending = 0,
  totalWaitlisted = 0,
  totalCheckedIn: initialTotalCheckedIn = 0,
  totalRefunds: initialTotalRefunds = 0,
  initialRole,
}: EventDetailHeaderProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [isPending, startTransition] = useTransition();

  const [eventData, setEventData] = useState<FirestoreEvent>(event);

  useEffect(() => {
    setEventData(event);
  }, [event]);

  useEffect(() => {
    const targetEventId = String(event.id || "");
    if (!targetEventId) return;
    let unsubEvent: () => void = () => {
      // cleanup
    };
    void (async () => {
      try {
        const { subscribeFirestoreEventDoc } = await import("@/lib/firestore/client");
        unsubEvent = subscribeFirestoreEventDoc(targetEventId, (doc) => {
          if (doc) {
            setEventData((prev) => ({ ...prev, ...doc }));
          }
        });
      } catch (err) {
        console.warn("[EventDetailHeader] Could not subscribe to event doc:", err);
      }
    })();
    return () => unsubEvent();
  }, [event.id]);

  const isCurationMode = isEventCurationMode(eventData);

  const isOrganizer = useMemo(() => {
    if (user) {
      return isExecutiveOrganizer(user);
    }
    return isExecutiveOrganizer(initialRole);
  }, [user, initialRole]);
  const [liveTotals, setLiveTotals] = useState({
    totalRegistrations,
    totalApproved: initialTotalApproved,
    totalExpected: initialTotalApproved,
    totalRejected,
    totalPending,
    totalWaitlisted,
    totalCheckedIn: initialTotalCheckedIn > 0 ? initialTotalCheckedIn : event.total_checked_in,
    totalRefunds: initialTotalRefunds,
    totalRefundsPending: 0,
  });
  const [isLoadingTotals, setIsLoadingTotals] = useState(true);

  useEffect(() => {
    setLiveTotals((prev) => ({
      ...prev,
      totalRegistrations,
      totalApproved: initialTotalApproved,
      totalExpected: initialTotalApproved,
      totalRejected,
      totalPending,
      totalWaitlisted,
      totalCheckedIn: initialTotalCheckedIn > 0 ? initialTotalCheckedIn : event.total_checked_in,
      totalRefunds: initialTotalRefunds,
    }));
  }, [
    totalRegistrations,
    initialTotalApproved,
    totalRejected,
    totalPending,
    totalWaitlisted,
    initialTotalCheckedIn,
    initialTotalRefunds,
    event.total_checked_in,
  ]);

  useEffect(() => {
    const targetEventId = String(event.id || "");
    if (!targetEventId) {
      setIsLoadingTotals(false);
      return;
    }
    let unsubscribe: () => void = () => {
      // No-op initial cleanup
    };

    async function subscribeTotals() {
      try {
        const { getEventRegistrations, subscribeEventRegistrations } = await import("@/lib/firestore/client");

        // 1. Initial direct fetch
        const directList = await getEventRegistrations(targetEventId);
        if (directList) {
          const approvedCount = directList.filter((r) => {
            const s = (r.status || "").toLowerCase().trim();
            return s === "approved" || s === "attended" || s === "confirmed" || s === "registered";
          }).length;
          const expectedCount = directList.filter((r) => {
            const s = (r.status || "").toLowerCase().trim();
            return (
              s === "approved" ||
              s === "paid_and_registered" ||
              s === "attended" ||
              s === "confirmed" ||
              s === "registered"
            );
          }).length;
          const rejectedCount = directList.filter((r) => (r.status || "").toLowerCase().trim() === "rejected").length;
          const waitlistedCount = directList.filter(
            (r) => (r.status || "").toLowerCase().trim() === "waitlisted",
          ).length;
          const pendingCount = directList.filter((r) => {
            const s = (r.status || "").toLowerCase().trim();
            return s === "pending" || s === "applied" || s === "review" || !s;
          }).length;
          const checkedInCount = directList.filter((r) => {
            const s = (r.status || "").toLowerCase().trim();
            return Boolean(r.is_checked_in) || s === "attended";
          }).length;
          const refundsCount = expandRefundRecords(directList).length;
          const refundsPendingCount = directList.filter(
            (r) => r.refund_request?.status === "waiting_for_approval",
          ).length;

          setLiveTotals({
            totalRegistrations: directList.length,
            totalApproved: approvedCount,
            totalExpected: expectedCount,
            totalRejected: rejectedCount,
            totalPending: pendingCount,
            totalWaitlisted: waitlistedCount,
            totalCheckedIn: checkedInCount,
            totalRefunds: refundsCount,
            totalRefundsPending: refundsPendingCount,
          });
        }
        setIsLoadingTotals(false);

        // 2. Real-time subscription
        unsubscribe = subscribeEventRegistrations(targetEventId, (list) => {
          if (list) {
            const approvedCount = list.filter((r) => {
              const s = (r.status || "").toLowerCase().trim();
              return s === "approved" || s === "attended" || s === "confirmed" || s === "registered";
            }).length;
            const expectedCount = list.filter((r) => {
              const s = (r.status || "").toLowerCase().trim();
              return (
                s === "approved" ||
                s === "paid_and_registered" ||
                s === "attended" ||
                s === "confirmed" ||
                s === "registered"
              );
            }).length;
            const rejectedCount = list.filter((r) => (r.status || "").toLowerCase().trim() === "rejected").length;
            const waitlistedCount = list.filter((r) => (r.status || "").toLowerCase().trim() === "waitlisted").length;
            const pendingCount = list.filter((r) => {
              const s = (r.status || "").toLowerCase().trim();
              return s === "pending" || s === "applied" || s === "review" || !s;
            }).length;
            const checkedInCount = list.filter((r) => {
              const s = (r.status || "").toLowerCase().trim();
              return Boolean(r.is_checked_in) || s === "attended";
            }).length;
            const refundsCount = expandRefundRecords(list).length;
            const refundsPendingCount = list.filter((r) => r.refund_request?.status === "waiting_for_approval").length;

            setLiveTotals({
              totalRegistrations: list.length,
              totalApproved: approvedCount,
              totalExpected: expectedCount,
              totalRejected: rejectedCount,
              totalPending: pendingCount,
              totalWaitlisted: waitlistedCount,
              totalCheckedIn: checkedInCount,
              totalRefunds: refundsCount,
              totalRefundsPending: refundsPendingCount,
            });
            setIsLoadingTotals(false);
          }
        });
      } catch (err) {
        console.warn("[EventDetailHeader] Could not subscribe to live totals:", err);
        setIsLoadingTotals(false);
      }
    }

    void subscribeTotals();

    return () => {
      unsubscribe();
    };
  }, [event.id]);

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

  const formattedDate = formatFirestoreDate(event.start_date, "EEEE, dd MMMM yyyy • h:mm a");

  const { isVirtual, isHybrid } = resolveEventAudience(event.audience_type, event.is_virtual);
  const liveBevyUrl = getBevyLiveEventUrl(event);

  const totalExpected = liveTotals.totalExpected ?? liveTotals.totalApproved;
  const totalCheckedIn = liveTotals.totalCheckedIn;
  const droppedCount = Math.max(0, totalExpected - totalCheckedIn);
  const dropRateNumber = totalExpected > 0 ? (droppedCount / totalExpected) * 100 : 0;
  const formattedDropRate = `${dropRateNumber % 1 === 0 ? dropRateNumber.toFixed(0) : dropRateNumber.toFixed(1)}%`;

  const handleCopyLivePage = () => {
    if (!event.id) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const liveUrl = `${origin}/events/${event.id}`;
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
                <a
                  href={
                    event.google_maps_url ??
                    event.venue.google_maps_url ??
                    event.venue.url ??
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      [event.venue.name, event.venue.address, event.venue.city].filter(Boolean).join(", "),
                    )}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 transition-colors hover:text-foreground hover:underline"
                  title={`Open in Google Maps: ${[event.venue.name, event.venue.address, event.venue.city].filter(Boolean).join(", ")}`}
                >
                  <MapPin className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {event.venue.name}
                    {event.venue.city ? `, ${event.venue.city}` : ""}
                  </span>
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </>
            )}
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Users className="size-4" />
              {isLoadingTotals ? (
                <Shimmer className="inline-block h-4 w-7 rounded-xs align-middle" />
              ) : (
                <strong className="text-foreground">{liveTotals.totalRegistrations}</strong>
              )}{" "}
              Registrants
            </span>
            {isCurationMode && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  {isLoadingTotals ? (
                    <Shimmer className="inline-block h-4 w-6 rounded-xs align-middle" />
                  ) : (
                    <strong>{liveTotals.totalApproved}</strong>
                  )}{" "}
                  Approved
                </span>
              </>
            )}
            <span>•</span>
            <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
              <UserCheck className="size-4" />
              {isLoadingTotals ? (
                <Shimmer className="inline-block h-4 w-6 rounded-xs align-middle" />
              ) : (
                <strong>{liveTotals.totalCheckedIn}</strong>
              )}{" "}
              Checked In
            </span>
            {isCurationMode && !isLoadingTotals && totalExpected > 0 && (
              <>
                <span>•</span>
                <span
                  className={cn("flex items-center gap-1.5", getDropRateColorClass(dropRateNumber))}
                  title={`${droppedCount} confirmed attendee${droppedCount === 1 ? "" : "s"} not checked in`}
                >
                  <TrendingDown className="size-4" />
                  <strong>{formattedDropRate}</strong> Drop Rate
                  <span className="font-normal text-muted-foreground text-xs">({droppedCount} no-show)</span>
                </span>
              </>
            )}
            {isCurationMode && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Clock className="size-4" />
                  {isLoadingTotals ? (
                    <Shimmer className="inline-block h-4 w-6 rounded-xs align-middle" />
                  ) : (
                    <strong>{liveTotals.totalPending}</strong>
                  )}{" "}
                  Pending
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Hourglass className="size-4" />
                  {isLoadingTotals ? (
                    <Shimmer className="inline-block h-4 w-6 rounded-xs align-middle" />
                  ) : (
                    <strong>{liveTotals.totalWaitlisted}</strong>
                  )}{" "}
                  Waitlisted
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-destructive">
                  <XCircle className="size-4" />
                  {isLoadingTotals ? (
                    <Shimmer className="inline-block h-4 w-6 rounded-xs align-middle" />
                  ) : (
                    <strong>{liveTotals.totalRejected}</strong>
                  )}{" "}
                  Rejected
                </span>
                <span>•</span>
                <span
                  className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400"
                  title={`${liveTotals.totalRefunds} refund request${liveTotals.totalRefunds === 1 ? "" : "s"}${
                    liveTotals.totalRefundsPending > 0
                      ? ` (${liveTotals.totalRefundsPending} waiting for approval)`
                      : ""
                  }`}
                >
                  <RotateCcw className="size-4" />
                  {isLoadingTotals ? (
                    <Shimmer className="inline-block h-4 w-6 rounded-xs align-middle" />
                  ) : (
                    <strong>{liveTotals.totalRefunds}</strong>
                  )}{" "}
                  Refunds
                  {!isLoadingTotals && liveTotals.totalRefundsPending > 0 && (
                    <span className="font-normal text-muted-foreground text-xs">
                      ({liveTotals.totalRefundsPending} pending)
                    </span>
                  )}
                </span>
              </>
            )}
            {!isCurationMode && liveTotals.totalRefunds > 0 && (
              <>
                <span>•</span>
                <span
                  className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400"
                  title={`${liveTotals.totalRefunds} refund request${liveTotals.totalRefunds === 1 ? "" : "s"}`}
                >
                  <RotateCcw className="size-4" />
                  {isLoadingTotals ? (
                    <Shimmer className="inline-block h-4 w-6 rounded-xs align-middle" />
                  ) : (
                    <strong>{liveTotals.totalRefunds}</strong>
                  )}{" "}
                  Refunds
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={isPending} className="gap-1.5">
            <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
            Sync
          </Button>

          <EventShortLinkButton event={event} isOrganizer={isOrganizer} />

          {(event.id || liveBevyUrl) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Eye className="size-3.5" />
                  <span className="hidden sm:inline">Preview & Share</span>
                  <span className="sm:hidden">Preview</span>
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {event.id && (
                  <>
                    <DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
                      Community Live Page
                    </DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href={`/events/${event.id}`} target="_blank" rel="noopener noreferrer">
                        <Eye className="mr-2 size-3.5" />
                        Open Live Page
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyLivePage}>
                      <Copy className="mr-2 size-3.5" />
                      Copy Live Page Link
                    </DropdownMenuItem>
                  </>
                )}

                {liveBevyUrl && (
                  <>
                    {event.id && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
                      Bevy Chapter Page
                    </DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <a href={liveBevyUrl} target="_blank" rel="noopener noreferrer">
                        <Globe className="mr-2 size-3.5" />
                        Open Bevy Page
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyLiveBevyPage}>
                      <Copy className="mr-2 size-3.5" />
                      Copy Bevy Page Link
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isOrganizer && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CreditCard className="size-3.5" />
                  <span className="hidden sm:inline">DOKU Portals</span>
                  <span className="sm:hidden">DOKU</span>
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
                  Simulator & Testing
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <a href="https://sandbox.doku.com/qris-simulator/customer" target="_blank" rel="noopener noreferrer">
                    <QrCode className="mr-2 size-3.5 text-primary" />
                    DOKU QRIS Simulator
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="https://sandbox.doku.com/bo/dashboard" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 size-3.5 text-amber-500" />
                    DOKU Sandbox Dashboard
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
                  Live Back-Office
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <a href="https://dashboard.doku.com/bo/dashboard" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 size-3.5 text-emerald-600 dark:text-emerald-400" />
                    DOKU Production Dashboard
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button size="sm" asChild className="gap-1.5">
            <a href={getBevyManageEventUrl(event.id)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">Manage in Bevy</span>
              <span className="sm:hidden">Bevy</span>
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
