import { notFound } from "next/navigation";

import { FileSpreadsheet, Package, Users } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBevyChapterEvents } from "@/lib/bevy/client";
import { getEventRegistrations, getFirestoreEventById } from "@/lib/firestore/client";
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

  let event: FirestoreEvent | null = await getFirestoreEventById(eventId);
  let registrations: FirestoreRegistration[] = [];

  // If not in Firestore, try fallback lookup from Bevy API
  if (!event) {
    try {
      const bevyEvents = await getBevyChapterEvents();
      const matched = bevyEvents?.results?.find((e) => String(e.id) === eventId);
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
    } catch {
      // Ignore fallback error
    }
  }

  if (!event) {
    notFound();
  }

  try {
    registrations = await getEventRegistrations(eventId);
  } catch (error) {
    console.error("[Event Details] Failed to load registrations:", error);
  }

  const totalApproved = registrations.filter((r) => r.status === "approved" || r.status === "attended").length;

  return (
    <div className="flex flex-col gap-6">
      <EventDetailHeader
        event={event}
        totalRegistrations={registrations.length || event.total_registrations || 0}
        totalApproved={totalApproved || event.total_approved || 0}
      />

      <Tabs defaultValue="registrants" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-[480px]">
          <TabsTrigger value="registrants" className="gap-1.5 text-xs sm:text-sm">
            <Users className="size-4" />
            Registrants ({registrations.length})
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
