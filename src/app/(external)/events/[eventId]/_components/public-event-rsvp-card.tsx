"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

import { Camera, Check, Copy, ExternalLink, Share2, Sparkles, Users, Video } from "lucide-react";
import { toast } from "sonner";

import googleFavicon from "@/app/Google_Favicon.webp";
import { EventRegistrationModal } from "@/components/event-registration-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getBevyLiveEventUrl } from "@/config/remote-config-utils";
import type { BevyEvent } from "@/lib/bevy/types";
import { parsePhotoAlbum } from "@/lib/events/media-utils";
import { getRegistrationWindowStatus } from "@/lib/events/registration-defaults";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface PublicEventRsvpCardProps {
  event: BevyEvent;
  firestoreEvent?: FirestoreEvent | null;
  existingRegistration?: FirestoreRegistration | null;
  isCheckingRegistration?: boolean;
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

export function PublicEventRsvpCard({
  event,
  firestoreEvent,
  existingRegistration,
  isCheckingRegistration = false,
}: PublicEventRsvpCardProps) {
  const user = useAuthStore((s) => s.user);
  const [copied, setCopied] = useState(false);
  const [currentRegistration, setCurrentRegistration] = useState<FirestoreRegistration | null | undefined>(
    existingRegistration,
  );

  useEffect(() => {
    setCurrentRegistration(existingRegistration);
  }, [existingRegistration]);

  const isPast = isEventPast(event);
  const liveBevyUrl = getBevyLiveEventUrl(event);
  const highlightVideoUrl = firestoreEvent?.highlight_video_url ?? event.highlight_video_url ?? event.video_url;
  const photoAlbumUrl = firestoreEvent?.photo_album_url ?? event.photo_album_url;
  const parsedAlbum = parsePhotoAlbum(photoAlbumUrl);
  const thumbnailImageUrl =
    event.cropped_picture_url ??
    event.picture?.url ??
    event.picture?.thumbnail_url ??
    event.cropped_banner_url ??
    event.banner?.url;

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
    curation_mode: Boolean(firestoreEvent?.curation_mode),
    webhook_url: firestoreEvent?.webhook_url,
    email_templates: firestoreEvent?.email_templates,
    max_attendees: firestoreEvent?.max_attendees ?? event.total_capacity,
    total_registrations: firestoreEvent?.total_registrations ?? event.total_attendees ?? 0,
    total_approved: firestoreEvent?.total_approved ?? event.total_attendees ?? 0,
    total_checked_in: firestoreEvent?.total_checked_in ?? event.checkin_count ?? 0,
    custom_questions: firestoreEvent?.custom_questions,
    sessions: firestoreEvent?.sessions,
    registration_status: firestoreEvent?.registration_status,
    registration_start_date: firestoreEvent?.registration_start_date,
    registration_end_date: firestoreEvent?.registration_end_date,
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

  const windowStatus = getRegistrationWindowStatus(registrationEvent);

  let registrationBadgeLabel = windowStatus.badgeLabel;
  if (windowStatus.isOpen) {
    registrationBadgeLabel = registrationEvent.requires_approval ? "Approval Required" : "Open for RSVPs";
  }

  let badgeColorClass = "text-xs";
  if (windowStatus.isOpen) {
    badgeColorClass = "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-xs dark:text-emerald-400";
  } else if (windowStatus.status === "draft") {
    badgeColorClass =
      "border border-dashed border-amber-500/40 bg-amber-500/10 text-amber-700 text-xs dark:text-amber-300";
  } else if (windowStatus.status === "upcoming") {
    badgeColorClass = "border border-blue-500/40 bg-blue-500/10 text-blue-700 text-xs dark:text-blue-300";
  }

  let registrationDescription = "Reserve your spot today to receive updates and access.";
  if (isPast || windowStatus.status === "completed") {
    registrationDescription = "This event has already ended. Registrations are closed.";
  } else if (windowStatus.status === "draft") {
    registrationDescription = "Registration has not opened yet. Check back soon for announcements.";
  } else if (windowStatus.status === "upcoming") {
    registrationDescription = `Registration opens on ${windowStatus.opensAt ? new Date(windowStatus.opensAt).toLocaleDateString() : "soon"}.`;
  } else if (windowStatus.status === "ended") {
    registrationDescription = "Registration is closed for this event.";
  } else if (
    registrationEvent.requires_approval ||
    (registrationEvent as unknown as Record<string, unknown>).curation_mode
  ) {
    registrationDescription =
      "This event is in curation mode. Submissions are marked as Pending Review until approved by organizers.";
  }

  return (
    <>
      {/* ── DESKTOP STICKY SIDEBAR CARD ───────────────────────────── */}
      <Card className="sticky top-20 hidden border-border/60 bg-card/95 p-5 shadow-sm backdrop-blur-md lg:block">
        <CardContent className="space-y-4 p-0">
          {/* Event Thumbnail (recommended Bevy size: 1080 x 1080 pixels) */}
          {thumbnailImageUrl ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/50 bg-muted/20 shadow-2xs">
              <Image
                src={thumbnailImageUrl}
                alt={event.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 400px"
                className="size-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                unoptimized={!thumbnailImageUrl.includes("res.cloudinary.com")}
              />
            </div>
          ) : null}

          <div className="space-y-1 border-border/50 border-b pb-3.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Registration Status
              </span>
              <Badge variant={windowStatus.isOpen ? "outline" : "secondary"} className={badgeColorClass}>
                {registrationBadgeLabel}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">{registrationDescription}</p>
          </div>

          {/* Primary Action Button */}
          {isPast ? (
            <div className="space-y-2">
              <Button disabled className="w-full font-medium" size="lg">
                Registration Closed
              </Button>
              {highlightVideoUrl && (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-primary/30 text-primary text-xs hover:bg-primary/10"
                  size="sm"
                  onClick={() => {
                    const el = document.querySelector('[data-state][value="highlights"]') as HTMLButtonElement | null;
                    el?.click();
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  <Video className="size-3.5" />
                  Watch Highlight Video
                </Button>
              )}
              {photoAlbumUrl && (
                <Button variant="outline" className="w-full gap-2 text-xs" size="sm" asChild>
                  <a href={photoAlbumUrl} target="_blank" rel="noopener noreferrer">
                    <Camera className="size-3.5" />
                    <span>{parsedAlbum?.label ? `View ${parsedAlbum.label}` : "View Photo Album"}</span>
                    <ExternalLink className="ml-auto size-3" />
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <>
              {!user && windowStatus.isOpen && !currentRegistration && (
                <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-foreground text-xs leading-relaxed">
                  <Users className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground">Join Community First</p>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      GDG Jakarta events require chapter membership. Sign in with Google to join our community before
                      registering.
                    </p>
                  </div>
                </div>
              )}
              <EventRegistrationModal
                event={registrationEvent}
                existingRegistration={currentRegistration}
                isChecking={isCheckingRegistration}
                onSuccess={(reg) => setCurrentRegistration(reg)}
              >
                <Button className="w-full gap-2 font-medium shadow-xs" size="lg">
                  {!user ? (
                    <>
                      <Image
                        src={googleFavicon}
                        alt="Google"
                        width={18}
                        height={18}
                        className="size-4 object-contain"
                      />
                      Join Community to Register
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Register for Event
                    </>
                  )}
                </Button>
              </EventRegistrationModal>
            </>
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
          {thumbnailImageUrl ? (
            <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/20 shadow-2xs">
              <Image
                src={thumbnailImageUrl}
                alt={event.title}
                fill
                sizes="40px"
                className="size-full object-cover"
                unoptimized={!thumbnailImageUrl.includes("res.cloudinary.com")}
              />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground text-sm">{event.title}</p>
            <p className="text-muted-foreground text-xs">{registrationBadgeLabel}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleCopyLink} title="Copy Link" className="size-9">
              {copied ? <Check className="size-4 text-emerald-500" /> : <Share2 className="size-4" />}
            </Button>

            {(() => {
              if (!isPast) {
                return (
                  <EventRegistrationModal
                    event={registrationEvent}
                    existingRegistration={currentRegistration}
                    isChecking={isCheckingRegistration}
                    onSuccess={(reg) => setCurrentRegistration(reg)}
                  >
                    <Button size="sm" className="gap-1.5 shadow-xs">
                      {!user ? (
                        <>
                          <Image
                            src={googleFavicon}
                            alt="Google"
                            width={16}
                            height={16}
                            className="size-3.5 object-contain"
                          />
                          Join &amp; RSVP
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-3.5" />
                          RSVP
                        </>
                      )}
                    </Button>
                  </EventRegistrationModal>
                );
              }
              if (photoAlbumUrl) {
                return (
                  <Button size="sm" variant="outline" asChild className="gap-1.5 text-xs">
                    <a href={photoAlbumUrl} target="_blank" rel="noopener noreferrer">
                      <Camera className="size-3.5" />
                      Photos
                    </a>
                  </Button>
                );
              }
              if (highlightVideoUrl) {
                return (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-primary/30 text-primary text-xs"
                    onClick={() => {
                      const el = document.querySelector('[data-state][value="highlights"]') as HTMLButtonElement | null;
                      el?.click();
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    <Video className="size-3.5" />
                    Recap
                  </Button>
                );
              }
              return (
                <Button disabled size="sm">
                  Closed
                </Button>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
