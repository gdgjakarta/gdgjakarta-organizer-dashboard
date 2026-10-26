import { notFound } from "next/navigation";

import { getAllBevyChapterEvents, getBevyEventById, resolveEventAudience } from "@/lib/bevy/client";
import { getAllEventSpeakers } from "@/lib/bevy/speakers";
import { hasActualAgendaActivities } from "@/lib/events/agenda-unification";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { getVerifiedSessionRole } from "@/server/auth-guard";

import { EventDetailHeader } from "./_components/event-detail-header";
import { EventDetailTabs } from "./_components/event-detail-tabs";

export const dynamic = "force-dynamic";

interface EventDetailPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params;

  let event: FirestoreEvent | null = null;
  const registrations: FirestoreRegistration[] = [];

  try {
    const direct = await getBevyEventById(eventId);
    if (direct) {
      const { audienceType, isVirtual } = resolveEventAudience(direct.audience_type, direct.is_virtual_event);
      const pictureUrl =
        direct.picture?.url ??
        direct.picture?.thumbnail_url ??
        direct.cropped_picture_url ??
        direct.banner?.url ??
        direct.banner?.thumbnail_url ??
        direct.cropped_banner_url ??
        (direct as unknown as { picture_url?: string }).picture_url ??
        undefined;
      const bannerUrl =
        direct.banner?.url ??
        direct.banner?.thumbnail_url ??
        direct.cropped_banner_url ??
        direct.picture?.url ??
        direct.picture?.thumbnail_url ??
        direct.cropped_picture_url ??
        (direct as unknown as { banner_url?: string }).banner_url ??
        undefined;

      event = {
        id: String(direct.id),
        title: direct.title,
        description: direct.description ?? undefined,
        description_short: direct.description_short ?? undefined,
        status: (direct.status as FirestoreEvent["status"]) ?? "Published",
        start_date: direct.start_date,
        end_date: direct.end_date,
        picture_url: pictureUrl,
        banner_url: bannerUrl,
        picture: direct.picture,
        banner: direct.banner,
        cropped_picture_url: direct.cropped_picture_url,
        cropped_banner_url: direct.cropped_banner_url,
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
        registration_status: "Closed",
        custom_questions: [],
        total_registrations: direct.total_attendees ?? 0,
        total_approved: direct.total_attendees ?? 0,
        total_checked_in: direct.checkin_count ?? 0,
        is_hidden: Boolean(direct.is_hidden ?? (direct as { hidden?: boolean }).hidden),
        is_test: Boolean(direct.is_test),
        speakers: getAllEventSpeakers(direct),
        agenda: direct.agenda,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      const { results: chapterEvents } = await getAllBevyChapterEvents(undefined, true, "All");
      const matched = chapterEvents.find((e) => String(e.id) === eventId);
      if (matched) {
        const { audienceType, isVirtual } = resolveEventAudience(matched.audience_type, matched.is_virtual_event);
        const pictureUrl =
          matched.picture?.url ??
          matched.picture?.thumbnail_url ??
          matched.cropped_picture_url ??
          matched.banner?.url ??
          matched.cropped_banner_url ??
          (matched as unknown as { picture_url?: string }).picture_url ??
          undefined;
        const bannerUrl =
          matched.banner?.url ??
          matched.banner?.thumbnail_url ??
          matched.cropped_banner_url ??
          matched.picture?.url ??
          matched.cropped_picture_url ??
          (matched as unknown as { banner_url?: string }).banner_url ??
          undefined;

        event = {
          id: String(matched.id),
          title: matched.title,
          description: matched.description ?? undefined,
          description_short: matched.description_short ?? undefined,
          status: (matched.status as FirestoreEvent["status"]) ?? "Published",
          start_date: matched.start_date,
          end_date: matched.end_date,
          picture_url: pictureUrl,
          banner_url: bannerUrl,
          picture: matched.picture,
          banner: matched.banner,
          cropped_picture_url: matched.cropped_picture_url,
          cropped_banner_url: matched.cropped_banner_url,
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
          registration_status: "Closed",
          custom_questions: [],
          total_registrations: matched.total_attendees ?? 0,
          total_approved: matched.total_attendees ?? 0,
          total_checked_in: matched.checkin_count ?? 0,
          is_hidden: Boolean(matched.is_hidden || (matched as { hidden?: boolean }).hidden),
          is_test: Boolean(matched.is_test),
          speakers: getAllEventSpeakers(matched),
          agenda: matched.agenda,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    }

    // Merge or fallback to Firestore
    try {
      const { getFirestoreEventByIdServer } = await import("@/server/firestore-admin");
      const firestoreDoc = await getFirestoreEventByIdServer(eventId);
      if (firestoreDoc) {
        let resolvedAgenda = event?.agenda;
        if (!hasActualAgendaActivities(resolvedAgenda) && hasActualAgendaActivities(firestoreDoc.agenda)) {
          resolvedAgenda = firestoreDoc.agenda;
        }

        let resolvedSpeakers = event?.speakers;
        if (
          (!resolvedSpeakers || resolvedSpeakers.length === 0) &&
          firestoreDoc.speakers &&
          firestoreDoc.speakers.length > 0
        ) {
          resolvedSpeakers = firestoreDoc.speakers;
        }

        event = event
          ? {
              ...firestoreDoc,
              ...event,
              id: String(event.id || firestoreDoc.id),
              // Ensure core Bevy upstream fields always take precedence over stale cached Firestore data
              title: event.title || firestoreDoc.title,
              venue: event.venue ?? firestoreDoc.venue,
              start_date: event.start_date || firestoreDoc.start_date,
              end_date: event.end_date || firestoreDoc.end_date,
              picture_url: event.picture_url || firestoreDoc.picture_url || firestoreDoc.banner_url,
              banner_url: event.banner_url || firestoreDoc.banner_url || firestoreDoc.picture_url,
              agenda: resolvedAgenda,
              speakers: resolvedSpeakers,
              // Keep Firestore dashboard extensions that do not exist in Bevy
              requires_approval: firestoreDoc.requires_approval ?? event.requires_approval,
              registration_status: firestoreDoc.registration_status ?? event.registration_status ?? "Closed",
              curation_mode: firestoreDoc.curation_mode ?? event.curation_mode,
              allow_waitlist: firestoreDoc.allow_waitlist ?? event.allow_waitlist,
              max_attendees: firestoreDoc.max_attendees ?? event.max_attendees,
              custom_questions: firestoreDoc.custom_questions ?? event.custom_questions ?? [],
              sessions: firestoreDoc.sessions ?? event.sessions,
              presentation_slides: firestoreDoc.presentation_slides ?? event.presentation_slides,
              tickets: firestoreDoc.tickets ?? event.tickets,
              merchandise: firestoreDoc.merchandise ?? event.merchandise,
              vouchers: firestoreDoc.vouchers ?? event.vouchers,
              bundles: firestoreDoc.bundles ?? event.bundles,
              google_maps_url: firestoreDoc.google_maps_url ?? event.google_maps_url,
            }
          : firestoreDoc;
      }
    } catch {
      // Ignore firestore load error
    }
  } catch (error) {
    console.error("[Event Details] Failed to load event:", error);
  }

  if (!event) {
    notFound();
  }

  const initialRole = (await getVerifiedSessionRole()) ?? "member";

  return (
    <div className="flex flex-col gap-6">
      <EventDetailHeader
        event={event}
        totalRegistrations={event.total_registrations || 0}
        totalApproved={event.total_approved || 0}
        totalWaitlisted={event.total_waitlisted || 0}
        totalCheckedIn={event.total_checked_in || 0}
        totalRefunds={registrations.filter((r) => Boolean(r.refund_request)).length}
        initialRole={initialRole}
      />

      <EventDetailTabs eventId={eventId} event={event} registrations={registrations} initialRole={initialRole} />
    </div>
  );
}
