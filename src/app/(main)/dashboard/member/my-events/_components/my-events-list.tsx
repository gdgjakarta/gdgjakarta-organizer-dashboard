"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CalendarCheck, Filter, Search, Sparkles, X } from "lucide-react";

import { EventCardItem } from "@/components/events/event-card-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEffectiveRegistrationStatus } from "@/lib/events/payment-deadline";
import { fetchMemberRegistrationsAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface MyEventsListProps {
  allEvents: FirestoreEvent[];
}

function isEventPast(event?: FirestoreEvent): boolean {
  if (!event) return false;
  if (event.status === "Completed") return true;
  const targetDate = event.end_date || event.start_date;
  if (!targetDate) return false;
  try {
    return new Date(targetDate).getTime() < Date.now();
  } catch {
    return false;
  }
}

export function MyEventsList({ allEvents }: MyEventsListProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>([]);
  const [extraEvents, setExtraEvents] = useState<FirestoreEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsResolvingEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function loadRegistrations() {
      if (isAuthLoading) return;
      if (!user) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const list = await fetchMemberRegistrationsAction(user.id, user.email);
        setRegistrations(list);
      } catch (err) {
        console.error("[MyEventsList] Failed to load member registrations:", err);
      } finally {
        setIsLoading(false);
      }
    }

    void loadRegistrations();
  }, [user, isAuthLoading]);

  // Resolve events that exist in registrations but are missing from Bevy allEvents
  useEffect(() => {
    let isCancelled = false;

    async function resolveMissingEvents() {
      if (registrations.length === 0) return;

      const knownIds = new Set([...allEvents.map((e) => String(e.id)), ...extraEvents.map((e) => String(e.id))]);
      const missingIds = Array.from(
        new Set(registrations.map((r) => String(r.event_id)).filter((id) => !knownIds.has(id))),
      );

      if (missingIds.length === 0) return;

      try {
        setIsResolvingEvents(true);
        const { getFirestoreEvents, getFirestoreEventById } = await import("@/lib/firestore/client");

        const foundMap = new Map<string, FirestoreEvent>();

        // 1. Fetch top Firestore events
        const fsEvents = await getFirestoreEvents(100);
        for (const fe of fsEvents) {
          foundMap.set(String(fe.id), fe);
        }

        // 2. Fetch specific missing docs individually if not found in batch
        const stillMissing = missingIds.filter((id) => !foundMap.has(id));
        if (stillMissing.length > 0) {
          const singleFetches = await Promise.all(
            stillMissing.map(async (id) => {
              try {
                return await getFirestoreEventById(id);
              } catch {
                return null;
              }
            }),
          );
          for (const item of singleFetches) {
            if (item) {
              foundMap.set(String(item.id), item);
            }
          }
        }

        if (!isCancelled && foundMap.size > 0) {
          setExtraEvents((prev) => {
            const prevMap = new Map(prev.map((e) => [String(e.id), e]));
            for (const [id, event] of foundMap.entries()) {
              prevMap.set(id, event);
            }
            return Array.from(prevMap.values());
          });
        }
      } catch (err) {
        console.warn("[MyEventsList] Failed to resolve missing events from Firestore:", err);
      } finally {
        if (!isCancelled) {
          setIsResolvingEvents(false);
        }
      }
    }

    void resolveMissingEvents();

    return () => {
      isCancelled = true;
    };
  }, [registrations, allEvents, extraEvents]);

  const eventMap = useMemo(() => {
    const map = new Map<string, FirestoreEvent>();
    for (const ev of allEvents) {
      map.set(String(ev.id), ev);
    }
    for (const ev of extraEvents) {
      const existing = map.get(String(ev.id));
      map.set(String(ev.id), {
        ...existing,
        ...ev,
        picture_url: ev.picture_url || ev.banner_url || existing?.picture_url,
        banner_url: ev.banner_url || ev.picture_url || existing?.banner_url,
      });
    }
    return map;
  }, [allEvents, extraEvents]);

  const handleRegistrationUpdated = (updated: FirestoreRegistration) => {
    setRegistrations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  // Metrics summary
  const totalCount = registrations.length;
  const pendingCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "pending" || s === "waitlisted" || s === "paid_waitlisted";
  }).length;
  const waitingPaymentCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "waiting_for_payment";
  }).length;
  const paidCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "paid_and_registered";
  }).length;
  const approvedCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "approved" || s === "paid_and_registered" || s === "registered";
  }).length;
  const attendedCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "attended" || Boolean(r.is_checked_in);
  }).length;
  const expiredCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "expired" || s === "failed" || s === "canceled" || s === "cancelled";
  }).length;

  // Filter registrations by search and status
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      const ev = eventMap.get(String(reg.event_id));
      const effectiveStatus = getEffectiveRegistrationStatus(reg, ev);

      if (statusFilter !== "all") {
        if (statusFilter === "approved") {
          if (
            effectiveStatus !== "approved" &&
            effectiveStatus !== "paid_and_registered" &&
            effectiveStatus !== "registered"
          ) {
            return false;
          }
        } else if (statusFilter === "pending") {
          if (
            effectiveStatus !== "pending" &&
            effectiveStatus !== "waitlisted" &&
            effectiveStatus !== "paid_waitlisted"
          ) {
            return false;
          }
        } else if (statusFilter === "waiting_for_payment") {
          if (effectiveStatus !== "waiting_for_payment") {
            return false;
          }
        } else if (statusFilter === "paid_and_registered") {
          if (effectiveStatus !== "paid_and_registered") {
            return false;
          }
        } else if (statusFilter === "attended") {
          if (effectiveStatus !== "attended" && !reg.is_checked_in) {
            return false;
          }
        } else if (statusFilter === "expired") {
          if (
            effectiveStatus !== "expired" &&
            effectiveStatus !== "failed" &&
            effectiveStatus !== "canceled" &&
            effectiveStatus !== "cancelled"
          ) {
            return false;
          }
        } else if (effectiveStatus !== statusFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = reg.event_title.toLowerCase().includes(query);
        const trackMatch = reg.session_title?.toLowerCase().includes(query);
        const invoiceMatch = reg.payment_invoice_number?.toLowerCase().includes(query);
        const ticketMatch =
          reg.ticket_tier?.toLowerCase().includes(query) || reg.ticket_name?.toLowerCase().includes(query);
        if (!titleMatch && !trackMatch && !invoiceMatch && !ticketMatch) {
          return false;
        }
      }
      return true;
    });
  }, [registrations, statusFilter, searchQuery, eventMap]);

  // Segment registrations
  const upcomingRegs = useMemo(() => {
    return filteredRegistrations.filter((reg) => {
      const ev = eventMap.get(String(reg.event_id));
      return !isEventPast(ev) && reg.status !== "attended" && !reg.is_checked_in;
    });
  }, [filteredRegistrations, eventMap]);

  const pastRegs = useMemo(() => {
    return filteredRegistrations.filter((reg) => {
      const ev = eventMap.get(String(reg.event_id));
      return isEventPast(ev) || reg.status === "attended" || Boolean(reg.is_checked_in);
    });
  }, [filteredRegistrations, eventMap]);

  const renderRegistrationGrid = (items: FirestoreRegistration[]) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <Card key={key} className="overflow-hidden border-border/60">
              <div className="relative aspect-video w-full bg-muted/60">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
              <CardHeader className="space-y-2 p-4">
                <div className="h-5 w-24 rounded-md bg-muted/60" />
                <div className="h-6 w-3/4 rounded-md bg-muted/60" />
                <div className="h-4 w-1/2 rounded-md bg-muted/60" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="h-4 w-full rounded-md bg-muted/40" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-border/80 border-dashed p-12 text-center text-muted-foreground">
          <CalendarCheck className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <h3 className="font-semibold text-foreground text-lg">No events found in this category</h3>
          <p className="mt-1 text-sm">
            {searchQuery || statusFilter !== "all"
              ? "No registered events match your active filters."
              : "You haven't registered for any events matching this category yet."}
          </p>
          {searchQuery || statusFilter !== "all" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="mt-4 gap-1.5 text-xs"
            >
              <X className="size-3.5" />
              Clear Filters
            </Button>
          ) : (
            <Button asChild className="mt-4 gap-1.5" size="sm">
              <Link href="/dashboard/member">
                <Sparkles className="size-3.5" />
                Explore Upcoming Events
              </Link>
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((reg, index) => {
          const ev = eventMap.get(String(reg.event_id));
          return (
            <EventCardItem
              key={reg.id}
              event={ev}
              registration={reg}
              index={index}
              fromPath={pathname || "/dashboard/member/my-events"}
              onRegistrationUpdated={handleRegistrationUpdated}
              onRegistrationCancelled={(cancelledId) => {
                setRegistrations((prev) => prev.filter((r) => r.id !== cancelledId));
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">My Events & RSVPs 🎟️</h1>
          <p className="text-muted-foreground text-sm">
            Manage GDG Jakarta events you registered for. Edit your form inputs anytime before applications are approved
            or rejected.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-medium text-xs">
            {totalCount} Total Registered
          </Badge>
        </div>
      </div>

      {/* ── Summary Stats Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={cn(
            "rounded-xl border p-3 text-left shadow-2xs transition-all hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            statusFilter === "all" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border/60 bg-card",
          )}
        >
          <p className="text-[11px] text-muted-foreground">Total Applications</p>
          <p className="font-bold text-foreground text-xl">{totalCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("pending")}
          className={cn(
            "rounded-xl border p-3 text-left shadow-2xs transition-all hover:border-amber-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
            statusFilter === "pending"
              ? "border-amber-500 bg-amber-500/15 ring-1 ring-amber-500/40"
              : "border-amber-500/30 bg-amber-500/5",
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-amber-700 dark:text-amber-300">Pending Review</p>
            <Badge
              variant="outline"
              className="h-4 border-amber-500/40 px-1 font-normal text-[9px] text-amber-600 dark:text-amber-400"
            >
              Editable
            </Badge>
          </div>
          <p className="font-bold text-amber-700 text-xl dark:text-amber-300">{pendingCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("waiting_for_payment")}
          className={cn(
            "rounded-xl border p-3 text-left shadow-2xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600",
            waitingPaymentCount > 0
              ? "border-amber-600/50 bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-950/20"
              : "border-border/60 bg-card hover:bg-muted/30",
            statusFilter === "waiting_for_payment" && "border-amber-600 bg-amber-500/20 ring-1 ring-amber-600/40",
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-amber-800 dark:text-amber-200">Waiting Payment</p>
            {waitingPaymentCount > 0 && (
              <Badge
                variant="outline"
                className="h-4 animate-pulse border-amber-600/50 bg-amber-600/20 px-1 font-semibold text-[9px] text-amber-700 dark:text-amber-300"
              >
                Pay Now
              </Badge>
            )}
          </div>
          <p className="font-bold text-amber-800 text-xl dark:text-amber-200">{waitingPaymentCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("approved")}
          className={cn(
            "rounded-xl border p-3 text-left shadow-2xs transition-all hover:border-emerald-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
            statusFilter === "approved"
              ? "border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/40"
              : "border-emerald-500/30 bg-emerald-500/5",
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Confirmed / Paid</p>
            {paidCount > 0 && (
              <Badge
                variant="outline"
                className="h-4 border-emerald-500/40 px-1 font-normal text-[9px] text-emerald-600 dark:text-emerald-400"
              >
                {paidCount} Paid
              </Badge>
            )}
          </div>
          <p className="font-bold text-emerald-700 text-xl dark:text-emerald-300">{approvedCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("attended")}
          className={cn(
            "rounded-xl border p-3 text-left shadow-2xs transition-all hover:border-purple-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
            statusFilter === "attended"
              ? "border-purple-500 bg-purple-500/15 ring-1 ring-purple-500/40"
              : "border-purple-500/30 bg-purple-500/5",
          )}
        >
          <p className="text-[11px] text-purple-700 dark:text-purple-300">Attended</p>
          <p className="font-bold text-purple-700 text-xl dark:text-purple-300">{attendedCount}</p>
        </button>
      </div>

      {/* ── Search & Filter Controls ──────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by event title, track, or ticket..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[190px] text-xs">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses ({totalCount})</SelectItem>
              <SelectItem value="waiting_for_payment">Waiting for Payment ({waitingPaymentCount})</SelectItem>
              <SelectItem value="pending">Pending Review ({pendingCount})</SelectItem>
              <SelectItem value="approved">Confirmed / Approved ({approvedCount})</SelectItem>
              <SelectItem value="paid_and_registered">Paid & Registered ({paidCount})</SelectItem>
              <SelectItem value="attended">Attended ({attendedCount})</SelectItem>
              {expiredCount > 0 && <SelectItem value="expired">Expired / Cancelled ({expiredCount})</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Tabs (All / Upcoming / Past) ──────────────────────────────── */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-[420px]">
          <TabsTrigger value="all" className="gap-1.5 text-xs sm:text-sm">
            All ({filteredRegistrations.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1.5 text-xs sm:text-sm">
            Upcoming ({upcomingRegs.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5 text-xs sm:text-sm">
            Past & Attended ({pastRegs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {renderRegistrationGrid(filteredRegistrations)}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          {renderRegistrationGrid(upcomingRegs)}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {renderRegistrationGrid(pastRegs)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
