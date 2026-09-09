"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

import { format, parseISO } from "date-fns";
import { Calendar, Clock, MapPin, Radio } from "lucide-react";

import { EventRegistrationModal } from "@/components/event-registration-modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { fetchMemberRegistrationsAction } from "@/server/firestore-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface MemberEventsListProps {
  events: FirestoreEvent[];
  myRegistrations?: FirestoreRegistration[];
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

  return (
    <div className="space-y-6">
      {/* Header Greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
            Welcome, {user?.name?.split(" ")[0] || "Member"} 👋
          </h1>
          <p className="text-muted-foreground text-sm">
            Browse GDG Jakarta events, register for upcoming sessions, and track your RSVPs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-medium text-muted-foreground text-xs">
            {registrations.length} Events Registered
          </Badge>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {publishedEvents.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            <Calendar className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <h3 className="font-semibold text-foreground text-lg">No events available</h3>
            <p className="mt-1 text-sm">Check back soon for new GDG Jakarta meetups and devlabs.</p>
          </div>
        ) : (
          publishedEvents.map((event) => {
            const existingReg = registrationMap.get(String(event.id));

            let formattedDate = event.start_date;
            try {
              formattedDate = format(parseISO(event.start_date), "dd MMM yyyy • h:mm a");
            } catch {
              // Keep raw string
            }

            return (
              <Card
                key={event.id}
                className="flex flex-col justify-between overflow-hidden border transition-colors hover:border-primary/40"
              >
                <div>
                  {/* Event Thumbnail */}
                  <div className="relative aspect-video w-full overflow-hidden bg-muted/60">
                    {event.picture_url ? (
                      <Image
                        src={event.picture_url}
                        alt={event.title}
                        fill
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Calendar className="size-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      <Badge variant="secondary" className="bg-background/80 text-[10px] backdrop-blur-xs">
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
                      {event.requires_approval && (
                        <Badge variant="secondary" className="bg-background/80 text-[10px] backdrop-blur-xs">
                          Curated
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardHeader className="space-y-2 p-4 pb-2">
                    <CardTitle className="line-clamp-2 font-semibold text-base leading-snug">{event.title}</CardTitle>
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

                <CardFooter className="mt-2 flex items-center justify-between border-t bg-muted/10 p-4 pt-0">
                  <div className="text-[11px] text-muted-foreground">
                    <strong className="text-foreground">{event.total_registrations || 0}</strong> registered
                  </div>

                  <EventRegistrationModal event={event} existingRegistration={existingReg} />
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
