import Image from "next/image";
import Link from "next/link";

import { Calendar, ChevronRight, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BEVY_CONFIG } from "@/config/bevy-config";
import { organizers } from "@/data/organizers";
import { getBevyChapterEvents } from "@/lib/bevy/client";

export default async function Home() {
  const eventsData = await getBevyChapterEvents(BEVY_CONFIG.chapterId, 3, 1);

  const upcomingEvents = eventsData?.results ?? [];

  // Mock sponsors for now
  const sponsors = [
    { name: "Google", logo: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg" },
    { name: "Tech Corp", logo: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" },
  ];

  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* Hero Section */}
      <section className="bg-muted/30 py-20 lg:py-32">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h1 className="font-extrabold text-4xl tracking-tight sm:text-5xl lg:text-6xl">Welcome to GDG Jakarta</h1>
          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground text-xl">
            Google Developer Groups (GDG) Jakarta is a community-run developer group for developers in Jakarta,
            Indonesia who are interested in Google's developer technology.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/events">Browse Events</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/auth/member/login">Join Community</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Latest Events Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-3xl tracking-tight">Upcoming Events</h2>
            <p className="mt-1 text-muted-foreground">Don't miss out on our latest activities.</p>
          </div>
          <Button variant="ghost" asChild className="hidden sm:flex">
            <Link href="/events" className="gap-1">
              View all <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>

        {upcomingEvents.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <Card key={event.id} className="flex flex-col overflow-hidden">
                <div className="relative aspect-video w-full bg-muted">
                  {event.picture?.url ? (
                    <Image src={event.picture.url} alt={event.title} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted/50">
                      <Calendar className="size-10 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="line-clamp-2 text-xl">{event.title}</CardTitle>
                  <CardDescription>
                    {new Date(event.start_date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="line-clamp-3 text-muted-foreground text-sm">
                    {event.description_short || "Join us for this exciting GDG Jakarta event!"}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="secondary" className="w-full" asChild>
                    {event.url ? (
                      <a href={event.url} target="_blank" rel="noreferrer">
                        View Details
                      </a>
                    ) : (
                      <span>Details Unavailable</span>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <Calendar className="mx-auto mb-4 size-10 text-muted-foreground/50" />
            <h3 className="font-semibold text-lg">No upcoming events</h3>
            <p className="mt-1 text-muted-foreground text-sm">Check back later for new activities.</p>
          </div>
        )}
      </section>

      {/* Organizers Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="font-bold text-3xl tracking-tight">Meet the Organizers</h2>
          <p className="mt-1 text-muted-foreground">The passionate team behind GDG Jakarta.</p>
        </div>

        {organizers.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-8">
            {organizers.map((member) => {
              const name = member.name;
              const avatar = member.avatar;
              const roleName = member.role;

              return (
                <div key={member.id || name} className="flex flex-col items-center justify-center p-4 text-center">
                  <div className="relative mb-4 size-48 overflow-hidden rounded-full bg-muted shadow-sm">
                    {avatar ? (
                      <Image src={avatar} alt={name} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Users className="size-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm leading-tight">{name}</h3>
                  <p className="mt-1 line-clamp-1 text-muted-foreground text-xs">{roleName}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-muted-foreground text-sm">Unable to load organizer list at this time.</div>
        )}
      </section>

      {/* Sponsors Section */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-8 font-bold text-2xl tracking-tight">Our Sponsors & Partners</h2>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-70 grayscale transition-all hover:grayscale-0 md:gap-16">
            {sponsors.map((sponsor) => (
              <div key={sponsor.name} className="relative h-12 w-32 md:h-16 md:w-40">
                <Image src={sponsor.logo} alt={sponsor.name} fill className="object-contain" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
