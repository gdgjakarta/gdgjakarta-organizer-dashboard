"use client";

import { useEffect, useState } from "react";

import { EyeOff, FlaskConical, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { BevyEvent } from "@/lib/bevy/types";
import { checkEventRegistrationAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { PublicEventHeader } from "./public-event-header";
import { PublicEventHero } from "./public-event-hero";
import { PublicEventInfoCards } from "./public-event-info-cards";
import { PublicEventRsvpCard } from "./public-event-rsvp-card";
import { PublicEventTabs } from "./public-event-tabs";

interface PublicEventDetailViewProps {
  event: BevyEvent;
  initialFirestoreEvent?: FirestoreEvent | null;
}

export function PublicEventDetailView({ event, initialFirestoreEvent = null }: PublicEventDetailViewProps) {
  const user = useAuthStore((s) => s.user);
  const [firestoreEvent, setFirestoreEvent] = useState<FirestoreEvent | null>(initialFirestoreEvent);
  const [registration, setRegistration] = useState<FirestoreRegistration | null>(null);

  const isHidden = Boolean(event.is_hidden ?? (event as { hidden?: boolean }).hidden);
  const isTest = Boolean(event.is_test);

  // Client hydration for dynamic Firestore sessions and registration check
  useEffect(() => {
    async function loadFirestoreData() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData) {
          setFirestoreEvent(docData);
        }
      } catch (err) {
        console.warn("[PublicEventDetailView] Failed to load Firestore event:", err);
      }

      if (user) {
        try {
          const found = await checkEventRegistrationAction(String(event.id), user.id, user.email);
          if (found) {
            setRegistration(found);
          }
        } catch (regErr) {
          console.warn("[PublicEventDetailView] Failed to check registration:", regErr);
        }
      }
    }

    void loadFirestoreData();
  }, [event.id, user]);

  return (
    <div className="relative min-h-screen">
      {/* ── 1. BEVY HIDDEN EVENT ALERT BANNER (Matching Bevy screenshot) ──── */}
      {isHidden && (
        <div className="sticky top-14 z-30 w-full bg-red-600 px-4 py-3 text-center text-white shadow-md">
          <div className="mx-auto flex max-w-4xl items-center justify-center gap-2 text-xs sm:text-sm">
            <EyeOff className="size-4 shrink-0" />
            <p>
              <strong className="font-bold">This event is currently hidden.</strong> Only visitors with the URL can see
              this page.
            </p>
          </div>
        </div>
      )}

      {/* ── 2. BEVY TEST EVENT ALERT BANNER ───────────────────────────────── */}
      {isTest && !isHidden && (
        <div className="sticky top-14 z-30 w-full bg-purple-700 px-4 py-2.5 text-center text-white shadow-md">
          <div className="mx-auto flex max-w-4xl items-center justify-center gap-2 text-xs sm:text-sm">
            <FlaskConical className="size-4 shrink-0" />
            <p>
              <strong className="font-bold">This is a test event.</strong> Information and registrations are for testing
              purposes only.
            </p>
          </div>
        </div>
      )}

      {/* ── 3. MAIN PAGE CONTENT ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Main Content Column (Desktop 8 cols) */}
          <div className="space-y-6 lg:col-span-8">
            <PublicEventHeader event={event} />

            <PublicEventHero event={event} />

            {/* Topic Tags Row */}
            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Tag className="mr-1 size-3.5 text-muted-foreground" />
                {event.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="border-border/60 bg-muted/30 px-2 py-0.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <PublicEventInfoCards event={event} />

            <PublicEventTabs
              event={event}
              firestoreSessions={firestoreEvent?.sessions}
              firestoreEvent={firestoreEvent}
            />
          </div>

          {/* Sidebar RSVP Column (Desktop 4 cols) */}
          <div className="lg:col-span-4">
            <PublicEventRsvpCard event={event} firestoreEvent={firestoreEvent} existingRegistration={registration} />
          </div>
        </div>
      </div>
    </div>
  );
}
