import Image from "next/image";

import { Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BEVY_CONFIG } from "@/config/bevy-config";
import { getBevyChapterEvents } from "@/lib/bevy/client";

export default async function EventsDirectoryPage() {
  const eventsData = await getBevyChapterEvents(BEVY_CONFIG.chapterId, 100, 1);
  const events = eventsData?.results ?? [];

  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <h1 className="font-extrabold text-4xl tracking-tight sm:text-5xl">Events Directory</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground text-xl">
          Discover all upcoming and past events hosted by GDG Jakarta.
        </p>
      </div>

      {events.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((event) => (
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
        <div className="rounded-xl border border-dashed p-16 text-center">
          <Calendar className="mx-auto mb-4 size-12 text-muted-foreground/50" />
          <h3 className="font-semibold text-xl">No events found</h3>
          <p className="mt-2 text-muted-foreground">Check back later for new activities and meetups.</p>
        </div>
      )}
    </div>
  );
}
