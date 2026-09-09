"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  Radio,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { EventRegistrationModal } from "@/components/event-registration-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { checkEventRegistrationAction } from "@/server/firestore-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface MemberEventDetailProps {
  event: FirestoreEvent;
  initialRegistration?: FirestoreRegistration | null;
}

function EventDescriptionContent({ html }: { html: string }) {
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none space-y-4 leading-relaxed [&_a]:text-primary [&_a]:underline [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Bevy verified event HTML content
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
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

export function MemberEventDetail({ event, initialRegistration = null }: MemberEventDetailProps) {
  const user = useAuthStore((s) => s.user);
  const [registration, setRegistration] = useState<FirestoreRegistration | null>(initialRegistration);

  useEffect(() => {
    async function checkMyRegistration() {
      if (!user) return;
      try {
        const found = await checkEventRegistrationAction(String(event.id), user.id, user.email);
        if (found) {
          setRegistration(found);
        }
      } catch (err) {
        console.error("[MemberEventDetail] Failed to check registration:", err);
      }
    }

    void checkMyRegistration();
  }, [user, event.id]);

  const isPast = isEventPast(event);

  let formattedStartDate = event.start_date;
  let formattedEndDate = event.end_date;
  try {
    formattedStartDate = format(parseISO(event.start_date), "EEEE, dd MMMM yyyy • h:mm a");
    if (event.end_date) {
      formattedEndDate = format(parseISO(event.end_date), "h:mm a (zzz)");
    }
  } catch {
    // Keep raw
  }

  const handleShare = () => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(window.location.href);
      toast.success("Event link copied to clipboard!");
    }
  };

  const isApproved = registration?.status === "approved" || registration?.status === "attended";
  const isPending = registration?.status === "pending";

  let statusBadgeClass = "";
  let statusBadgeText = "Registered";
  if (isApproved) {
    statusBadgeClass = "bg-emerald-600 text-white";
    statusBadgeText = "Approved";
  } else if (isPending) {
    statusBadgeClass = "border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    statusBadgeText = "Pending Review";
  }

  let registrationStatusDescription = "Open registration. Reserve your spot today.";
  if (registration) {
    if (isApproved) {
      registrationStatusDescription = "Your spot is confirmed! See you at the session.";
    } else {
      registrationStatusDescription = "Your application has been received and is being reviewed by the organizers.";
    }
  } else if (isPast) {
    registrationStatusDescription = "This event has already concluded. Registrations are closed.";
  } else if (event.requires_approval) {
    registrationStatusDescription = "This event has limited seats and requires attendee review.";
  }

  let actionButton = (
    <EventRegistrationModal event={event} existingRegistration={registration}>
      <Button className="w-full gap-2 font-medium" size="lg">
        <Sparkles className="size-4" />
        Register for Event
      </Button>
    </EventRegistrationModal>
  );

  if (registration) {
    actionButton = (
      <div className="space-y-3">
        <div className="rounded-lg bg-muted/60 p-3 text-center text-muted-foreground text-xs">
          {isApproved
            ? "✓ You are registered. Check your email for further event announcements."
            : "⏳ You have already applied. You will be notified once reviewed."}
        </div>
        <Button
          disabled
          variant={isApproved ? "outline" : "secondary"}
          className="w-full cursor-default gap-2 font-medium opacity-90"
          size="lg"
        >
          <CheckCircle2 className={`size-4 ${isApproved ? "text-emerald-500" : "text-amber-500"}`} />
          {statusBadgeText}
        </Button>
      </div>
    );
  } else if (isPast) {
    actionButton = (
      <Button disabled variant="secondary" className="w-full cursor-default font-medium opacity-75" size="lg">
        Event Ended • Registration Closed
      </Button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb / Back Link */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/member">
            <ArrowLeft className="size-4" />
            Back to Events
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 text-xs">
            <Share2 className="size-3.5" />
            Share Event
          </Button>

          {event.url && (
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <a href={event.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                View on Bevy
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Hero Banner & Full Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Banner / Poster */}
          <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl border bg-muted/40 shadow-xs">
            {event.banner_url || event.picture_url ? (
              <Image
                src={event.banner_url ?? event.picture_url ?? ""}
                alt={event.title}
                fill
                unoptimized
                className="h-full w-full object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Calendar className="size-12 text-muted-foreground/30" />
                <span className="font-medium text-sm">GDG Jakarta Community Event</span>
              </div>
            )}
            <div className="absolute top-4 left-4 flex gap-2">
              <Badge variant="secondary" className="bg-background/90 text-xs backdrop-blur-md">
                {event.is_virtual ? (
                  <span className="flex items-center gap-1.5 text-blue-500">
                    <Radio className="size-3.5" /> Virtual Event
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-500">
                    <MapPin className="size-3.5" /> In-Person Meetup
                  </span>
                )}
              </Badge>
              {event.requires_approval && (
                <Badge variant="secondary" className="bg-background/90 text-xs backdrop-blur-md">
                  Curated RSVP
                </Badge>
              )}
            </div>
          </div>

          {/* Title & Short Summary */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 font-medium text-muted-foreground text-xs">
              <Badge variant="outline" className="text-xs">
                {event.event_type_title ?? "Technical Session"}
              </Badge>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {formattedStartDate}
              </span>
            </div>

            <h1 className="font-bold text-2xl tracking-tight sm:text-3xl lg:text-4xl">{event.title}</h1>

            {event.description_short && (
              <p className="font-medium text-base text-muted-foreground leading-relaxed">{event.description_short}</p>
            )}
          </div>

          <Separator />

          {/* Description / Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">About this Event</CardTitle>
              <CardDescription>Event overview, topics covered, and key takeaways.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-foreground/90 text-sm leading-relaxed">
              {event.description ? (
                <EventDescriptionContent html={event.description} />
              ) : (
                <p className="text-muted-foreground italic">
                  No detailed description has been published for this event yet. Check back soon!
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Topics & Technologies
              </h3>
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-normal text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick RSVP & Event Details Card */}
        <div className="space-y-6">
          {/* Registration Card */}
          <Card className="border-primary/20 bg-muted/20 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Registration Status</span>
                {registration ? (
                  <Badge variant={isApproved ? "default" : "secondary"} className={statusBadgeClass}>
                    {statusBadgeText}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Not Registered
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{registrationStatusDescription}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2 rounded-lg border bg-background p-3.5 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Capacity / RSVPs</span>
                  <strong className="text-foreground">{event.total_registrations || 0} registered</strong>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Entry Fee</span>
                  <strong className="font-semibold text-emerald-600">Free of Charge</strong>
                </div>
              </div>

              {actionButton}
            </CardContent>
          </Card>

          {/* Event Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Event Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <div className="font-medium text-foreground">Date & Time</div>
                  <div className="text-muted-foreground">{formattedStartDate}</div>
                  {formattedEndDate && <div className="text-muted-foreground">Until {formattedEndDate}</div>}
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                {event.is_virtual ? (
                  <Globe className="mt-0.5 size-4 shrink-0 text-blue-500" />
                ) : (
                  <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                )}
                <div>
                  <div className="font-medium text-foreground">
                    {event.is_virtual ? "Virtual Session" : "In-Person Venue"}
                  </div>
                  <div className="text-muted-foreground">
                    {event.is_virtual
                      ? "Online link will be provided upon registration approval"
                      : "Jakarta, Indonesia (See Bevy page for detailed map)"}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Users className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <div className="font-medium text-foreground">Organized by</div>
                  <div className="text-muted-foreground">Google Developer Group (GDG) Jakarta</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
