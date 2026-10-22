"use client";

import { useEffect, useState } from "react";

import { Calendar } from "lucide-react";

import { EventCardItem } from "@/components/events/event-card-item";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchMemberRegistrationsAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface MemberEventsListProps {
  events: FirestoreEvent[];
  myRegistrations?: FirestoreRegistration[];
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

export function MemberEventsList({ events, myRegistrations = [] }: MemberEventsListProps) {
  const user = useAuthStore((s) => s.user);
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>(myRegistrations);
  const [resolvedEvents, setResolvedEvents] = useState<FirestoreEvent[]>(events);

  // Sync prop events into resolvedEvents, but never overwrite non-empty events with empty array
  useEffect(() => {
    if (events.length > 0) {
      setResolvedEvents(events);
    }
  }, [events]);

  // Client-side fallback: If events is empty on mount or after wake-up, fetch published events
  useEffect(() => {
    let isCancelled = false;

    async function recoverEvents() {
      if (resolvedEvents.length > 0) return;

      try {
        const { fetchBevyChapterEventsAction } = await import("@/server/bevy-actions");
        const res = await fetchBevyChapterEventsAction(100, 1, true, "Published");
        if (!isCancelled && res?.results && res.results.length > 0) {
          const { resolveEventAudience } = await import("@/lib/bevy/client");
          const mapped: FirestoreEvent[] = res.results.map((e) => {
            const { audienceType, isVirtual } = resolveEventAudience(e.audience_type, e.is_virtual_event);
            return {
              id: String(e.id),
              title: e.title || "Untitled Event",
              description: e.description,
              description_short: e.description_short,
              status: (e.status as FirestoreEvent["status"]) || "Published",
              start_date: e.start_date || new Date().toISOString(),
              end_date: e.end_date || e.start_date || new Date().toISOString(),
              picture_url:
                e.picture?.url ||
                e.picture?.thumbnail_url ||
                e.cropped_picture_url ||
                e.banner?.url ||
                e.banner?.thumbnail_url ||
                e.cropped_banner_url ||
                undefined,
              banner_url:
                e.banner?.url ||
                e.banner?.thumbnail_url ||
                e.cropped_banner_url ||
                e.picture?.url ||
                e.cropped_picture_url ||
                undefined,
              event_type_title: e.event_type_title || "Standard Event",
              audience_type: audienceType,
              is_virtual: isVirtual,
              venue:
                e.venue_name || e.venue_address || e.venue_city
                  ? {
                      name: e.venue_name,
                      address: e.venue_address,
                      city: e.venue_city,
                    }
                  : undefined,
              url: e.url,
              static_url: e.static_url,
              tags: e.tags || [],
              requires_approval: false,
              total_registrations: e.total_attendees ?? 0,
              total_approved: e.total_attendees ?? 0,
              total_checked_in: e.checkin_count ?? 0,
              is_hidden: Boolean(e.is_hidden || (e as { hidden?: boolean }).hidden),
              is_test: Boolean(e.is_test),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          });
          setResolvedEvents(mapped);
          return;
        }

        // Secondary fallback to Firestore events collection
        const { getFirestoreEvents } = await import("@/lib/firestore/client");
        const fsEvents = await getFirestoreEvents(100);
        if (!isCancelled && fsEvents.length > 0) {
          setResolvedEvents(fsEvents);
        }
      } catch (err) {
        console.warn("[MemberEventsList] Client event recovery failed:", err);
      }
    }

    void recoverEvents();

    return () => {
      isCancelled = true;
    };
  }, [resolvedEvents.length]);

  useEffect(() => {
    async function loadUserRegistrations() {
      if (!user) return;
      try {
        const list = await fetchMemberRegistrationsAction(user.id, user.email);
        if (list.length > 0) {
          setRegistrations(list);
        }
      } catch (err) {
        console.error("[MemberEventsList] Failed to load user registrations:", err);
      }
    }

    void loadUserRegistrations();
  }, [user]);

  const registrationMap = new Map<string, FirestoreRegistration>();
  for (const reg of registrations) {
    registrationMap.set(String(reg.event_id), reg);
  }

  const visibleEvents = resolvedEvents.filter((e) =>
    e.status ? e.status.toLowerCase() === "published" || e.status === "Completed" : true,
  );
  const publishedEvents = visibleEvents.filter((e) => e.status === "Published" || e.status === "Completed");
  const upcomingEvents = publishedEvents.filter((e) => !isEventPast(e));
  const pastEvents = publishedEvents.filter((e) => isEventPast(e));

  const renderEventGrid = (items: FirestoreEvent[]) => {
    if (items.length === 0) {
      return (
        <div className="col-span-full rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Calendar className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <h3 className="font-semibold text-foreground text-lg">No events in this category</h3>
          <p className="mt-1 text-sm">Check back soon for new GDG Jakarta sessions and announcements.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((event, index) => {
          const existingReg = registrationMap.get(String(event.id));

          return (
            <EventCardItem
              key={event.id}
              event={event}
              registration={existingReg}
              priority={index < 3}
              loading={index < 3 ? "eager" : "lazy"}
              fromPath="/dashboard/member"
              onRegistrationUpdated={(updatedReg) => {
                setRegistrations((prev) => [
                  ...prev.filter((r) => r.event_id !== updatedReg.event_id && r.id !== updatedReg.id),
                  updatedReg,
                ]);
              }}
              onRegistrationCancelled={(cancelledId) => {
                setRegistrations((prev) => prev.filter((r) => r.id !== cancelledId));
              }}
            />
          );
        })}
      </div>
    );
  };

  const defaultTab = upcomingEvents.length > 0 ? "upcoming" : "all";

  return (
    <div className="space-y-6">
      {/* Header Greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
            Welcome, {user?.name?.split(" ")[0] || "Member"} 👋
          </h1>
          <p className="text-muted-foreground text-sm">
            Browse GDG Jakarta events, register for sessions, and access event materials.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-medium text-muted-foreground text-xs">
            {registrations.length} Events Registered
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-[420px]">
          <TabsTrigger value="all" className="gap-1.5 text-xs sm:text-sm">
            All Events ({publishedEvents.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1.5 text-xs sm:text-sm">
            Upcoming ({upcomingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5 text-xs sm:text-sm">
            Past ({pastEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {renderEventGrid(publishedEvents)}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          {renderEventGrid(upcomingEvents)}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {renderEventGrid(pastEvents)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
