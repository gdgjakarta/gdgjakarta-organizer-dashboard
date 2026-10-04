import Link from "next/link";

import { ArrowUpRight, Calendar, ChevronRight, MapPin } from "lucide-react";

import { EventCardImage } from "@/components/event-card-image";
import { Button } from "@/components/ui/button";
import type { BevyEvent } from "@/lib/bevy/types";

interface FeaturedEventsSectionProps {
  events: BevyEvent[];
}

export function FeaturedEventsSection({ events }: FeaturedEventsSectionProps) {
  const visibleEvents = events.filter(
    (e) =>
      !e.is_hidden && !(e as { hidden?: boolean }).hidden && (e.status ? e.status.toLowerCase() === "published" : true),
  );

  return (
    <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      {/* Section Header */}
      <div className="mb-12 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span
            className="font-medium text-xs uppercase tracking-widest transition-colors duration-500"
            style={{ color: "var(--theme-text)" }}
          >
            Gatherings & Workshops
          </span>
          <h2 className="mt-2 font-medium text-[32px] leading-[1.1] tracking-tight sm:text-[44px] lg:text-[59.33px]">
            Community powered by developers.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground text-[14px] leading-relaxed">
            Join thousands of passionate engineers and creators in Jakarta for hands-on workshops, technical talks, and
            flagship conferences.
          </p>
        </div>

        <Button
          variant="outline"
          asChild
          className="rounded-full border-[var(--theme-border)] px-6 text-[14px] font-medium transition-all duration-300 hover:border-[var(--theme-primary)] hover:text-[var(--theme-text)]"
        >
          <Link href="/events" className="flex items-center gap-1.5">
            <span>View All Events</span>
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>

      {/* Events Grid */}
      {visibleEvents.length > 0 ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {visibleEvents.map((event) => {
            const dateStr = new Date(event.start_date).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            const imageUrl =
              event.picture?.url ||
              event.picture?.thumbnail_url ||
              event.banner?.url ||
              event.banner?.thumbnail_url ||
              event.cropped_banner_url ||
              event.cropped_picture_url ||
              null;

            return (
              <div
                key={event.id}
                className="group flex flex-col overflow-hidden rounded-[2rem] border bg-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
                style={{
                  borderColor: "var(--theme-border)",
                }}
              >
                {/* Event Picture */}
                <EventCardImage
                  src={imageUrl}
                  alt={event.title}
                  aspectRatio="aspect-video"
                  className="transition-all duration-500 group-hover:scale-105"
                >
                  {/* Date badge */}
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5">
                    <div className="rounded-full bg-background/90 px-3.5 py-1 font-medium text-xs shadow-md backdrop-blur-md">
                      {dateStr}
                    </div>
                    {event.is_test ? (
                      <div className="rounded-full border border-purple-500/30 bg-purple-500/90 px-3 py-1 font-medium text-white text-xs shadow-md backdrop-blur-md">
                        Test
                      </div>
                    ) : null}
                  </div>
                </EventCardImage>

                {/* Content */}
                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <MapPin className="size-3.5" style={{ color: "var(--theme-primary)" }} />
                    <span className="line-clamp-1">{event.chapter?.title || "Jakarta, Indonesia"}</span>
                  </div>

                  <h3 className="mt-2 line-clamp-2 font-medium text-[22.66px] tracking-tight leading-snug transition-colors group-hover:text-[var(--theme-text)]">
                    {event.title}
                  </h3>

                  <p className="mt-3 line-clamp-3 flex-1 text-muted-foreground text-[14px] leading-relaxed">
                    {event.description_short ||
                      "Join GDG Jakarta for technical sessions, live demonstrations, and collaborative networking."}
                  </p>

                  <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--theme-border)" }}>
                    <Button
                      asChild
                      className="w-full rounded-full text-[14px] font-medium transition-all duration-300 hover:scale-[1.01]"
                      style={{
                        backgroundColor: "var(--theme-primary)",
                        color: "var(--theme-primary-foreground)",
                      }}
                    >
                      {event.url ? (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5"
                        >
                          <span>View Details & RSVP</span>
                          <ArrowUpRight className="size-4" />
                        </a>
                      ) : (
                        <span>Details Available Soon</span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="rounded-[2.5rem] border border-dashed p-16 text-center"
          style={{ borderColor: "var(--theme-border)" }}
        >
          <Calendar className="mx-auto mb-4 size-12 text-muted-foreground/40" />
          <h3 className="font-bold text-xl">New activities in progress</h3>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
            We are curating upcoming workshops, study jams, and technical sessions. Check back soon or stay tuned to our
            announcements.
          </p>
        </div>
      )}
    </section>
  );
}
