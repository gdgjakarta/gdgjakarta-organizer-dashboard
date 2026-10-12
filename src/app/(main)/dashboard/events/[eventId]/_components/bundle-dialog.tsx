"use client";

import { useEffect, useMemo, useState } from "react";

import { Banknote, Check, Package, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";

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
  onSave,
}: BundleDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [badge, setBadge] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [bundledMerch, setBundledMerch] = useState<BundleMerchandiseItem[]>([]);
  const [price, setPrice] = useState<number>(0);
  const [hasCapacityLimit, setHasCapacityLimit] = useState(false);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [status, setStatus] = useState<"active" | "sold_out" | "hidden">("active");
  const [salesStartDate, setSalesStartDate] = useState("");
  const [salesEndDate, setSalesEndDate] = useState("");
  const [saveAsTemplateChecked, setSaveAsTemplateChecked] = useState(false);

  // Available tickets
  const activeTickets = useMemo(() => {
    return eventTickets.filter((t) => t.status !== "hidden");
  }, [eventTickets]);

  useEffect(() => {
    if (!open) return;
    if (bundle) {
      setName(bundle.name);
      setDescription(bundle.description ?? "");
      setBadge(bundle.badge ?? "");
      setTicketId(bundle.ticket_id);
      setBundledMerch(JSON.parse(JSON.stringify(bundle.merchandise_items)));
      setPrice(bundle.price);
      setHasCapacityLimit(bundle.capacity != null);
      setCapacity(bundle.capacity ?? null);
      setStatus(bundle.status);
      setSalesStartDate(toDateTimeLocalValue(bundle.sales_start_date));
      setSalesEndDate(toDateTimeLocalValue(bundle.sales_end_date));
    } else {
      setName("");
      setDescription("");
      setBadge("Best Value");
      setTicketId(activeTickets[0]?.id ?? "");
      setBundledMerch([]);
      setPrice(0);
      setHasCapacityLimit(false);
      setCapacity(null);
      setStatus("active");
      setSalesStartDate("");
      setSalesEndDate("");
    }
    setSaveAsTemplateChecked(false);
  }, [bundle, open, activeTickets]);

  // Live Pricing Calculation
  const pricing = useMemo(() => {
    return calculateBundlePricing(
      {
        ticket_id: ticketId,
        merchandise_items: bundledMerch,
        price,
      },
      eventTickets,
      eventMerchandise,
    );
  }, [ticketId, bundledMerch, price, eventTickets, eventMerchandise]);

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
    const discounted = Math.round((pricing.standaloneTotal * (1 - discountPct / 100)) / 1000) * 1000;
    setPrice(Math.max(0, discounted));
    setBadge(`Save ${discountPct}%`);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Please provide a name for this bundling package.");
      return;
    }
    if (!ticketId) {
      toast.error("Please select a ticket tier to include in the package.");
      return;
    }
    if (bundledMerch.length === 0) {
      toast.error("Please include at least one merchandise item in the bundle.");
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
      ticket_id: ticketId,
      merchandise_items: bundledMerch,
      price: Math.max(0, Number(price) || 0),
      original_price: pricing.standaloneTotal > 0 ? pricing.standaloneTotal : undefined,
      capacity: hasCapacityLimit && capacity && capacity > 0 ? Number(capacity) : null,
      total_registered: bundle?.total_registered ?? 0,
      status,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
                Combine a ticket tier and event merchandise items into a high-value combo package.
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
            {/* Step 1: Select Ticket Tier */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Ticket className="size-4 text-primary" />
                <Label className="font-semibold text-foreground">
                  1. Included Ticket Tier <span className="text-destructive">*</span>
                </Label>
              </div>

              {eventTickets.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                  No ticket tiers configured. Please create a ticket tier in the Tickets tab first.
                </div>
              ) : (
                <Select value={ticketId} onValueChange={setTicketId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select ticket tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTickets.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {t.type === "free" ? "Free" : `Rp ${(t.price || 0).toLocaleString("id-ID")}`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    2. Bundled Merchandise Items <span className="text-destructive">*</span>
                  </Label>
                </div>
                <span className="text-xs text-muted-foreground">
                  {bundledMerch.length} item{bundledMerch.length === 1 ? "" : "s"} selected
                </span>
              </div>

              {eventMerchandise.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                  No merchandise items found. Please add merchandise in the Merchandise tab first.
                </div>
              ) : (
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
                            <p className="truncate font-medium text-xs text-foreground sm:text-sm">{item.name}</p>
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
                          <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2 text-xs">
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
                              <span className="w-5 text-center font-medium">{selectedRecord?.quantity || 1}</span>
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
              )}
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
              <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Total Standalone Item Value:</span>
                  <span className="font-semibold text-foreground">
                    Rp {pricing.standaloneTotal.toLocaleString("id-ID")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Package Combo Price:</span>
                  <span className="font-bold text-sm text-primary">
                    Rp {pricing.bundlePrice.toLocaleString("id-ID")}
                  </span>
                </div>

                {pricing.savings > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <span className="font-medium">Attendee Savings ({pricing.discountPercentage}% OFF):</span>
                    <span className="font-bold">-Rp {pricing.savings.toLocaleString("id-ID")}</span>
                  </div>
                )}
                {pricing.savings === 0 &&
                  pricing.bundlePrice > 0 &&
                  pricing.bundlePrice === pricing.standaloneTotal && (
                    <p className="text-[11px] text-muted-foreground">Package matches the sum of standalone items.</p>
                  )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bundle-price">
                  Bundle Package Price (IDR) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">Rp</span>
                  <Input
                    id="bundle-price"
                    type="number"
                    min={0}
                    step={1000}
                    className="pl-9"
                    value={price || ""}
                    onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              </div>

              {/* Quick discount suggestions if standalone total > 0 */}
              {pricing.standaloneTotal > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-muted-foreground">Quick Discount:</span>
                  {[10, 15, 20, 25, 30].map((pct) => (
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
                  <Label htmlFor="capacity-limit" className="text-xs sm:text-sm font-medium">
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
                  <Input
                    id="sales-start"
                    type="datetime-local"
                    value={salesStartDate}
                    onChange={(e) => setSalesStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sales-end">Sales Close (Optional)</Label>
                  <Input
                    id="sales-end"
                    type="datetime-local"
                    value={salesEndDate}
                    onChange={(e) => setSalesEndDate(e.target.value)}
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

              <div className="flex items-center space-x-2 pt-1">
                <Switch id="save-template" checked={saveAsTemplateChecked} onCheckedChange={setSaveAsTemplateChecked} />
                <Label htmlFor="save-template" className="text-xs cursor-pointer">
                  Save as reusable template for future events
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
