"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  Package,
  PackageCheck,
  QrCode,
  ShoppingBag,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { subscribeMemberMerchandiseOrders } from "@/lib/firestore/merchandise-orders";
import type { EventMerchandiseOrder, FirestoreRegistration } from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface MemberPurchasesViewProps {
  initialRegistrations?: FirestoreRegistration[];
}

export function MemberPurchasesView({ initialRegistrations = [] }: MemberPurchasesViewProps) {
  const user = useAuthStore((s) => s.user);
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>(initialRegistrations);
  const [otsOrders, setOtsOrders] = useState<EventMerchandiseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "ots" | "ticket">("all");

  // Selected order for viewing QRIS
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<EventMerchandiseOrder | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  // Subscribe to user's OTS orders
  useEffect(() => {
    if (!user?.email) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = subscribeMemberMerchandiseOrders(user.email, (orders) => {
      setOtsOrders(orders);
      setIsLoading(false);
    });

    // Also load member registrations if not provided
    async function loadRegs() {
      if (initialRegistrations.length === 0 && (user?.id || user?.email)) {
        try {
          const { getMemberRegistrations } = await import("@/lib/firestore/client");
          const list = await getMemberRegistrations(user.id, user.email || undefined);
          setRegistrations(list);
        } catch (err) {
          console.warn("[MemberPurchasesView] Failed to load registrations:", err);
        }
      }
    }
    void loadRegs();

    return () => unsubscribe();
  }, [user?.email, user?.id, initialRegistrations.length]);

  // Extract items from registrations
  const ticketMerchItems = useMemo(() => {
    const list: Array<{
      id: string;
      eventId: string;
      eventTitle: string;
      ticketName?: string;
      registeredAt: string;
      isCollected: boolean;
      items: Array<{
        name: string;
        quantity: number;
        variation?: string;
        imageUrl?: string;
      }>;
    }> = [];

    for (const reg of registrations) {
      if (reg.status === "cancelled" || reg.status === "canceled" || reg.status === "rejected") {
        continue;
      }
      const selected = reg.selected_merchandise ?? [];
      if (selected.length === 0) continue;

      list.push({
        id: reg.id,
        eventId: String(reg.event_id || ""),
        eventTitle: reg.event_title || "GDG Jakarta Event",
        ticketName: reg.ticket_tier || reg.ticket_name || undefined,
        registeredAt: reg.registered_at || new Date().toISOString(),
        isCollected: Boolean(reg.is_merchandise_collected),
        items: selected.map((m) => {
          const varEntries = m.selected_variations ? Object.values(m.selected_variations).filter(Boolean) : [];
          const fallbackVar = m.selected_variant || m.selected_size || "";
          const variation = varEntries.length > 0 ? varEntries.join(", ") : fallbackVar;
          return {
            name: m.name || m.merchandise_title || "Event Merchandise",
            quantity: m.quantity || 1,
            variation: variation || undefined,
            imageUrl: (m as { image_url?: string }).image_url,
          };
        }),
      });
    }

    return list;
  }, [registrations]);

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setHasCopied(true);
    toast.success("Payment link copied!");
    setTimeout(() => setHasCopied(false), 2000);
  };

  const totalPurchasesCount = otsOrders.length + ticketMerchItems.length;

  function renderPaymentStatusBadge(status: string) {
    if (status === "paid") {
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px]"
        >
          Paid
        </Badge>
      );
    }
    if (status === "waiting_for_payment") {
      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px]"
        >
          Waiting for Payment
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">
        {status}
      </Badge>
    );
  }

  function renderPurchasesContent() {
    if (isLoading) {
      return (
        <div className="flex h-48 items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Loading your merchandise orders...</span>
        </div>
      );
    }

    if (totalPurchasesCount === 0) {
      return (
        <Card className="text-center p-8">
          <CardHeader className="space-y-2 pb-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ShoppingBag className="size-6 opacity-40" />
            </div>
            <CardTitle className="text-base font-semibold">No Merchandise Purchases Yet</CardTitle>
            <CardDescription className="text-xs">
              When you pre-order merchandise with your event ticket or purchase items on the spot at our venue desk,
              they will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/member">Explore Events</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* OTS Orders Section */}
        {(activeTab === "all" || activeTab === "ots") &&
          otsOrders.map((order) => {
            const isPaid = order.payment_status === "paid";
            const isPending = order.payment_status === "waiting_for_payment";
            const isCollected = order.collection_status === "collected";

            return (
              <Card key={order.id} className="overflow-hidden shadow-2xs border-border/80">
                <div className="border-b border-border/60 bg-muted/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1 text-[10px] font-semibold"
                    >
                      <ShoppingBag className="size-2.5" />
                      Purchased On the Spot (OTS)
                    </Badge>
                    <span className="font-mono text-xs font-semibold text-foreground">#{order.order_number}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {renderPaymentStatusBadge(order.payment_status)}

                    <span className="text-[11px] text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">{order.event_title}</h4>
                      {order.bundle_name && (
                        <p className="text-xs text-primary font-medium mt-0.5">Bundle: {order.bundle_name}</p>
                      )}
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="font-semibold text-sm text-foreground">
                        Rp {order.total_amount.toLocaleString("id-ID")}
                      </div>
                      <div className="text-[11px] text-muted-foreground capitalize">
                        Payment: {order.payment_method === "qris" ? "QRIS / Online" : "Cash / On-Site"}
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="divide-y divide-border/40 rounded-lg border bg-muted/20 p-2.5">
                    {order.items.map((item) => (
                      <div
                        key={item.merchandise_id}
                        className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{item.quantity}x</span>
                          <span className="text-foreground">{item.name}</span>
                          {item.selected_variations && Object.keys(item.selected_variations).length > 0 && (
                            <span className="text-muted-foreground text-[11px]">
                              (
                              {Object.entries(item.selected_variations)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(", ")}
                              )
                            </span>
                          )}
                        </div>
                        {order.bundle_id ? null : (
                          <span className="font-medium text-muted-foreground">
                            Rp {(item.price * item.quantity).toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Collection status & action bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/40">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">Merchandise Status:</span>
                      {isCollected ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] gap-1"
                        >
                          <Check className="size-2.5" />
                          Collected
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px]"
                        >
                          Ready to Collect at Booth
                        </Badge>
                      )}
                    </div>

                    {isPending && order.payment_url && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleCopy(order.payment_url || "")}
                          className="gap-1.5 text-xs"
                        >
                          {hasCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                          Copy Link
                        </Button>
                        <Button
                          size="xs"
                          onClick={() => setSelectedPaymentOrder(order)}
                          className="gap-1.5 text-xs bg-primary text-primary-foreground font-semibold"
                        >
                          <QrCode className="size-3" />
                          Pay Now (QRIS)
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

        {/* Ticket Pre-order Merchandise */}
        {(activeTab === "all" || activeTab === "ticket") &&
          ticketMerchItems.map((reg) => (
            <Card key={reg.id} className="overflow-hidden shadow-2xs border-border/80">
              <div className="border-b border-border/60 bg-muted/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300 gap-1 text-[10px] font-semibold"
                  >
                    <Ticket className="size-2.5" />
                    Event Registration Package
                  </Badge>
                  {reg.ticketName && (
                    <span className="text-xs font-semibold text-foreground">Pass: {reg.ticketName}</span>
                  )}
                </div>

                <span className="text-[11px] text-muted-foreground">
                  Registered:{" "}
                  {new Date(reg.registeredAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              <CardContent className="p-4 space-y-3">
                <div>
                  <h4 className="font-semibold text-sm text-foreground">{reg.eventTitle}</h4>
                </div>

                <div className="divide-y divide-border/40 rounded-lg border bg-muted/20 p-2.5">
                  {reg.items.map((m, idx) => (
                    <div
                      key={`${reg.id}-item-${idx}`}
                      className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{m.quantity}x</span>
                        <span className="text-foreground">{m.name}</span>
                        {m.variation && <span className="text-muted-foreground text-[11px]">({m.variation})</span>}
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-background">
                        Ticket Included
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 text-xs pt-1">
                  <span className="text-muted-foreground">Collection Status:</span>
                  {reg.isCollected ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] gap-1"
                    >
                      <Check className="size-2.5" />
                      Collected at Venue
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-border text-muted-foreground text-[10px]">
                      Collect at Event Registration Desk
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Breadcrumb / Action */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/member">
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Merchandise Purchases & Orders</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Review merchandise included with your event tickets and on-the-spot booth purchases.
        </p>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "ots" | "ticket")} className="w-full">
        <TabsList className="grid h-9 w-full max-w-md grid-cols-3">
          <TabsTrigger value="all" className="text-xs">
            All ({totalPurchasesCount})
          </TabsTrigger>
          <TabsTrigger value="ots" className="text-xs gap-1.5">
            <ShoppingBag className="size-3 text-amber-500" />
            OTS ({otsOrders.length})
          </TabsTrigger>
          <TabsTrigger value="ticket" className="text-xs gap-1.5">
            <Ticket className="size-3 text-blue-500" />
            Ticket Merch ({ticketMerchItems.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      {renderPurchasesContent()}

      {/* QRIS Dialog for Pending Order */}
      {selectedPaymentOrder && selectedPaymentOrder.payment_url && (
        <Dialog open={Boolean(selectedPaymentOrder)} onOpenChange={(v) => !v && setSelectedPaymentOrder(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Complete Payment: #{selectedPaymentOrder.order_number}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Scan with GoPay, OVO, Dana, BCA, or mobile banking QRIS to complete your purchase.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center p-4 text-center space-y-3">
              <div className="overflow-hidden rounded-xl border bg-white p-2 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(
                    selectedPaymentOrder.payment_url,
                  )}`}
                  alt="QRIS Code"
                  className="size-48 object-contain"
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Invoice #{selectedPaymentOrder.payment_invoice_number}</p>
                <p className="text-xl font-bold tracking-tight text-foreground">
                  Rp {selectedPaymentOrder.total_amount.toLocaleString("id-ID")}
                </p>
              </div>

              <div className="w-full space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={selectedPaymentOrder.payment_url}
                    className="h-8 font-mono text-xs text-muted-foreground"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(selectedPaymentOrder.payment_url!)}
                    className="shrink-0 gap-1.5 text-xs h-8"
                  >
                    {hasCopied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    <span>{hasCopied ? "Copied" : "Copy"}</span>
                  </Button>
                </div>

                <Button asChild className="w-full gap-2 text-xs h-8">
                  <a href={selectedPaymentOrder.payment_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                    Open Checkout in New Tab
                  </a>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
