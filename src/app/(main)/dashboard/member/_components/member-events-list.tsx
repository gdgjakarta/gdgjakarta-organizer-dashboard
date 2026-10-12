"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { format, parseISO } from "date-fns";
import { Calendar, Clock, Globe, MapPin, Radio } from "lucide-react";

import { EventCardImage } from "@/components/event-card-image";
import { EventRegistrationModal } from "@/components/event-registration-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveEventAudience } from "@/lib/bevy/audience";
import { extractEventImageUrl } from "@/lib/events/media-utils";
import { getEffectiveRegistrationStatus } from "@/lib/events/payment-deadline";
import { fetchMemberRegistrationsAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
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

  const visibleEvents = events.filter(
    (e) =>
      !e.is_hidden &&
      !(e as { hidden?: boolean }).hidden &&
      (e.status ? e.status.toLowerCase() === "published" || e.status === "Completed" : true),
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
        {items.map((event) => {
          const existingReg = registrationMap.get(String(event.id));
          const effectiveRegStatus = existingReg ? getEffectiveRegistrationStatus(existingReg, event) : null;
          const isPast = isEventPast(event);

          let formattedDate = event.start_date;
          try {
            formattedDate = format(parseISO(event.start_date), "dd MMM yyyy • h:mm a");
          } catch {
            // Keep raw string
          }

          return (
            <Card
              key={event.id}
              className={cn(
                "group flex flex-col justify-between overflow-hidden shadow-xs transition-all hover:shadow-md",
                effectiveRegStatus === "waiting_for_payment" &&
                  "border-amber-500/50 ring-1 ring-amber-500/20 dark:border-amber-500/40",
                effectiveRegStatus === "paid_and_registered" && "border-emerald-500/30",
              )}
            >
              <div>
                {/* Event Thumbnail with Dynamic Link */}
                <Link href={`/dashboard/member/events/${event.id}`} className="block">
                  <EventCardImage
                    src={extractEventImageUrl(event as unknown as Record<string, unknown>)}
                    alt={event.title}
                    className="transition-transform duration-300 group-hover:scale-105"
                  >
                    <div className="absolute top-3 left-3 z-20 flex gap-1.5">
                      <Badge variant="secondary" className="bg-background/85 text-[10px] backdrop-blur-xs">
                        {(() => {
                          const { isVirtual, isHybrid } = resolveEventAudience(event.audience_type, event.is_virtual);
                          if (isVirtual) {
                            return (
                              <span className="flex items-center gap-1 text-blue-500">
                                <Radio className="size-3" /> Virtual
                              </span>
                            );
                          }
                          if (isHybrid) {
                            return (
                              <span className="flex items-center gap-1 text-purple-500">
                                <Globe className="size-3" /> Hybrid
                              </span>
                            );
                          }
                          return (
                            <span className="flex items-center gap-1 text-emerald-500">
                              <MapPin className="size-3" /> In-Person
                            </span>
                          );
                        })()}
                      </Badge>
                      <Badge variant="secondary" className="bg-background/85 text-[10px] backdrop-blur-xs">
                        {isPast ? "Concluded" : "Upcoming"}
                      </Badge>
                      {event.is_test ? (
                        <Badge
                          variant="outline"
                          className="border-purple-500/30 bg-purple-500/20 text-[10px] text-purple-700 backdrop-blur-xs dark:text-purple-300"
                        >
                          Test
                        </Badge>
                      ) : null}
                    </div>
                  </EventCardImage>
                </Link>

                <CardHeader className="space-y-2 p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 font-semibold text-base leading-snug">
                      <Link
                        href={`/dashboard/member/events/${event.id}`}
                        className="transition-colors hover:text-primary hover:underline"
                      >
                        {event.title}
                      </Link>
                    </CardTitle>
                    {effectiveRegStatus && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 px-2 py-0.5 text-[10px] font-semibold",
                          effectiveRegStatus === "waiting_for_payment" &&
                            "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
                          effectiveRegStatus === "paid_and_registered" &&
                            "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                          (effectiveRegStatus === "approved" || effectiveRegStatus === "registered") &&
                            "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                          effectiveRegStatus === "pending" &&
                            "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                          effectiveRegStatus === "waitlisted" &&
                            "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                          effectiveRegStatus === "expired" &&
                            "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-400",
                        )}
                      >
                        {(() => {
                          switch (effectiveRegStatus) {
                            case "waiting_for_payment":
                              return "Waiting Payment";
                            case "paid_and_registered":
                              return "Paid & Registered";
                            case "approved":
                            case "registered":
                              return "Confirmed";
                            case "pending":
                              return "Pending Review";
                            case "waitlisted":
                              return "Waitlisted";
                            case "expired":
                              return "Expired";
                            default:
                              return effectiveRegStatus;
                          }
                        })()}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Clock className="size-3.5 text-muted-foreground" />
                    {formattedDate}
                  </CardDescription>
                </CardHeader>

                <CardContent className="px-4 pb-4">
                  <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                    {event.description_short ||
                      event.description ||
                      "Join GDG Jakarta developers for this interactive session."}
                  </p>
                </CardContent>
              </div>

              <CardFooter className="mt-2 flex items-center justify-between bg-muted/10 p-4 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
                >
                  <Link href={`/dashboard/member/events/${event.id}`}>View Details →</Link>
                </Button>

                <EventRegistrationModal
                  event={event}
                  existingRegistration={existingReg}
                  onSuccess={(newReg) => {
                    setRegistrations((prev) => [...prev.filter((r) => r.event_id !== newReg.event_id), newReg]);
                  }}
                />
              </CardFooter>
            </Card>
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
