"use client";

import { useState } from "react";

import { format, parseISO } from "date-fns";
import { Calendar, Clock, Copy, ExternalLink, Globe, MapPin, Radio, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resolveEventAudience } from "@/lib/bevy/audience";
import type { BevyEvent } from "@/lib/bevy/types";
import { cn } from "@/lib/utils";

interface PublicEventInfoCardsProps {
  event: BevyEvent;
}

export function PublicEventInfoCards({ event }: PublicEventInfoCardsProps) {
  const [addressCopied, setAddressCopied] = useState(false);
  const { isVirtual, isHybrid } = resolveEventAudience(event.audience_type, event.is_virtual_event);

  let formattedDateRange = event.start_date;
  let formattedTime = "";
  try {
    const start = parseISO(event.start_date);
    const end = parseISO(event.end_date);
    formattedDateRange = format(start, "EEEE, dd MMMM yyyy");
    formattedTime = `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
  } catch {
    // Keep raw
  }

  const timezoneStr = event.timezone ?? "Asia/Jakarta (WIB)";

  // Location / Google Maps query
  const fullAddress = [
    event.venue_name,
    event.venue_address,
    event.venue_city,
    event.venue_state,
    event.venue_zip_code,
    event.venue_country,
  ]
    .filter(Boolean)
    .join(", ");

  let googleMapsUrl = "";
  if (event.venue_latitude && event.venue_longitude) {
    googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${event.venue_latitude},${event.venue_longitude}`;
  } else if (fullAddress) {
    googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  }

  const handleCopyAddress = () => {
    if (fullAddress && typeof window !== "undefined") {
      void navigator.clipboard.writeText(fullAddress);
      setAddressCopied(true);
      toast.success("Venue address copied to clipboard");
      setTimeout(() => setAddressCopied(false), 2000);
    }
  };

  // Google Calendar Link generator
  const getGoogleCalendarUrl = () => {
    try {
      const start = new Date(event.start_date).toISOString().replace(/-|:|\.\d\d\d/g, "");
      const end = new Date(event.end_date).toISOString().replace(/-|:|\.\d\d\d/g, "");
      const title = encodeURIComponent(event.title);
      const details = encodeURIComponent(event.description_short ?? event.title);
      const location = encodeURIComponent(fullAddress || (isVirtual ? "Virtual Event" : ""));
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
    } catch {
      return "";
    }
  };

  const gCalUrl = getGoogleCalendarUrl();

  let formatAttendanceTitle = "In-Person Attendance";
  let FormatAttendanceIcon = Users;
  if (isVirtual) {
    formatAttendanceTitle = "Virtual Live Stream";
    FormatAttendanceIcon = Globe;
  } else if (isHybrid) {
    formatAttendanceTitle = "Hybrid Participation";
    FormatAttendanceIcon = Radio;
  }

  const defaultVenueTitle = isVirtual ? "Virtual Event Space" : "To Be Announced";
  const venueTitle = event.venue_name ?? defaultVenueTitle;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {/* 1. Date & Time Card */}
      <Card className="flex flex-col justify-between border-border/60 bg-card p-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Clock className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <span className="block font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Date & Time
            </span>
            <p className="font-semibold text-foreground text-sm leading-snug">{formattedDateRange}</p>
            {formattedTime && <p className="text-muted-foreground text-xs">{formattedTime}</p>}
            <p className="text-[11px] text-muted-foreground">{timezoneStr}</p>
          </div>
        </div>

        {gCalUrl && (
          <div className="mt-3 border-border/40 border-t pt-2.5">
            <a
              href={gCalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary text-xs hover:underline"
            >
              <Calendar className="size-3" />
              Add to Google Calendar
            </a>
          </div>
        )}
      </Card>

      {/* 2. Venue & Location Card */}
      <Card className="flex flex-col justify-between border-border/60 bg-card p-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
            <MapPin className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <span className="block font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Location / Venue
            </span>
            <p className="font-semibold text-foreground text-sm leading-snug">{venueTitle}</p>
            {fullAddress ? (
              <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                {[event.venue_address, event.venue_city, event.venue_country].filter(Boolean).join(", ")}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                {isVirtual ? "Accessible via meeting link upon registration" : "Details will be shared prior to event"}
              </p>
            )}
          </div>
        </div>

        {googleMapsUrl && (
          <div className="mt-3 flex items-center justify-between border-border/40 border-t pt-2.5">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary text-xs hover:underline"
            >
              <ExternalLink className="size-3" />
              View on Google Maps
            </a>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleCopyAddress}
              title="Copy Address"
              className="size-6 text-muted-foreground hover:text-foreground"
            >
              <Copy className={cn("size-3", addressCopied && "text-emerald-500")} />
            </Button>
          </div>
        )}
      </Card>

      {/* 3. Format & Capacity Card */}
      <Card className="flex flex-col justify-between border-border/60 bg-card p-4 shadow-2xs sm:col-span-2 lg:col-span-1">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FormatAttendanceIcon className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <span className="block font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Format & RSVPs
            </span>
            <p className="font-semibold text-foreground text-sm leading-snug">{formatAttendanceTitle}</p>
            <p className="text-muted-foreground text-xs">
              {event.total_attendees ? `${event.total_attendees} attendees registered` : "Registration open"}
            </p>
            {event.total_capacity ? (
              <p className="text-[11px] text-muted-foreground">Capacity: {event.total_capacity} seats max</p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 border-border/40 border-t pt-2.5">
          <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            {event.status === "Published" ? "Active Community Event" : event.status}
          </span>
        </div>
      </Card>
    </div>
  );
}
