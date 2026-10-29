"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Calendar,
  CreditCard,
  FileSpreadsheet,
  Layers,
  Mail,
  Package,
  PackageCheck,
  Printer,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Ticket,
  TicketPercent,
  Truck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasTeamOperationalAccess, isExecutiveOrganizer } from "@/lib/auth-roles";
import { hasActualAgendaActivities } from "@/lib/events/agenda-unification";
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

import { AgendaTab } from "./agenda-tab";
import { BreakoutSessionsTab } from "./breakout-sessions-tab";
import { BundlesTab } from "./bundles-tab";
import { CustomFormTab } from "./custom-form-tab";
import { EmailTemplatesTab } from "./email-templates-tab";
import { EventPrinterTab } from "./event-printer-tab";
import { HighlightsMediaTab } from "./highlights-media-tab";
import { MerchandiseDeliveryTab } from "./merchandise-delivery-tab";
import { MerchandiseTab } from "./merchandise-tab";
import { OnTheSpotMerchTab } from "./on-the-spot-merch-tab";
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
  const [activeRegistrations, setActiveRegistrations] = useState<FirestoreRegistration[]>(registrations);

  useEffect(() => {
    setActiveEvent(event);
  }, [event]);

  useEffect(() => {
    if (registrations.length > 0) {
      setActiveRegistrations(registrations);
    }
  }, [registrations]);

  useEffect(() => {
    if (!eventId) return;
    let unsubscribe: (() => void) | undefined;
    async function setupRegs() {
      try {
        const { getEventRegistrations, subscribeEventRegistrations } = await import("@/lib/firestore/client");
        const list = await getEventRegistrations(String(eventId));
        if (list && list.length > 0) {
          setActiveRegistrations(list);
        }
        unsubscribe = subscribeEventRegistrations(String(eventId), (liveList) => {
          if (liveList && liveList.length > 0) {
            setActiveRegistrations(liveList);
          }
        });
      } catch (err) {
        console.warn("[EventDetailTabs] Failed to subscribe to registrations:", err);
      }
    }
    void setupRegs();
    return () => unsubscribe?.();
  }, [eventId]);

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
              venue_map_url: docData.venue_map_url ?? prev.venue_map_url,
              tickets: ensureEventTickets(docData.tickets ?? prev.tickets),
              merchandise: docData.merchandise ?? prev.merchandise,
              agenda: hasActualAgendaActivities(docData.agenda) ? docData.agenda : prev.agenda,
              speakers: docData.speakers && docData.speakers.length > 0 ? docData.speakers : prev.speakers,
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
    return activeRegistrations.filter((r) => r.refund_request?.status === "waiting_for_approval").length;
  }, [activeRegistrations]);

  // Financial & payment features check: paid registration, merchandise to purchase, or commitment fee
  const hasPaidFeatures = useMemo(() => {
    return (
      hasPaidTicketOrMerchandise(activeEvent) ||
      activeRegistrations.some(
        (r) =>
          r.ticket_type === "paid" ||
          r.ticket_type === "commitment_fee" ||
          (typeof r.ticket_price === "number" && r.ticket_price > 0) ||
          Boolean(r.refund_request) ||
          (typeof r.payment_status === "string" && r.payment_status === "paid"),
      )
    );
  }, [activeEvent, activeRegistrations]);

  // Merchandise delivery check: show delivery tab whenever event or attendees have merchandise
  const hasMerchandise = useMemo(() => {
    const eventHasMerch = (activeEvent.merchandise?.length ?? 0) > 0;
    const eventHasBundleMerch = (activeEvent.bundles ?? []).some((b) => (b.merchandise_items?.length ?? 0) > 0);
    const regHasMerch = activeRegistrations.some((r) =>
      Boolean(r.delivery_request || (r.selected_merchandise && r.selected_merchandise.length > 0)),
    );
    return eventHasMerch || eventHasBundleMerch || regHasMerch;
  }, [activeEvent, activeRegistrations]);

  const agendaActivitiesCount = useMemo(() => {
    if (activeEvent.presentation_slides && activeEvent.presentation_slides.length > 0) {
      return activeEvent.presentation_slides.length;
    }
    if (!activeEvent.agenda) return 0;
    const days = (activeEvent.agenda as { days?: Array<{ items?: unknown[]; agenda?: unknown[] }> }).days;
    if (Array.isArray(days)) {
      return days.reduce((sum, d) => sum + (d.items?.length ?? d.agenda?.length ?? 0), 0);
    }
    if (Array.isArray(activeEvent.agenda)) {
      return activeEvent.agenda.length;
    }
    return 0;
  }, [activeEvent.agenda, activeEvent.presentation_slides]);

  const defaultTab = hasTeamAccess ? "registrants" : "agenda";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent<string | { tab: string }>;
      const tab = typeof customEvent.detail === "string" ? customEvent.detail : customEvent.detail?.tab;
      if (tab) {
        setActiveTab(tab);
      }
    };
    window.addEventListener("gdg:switch-tab", handleSwitchTab);
    return () => window.removeEventListener("gdg:switch-tab", handleSwitchTab);
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <div className="scrollbar-none -mx-1 w-full overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0">
        <TabsList className="inline-flex h-9 w-max items-center justify-start gap-1 rounded-lg bg-muted p-1 text-muted-foreground group-data-horizontal/tabs:h-9">
          {hasTeamAccess && (
            <TabsTrigger
              id="tab-trigger-registrants"
              data-value="registrants"
              value="registrants"
              className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
            >
              <Users className="size-4" />
              Registrants
            </TabsTrigger>
          )}

          <TabsTrigger
            id="tab-trigger-agenda"
            data-value="agenda"
            value="agenda"
            className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
          >
            <Calendar className="size-4" />
            Agenda
            {agendaActivitiesCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">
                {agendaActivitiesCount}
              </Badge>
            )}
          </TabsTrigger>

          {hasTeamAccess && (
            <TabsTrigger
              id="tab-trigger-breakout-sessions"
              data-value="breakout-sessions"
              value="breakout-sessions"
              className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
            >
              <Layers className="size-4" />
              Breakout Session
              {(activeEvent.sessions?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">
                  {activeEvent.sessions?.length}
                </Badge>
              )}
            </TabsTrigger>
          )}

          {isOrganizer && (
            <>
              <TabsTrigger
                id="tab-trigger-form"
                data-value="form"
                value="form"
                className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
              >
                <FileSpreadsheet className="size-4" />
                Registration Form
              </TabsTrigger>
              <TabsTrigger
                id="tab-trigger-tickets"
                data-value="tickets"
                value="tickets"
                className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
              >
                <Ticket className="size-4" />
                Tickets
              </TabsTrigger>
              <TabsTrigger
                id="tab-trigger-merch"
                data-value="merch"
                value="merch"
                className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
              >
                <Package className="size-4" />
                Merchandise
              </TabsTrigger>
              <TabsTrigger
                id="tab-trigger-bundles"
                data-value="bundles"
                value="bundles"
                className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
              >
                <PackageCheck className="size-4" />
                Bundles
              </TabsTrigger>
              <TabsTrigger
                id="tab-trigger-ots-merch"
                data-value="ots-merch"
                value="ots-merch"
                className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
              >
                <ShoppingBag className="size-4" />
                OTS Merch
              </TabsTrigger>
              {hasMerchandise && (
                <TabsTrigger
                  id="tab-trigger-delivery"
                  data-value="delivery"
                  value="delivery"
                  className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
                >
                  <Truck className="size-4" />
                  Merchandise Delivery
                </TabsTrigger>
              )}
              {hasPaidFeatures && (
                <>
                  <TabsTrigger
                    id="tab-trigger-refunds"
                    data-value="refunds"
                    value="refunds"
                    className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
                  >
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
                  <TabsTrigger
                    id="tab-trigger-vouchers"
                    data-value="vouchers"
                    value="vouchers"
                    className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
                  >
                    <TicketPercent className="size-4" />
                    Vouchers
                  </TabsTrigger>
                  <TabsTrigger
                    id="tab-trigger-payment"
                    data-value="payment"
                    value="payment"
                    className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
                  >
                    <CreditCard className="size-4" />
                    Payment Gateway
                  </TabsTrigger>
                </>
              )}
            </>
          )}

          <TabsTrigger
            id="tab-trigger-highlights"
            data-value="highlights"
            value="highlights"
            className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
          >
            <Sparkles className="size-4" />
            Highlights & Media
          </TabsTrigger>

          {isOrganizer && (
            <>
              <TabsTrigger
                id="tab-trigger-emails"
                data-value="emails"
                value="emails"
                className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
              >
                <Mail className="size-4" />
                Email Templates
              </TabsTrigger>
              <TabsTrigger
                id="tab-trigger-printer"
                data-value="printer"
                value="printer"
                className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
              >
                <Printer className="size-4" />
                Badge Printer
              </TabsTrigger>
            </>
          )}
        </TabsList>
      </div>

      {hasTeamAccess && (
        <>
          <TabsContent value="registrants" className="space-y-4">
            <RegistrantsTab
              eventId={eventId}
              registrations={activeRegistrations}
              event={activeEvent}
              onSwitchTab={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="breakout-sessions" className="space-y-4">
            <BreakoutSessionsTab eventId={eventId} event={activeEvent} registrations={activeRegistrations} />
          </TabsContent>
        </>
      )}

      {isOrganizer && (
        <>
          <TabsContent value="form" className="space-y-4">
            <CustomFormTab event={activeEvent} onSwitchTab={setActiveTab} />
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

          <TabsContent value="ots-merch" className="space-y-4">
            <OnTheSpotMerchTab event={activeEvent} registrations={activeRegistrations} />
          </TabsContent>

          {hasMerchandise && (
            <TabsContent value="delivery" className="space-y-4">
              <MerchandiseDeliveryTab event={activeEvent} eventId={eventId} />
            </TabsContent>
          )}

          {hasPaidFeatures && (
            <>
              <TabsContent value="refunds" className="space-y-4">
                <RefundsTab event={activeEvent} eventId={eventId} registrations={activeRegistrations} />
              </TabsContent>

              <TabsContent value="vouchers" className="space-y-4">
                <VouchersTab event={activeEvent} registrations={activeRegistrations} />
              </TabsContent>

              <TabsContent value="payment" className="space-y-4">
                <PaymentGatewayTab event={activeEvent} />
              </TabsContent>
            </>
          )}
        </>
      )}

      <TabsContent value="agenda" className="space-y-4">
        <AgendaTab event={activeEvent} />
      </TabsContent>

      <TabsContent value="highlights" className="space-y-4">
        <HighlightsMediaTab event={activeEvent} />
      </TabsContent>

      {isOrganizer && (
        <>
          <TabsContent value="emails" className="space-y-4">
            <EmailTemplatesTab event={activeEvent} />
          </TabsContent>

          <TabsContent value="printer" className="space-y-4">
            <EventPrinterTab event={activeEvent} registrations={activeRegistrations} />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
