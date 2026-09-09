"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { format, parseISO } from "date-fns";
import { Calendar, Clock, MapPin, Radio } from "lucide-react";

import { EventRegistrationModal } from "@/components/event-registration-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { fetchMemberRegistrationsAction } from "@/server/firestore-actions";
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

  const publishedEvents = events.filter((e) => e.status === "Published" || e.status === "Completed");
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
              className="group flex flex-col justify-between overflow-hidden border transition-all hover:border-primary/40 hover:shadow-sm"
            >
              <div>
                {/* Event Thumbnail with Dynamic Link */}
                <Link href={`/dashboard/member/events/${event.id}`} className="block">
                  <div className="relative aspect-video w-full overflow-hidden bg-muted/60">
                    {event.picture_url || event.banner_url ? (
                      <Image
                        src={event.picture_url ?? event.banner_url ?? ""}
                        alt={event.title}
                        fill
                        unoptimized
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Calendar className="size-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      <Badge variant="secondary" className="bg-background/85 text-[10px] backdrop-blur-xs">
                        {event.is_virtual ? (
                          <span className="flex items-center gap-1 text-blue-500">
                            <Radio className="size-3" /> Virtual
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-500">
                            <MapPin className="size-3" /> In-Person
                          </span>
                        )}
                      </Badge>
                      <Badge variant="secondary" className="bg-background/85 text-[10px] backdrop-blur-xs">
                        {isPast ? "Concluded" : "Upcoming"}
                      </Badge>
                    </div>
                  </div>
                </Link>

                <CardHeader className="space-y-2 p-4 pb-2">
                  <CardTitle className="line-clamp-2 font-semibold text-base leading-snug">
                    <Link
                      href={`/dashboard/member/events/${event.id}`}
                      className="transition-colors hover:text-primary hover:underline"
                    >
                      {event.title}
                    </Link>
                  </CardTitle>
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

              <CardFooter className="mt-2 flex items-center justify-between border-t bg-muted/10 p-4 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
                >
                  <Link href={`/dashboard/member/events/${event.id}`}>View Details →</Link>
                </Button>

                <EventRegistrationModal event={event} existingRegistration={existingReg} />
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
