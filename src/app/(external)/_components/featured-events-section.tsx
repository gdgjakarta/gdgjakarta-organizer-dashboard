"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { Calendar, ChevronRight, MapPin } from "lucide-react";

import { EventCardImage } from "@/components/event-card-image";
import { Button } from "@/components/ui/button";
import type { BevyEvent } from "@/lib/bevy/types";

export const CATEGORIES = [
  { id: "all", label: "All Activities" },
  { id: "ai-cloud", label: "AI & Google Cloud" },
  { id: "android-mobile", label: "Android & Mobile" },
  { id: "web-frontend", label: "Web & Frameworks" },
  { id: "study-jams", label: "Study Jams & Labs" },
  { id: "hackathons", label: "Hackathons & Conferences" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function matchesEventCategory(event: BevyEvent, catId: string): boolean {
  if (!catId || catId === "all") return true;

  const title = (event.title || "").toLowerCase();
  const descShort = (event.description_short || "").toLowerCase();
  const desc = (event.description || "").toLowerCase();
  const typeTitle = (event.event_type_title || "").toLowerCase();
  const tags = Array.isArray(event.tags) ? event.tags.map((t) => (t || "").toLowerCase()) : [];
  const fullText = `${title} ${descShort} ${desc} ${typeTitle} ${tags.join(" ")}`;

  switch (catId) {
    case "ai-cloud":
      return (
        tags.some(
          (t) =>
            t.includes("ai") ||
            t.includes("cloud") ||
            t.includes("gemini") ||
            t.includes("gemma") ||
            t.includes("machine learning"),
        ) ||
        fullText.includes("ai") ||
        fullText.includes("cloud") ||
        fullText.includes("gemini") ||
        fullText.includes("gemma") ||
        fullText.includes("agent") ||
        fullText.includes("rag") ||
        fullText.includes("machine learning") ||
        fullText.includes("deep learning")
      );

    case "android-mobile":
      return (
        tags.some(
          (t) => t.includes("android") || t.includes("mobile") || t.includes("flutter") || t.includes("kotlin"),
        ) ||
        fullText.includes("android") ||
        fullText.includes("flutter") ||
        fullText.includes("kotlin") ||
        fullText.includes("mobile") ||
        fullText.includes("compose")
      );

    case "web-frontend":
      return (
        tags.some((t) => t.includes("web") || t.includes("firebase") || t.includes("frontend")) ||
        fullText.includes("web") ||
        fullText.includes("frontend") ||
        fullText.includes("next.js") ||
        fullText.includes("react") ||
        fullText.includes("javascript") ||
        fullText.includes("typescript") ||
        fullText.includes("firebase") ||
        fullText.includes("css") ||
        fullText.includes("html")
      );

    case "study-jams":
      return (
        tags.some(
          (t) =>
            t.includes("workshop") ||
            t.includes("study jam") ||
            t.includes("lab") ||
            t.includes("hands-on") ||
            t.includes("meetup"),
        ) ||
        fullText.includes("study jam") ||
        fullText.includes("workshop") ||
        fullText.includes("hands-on") ||
        fullText.includes("devsync") ||
        fullText.includes("meetup") ||
        fullText.includes("lab")
      );

    case "hackathons":
      return (
        tags.some(
          (t) => t.includes("hackathon") || t.includes("conference") || t.includes("devfest") || t.includes("extended"),
        ) ||
        fullText.includes("hackathon") ||
        fullText.includes("conference") ||
        fullText.includes("devfest") ||
        fullText.includes("i/o extended") ||
        fullText.includes("io extended")
      );

    default:
      return true;
  }
}

interface FeaturedEventsSectionProps {
  events: BevyEvent[];
}

export function FeaturedEventsSection({ events }: FeaturedEventsSectionProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const visibleEvents = useMemo(() => {
    return events.filter(
      (e) =>
        (e.status ? e.status.toLowerCase() === "published" : true) &&
        !e.is_hidden &&
        !(e as { hidden?: boolean }).hidden &&
        !e.is_test,
    );
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (activeCategory === "all") {
      return visibleEvents.slice(0, 6);
    }
    const matched = visibleEvents.filter((event) => matchesEventCategory(event, activeCategory));
    return matched.slice(0, 6);
  }, [visibleEvents, activeCategory]);

  return (
    <>
      {/* Category Pill Filter Bar */}
      <div className="border-b py-6" style={{ borderColor: "var(--theme-border)" }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 sm:justify-center">
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className="shrink-0 rounded-full px-5 py-2 font-medium text-[14px] transition-all duration-200 cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? "var(--theme-primary)" : "transparent",
                    color: isSelected ? "var(--theme-primary-foreground)" : "var(--muted-foreground)",
                    border: isSelected ? "1px solid var(--theme-primary)" : "1px solid var(--border)",
                    boxShadow: isSelected ? "var(--theme-shadow)" : "none",
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Featured Events Grid */}
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
            <p className="mt-3 max-w-2xl text-[14px] text-muted-foreground leading-relaxed">
              Join thousands of passionate engineers and creators in Jakarta for hands-on workshops, technical talks,
              and flagship conferences.
            </p>
          </div>

          <Button
            variant="outline"
            asChild
            className="rounded-full border-[var(--theme-border)] px-6 font-medium text-[14px] transition-all duration-300 hover:border-[var(--theme-primary)] hover:text-[var(--theme-text)]"
          >
            <Link href="/events" className="flex items-center gap-1.5">
              <span>View All Events</span>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>

        {/* Events Grid */}
        {filteredEvents.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event, index) => {
              const dateStr = new Date(event.start_date).toLocaleDateString("en-US", {
                timeZone: "Asia/Jakarta",
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
                    priority={index < 2}
                    loading={index < 2 ? "eager" : "lazy"}
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

                    <h3 className="mt-2 line-clamp-2 font-medium text-[22.66px] leading-snug tracking-tight transition-colors group-hover:text-[var(--theme-text)]">
                      <Link href={`/events/${event.id}`} className="hover:underline">
                        {event.title}
                      </Link>
                    </h3>

                    <p className="mt-3 line-clamp-3 flex-1 text-[14px] text-muted-foreground leading-relaxed">
                      {event.description_short ||
                        "Join GDG Jakarta for technical sessions, live demonstrations, and collaborative networking."}
                    </p>

                    <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--theme-border)" }}>
                      <Button
                        asChild
                        className="w-full rounded-full font-medium text-[14px] transition-all duration-300 hover:scale-[1.01]"
                        style={{
                          backgroundColor: "var(--theme-primary)",
                          color: "var(--theme-primary-foreground)",
                        }}
                      >
                        <Link href={`/events/${event.id}`} className="flex items-center justify-center gap-1.5">
                          <span>View Details & RSVP</span>
                          <ChevronRight className="size-4" />
                        </Link>
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
            <h3 className="font-bold text-xl">No events found in this category</h3>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
              We don&apos;t have any scheduled sessions in this track right now. Check back soon or select another
              category.
            </p>
            <div className="mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveCategory("all")}
                className="rounded-full px-5 text-xs font-medium"
              >
                Show All Activities
              </Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
