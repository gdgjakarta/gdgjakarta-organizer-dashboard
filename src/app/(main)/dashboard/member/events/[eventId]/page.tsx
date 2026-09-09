import { notFound } from "next/navigation";

import { getBevyChapterEvents, getBevyEventById } from "@/lib/bevy/client";
import { getFirestoreEventById } from "@/lib/firestore/client";
import type { FirestoreEvent } from "@/lib/firestore/types";

import { MemberEventDetail } from "./_components/member-event-detail";

export const dynamic = "force-dynamic";

interface MemberEventDetailPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function MemberEventDetailPage({ params }: MemberEventDetailPageProps) {
  const { eventId } = await params;

  let event: FirestoreEvent | null = await getFirestoreEventById(eventId);

  // If not found in Firestore or description is missing, fetch full event from Bevy
  if (!event?.description) {
    try {
      const direct = await getBevyEventById(eventId);
      if (direct) {
        event = {
          id: String(direct.id),
          title: direct.title || event?.title || "Untitled Event",
          description: direct.description || event?.description,
          description_short: direct.description_short || event?.description_short,
          status: (direct.status as FirestoreEvent["status"]) || event?.status || "Published",
          start_date: direct.start_date || event?.start_date || new Date().toISOString(),
          end_date: direct.end_date || direct.start_date || event?.end_date || new Date().toISOString(),
          picture_url: direct.picture?.thumbnail_url || direct.picture?.url || event?.picture_url,
          banner_url: direct.banner?.url || event?.banner_url,
          event_type_title: direct.event_type_title || event?.event_type_title || "Standard Event",
          audience_type:
            direct.audience_type || event?.audience_type || (direct.is_virtual_event ? "VIRTUAL" : "IN_PERSON"),
          is_virtual: Boolean(direct.is_virtual_event || direct.audience_type === "VIRTUAL"),
          url: direct.url || event?.url,
          static_url: direct.static_url || event?.static_url,
          tags: direct.tags || event?.tags || [],
          requires_approval: event?.requires_approval || false,
          total_registrations: direct.total_attendees ?? event?.total_registrations ?? 0,
          total_approved: direct.total_attendees ?? event?.total_approved ?? 0,
          total_checked_in: direct.checkin_count ?? event?.total_checked_in ?? 0,
          created_at: event?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        const chapterEvents = await getBevyChapterEvents();
        const matched = chapterEvents?.results?.find((e) => String(e.id) === eventId);
        if (matched) {
          event = {
            id: String(matched.id),
            title: matched.title || "Untitled Event",
            description: matched.description,
            description_short: matched.description_short,
            status: (matched.status as FirestoreEvent["status"]) || "Published",
            start_date: matched.start_date || new Date().toISOString(),
            end_date: matched.end_date || matched.start_date || new Date().toISOString(),
            picture_url: matched.picture?.thumbnail_url || matched.picture?.url,
            banner_url: matched.banner?.url,
            event_type_title: matched.event_type_title || "Standard Event",
            audience_type: matched.audience_type || (matched.is_virtual_event ? "VIRTUAL" : "IN_PERSON"),
            is_virtual: Boolean(matched.is_virtual_event || matched.audience_type === "VIRTUAL"),
            url: matched.url,
            static_url: matched.static_url,
            tags: matched.tags || [],
            requires_approval: false,
            total_registrations: matched.total_attendees ?? 0,
            total_approved: matched.total_attendees ?? 0,
            total_checked_in: matched.checkin_count ?? 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.error("[MemberEventDetailPage] Failed to fetch Bevy event:", err);
    }
  }

  if (!event) {
    notFound();
  }

  return (
    <div className="flex h-full flex-col p-4 md:p-6 lg:p-8">
      <MemberEventDetail event={event} />
    </div>
  );
}
