"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileImage,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchEventMerchandiseDeliveryRequestsAction,
  markMerchandiseDeliveredAction,
  updateEventMerchandiseDeliveryConfigAction,
} from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration, MerchandiseDeliveryStatus } from "@/lib/firestore/types";
import { cn, getInitials } from "@/lib/utils";

import { DeliveryApprovalDialog } from "./delivery-approval-dialog";
import { DeliveryRejectDialog } from "./delivery-reject-dialog";

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
  const [isSavingEnv, setIsSavingEnv] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [approvingReg, setApprovingReg] = useState<FirestoreRegistration | null>(null);
  const [rejectingReg, setRejectingReg] = useState<FirestoreRegistration | null>(null);
  const [markingDeliveredId, setMarkingDeliveredId] = useState<string | null>(null);

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

  const handleUpdateEnvironment = async (newEnv: "production" | "sandbox") => {
    try {
      setIsSavingEnv(true);
      setCurrentEnv(newEnv);
      const res = await updateEventMerchandiseDeliveryConfigAction(eventId, newEnv);
      if (res.success) {
        toast.success(
          `Merchandise delivery environment updated to ${newEnv === "production" ? "Live Production" : "Sandbox / Dev"}.`,
        );
      } else {
        toast.error(res.error ?? "Failed to update environment.");
        setCurrentEnv(initialEnv);
      }
    } catch {
      toast.error("Failed to update environment.");
      setCurrentEnv(initialEnv);
    } finally {
      setIsSavingEnv(false);
    }
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
  const totalFeesCollected = registrations
    .filter((r) => r.delivery_request?.payment_status === "paid")
    .reduce((sum, r) => sum + (r.delivery_request?.fee_amount || 50000), 0);

  // Filtered registrations
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
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
    });
  }, [registrations, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── Environment Configuration Banner ─────────────────────────────────── */}
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
              <ShieldCheck className="size-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">Delivery Fee Payment Environment</span>
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
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {currentEnv === "production"
                  ? "Real payments will be generated and processed via DOKU QRIS Production for Rp 50.000 delivery fee."
                  : "Test mode enabled. Delivery fee requests will generate DOKU Sandbox payment links with mock QRIS testing."}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Select
              value={currentEnv}
              disabled={isSavingEnv}
              onValueChange={(val: "production" | "sandbox") => void handleUpdateEnvironment(val)}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Select Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production" className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span>Live Production</span>
                  </div>
                </SelectItem>
                <SelectItem value="sandbox" className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-500" />
                    <span>Sandbox / Dev</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

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
            <CardTitle className="font-bold text-xl sm:text-2xl">{totalCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5 p-3 shadow-2xs">
          <CardHeader className="p-0 pb-1">
            <CardDescription className="text-blue-700 text-xs dark:text-blue-300">Pending Review</CardDescription>
            <CardTitle className="font-bold text-blue-700 text-xl sm:text-2xl dark:text-blue-300">
              {pendingReviewCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5 p-3 shadow-2xs">
          <CardHeader className="p-0 pb-1">
            <CardDescription className="text-emerald-700 text-xs dark:text-emerald-300">In Transit</CardDescription>
            <CardTitle className="font-bold text-emerald-700 text-xl sm:text-2xl dark:text-emerald-300">
              {approvedCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5 p-3 shadow-2xs">
          <CardHeader className="p-0 pb-1">
            <CardDescription className="text-purple-700 text-xs dark:text-purple-300">Delivered</CardDescription>
            <CardTitle className="font-bold text-purple-700 text-xl sm:text-2xl dark:text-purple-300">
              {deliveredCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5 p-3 shadow-2xs">
          <CardHeader className="p-0 pb-1">
            <CardDescription className="text-destructive text-xs">Rejected</CardDescription>
            <CardTitle className="font-bold text-destructive text-xl sm:text-2xl">{rejectedCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="p-3 shadow-2xs">
          <CardHeader className="p-0 pb-1">
            <CardDescription className="text-xs">Fees Collected</CardDescription>
            <CardTitle className="font-bold text-foreground text-sm sm:text-base">
              Rp {totalFeesCollected.toLocaleString("id-ID")}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* ── Search & Filter Controls ─────────────────────────────────────── */}
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
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={cn("size-3.5", (isRefreshing || isLoading) && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Delivery Requests Data Table ─────────────────────────────────── */}
      <Card className="overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] text-xs">Attendee & Recipient</TableHead>
              <TableHead className="text-xs">Merchandise Items</TableHead>
              <TableHead className="text-xs">Shipping Destination</TableHead>
              <TableHead className="text-xs">Fee (Rp 50k)</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Courier & Tracking</TableHead>
              <TableHead className="text-right text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-xs">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <span>Loading delivery requests...</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filteredRegistrations.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-xs">
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
                          <AvatarFallback className="text-[10px]">{getInitials(reg.member_name || "M")}</AvatarFallback>
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
                      <div className="space-y-1">
                        {(reg.selected_merchandise || []).map((m, idx) => (
                          <div key={m.id || idx} className="flex items-center gap-1.5">
                            <Badge variant="outline" className="font-medium text-[10px]">
                              {m.quantity}x
                            </Badge>
                            <span className="font-medium text-foreground">{m.name}</span>
                            {m.selected_variations && Object.keys(m.selected_variations).length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                ({Object.values(m.selected_variations).join(", ")})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
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
                        <div className="font-mono text-[10px] text-muted-foreground">Tel: {req.recipient_phone}</div>
                        {req.notes && (
                          <div className="line-clamp-1 text-[10px] text-amber-700 italic dark:text-amber-300">
                            Note: {req.notes}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Fee Status Column */}
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <span className="font-medium font-mono text-foreground">
                          Rp {(req.fee_amount || 50000).toLocaleString("id-ID")}
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

                    {/* Status Column */}
                    <TableCell className="align-top">
                      <Badge
                        variant="outline"
                        className={cn("px-2 py-0.5 font-medium text-[11px]", statusMeta.badgeClass)}
                      >
                        <StatusIcon className="mr-1 size-3" />
                        {statusMeta.label}
                      </Badge>
                      {req.status === "rejected" && req.rejection_reason && (
                        <div className="mt-1 line-clamp-2 text-[10px] text-destructive">{req.rejection_reason}</div>
                      )}
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
                    <TableCell className="text-right align-top">
                      <div className="flex flex-col items-end gap-1">
                        {req.status === "pending_review" && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              onClick={() => setApprovingReg(reg)}
                              className="h-7 gap-1 bg-emerald-600 px-2.5 text-[11px] text-white hover:bg-emerald-700"
                            >
                              <Truck className="size-3" />
                              Approve & Ship
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRejectingReg(reg)}
                              className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                            >
                              Reject
                            </Button>
                          </div>
                        )}

                        {req.status === "approved" && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={markingDeliveredId === reg.id}
                              onClick={() => handleMarkDelivered(reg)}
                              className="h-7 gap-1 border-emerald-500/40 text-[11px] text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                            >
                              {markingDeliveredId === reg.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="size-3" />
                              )}
                              Mark Delivered
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setApprovingReg(reg)}
                              className="h-7 px-2 text-[11px] text-muted-foreground"
                            >
                              Edit Tracking
                            </Button>
                          </div>
                        )}

                        {req.status === "delivered" && (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3.5" />
                            <span>Fulfilled</span>
                          </div>
                        )}

                        {req.status === "rejected" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setApprovingReg(reg)}
                            className="h-7 px-2 text-[11px] text-muted-foreground"
                          >
                            Re-approve
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
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
    </div>
  );
}
