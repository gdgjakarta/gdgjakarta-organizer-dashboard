"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  AlertCircle,
  Banknote,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  Filter,
  History,
  Loader2,
  Package,
  PackageCheck,
  PackageX,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShoppingBag,
  Tag,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { subscribeEventMerchandiseOrders } from "@/lib/firestore/merchandise-orders";
import type {
  EventBundlePackage,
  EventMerchandiseItem,
  EventMerchandiseOrder,
  FirestoreEvent,
  FirestoreRegistration,
} from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import {
  cancelOnTheSpotOrderAction,
  checkOnTheSpotPaymentStatusAction,
  deleteOnTheSpotOrderAction,
  updateMerchandiseOrderCollectionStatusAction,
} from "@/server/merchandise-order-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { CreateOnTheSpotSaleDialog } from "./create-on-the-spot-sale-dialog";
import { QrCheckInScannerDialog } from "./qr-checkin-scanner-dialog";

interface OnTheSpotMerchTabProps {
  event: FirestoreEvent;
  registrations: FirestoreRegistration[];
  onOpenScanner?: () => void;
}

function getOrderStatusLogMeta(action: string) {
  const norm = action.toLowerCase().trim();
  if (norm.includes("order_created") || norm.includes("created")) {
    return {
      label: "Order Created",
      badgeClass: "border-primary/30 bg-primary/10 text-primary dark:text-primary",
      dotClass: "border-primary/40 bg-primary/10 text-primary",
      icon: ShoppingBag,
    };
  }
  if (norm.includes("uncollected")) {
    return {
      label: "Merchandise Uncollected",
      badgeClass: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
      dotClass: "border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-400",
      icon: PackageX,
    };
  }
  if (norm.includes("merchandise_collected") || norm.includes("collected")) {
    return {
      label: "Merchandise Collected",
      badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      dotClass: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      icon: PackageCheck,
    };
  }
  if (norm.includes("payment_confirmed") || norm.includes("paid")) {
    return {
      label: "Payment Confirmed",
      badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      dotClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      icon: CheckCircle2,
    };
  }
  if (norm.includes("payment_failed") || norm.includes("failed")) {
    return {
      label: "Payment Failed",
      badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      dotClass: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
      icon: AlertCircle,
    };
  }
  if (norm.includes("cancelled") || norm.includes("canceled")) {
    return {
      label: "Order Cancelled",
      badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
      dotClass: "border-destructive/40 bg-destructive/10 text-destructive",
      icon: XCircle,
    };
  }
  return {
    label: action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    badgeClass: "border-muted bg-muted/60 text-muted-foreground",
    dotClass: "border-border bg-muted text-muted-foreground",
    icon: Tag,
  };
}

