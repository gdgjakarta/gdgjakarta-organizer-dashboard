"use client";

import { useState } from "react";

import { Check, Copy, ExternalLink, Share2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import { EventRegistrationModal } from "@/components/event-registration-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getBevyLiveEventUrl } from "@/config/remote-config-utils";
import type { BevyEvent } from "@/lib/bevy/types";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";

interface PublicEventRsvpCardProps {
  event: BevyEvent;
  firestoreEvent?: FirestoreEvent | null;
  existingRegistration?: FirestoreRegistration | null;
}

function isEventPast(event: BevyEvent): boolean {
  if (event.status === "Completed") return true;
  const targetDate = event.end_date;
  if (!targetDate) return false;
  try {
    return new Date(targetDate).getTime() < Date.now();
  } catch {
    return false;
  }
}

export function PublicEventRsvpCard({ event, firestoreEvent, existingRegistration }: PublicEventRsvpCardProps) {
  const [copied, setCopied] = useState(false);
  const isPast = isEventPast(event);
  const liveBevyUrl = getBevyLiveEventUrl(event);

  // Map to FirestoreEvent compatible structure for EventRegistrationModal
  const registrationEvent: FirestoreEvent = {
    id: String(event.id),
    title: event.title,
    description: event.description,
    description_short: event.description_short,
    status: (event.status as FirestoreEvent["status"]) ?? "Published",
    start_date: event.start_date,
    end_date: event.end_date,
    picture_url: event.cropped_picture_url ?? event.picture?.url,
    banner_url: event.cropped_banner_url ?? event.banner?.url,
    event_type_title: event.event_type_title,
    audience_type: event.audience_type ?? "IN_PERSON",
    is_virtual: Boolean(event.is_virtual_event),
    venue: event.venue_name
      ? {
          name: event.venue_name,
          address: event.venue_address,
          city: event.venue_city,
        }
      : undefined,
    url: event.url,
    static_url: event.static_url,
    tags: event.tags,
    requires_approval: Boolean(firestoreEvent?.requires_approval),
    max_attendees: firestoreEvent?.max_attendees ?? event.total_capacity,
    total_registrations: firestoreEvent?.total_registrations ?? event.total_attendees ?? 0,
    total_approved: firestoreEvent?.total_approved ?? event.total_attendees ?? 0,
    total_checked_in: firestoreEvent?.total_checked_in ?? event.checkin_count ?? 0,
    custom_questions: firestoreEvent?.custom_questions,
    sessions: firestoreEvent?.sessions,
    is_hidden: event.is_hidden,
    is_test: event.is_test,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Event link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  let registrationBadgeLabel = "Open for RSVPs";
  if (isPast) {
    registrationBadgeLabel = "Event Concluded";
  } else if (registrationEvent.requires_approval) {
    registrationBadgeLabel = "Approval Required";
  }

  return (
    <>
      {/* ── DESKTOP STICKY SIDEBAR CARD ───────────────────────────── */}
      <Card className="sticky top-20 hidden border-border/60 bg-card/95 p-5 shadow-sm backdrop-blur-md lg:block">
        <CardContent className="space-y-4 p-0">
          <div className="space-y-1 border-border/50 border-b pb-3.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Registration Status
              </span>
              <Badge
                variant={isPast ? "secondary" : "outline"}
                className={
                  isPast
                    ? "text-xs"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-xs dark:text-emerald-400"
                }
              >
                {registrationBadgeLabel}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {isPast
                ? "This event has already ended. Registrations are closed."
                : "Reserve your spot today to receive updates and access."}
            </p>
          </div>

          {/* Primary Action Button */}
          {isPast ? (
            <Button disabled className="w-full font-medium" size="lg">
              Registration Closed
            </Button>
          ) : (
            <EventRegistrationModal event={registrationEvent} existingRegistration={existingRegistration}>
              <Button className="w-full gap-2 font-medium shadow-xs" size="lg">
                <Sparkles className="size-4" />
                Register for Event
              </Button>
            </EventRegistrationModal>
          )}

          {/* Secondary Actions */}
          <div className="space-y-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="w-full gap-1.5 text-xs">
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              {copied ? "Link Copied!" : "Copy Event Link"}
            </Button>

            {liveBevyUrl && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="w-full gap-1.5 text-muted-foreground text-xs hover:text-foreground"
              >
                <a href={liveBevyUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  View Original on Bevy Platform
                </a>
              </Button>
            )}
          </div>

          {/* Attendee counter preview */}
          {event.total_attendees ? (
            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-muted/40 py-2 text-center text-muted-foreground text-xs">
              <Users className="size-3.5" />
              <span>{event.total_attendees} community members attending</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── MOBILE STICKY BOTTOM BAR ──────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-border/60 border-t bg-background/95 p-3.5 shadow-lg backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground text-sm">{event.title}</p>
            <p className="text-muted-foreground text-xs">{isPast ? "Event Concluded" : "Open for RSVPs"}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleCopyLink} title="Copy Link" className="size-9">
              {copied ? <Check className="size-4 text-emerald-500" /> : <Share2 className="size-4" />}
            </Button>

            {isPast ? (
              <Button disabled size="sm">
                Closed
              </Button>
            ) : (
              <EventRegistrationModal event={registrationEvent} existingRegistration={existingRegistration}>
                <Button size="sm" className="gap-1.5 shadow-xs">
                  <Sparkles className="size-3.5" />
                  RSVP
                </Button>
              </EventRegistrationModal>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
