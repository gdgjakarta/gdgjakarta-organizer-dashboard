"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  FileText,
  Filter,
  Gift,
  Globe,
  Layers,
  Lock,
  MapPin,
  Package,
  PackageCheck,
  Radio,
  Search,
  Sparkles,
  Ticket,
  Truck,
  UserX,
  X,
} from "lucide-react";

import { CancelRegistrationDialog } from "@/components/cancel-registration-dialog";
import { EditRegistrationModal } from "@/components/edit-registration-modal";
import { EventCardImage } from "@/components/event-card-image";
import { RefundRequestDialog } from "@/components/refund/refund-request-dialog";
import { RefundStatusDialog } from "@/components/refund/refund-status-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveEventAudience } from "@/lib/bevy/audience";
import { formatFirestoreDate } from "@/lib/date-utils";
import { extractEventImageUrl } from "@/lib/events/media-utils";
import {
  getEffectiveRegistrationStatus,
  getRegistrationPaymentDeadline,
  isPaidRegistration,
} from "@/lib/events/payment-deadline";
import { isRegistrationEligibleForRefund } from "@/lib/events/refund-utils";
import { fetchMemberRegistrationsAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration, RegistrationStatus } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { BundleVouchersDialog } from "./bundle-vouchers-dialog";
import { MerchandiseDeliveryRequestDialog } from "./merchandise-delivery-request-dialog";
import { MerchandiseDeliveryStatusDialog } from "./merchandise-delivery-status-dialog";

interface MyEventsListProps {
  allEvents: FirestoreEvent[];
}

