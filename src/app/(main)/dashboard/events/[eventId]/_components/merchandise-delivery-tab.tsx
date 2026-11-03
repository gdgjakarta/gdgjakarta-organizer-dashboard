"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileImage,
  Loader2,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { MerchandiseDeliveryStatusDialog } from "@/app/(main)/dashboard/member/my-events/_components/merchandise-delivery-status-dialog";
import { PackageTrackingDialog } from "@/components/delivery/package-tracking-dialog";
import { Shimmer } from "@/components/shimmer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFirestoreDate } from "@/lib/date-utils";
import {
  fetchEventMerchandiseDeliveryRequestsAction,
  markMerchandiseDeliveredAction,
  updateEventMerchandiseDeliveryConfigAction,
} from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration, MerchandiseDeliveryStatus } from "@/lib/firestore/types";
import { cn, getInitials } from "@/lib/utils";

import { DeliveryApprovalDialog } from "./delivery-approval-dialog";
import { DeliveryRejectDialog } from "./delivery-reject-dialog";
import { MerchandiseDeliveryConfigDialog } from "./merchandise-delivery-config-dialog";
import { parseMerchandiseVariations } from "./merchandise-helpers";

const DELIVERY_SKELETON_KEYS = ["del-skel-1", "del-skel-2", "del-skel-3", "del-skel-4", "del-skel-5"];

interface MerchandiseDeliveryTabProps {
  event: FirestoreEvent;
  eventId: string;
}

const STATUS_CONFIG: Record<
  MerchandiseDeliveryStatus,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending_payment: {
    label: "Pending Payment",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: Clock,
  },
  pending_review: {
    label: "Pending Review",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    icon: Clock,
  },
  approved: {
    label: "In Transit",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: Truck,
  },
  delivered: {
    label: "Delivered",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: XCircle,
  },
};

