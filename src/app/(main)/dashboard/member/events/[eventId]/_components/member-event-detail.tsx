"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Layers,
  MapPin,
  Radio,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { EventCardImage } from "@/components/event-card-image";
import { EventRegistrationModal } from "@/components/event-registration-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { resolveEventAudience } from "@/lib/bevy/audience";
import { checkEventRegistrationAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
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
  const [currentEvent, setCurrentEvent] = useState<FirestoreEvent>(event);
  const [registration, setRegistration] = useState<FirestoreRegistration | null>(initialRegistration);
  const { isVirtual, isHybrid } = resolveEventAudience(currentEvent.audience_type, currentEvent.is_virtual);

  useEffect(() => {
    setCurrentEvent(event);
    async function checkMyRegistrationAndEvent() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData) {
          setCurrentEvent((prev) => ({
            ...prev,
            ...docData,
          }));
        }
      } catch (err) {
        console.warn("[MemberEventDetail] Failed to load Firestore event:", err);
      }

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

    void checkMyRegistrationAndEvent();
  }, [user, event]);

  const isPast = isEventPast(currentEvent);

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
  } else if (currentEvent.requires_approval) {
    registrationStatusDescription = "This event has limited seats and requires attendee review.";
  }

  const registeredSessionTitle =
    registration?.session_title ??
    (registration?.answers?.session_title as string | undefined) ??
    (registration?.session_id ? `Track: ${registration.session_id}` : null);

  let formatBadgeContent = (
    <span className="flex items-center gap-1.5 text-emerald-500">
      <MapPin className="size-3.5" /> In-Person Meetup
    </span>
  );
  if (isVirtual) {
    formatBadgeContent = (
      <span className="flex items-center gap-1.5 text-blue-500">
        <Radio className="size-3.5" /> Virtual Event
      </span>
    );
  } else if (isHybrid) {
    formatBadgeContent = (
      <span className="flex items-center gap-1.5 text-purple-500">
        <Globe className="size-3.5" /> Hybrid Event
      </span>
    );
  }

  let venueIcon = <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-500" />;
  let venueTitle = "In-Person Venue";
  let venueDetail = "Jakarta, Indonesia (See Bevy page for detailed map)";

  if (isVirtual) {
    venueIcon = <Radio className="mt-0.5 size-4 shrink-0 text-blue-500" />;
    venueTitle = "Virtual Session";
    venueDetail = "Online link will be provided upon registration approval";
  } else if (isHybrid) {
    venueIcon = <Globe className="mt-0.5 size-4 shrink-0 text-purple-500" />;
    venueTitle = "Hybrid Session & Venue";
    venueDetail = event.venue?.name
      ? `${event.venue.name} & Online link provided upon approval`
      : "Jakarta, Indonesia & Online Session";
  } else if (event.venue?.name) {
    venueDetail = `${event.venue.name}${event.venue.city ? `, ${event.venue.city}` : ""}`;
  }

  let actionButton = (
    <EventRegistrationModal event={currentEvent} existingRegistration={registration}>
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
          <EventCardImage
            src={event.banner_url ?? event.picture_url}
            alt={event.title}
            aspectRatio="aspect-[21/9]"
            containerClassName="rounded-xl border shadow-xs"
            priority
          >
            <div className="absolute top-4 left-4 z-20 flex gap-2">
              <Badge variant="secondary" className="bg-background/90 text-xs backdrop-blur-md">
                {formatBadgeContent}
              </Badge>
              {event.requires_approval && (
                <Badge variant="secondary" className="bg-background/90 text-xs backdrop-blur-md">
                  Curated RSVP
                </Badge>
              )}
              {event.is_test && (
                <Badge
                  variant="outline"
                  className="border-purple-500/30 bg-purple-500/20 text-purple-700 text-xs backdrop-blur-md dark:text-purple-300"
                >
                  Test Event
                </Badge>
              )}
            </div>
          </EventCardImage>

          {/* Title & Short Summary */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 font-medium text-muted-foreground text-xs">
              <Badge variant="outline" className="text-xs">
                {event.event_type_title ?? "Technical Session"}
              </Badge>
              {event.is_test && (
                <Badge
                  variant="outline"
                  className="border-purple-500/20 bg-purple-500/10 text-purple-600 text-xs dark:text-purple-400"
                >
                  Test
                </Badge>
              )}
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

          {/* Sessions / Breakout Tracks if configured */}
          {currentEvent.sessions && currentEvent.sessions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  <CardTitle className="text-lg">Event Sessions & Tracks</CardTitle>
                </div>
                <CardDescription>
                  This event features specialized breakout sessions with limited capacity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentEvent.sessions.map((sess, idx) => {
                  const capacity = sess.capacity ?? 0;
                  const totalRegistered = sess.total_registered ?? 0;
                  const available = capacity > 0 ? capacity - totalRegistered > 0 : true;
                  const remaining = Math.max(0, capacity - totalRegistered);

                  let capacityLabel = "Open Capacity";
                  if (capacity > 0) {
                    capacityLabel = available
                      ? `${totalRegistered}/${capacity} booked (${remaining} left)`
                      : `Full (${capacity} max)`;
                  }

                  return (
                    <div
                      key={sess.id}
                      className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            Track #{idx + 1}
                          </Badge>
                          <span className="font-semibold text-foreground text-sm">{sess.title}</span>
                        </div>
                        {sess.description && (
                          <p className="text-muted-foreground text-xs leading-relaxed">{sess.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-muted-foreground">
                          {sess.time_slot && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" /> {sess.time_slot}
                            </span>
                          )}
                          {sess.checkin_deadline && (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <Clock className="size-3" /> Check-in by: {sess.checkin_deadline}
                            </span>
                          )}
                          {(sess.location || sess.location_url) &&
                            (sess.location_url ? (
                              <a
                                href={sess.location_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary/80 hover:underline"
                                title="Open Google Maps / Venue Location"
                              >
                                <MapPin className="size-3" />
                                <span>{sess.location || "Google Maps"}</span>
                                <ExternalLink className="size-2.5" />
                              </a>
                            ) : (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3" /> {sess.location}
                              </span>
                            ))}
                        </div>
                      </div>

                      <div className="shrink-0 self-start sm:self-center">
                        <Badge variant={available ? "secondary" : "destructive"} className="text-xs">
                          {capacityLabel}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

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
          <Card className="bg-card shadow-xs">
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
              {registeredSessionTitle && (
                <div className="flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs">
                  <Layers className="size-4 shrink-0 text-primary" />
                  <div>
                    <span className="block font-medium text-[10px] text-muted-foreground uppercase">
                      Your Selected Session Track
                    </span>
                    <strong className="text-foreground">{registeredSessionTitle}</strong>
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded-lg bg-muted/30 p-3.5 text-xs">
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
                {venueIcon}
                <div>
                  <div className="font-medium text-foreground">{venueTitle}</div>
                  <div className="text-muted-foreground">{venueDetail}</div>
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