const STATUS_VARIANTS: Record<RegistrationStatus, { label: string; badgeClass: string }> = {
  pending: {
    label: "Pending Review",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  waiting_for_payment: {
    label: "Waiting for Payment",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold",
  },
  paid_and_registered: {
    label: "Paid & Registered",
    badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold",
  },
  expired: {
    label: "Payment Expired",
    badgeClass: "border-zinc-500/30 bg-zinc-500/15 text-zinc-700 dark:text-zinc-400",
  },
  failed: {
    label: "Payment Failed",
    badgeClass: "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-400",
  },
  canceled: {
    label: "Canceled",
    badgeClass: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  cancelled: {
    label: "Canceled",
    badgeClass: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  approved: {
    label: "Confirmed / Approved",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  registered: {
    label: "Registered",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    label: "Not Selected",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  waitlisted: {
    label: "Waitlisted",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  paid_waitlisted: {
    label: "Paid Waitlist",
    badgeClass: "border-indigo-500/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold",
  },
  attended: {
    label: "Attended",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
};

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function isEventPast(event?: FirestoreEvent): boolean {
  if (!event) return false;
  if (event.status === "Completed") return true;
  const targetDate = event.end_date || event.start_date;
  if (!targetDate) return false;
  try {
    return new Date(targetDate).getTime() < Date.now();
  } catch {
    return false;
  }
}

export function MyEventsList({ allEvents }: MyEventsListProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>([]);
  const [extraEvents, setExtraEvents] = useState<FirestoreEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingEvents, setIsResolvingEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cancellingRegistration, setCancellingRegistration] = useState<FirestoreRegistration | null>(null);
  const [deliveryModalReg, setDeliveryModalReg] = useState<FirestoreRegistration | null>(null);
  const [deliveryStatusReg, setDeliveryStatusReg] = useState<FirestoreRegistration | null>(null);
  const [bundleVouchersModalReg, setBundleVouchersModalReg] = useState<FirestoreRegistration | null>(null);
  const [refundModalReg, setRefundModalReg] = useState<FirestoreRegistration | null>(null);
  const [refundStatusModalReg, setRefundStatusModalReg] = useState<FirestoreRegistration | null>(null);

  useEffect(() => {
    async function loadRegistrations() {
      if (isAuthLoading) return;
      if (!user) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const list = await fetchMemberRegistrationsAction(user.id, user.email);
        setRegistrations(list);
      } catch (err) {
        console.error("[MyEventsList] Failed to load member registrations:", err);
      } finally {
        setIsLoading(false);
      }
    }

    void loadRegistrations();
  }, [user, isAuthLoading]);

  // Resolve events that exist in registrations but are missing from Bevy allEvents
  useEffect(() => {
    let isCancelled = false;

    async function resolveMissingEvents() {
      if (registrations.length === 0) return;

      const knownIds = new Set([...allEvents.map((e) => String(e.id)), ...extraEvents.map((e) => String(e.id))]);
      const missingIds = Array.from(
        new Set(registrations.map((r) => String(r.event_id)).filter((id) => !knownIds.has(id))),
      );

      if (missingIds.length === 0) return;

      try {
        setIsResolvingEvents(true);
        const { getFirestoreEvents, getFirestoreEventById } = await import("@/lib/firestore/client");

        const foundMap = new Map<string, FirestoreEvent>();

        // 1. Fetch top Firestore events
        const fsEvents = await getFirestoreEvents(100);
        for (const fe of fsEvents) {
          foundMap.set(String(fe.id), fe);
        }

        // 2. Fetch specific missing docs individually if not found in batch
        const stillMissing = missingIds.filter((id) => !foundMap.has(id));
        if (stillMissing.length > 0) {
          const singleFetches = await Promise.all(
            stillMissing.map(async (id) => {
              try {
                return await getFirestoreEventById(id);
              } catch {
                return null;
              }
            }),
          );
          for (const item of singleFetches) {
            if (item) {
              foundMap.set(String(item.id), item);
            }
          }
        }

        if (!isCancelled && foundMap.size > 0) {
          setExtraEvents((prev) => {
            const prevMap = new Map(prev.map((e) => [String(e.id), e]));
            for (const [id, event] of foundMap.entries()) {
              prevMap.set(id, event);
            }
            return Array.from(prevMap.values());
          });
        }
      } catch (err) {
        console.warn("[MyEventsList] Failed to resolve missing events from Firestore:", err);
      } finally {
        if (!isCancelled) {
          setIsResolvingEvents(false);
        }
      }
    }

    void resolveMissingEvents();

    return () => {
      isCancelled = true;
    };
  }, [registrations, allEvents, extraEvents]);

  const eventMap = useMemo(() => {
    const map = new Map<string, FirestoreEvent>();
    for (const ev of allEvents) {
      map.set(String(ev.id), ev);
    }
    for (const ev of extraEvents) {
      const existing = map.get(String(ev.id));
      map.set(String(ev.id), {
        ...existing,
        ...ev,
        picture_url: ev.picture_url || ev.banner_url || existing?.picture_url,
        banner_url: ev.banner_url || ev.picture_url || existing?.banner_url,
      });
    }
    return map;
  }, [allEvents, extraEvents]);

  const handleRegistrationUpdated = (updated: FirestoreRegistration) => {
    setRegistrations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  // Metrics summary
  const totalCount = registrations.length;
  const pendingCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "pending" || s === "waitlisted" || s === "paid_waitlisted";
  }).length;
  const waitingPaymentCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "waiting_for_payment";
  }).length;
  const paidCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "paid_and_registered";
  }).length;
  const approvedCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "approved" || s === "paid_and_registered" || s === "registered";
  }).length;
  const attendedCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "attended" || Boolean(r.is_checked_in);
  }).length;
  const expiredCount = registrations.filter((r) => {
    const s = getEffectiveRegistrationStatus(r, eventMap.get(String(r.event_id)));
    return s === "expired" || s === "failed" || s === "canceled" || s === "cancelled";
  }).length;

  // Filter registrations by search and status
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      const ev = eventMap.get(String(reg.event_id));
      const effectiveStatus = getEffectiveRegistrationStatus(reg, ev);

      if (statusFilter !== "all") {
        if (statusFilter === "approved") {
          if (
            effectiveStatus !== "approved" &&
            effectiveStatus !== "paid_and_registered" &&
            effectiveStatus !== "registered"
          ) {
            return false;
          }
        } else if (statusFilter === "pending") {
          if (
            effectiveStatus !== "pending" &&
            effectiveStatus !== "waitlisted" &&
            effectiveStatus !== "paid_waitlisted"
          ) {
            return false;
          }
        } else if (statusFilter === "waiting_for_payment") {
          if (effectiveStatus !== "waiting_for_payment") {
            return false;
          }
        } else if (statusFilter === "paid_and_registered") {
          if (effectiveStatus !== "paid_and_registered") {
            return false;
          }
        } else if (statusFilter === "attended") {
          if (effectiveStatus !== "attended" && !reg.is_checked_in) {
            return false;
          }
        } else if (statusFilter === "expired") {
          if (
            effectiveStatus !== "expired" &&
            effectiveStatus !== "failed" &&
            effectiveStatus !== "canceled" &&
            effectiveStatus !== "cancelled"
          ) {
            return false;
          }
        } else if (effectiveStatus !== statusFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = reg.event_title.toLowerCase().includes(query);
        const trackMatch = reg.session_title?.toLowerCase().includes(query);
        const invoiceMatch = reg.payment_invoice_number?.toLowerCase().includes(query);
        const ticketMatch =
          reg.ticket_tier?.toLowerCase().includes(query) || reg.ticket_name?.toLowerCase().includes(query);
        if (!titleMatch && !trackMatch && !invoiceMatch && !ticketMatch) {
          return false;
        }
      }
      return true;
    });
  }, [registrations, statusFilter, searchQuery, eventMap]);

  // Segment registrations
  const upcomingRegs = useMemo(() => {
    return filteredRegistrations.filter((reg) => {
      const ev = eventMap.get(String(reg.event_id));
      return !isEventPast(ev) && reg.status !== "attended" && !reg.is_checked_in;
    });
  }, [filteredRegistrations, eventMap]);

  const pastRegs = useMemo(() => {
    return filteredRegistrations.filter((reg) => {
      const ev = eventMap.get(String(reg.event_id));
      return isEventPast(ev) || reg.status === "attended" || Boolean(reg.is_checked_in);
    });
  }, [filteredRegistrations, eventMap]);

  const renderRegistrationGrid = (items: FirestoreRegistration[]) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <Card key={key} className="overflow-hidden border-border/60">
              <div className="relative aspect-video w-full bg-muted/60">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
              <CardHeader className="space-y-2 p-4">
                <div className="h-5 w-24 rounded-md bg-muted/60" />
                <div className="h-6 w-3/4 rounded-md bg-muted/60" />
                <div className="h-4 w-1/2 rounded-md bg-muted/60" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="h-4 w-full rounded-md bg-muted/40" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-border/80 border-dashed p-12 text-center text-muted-foreground">
          <CalendarCheck className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <h3 className="font-semibold text-foreground text-lg">No events found in this category</h3>
          <p className="mt-1 text-sm">
            {searchQuery || statusFilter !== "all"
              ? "No registered events match your active filters."
              : "You haven't registered for any events matching this category yet."}
          </p>
          {searchQuery || statusFilter !== "all" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="mt-4 gap-1.5 text-xs"
            >
              <X className="size-3.5" />
              Clear Filters
            </Button>
          ) : (
            <Button asChild className="mt-4 gap-1.5" size="sm">
              <Link href="/dashboard/member">
                <Sparkles className="size-3.5" />
                Explore Upcoming Events
              </Link>
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((reg, index) => {
          const ev = eventMap.get(String(reg.event_id));
          const effectiveStatus = getEffectiveRegistrationStatus(reg, ev);
          const deadlineInfo = getRegistrationPaymentDeadline(reg, ev);
          const statusMeta = STATUS_VARIANTS[effectiveStatus] || STATUS_VARIANTS[reg.status] || STATUS_VARIANTS.pending;

          const isPending = effectiveStatus === "pending" || effectiveStatus === "waitlisted";
          const isWaitingPayment = effectiveStatus === "waiting_for_payment";
          const isPaidAndRegistered = effectiveStatus === "paid_and_registered";
          const isApproved = effectiveStatus === "approved" || effectiveStatus === "registered";
          const isExpired = effectiveStatus === "expired";
          const isFailed = effectiveStatus === "failed";

          const selectedTrack =
            reg.session_title ||
            (reg.answers?.session_title as string | undefined) ||
            (reg.session_id ? `Track ID: ${reg.session_id}` : null);

          let formattedDate = ev?.start_date
            ? formatFirestoreDate(ev.start_date, "dd MMM yyyy • h:mm a", "")
            : formatFirestoreDate(reg.registered_at, "dd MMM yyyy", "—");
          if (!formattedDate && reg.registered_at) {
            formattedDate = formatFirestoreDate(reg.registered_at, "dd MMM yyyy", "—");
          }

          const imageUrl = extractEventImageUrl(
            ev as unknown as Record<string, unknown>,
            reg as unknown as Record<string, unknown>,
          );
          const isCardLoading = isResolvingEvents && !ev;
          const detailsHref = `/dashboard/member/events/${reg.event_id}?from=${encodeURIComponent(pathname || "/dashboard/member/my-events")}`;

          return (
            <Card
              key={reg.id}
              className={cn(
                "group flex flex-col justify-between overflow-hidden shadow-xs transition-all hover:shadow-md",
                isWaitingPayment && "border-amber-500/50 ring-1 ring-amber-500/20 dark:border-amber-500/40",
                isPaidAndRegistered && "border-emerald-500/30",
                isPending && "border-amber-500/30",
              )}
            >
              <div>
                {/* Event Picture / Banner */}
                <Link href={detailsHref} className="block">
                  <EventCardImage
                    src={imageUrl}
                    alt={reg.event_title}
                    isLoading={isCardLoading}
                    priority={index < 2}
                    loading={index < 2 ? "eager" : "lazy"}
                    className="transition-transform duration-300 group-hover:scale-105"
                  >
                    <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="bg-background/90 text-[10px] backdrop-blur-xs">
                        {(() => {
                          const { isVirtual, isHybrid } = resolveEventAudience(ev?.audience_type, ev?.is_virtual);
                          if (isVirtual) {
                            return (
                              <span className="flex items-center gap-1 text-blue-500">
                                <Radio className="size-3" /> Virtual
                              </span>
                            );
                          }
                          if (isHybrid) {
                            return (
                              <span className="flex items-center gap-1 text-purple-500">
                                <Globe className="size-3" /> Hybrid
                              </span>
                            );
                          }
                          return (
                            <span className="flex items-center gap-1 text-emerald-500">
                              <MapPin className="size-3" /> In-Person
                            </span>
                          );
                        })()}
                      </Badge>
                      {ev && isEventPast(ev) && (
                        <Badge variant="secondary" className="bg-background/90 text-[10px] backdrop-blur-xs">
                          Concluded
                        </Badge>
                      )}
                    </div>
                  </EventCardImage>
                </Link>

                <CardHeader className="space-y-2 p-4 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={cn("px-2 py-0.5 font-medium text-[11px]", statusMeta.badgeClass)}
                    >
                      {statusMeta.label}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {ev && isEventPast(ev) ? "Concluded" : "Upcoming"}
                    </span>
                  </div>

                  <CardTitle className="line-clamp-2 font-semibold text-base leading-snug">
                    <Link href={detailsHref} className="transition-colors hover:text-primary hover:underline">
                      {reg.event_title}
                    </Link>
                  </CardTitle>

                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Clock className="size-3.5 text-muted-foreground" />
                    {formattedDate}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-2.5 px-4 pb-3">
                  {/* Selected Track badge */}
                  {selectedTrack && (
                    <div className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs">
                      <Layers className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate font-medium text-[11px] text-foreground">Track: {selectedTrack}</span>
                    </div>
                  )}

                  {/* Bundling Package badge */}
                  {reg.bundle_name && (
                    <div className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs">
                      <PackageCheck className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate font-semibold text-[11px] text-primary">
                        Package: {reg.bundle_name}
                      </span>
                    </div>
                  )}

                  {/* Ticket Tier / Price Tag */}
                  {(() => {
                    const isPaid = isPaidRegistration(reg);
                    const ticketTier = reg.ticket_tier || reg.ticket_name;
                    const price = reg.payment_amount ?? reg.ticket_price ?? reg.bundle_price;

                    if (!isPaid && !ticketTier && !price) return null;

                    return (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {ticketTier && (
                          <Badge
                            variant="secondary"
                            className="gap-1 border border-primary/20 bg-primary/5 text-[10px] text-primary"
                          >
                            <Ticket className="size-3" />
                            {ticketTier}
                          </Badge>
                        )}
                        {price && price > 0 ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            {formatRupiah(price)}
                          </Badge>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Status Helper Callout */}
                  {isWaitingPayment && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
                      <div className="flex items-center justify-between font-semibold text-amber-800 dark:text-amber-200">
                        <span className="flex items-center gap-1.5 text-xs">
                          <CreditCard className="size-3.5 text-amber-600 dark:text-amber-400" />
                          Payment Required
                        </span>
                        {reg.payment_amount ? (
                          <span className="font-bold text-amber-700 dark:text-amber-300">
                            {formatRupiah(reg.payment_amount)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-amber-700/90 dark:text-amber-300/90">
                        <span>
                          {deadlineInfo.timeStatusText
                            ? `⏰ ${deadlineInfo.timeStatusText}`
                            : "Complete payment to secure your ticket."}
                        </span>
                        {deadlineInfo.formattedDeadline && (
                          <span className="text-[10px] opacity-75">Due {deadlineInfo.formattedDeadline}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {isPaidAndRegistered && (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs">
                      <div className="flex items-center justify-between font-medium text-emerald-800 dark:text-emerald-200">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />✓ Payment
                          Confirmed • Ticket Secured
                        </span>
                        {reg.payment_amount ? (
                          <span className="font-semibold text-[11px] text-emerald-700 dark:text-emerald-300">
                            {formatRupiah(reg.payment_amount)}
                          </span>
                        ) : null}
                      </div>
                      {reg.payment_invoice_number && (
                        <p className="mt-0.5 text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
                          Invoice: #{reg.payment_invoice_number}
                        </p>
                      )}
                    </div>
                  )}

                  {isExpired && (
                    <div className="rounded-md border border-zinc-500/30 bg-zinc-500/10 p-2.5 text-[11px] text-zinc-700 dark:text-zinc-300">
                      ⏰ Payment deadline has expired. This reservation has been released.
                    </div>
                  )}

                  {isFailed && (
                    <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-700 dark:text-rose-300">
                      ⚠️ Payment failed or incomplete.
                    </div>
                  )}

                  {effectiveStatus === "paid_waitlisted" && (
                    <div className="rounded-md border border-indigo-500/30 bg-indigo-500/10 p-2.5 text-xs">
                      <div className="flex items-center justify-between font-semibold text-indigo-800 dark:text-indigo-200">
                        <span className="flex items-center gap-1.5 text-xs">
                          <CheckCircle2 className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                          Payment Received • Priority Waitlist
                        </span>
                        {reg.payment_amount ? (
                          <span className="font-bold text-indigo-700 dark:text-indigo-300">
                            {formatRupiah(reg.payment_amount)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-indigo-700/90 dark:text-indigo-300/90">
                        Session capacity is currently full. You will be prioritized if seats open up, or eligible for a
                        full refund.
                      </p>
                    </div>
                  )}

                  {/* Refund Status Callout Banner */}
                  {(() => {
                    const refundInfo = isRegistrationEligibleForRefund(reg, ev);
                    const refundReq = reg.refund_request;

                    if (!refundInfo.isEligible && !refundReq) return null;

                    if (refundReq) {
                      const isPending = refundReq.status === "waiting_for_approval";
                      const isCompleted = refundReq.status === "refund_completed";
                      const isRejected = refundReq.status === "rejected";

                      return (
                        <div
                          className={cn(
                            "flex items-center justify-between rounded-md border p-2.5 text-xs",
                            isPending && "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
                            isCompleted &&
                              "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                            isRejected && "border-destructive/40 bg-destructive/10 text-destructive",
                          )}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <CreditCard className="size-3.5 shrink-0" />
                            <span className="truncate font-semibold text-[11px]">
                              {isPending && "Refund Request Under Review"}
                              {isCompleted && "Refund Transferred & Completed"}
                              {isRejected && "Refund Request Rejected"}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-current text-[10px] capitalize shrink-0 font-medium",
                              isPending && "bg-amber-500/20",
                              isCompleted && "bg-emerald-500/20",
                              isRejected && "bg-destructive/20",
                            )}
                          >
                            {isPending && "Pending"}
                            {isCompleted && "Completed"}
                            {isRejected && "Action Needed"}
                          </Badge>
                        </div>
                      );
                    }

                    if (refundInfo.canSubmitNew) {
                      return (
                        <div className="flex items-center justify-between rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2 text-xs">
                          <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                            💸 {refundInfo.cutoffInfo.deadlineDescription}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-indigo-500/40 text-[10px] text-indigo-600 dark:text-indigo-400"
                          >
                            Refund Eligible
                          </Badge>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {isPending && (
                    <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                      ✏️ Form responses can be edited while pending review.
                    </div>
                  )}

                  {isApproved && (
                    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
                      ✓ Confirmed attendee. Responses locked.
                    </div>
                  )}

                  {/* Merchandise Delivery Info (No-Show Attendee) */}
                  {(() => {
                    const isPast = isEventPast(ev);
                    const hasPurchasedMerch = Boolean(reg.selected_merchandise && reg.selected_merchandise.length > 0);
                    const isNotCheckedIn = !reg.is_checked_in && reg.status !== "attended";
                    const isEligibleForDelivery = isPast && isNotCheckedIn && hasPurchasedMerch;
                    const deliveryReq = reg.delivery_request;

                    if (isEligibleForDelivery && !deliveryReq) {
                      return (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-semibold text-primary">
                              <Package className="size-3.5" />
                              Uncollected Merchandise
                            </span>
                            <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                              Delivery Available
                            </Badge>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                            Event concluded and check-in was missed. You can request courier delivery for your
                            uncollected merchandise.
                          </p>
                        </div>
                      );
                    }

                    if (deliveryReq) {
                      return (
                        <div className="flex items-center justify-between rounded-md border border-border/80 bg-muted/40 p-2 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Truck className="size-3.5 text-primary" />
                            <span className="font-medium text-foreground">Package Delivery</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] capitalize",
                              deliveryReq.status === "approved" &&
                                "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                              deliveryReq.status === "pending_review" &&
                                "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                              deliveryReq.status === "pending_payment" &&
                                "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                              deliveryReq.status === "delivered" &&
                                "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
                              deliveryReq.status === "rejected" &&
                                "border-destructive/30 bg-destructive/10 text-destructive",
                            )}
                          >
                            {(() => {
                              switch (deliveryReq.status) {
                                case "pending_payment":
                                  return "Pay Fee";
                                case "pending_review":
                                  return "Under Review";
                                case "approved":
                                  return "In Transit";
                                case "delivered":
                                  return "Delivered";
                                case "rejected":
                                  return "Rejected";
                                default:
                                  return deliveryReq.status;
                              }
                            })()}
                          </Badge>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                    {ev?.description_short ||
                      ev?.description ||
                      "Registered GDG Jakarta session. Check details for venue access and agenda."}
                  </p>
                </CardContent>
              </div>

              {/* Action Buttons Row */}
              <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-border/40 border-t bg-muted/20 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Complete Payment Button if awaiting payment */}
                  {isWaitingPayment && reg.payment_url && (
                    <a href={reg.payment_url} target="_blank" rel="noopener noreferrer">
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 bg-amber-600 font-semibold text-white text-xs shadow-xs hover:bg-amber-700"
                      >
                        <CreditCard className="size-3.5" />
                        Pay Now {reg.payment_amount ? `(${formatRupiah(reg.payment_amount)})` : ""}
                      </Button>
                    </a>
                  )}

                  {/* Friend Vouchers Button if registration contains bundle vouchers */}
                  {reg.bundle_vouchers && reg.bundle_vouchers.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-primary/40 bg-primary/5 font-semibold text-primary text-xs hover:bg-primary/10"
                      onClick={() => setBundleVouchersModalReg(reg)}
                    >
                      <Gift className="size-3.5" />
                      Friend Vouchers ({reg.bundle_vouchers.filter((v) => v.status === "available").length} left)
                    </Button>
                  )}

                  {/* Edit Responses Modal or Finalized indicator */}
                  {reg.refund_request?.status === "refund_completed" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      className="h-8 gap-1.5 text-xs text-muted-foreground opacity-60 cursor-not-allowed"
                    >
                      <Lock className="size-3.5" />
                      Refund Finalized
                    </Button>
                  ) : (
                    <EditRegistrationModal
                      registration={reg}
                      event={ev}
                      onSuccess={handleRegistrationUpdated}
                      onCancel={() => {
                        setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
                      }}
                      triggerButton={
                        isPending || isWaitingPayment ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 border-amber-500/40 text-amber-700 text-xs hover:bg-amber-500/10 dark:text-amber-300"
                          >
                            <Edit3 className="size-3.5 text-amber-600 dark:text-amber-400" />
                            Edit Responses
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
                          >
                            <FileText className="size-3.5" />
                            View Responses
                          </Button>
                        )
                      }
                    />
                  )}

                  {/* Refund Request / Status Button */}
                  {(() => {
                    const refundInfo = isRegistrationEligibleForRefund(reg, ev);
                    const refundReq = reg.refund_request;

                    if (!refundInfo.isEligible && !refundReq) return null;

                    if (refundReq) {
                      let label = "Refund Status 💰";
                      if (refundReq.status === "refund_completed") {
                        label = "Refund Receipt 🧾";
                      } else if (refundReq.status === "rejected") {
                        label = "Refund Rejected ⚠️";
                      }

                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-8 gap-1.5 text-xs font-semibold",
                            refundReq.status === "refund_completed" &&
                              "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20",
                            refundReq.status === "waiting_for_approval" &&
                              "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20",
                            refundReq.status === "rejected" &&
                              "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
                          )}
                          onClick={() => setRefundStatusModalReg(reg)}
                        >
                          <CreditCard className="size-3.5" />
                          {label}
                        </Button>
                      );
                    }

                    if (refundInfo.canSubmitNew) {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 border-indigo-500/40 bg-indigo-500/10 font-semibold text-indigo-700 dark:text-indigo-300 text-xs hover:bg-indigo-500/20"
                          onClick={() => setRefundModalReg(reg)}
                        >
                          <CreditCard className="size-3.5" />
                          Request Refund 💸
                        </Button>
                      );
                    }

                    return null;
                  })()}

                  {/* Merchandise Delivery Request / Status Button */}
                  {(() => {
                    const isPast = isEventPast(ev);
                    const hasPurchasedMerch = Boolean(reg.selected_merchandise && reg.selected_merchandise.length > 0);
                    const isNotCheckedIn = !reg.is_checked_in && reg.status !== "attended";
                    const isEligibleForDelivery = isPast && isNotCheckedIn && hasPurchasedMerch;
                    const deliveryReq = reg.delivery_request;

                    if (isEligibleForDelivery && !deliveryReq) {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 border-primary/40 bg-primary/5 text-primary text-xs hover:bg-primary/10"
                          onClick={() => setDeliveryModalReg(reg)}
                        >
                          <Truck className="size-3.5" />
                          Request Delivery 📦
                        </Button>
                      );
                    }

                    if (deliveryReq) {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => setDeliveryStatusReg(reg)}
                        >
                          <Truck className="size-3.5" />
                          Delivery Status 🚚
                        </Button>
                      );
                    }

                    return null;
                  })()}

                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 gap-1 text-muted-foreground text-xs hover:text-foreground"
                  >
                    <Link href={detailsHref}>Details →</Link>
                  </Button>

                  {!isEventPast(ev) &&
                    !isPaidAndRegistered &&
                    reg.status !== "attended" &&
                    reg.refund_request?.status !== "refund_completed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setCancellingRegistration(reg)}
                      >
                        <UserX className="size-3.5" />
                        Cancel RSVP
                      </Button>
                    )}
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">My Events & RSVPs 🎟️</h1>
          <p className="text-muted-foreground text-sm">
            Manage GDG Jakarta events you registered for. Edit your form inputs anytime before applications are approved
            or rejected.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-medium text-xs">
            {totalCount} Total Registered
          </Badge>
        </div>
      </div>

      {/* ── Summary Stats Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={cn(
            "rounded-xl border p-3 text-left shadow-2xs transition-all hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            statusFilter === "all" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border/60 bg-card",
          )}
        >
          <p className="text-[11px] text-muted-foreground">Total Applications</p>
          <p className="font-bold text-foreground text-xl">{totalCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("pending")}
          className={cn(
            "rounded-xl border p-3 text-left shadow-2xs transition-all hover:border-amber-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
            statusFilter === "pending"
              ? "border-amber-500 bg-amber-500/15 ring-1 ring-amber-500/40"
              : "border-amber-500/30 bg-amber-500/5",
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-amber-700 dark:text-amber-300">Pending Review</p>
            <Badge
              variant="outline"
              className="h-4 border-amber-500/40 px-1 font-normal text-[9px] text-amber-600 dark:text-amber-400"
            >
              Editable
            </Badge>
          </div>
          <p className="font-bold text-amber-700 text-xl dark:text-amber-300">{pendingCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("waiting_for_payment")}
          className={cn(
            "rounded-xl border p-3 text-left shadow-2xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600",
            waitingPaymentCount > 0
              ? "border-amber-600/50 bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-950/20"
              : "border-border/60 bg-card hover:bg-muted/30",
            statusFilter === "waiting_for_payment" && "border-amber-600 bg-amber-500/20 ring-1 ring-amber-600/40",
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-amber-800 dark:text-amber-200">Waiting Payment</p>
            {waitingPaymentCount > 0 && (
              <Badge
                variant="outline"
                className="h-4 animate-pulse border-amber-600/50 bg-amber-600/20 px-1 font-semibold text-[9px] text-amber-700 dark:text-amber-300"
              >
                Pay Now
              </Badge>
            )}
          </div>
          <p className="font-bold text-amber-800 text-xl dark:text-amber-200">{waitingPaymentCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("approved")}
          className={cn(
            "rounded-xl border p-3 text-left shadow-2xs transition-all hover:border-emerald-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
            statusFilter === "approved"
              ? "border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/40"
              : "border-emerald-500/30 bg-emerald-500/5",
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Confirmed / Paid</p>
            {paidCount > 0 && (
              <Badge
                variant="outline"
                className="h-4 border-emerald-500/40 px-1 font-normal text-[9px] text-emerald-600 dark:text-emerald-400"
              >
                {paidCount} Paid
              </Badge>
            )}
          </div>
          <p className="font-bold text-emerald-700 text-xl dark:text-emerald-300">{approvedCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("attended")}
          className={cn(
            "rounded-xl border p-3 text-left shadow-2xs transition-all hover:border-purple-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
            statusFilter === "attended"
              ? "border-purple-500 bg-purple-500/15 ring-1 ring-purple-500/40"
              : "border-purple-500/30 bg-purple-500/5",
          )}
        >
          <p className="text-[11px] text-purple-700 dark:text-purple-300">Attended</p>
          <p className="font-bold text-purple-700 text-xl dark:text-purple-300">{attendedCount}</p>
        </button>
      </div>

      {/* ── Search & Filter Controls ──────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by event title, track, or ticket..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[190px] text-xs">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses ({totalCount})</SelectItem>
              <SelectItem value="waiting_for_payment">Waiting for Payment ({waitingPaymentCount})</SelectItem>
              <SelectItem value="pending">Pending Review ({pendingCount})</SelectItem>
              <SelectItem value="approved">Confirmed / Approved ({approvedCount})</SelectItem>
              <SelectItem value="paid_and_registered">Paid & Registered ({paidCount})</SelectItem>
              <SelectItem value="attended">Attended ({attendedCount})</SelectItem>
              {expiredCount > 0 && <SelectItem value="expired">Expired / Cancelled ({expiredCount})</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Tabs (All / Upcoming / Past) ──────────────────────────────── */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-[420px]">
          <TabsTrigger value="all" className="gap-1.5 text-xs sm:text-sm">
            All ({filteredRegistrations.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1.5 text-xs sm:text-sm">
            Upcoming ({upcomingRegs.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5 text-xs sm:text-sm">
            Past & Attended ({pastRegs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {renderRegistrationGrid(filteredRegistrations)}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          {renderRegistrationGrid(upcomingRegs)}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {renderRegistrationGrid(pastRegs)}
        </TabsContent>
      </Tabs>

      {cancellingRegistration && (
        <CancelRegistrationDialog
          open={Boolean(cancellingRegistration)}
          onOpenChange={(open) => !open && setCancellingRegistration(null)}
          registration={cancellingRegistration}
          event={eventMap.get(String(cancellingRegistration.event_id))}
          onSuccess={() => {
            const cancelledId = cancellingRegistration.id;
            setRegistrations((prev) => prev.filter((r) => r.id !== cancelledId));
            setCancellingRegistration(null);
          }}
        />
      )}

      {deliveryModalReg && (
        <MerchandiseDeliveryRequestDialog
          isOpen={Boolean(deliveryModalReg)}
          onOpenChange={(open) => !open && setDeliveryModalReg(null)}
          registration={deliveryModalReg}
          event={eventMap.get(String(deliveryModalReg.event_id))}
          onSuccess={(updated) => {
            handleRegistrationUpdated(updated);
            setDeliveryModalReg(null);
          }}
        />
      )}

      {deliveryStatusReg && (
        <MerchandiseDeliveryStatusDialog
          isOpen={Boolean(deliveryStatusReg)}
          onOpenChange={(open) => !open && setDeliveryStatusReg(null)}
          registration={deliveryStatusReg}
          onOpenPayment={() => {
            const target = deliveryStatusReg;
            setDeliveryStatusReg(null);
            setDeliveryModalReg(target);
          }}
        />
      )}

      {bundleVouchersModalReg && (
        <BundleVouchersDialog
          open={Boolean(bundleVouchersModalReg)}
          onOpenChange={(open) => !open && setBundleVouchersModalReg(null)}
          registration={bundleVouchersModalReg}
          event={eventMap.get(String(bundleVouchersModalReg.event_id))}
        />
      )}

      {refundModalReg && (
        <RefundRequestDialog
          isOpen={Boolean(refundModalReg)}
          onOpenChange={(open) => !open && setRefundModalReg(null)}
          registration={refundModalReg}
          event={eventMap.get(String(refundModalReg.event_id))}
          onSuccess={(updatedRefund) => {
            setRegistrations((prev) =>
              prev.map((r) =>
                r.id === refundModalReg.id
                  ? {
                      ...r,
                      refund_request: updatedRefund,
                    }
                  : r,
              ),
            );
            setRefundModalReg(null);
          }}
        />
      )}

      {refundStatusModalReg && (
        <RefundStatusDialog
          isOpen={Boolean(refundStatusModalReg)}
          onOpenChange={(open) => !open && setRefundStatusModalReg(null)}
          registration={refundStatusModalReg}
          event={eventMap.get(String(refundStatusModalReg.event_id))}
          onEditRequest={() => {
            const target = refundStatusModalReg;
            setRefundStatusModalReg(null);
            setRefundModalReg(target);
          }}
        />
      )}
    </div>
  );
}