function getRegistrantStatusMeta(status?: string) {
  const norm = (status || "").toLowerCase().trim();
  if (norm === "approved") {
    return {
      label: "Approved",
      badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      dotClass: "bg-emerald-500",
    };
  }
  if (norm.includes("wait") || norm === "waiting_for_payment") {
    return {
      label: "Waiting for Payment",
      badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      dotClass: "bg-amber-500",
    };
  }
  if (norm === "rejected") {
    return {
      label: "Rejected",
      badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
      dotClass: "bg-destructive",
    };
  }
  return {
    label: norm ? norm.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Registered",
    badgeClass: "border-muted bg-muted/60 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  };
}

export function OnTheSpotMerchTab({ event, registrations, onOpenScanner }: OnTheSpotMerchTabProps) {
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<EventMerchandiseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Real-time subscription to on-the-spot orders for this event
  useEffect(() => {
    if (!event.id) {
      setIsLoading(false);
      return;
    }
    let isMounted = true;
    const fallbackTimer = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 4000);

    const unsubscribe = subscribeEventMerchandiseOrders(
      String(event.id),
      (list) => {
        if (!isMounted) return;
        clearTimeout(fallbackTimer);
        setOrders(list);
        setViewingOrder((prev) => (prev ? list.find((o) => o.id === prev.id) || prev : null));
        setIsLoading(false);
      },
      (err) => {
        if (!isMounted) return;
        clearTimeout(fallbackTimer);
        console.warn("[OnTheSpotMerchTab] Failed to subscribe to merchandise orders:", err);
        setIsLoading(false);
      },
    );

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [event.id]);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAddFromRegistrantsOpen, setIsAddFromRegistrantsOpen] = useState(false);
  const [addRegistrantSearch, setAddRegistrantSearch] = useState("");
  const [registrantStatusFilter, setRegistrantStatusFilter] = useState<string>("all");
  const [attendeeForSale, setAttendeeForSale] = useState<FirestoreRegistration | null>(null);
  const [viewingOrder, setViewingOrder] = useState<EventMerchandiseOrder | null>(null);
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null);
  const [togglingOrderId, setTogglingOrderId] = useState<string | null>(null);
  const [activePaymentOrder, setActivePaymentOrder] = useState<EventMerchandiseOrder | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<EventMerchandiseOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let unitsSold = 0;
    let collectedCount = 0;
    let uncollectedCount = 0;
    let pendingPaymentCount = 0;

    for (const o of orders) {
      if (o.payment_status === "paid") {
        totalRevenue += o.total_amount || 0;
        const itemsQty = o.items.reduce((sum, it) => sum + (it.quantity || 1), 0);
        unitsSold += itemsQty;

        if (o.collection_status === "collected") {
          collectedCount += 1;
        } else {
          uncollectedCount += 1;
        }
      } else if (o.payment_status === "waiting_for_payment") {
        pendingPaymentCount += 1;
      }
    }

    return { totalRevenue, unitsSold, collectedCount, uncollectedCount, pendingPaymentCount };
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCust =
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.email.toLowerCase().includes(q) ||
          o.customer.phone.toLowerCase().includes(q) ||
          Boolean(o.customer.attendee_code?.toLowerCase().includes(q));
        const matchesOrder =
          o.order_number.toLowerCase().includes(q) || (o.payment_invoice_number || "").toLowerCase().includes(q);
        const matchesItems = o.items.some((it) => it.name.toLowerCase().includes(q));
        if (!matchesCust && !matchesOrder && !matchesItems) return false;
      }

      // Payment filter
      if (paymentFilter !== "all" && o.payment_status !== paymentFilter) {
        return false;
      }

      // Collection filter
      if (collectionFilter !== "all" && o.collection_status !== collectionFilter) {
        return false;
      }

      // Customer filter
      if (customerFilter === "attendee" && !o.customer.is_imported_attendee) {
        return false;
      }
      if (customerFilter === "walk_in" && o.customer.is_imported_attendee) {
        return false;
      }

      return true;
    });
  }, [orders, searchQuery, paymentFilter, collectionFilter, customerFilter]);

  // Filtered Registrants for "Add from Registrants" Dialog
  const availableRegistrants = useMemo(() => {
    return registrations.filter((reg) => {
      if (registrantStatusFilter !== "all" && (reg.status || "").toLowerCase().trim() !== registrantStatusFilter) {
        return false;
      }
      if (!addRegistrantSearch.trim()) return true;
      const q = addRegistrantSearch.toLowerCase().trim();
      const name = (reg.member_name || (reg.answers?.name as string) || "").toLowerCase();
      const email = (reg.member_email || (reg.answers?.email as string) || "").toLowerCase();
      const phone = (
        reg.member_phone ||
        (reg.answers?.phone as string) ||
        (reg.answers?.whatsapp as string) ||
        ""
      ).toLowerCase();
      const code = (reg.attendee_code || "").toLowerCase();
      const bevyId = String(reg.bevy_attendee_id || "");
      const ticket = (reg.ticket_name || reg.bundle_name || reg.ticket_tier || "").toLowerCase();

      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        code.includes(q) ||
        bevyId.includes(q) ||
        ticket.includes(q)
      );
    });
  }, [registrations, addRegistrantSearch, registrantStatusFilter]);

  // Check Payment for an order row
  const handleCheckPayment = async (order: EventMerchandiseOrder) => {
    setCheckingOrderId(order.id);
    try {
      const res = await checkOnTheSpotPaymentStatusAction(order.id, order.payment_invoice_number || undefined);
      if (res.success && res.isPaid) {
        toast.success(`Payment confirmed for Order #${order.order_number}!`);
      } else {
        toast.info(res.message || "Payment is still pending.");
      }
    } catch {
      toast.error("Failed to check payment status.");
    } finally {
      setCheckingOrderId(null);
    }
  };

  // Toggle Collection status
  const handleToggleCollection = async (order: EventMerchandiseOrder) => {
    setTogglingOrderId(order.id);
    const nextState = order.collection_status !== "collected";
    try {
      const res = await updateMerchandiseOrderCollectionStatusAction(
        order.id,
        nextState,
        undefined,
        user ? { name: user.name, id: user.id } : undefined,
      );
      if (res.success) {
        toast.success(
          nextState
            ? `Order #${order.order_number} marked as Collected!`
            : `Order #${order.order_number} marked as Uncollected.`,
        );
      } else {
        toast.error(res.error || "Failed to update collection status.");
      }
    } catch {
      toast.error("Failed to update collection status.");
    } finally {
      setTogglingOrderId(null);
    }
  };

  // Cancel order
  const handleCancelOrder = async (order: EventMerchandiseOrder) => {
    if (!confirm(`Are you sure you want to cancel Order #${order.order_number}?`)) return;
    try {
      const res = await cancelOnTheSpotOrderAction(
        order.id,
        undefined,
        user ? { name: user.name, id: user.id } : undefined,
      );
      if (res.success) {
        toast.success(`Order #${order.order_number} cancelled.`);
      } else {
        toast.error(res.error || "Failed to cancel order.");
      }
    } catch {
      toast.error("Failed to cancel order.");
    }
  };

  // Permanently remove customer order from list and restore stock
  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    const targetOrder = orderToDelete;
    const itemsCount = targetOrder.items.reduce((sum, it) => sum + (it.quantity || 1), 0);
    const wasPaid = targetOrder.payment_status === "paid";

    try {
      const res = await deleteOnTheSpotOrderAction(targetOrder.id, String(event.id));
      if (res.success) {
        // Optimistically remove from local state
        setOrders((prev) => prev.filter((o) => o.id !== targetOrder.id));
        if (viewingOrder?.id === targetOrder.id) {
          setViewingOrder(null);
        }
        let successMessage = `Order #${targetOrder.order_number} for ${targetOrder.customer.name} removed.`;
        if (wasPaid) {
          successMessage = `Customer ${targetOrder.customer.name} removed from list. ${itemsCount} item(s) restored to merchandise stock!`;
        } else if (res.cancelledPaymentLink) {
          successMessage = `Order #${targetOrder.order_number} for ${targetOrder.customer.name} removed and active DOKU payment link cancelled.`;
        }
        toast.success(successMessage);
        setOrderToDelete(null);
      } else {
        toast.error(res.error || "Failed to remove customer order.");
      }
    } catch {
      toast.error("An unexpected error occurred while removing the order.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyPaymentUrl = (url?: string | null) => {
    if (!url) return;
    void navigator.clipboard.writeText(url);
    setHasCopied(true);
    toast.success("Payment link copied!");
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-medium">Total OTS Revenue</CardDescription>
            <CardTitle className="text-lg font-bold text-foreground">
              Rp {metrics.totalRevenue.toLocaleString("id-ID")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Banknote className="size-3 text-emerald-600" />
              Paid venue purchases
            </span>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-medium">Units Sold</CardDescription>
            <CardTitle className="text-lg font-bold text-foreground">
              {metrics.unitsSold} <span className="text-xs font-normal text-muted-foreground">units</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Package className="size-3 text-primary" />
              Items handed over
            </span>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-medium">Collected / Handed Over</CardDescription>
            <CardTitle className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.collectedCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({metrics.uncollectedCount} uncollected)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-600" />
              Physical handover status
            </span>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-medium">Pending QRIS</CardDescription>
            <CardTitle className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {metrics.pendingPaymentCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="size-3 text-amber-500" />
              Waiting for customer scan
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 2. Action & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by customer, ticket code, order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Payments
              </SelectItem>
              <SelectItem value="paid" className="text-xs">
                Paid
              </SelectItem>
              <SelectItem value="waiting_for_payment" className="text-xs">
                Pending QRIS
              </SelectItem>
              <SelectItem value="cancelled" className="text-xs">
                Cancelled
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={collectionFilter} onValueChange={setCollectionFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Collection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Collections
              </SelectItem>
              <SelectItem value="collected" className="text-xs">
                Collected
              </SelectItem>
              <SelectItem value="uncollected" className="text-xs">
                Uncollected
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Customers
              </SelectItem>
              <SelectItem value="attendee" className="text-xs">
                Registered Attendees
              </SelectItem>
              <SelectItem value="walk_in" className="text-xs">
                Walk-in Guests
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddRegistrantSearch("");
              setRegistrantStatusFilter("all");
              setIsAddFromRegistrantsOpen(true);
            }}
            className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
          >
            <UserPlus className="size-3.5" />
            Add from Registrants
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAttendeeForSale(null);
              setIsScannerOpen(true);
            }}
            className="h-8 gap-1.5 text-xs"
          >
            <Camera className="size-3.5" />
            Scan Attendee QR
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setAttendeeForSale(null);
              setIsCreateOpen(true);
            }}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-3.5" />
            New OTS Sale
          </Button>
        </div>
      </div>

      {/* 3. Orders Table */}
      <div className="rounded-xl border bg-card shadow-2xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold">Order # & Date</TableHead>
              <TableHead className="text-xs font-semibold">Customer</TableHead>
              <TableHead className="text-xs font-semibold">Items & Variations</TableHead>
              <TableHead className="text-xs font-semibold">Total</TableHead>
              <TableHead className="text-xs font-semibold">Payment Status</TableHead>
              <TableHead className="text-xs font-semibold">Collection</TableHead>
              <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Loading on-the-spot orders...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5 py-4">
                    <ShoppingBag className="size-7 opacity-30" />
                    <p className="font-medium text-foreground">No On-the-Spot Orders Found</p>
                    <p className="text-[11px] text-muted-foreground">
                      {searchQuery || paymentFilter !== "all" || collectionFilter !== "all"
                        ? "Try adjusting your search query or filters."
                        : "Click '+ New OTS Sale' or scan an attendee to process a purchase."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((o) => {
                const isPaid = o.payment_status === "paid";
                const isPending = o.payment_status === "waiting_for_payment";
                const isCollected = o.collection_status === "collected";

                return (
                  <TableRow key={o.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="align-top py-3">
                      <span className="font-mono text-xs font-semibold block text-foreground">{o.order_number}</span>
                      <span className="text-[11px] text-muted-foreground block">
                        {new Date(o.created_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        &bull;{" "}
                        {new Date(o.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </TableCell>

                    <TableCell className="align-top py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-foreground">{o.customer.name}</span>
                          {o.customer.is_imported_attendee ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            >
                              Attendee
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">
                              Walk-in
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground block">{o.customer.email}</span>
                        <span className="text-[10px] text-muted-foreground/80 block">{o.customer.phone}</span>
                      </div>
                    </TableCell>

                    <TableCell className="align-top py-3">
                      <div className="space-y-1">
                        {o.sale_type === "bundle" && (
                          <Badge variant="secondary" className="text-[9px] gap-1 px-1.5 py-0 mb-0.5">
                            <PackageCheck className="size-2.5 text-primary" />
                            {o.bundle_name || "Merchandise Bundle"}
                          </Badge>
                        )}
                        {o.items.map((it, idx) => {
                          const varText = it.selected_variations
                            ? Object.values(it.selected_variations).filter(Boolean).join(", ")
                            : "";
                          return (
                            <div key={`${it.merchandise_id}-${idx}`} className="text-xs">
                              <span className="font-medium text-foreground">
                                {it.quantity}x {it.name}
                              </span>
                              {varText && <span className="text-[11px] text-muted-foreground"> ({varText})</span>}
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>

                    <TableCell className="align-top py-3">
                      <span className="font-semibold text-xs text-foreground block">
                        Rp {o.total_amount.toLocaleString("id-ID")}
                      </span>
                      <span className="text-[10px] text-muted-foreground block uppercase">
                        {o.payment_method === "cash_manual" ? "Cash" : "QRIS"}
                      </span>
                    </TableCell>

                    <TableCell className="align-top py-3">
                      {isPaid ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px]"
                        >
                          Paid
                        </Badge>
                      ) : isPending ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px]"
                        >
                          Pending QRIS
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">
                          {o.payment_status}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="align-top py-3">
                      {isCollected ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] gap-1"
                        >
                          <Check className="size-2.5" />
                          Collected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-border text-muted-foreground text-[10px]">
                          Uncollected
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="align-top py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Check Payment Button */}
                        {isPending && (
                          <Button
                            size="icon-xs"
                            variant="outline"
                            disabled={checkingOrderId === o.id}
                            onClick={() => handleCheckPayment(o)}
                            title="Check Payment Status via DOKU"
                            className="text-amber-600 hover:text-amber-700"
                          >
                            {checkingOrderId === o.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3" />
                            )}
                          </Button>
                        )}

                        {/* QRIS Link Presentation */}
                        {isPending && o.payment_url && (
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => setActivePaymentOrder(o)}
                            title="Show QRIS Checkout"
                          >
                            <QrCode className="size-3.5 text-primary" />
                          </Button>
                        )}

                        {/* Toggle Collected Button */}
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          disabled={togglingOrderId === o.id}
                          onClick={() => handleToggleCollection(o)}
                          title={isCollected ? "Mark as Uncollected" : "Mark as Collected"}
                          className={cn(
                            isCollected
                              ? "text-emerald-600 hover:text-destructive hover:bg-destructive/10"
                              : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10",
                          )}
                        >
                          {togglingOrderId === o.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : isCollected ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                        </Button>

                        {/* View Order Details */}
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => setViewingOrder(o)}
                          title="View Order Details"
                        >
                          <Eye className="size-3.5 text-muted-foreground" />
                        </Button>

                        {/* Remove Customer / Delete Order & Restore Stock */}
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => setOrderToDelete(o)}
                          title="Remove Customer from List & Restore Stock"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 4. Add from Registrants for OTS Sale Dialog */}
      <Dialog open={isAddFromRegistrantsOpen} onOpenChange={setIsAddFromRegistrantsOpen}>
        <DialogContent className="inset-0 m-auto h-fit max-h-[90vh] translate-x-0 translate-y-0 overflow-y-auto sm:max-w-2xl [transform:none]">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Add from Registrants for OTS Sale
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select an existing event registrant to create an on-the-spot merchandise sale with their profile and
              ticket details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  value={addRegistrantSearch}
                  onChange={(e) => setAddRegistrantSearch(e.target.value)}
                  placeholder="Search registrants by name, email, ticket code, or phone..."
                  className="h-9 pl-8 text-xs"
                />
              </div>

              <Select value={registrantStatusFilter} onValueChange={setRegistrantStatusFilter}>
                <SelectTrigger className="h-9 w-full sm:w-36 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Statuses
                  </SelectItem>
                  <SelectItem value="approved" className="text-xs">
                    Approved
                  </SelectItem>
                  <SelectItem value="waiting_for_payment" className="text-xs">
                    Waiting for Payment
                  </SelectItem>
                  <SelectItem value="registered" className="text-xs">
                    Registered
                  </SelectItem>
                  <SelectItem value="rejected" className="text-xs">
                    Rejected
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>
                Showing <strong className="text-foreground">{availableRegistrants.length}</strong> of{" "}
                {registrations.length} registrants
              </span>
            </div>

            <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
              {availableRegistrants.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  No registrants found matching your search.
                </div>
              ) : (
                availableRegistrants.map((reg) => {
                  const statusMeta = getRegistrantStatusMeta(reg.status);
                  const ticketDisplay = reg.ticket_name || reg.bundle_name || reg.ticket_tier || "General Admission";
                  return (
                    <div
                      key={reg.id}
                      className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                          {(reg.member_name || reg.member_email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-xs text-foreground truncate">
                              {reg.member_name || "Unnamed Registrant"}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 gap-1 border px-1.5 py-0 text-[10px] font-medium",
                                statusMeta.badgeClass,
                              )}
                            >
                              <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
                              {statusMeta.label}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5 flex-wrap">
                            <span>{reg.member_email}</span>
                            {reg.attendee_code && (
                              <span className="font-mono text-foreground/80">• Ticket: {reg.attendee_code}</span>
                            )}
                            <span>• {ticketDisplay}</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setAttendeeForSale(reg);
                          setIsAddFromRegistrantsOpen(false);
                          setIsCreateOpen(true);
                        }}
                        className="h-7 shrink-0 gap-1 text-xs px-2.5 font-medium"
                      >
                        <ShoppingBag className="size-3" />
                        Select
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddFromRegistrantsOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Create Sale Dialog */}
      <CreateOnTheSpotSaleDialog
        open={isCreateOpen}
        onOpenChange={(v) => {
          setIsCreateOpen(v);
          if (!v) setAttendeeForSale(null);
        }}
        event={event}
        registrations={registrations}
        initialAttendee={attendeeForSale}
        onOpenAddFromRegistrants={() => {
          setIsCreateOpen(false);
          setAddRegistrantSearch("");
          setRegistrantStatusFilter("all");
          setIsAddFromRegistrantsOpen(true);
        }}
      />

      {/* Scanner Dialog */}
      <QrCheckInScannerDialog
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        eventId={String(event.id)}
        eventTitle={event.title}
        registrations={registrations}
        otsModeOnly={true}
        onSelectForOtsSale={(reg) => {
          setAttendeeForSale(reg);
          setIsScannerOpen(false);
          setIsCreateOpen(true);
        }}
      />

      {/* 5. View QRIS Modal for Pending Order */}
      {activePaymentOrder && activePaymentOrder.payment_url && (
        <Dialog open={Boolean(activePaymentOrder)} onOpenChange={(v) => !v && setActivePaymentOrder(null)}>
          <DialogContent className="inset-0 m-auto h-fit max-h-[92vh] translate-x-0 translate-y-0 sm:max-w-md [transform:none]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                QRIS Checkout: #{activePaymentOrder.order_number}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Scan with any mobile banking or e-wallet app to pay.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center p-4 text-center space-y-3">
              <div className="overflow-hidden rounded-xl border bg-white p-2 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(
                    activePaymentOrder.payment_url,
                  )}`}
                  alt="QRIS Code"
                  className="size-48 object-contain"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Invoice #{activePaymentOrder.payment_invoice_number}</p>
                <p className="text-xl font-bold tracking-tight text-foreground">
                  Rp {activePaymentOrder.total_amount.toLocaleString("id-ID")}
                </p>
              </div>

              <div className="w-full space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={activePaymentOrder.payment_url}
                    className="h-8 font-mono text-xs text-muted-foreground"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyPaymentUrl(activePaymentOrder.payment_url)}
                    className="shrink-0 gap-1.5 text-xs h-8"
                  >
                    {hasCopied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    <span>{hasCopied ? "Copied" : "Copy"}</span>
                  </Button>
                </div>

                <Button
                  onClick={() => handleCheckPayment(activePaymentOrder)}
                  disabled={checkingOrderId === activePaymentOrder.id}
                  className="w-full gap-2 text-xs h-8"
                >
                  {checkingOrderId === activePaymentOrder.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Check Payment Status
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 6. Order Details Dialog */}
      {viewingOrder && (
        <Dialog open={Boolean(viewingOrder)} onOpenChange={(v) => !v && setViewingOrder(null)}>
          <DialogContent className="inset-0 m-auto h-fit max-h-[92vh] translate-x-0 translate-y-0 overflow-y-auto sm:max-w-lg [transform:none]">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-base font-semibold">Order Details</DialogTitle>
                  <DialogDescription className="text-xs">
                    #{viewingOrder.order_number} &bull;{" "}
                    {new Date(viewingOrder.created_at).toLocaleString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </DialogDescription>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs capitalize",
                    viewingOrder.payment_status === "paid" &&
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
                    viewingOrder.payment_status === "waiting_for_payment" &&
                      "border-amber-500/30 bg-amber-500/10 text-amber-700",
                  )}
                >
                  {viewingOrder.payment_status.replace(/_/g, " ")}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Customer */}
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                <span className="font-semibold text-muted-foreground uppercase text-[10px]">Customer Details</span>
                <p className="font-semibold text-sm text-foreground">{viewingOrder.customer.name}</p>
                <p className="text-muted-foreground">
                  {viewingOrder.customer.email} &bull; {viewingOrder.customer.phone}
                </p>
                {viewingOrder.customer.attendee_code && (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Attendee Code: {viewingOrder.customer.attendee_code}
                  </p>
                )}
              </div>

              {/* Items */}
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <span className="font-semibold text-muted-foreground uppercase text-[10px]">Ordered Items</span>
                {viewingOrder.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between border-b border-border/40 pb-1.5 last:border-0 last:pb-0"
                  >
                    <div>
                      <span className="font-medium text-foreground">
                        {it.quantity}x {it.name}
                      </span>
                      {it.selected_variations && (
                        <p className="text-[11px] text-muted-foreground">
                          {Object.entries(it.selected_variations)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold">Rp {(it.price * it.quantity).toLocaleString("id-ID")}</span>
                  </div>
                ))}
                <div className="border-t border-border/60 pt-2 flex items-center justify-between font-bold text-sm">
                  <span>Grand Total</span>
                  <span className="text-primary">Rp {viewingOrder.total_amount.toLocaleString("id-ID")}</span>
                </div>
              </div>

              {/* Collection Status */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <span className="font-semibold text-xs block">Collection Status</span>
                  <span className="text-[11px] text-muted-foreground">
                    {viewingOrder.collection_status === "collected"
                      ? `Collected at ${new Date(
                          viewingOrder.collected_at || viewingOrder.created_at,
                        ).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "Items have not been handed over yet"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleCollection(viewingOrder)}
                  className="h-7 text-xs"
                >
                  {viewingOrder.collection_status === "collected" ? "Mark Uncollected" : "Mark Collected"}
                </Button>
              </div>

              {/* Audit History Timeline */}
              {viewingOrder.status_logs && viewingOrder.status_logs.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <History className="size-3.5 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Audit History</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-normal text-muted-foreground">
                      {viewingOrder.status_logs.length} {viewingOrder.status_logs.length === 1 ? "entry" : "entries"}
                    </Badge>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/15 p-3.5 max-h-56 overflow-y-auto">
                    <div className="relative pl-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/60 space-y-3.5">
                      {viewingOrder.status_logs.map((log) => {
                        const meta = getOrderStatusLogMeta(log.action);
                        const ActionIcon = meta.icon;
                        const dateFormatted = new Date(log.timestamp).toLocaleString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <div key={log.id} className="relative group flex flex-col gap-1.5">
                            {/* Timeline Node Dot */}
                            <div
                              className={cn(
                                "absolute -left-5 top-0.5 flex size-4 items-center justify-center rounded-full border shadow-2xs transition-transform group-hover:scale-110",
                                meta.dotClass,
                              )}
                            >
                              <ActionIcon className="size-2.5" />
                            </div>

                            {/* Action & Timestamp Row */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] h-5 px-2 font-medium tracking-wide", meta.badgeClass)}
                              >
                                {meta.label}
                              </Badge>

                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="size-3 text-muted-foreground/70" />
                                <span>{dateFormatted}</span>
                              </div>
                            </div>

                            {/* Actor info */}
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground pl-0.5">
                              <User className="size-3 text-muted-foreground/60" />
                              <span>
                                by <span className="font-semibold text-foreground">{log.actor_name}</span>
                              </span>
                            </div>

                            {/* Note details */}
                            {log.notes && (
                              <div className="rounded-md bg-background/90 dark:bg-background/40 border border-border/50 px-2.5 py-1.5 text-[11px] text-muted-foreground/90 leading-relaxed shadow-2xs">
                                {log.notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-row items-center justify-between gap-2 border-t pt-3 sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOrderToDelete(viewingOrder)}
                className="h-8 text-xs gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                <span>Remove Customer Order</span>
              </Button>

              <Button variant="outline" size="sm" onClick={() => setViewingOrder(null)} className="h-8 text-xs">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 7. Remove Customer / Order Confirmation Dialog */}
      <AlertDialog
        open={Boolean(orderToDelete)}
        onOpenChange={(open) => !open && !isDeleting && setOrderToDelete(null)}
      >
        <AlertDialogContent className="inset-0 m-auto h-fit translate-x-0 translate-y-0 [transform:none]">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              <AlertDialogTitle>Remove Customer from List?</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs text-muted-foreground pt-1">
                {orderToDelete && (
                  <>
                    <p>
                      You are about to remove customer{" "}
                      <span className="font-semibold text-foreground">{orderToDelete.customer.name}</span> (Order{" "}
                      <span className="font-mono font-semibold text-foreground">#{orderToDelete.order_number}</span>)
                      from the on-the-spot sales list.
                    </p>

                    <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className="font-semibold uppercase text-foreground">{orderToDelete.payment_status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Purchased Items:</span>
                        <span className="font-semibold text-foreground text-right">
                          {orderToDelete.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Amount:</span>
                        <span className="font-semibold text-foreground">
                          Rp {orderToDelete.total_amount.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>

                    {orderToDelete.payment_status === "paid" ? (
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-800 dark:text-emerald-300 text-xs">
                        <span className="font-semibold block">Inventory Stock Auto-Restoration:</span>
                        Removing this paid order will immediately decrease units sold and return the items back to
                        available stock.
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        This pending checkout order will be permanently deleted from the database.
                      </p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteOrder();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold gap-1.5"
            >
              {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              <span>{isDeleting ? "Removing..." : "Remove Customer & Restore Stock"}</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
