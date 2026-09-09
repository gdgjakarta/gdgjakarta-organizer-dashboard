"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { format, parseISO } from "date-fns";
import { Calendar, CalendarCheck, Clock, ExternalLink, MapPin, Radio, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FirestoreEvent, FirestoreRegistration, RegistrationStatus } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import { fetchMemberRegistrationsAction } from "@/server/firestore-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface MyEventsListProps {
  allEvents: FirestoreEvent[];
}

const STATUS_VARIANTS: Record<RegistrationStatus, { label: string; badgeClass: string }> = {
  pending: {
    label: "Pending Review",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  approved: {
    label: "Confirmed / Approved",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  rejected: {
    label: "Not Selected",
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  waitlisted: {
    label: "Waitlisted",
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  attended: {
    label: "Attended",
    badgeClass: "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
};

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
  const user = useAuthStore((s) => s.user);
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadRegistrations() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      try {
        const list = await fetchMemberRegistrationsAction(user.id, user.email);
        setRegistrations(list);
      } catch (err) {
        console.error("[MyEventsList] Failed to load member registrations:", err);
      } finally {
        setIsLoading(false);
      }
    }

    void loadRegistrations();
  }, [user]);

  const eventMap = new Map<string, FirestoreEvent>();
  for (const ev of allEvents) {
    eventMap.set(String(ev.id), ev);
  }

  // Segment registrations
  const upcomingRegs = registrations.filter((reg) => {
    const ev = eventMap.get(String(reg.event_id));
    return !isEventPast(ev);
  });

  const pastRegs = registrations.filter((reg) => {
    const ev = eventMap.get(String(reg.event_id));
    return isEventPast(ev) || reg.status === "attended";
  });

  const renderRegistrationGrid = (items: FirestoreRegistration[]) => {
    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <CalendarCheck className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <h3 className="font-semibold text-foreground text-lg">No events found in this section</h3>
          <p className="mt-1 text-sm">You haven&apos;t registered for any events matching this category yet.</p>
          <Button asChild className="mt-4 gap-1.5" size="sm">
            <Link href="/dashboard/member">
              <Sparkles className="size-3.5" />
              Explore Upcoming Events
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((reg) => {
          const ev = eventMap.get(String(reg.event_id));
          const statusMeta = STATUS_VARIANTS[reg.status] || STATUS_VARIANTS.pending;

          let formattedDate = ev?.start_date || reg.registered_at;
          try {
            if (ev?.start_date) {
              formattedDate = format(parseISO(ev.start_date), "dd MMM yyyy • h:mm a");
            } else if (reg.registered_at) {
              formattedDate = format(parseISO(reg.registered_at), "dd MMM yyyy");
            }
          } catch {
            // Keep raw string
          }

          return (
            <Card
              key={reg.id}
              className="group flex flex-col justify-between overflow-hidden border transition-all hover:border-primary/40 hover:shadow-sm"
            >
              <div>
                {/* Event Picture / Banner */}
                <Link href={`/dashboard/member/events/${reg.event_id}`} className="block">
                  <div className="relative aspect-video w-full overflow-hidden bg-muted/60">
                    {ev?.picture_url ? (
                      <Image
                        src={ev.picture_url}
                        alt={reg.event_title}
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
                        {ev?.is_virtual ? (
                          <span className="flex items-center gap-1 text-blue-500">
                            <Radio className="size-3" /> Virtual
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-500">
                            <MapPin className="size-3" /> In-Person
                          </span>
                        )}
                      </Badge>
                      {ev && isEventPast(ev) && (
                        <Badge variant="secondary" className="bg-background/85 text-[10px] backdrop-blur-xs">
                          Concluded
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>

                <CardHeader className="space-y-2 p-4 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={cn("px-2 py-0.5 font-medium text-[11px]", statusMeta.badgeClass)}
                    >
                      {statusMeta.label}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {ev && isEventPast(ev) ? "Past Event" : "Upcoming"}
                    </span>
                  </div>

                  <CardTitle className="line-clamp-2 font-semibold text-base leading-snug">
                    <Link
                      href={`/dashboard/member/events/${reg.event_id}`}
                      className="transition-colors hover:text-primary hover:underline"
                    >
                      {reg.event_title}
                    </Link>
                  </CardTitle>

                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Clock className="size-3.5 text-muted-foreground" />
                    {formattedDate}
                  </CardDescription>
                </CardHeader>

                <CardContent className="px-4 pb-4">
                  <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                    {ev?.description_short ||
                      ev?.description ||
                      "Registered GDG Jakarta session. Check details for venue access and agenda."}
                  </p>
                </CardContent>
              </div>

              <CardFooter className="flex items-center justify-between border-t bg-muted/10 p-4 pt-3">
                <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-xs">
                  <Link href={`/dashboard/member/events/${reg.event_id}`}>View Event Page →</Link>
                </Button>

                {ev?.url && (
                  <Button variant="outline" size="sm" asChild className="h-8 gap-1 text-xs">
                    <a href={ev.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3" />
                      Bevy
                    </a>
                  </Button>
                )}
              </CardFooter>
            </Card>
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
            Track all GDG Jakarta sessions you have registered for, check approval status, and view past attendance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-medium text-muted-foreground text-xs">
            {registrations.length} Total Registered
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-[420px]">
          <TabsTrigger value="all" className="gap-1.5 text-xs sm:text-sm">
            All ({registrations.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1.5 text-xs sm:text-sm">
            Upcoming ({upcomingRegs.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5 text-xs sm:text-sm">
            Past & Attended ({pastRegs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading your events...</div>
          ) : (
            renderRegistrationGrid(registrations)
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading your events...</div>
          ) : (
            renderRegistrationGrid(upcomingRegs)
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading your events...</div>
          ) : (
            renderRegistrationGrid(pastRegs)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
