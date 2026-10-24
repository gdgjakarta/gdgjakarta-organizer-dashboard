"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CreditCard,
  FileSpreadsheet,
  Layers,
  Mail,
  Package,
  PackageCheck,
  RotateCcw,
  Sparkles,
  Ticket,
  TicketPercent,
  Truck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasTeamOperationalAccess, isExecutiveOrganizer } from "@/lib/auth-roles";
import { hasPaidTicketOrMerchandise } from "@/lib/events/registration-defaults";
import { ensureEventTickets } from "@/lib/events/ticket-templates";
import type {
  EventBundlePackage,
  EventMerchandiseItem,
  EventTicketTier,
  FirestoreEvent,
  FirestoreRegistration,
} from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { BreakoutSessionsTab } from "./breakout-sessions-tab";
import { BundlesTab } from "./bundles-tab";
import { CustomFormTab } from "./custom-form-tab";
import { EmailTemplatesTab } from "./email-templates-tab";
import { HighlightsMediaTab } from "./highlights-media-tab";
import { MerchandiseDeliveryTab } from "./merchandise-delivery-tab";
import { MerchandiseTab } from "./merchandise-tab";
import { PaymentGatewayTab } from "./payment-gateway-tab";
import { RefundsTab } from "./refunds-tab";
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
  const [activeEvent, setActiveEvent] = useState<FirestoreEvent>(event);

  useEffect(() => {
    setActiveEvent(event);
  }, [event]);

  useEffect(() => {
    if (!eventId) return;

    const handlePaymentEnvChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId: string; environment: "production" | "sandbox" }>;
      if (customEvent.detail && String(customEvent.detail.eventId) === String(eventId)) {
        setActiveEvent((prev) => ({
          ...prev,
          payment_environment: customEvent.detail.environment,
        }));
      }
    };

    const handleTicketsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId: string; tickets: EventTicketTier[] }>;
      if (customEvent.detail && String(customEvent.detail.eventId) === String(eventId)) {
        setActiveEvent((prev) => ({
          ...prev,
          tickets: ensureEventTickets(customEvent.detail.tickets),
        }));
      }
    };

    const handleMerchandiseUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId: string; merchandise: EventMerchandiseItem[] }>;
      if (customEvent.detail && String(customEvent.detail.eventId) === String(eventId)) {
        setActiveEvent((prev) => ({
          ...prev,
          merchandise: customEvent.detail.merchandise,
        }));
      }
    };

    const handleBundlesUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId: string; bundles: EventBundlePackage[] }>;
      if (customEvent.detail && String(customEvent.detail.eventId) === String(eventId)) {
        setActiveEvent((prev) => ({
          ...prev,
          bundles: customEvent.detail.bundles,
        }));
      }
    };

    window.addEventListener("gdg:payment-env-change", handlePaymentEnvChange);
    window.addEventListener("gdg:tickets-updated", handleTicketsUpdated);
    window.addEventListener("gdg:merchandise-updated", handleMerchandiseUpdated);
    window.addEventListener("gdg:bundles-updated", handleBundlesUpdated);

    let unsubscribe: (() => void) | undefined;
    async function setupSub() {
      try {
        const { subscribeFirestoreEventDoc } = await import("@/lib/firestore/client");
        unsubscribe = subscribeFirestoreEventDoc(String(eventId), (docData) => {
          if (docData) {
            setActiveEvent((prev) => ({
              ...prev,
              ...docData,
              title: prev.title || docData.title,
              start_date: prev.start_date || docData.start_date,
              end_date: prev.end_date || docData.end_date,
              venue: prev.venue ?? docData.venue,
              google_maps_url: docData.google_maps_url ?? prev.google_maps_url,
              tickets: ensureEventTickets(docData.tickets ?? prev.tickets),
              merchandise: docData.merchandise ?? prev.merchandise,
            }));
          }
        });
      } catch (err) {
        console.warn("[EventDetailTabs] Failed to subscribe to Firestore event doc:", err);
      }
    }
    void setupSub();

    return () => {
      window.removeEventListener("gdg:payment-env-change", handlePaymentEnvChange);
      window.removeEventListener("gdg:tickets-updated", handleTicketsUpdated);
      window.removeEventListener("gdg:merchandise-updated", handleMerchandiseUpdated);
      window.removeEventListener("gdg:bundles-updated", handleBundlesUpdated);
      unsubscribe?.();
    };
  }, [eventId]);

  // Check if current user is an Executive Organizer or has Team Operational Access.
  // Executive Organizers manage forms, tickets, vouchers, merch, gateway, and emails.
  // Team members (Core Team, Team Member, Check-in Staff) have access to Registrants and Highlights & Media.
  const isOrganizer = useMemo(() => {
    if (user) {
      return isExecutiveOrganizer(user);
    }
    return isExecutiveOrganizer(initialRole);
  }, [user, initialRole]);

  const hasTeamAccess = useMemo(() => {
    if (user) {
      return hasTeamOperationalAccess(user);
    }
    return hasTeamOperationalAccess(initialRole);
  }, [user, initialRole]);

  const pendingRefundsCount = useMemo(() => {
    return registrations.filter((r) => r.refund_request?.status === "waiting_for_approval").length;
  }, [registrations]);

  // Financial & payment features check: paid registration, merchandise to purchase, or commitment fee
  const hasPaidFeatures = useMemo(() => {
    return (
      hasPaidTicketOrMerchandise(activeEvent) ||
      registrations.some(
        (r) =>
          r.ticket_type === "paid" ||
          r.ticket_type === "commitment_fee" ||
          (typeof r.ticket_price === "number" && r.ticket_price > 0) ||
          Boolean(r.refund_request) ||
          (typeof r.payment_status === "string" && r.payment_status === "paid"),
      )
    );
  }, [activeEvent, registrations]);

  // Merchandise delivery check: show delivery tab whenever event or attendees have merchandise
  const hasMerchandise = useMemo(() => {
    const eventHasMerch = (activeEvent.merchandise?.length ?? 0) > 0;
    const eventHasBundleMerch = (activeEvent.bundles ?? []).some((b) => (b.merchandise_items?.length ?? 0) > 0);
    const regHasMerch = registrations.some((r) =>
      Boolean(r.delivery_request || (r.selected_merchandise && r.selected_merchandise.length > 0)),
    );
    return eventHasMerch || eventHasBundleMerch || regHasMerch;
  }, [activeEvent, registrations]);

  return (
    <Tabs defaultValue={hasTeamAccess ? "registrants" : "highlights"} className="space-y-6">
      <div className="scrollbar-none -mx-1 w-full overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0">
        <TabsList className="inline-flex h-9 w-max items-center justify-start gap-1 rounded-lg bg-muted p-1 text-muted-foreground group-data-horizontal/tabs:h-9">
          {hasTeamAccess && (
            <>
              <TabsTrigger value="registrants" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
                <Users className="size-4" />
                Registrants
              </TabsTrigger>
              <TabsTrigger value="breakout-sessions" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
                <Layers className="size-4" />
                Breakout Session
                {(activeEvent.sessions?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">
                    {activeEvent.sessions?.length}
                  </Badge>
                )}
              </TabsTrigger>
            </>
          )}

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
              {hasMerchandise && (
                <TabsTrigger value="delivery" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
                  <Truck className="size-4" />
                  Merchandise Delivery
                </TabsTrigger>
              )}
              {hasPaidFeatures && (
                <>
                  <TabsTrigger value="refunds" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
                    <RotateCcw className="size-4" />
                    Refunds
                    {pendingRefundsCount > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1 h-4 bg-amber-500/20 px-1.5 text-[10px] text-amber-700 dark:text-amber-300"
                      >
                        {pendingRefundsCount}
                      </Badge>
                    )}
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

      {hasTeamAccess && (
        <>
          <TabsContent value="registrants" className="space-y-4">
            <RegistrantsTab eventId={eventId} registrations={registrations} event={activeEvent} />
          </TabsContent>

          <TabsContent value="breakout-sessions" className="space-y-4">
            <BreakoutSessionsTab eventId={eventId} event={activeEvent} registrations={registrations} />
          </TabsContent>
        </>
      )}

      {isOrganizer && (
        <>
          <TabsContent value="form" className="space-y-4">
            <CustomFormTab event={activeEvent} />
          </TabsContent>

          <TabsContent value="tickets" className="space-y-4">
            <TicketsTab event={activeEvent} />
          </TabsContent>

          <TabsContent value="merch" className="space-y-4">
            <MerchandiseTab event={activeEvent} />
          </TabsContent>

          <TabsContent value="bundles" className="space-y-4">
            <BundlesTab event={activeEvent} />
          </TabsContent>

          {hasMerchandise && (
            <TabsContent value="delivery" className="space-y-4">
              <MerchandiseDeliveryTab event={activeEvent} eventId={eventId} />
            </TabsContent>
          )}

          {hasPaidFeatures && (
            <>
              <TabsContent value="refunds" className="space-y-4">
                <RefundsTab event={activeEvent} eventId={eventId} registrations={registrations} />
              </TabsContent>

              <TabsContent value="vouchers" className="space-y-4">
                <VouchersTab event={activeEvent} registrations={registrations} />
              </TabsContent>

              <TabsContent value="payment" className="space-y-4">
                <PaymentGatewayTab event={activeEvent} />
              </TabsContent>
            </>
          )}
        </>
      )}

      <TabsContent value="highlights" className="space-y-4">
        <HighlightsMediaTab event={activeEvent} />
      </TabsContent>

      {isOrganizer && (
        <TabsContent value="emails" className="space-y-4">
          <EmailTemplatesTab event={activeEvent} />
        </TabsContent>
      )}
    </Tabs>
  );
}
