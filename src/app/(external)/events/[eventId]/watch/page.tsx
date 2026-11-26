import { cache } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft, Radio } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicEventById } from "@/lib/bevy/client";
import { getPublicEventStreamMetaAction } from "@/server/stream-actions";

import { RestrictedStreamViewer } from "./_components/restricted-stream-viewer";

export const dynamic = "force-dynamic";

interface EventWatchPageProps {
  params: Promise<{ eventId: string }>;
}

// Deduplicate SSR fetches between generateMetadata and page render (PERF-4)
const getWatchPageData = cache(async (eventId: string) => {
  const [event, streamMeta] = await Promise.all([
    getPublicEventById(eventId),
    getPublicEventStreamMetaAction(eventId),
  ]);
  return { event, streamMeta };
});

export async function generateMetadata({ params }: EventWatchPageProps): Promise<Metadata> {
  const { eventId } = await params;
  const { event, streamMeta } = await getWatchPageData(eventId);

  const title = streamMeta?.title || event?.title || "Event Stream";
  return {
    title: `${title} | Watch`,
    description:
      streamMeta?.accessMode === "whitelisted"
        ? "Restricted event stream — verify your whitelisted email to watch."
        : `Watch ${title} live on GDG Jakarta.`,
    robots: { index: false, follow: false },
  };
}

export default async function EventWatchPage({ params }: EventWatchPageProps) {
  const { eventId } = await params;
  const { event, streamMeta } = await getWatchPageData(eventId);

  if (!event && !streamMeta) {
    notFound();
  }

  if (!streamMeta || !streamMeta.enabled) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <Radio className="size-5 text-muted-foreground" />
            </div>
            <CardTitle>Stream Not Active</CardTitle>
            <CardDescription>
              The livestream for <strong>{event?.title ?? "this event"}</strong> is not currently enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" asChild>
              <Link href={`/events/${encodeURIComponent(eventId)}`}>
                <ArrowLeft className="mr-2 size-4" />
                Back to Event Page
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <RestrictedStreamViewer
      eventId={eventId}
      eventTitle={event?.title ?? streamMeta.title ?? "GDG Jakarta Event"}
      streamMeta={streamMeta}
    />
  );
}
