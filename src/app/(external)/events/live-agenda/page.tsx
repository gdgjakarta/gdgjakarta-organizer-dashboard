import { getBevyChapterEvents, getBevyEventById } from "@/lib/bevy/client";
import { getAllEventSpeakers } from "@/lib/bevy/speakers";
import { buildLiveAgendaStages, getDateKeyInTimeZone, type LiveAgendaStage } from "@/lib/events/live-agenda";
import type { FirestoreEvent } from "@/lib/firestore/types";

import { LiveAgendaView } from "./_components/live-agenda-view";

export const dynamic = "force-dynamic";

interface LiveAgendaPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function loadFirestoreAgendaData(
  eventId: string,
): Promise<Pick<FirestoreEvent, "sessions" | "presentation_slides">> {
  try {
    const { getFirestoreEventByIdServer } = await import("@/server/firestore-admin");
    const firestoreEvent = await getFirestoreEventByIdServer(eventId);
    return { sessions: firestoreEvent?.sessions, presentation_slides: firestoreEvent?.presentation_slides };
  } catch {
    // Agenda still renders from Bevy alone when Firestore is unavailable.
    return {};
  }
}

async function loadEvent(eventId: string): Promise<{ title: string; stages: LiveAgendaStage[] } | null> {
  const [event, firestoreData] = await Promise.all([getBevyEventById(eventId), loadFirestoreAgendaData(eventId)]);
  if (!event) return null;

  const stages = buildLiveAgendaStages({
    eventId,
    eventTitle: event.title,
    agenda: event.agenda,
    speakers: event.speakers && event.speakers.length > 0 ? event.speakers : getAllEventSpeakers(event),
    sessions: firestoreData.sessions,
    presentationSlides: firestoreData.presentation_slides,
  });
  return { title: event.title, stages };
}

async function resolveEventIds(requestedEventId?: string): Promise<string[]> {
  // `?eventId=` pins the page to one event regardless of its date (preview / direct links).
  if (requestedEventId) return [requestedEventId];

  const bevy = await getBevyChapterEvents(undefined, 100, 1, true, "Published");
  const today = getDateKeyInTimeZone(new Date());

  // Nearest event that is running or still ahead, plus any other event starting the same day
  // (e.g. a Conference and a Seminar held in parallel).
  const upcoming = (bevy?.results ?? [])
    .filter((event) => event.start_date)
    .map((event) => ({
      id: String(event.id),
      startDay: getDateKeyInTimeZone(event.start_date),
      endDay: getDateKeyInTimeZone(event.end_date || event.start_date),
    }))
    .filter((event) => event.endDay >= today)
    .sort((a, b) => a.startDay.localeCompare(b.startDay));

  const nearestStartDay = upcoming[0]?.startDay;
  return upcoming.filter((event) => event.startDay === nearestStartDay).map((event) => event.id);
}

export default async function LiveAgendaPage({ searchParams }: LiveAgendaPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedEventId = typeof resolvedSearchParams.eventId === "string" ? resolvedSearchParams.eventId : undefined;

  let stages: LiveAgendaStage[] = [];
  let eventName = "";
  try {
    const eventIds = await resolveEventIds(requestedEventId);
    const events = (await Promise.all(eventIds.map(loadEvent))).filter((event) => event !== null);
    stages = events.flatMap((event) => event.stages);
    // Parallel events (e.g. a Conference and a Seminar) are thanked together.
    eventName = [...new Set(events.map((event) => event.title))].join(" & ");
  } catch (error) {
    console.error("[LiveAgendaPage] Failed to load live agenda:", error);
  }

  return (
    <div className="container mx-auto flex flex-col px-4 py-6 sm:px-6 lg:px-8">
      <LiveAgendaView stages={stages} eventName={eventName} />
    </div>
  );
}
