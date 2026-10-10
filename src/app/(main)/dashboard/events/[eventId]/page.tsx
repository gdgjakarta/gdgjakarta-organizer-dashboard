import { notFound } from "next/navigation";

import { FileSpreadsheet, Mail, Package, Sparkles, Ticket, Users } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllBevyChapterEvents, getBevyEventById, resolveEventAudience } from "@/lib/bevy/client";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";

import { CustomFormTab } from "./_components/custom-form-tab";
import { EmailTemplatesTab } from "./_components/email-templates-tab";
import { EventDetailHeader } from "./_components/event-detail-header";
import { HighlightsMediaTab } from "./_components/highlights-media-tab";
import { MerchandiseTab } from "./_components/merchandise-tab";
import { RegistrantsTab } from "./_components/registrants-tab";
import { TicketsTab } from "./_components/tickets-tab";

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
        total_registrations: direct.total_attendees ?? 0,
        total_approved: direct.total_attendees ?? 0,
        total_checked_in: direct.checkin_count ?? 0,
        is_hidden: Boolean(direct.is_hidden ?? (direct as { hidden?: boolean }).hidden),
        is_test: Boolean(direct.is_test),
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
          total_registrations: matched.total_attendees ?? 0,
          total_approved: matched.total_attendees ?? 0,
          total_checked_in: matched.checkin_count ?? 0,
          is_hidden: Boolean(matched.is_hidden || (matched as { hidden?: boolean }).hidden),
          is_test: Boolean(matched.is_test),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    }

    // Merge or fallback to Firestore
    try {
      const { getFirestoreEventById } = await import("@/lib/firestore/client");
      const firestoreDoc = await getFirestoreEventById(eventId);
      if (firestoreDoc) {
        event = event
          ? {
              ...event,
              ...firestoreDoc,
              id: String(firestoreDoc.id || event.id),
              picture_url: firestoreDoc.picture_url || firestoreDoc.banner_url || event.picture_url,
              banner_url: firestoreDoc.banner_url || firestoreDoc.picture_url || event.banner_url,
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

  return (
    <div className="flex flex-col gap-6">
      <EventDetailHeader
        event={event}
        totalRegistrations={event.total_registrations || 0}
        totalApproved={event.total_approved || 0}
      />

      <Tabs defaultValue="registrants" className="space-y-6">
        <div className="scrollbar-none -mx-1 w-full overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-9 w-max items-center justify-start gap-1 rounded-lg bg-muted p-1 text-muted-foreground group-data-horizontal/tabs:h-9">
            <TabsTrigger value="registrants" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
              <Users className="size-4" />
              Registrants
            </TabsTrigger>
            <TabsTrigger value="form" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
              <FileSpreadsheet className="size-4" />
              Registration Form
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
              <Ticket className="size-4" />
              Tickets
            </TabsTrigger>
            <TabsTrigger value="merch" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
              <Package className="size-4" />
              Merchandise
            </TabsTrigger>
            <TabsTrigger value="highlights" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
              <Sparkles className="size-4" />
              Highlights & Media
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
              <Mail className="size-4" />
              Email Templates
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="registrants" className="space-y-4">
          <RegistrantsTab eventId={eventId} registrations={registrations} event={event} />
        </TabsContent>

        <TabsContent value="form" className="space-y-4">
          <CustomFormTab event={event} />
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <TicketsTab event={event} />
        </TabsContent>

        <TabsContent value="merch" className="space-y-4">
          <MerchandiseTab event={event} />
        </TabsContent>

        <TabsContent value="highlights" className="space-y-4">
          <HighlightsMediaTab event={event} />
        </TabsContent>

        <TabsContent value="emails" className="space-y-4">
          <EmailTemplatesTab event={event} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
