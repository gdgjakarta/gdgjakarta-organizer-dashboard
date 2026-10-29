"use client";

import { useEffect, useMemo, useState } from "react";

import { Banknote, Check, Package, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { calculateBundlePricing, saveBundleAsTemplate } from "@/lib/events/bundle-templates";
import type {
  BundleMerchandiseItem,
  EventBundlePackage,
  EventMerchandiseItem,
  EventTicketTier,
} from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface BundleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: EventBundlePackage | null;
  eventTickets?: EventTicketTier[];
  eventMerchandise?: EventMerchandiseItem[];
  isLoading?: boolean;
  onSave: (bundle: EventBundlePackage) => void;
}

const BADGE_PRESETS = [
  "Best Value",
  "Save 20%",
  "Save 25%",
  "VIP Combo",
  "Popular",
  "Limited Edition",
  "Early Bird Combo",
];

function toDateTimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function BundleDialog({
  open,
  onOpenChange,
  bundle,
  eventTickets = [],
  eventMerchandise = [],
  isLoading = false,
  onSave,
}: BundleDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [badge, setBadge] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [ticketQuantity, setTicketQuantity] = useState<number>(1);
  const [bundledMerch, setBundledMerch] = useState<BundleMerchandiseItem[]>([]);
  const [discountMode, setDiscountMode] = useState<"percentage" | "fixed" | "custom">("percentage");
  const [discountValue, setDiscountValue] = useState<number>(20);
  const [price, setPrice] = useState<number>(0);
  const [generateVouchers, setGenerateVouchers] = useState(true);
  const [hasCapacityLimit, setHasCapacityLimit] = useState(false);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [status, setStatus] = useState<"active" | "sold_out" | "hidden">("active");
  const [isOtsOnly, setIsOtsOnly] = useState(false);
  const [salesStartDate, setSalesStartDate] = useState("");
  const [salesEndDate, setSalesEndDate] = useState("");
  const [saveAsTemplateChecked, setSaveAsTemplateChecked] = useState(false);

  // Available tickets
  const activeTickets = useMemo(() => {
    return eventTickets.filter((t) => t.status !== "hidden" || t.id === bundle?.ticket_id);
  }, [eventTickets, bundle?.ticket_id]);

  useEffect(() => {
    if (!open) return;
    if (bundle) {
      setName(bundle.name);
      setDescription(bundle.description ?? "");
      setBadge(bundle.badge ?? "");
      setTicketId(bundle.ticket_id ?? "none");
      setTicketQuantity(bundle.ticket_quantity ?? 1);
      setBundledMerch(JSON.parse(JSON.stringify(bundle.merchandise_items)));
      setPrice(bundle.price);
      setDiscountMode(bundle.discount_type ?? "percentage");
      setDiscountValue(bundle.discount_value ?? 20);
      setGenerateVouchers(bundle.generate_vouchers !== false);
      setHasCapacityLimit(bundle.capacity != null);
      setCapacity(bundle.capacity ?? null);
      setStatus(bundle.status);
      setIsOtsOnly(Boolean(bundle.is_ots_only));
      setSalesStartDate(toDateTimeLocalValue(bundle.sales_start_date));
      setSalesEndDate(toDateTimeLocalValue(bundle.sales_end_date));
    } else {
      setName("");
      setDescription("");
      setBadge("Best Value");
      setTicketId(activeTickets[0]?.id ?? "none");
      setTicketQuantity(1);
      setBundledMerch([]);
      setPrice(0);
      setDiscountMode("percentage");
      setDiscountValue(20);
      setGenerateVouchers(true);
      setHasCapacityLimit(false);
      setCapacity(null);
      setStatus("active");
      setIsOtsOnly(false);
      setSalesStartDate("");
      setSalesEndDate("");
    }
    setSaveAsTemplateChecked(false);
  }, [bundle, open, activeTickets[0]?.id]);

  // If newly creating a bundle and active tickets become loaded after dialog was opened with "none", auto-select first ticket
  useEffect(() => {
    if (open && !bundle && (!ticketId || ticketId === "none") && activeTickets.length > 0) {
      setTicketId(activeTickets[0].id);
    }
  }, [open, bundle, ticketId, activeTickets]);

  // Live Pricing Calculation
  const pricing = useMemo(() => {
    return calculateBundlePricing(
      {
        ticket_id: ticketId && ticketId !== "none" ? ticketId : undefined,
        ticket_quantity: ticketId && ticketId !== "none" ? ticketQuantity : 0,
        merchandise_items: bundledMerch,
        price,
      },
      eventTickets,
      eventMerchandise,
    );
  }, [ticketId, ticketQuantity, bundledMerch, price, eventTickets, eventMerchandise]);

  // Helper to recompute price based on discountMode & discountValue
  const applyDiscountCalculation = (mode: "percentage" | "fixed" | "custom", val: number, standaloneTot: number) => {
    if (mode === "percentage") {
      const pct = Math.min(100, Math.max(0, val));
      const discounted = Math.round((standaloneTot * (1 - pct / 100)) / 1000) * 1000;
      setPrice(Math.max(0, discounted));
    } else if (mode === "fixed") {
      const fixedDiscount = Math.max(0, val);
      const discounted = Math.max(0, standaloneTot - fixedDiscount);
      setPrice(discounted);
    }
  };

  const handleModeChange = (newMode: "percentage" | "fixed" | "custom") => {
    setDiscountMode(newMode);
    if (newMode === "percentage") {
      const currentPct = pricing.discountPercentage || 20;
      setDiscountValue(currentPct);
      applyDiscountCalculation("percentage", currentPct, pricing.standaloneTotal);
    } else if (newMode === "fixed") {
      const currentSavings = pricing.savings || Math.round(pricing.standaloneTotal * 0.2);
      setDiscountValue(currentSavings);
      applyDiscountCalculation("fixed", currentSavings, pricing.standaloneTotal);
    }
  };

  const handleDiscountValueChange = (val: number) => {
    setDiscountValue(val);
    applyDiscountCalculation(discountMode, val, pricing.standaloneTotal);
  };

  const handleDirectPriceChange = (newPrice: number) => {
    const validPrice = Math.max(0, newPrice);
    setPrice(validPrice);
    if (pricing.standaloneTotal > 0) {
      const savings = Math.max(0, pricing.standaloneTotal - validPrice);
      if (discountMode === "percentage") {
        const pct = Math.round((savings / pricing.standaloneTotal) * 100);
        setDiscountValue(pct);
      } else if (discountMode === "fixed") {
        setDiscountValue(savings);
      }
    }
  };

  // Helper to add a merchandise item into bundle
  const handleToggleMerch = (merchId: string) => {
    setBundledMerch((prev) => {
      const exists = prev.find((m) => m.merchandise_id === merchId);
      if (exists) {
        return prev.filter((m) => m.merchandise_id !== merchId);
      }
      return [...prev, { merchandise_id: merchId, quantity: 1 }];
    });
  };

  const handleUpdateMerchQuantity = (merchId: string, quantity: number) => {
    if (quantity <= 0) {
      setBundledMerch((prev) => prev.filter((m) => m.merchandise_id !== merchId));
      return;
    }
    setBundledMerch((prev) => prev.map((m) => (m.merchandise_id === merchId ? { ...m, quantity } : m)));
  };

  const handleApplySuggestedPrice = (discountPct: number) => {
    setDiscountMode("percentage");
    setDiscountValue(discountPct);
    const discounted = Math.round((pricing.standaloneTotal * (1 - discountPct / 100)) / 1000) * 1000;
    setPrice(Math.max(0, discounted));
    setBadge(`Save ${discountPct}%`);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Please provide a name for this bundling package.");
      return;
    }

    const hasTicket = Boolean(ticketId && ticketId !== "none");
    const hasMerch = bundledMerch.length > 0;

    if (!hasTicket && !hasMerch) {
      toast.error("Please include at least a ticket tier or at least one merchandise item in the bundle.");
      return;
    }

    if (salesStartDate && salesEndDate) {
      const startMs = new Date(salesStartDate).getTime();
      const endMs = new Date(salesEndDate).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs <= startMs) {
        toast.error("Sales End date must be after Sales Start date.");
        return;
      }
    }

    const payload: EventBundlePackage = {
      id: bundle?.id ?? `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      description: description.trim() || undefined,
      badge: badge.trim() || undefined,
      ticket_id: hasTicket ? ticketId : undefined,
      ticket_quantity: hasTicket ? Math.max(1, Number(ticketQuantity) || 1) : 0,
      merchandise_items: bundledMerch,
      price: Math.max(0, Number(price) || 0),
      original_price: pricing.standaloneTotal > 0 ? pricing.standaloneTotal : undefined,
      discount_type: discountMode,
      discount_value: Number(discountValue) || undefined,
      generate_vouchers: hasTicket ? generateVouchers : false,
      capacity: hasCapacityLimit && capacity && capacity > 0 ? Number(capacity) : null,
      total_registered: bundle?.total_registered ?? 0,
      status,
      is_ots_only: isOtsOnly,
      sales_start_date: salesStartDate ? new Date(salesStartDate).toISOString() : null,
      sales_end_date: salesEndDate ? new Date(salesEndDate).toISOString() : null,
      created_at: bundle?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (saveAsTemplateChecked) {
      saveBundleAsTemplate(payload);
      toast.success(`Saved "${payload.name}" as reusable template!`);
    }

    onSave(payload);
    onOpenChange(false);
  };

  const renderTicketsBody = () => {
    if (isLoading) {
      return (
        <div className="space-y-2 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3.5">
          <div className="flex items-center gap-2">
            <Spinner className="size-3.5 text-primary" />
            <span className="text-muted-foreground text-xs">Loading available ticket tiers...</span>
          </div>
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
            <Skeleton className="h-9 rounded-md sm:col-span-2" />
            <Skeleton className="h-9 rounded-md" />
          </div>
        </div>
      );
    }

    if (eventTickets.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-3 text-center text-muted-foreground text-xs">
          No ticket tiers configured. You can still create a merchandise-only package.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="ticket-select" className="mb-1 block text-muted-foreground text-xs">
            Ticket Tier
          </Label>
          <Select value={ticketId} onValueChange={setTicketId}>
            <SelectTrigger id="ticket-select" className="w-full">
              <SelectValue placeholder="Select ticket tier (or None)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground italic">None (Merchandise-only package)</span>
              </SelectItem>
              {eventTickets.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">
                      {t.name}
                      {t.status === "hidden" && " (Hidden)"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t.type === "free" ? "Free" : `Rp ${(t.price || 0).toLocaleString("id-ID")}`}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="ticket-quantity" className="mb-1 block text-muted-foreground text-xs">
            Quantity in Bundle
          </Label>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              onClick={() => setTicketQuantity((q) => Math.max(1, q - 1))}
              disabled={!ticketId || ticketId === "none" || ticketQuantity <= 1}
            >
              -
            </Button>
            <Input
              id="ticket-quantity"
              type="number"
              min={1}
              value={ticketId && ticketId !== "none" ? ticketQuantity : 0}
              disabled={!ticketId || ticketId === "none"}
              onChange={(e) => setTicketQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="text-center font-bold"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              onClick={() => setTicketQuantity((q) => q + 1)}
              disabled={!ticketId || ticketId === "none"}
            >
              +
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderMerchandiseBody = () => {
    if (isLoading) {
      return (
        <div className="space-y-2 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3.5">
          <div className="flex items-center gap-2">
            <Spinner className="size-3.5 text-primary" />
            <span className="text-muted-foreground text-xs">Loading event merchandise...</span>
          </div>
          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </div>
      );
    }

    if (eventMerchandise.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-3 text-center text-muted-foreground text-xs">
          No merchandise items found. Please add merchandise in the Merchandise tab first.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {eventMerchandise.map((item) => {
          const isSelected = bundledMerch.some((m) => m.merchandise_id === item.id);
          const selectedRecord = bundledMerch.find((m) => m.merchandise_id === item.id);

          return (
            <div
              key={item.id}
              className={cn(
                "flex flex-col justify-between rounded-lg border p-3 transition-colors",
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border bg-card hover:border-muted-foreground/30",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground text-xs sm:text-sm">
                    {item.name}
                    {(item.status === "hidden" || item.status === "draft") && (
                      <span className="ml-1.5 font-normal text-[10px] text-muted-foreground">(Hidden)</span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.is_free ? "Free Perk" : `Rp ${item.price.toLocaleString("id-ID")}`}
                    {item.variations?.length ? ` • ${item.variations.map((v) => v.name).join(", ")}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() => handleToggleMerch(item.id)}
                >
                  {isSelected ? (
                    <>
                      <Check className="mr-1 size-3" /> Included
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 size-3" /> Add
                    </>
                  )}
                </Button>
              </div>

              {isSelected && (
                <div className="mt-2.5 flex items-center justify-between border-border/50 border-t pt-2 text-xs">
                  <span className="text-[11px] text-muted-foreground">Quantity included:</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-6 text-xs"
                      onClick={() => handleUpdateMerchQuantity(item.id, (selectedRecord?.quantity || 1) - 1)}
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      className="h-6 w-12 px-1 text-center font-medium text-xs"
                      value={selectedRecord?.quantity || 1}
                      onChange={(e) => handleUpdateMerchQuantity(item.id, Math.max(1, Number(e.target.value) || 1))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-6 text-xs"
                      onClick={() => handleUpdateMerchQuantity(item.id, (selectedRecord?.quantity || 1) + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inset-0 m-auto h-fit max-h-[90vh] translate-x-0 translate-y-0 overflow-y-auto sm:max-w-2xl [transform:none]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg">
                {bundle ? "Edit Bundling Package" : "Create Bundling Package"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Combine ticket tiers and/or merchandise items into discounted combo packages, group ticket passes, or
                merchandise bundles.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2 text-sm">
          {/* Package Name & Badge */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bundle-name">
                Package Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bundle-name"
                placeholder="e.g. VIP Conference Pass & Official Swag Kit"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bundle-badge">Promotional Badge / Tag</Label>
              <Input
                id="bundle-badge"
                placeholder="e.g. Best Value, Save 25%, VIP Combo"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {BADGE_PRESETS.map((preset) => (
                  <Badge
                    key={preset}
                    variant={badge === preset ? "default" : "outline"}
                    className="cursor-pointer text-[10px] transition-colors hover:bg-muted"
                    onClick={() => setBadge(preset)}
                  >
                    {preset}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bundle-desc">Package Description</Label>
              <Textarea
                id="bundle-desc"
                rows={2}
                placeholder="Describe what's included and exclusive perks for package holders..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            {/* Step 1: Select Ticket Tier & Quantity */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="size-4 text-primary" />
                  <Label className="font-semibold text-foreground">
                    1. Included Ticket Tier & Quantity{" "}
                    <span className="font-normal text-muted-foreground text-xs">(Optional)</span>
                  </Label>
                  {isLoading && <Spinner className="size-3 text-muted-foreground" />}
                </div>
                {pricing.ticketSubtotal > 0 && (
                  <span className="font-semibold text-primary text-xs">
                    Subtotal: Rp {pricing.ticketSubtotal.toLocaleString("id-ID")}
                  </span>
                )}
              </div>

              {renderTicketsBody()}

              {ticketId && ticketId !== "none" && ticketQuantity > 1 && (
                <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-primary">
                      Bulk / Group Pass ({ticketQuantity} Tickets Total):
                    </span>
                    <span className="font-semibold text-foreground">
                      {ticketQuantity} × Rp{" "}
                      {(eventTickets.find((t) => t.id === ticketId)?.price || 0).toLocaleString("id-ID")} = Rp{" "}
                      {pricing.ticketSubtotal.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-primary/10 border-t pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      Generates <strong>{ticketQuantity - 1} friend vouchers</strong> (100% free ticket discount) upon
                      purchase
                    </span>
                    <Switch
                      id="gen-vouchers"
                      checked={generateVouchers}
                      onCheckedChange={setGenerateVouchers}
                      className="scale-75"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            {/* Step 2: Select Bundled Merchandise */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-primary" />
                  <Label className="font-semibold text-foreground">
                    2. Bundled Merchandise Items{" "}
                    <span className="font-normal text-muted-foreground text-xs">(Optional)</span>
                  </Label>
                  {isLoading && <Spinner className="size-3 text-muted-foreground" />}
                </div>
                <span className="text-muted-foreground text-xs">
                  {bundledMerch.length === 0
                    ? "0 items (Ticket-only package)"
                    : `${bundledMerch.length} item${bundledMerch.length === 1 ? "" : "s"} selected`}
                </span>
              </div>

              {renderMerchandiseBody()}
            </div>
          </div>

          <div className="border-t pt-4">
            {/* Step 3: Pricing & Value Calculation */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Banknote className="size-4 text-primary" />
                <Label className="font-semibold text-foreground">3. Pricing & Savings</Label>
              </div>

              {/* Breakdown comparison banner */}
              <div className="space-y-2 rounded-xl border bg-muted/40 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Ticket Subtotal ({pricing.ticketQuantity}x Tickets):</span>
                  <span className="font-semibold text-foreground">
                    Rp {pricing.ticketSubtotal.toLocaleString("id-ID")}
                  </span>
                </div>

                {pricing.merchSubtotal > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Merchandise Subtotal:</span>
                    <span className="font-semibold text-foreground">
                      Rp {pricing.merchSubtotal.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-border/50 border-t pt-1.5 text-xs">
                  <span className="font-medium text-muted-foreground">Total Standalone Value:</span>
                  <span className="font-bold text-foreground">
                    Rp {pricing.standaloneTotal.toLocaleString("id-ID")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-muted-foreground">Package Combo Price:</span>
                  <span className="font-bold text-primary text-sm">
                    Rp {pricing.bundlePrice.toLocaleString("id-ID")}
                  </span>
                </div>

                {pricing.savings > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-1.5 text-emerald-700 text-xs dark:text-emerald-400">
                    <span className="font-medium">Total Attendee Savings ({pricing.discountPercentage}% OFF):</span>
                    <span className="font-bold">-Rp {pricing.savings.toLocaleString("id-ID")}</span>
                  </div>
                )}
                {pricing.savings === 0 &&
                  pricing.bundlePrice > 0 &&
                  pricing.bundlePrice === pricing.standaloneTotal && (
                    <p className="text-[11px] text-muted-foreground">Package matches the sum of standalone items.</p>
                  )}
              </div>

              {/* Discount Mode Selector */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Discount Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={discountMode === "percentage" ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => handleModeChange("percentage")}
                  >
                    Percentage (%)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={discountMode === "fixed" ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => handleModeChange("fixed")}
                  >
                    Fixed Amount (Rp)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={discountMode === "custom" ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => handleModeChange("custom")}
                  >
                    Direct Price
                  </Button>
                </div>
              </div>

              {/* Dynamic discount value input based on mode */}
              {discountMode === "percentage" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="discount-pct">Discount Percentage (%)</Label>
                    <span className="text-muted-foreground text-xs">
                      Savings: -Rp {pricing.savings.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      id="discount-pct"
                      type="number"
                      min={0}
                      max={100}
                      className="pr-8"
                      value={discountValue}
                      onChange={(e) =>
                        handleDiscountValueChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                      }
                    />
                    <span className="absolute top-2.5 right-3 text-muted-foreground text-xs">%</span>
                  </div>
                </div>
              )}

              {discountMode === "fixed" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="discount-amount">Fixed Discount Deduction (IDR)</Label>
                    <span className="text-muted-foreground text-xs">{pricing.discountPercentage}% OFF</span>
                  </div>
                  <div className="relative">
                    <span className="absolute top-2.5 left-3 text-muted-foreground text-xs">Rp</span>
                    <Input
                      id="discount-amount"
                      type="number"
                      min={0}
                      step={1000}
                      className="pl-9"
                      value={discountValue}
                      onChange={(e) => handleDiscountValueChange(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bundle-price">
                    Final Bundle Package Price (IDR) <span className="text-destructive">*</span>
                  </Label>
                  {discountMode !== "custom" && (
                    <span className="text-[11px] text-muted-foreground">
                      Calculated from{" "}
                      {discountMode === "percentage"
                        ? `${discountValue}% discount`
                        : `Rp ${discountValue.toLocaleString("id-ID")} discount`}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute top-2.5 left-3 text-muted-foreground text-xs">Rp</span>
                  <Input
                    id="bundle-price"
                    type="number"
                    min={0}
                    step={1000}
                    className="pl-9"
                    value={price || ""}
                    onChange={(e) => handleDirectPriceChange(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              </div>

              {/* Quick discount suggestions if standalone total > 0 */}
              {pricing.standaloneTotal > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-[11px] text-muted-foreground">Quick Discount:</span>
                  {[10, 15, 20, 25, 30, 50].map((pct) => (
                    <Button
                      key={pct}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => handleApplySuggestedPrice(pct)}
                    >
                      {pct}% OFF
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            {/* Step 4: Quota, Dates & Status */}
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="capacity-limit" className="font-medium text-xs sm:text-sm">
                    Limit Total Packages (Quota)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Restrict the total number of this bundle available for purchase.
                  </p>
                </div>
                <Switch id="capacity-limit" checked={hasCapacityLimit} onCheckedChange={setHasCapacityLimit} />
              </div>

              {hasCapacityLimit && (
                <div className="space-y-1.5">
                  <Label htmlFor="bundle-capacity">Maximum Package Quota</Label>
                  <Input
                    id="bundle-capacity"
                    type="number"
                    min={1}
                    placeholder="e.g. 50"
                    value={capacity ?? ""}
                    onChange={(e) => setCapacity(e.target.value ? Math.max(1, Number(e.target.value)) : null)}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sales-start">Sales Open (Optional)</Label>
                  <DatePicker
                    id="sales-start"
                    withTime
                    value={salesStartDate}
                    onChange={setSalesStartDate}
                    placeholder="Open immediately"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sales-end">Sales Close (Optional)</Label>
                  <DatePicker
                    id="sales-end"
                    withTime
                    value={salesEndDate}
                    onChange={setSalesEndDate}
                    placeholder="Close when sold out"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bundle-status">Status</Label>
                <Select value={status} onValueChange={(val) => setStatus(val as "active" | "sold_out" | "hidden")}>
                  <SelectTrigger id="bundle-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (Available for purchase)</SelectItem>
                    <SelectItem value="sold_out">Sold Out (Mark as unavailable)</SelectItem>
                    <SelectItem value="hidden">Hidden (Organizer view only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* OTS Only Toggle */}
              <div className="flex items-center justify-between rounded-xl border p-3.5 bg-muted/20">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="bundle-ots-only" className="font-semibold text-xs cursor-pointer">
                    On-the-Spot (OTS) Only
                  </Label>
                  <p className="text-muted-foreground text-[11px] leading-normal">
                    Exclusive to on-site sales at the venue. Hidden from the online registration form.
                  </p>
                </div>
                <Switch id="bundle-ots-only" checked={isOtsOnly} onCheckedChange={setIsOtsOnly} />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <Switch id="save-template" checked={saveAsTemplateChecked} onCheckedChange={setSaveAsTemplateChecked} />
                <Label htmlFor="save-template" className="cursor-pointer text-xs">
                  Save as reusable template for future events
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            {bundle ? "Update Package" : "Create Package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
