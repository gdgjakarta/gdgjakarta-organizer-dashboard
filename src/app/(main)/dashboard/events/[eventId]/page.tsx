import { notFound } from "next/navigation";

import { FileSpreadsheet, Package, Users } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllBevyChapterEvents, getBevyEventById, resolveEventAudience } from "@/lib/bevy/client";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";

import { CustomFormTab } from "./_components/custom-form-tab";
import { EventDetailHeader } from "./_components/event-detail-header";
import { MerchandiseTab } from "./_components/merchandise-tab";
import { RegistrantsTab } from "./_components/registrants-tab";

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
          is_hidden: Boolean(matched.is_hidden || (matched as { hidden?: boolean }).hidden),
          is_test: Boolean(matched.is_test),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
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
        <TabsList className="grid w-full grid-cols-3 sm:w-[480px]">
          <TabsTrigger value="registrants" className="gap-1.5 text-xs sm:text-sm">
            <Users className="size-4" />
            Registrants
          </TabsTrigger>
          <TabsTrigger value="form" className="gap-1.5 text-xs sm:text-sm">
            <FileSpreadsheet className="size-4" />
            Registration Form
          </TabsTrigger>
          <TabsTrigger value="merch" className="gap-1.5 text-xs sm:text-sm">
            <Package className="size-4" />
            Merchandise
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrants" className="space-y-4">
          <RegistrantsTab eventId={eventId} registrations={registrations} />
        </TabsContent>

        <TabsContent value="form" className="space-y-4">
          <CustomFormTab event={event} />
        </TabsContent>

        <TabsContent value="merch" className="space-y-4">
          <MerchandiseTab event={event} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
