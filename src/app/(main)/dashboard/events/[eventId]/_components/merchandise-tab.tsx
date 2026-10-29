"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  Banknote,
  Clock,
  Coins,
  Copy,
  CreditCard,
  Edit2,
  Eye,
  EyeOff,
  Package,
  PackageOpen,
  Plus,
  Receipt,
  Ruler,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Shimmer } from "@/components/shimmer";
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
import { Label } from "@/components/ui/label";
import { calculateMerchandiseComprehensiveStock, getMerchandiseSalesStatus } from "@/lib/events/merchandise-templates";
import { calculateMerchandiseRevenueMetrics } from "@/lib/events/revenue-utils";
import { updateEventMerchandiseAction } from "@/lib/firestore/actions";
import { subscribeEventMerchandiseOrders } from "@/lib/firestore/merchandise-orders";
import type {
  EventMerchandiseItem,
  EventMerchandiseOrder,
  FirestoreEvent,
  FirestoreRegistration,
} from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { CreateOnTheSpotSaleDialog } from "./create-on-the-spot-sale-dialog";
import { GenerateMerchandisePaymentDialog } from "./generate-merchandise-payment-dialog";
import { MerchandiseItemDialog } from "./merchandise-item-dialog";
import { MerchandiseTemplateDialog } from "./merchandise-template-dialog";

const MERCH_REVENUE_SKELETON_KEYS = ["merch-rev-skel-1", "merch-rev-skel-2", "merch-rev-skel-3"];
const MERCH_ITEM_SKELETON_KEYS = ["merch-item-skel-1", "merch-item-skel-2", "merch-item-skel-3"];

interface MerchandiseTabProps {
  event: FirestoreEvent;
}

function getSalesWindowSummary(salesStatus: ReturnType<typeof getMerchandiseSalesStatus>): string {
  if (salesStatus.state === "upcoming" && salesStatus.formattedStart) {
    return `Sales starts ${salesStatus.formattedStart}`;
  }
  if (salesStatus.state === "ended" && salesStatus.formattedEnd) {
    return `Sales closed ${salesStatus.formattedEnd}`;
  }
  if (salesStatus.formattedEnd) {
    return `Sales until ${salesStatus.formattedEnd}`;
  }
  return "Sales Scheduled";
}

function getMerchandiseStatusBadgeLabel(status?: "active" | "draft" | "hidden" | "out_of_stock"): string {
  if (status === "hidden") return "Hidden";
  if (status === "draft") return "Draft";
  if (status === "out_of_stock") return "Out of Stock";
  return "Active";
}

