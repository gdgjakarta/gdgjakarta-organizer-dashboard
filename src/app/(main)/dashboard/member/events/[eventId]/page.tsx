import { notFound } from "next/navigation";

import { getBevyChapterEvents, getBevyEventById, resolveEventAudience } from "@/lib/bevy/client";
import type { FirestoreEvent } from "@/lib/firestore/types";

import { MemberEventDetail } from "./_components/member-event-detail";

export const dynamic = "force-dynamic";

interface MemberEventDetailPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function MemberEventDetailPage({ params }: MemberEventDetailPageProps) {
  const { eventId } = await params;

  let event: FirestoreEvent | null = null;

  try {
    const direct = await getBevyEventById(eventId);
    if (direct) {
      if (direct.is_hidden || (direct as { hidden?: boolean }).hidden) {
        notFound();
      }
      const { audienceType, isVirtual } = resolveEventAudience(direct.audience_type, direct.is_virtual_event);
      event = {
        id: String(direct.id),
        title: direct.title,
        description: direct.description ?? undefined,
        description_short: direct.description_short ?? undefined,
        status: (direct.status as FirestoreEvent["status"]) ?? "Published",
        start_date: direct.start_date,
        end_date: direct.end_date,
        picture_url: direct.picture?.thumbnail_url ?? direct.picture?.url ?? undefined,
        banner_url: direct.banner?.url ?? undefined,
        event_type_title: direct.event_type_title ?? "Standard Event",
        audience_type: audienceType,
        is_virtual: isVirtual,
        venue:
          direct.venue_name || direct.venue_address || direct.venue_city
            ? {
                name: direct.venue_name,
                address: direct.venue_address,
                city: direct.venue_city,
              }
            : undefined,
        url: direct.url ?? undefined,
        static_url: direct.static_url ?? undefined,
        tags: direct.tags ?? [],
        requires_approval: false,
        total_registrations: direct.total_attendees ?? 0,
        total_approved: direct.total_attendees ?? 0,
        total_checked_in: direct.checkin_count ?? 0,
        is_hidden: false,
        is_test: Boolean(direct.is_test),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      const chapterEvents = await getBevyChapterEvents(undefined, 100, 1, false, "Published");
      const matched = chapterEvents?.results?.find(
        (e) =>
          String(e.id) === eventId &&
          !e.is_hidden &&
          !(e as { hidden?: boolean }).hidden &&
          (e.status ? e.status.toLowerCase() === "published" : true),
      );
      if (matched) {
        const { audienceType, isVirtual } = resolveEventAudience(matched.audience_type, matched.is_virtual_event);
        event = {
          id: String(matched.id),
          title: matched.title,
          description: matched.description ?? undefined,
          description_short: matched.description_short ?? undefined,
          status: (matched.status as FirestoreEvent["status"]) ?? "Published",
          start_date: matched.start_date,
          end_date: matched.end_date,
          picture_url: matched.picture?.thumbnail_url ?? matched.picture?.url ?? undefined,
          banner_url: matched.banner?.url ?? undefined,
          event_type_title: matched.event_type_title ?? "Standard Event",
          audience_type: audienceType,
          is_virtual: isVirtual,
          venue:
            matched.venue_name || matched.venue_address || matched.venue_city
              ? {
                  name: matched.venue_name,
                  address: matched.venue_address,
                  city: matched.venue_city,
                }
              : undefined,
          url: matched.url ?? undefined,
          static_url: matched.static_url ?? undefined,
          tags: matched.tags ?? [],
          requires_approval: false,
          total_registrations: matched.total_attendees ?? 0,
          total_approved: matched.total_attendees ?? 0,
          total_checked_in: matched.checkin_count ?? 0,
          is_test: Boolean(matched.is_test),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.error("[MemberEventDetailPage] Failed to fetch Bevy event:", err);
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
