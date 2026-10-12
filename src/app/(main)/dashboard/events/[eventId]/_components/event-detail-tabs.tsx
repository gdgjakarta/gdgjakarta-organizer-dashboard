"use client";

import { useMemo } from "react";

import {
  CreditCard,
  FileSpreadsheet,
  Mail,
  Package,
  PackageCheck,
  Sparkles,
  Ticket,
  TicketPercent,
  Truck,
  Users,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isExecutiveOrganizer } from "@/lib/auth-roles";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { BundlesTab } from "./bundles-tab";
import { CustomFormTab } from "./custom-form-tab";
import { EmailTemplatesTab } from "./email-templates-tab";
import { HighlightsMediaTab } from "./highlights-media-tab";
import { MerchandiseDeliveryTab } from "./merchandise-delivery-tab";
import { MerchandiseTab } from "./merchandise-tab";
import { PaymentGatewayTab } from "./payment-gateway-tab";
import { RegistrantsTab } from "./registrants-tab";
import { TicketsTab } from "./tickets-tab";
import { VouchersTab } from "./vouchers-tab";

interface EventDetailTabsProps {
  eventId: string;
  event: FirestoreEvent;
  registrations: FirestoreRegistration[];
  initialRole?: string;
}

export function EventDetailTabs({ eventId, event, registrations, initialRole }: EventDetailTabsProps) {
  const user = useAuthStore((s) => s.user);

  // Check if current user is an Executive Organizer.
  // Non-organizers (Core Team, Team Member, Check-in Staff) only have access to Registrants and Highlights & Media.
  const isOrganizer = useMemo(() => {
    if (user) {
      return isExecutiveOrganizer(user);
    }
    return isExecutiveOrganizer(initialRole);
  }, [user, initialRole]);

  return (
    <Tabs defaultValue="registrants" className="space-y-6">
      <div className="scrollbar-none -mx-1 w-full overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0">
        <TabsList className="inline-flex h-9 w-max items-center justify-start gap-1 rounded-lg bg-muted p-1 text-muted-foreground group-data-horizontal/tabs:h-9">
          <TabsTrigger value="registrants" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
            <Users className="size-4" />
            Registrants
          </TabsTrigger>

          {isOrganizer && (
            <>
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
              <TabsTrigger value="bundles" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
                <PackageCheck className="size-4" />
                Bundles
              </TabsTrigger>
              <TabsTrigger value="delivery" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
                <Truck className="size-4" />
                Merchandise Delivery
              </TabsTrigger>
              <TabsTrigger value="vouchers" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
                <TicketPercent className="size-4" />
                Vouchers
              </TabsTrigger>
              <TabsTrigger value="payment" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
                <CreditCard className="size-4" />
                Payment Gateway
              </TabsTrigger>
            </>
          )}

          <TabsTrigger value="highlights" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
            <Sparkles className="size-4" />
            Highlights & Media
          </TabsTrigger>

          {isOrganizer && (
            <TabsTrigger value="emails" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
              <Mail className="size-4" />
              Email Templates
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      <TabsContent value="registrants" className="space-y-4">
        <RegistrantsTab eventId={eventId} registrations={registrations} event={event} />
      </TabsContent>

      {isOrganizer && (
        <>
          <TabsContent value="form" className="space-y-4">
            <CustomFormTab event={event} />
          </TabsContent>

          <TabsContent value="tickets" className="space-y-4">
            <TicketsTab event={event} />
          </TabsContent>

          <TabsContent value="merch" className="space-y-4">
            <MerchandiseTab event={event} />
          </TabsContent>

          <TabsContent value="bundles" className="space-y-4">
            <BundlesTab event={event} />
          </TabsContent>

          <TabsContent value="delivery" className="space-y-4">
            <MerchandiseDeliveryTab event={event} eventId={eventId} />
          </TabsContent>

          <TabsContent value="vouchers" className="space-y-4">
            <VouchersTab event={event} />
          </TabsContent>

          <TabsContent value="payment" className="space-y-4">
            <PaymentGatewayTab event={event} />
          </TabsContent>
        </>
      )}

      <TabsContent value="highlights" className="space-y-4">
        <HighlightsMediaTab event={event} />
      </TabsContent>

      {isOrganizer && (
        <TabsContent value="emails" className="space-y-4">
          <EmailTemplatesTab event={event} />
        </TabsContent>
      )}
    </Tabs>
  );
}