export function MerchandiseTab({ event }: MerchandiseTabProps) {
  // Start with empty array or existing event.merchandise — NO hardcoded default items!
  const [items, setItems] = useState<EventMerchandiseItem[]>(event.merchandise ?? []);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(
    () => !event.merchandise || event.merchandise.length === 0,
  );
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState<boolean>(true);
  const [maxMerchandisePerPerson, setMaxMerchandisePerPerson] = useState<number | null>(
    event.max_merchandise_per_person ?? null,
  );
  const [editingItem, setEditingItem] = useState<EventMerchandiseItem | null>(null);
  const [paymentItem, setPaymentItem] = useState<EventMerchandiseItem | null>(null);
  const [otsSaleItem, setOtsSaleItem] = useState<EventMerchandiseItem | null>(null);
  const [viewingGuidelineItem, setViewingGuidelineItem] = useState<EventMerchandiseItem | null>(null);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isSaving, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>([]);
  const [merchandiseOrders, setMerchandiseOrders] = useState<EventMerchandiseOrder[]>([]);

  // Real-time live subscription to registrations for merchandise sales and telemetry
  useEffect(() => {
    if (!event.id) return;
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    async function loadAndSubscribeRegistrations() {
      try {
        const { getEventRegistrations, subscribeEventRegistrations } = await import("@/lib/firestore/client");
        const list = await getEventRegistrations(String(event.id));
        if (isMounted) {
          setRegistrations(list);
          setIsLoadingRegistrations(false);
        }

        unsubscribe = subscribeEventRegistrations(String(event.id), (updatedList) => {
          if (isMounted) {
            setRegistrations(updatedList);
            setIsLoadingRegistrations(false);
          }
        });
      } catch (err) {
        console.warn("[MerchandiseTab] Failed to fetch or subscribe to registrations:", err);
      } finally {
        if (isMounted) {
          setIsLoadingRegistrations(false);
        }
      }
    }

    void loadAndSubscribeRegistrations();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [event.id]);

  // Real-time subscription to on-the-spot merchandise orders
  useEffect(() => {
    if (!event.id) return;
    const unsub = subscribeEventMerchandiseOrders(String(event.id), setMerchandiseOrders);
    return () => unsub();
  }, [event.id]);

  // Derived merchandise revenue, discounts, and units telemetry (combines pre-registrations + paid OTS sales)
  const merchRevenueMetrics = useMemo(
    () => calculateMerchandiseRevenueMetrics(registrations, items, merchandiseOrders),
    [registrations, items, merchandiseOrders],
  );

  // Derived merchandise items list with calculated sales, revenue, and redemptions
  const merchandiseItemList = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      price: number;
      isFree: boolean;
      tag?: string;
      stats: {
        unitsSold: number;
        netRevenue: number;
        grossRevenue: number;
        voucherDiscount: number;
        vouchersRedeemed: number;
        ordersCount: number;
      };
    }> = [];

    const seenIds = new Set<string>();

    for (const m of items) {
      seenIds.add(m.id);
      const st = merchRevenueMetrics.byItem.get(m.id);
      list.push({
        id: m.id,
        name: m.name,
        price: m.price || 0,
        isFree: Boolean(m.is_free),
        tag: m.tag,
        stats: {
          unitsSold: st?.unitsSold ?? 0,
          netRevenue: st?.netRevenue ?? 0,
          grossRevenue: st?.grossRevenue ?? 0,
          voucherDiscount: st?.voucherDiscount ?? 0,
          vouchersRedeemed: st?.vouchersRedeemed ?? 0,
          ordersCount: st?.ordersCount ?? 0,
        },
      });
    }

    // Include any extra merchandise from registrations that had sales
    for (const [key, st] of merchRevenueMetrics.byItem.entries()) {
      if (!seenIds.has(key) && st.unitsSold > 0) {
        list.push({
          id: key,
          name: st.name,
          price: st.unitsSold > 0 ? Math.round(st.grossRevenue / st.unitsSold) : 0,
          isFree: st.isFree,
          stats: {
            unitsSold: st.unitsSold,
            netRevenue: st.netRevenue,
            grossRevenue: st.grossRevenue,
            voucherDiscount: st.voucherDiscount,
            vouchersRedeemed: st.vouchersRedeemed,
            ordersCount: st.ordersCount,
          },
        });
      }
    }

    return list;
  }, [items, merchRevenueMetrics.byItem]);

  // Load latest merchandise from Firestore document if available
  useEffect(() => {
    if (!event.id) return;

    async function loadLatestMerchandise() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData?.merchandise && Array.isArray(docData.merchandise)) {
          setItems(docData.merchandise);
        }
        if (docData?.max_merchandise_per_person !== undefined) {
          setMaxMerchandisePerPerson(docData.max_merchandise_per_person);
        }
      } catch (err) {
        console.warn("[MerchandiseTab] Failed to fetch latest event merchandise:", err);
      } finally {
        setIsLoadingItems(false);
      }
    }

    void loadLatestMerchandise();
  }, [event.id]);

  const handleCreateNew = () => {
    setEditingItem(null);
    setIsItemDialogOpen(true);
  };

  const handleEdit = (item: EventMerchandiseItem) => {
    setEditingItem(item);
    setIsItemDialogOpen(true);
  };

  const handleDuplicate = (item: EventMerchandiseItem) => {
    const cloned: EventMerchandiseItem = {
      ...item,
      id: `merch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${item.name} (Copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, cloned]);
    setIsDirty(true);
    toast.success(`Duplicated "${item.name}"`);
  };

  const handleToggleVisibility = (itemId: string) => {
    const target = items.find((i) => String(i.id) === String(itemId));
    if (!target) return;
    const willBeHidden = target.status !== "hidden" && target.status !== "draft";
    const nextStatus = willBeHidden ? "hidden" : "active";
    setItems((prev) =>
      prev.map((i) =>
        String(i.id) === String(itemId) ? { ...i, status: nextStatus, updated_at: new Date().toISOString() } : i,
      ),
    );
    setIsDirty(true);
    toast.success(
      willBeHidden
        ? `Hidden "${target.name}". Remember to save changes.`
        : `Merchandise "${target.name}" is now visible. Remember to save changes.`,
    );
  };

  const handleDelete = (itemId: string, itemName: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setIsDirty(true);
    toast.success(`Removed "${itemName}" from merchandise.`);
  };

  const handleSaveItem = (savedItem: EventMerchandiseItem) => {
    setItems((prev) => {
      const index = prev.findIndex((i) => String(i.id) === String(savedItem.id));
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = savedItem;
        return updated;
      }
      return [...prev, savedItem];
    });
    setIsDirty(true);
  };

  const handleSelectTemplate = (templateItem: EventMerchandiseItem) => {
    setItems((prev) => [...prev, templateItem]);
    setIsDirty(true);
    setIsTemplateDialogOpen(false);
    toast.success(`Added template "${templateItem.name}" to merchandise.`);
  };

  const handleSaveAll = () => {
    if (!event.id) {
      toast.error("Event ID is missing.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateEventMerchandiseAction(String(event.id), items, maxMerchandisePerPerson, event);
        if (res.success) {
          setIsDirty(false);
          window.dispatchEvent(
            new CustomEvent("gdg:merchandise-updated", {
              detail: { eventId: String(event.id), merchandise: items },
            }),
          );
          toast.success("Event merchandise saved successfully!");
        } else {
          toast.error(res.error || "Failed to save merchandise.");
        }
      } catch {
        toast.error("An error occurred while saving merchandise.");
      }
    });
  };

  const handleDiscard = () => {
    setItems(event.merchandise ?? []);
    setMaxMerchandisePerPerson(event.max_merchandise_per_person ?? null);
    setIsDirty(false);
    toast.info("Unsaved merchandise changes discarded.");
  };

  return (
    <div className="space-y-6 pb-24">
      {/* ── KPI REVENUE & DISCOUNT TELEMETRY CARDS ─────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Total Clean Merch Revenue */}
        <Card className="shadow-xs border-border/70">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Coins className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Clean Merch Revenue
            </CardDescription>
            {isLoadingRegistrations ? (
              <Shimmer className="my-1 h-8 w-28" />
            ) : (
              <CardTitle className="font-bold text-2xl text-emerald-600 dark:text-emerald-400">
                Rp {merchRevenueMetrics.totalNetRevenue.toLocaleString("id-ID")}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-4">
            {isLoadingRegistrations ? (
              <Shimmer className="h-3.5 w-32" />
            ) : (
              <p className="text-[11px] text-muted-foreground">After voucher discounts applied</p>
            )}
          </CardContent>
        </Card>

        {/* Actual Gross Merch Revenue */}
        <Card className="shadow-xs border-border/70">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Receipt className="size-3.5 text-blue-600 dark:text-blue-400" />
              Actual Gross Revenue
            </CardDescription>
            {isLoadingRegistrations ? (
              <Shimmer className="my-1 h-8 w-28" />
            ) : (
              <CardTitle className="font-bold text-2xl text-foreground">
                Rp {merchRevenueMetrics.totalGrossRevenue.toLocaleString("id-ID")}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-4">
            {isLoadingRegistrations ? (
              <Shimmer className="h-3.5 w-36" />
            ) : (
              <p className="text-[11px] text-muted-foreground">Catalog price without discounts</p>
            )}
          </CardContent>
        </Card>

        {/* Merch Vouchers Redeemed */}
        <Card className="shadow-xs border-border/70">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Tag className="size-3.5 text-amber-500" />
              Merch Vouchers Redeemed
            </CardDescription>
            {isLoadingRegistrations ? (
              <Shimmer className="my-1 h-8 w-16" />
            ) : (
              <CardTitle className="font-bold text-2xl text-amber-600 dark:text-amber-400">
                {merchRevenueMetrics.totalVouchersRedeemed}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-4">
            {isLoadingRegistrations ? (
              <Shimmer className="h-3.5 w-28" />
            ) : (
              <p className="text-[11px] text-muted-foreground">
                -Rp {merchRevenueMetrics.totalVoucherDiscount.toLocaleString("id-ID")} voucher cut
              </p>
            )}
          </CardContent>
        </Card>

        {/* Total Units Sold */}
        <Card className="shadow-xs border-border/70">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <ShoppingBag className="size-3.5 text-purple-500" />
              Units Sold & Orders
            </CardDescription>
            {isLoadingRegistrations ? (
              <Shimmer className="my-1 h-8 w-16" />
            ) : (
              <CardTitle className="font-bold text-2xl text-purple-600 dark:text-purple-400">
                {merchRevenueMetrics.totalUnitsSold}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-4">
            {isLoadingRegistrations ? (
              <Shimmer className="h-3.5 w-28" />
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Across {merchRevenueMetrics.totalOrdersCount} attendee order
                {merchRevenueMetrics.totalOrdersCount === 1 ? "" : "s"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── REVENUE BY MERCHANDISE ITEM BREAKDOWN ────────────────────────── */}
      <Card className="border-border/60 bg-gradient-to-r from-card to-muted/20 shadow-xs">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Banknote className="size-4" />
              </div>
              <div>
                <CardTitle className="font-semibold text-sm">Revenue Breakdown by Merchandise Item</CardTitle>
                <CardDescription className="text-xs">
                  Clean net revenue, gross receipts, and voucher redemptions categorized by each event merchandise item.
                </CardDescription>
              </div>
            </div>
            {isLoadingRegistrations ? (
              <Shimmer className="h-5 w-36 rounded-md" />
            ) : (
              <Badge variant="outline" className="font-mono text-xs w-fit">
                {merchRevenueMetrics.totalUnitsSold} units fulfilled across {merchandiseItemList.length} item
                {merchandiseItemList.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {isLoadingRegistrations ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {MERCH_REVENUE_SKELETON_KEYS.map((key) => (
                <div key={key} className="rounded-xl border border-border/70 bg-card/60 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Shimmer className="h-5 w-32 rounded-md" />
                    <Shimmer className="h-4 w-14" />
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <Shimmer className="h-3.5 w-20" />
                      <Shimmer className="h-3.5 w-24" />
                    </div>
                    <div className="flex justify-between">
                      <Shimmer className="h-3.5 w-20" />
                      <Shimmer className="h-3.5 w-20" />
                    </div>
                    <div className="flex justify-between">
                      <Shimmer className="h-3.5 w-24" />
                      <Shimmer className="h-3.5 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : merchandiseItemList.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No merchandise configured for this event.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {merchandiseItemList.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/70 bg-card/60 p-3.5 space-y-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-semibold text-xs truncate max-w-[170px]",
                          item.isFree
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                        )}
                      >
                        {item.name}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {item.isFree ? "Free Perk" : `Rp ${item.price.toLocaleString("id-ID")}`}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-foreground font-mono whitespace-nowrap">
                      {item.stats.unitsSold} {item.isFree ? "claimed" : "sold"}
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] text-muted-foreground">Clean Net Revenue</p>
                    <p className="text-lg font-bold text-foreground">
                      Rp {item.stats.netRevenue.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Gross: Rp {item.stats.grossRevenue.toLocaleString("id-ID")}
                    </p>
                  </div>

                  <div className="border-t border-border/50 pt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Tag className="size-3 text-amber-500" />
                        Vouchers:
                      </span>
                      <span className="font-medium text-foreground">
                        {item.stats.vouchersRedeemed} (-Rp {item.stats.voucherDiscount.toLocaleString("id-ID")})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="size-3 text-purple-500" />
                        Orders Count:
                      </span>
                      <span className="font-medium text-foreground">
                        {item.stats.ordersCount} order{item.stats.ordersCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Event Merchandise & Attendee Perks</CardTitle>
              {isDirty && (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs">
                  Unsaved Changes
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              Configure marketplace perks, apparel, and merchandise available to registered attendees. Add items from
              pre-built GDG templates or create custom items with variations.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            <Button size="sm" variant="outline" onClick={() => setIsTemplateDialogOpen(true)} className="gap-1.5">
              <Sparkles className="size-3.5 text-amber-500" />
              Browse Templates
            </Button>

            <Button size="sm" variant="outline" onClick={handleCreateNew} className="gap-1.5">
              <Plus className="size-3.5" />
              Custom Item
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Purchase Limits Box */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="max-merch-person" className="font-semibold text-xs">
                  Global Limit: Max Merchandise Items per Attendee
                </Label>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {maxMerchandisePerPerson ? `${maxMerchandisePerPerson} Items / Person` : "Unlimited"}
                </Badge>
              </div>
              <Input
                id="max-merch-person"
                type="number"
                min={1}
                max={20}
                placeholder="e.g. 2 (Leave blank for no limit)"
                value={maxMerchandisePerPerson ?? ""}
                onChange={(e) => {
                  setMaxMerchandisePerPerson(e.target.value ? Number(e.target.value) : null);
                  setIsDirty(true);
                }}
                className="h-8 bg-background text-xs"
              />
              <p className="text-[11px] text-muted-foreground leading-normal">
                Restricts the maximum total merchandise items that a single attendee can add during registration.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-semibold text-xs">Configured Swag & Merchandise</span>
              <div className="flex h-8 items-center gap-2 rounded-md border border-border/70 bg-background px-3 font-medium text-foreground text-xs">
                <Package className="size-3.5 text-primary" />
                <span className="truncate">
                  {items.length} item{items.length === 1 ? "" : "s"} &bull;{" "}
                  {items.filter((i) => i.status !== "hidden" && i.status !== "draft").length} Visible,{" "}
                  {items.filter((i) => i.status === "hidden" || i.status === "draft").length} Hidden
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal">
                Active items appear on the registration checkout modal as add-ons.
              </p>
            </div>
          </div>

          {isLoadingItems && items.length === 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {MERCH_ITEM_SKELETON_KEYS.map((key) => (
                <div
                  key={key}
                  className="flex flex-col justify-between overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
                >
                  <Shimmer className="aspect-video w-full rounded-none" />
                  <div className="space-y-3 p-4">
                    <div className="space-y-1.5">
                      <Shimmer className="h-5 w-32" />
                      <Shimmer className="h-3.5 w-full" />
                      <Shimmer className="h-3.5 w-3/4" />
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-2">
                      <div className="flex justify-between">
                        <Shimmer className="h-3 w-16" />
                        <Shimmer className="h-3 w-12" />
                      </div>
                      <Shimmer className="h-2 w-full rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/40 p-3">
                    <Shimmer className="h-6 w-20" />
                    <Shimmer className="h-8 w-16 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            /* Empty State: No items pre-selected or forced */
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/80 border-dashed bg-muted/20 px-6 py-14 text-center">
              <div className="rounded-full bg-primary/10 p-4 text-primary">
                <PackageOpen className="size-8" />
              </div>
              <h3 className="mt-4 font-semibold text-base text-foreground">No Merchandise Configured Yet</h3>
              <p className="mt-1.5 max-w-md text-muted-foreground text-xs leading-relaxed">
                Provide attendee giveaways, conference swag (stickers, lanyards, shirts), or paid merchandise. Select
                from pre-made GDG templates or add your own custom items.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button size="sm" onClick={() => setIsTemplateDialogOpen(true)} className="gap-1.5">
                  <Sparkles className="size-3.5 text-amber-300" />
                  Add from Templates
                </Button>
                <Button size="sm" variant="outline" onClick={handleCreateNew} className="gap-1.5">
                  <Plus className="size-3.5" />
                  Create from Scratch
                </Button>
              </div>
            </div>
          ) : (
            /* Marketplace Grid of Items */
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const salesStatus = getMerchandiseSalesStatus(item);
                const itemStats = merchRevenueMetrics.byItem.get(item.id);
                const stockMetrics = calculateMerchandiseComprehensiveStock(item, itemStats?.unitsSold);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex flex-col justify-between overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs transition-all hover:border-primary/50 hover:shadow-md",
                      (item.status === "draft" || item.status === "hidden") && "border-dashed opacity-60 bg-muted/20",
                    )}
                  >
                    {/* Image & Price Header */}
                    <div className="relative aspect-video w-full overflow-hidden bg-muted">
                      {item.image_url ? (
                        // biome-ignore lint/a11y/useAltText: item thumbnail
                        // biome-ignore lint/performance/noImgElement: item thumbnail
                        <img
                          src={item.image_url}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-muted/60 text-muted-foreground">
                          <Package className="size-10 opacity-30" />
                        </div>
                      )}

                      {/* Overlay status & price pills */}
                      <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-semibold text-xs shadow-xs backdrop-blur-md",
                            item.is_free
                              ? "border-emerald-500/20 bg-emerald-500/90 text-white"
                              : "border-blue-500/20 bg-blue-600/90 text-white",
                          )}
                        >
                          {item.is_free ? "Free Perk" : `IDR ${(item.price || 0).toLocaleString("id-ID")}`}
                        </Badge>
                        <Badge variant="outline" className="bg-background/90 text-[10px] backdrop-blur-md">
                          {item.tag || "Perk"}
                        </Badge>
                        {item.is_ots_only && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] backdrop-blur-md font-semibold"
                          >
                            OTS Only
                          </Badge>
                        )}
                      </div>

                      {/* Photos count pill if multiple */}
                      {item.images && item.images.length > 1 && (
                        <div className="absolute bottom-2.5 right-2.5">
                          <Badge
                            variant="secondary"
                            className="bg-background/90 text-foreground text-[10px] backdrop-blur-md shadow-xs"
                          >
                            📷 {item.images.length} photos
                          </Badge>
                        </div>
                      )}

                      {item.status && item.status !== "active" ? (
                        <div className="absolute top-2.5 right-2.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "bg-background/95 font-medium text-[10px] backdrop-blur-md",
                              item.status === "draft" && "border-amber-500/30 text-amber-600",
                              item.status === "hidden" && "border-muted-foreground/30 bg-muted text-muted-foreground",
                              item.status === "out_of_stock" && "border-destructive/30 text-destructive",
                            )}
                          >
                            {getMerchandiseStatusBadgeLabel(item.status)}
                          </Badge>
                        </div>
                      ) : salesStatus.state === "upcoming" || salesStatus.state === "ended" ? (
                        <div className="absolute top-2.5 right-2.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "bg-background/95 font-medium text-[10px] backdrop-blur-md",
                              salesStatus.badgeColor,
                            )}
                          >
                            {salesStatus.badgeLabel}
                          </Badge>
                        </div>
                      ) : stockMetrics.isSoldOut ? (
                        <div className="absolute top-2.5 right-2.5">
                          <Badge
                            variant="outline"
                            className="bg-destructive/95 text-white font-bold text-[10px] backdrop-blur-md border-none shadow-xs"
                          >
                            Sold Out
                          </Badge>
                        </div>
                      ) : stockMetrics.totalRemaining !== null ? (
                        <div className="absolute top-2.5 right-2.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-medium text-[10px] backdrop-blur-md shadow-xs",
                              stockMetrics.totalRemaining <= 10
                                ? "bg-amber-600/90 text-white border-none font-semibold"
                                : "bg-background/90 text-foreground border-border/70",
                            )}
                          >
                            {stockMetrics.totalRemaining <= 10
                              ? `Only ${stockMetrics.totalRemaining} left!`
                              : `${stockMetrics.totalRemaining} remaining`}
                          </Badge>
                        </div>
                      ) : null}
                    </div>

                    {/* Body Content */}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-foreground text-sm leading-snug transition-colors group-hover:text-primary">
                          {item.name}
                        </h4>
                      </div>

                      <p className="mt-1.5 line-clamp-2 flex-1 text-muted-foreground text-xs leading-relaxed">
                        {item.description || "No description provided."}
                      </p>

                      {/* Product Guideline Pill if available */}
                      {item.guideline && (item.guideline.title || item.guideline.text || item.guideline.image_url) && (
                        <div className="mt-2.5">
                          <button
                            type="button"
                            onClick={() => setViewingGuidelineItem(item)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Ruler className="size-3" />
                            <span>{item.guideline.title || "Size & Product Guideline"}</span>
                          </button>
                        </div>
                      )}

                      {/* Variations Preview & Option Quotas */}
                      {stockMetrics.variations.length > 0 && (
                        <div className="mt-3.5 space-y-2 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1 font-medium text-muted-foreground">
                              <Tag className="size-3" />
                              <span>Variations & Quotas:</span>
                            </div>
                            {stockMetrics.hasVariationQuotas && stockMetrics.totalCapacity !== null && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                Total: {stockMetrics.totalSold}/{stockMetrics.totalCapacity} sold
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {stockMetrics.variations.map((v) => (
                              <div key={v.variationName} className="space-y-1">
                                {stockMetrics.variations.length > 1 && (
                                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    {v.variationName}:
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-1">
                                  {v.options.map((opt) => (
                                    <Badge
                                      key={opt.option}
                                      variant="outline"
                                      className={cn(
                                        "border-border/70 bg-background font-normal text-[10px] text-foreground flex items-center gap-1.5 py-0.5",
                                        opt.isSoldOut &&
                                          "border-destructive/40 bg-destructive/10 text-destructive font-semibold",
                                      )}
                                    >
                                      <span className="font-medium">{opt.option}</span>
                                      {opt.quota !== null ? (
                                        opt.isSoldOut ? (
                                          <span className="font-bold uppercase text-[9px] text-destructive">
                                            Sold Out
                                          </span>
                                        ) : (
                                          <span className="font-mono text-[9px] text-muted-foreground">
                                            <span
                                              className={cn(
                                                opt.remaining !== null && opt.remaining <= 5
                                                  ? "text-amber-600 dark:text-amber-400 font-semibold"
                                                  : "text-emerald-600 dark:text-emerald-400 font-medium",
                                              )}
                                            >
                                              {opt.remaining} left
                                            </span>
                                            <span className="opacity-60">/{opt.quota}</span>
                                          </span>
                                        )
                                      ) : null}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sales Window Scheduled Info */}
                      {(item.sales_start_date || item.sales_end_date) && (
                        <div
                          className={cn(
                            "mt-3 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px]",
                            salesStatus.state === "available" &&
                              "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                            salesStatus.state === "upcoming" && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                            salesStatus.state === "ended" && "bg-muted/80 text-muted-foreground",
                          )}
                        >
                          <Clock className="size-3.5 shrink-0" />
                          <span className="truncate">{getSalesWindowSummary(salesStatus)}</span>
                        </div>
                      )}

                      {/* Merchandise Revenue & Redemptions Telemetry */}
                      <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                            <Coins className="size-3 text-emerald-600 dark:text-emerald-400" />
                            Clean Net Revenue
                          </span>
                          <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            Rp {(itemStats?.netRevenue ?? 0).toLocaleString("id-ID")}
                          </span>
                        </div>
                        {!item.is_free && (
                          <>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>Actual Gross (No discount):</span>
                              <span className="font-mono text-foreground font-medium">
                                Rp {(itemStats?.grossRevenue ?? 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-t border-border/40 pt-1 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Tag className="size-2.5 text-amber-500" />
                                Vouchers:
                              </span>
                              <span className="font-medium text-foreground">
                                {itemStats?.vouchersRedeemed ?? 0} redeemed{" "}
                                {itemStats && itemStats.voucherDiscount > 0
                                  ? `(-Rp ${itemStats.voucherDiscount.toLocaleString("id-ID")})`
                                  : ""}
                              </span>
                            </div>
                          </>
                        )}
                        <div className="flex items-center justify-between border-t border-border/40 pt-1 text-[10px] text-muted-foreground">
                          <span>Units Sold / Claimed:</span>
                          <span className="font-semibold text-foreground">
                            {stockMetrics.totalSold} units
                            {stockMetrics.totalCapacity !== null
                              ? ` / ${stockMetrics.totalCapacity} (${Math.min(
                                  100,
                                  Math.round((stockMetrics.totalSold / stockMetrics.totalCapacity) * 100),
                                )}%)`
                              : " (Unlimited)"}
                          </span>
                        </div>
                        {stockMetrics.totalCapacity !== null && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Remaining in Stock:</span>
                            <span
                              className={cn(
                                "font-mono font-semibold",
                                stockMetrics.isSoldOut
                                  ? "text-destructive"
                                  : stockMetrics.totalRemaining !== null && stockMetrics.totalRemaining <= 10
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-emerald-600 dark:text-emerald-400",
                              )}
                            >
                              {stockMetrics.isSoldOut
                                ? "0 units (Sold Out)"
                                : `${stockMetrics.totalRemaining} units left`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Footer stock & quick actions */}
                      <div className="mt-4 flex items-center justify-between border-border/60 border-t pt-3">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span>
                            {stockMetrics.totalCapacity !== null
                              ? `Quota: ${stockMetrics.totalCapacity} units`
                              : "Unlimited Quota"}
                          </span>
                          {stockMetrics.totalCapacity !== null && (
                            <>
                              <span>&bull;</span>
                              <span
                                className={cn(
                                  stockMetrics.isSoldOut
                                    ? "text-destructive font-medium"
                                    : stockMetrics.totalRemaining !== null && stockMetrics.totalRemaining <= 10
                                      ? "text-amber-600 dark:text-amber-400 font-medium"
                                      : "text-emerald-600 dark:text-emerald-400 font-medium",
                                )}
                              >
                                {stockMetrics.isSoldOut ? "Sold Out" : `${stockMetrics.totalRemaining} remaining`}
                              </span>
                            </>
                          )}
                        </span>

                        <div className="flex items-center gap-1">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => setOtsSaleItem(item)}
                            title="Sell on the spot (OTS)"
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                          >
                            <ShoppingBag className="size-3.5" />
                          </Button>
                          {!item.is_free && (
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => {
                                setPaymentItem(item);
                                setIsPaymentDialogOpen(true);
                              }}
                              title="Generate DOKU payment link"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <CreditCard className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleDuplicate(item)}
                            title="Duplicate item"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleToggleVisibility(item.id)}
                            title={
                              item.status === "hidden" || item.status === "draft"
                                ? "Show merchandise (Make visible to attendees)"
                                : "Hide merchandise (Hide from attendees)"
                            }
                            aria-label={
                              item.status === "hidden" || item.status === "draft"
                                ? `Show ${item.name}`
                                : `Hide ${item.name}`
                            }
                            className={cn(
                              "text-muted-foreground hover:text-foreground",
                              (item.status === "hidden" || item.status === "draft") &&
                                "text-amber-600 hover:text-amber-500 dark:text-amber-400",
                            )}
                          >
                            {item.status === "hidden" || item.status === "draft" ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleEdit(item)}
                            title="Edit variations & details"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleDelete(item.id, item.name)}
                            title="Delete item"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Summary Bar */}
          {items.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Sparkles className="size-4 text-amber-500" />
                <span>
                  <strong>{items.length}</strong> items configured ({items.filter((i) => i.is_free).length} Free,{" "}
                  {items.filter((i) => !i.is_free).length} Paid).
                </span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsTemplateDialogOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Sparkles className="size-3.5 text-amber-500" />
                  Add More Templates
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for editing/creating individual item */}
      <MerchandiseItemDialog
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        item={editingItem}
        onSave={handleSaveItem}
      />

      {/* Dialog for selecting from catalog templates */}
      <MerchandiseTemplateDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        onSelectTemplate={handleSelectTemplate}
        existingNames={items.map((i) => i.name)}
      />

      {/* Dialog for generating DOKU payment link */}
      <GenerateMerchandisePaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        item={paymentItem}
        event={event}
      />

      {/* Dialog for selling merchandise on the spot */}
      <CreateOnTheSpotSaleDialog
        open={Boolean(otsSaleItem)}
        onOpenChange={(v) => !v && setOtsSaleItem(null)}
        event={event}
        registrations={registrations}
        initialItem={otsSaleItem}
        initialOrders={merchandiseOrders}
      />

      {/* Dialog for viewing product & sizing guidelines */}
      <Dialog open={Boolean(viewingGuidelineItem)} onOpenChange={(open) => !open && setViewingGuidelineItem(null)}>
        <DialogContent className="inset-0 m-auto h-fit max-h-[90vh] translate-x-0 translate-y-0 overflow-y-auto sm:max-w-md [transform:none]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="size-5 text-primary" />
              {viewingGuidelineItem?.guideline?.title || "Product Guideline"}
            </DialogTitle>
            <DialogDescription>Sizing measurements and specs for {viewingGuidelineItem?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {viewingGuidelineItem?.guideline?.image_url && (
              <div className="overflow-hidden rounded-lg border bg-muted p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {/* biome-ignore lint/performance/noImgElement: guideline preview */}
                <img
                  src={viewingGuidelineItem.guideline.image_url}
                  alt="Size chart"
                  className="max-h-60 w-auto rounded object-contain mx-auto"
                />
              </div>
            )}

            {viewingGuidelineItem?.guideline?.text && (
              <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                {viewingGuidelineItem.guideline.text}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingGuidelineItem(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Fixed Floating Bottom Save Bar ──────────────────────────── */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSaveAll}
        onDiscard={handleDiscard}
        discardLabel="Discard"
        saveLabel="Save Bundle"
        savingLabel="Saving Bundle..."
        savedLabel="All Saved"
        statusInfo={`${items.length} Items Configured (${items.filter((i) => i.is_free).length} Free, ${items.filter((i) => !i.is_free).length} Paid)`}
        helperText="Perks will immediately reflect on the registration checkout modal."
      />
    </div>
  );
}
