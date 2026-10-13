"use client";

import { useEffect, useState } from "react";

import { CheckCircle2, Percent, RefreshCw, Tag } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { generateRandomVoucherCode } from "@/lib/events/voucher-utils";
import type { EventVoucher, VoucherAppliesTo, VoucherDiscountType } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface VoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucher: EventVoucher | null;
  onSave: (voucher: EventVoucher) => void;
}

export function VoucherDialog({ open, onOpenChange, voucher, onSave }: VoucherDialogProps) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<VoucherDiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState<number>(20);
  const [appliesTo, setAppliesTo] = useState<VoucherAppliesTo>("all");

  // Limits & Conditions
  const [hasUsageLimit, setHasUsageLimit] = useState(false);
  const [usageLimit, setUsageLimit] = useState<number>(50);
  const [hasMinSpend, setHasMinSpend] = useState(false);
  const [minSpend, setMinSpend] = useState<number>(50000);
  const [hasMaxDiscount, setHasMaxDiscount] = useState(false);
  const [maxDiscount, setMaxDiscount] = useState<number>(100000);

  // Date validity
  const [hasExpiry, setHasExpiry] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (voucher) {
      setCode(voucher.code);
      setDescription(voucher.description ?? "");
      setDiscountType(voucher.discount_type);
      setDiscountValue(voucher.discount_value);
      setAppliesTo(voucher.applies_to);

      setHasUsageLimit(voucher.usage_limit !== null && voucher.usage_limit !== undefined);
      setUsageLimit(voucher.usage_limit ?? 50);

      setHasMinSpend(Boolean(voucher.min_spend && voucher.min_spend > 0));
      setMinSpend(voucher.min_spend ?? 50000);

      setHasMaxDiscount(Boolean(voucher.max_discount && voucher.max_discount > 0));
      setMaxDiscount(voucher.max_discount ?? 100000);

      setHasExpiry(Boolean(voucher.end_date ?? voucher.start_date));
      setStartDate(voucher.start_date ? voucher.start_date.slice(0, 10) : "");
      setEndDate(voucher.end_date ? voucher.end_date.slice(0, 10) : "");

      setIsActive(voucher.status === "active");
    } else {
      // Default new voucher
      setCode(generateRandomVoucherCode());
      setDescription("");
      setDiscountType("percentage");
      setDiscountValue(20);
      setAppliesTo("all");

      setHasUsageLimit(false);
      setUsageLimit(50);
      setHasMinSpend(false);
      setMinSpend(50000);
      setHasMaxDiscount(false);
      setMaxDiscount(100000);

      setHasExpiry(false);
      setStartDate("");
      setEndDate("");

      setIsActive(true);
    }
  }, [voucher]);

  const handleGenerateCode = () => {
    let prefix = "GDG";
    if (appliesTo === "ticket") {
      prefix = "TICKET";
    } else if (appliesTo === "merchandise") {
      prefix = "MERCH";
    }
    setCode(generateRandomVoucherCode(prefix));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCode = code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "");
    if (!cleanCode) {
      toast.error("Please enter a valid voucher code.");
      return;
    }

    if (discountValue <= 0) {
      toast.error("Discount value must be greater than 0.");
      return;
    }

    if (discountType === "percentage" && discountValue > 100) {
      toast.error("Percentage discount cannot exceed 100%.");
      return;
    }

    const now = new Date().toISOString();
    const finalVoucher: EventVoucher = {
      id: voucher?.id ?? `voucher-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code: cleanCode,
      description: description.trim() || undefined,
      discount_type: discountType,
      discount_value: Number(discountValue),
      applies_to: appliesTo,
      usage_limit: hasUsageLimit && usageLimit > 0 ? Number(usageLimit) : null,
      times_used: voucher?.times_used ?? 0,
      min_spend: hasMinSpend && minSpend > 0 ? Number(minSpend) : null,
      max_discount: discountType === "percentage" && hasMaxDiscount && maxDiscount > 0 ? Number(maxDiscount) : null,
      start_date: hasExpiry && startDate ? new Date(startDate).toISOString() : null,
      end_date: hasExpiry && endDate ? new Date(endDate).toISOString() : null,
      status: isActive ? "active" : "inactive",
      created_at: voucher?.created_at ?? now,
      updated_at: now,
    };

    onSave(finalVoucher);
    onOpenChange(false);
  };

  const discountBadgeText =
    discountType === "percentage" ? `${discountValue}% OFF` : `Rp ${(discountValue || 0).toLocaleString("id-ID")} OFF`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Tag className="size-5 text-primary" />
              {voucher ? "Edit Voucher" : "Create New Voucher"}
            </DialogTitle>
            <DialogDescription>
              Configure promo discount codes for event tickets and official merchandise.
            </DialogDescription>
          </DialogHeader>

          {/* ── LIVE PREVIEW BANNER ─────────────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4 transition-all">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-foreground text-sm tracking-wide">
                    {code.trim().toUpperCase() || "VOUCHERCODE"}
                  </span>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs">
                    {discountBadgeText}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">{description || "No description provided"}</p>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <Badge variant="secondary" className="text-[11px] capitalize">
                  {(() => {
                    if (appliesTo === "ticket") return "Tickets Only";
                    if (appliesTo === "merchandise") return "Merch Only";
                    return "All Items";
                  })()}
                </Badge>
                {isActive ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]"
                  >
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-muted text-muted-foreground text-[11px]">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* ── VOUCHER CODE & DESCRIPTION ─────────────────────────────────── */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="voucher-code" className="text-xs font-semibold">
                Voucher Code <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="voucher-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. DEVFEST50"
                  className="font-mono uppercase tracking-wider"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateCode}
                  className="shrink-0 gap-1.5 text-xs"
                >
                  <RefreshCw className="size-3.5" />
                  Random
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Letters, numbers, hyphens, and underscores only. Automatically converted to uppercase.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="voucher-description" className="text-xs font-semibold">
                Description / Internal Notes
              </Label>
              <Textarea
                id="voucher-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 50% discount for community scholarship recipients"
                className="h-16 text-xs resize-none"
              />
            </div>
          </div>

          {/* ── DISCOUNT CONFIGURATION (PERCENTAGE OR FIXED) ───────────────── */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <Label className="text-xs font-semibold text-foreground">Discount Value &amp; Type</Label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setDiscountType("percentage");
                  if (discountValue > 100) setDiscountValue(20);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                  discountType === "percentage"
                    ? "border-primary bg-primary/10 text-primary shadow-xs font-medium"
                    : "border-border hover:bg-muted/50 text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md border",
                    discountType === "percentage" ? "border-primary bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  <Percent className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Percentage (%)</div>
                  <div className="text-[10px] text-muted-foreground">e.g. 20% or 100% off</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDiscountType("fixed");
                  if (discountValue <= 100) setDiscountValue(50000);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                  discountType === "fixed"
                    ? "border-primary bg-primary/10 text-primary shadow-xs font-medium"
                    : "border-border hover:bg-muted/50 text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md border",
                    discountType === "fixed" ? "border-primary bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  <Tag className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Fixed Amount (Rp)</div>
                  <div className="text-[10px] text-muted-foreground">e.g. Rp 25.000 off</div>
                </div>
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="discount-value" className="text-xs font-medium">
                {discountType === "percentage" ? "Discount Percentage (%)" : "Discount Amount (IDR)"}
              </Label>
              <div className="relative">
                <Input
                  id="discount-value"
                  type="number"
                  min="1"
                  max={discountType === "percentage" ? "100" : undefined}
                  value={discountValue || ""}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  placeholder={discountType === "percentage" ? "20" : "50000"}
                  className={cn(
                    "text-sm font-semibold",
                    discountType === "fixed" && "pl-9",
                    discountType === "percentage" && "pr-9",
                  )}
                  required
                />
                {discountType === "fixed" && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground text-xs font-semibold">
                    Rp
                  </span>
                )}
                {discountType === "percentage" && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground text-xs font-semibold">
                    %
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {discountType === "percentage"
                  ? "Enter a number from 1 to 100. 100% discount makes the item completely free."
                  : `Equivalent to Rp ${(discountValue || 0).toLocaleString("id-ID")} subtracted from order.`}
              </p>
            </div>
          </div>

          {/* ── APPLIES TO (SCOPE TARGET) ──────────────────────────────────── */}
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <Label className="text-xs font-semibold text-foreground">Discount Scope (Applies To)</Label>
            <RadioGroup
              value={appliesTo}
              onValueChange={(val) => setAppliesTo(val as VoucherAppliesTo)}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1"
            >
              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border p-3 transition-colors cursor-pointer",
                  appliesTo === "all" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                )}
              >
                <RadioGroupItem value="all" id="scope-all" />
                <Label htmlFor="scope-all" className="cursor-pointer text-xs font-medium leading-none">
                  All Items
                  <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">
                    Tickets &amp; Merch
                  </span>
                </Label>
              </div>

              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border p-3 transition-colors cursor-pointer",
                  appliesTo === "ticket" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                )}
              >
                <RadioGroupItem value="ticket" id="scope-ticket" />
                <Label htmlFor="scope-ticket" className="cursor-pointer text-xs font-medium leading-none">
                  Tickets Only
                  <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">Event admission</span>
                </Label>
              </div>

              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border p-3 transition-colors cursor-pointer",
                  appliesTo === "merchandise" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                )}
              >
                <RadioGroupItem value="merchandise" id="scope-merchandise" />
                <Label htmlFor="scope-merchandise" className="cursor-pointer text-xs font-medium leading-none">
                  Merch Only
                  <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">
                    Apparel &amp; perks
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* ── USAGE LIMITS & CONSTRAINTS ─────────────────────────────────── */}
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <Label className="text-xs font-semibold text-foreground">Usage Quota &amp; Restrictions</Label>

            {/* Total usage limit */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium">Limit Total Redemptions</div>
                  <div className="text-[11px] text-muted-foreground">
                    Restrict how many times this voucher can be used
                  </div>
                </div>
                <Switch checked={hasUsageLimit} onCheckedChange={setHasUsageLimit} />
              </div>
              {hasUsageLimit && (
                <div className="pt-1">
                  <Input
                    type="number"
                    min="1"
                    value={usageLimit || ""}
                    onChange={(e) => setUsageLimit(Number(e.target.value))}
                    placeholder="50"
                    className="text-xs h-8"
                  />
                </div>
              )}
            </div>

            {/* Minimum spend */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium">Minimum Spend Requirement</div>
                  <div className="text-[11px] text-muted-foreground">
                    Only applicable if cart meets a minimum IDR spend
                  </div>
                </div>
                <Switch checked={hasMinSpend} onCheckedChange={setHasMinSpend} />
              </div>
              {hasMinSpend && (
                <div className="pt-1">
                  <div className="relative">
                    <Input
                      type="number"
                      min="1000"
                      step="5000"
                      value={minSpend || ""}
                      onChange={(e) => setMinSpend(Number(e.target.value))}
                      placeholder="50000"
                      className="text-xs h-8 pl-8"
                    />
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-semibold">
                      Rp
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Maximum discount cap for percentage vouchers */}
            {discountType === "percentage" && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium">Maximum Discount Cap</div>
                    <div className="text-[11px] text-muted-foreground">
                      Cap maximum savings in IDR for percentage discounts
                    </div>
                  </div>
                  <Switch checked={hasMaxDiscount} onCheckedChange={setHasMaxDiscount} />
                </div>
                {hasMaxDiscount && (
                  <div className="pt-1">
                    <div className="relative">
                      <Input
                        type="number"
                        min="1000"
                        step="5000"
                        value={maxDiscount || ""}
                        onChange={(e) => setMaxDiscount(Number(e.target.value))}
                        placeholder="100000"
                        className="text-xs h-8 pl-8"
                      />
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-semibold">
                        Rp
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Expiry dates */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium">Active Period &amp; Expiration</div>
                  <div className="text-[11px] text-muted-foreground">Set start and expiration dates</div>
                </div>
                <Switch checked={hasExpiry} onCheckedChange={setHasExpiry} />
              </div>
              {hasExpiry && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Valid From</Label>
                    <DatePicker value={startDate} onChange={setStartDate} size="sm" placeholder="Start date" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Valid Until</Label>
                    <DatePicker value={endDate} onChange={setEndDate} size="sm" placeholder="Expiration date" />
                  </div>
                </div>
              )}
            </div>

            {/* Active status */}
            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <div className="text-xs font-medium">Enable Voucher (Active)</div>
                <div className="text-[11px] text-muted-foreground">
                  Allow attendees to redeem this voucher immediately
                </div>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gap-1.5">
              <CheckCircle2 className="size-4" />
              {voucher ? "Update Voucher" : "Create Voucher"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