export function MerchandiseDeliveryTab({ event, eventId }: MerchandiseDeliveryTabProps) {
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();

  const initialEnv: "production" | "sandbox" =
    event.merchandise_delivery_payment_environment ??
    event.payment_environment ??
    (event.is_test ? "sandbox" : "production");
  const [currentEnv, setCurrentEnv] = useState<"production" | "sandbox">(initialEnv);
  const [deliveryFee, setDeliveryFee] = useState<number>(
    typeof event.merchandise_delivery_fee === "number" ? event.merchandise_delivery_fee : 50000,
  );
  const [leadTimeWeeks, setLeadTimeWeeks] = useState<number>(
    typeof event.merchandise_delivery_lead_time_weeks === "number" ? event.merchandise_delivery_lead_time_weeks : 3,
  );
  const [shippingTimeWeeks, setShippingTimeWeeks] = useState<number>(
    typeof event.merchandise_delivery_shipping_time_weeks === "number"
      ? event.merchandise_delivery_shipping_time_weeks
      : 1,
  );
  const [deliveryNotes, setDeliveryNotes] = useState<string | null>(event.merchandise_delivery_notes ?? null);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);

  // Sync if server event prop changes
  useEffect(() => {
    if (event.merchandise_delivery_payment_environment) {
      setCurrentEnv(event.merchandise_delivery_payment_environment);
    }
    if (typeof event.merchandise_delivery_fee === "number") {
      setDeliveryFee(event.merchandise_delivery_fee);
    }
    if (typeof event.merchandise_delivery_lead_time_weeks === "number") {
      setLeadTimeWeeks(event.merchandise_delivery_lead_time_weeks);
    }
    if (typeof event.merchandise_delivery_shipping_time_weeks === "number") {
      setShippingTimeWeeks(event.merchandise_delivery_shipping_time_weeks);
    }
    if (event.merchandise_delivery_notes !== undefined) {
      setDeliveryNotes(event.merchandise_delivery_notes ?? null);
    }
  }, [
    event.merchandise_delivery_payment_environment,
    event.merchandise_delivery_fee,
    event.merchandise_delivery_lead_time_weeks,
    event.merchandise_delivery_shipping_time_weeks,
    event.merchandise_delivery_notes,
  ]);

  // Real-time synchronization across tabs in the same window
  useEffect(() => {
    const handleEnvChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId: string; environment: "production" | "sandbox" }>;
      if (customEvent.detail && String(customEvent.detail.eventId) === String(eventId)) {
        setCurrentEnv(customEvent.detail.environment);
      }
    };
    const handleTimelineChange = (e: Event) => {
      const customEvent = e as CustomEvent<{
        eventId: string;
        leadTimeWeeks: number;
        shippingTimeWeeks: number;
        notes: string | null;
      }>;
      if (customEvent.detail && String(customEvent.detail.eventId) === String(eventId)) {
        setLeadTimeWeeks(customEvent.detail.leadTimeWeeks);
        setShippingTimeWeeks(customEvent.detail.shippingTimeWeeks);
        setDeliveryNotes(customEvent.detail.notes);
      }
    };
    window.addEventListener("gdg:merchandise-delivery-env-change", handleEnvChange);
    window.addEventListener("gdg:merchandise-delivery-timeline-change", handleTimelineChange);
    return () => {
      window.removeEventListener("gdg:merchandise-delivery-env-change", handleEnvChange);
      window.removeEventListener("gdg:merchandise-delivery-timeline-change", handleTimelineChange);
    };
  }, [eventId]);

  // Real-time subscription to Firestore document
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function setupSub() {
      try {
        const { subscribeFirestoreEventDoc } = await import("@/lib/firestore/client");
        unsubscribe = subscribeFirestoreEventDoc(String(eventId), (docData) => {
          if (docData.merchandise_delivery_payment_environment) {
            setCurrentEnv(docData.merchandise_delivery_payment_environment);
          }
          if (typeof docData.merchandise_delivery_fee === "number") {
            setDeliveryFee(docData.merchandise_delivery_fee);
          }
          if (typeof docData.merchandise_delivery_lead_time_weeks === "number") {
            setLeadTimeWeeks(docData.merchandise_delivery_lead_time_weeks);
          }
          if (typeof docData.merchandise_delivery_shipping_time_weeks === "number") {
            setShippingTimeWeeks(docData.merchandise_delivery_shipping_time_weeks);
          }
          if (docData.merchandise_delivery_notes !== undefined) {
            setDeliveryNotes(docData.merchandise_delivery_notes ?? null);
          }
        });
      } catch (err) {
        console.warn("[MerchandiseDeliveryTab] Failed to subscribe to Firestore event:", err);
      }
    }
    void setupSub();
    return () => {
      unsubscribe?.();
    };
  }, [eventId]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [approvingReg, setApprovingReg] = useState<FirestoreRegistration | null>(null);
  const [rejectingReg, setRejectingReg] = useState<FirestoreRegistration | null>(null);
  const [viewingDetailReg, setViewingDetailReg] = useState<FirestoreRegistration | null>(null);
  const [markingDeliveredId, setMarkingDeliveredId] = useState<string | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [activeTracking, setActiveTracking] = useState<{
    number: string;
    courier?: string;
    recipient?: string;
    allowManualSearch?: boolean;
  }>({ number: "", allowManualSearch: false });

  const loadRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await fetchEventMerchandiseDeliveryRequestsAction(eventId);
      setRegistrations(list);
    } catch (err) {
      console.error("[MerchandiseDeliveryTab] Failed to fetch delivery requests:", err);
      toast.error("Failed to load delivery requests.");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleRefresh = () => {
    startRefresh(async () => {
      await loadRequests();
      toast.success("Refreshed delivery requests.");
    });
  };

  const handleRegistrationUpdated = (updated: FirestoreRegistration) => {
    setRegistrations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleMarkDelivered = async (reg: FirestoreRegistration) => {
    try {
      setMarkingDeliveredId(reg.id);
      const res = await markMerchandiseDeliveredAction(reg.id, eventId);
      if (res.success) {
        toast.success(`Marked package for ${reg.member_name} as Delivered!`);
        if (reg.delivery_request) {
          handleRegistrationUpdated({
            ...reg,
            delivery_request: {
              ...reg.delivery_request,
              status: "delivered",
              delivered_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          });
        }
      } else {
        toast.error(res.error || "Failed to mark as delivered.");
      }
    } catch {
      toast.error("Failed to mark as delivered.");
    } finally {
      setMarkingDeliveredId(null);
    }
  };

  // Metrics summary
  const totalCount = registrations.length;
  const pendingReviewCount = registrations.filter((r) => r.delivery_request?.status === "pending_review").length;
  const approvedCount = registrations.filter((r) => r.delivery_request?.status === "approved").length;
  const deliveredCount = registrations.filter((r) => r.delivery_request?.status === "delivered").length;
  const rejectedCount = registrations.filter((r) => r.delivery_request?.status === "rejected").length;
  const eventDeliveryFee = deliveryFee;
  const totalDeliveryAmount = registrations.reduce(
    (sum, r) => sum + (r.delivery_request?.fee_amount || eventDeliveryFee),
    0,
  );
  const pendingDeliveryAmount = registrations
    .filter((r) => r.delivery_request?.status === "pending_review")
    .reduce((sum, r) => sum + (r.delivery_request?.fee_amount || eventDeliveryFee), 0);
  const totalFeesCollected = registrations
    .filter((r) => r.delivery_request?.payment_status === "paid")
    .reduce((sum, r) => sum + (r.delivery_request?.fee_amount || eventDeliveryFee), 0);

  // Filtered registrations (sorted by latest requested_at first)
  const filteredRegistrations = useMemo(() => {
    return registrations
      .filter((r) => {
        const req = r.delivery_request;
        if (!req) return false;

        if (statusFilter !== "all" && req.status !== statusFilter) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = r.member_name?.toLowerCase().includes(q) || req.recipient_name?.toLowerCase().includes(q);
          const matchEmail = r.member_email?.toLowerCase().includes(q);
          const matchResi = req.tracking_number?.toLowerCase().includes(q);
          const matchCity = req.city?.toLowerCase().includes(q);
          if (!matchName && !matchEmail && !matchResi && !matchCity) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.delivery_request?.requested_at ? new Date(a.delivery_request.requested_at).getTime() : 0;
        const timeB = b.delivery_request?.requested_at ? new Date(b.delivery_request.requested_at).getTime() : 0;
        return timeB - timeA;
      });
  }, [registrations, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── Environment & Pricing Configuration Banner ─────────────────────── */}
      <Card className="border border-border/70 bg-card/60 p-4 shadow-2xs backdrop-blur-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                currentEnv === "production"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
              )}
            >
              <Truck className="size-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground text-sm">Merchandise Delivery Configuration</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-semibold text-[10px]",
                    currentEnv === "production"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  )}
                >
                  {currentEnv === "production" ? "Live Production" : "Sandbox / Dev"}
                </Badge>
                <Badge variant="secondary" className="font-semibold text-[10px]">
                  Fee: Rp {deliveryFee.toLocaleString("id-ID")}
                </Badge>
                <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
                  QC/Prod: {leadTimeWeeks}w • Courier: {shippingTimeWeeks}w
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {currentEnv === "production"
                  ? `Real payments will be generated and processed via DOKU QRIS Production for Rp ${deliveryFee.toLocaleString("id-ID")} delivery fee.`
                  : `Test mode enabled. Delivery fee requests generate DOKU Sandbox payment links with mock QRIS testing (Rp ${deliveryFee.toLocaleString("id-ID")}).`}{" "}
                Estimated timeline for attendees: ~{leadTimeWeeks} weeks production/QC + ~{shippingTimeWeeks} week(s)
                delivery.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfigDialogOpen(true)}
              className="h-8 gap-1.5 px-3 text-xs font-medium"
            >
              <Settings className="size-3.5" />
              Configure
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 gap-1.5 px-3 text-xs"
            >
              <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Metric Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-3 shadow-2xs">
          <CardHeader className="p-0 pb-1">
            <CardDescription className="text-xs">Total Requests</CardDescription>
            {isLoading ? (
              <Shimmer className="my-1 h-7 w-12" />
            ) : (
              <>
                <CardTitle className="font-bold text-xl sm:text-2xl">{totalCount}</CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Rp {totalDeliveryAmount.toLocaleString("id-ID")} total
                </p>
              </>
            )}
          </CardHeader>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5 p-3 shadow-2xs">
          <CardHeader className="p-0 pb-1">
            <CardDescription className="text-blue-700 text-xs dark:text-blue-300">Pending Review</CardDescription>
            {isLoading ? (
              <Shimmer className="my-1 h-7 w-12" />
            ) : (
              <>
                <CardTitle className="font-bold text-blue-700 text-xl sm:text-2xl dark:text-blue-300">
                  {pendingReviewCount}
                </CardTitle>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-200/80">
                  Rp {pendingDeliveryAmount.toLocaleString("id-ID")} pending
                </p>
              </>
            )}
          </CardHeader>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5 p-3 shadow-2xs">
          <CardHeader className="p-0 pb-1">
            <CardDescription className="text-emerald-700 text-xs dark:text-emerald-300">In Transit</CardDescription>
            {isLoading ? (
              <Shimmer className="my-1 h-7 w-12" />
            ) : (
              <CardTitle className="font-bold text-emerald-700 text-xl sm:text-2xl dark:text-emerald-300">
                {approvedCount}
              </CardTitle>
            )}
          </CardHeader>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5 p-3 shadow-2xs">
          <CardHeader className="p-0 pb-1">
            <CardDescription className="text-purple-700 text-xs dark:text-purple-300">Delivered</CardDescription>
            {isLoading ? (
              <Shimmer className="my-1 h-7 w-12" />
            ) : (
              <CardTitle className="font-bold text-purple-700 text-xl sm:text-2xl dark:text-purple-300">
                {deliveredCount}
              </CardTitle>
            )}
          </CardHeader>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5 p-3 shadow-2xs">
          <CardHeader className="p-0 pb-1">
            <CardDescription className="text-destructive text-xs">Rejected</CardDescription>
            {isLoading ? (
              <Shimmer className="my-1 h-7 w-12" />
            ) : (
              <CardTitle className="font-bold text-destructive text-xl sm:text-2xl">{rejectedCount}</CardTitle>
            )}
          </CardHeader>
        </Card>

        <Card className="p-3 shadow-2xs">
          <CardHeader className="p-0 pb-1">
            <CardDescription className="text-xs">Fees Collected</CardDescription>
            {isLoading ? (
              <Shimmer className="my-1 h-6 w-20" />
            ) : (
              <CardTitle className="font-bold text-foreground text-sm sm:text-base">
                Rp {totalFeesCollected.toLocaleString("id-ID")}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
      </div>

      {/* ── Search, Filter & Delivery Requests Data Table ─────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search recipient, email, resi, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-xs"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[170px] text-xs">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Statuses ({totalCount})
                  </SelectItem>
                  <SelectItem value="pending_review" className="text-xs">
                    Pending Review ({pendingReviewCount})
                  </SelectItem>
                  <SelectItem value="approved" className="text-xs">
                    In Transit ({approvedCount})
                  </SelectItem>
                  <SelectItem value="delivered" className="text-xs">
                    Delivered ({deliveredCount})
                  </SelectItem>
                  <SelectItem value="rejected" className="text-xs">
                    Rejected ({rejectedCount})
                  </SelectItem>
                  <SelectItem value="pending_payment" className="text-xs">
                    Pending Payment
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTracking({ number: "", allowManualSearch: true });
                  setIsTrackingModalOpen(true);
                }}
                className="h-9 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
                title="Track shipment expedition directly"
              >
                <Truck className="size-3.5" />
                Track Shipment
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="h-9 gap-1.5 text-xs"
              >
                <RefreshCw className={cn("size-3.5", (isRefreshing || isLoading) && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] text-xs">Attendee & Recipient</TableHead>
                  <TableHead className="text-xs">Merchandise Items</TableHead>
                  <TableHead className="text-xs">Shipping Destination</TableHead>
                  <TableHead className="text-xs">Fee (Rp 50k)</TableHead>
                  <TableHead className="text-xs">Requested At</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Courier & Tracking</TableHead>
                  <TableHead className="text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  DELIVERY_SKELETON_KEYS.map((key) => (
                    <TableRow key={key}>
                      {/* Attendee & Recipient */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Shimmer className="size-8 rounded-full shrink-0" />
                          <div className="space-y-1.5 min-w-0">
                            <Shimmer className="h-3.5 w-24" />
                            <Shimmer className="h-3 w-32" />
                          </div>
                        </div>
                      </TableCell>
                      {/* Merchandise Items */}
                      <TableCell>
                        <div className="space-y-1.5">
                          <Shimmer className="h-5 w-24 rounded-full" />
                          <Shimmer className="h-3 w-16" />
                        </div>
                      </TableCell>
                      {/* Shipping Destination */}
                      <TableCell>
                        <div className="space-y-1">
                          <Shimmer className="h-3.5 w-28" />
                          <Shimmer className="h-3 w-36" />
                        </div>
                      </TableCell>
                      {/* Fee */}
                      <TableCell>
                        <Shimmer className="h-5 w-16 rounded-md" />
                      </TableCell>
                      {/* Requested At */}
                      <TableCell>
                        <div className="space-y-1">
                          <Shimmer className="h-3.5 w-20" />
                          <Shimmer className="h-3 w-12" />
                        </div>
                      </TableCell>
                      {/* Status */}
                      <TableCell>
                        <Shimmer className="h-6 w-24 rounded-full" />
                      </TableCell>
                      {/* Courier & Tracking */}
                      <TableCell>
                        <div className="space-y-1">
                          <Shimmer className="h-3.5 w-20" />
                          <Shimmer className="h-3 w-28" />
                        </div>
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Shimmer className="size-7 rounded-md" />
                          <Shimmer className="size-7 rounded-md" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                {!isLoading && filteredRegistrations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-xs">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Truck className="size-8 text-muted-foreground/40" />
                        <p className="font-medium text-foreground">No merchandise delivery requests found</p>
                        <p className="text-[11px]">
                          {searchQuery || statusFilter !== "all"
                            ? "No requests match your current filters."
                            : "Attendees who missed on-site check-in will appear here once they submit a delivery request."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading &&
                  filteredRegistrations.map((reg) => {
                    const req = reg.delivery_request;
                    if (!req) return null;

                    const statusMeta = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending_review;
                    const StatusIcon = statusMeta.icon;

                    return (
                      <TableRow key={reg.id} className="text-xs">
                        {/* Attendee & Recipient Column */}
                        <TableCell className="align-top">
                          <div className="flex items-start gap-2.5">
                            <Avatar className="size-8 border border-border/60">
                              <AvatarImage src={reg.member_avatar} alt={reg.member_name} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(reg.member_name || "M")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-0.5">
                              <div className="font-semibold text-foreground">{reg.member_name}</div>
                              <div className="text-[11px] text-muted-foreground">{reg.member_email}</div>
                              {req.recipient_name !== reg.member_name && (
                                <div className="text-[10px] text-muted-foreground">
                                  Receiver: <span className="font-medium text-foreground">{req.recipient_name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Merchandise Items Column */}
                        <TableCell className="align-top">
                          {reg.selected_merchandise && reg.selected_merchandise.length > 0 ? (
                            <div className="flex min-w-[140px] max-w-[260px] flex-col gap-1.5">
                              {reg.selected_merchandise.map((m, mIdx) => {
                                const variations = parseMerchandiseVariations(m, reg.answers);
                                return (
                                  <div
                                    key={m.id || mIdx}
                                    className="flex flex-col gap-1 rounded-md border border-border/50 bg-muted/40 p-1.5"
                                  >
                                    <div className="flex items-center gap-1.5 font-medium text-[11px] text-foreground leading-tight">
                                      <Package className="size-3 shrink-0 text-primary" />
                                      <span className="font-semibold text-primary">{m.quantity}x</span>
                                      <span className="truncate">{m.name}</span>
                                    </div>
                                    {variations.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1 pl-4.5">
                                        {variations.map((v) => (
                                          <Badge
                                            key={v.key + v.value}
                                            variant="outline"
                                            className={cn(
                                              "h-4 px-1 py-0 font-medium text-[9px] leading-none",
                                              v.isSize
                                                ? "border-primary/40 bg-primary/10 font-semibold text-primary"
                                                : "border-muted-foreground/30 bg-muted/60 text-muted-foreground",
                                            )}
                                          >
                                            {v.label ? `${v.label}: ` : ""}
                                            {v.value}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Destination Address Column */}
                        <TableCell className="align-top">
                          <div className="max-w-[200px] space-y-0.5 leading-relaxed">
                            <div className="flex items-center gap-1 font-medium text-foreground">
                              <MapPin className="size-3 shrink-0 text-primary" />
                              <span className="truncate">{req.city}</span>
                              <span className="text-muted-foreground">({req.postal_code})</span>
                            </div>
                            <div className="line-clamp-2 text-[11px] text-muted-foreground">{req.shipping_address}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              Tel: {req.recipient_phone}
                            </div>
                            {req.notes && (
                              <div className="line-clamp-1 text-[10px] text-amber-700 italic dark:text-amber-300">
                                Note: {req.notes}
                              </div>
                            )}
                            {req.maps_url && (
                              <div className="pt-1">
                                <a
                                  href={req.maps_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary hover:bg-primary/20 hover:underline"
                                >
                                  <ExternalLink className="size-2.5" />
                                  Open Maps
                                </a>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Fee Status Column */}
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <span className="font-medium font-mono text-foreground">
                              Rp {(req.fee_amount || eventDeliveryFee).toLocaleString("id-ID")}
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  req.payment_status === "paid"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                                )}
                              >
                                {req.payment_status === "paid" ? "Paid ✓" : "Unpaid"}
                              </Badge>
                              {req.payment_environment && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "px-1 py-0 text-[9px]",
                                    req.payment_environment === "sandbox"
                                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                                  )}
                                >
                                  {req.payment_environment === "sandbox" ? "Sandbox" : "Live"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Requested At Column */}
                        <TableCell className="align-top">
                          <div className="space-y-0.5">
                            <div className="font-medium text-foreground">
                              {formatFirestoreDate(req.requested_at, "dd MMM yyyy", "—")}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatFirestoreDate(req.requested_at, "HH:mm", "")} WIB
                            </div>
                          </div>
                        </TableCell>

                        {/* Status Column */}
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <Badge
                              variant="outline"
                              className={cn("px-2 py-0.5 font-medium text-[11px]", statusMeta.badgeClass)}
                            >
                              <StatusIcon className="mr-1 size-3" />
                              {statusMeta.label}
                            </Badge>
                            {req.status === "rejected" && req.rejection_reason && (
                              <div className="line-clamp-2 text-[10px] text-destructive">{req.rejection_reason}</div>
                            )}
                          </div>
                        </TableCell>

                        {/* Courier & Tracking Column */}
                        <TableCell className="align-top">
                          {req.tracking_number ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="secondary" className="font-semibold text-[10px] uppercase">
                                  {req.courier_type || "Standard"}
                                </Badge>
                                <span className="font-mono font-semibold text-xs">{req.tracking_number}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    navigator.clipboard.writeText(req.tracking_number || "");
                                    toast.success("Tracking ID copied!");
                                  }}
                                  className="size-5 text-muted-foreground hover:text-foreground"
                                  title="Copy Resi"
                                >
                                  <Copy className="size-3" />
                                </Button>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 gap-1 px-1.5 text-[10px] border-primary/30 text-primary hover:bg-primary/5"
                                  onClick={() => {
                                    setActiveTracking({
                                      number: req.tracking_number || "",
                                      courier: req.courier_type,
                                      recipient: req.recipient_name,
                                      allowManualSearch: false,
                                    });
                                    setIsTrackingModalOpen(true);
                                  }}
                                >
                                  <Truck className="size-2.5" />
                                  Lacak
                                </Button>
                                {req.tracking_url && (
                                  <Button asChild variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[10px]">
                                    <a href={req.tracking_url} target="_blank" rel="noopener noreferrer">
                                      Track
                                      <ExternalLink className="size-2.5" />
                                    </a>
                                  </Button>
                                )}
                                {req.delivery_proof_url && (
                                  <Button asChild variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[10px]">
                                    <a href={req.delivery_proof_url} target="_blank" rel="noopener noreferrer">
                                      <FileImage className="size-2.5" />
                                      Proof
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>

                        {/* Actions Column */}
                        <TableCell className="whitespace-nowrap text-right align-top">
                          <div className="flex items-center justify-end gap-1">
                            {req.status === "pending_review" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => setApprovingReg(reg)}
                                  className="h-7 gap-1.5 border-emerald-500/30 bg-emerald-500/10 px-2.5 font-medium text-[11px] text-emerald-700 hover:border-emerald-500/50 hover:bg-emerald-500/20 dark:text-emerald-300"
                                >
                                  <Truck className="size-3" />
                                  Ship
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => setRejectingReg(reg)}
                                  title="Reject delivery request"
                                  className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </>
                            )}

                            {req.status === "approved" && (
                              <Button
                                variant="outline"
                                size="xs"
                                disabled={markingDeliveredId === reg.id}
                                onClick={() => handleMarkDelivered(reg)}
                                className="h-7 gap-1.5 border-emerald-500/30 bg-emerald-500/10 px-2.5 font-medium text-[11px] text-emerald-700 hover:border-emerald-500/50 hover:bg-emerald-500/20 dark:text-emerald-300"
                              >
                                {markingDeliveredId === reg.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="size-3" />
                                )}
                                Deliver
                              </Button>
                            )}

                            {req.status === "delivered" && (
                              <Badge
                                variant="outline"
                                className="h-7 gap-1 border-emerald-500/25 bg-emerald-500/5 px-2 font-medium text-[11px] text-emerald-700 dark:text-emerald-300"
                              >
                                <CheckCircle2 className="size-3" />
                                Fulfilled
                              </Badge>
                            )}

                            {req.status === "rejected" && (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => setApprovingReg(reg)}
                                className="h-7 gap-1.5 px-2.5 text-[11px]"
                              >
                                <RotateCcw className="size-3" />
                                Re-approve
                              </Button>
                            )}

                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="size-7 text-muted-foreground hover:text-foreground"
                                  aria-label="More delivery actions"
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem onClick={() => setViewingDetailReg(reg)}>
                                  <Eye className="size-3.5 text-primary" />
                                  View details & audit logs
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {req.status === "pending_review" && (
                                  <DropdownMenuItem onClick={() => setApprovingReg(reg)}>
                                    <Truck className="size-3.5 text-emerald-600" />
                                    Approve & Ship
                                  </DropdownMenuItem>
                                )}
                                {(req.status === "approved" || req.status === "delivered") && (
                                  <DropdownMenuItem onClick={() => setApprovingReg(reg)}>
                                    <Pencil className="size-3.5" />
                                    Edit tracking & courier
                                  </DropdownMenuItem>
                                )}
                                {req.status === "approved" && (
                                  <DropdownMenuItem
                                    disabled={markingDeliveredId === reg.id}
                                    onClick={() => handleMarkDelivered(reg)}
                                  >
                                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                                    Mark as delivered
                                  </DropdownMenuItem>
                                )}
                                {req.status === "rejected" && (
                                  <DropdownMenuItem onClick={() => setApprovingReg(reg)}>
                                    <RotateCcw className="size-3.5" />
                                    Re-approve & Ship
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    const text = `${req.recipient_name} (${req.recipient_phone})\n${req.shipping_address}, ${req.city} ${req.postal_code}`;
                                    void navigator.clipboard.writeText(text);
                                    toast.success("Shipping address copied!");
                                  }}
                                >
                                  <Copy className="size-3.5" />
                                  Copy shipping address
                                </DropdownMenuItem>
                                {req.maps_url && (
                                  <DropdownMenuItem asChild>
                                    <a href={req.maps_url} target="_blank" rel="noopener noreferrer">
                                      <MapPin className="size-3.5" />
                                      Open in Google Maps
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                {(req.status === "pending_review" || req.status === "approved") && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem variant="destructive" onClick={() => setRejectingReg(reg)}>
                                      <XCircle className="size-3.5" />
                                      Reject request
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Dialog Modals ─────────────────────────────────────────────────── */}
      {approvingReg && (
        <DeliveryApprovalDialog
          isOpen={Boolean(approvingReg)}
          onOpenChange={(open) => !open && setApprovingReg(null)}
          registration={approvingReg}
          eventId={eventId}
          onSuccess={(updated) => {
            handleRegistrationUpdated(updated);
            setApprovingReg(null);
          }}
        />
      )}

      {rejectingReg && (
        <DeliveryRejectDialog
          isOpen={Boolean(rejectingReg)}
          onOpenChange={(open) => !open && setRejectingReg(null)}
          registration={rejectingReg}
          eventId={eventId}
          onSuccess={(updated) => {
            handleRegistrationUpdated(updated);
            setRejectingReg(null);
          }}
        />
      )}

      {viewingDetailReg && (
        <MerchandiseDeliveryStatusDialog
          isOpen={Boolean(viewingDetailReg)}
          onOpenChange={(open) => !open && setViewingDetailReg(null)}
          registration={viewingDetailReg}
          event={event}
        />
      )}

      <PackageTrackingDialog
        open={isTrackingModalOpen}
        onOpenChange={setIsTrackingModalOpen}
        trackingNumber={activeTracking.number}
        courierType={activeTracking.courier}
        recipientName={activeTracking.recipient}
        allowManualSearch={activeTracking.allowManualSearch}
      />

      <MerchandiseDeliveryConfigDialog
        isOpen={isConfigDialogOpen}
        onOpenChange={setIsConfigDialogOpen}
        event={event}
        eventId={eventId}
        currentEnv={currentEnv}
        currentFee={deliveryFee}
        onSuccess={(newEnv, newFee, newLeadTime, newShippingTime, newNotes) => {
          setCurrentEnv(newEnv);
          setDeliveryFee(newFee);
          setLeadTimeWeeks(newLeadTime);
          setShippingTimeWeeks(newShippingTime);
          setDeliveryNotes(newNotes ?? null);
        }}
      />
    </div>
  );
}
