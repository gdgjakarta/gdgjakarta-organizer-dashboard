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
        virtual_event_type: direct.virtual_event_type ?? undefined,
        attendee_virtual_venue_link: direct.attendee_virtual_venue_link ?? undefined,
        join_virtual_event_url: direct.join_virtual_event_url ?? undefined,
        virtual_event_instructions:
          typeof direct.virtual_event_instructions === "string" ? direct.virtual_event_instructions : undefined,
        venue:
          direct.venue_name || direct.venue_address || direct.venue_city || direct.venue_zip_code
            ? {
                name: direct.venue_name,
                address: direct.venue_address,
                city: direct.venue_city,
                state: direct.venue_state,
                zip_code: direct.venue_zip_code,
                country: direct.venue_country,
                latitude: direct.venue_latitude,
                longitude: direct.venue_longitude,
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
        video_url: direct.video_url ?? undefined,
        highlight_video_url: direct.highlight_video_url ?? direct.video_url ?? undefined,
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
            matched.venue_name || matched.venue_address || matched.venue_city || matched.venue_zip_code
              ? {
                  name: matched.venue_name,
                  address: matched.venue_address,
                  city: matched.venue_city,
                  state: matched.venue_state,
                  zip_code: matched.venue_zip_code,
                  country: matched.venue_country,
                  latitude: matched.venue_latitude,
                  longitude: matched.venue_longitude,
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
          video_url: matched.video_url ?? undefined,
          highlight_video_url: matched.highlight_video_url ?? matched.video_url ?? undefined,
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
              status: event.status || firestoreDoc.status,
              title: event.title || firestoreDoc.title,
              venue:
                event.venue || firestoreDoc.venue
                  ? {
                      ...(firestoreDoc.venue ?? {}),
                      ...(event.venue ?? {}),
                      name: event.venue?.name ?? firestoreDoc.venue?.name,
                      address: event.venue?.address ?? firestoreDoc.venue?.address,
                      city: event.venue?.city ?? firestoreDoc.venue?.city,
                      state: event.venue?.state ?? firestoreDoc.venue?.state,
                      zip_code: event.venue?.zip_code ?? firestoreDoc.venue?.zip_code,
                      country: event.venue?.country ?? firestoreDoc.venue?.country,
                      latitude: event.venue?.latitude ?? firestoreDoc.venue?.latitude,
                      longitude: event.venue?.longitude ?? firestoreDoc.venue?.longitude,
                    }
                  : undefined,
              audience_type: event.audience_type || firestoreDoc.audience_type,
              virtual_event_type: event.virtual_event_type ?? firestoreDoc.virtual_event_type,
              attendee_virtual_venue_link:
                event.attendee_virtual_venue_link ?? firestoreDoc.attendee_virtual_venue_link,
              join_virtual_event_url: event.join_virtual_event_url ?? firestoreDoc.join_virtual_event_url,
              virtual_event_instructions: event.virtual_event_instructions ?? firestoreDoc.virtual_event_instructions,
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
              bundles: firestoreDoc.bundles ?? event.bundles,
              printer_config: firestoreDoc.printer_config ?? event.printer_config,
              google_maps_url: firestoreDoc.google_maps_url ?? event.google_maps_url,
              venue_map_url: firestoreDoc.venue_map_url ?? event.venue_map_url,
              video_url: event.video_url || firestoreDoc.video_url,
              highlight_video_url: event.video_url ?? event.highlight_video_url ?? firestoreDoc.highlight_video_url,
              highlight_video_title: firestoreDoc.highlight_video_title ?? event.highlight_video_title,
              photo_album_url: firestoreDoc.photo_album_url ?? event.photo_album_url,
              photo_album_title: firestoreDoc.photo_album_title ?? event.photo_album_title,
              recap_description: firestoreDoc.recap_description ?? event.recap_description,
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
        totalDeliveries={registrations.filter((r) => Boolean(r.delivery_request)).length}
        initialRole={initialRole}
      />

      <EventDetailTabs eventId={eventId} event={event} registrations={registrations} initialRole={initialRole} />
    </div>
  );
}
