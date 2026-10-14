"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  Calendar,
  CalendarX,
  Check,
  CheckCircle2,
  Copy,
  Edit2,
  Filter,
  Info,
  Layers,
  Loader2,
  Package,
  Percent,
  Plus,
  Search,
  Share2,
  Sparkles,
  Tag,
  Ticket,
  TicketPercent,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  createVoucherFromTemplate,
  PRESET_VOUCHER_TEMPLATES,
  type VoucherTemplate,
} from "@/lib/events/voucher-templates";
import { formatVoucherDiscountDisplay } from "@/lib/events/voucher-utils";
import { updateEventReferralConfigAction, updateEventVouchersAction } from "@/lib/firestore/actions";
import type { EventVoucher, FirestoreEvent, VoucherAppliesTo, VoucherStatus } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { VoucherDialog } from "./voucher-dialog";

interface VouchersTabProps {
  event: FirestoreEvent;
}

export function VouchersTab({ event }: VouchersTabProps) {
  const [vouchers, setVouchers] = useState<EventVoucher[]>(event.vouchers ?? []);
  const [editingVoucher, setEditingVoucher] = useState<EventVoucher | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [targetFilter, setTargetFilter] = useState<string>("all");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, startTransition] = useTransition();

  // Event Referral Settings State
  const [referralEnabled, setReferralEnabled] = useState<boolean>(event.referral_enabled !== false);
  const [referralDiscountType, setReferralDiscountType] = useState<"percentage" | "fixed">(
    event.referral_discount_type === "fixed" ? "fixed" : "percentage",
  );
  const [referralDiscountOverride, setReferralDiscountOverride] = useState<string>(
    typeof event.referral_discount_percentage === "number" ? String(event.referral_discount_percentage) : "",
  );
  const [referralDiscountAmount, setReferralDiscountAmount] = useState<string>(
    typeof event.referral_discount_amount === "number" ? String(event.referral_discount_amount) : "",
  );
  const [isSavingReferral, setIsSavingReferral] = useState(false);
  const [isGloballyExcluded, setIsGloballyExcluded] = useState(false);
  const [globalIneligibilityReason, setGlobalIneligibilityReason] = useState<string | null>(null);

  useEffect(() => {
    if (!event.id) return;
    async function checkGlobalReferralStatus() {
      try {
        const { getReferralProgramSettingsAction } = await import("@/lib/firestore/actions");
        const settings = await getReferralProgramSettingsAction();
        if (!settings) return;

        const isExcluded = Boolean(settings.excluded_event_ids?.includes(String(event.id)));
        setIsGloballyExcluded(isExcluded);

        const { isReferralEligibleForEvent } = await import("@/lib/firestore/client");
        const eligibility = isReferralEligibleForEvent(settings, event);
        if (!eligibility.eligible && !isExcluded) {
          setGlobalIneligibilityReason(eligibility.reason ?? null);
        } else {
          setGlobalIneligibilityReason(null);
        }
      } catch (err) {
        console.warn("[VouchersTab] Failed to check global referral settings:", err);
      }
    }
    void checkGlobalReferralStatus();
  }, [event]);

  const handleSaveReferralConfig = async () => {
    setIsSavingReferral(true);
    try {
      const parsedPercentage =
        referralDiscountType === "percentage" && referralDiscountOverride.trim() !== ""
          ? Number(referralDiscountOverride)
          : null;
      const parsedAmount =
        referralDiscountType === "fixed" && referralDiscountAmount.trim() !== ""
          ? Number(referralDiscountAmount)
          : null;
      const res = await updateEventReferralConfigAction(
        String(event.id),
        {
          referral_enabled: referralEnabled,
          referral_discount_type: referralDiscountType,
          referral_discount_percentage: parsedPercentage,
          referral_discount_amount: parsedAmount,
        },
        event,
      );
      if (res.success) {
        toast.success("Event referral settings updated successfully!");
      } else {
        toast.error(res.error || "Failed to update referral settings.");
      }
    } catch {
      toast.error("Failed to update referral settings.");
    } finally {
      setIsSavingReferral(false);
    }
  };

  // Load latest event vouchers from Firestore
  useEffect(() => {
    if (!event.id) return;

    async function loadLatestVouchers() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData?.vouchers && Array.isArray(docData.vouchers)) {
          setVouchers(docData.vouchers);
        }
      } catch (err) {
        console.warn("[VouchersTab] Failed to fetch latest vouchers:", err);
      }
    }

    void loadLatestVouchers();
  }, [event.id]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = vouchers.length;
    const active = vouchers.filter((v) => v.status === "active").length;
    const totalRedeemed = vouchers.reduce((sum, v) => sum + (v.times_used || 0), 0);
    const ticketVouchers = vouchers.filter((v) => v.applies_to === "ticket" || v.applies_to === "all").length;
    const merchVouchers = vouchers.filter((v) => v.applies_to === "merchandise" || v.applies_to === "all").length;

    return { total, active, totalRedeemed, ticketVouchers, merchVouchers };
  }, [vouchers]);

  // Filtered List
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = v.code.toLowerCase().includes(q);
        const matchesDesc = (v.description || "").toLowerCase().includes(q);
        if (!matchesCode && !matchesDesc) return false;
      }

      if (statusFilter !== "all" && v.status !== statusFilter) {
        return false;
      }

      if (targetFilter !== "all" && v.applies_to !== targetFilter) {
        return false;
      }

      return true;
    });
  }, [vouchers, searchQuery, statusFilter, targetFilter]);

  const handleCreateNew = () => {
    setEditingVoucher(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (v: EventVoucher) => {
    setEditingVoucher(v);
    setIsDialogOpen(true);
  };

  const handleDuplicate = (v: EventVoucher) => {
    const cloned: EventVoucher = {
      ...v,
      id: `voucher-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code: `${v.code}_COPY`.slice(0, 20),
      times_used: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setVouchers((prev) => [...prev, cloned]);
    setIsDirty(true);
    toast.success(`Duplicated "${v.code}" as "${cloned.code}"`);
  };

  const handleDelete = (id: string, code: string) => {
    setVouchers((prev) => prev.filter((v) => v.id !== id));
    setIsDirty(true);
    toast.success(`Removed voucher "${code}".`);
  };

  const handleToggleStatus = (id: string, currentStatus: VoucherStatus) => {
    const nextStatus: VoucherStatus = currentStatus === "active" ? "inactive" : "active";
    setVouchers((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: nextStatus, updated_at: new Date().toISOString() } : v)),
    );
    setIsDirty(true);
    toast.info(`Voucher status updated to ${nextStatus}. Remember to save changes.`);
  };

  const handleApplyTemplate = (template: VoucherTemplate) => {
    const newVoucher = createVoucherFromTemplate(template);
    setVouchers((prev) => [...prev, newVoucher]);
    setIsDirty(true);
    toast.success(`Added voucher from template: ${template.name}`);
  };

  const handleSaveVoucher = (savedVoucher: EventVoucher) => {
    setVouchers((prev) => {
      const idx = prev.findIndex((v) => v.id === savedVoucher.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedVoucher;
        return next;
      }
      return [...prev, savedVoucher];
    });
    setIsDirty(true);
    toast.success(editingVoucher ? `Updated voucher "${savedVoucher.code}"` : `Created voucher "${savedVoucher.code}"`);
  };

  const handleCopyCode = (code: string) => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(code);
      toast.success(`Copied code "${code}" to clipboard!`);
    }
  };

  const handleSaveToFirestore = () => {
    startTransition(async () => {
      try {
        const res = await updateEventVouchersAction(String(event.id), vouchers, event);
        if (res.success) {
          setIsDirty(false);
          toast.success("Vouchers saved successfully!");
        } else {
          toast.error(res.error || "Failed to save vouchers.");
        }
      } catch (err) {
        toast.error("Failed to save vouchers to database.");
        console.error(err);
      }
    });
  };

  const handleReset = () => {
    setVouchers(event.vouchers ?? []);
    setIsDirty(false);
    toast.info("Reverted unsaved voucher changes.");
  };

  return (
    <div className="space-y-6">
      {/* ── KPI METRIC CARDS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Tag className="size-3.5 text-primary" />
              Total Vouchers
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{metrics.total}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-[11px] text-muted-foreground">{metrics.active} active vouchers</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Active Codes
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.active}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-[11px] text-muted-foreground">Ready for redemption</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Users className="size-3.5 text-blue-500" />
              Total Redemptions
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {metrics.totalRedeemed}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-[11px] text-muted-foreground">Used across registrations</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Layers className="size-3.5 text-purple-500" />
              Coverage
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {metrics.ticketVouchers} / {metrics.merchVouchers}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-[11px] text-muted-foreground">Tickets / Merch eligible</p>
          </CardContent>
        </Card>
      </div>

      {/* ── EVENT REFERRAL DISCOUNT SETTINGS ───────────────────────────── */}
      <Card className="border-border/60 bg-gradient-to-r from-card to-muted/20 shadow-xs">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Share2 className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Event Referral Program</CardTitle>
                <CardDescription className="text-xs">
                  Configure whether attendee referral codes can be applied for tickets to this event and customize the
                  discount rate.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id="referral-enabled-toggle" checked={referralEnabled} onCheckedChange={setReferralEnabled} />
                <label htmlFor="referral-enabled-toggle" className="cursor-pointer text-xs font-medium text-foreground">
                  {referralEnabled ? "Enabled" : "Disabled"}
                </label>
              </div>
            </div>
          </div>
        </CardHeader>

        {isGloballyExcluded ? (
          <div className="mx-4 mb-2 flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            <CalendarX className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <span className="font-semibold">Globally Excluded: </span>
              This event is in the chapter-wide Referral Excluded Events list. Attendees are prevented from redeeming
              referral codes for this event.
            </div>
          </div>
        ) : globalIneligibilityReason ? (
          <div className="mx-4 mb-2 flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0 text-primary" />
            <div className="flex-1">
              <span className="font-semibold text-foreground">Global Condition Notice: </span>
              {globalIneligibilityReason} Attendees will not see the referral code input during registration.
            </div>
          </div>
        ) : null}

        <CardContent className="flex flex-col gap-4 p-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {/* Segmented selector for Discount Type */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">Discount Type:</span>
              <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
                <button
                  type="button"
                  disabled={!referralEnabled}
                  onClick={() => setReferralDiscountType("percentage")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-50",
                    referralDiscountType === "percentage"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Percent className="size-3" />
                  Percentage (%)
                </button>
                <button
                  type="button"
                  disabled={!referralEnabled}
                  onClick={() => setReferralDiscountType("fixed")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-50",
                    referralDiscountType === "fixed"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Tag className="size-3" />
                  Fixed Amount (Rp)
                </button>
              </div>
            </div>

            {/* Input field based on selected discount type */}
            {referralDiscountType === "percentage" ? (
              <div className="w-full max-w-[200px]">
                <label
                  htmlFor="event-referral-discount-input"
                  className="text-[11px] font-medium text-muted-foreground block mb-1"
                >
                  Discount Percentage (%):
                </label>
                <div className="relative">
                  <Input
                    id="event-referral-discount-input"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Global default"
                    value={referralDiscountOverride}
                    onChange={(e) => setReferralDiscountOverride(e.target.value)}
                    disabled={!referralEnabled}
                    className="h-8 text-xs pr-7 font-mono"
                  />
                  <Percent className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            ) : (
              <div className="w-full max-w-[200px]">
                <label
                  htmlFor="event-referral-fixed-input"
                  className="text-[11px] font-medium text-muted-foreground block mb-1"
                >
                  Fixed Discount (Rp):
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    id="event-referral-fixed-input"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Global default"
                    value={referralDiscountAmount}
                    onChange={(e) => setReferralDiscountAmount(e.target.value)}
                    disabled={!referralEnabled}
                    className="h-8 text-xs pl-8 font-mono"
                  />
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground sm:pt-4 max-w-sm">
              {referralDiscountType === "percentage"
                ? referralDiscountOverride.trim() !== ""
                  ? `Overrides the global default with a fixed ${referralDiscountOverride}% ticket discount for this event.`
                  : "No override set — uses the global referral program discount rate (configured in Referrals settings)."
                : referralDiscountAmount.trim() !== ""
                  ? `Overrides the global default with a fixed Rp ${Number(referralDiscountAmount).toLocaleString("id-ID")} ticket discount for this event.`
                  : "No override set — uses the global referral program discount amount (configured in Referrals settings)."}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSaveReferralConfig}
            disabled={isSavingReferral}
            className="h-8 self-end sm:self-center text-xs shrink-0"
          >
            {isSavingReferral && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Save Referral Settings
          </Button>
        </CardContent>
      </Card>

      {/* ── TOOLBAR & ACTIONS ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code or description..."
              className="h-9 pl-8 text-xs"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[120px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={targetFilter} onValueChange={setTargetFilter}>
            <SelectTrigger className="h-9 w-[130px] text-xs">
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Targets</SelectItem>
              <SelectItem value="ticket">Tickets Only</SelectItem>
              <SelectItem value="merchandise">Merch Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Preset Templates */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                <Sparkles className="size-3.5 text-amber-500" />
                Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs">Pre-built Voucher Templates</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PRESET_VOUCHER_TEMPLATES.map((tpl) => (
                <DropdownMenuItem
                  key={tpl.id}
                  onClick={() => handleApplyTemplate(tpl)}
                  className="flex flex-col items-start gap-0.5 py-2 text-xs cursor-pointer"
                >
                  <span className="font-semibold text-foreground">{tpl.name}</span>
                  <span className="text-[11px] text-muted-foreground line-clamp-1">{tpl.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={handleCreateNew} size="sm" className="h-9 gap-1.5 text-xs">
            <Plus className="size-4" />
            Add Voucher
          </Button>
        </div>
      </div>

      {/* ── VOUCHERS LIST ────────────────────────────────────────────────── */}
      {filteredVouchers.length === 0 ? (
        <Card className="border-dashed p-8 text-center shadow-xs">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TicketPercent className="size-6" />
          </div>
          <h3 className="mt-4 font-semibold text-foreground text-sm">No vouchers found</h3>
          <p className="mt-1 text-muted-foreground text-xs max-w-sm mx-auto">
            {vouchers.length === 0
              ? "Create promo codes to give community discounts on event tickets and official merchandise."
              : "No vouchers match your search and filter criteria."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button onClick={handleCreateNew} size="sm" className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Create First Voucher
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVouchers.map((v) => {
            const isPercentage = v.discount_type === "percentage";
            const discountDisplay = formatVoucherDiscountDisplay(v);
            const usagePercent =
              v.usage_limit && v.usage_limit > 0
                ? Math.min(100, Math.round(((v.times_used || 0) / v.usage_limit) * 100))
                : null;

            return (
              <Card
                key={v.id}
                className={cn(
                  "relative flex flex-col justify-between overflow-hidden transition-all duration-200 shadow-xs",
                  v.status === "inactive" && "opacity-75 bg-muted/20 border-dashed",
                )}
              >
                <CardHeader className="p-4 pb-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground text-sm tracking-wider">{v.code}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyCode(v.code)}
                          className="size-6 text-muted-foreground hover:text-foreground"
                          title="Copy voucher code"
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-semibold text-xs",
                            isPercentage
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                          )}
                        >
                          {discountDisplay}
                        </Badge>

                        <Badge variant="secondary" className="text-[11px] capitalize">
                          {v.applies_to === "all" ? (
                            "All Items"
                          ) : v.applies_to === "ticket" ? (
                            <span className="flex items-center gap-1">
                              <Ticket className="size-2.5" /> Tickets
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Package className="size-2.5" /> Merch
                            </span>
                          )}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Switch
                        checked={v.status === "active"}
                        onCheckedChange={() => handleToggleStatus(v.id, v.status)}
                        aria-label={`Toggle active state for ${v.code}`}
                        className="scale-90"
                      />

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <span className="sr-only">Open menu</span>
                            <span className="font-bold">•••</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(v)} className="gap-2 text-xs">
                            <Edit2 className="size-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(v)} className="gap-2 text-xs">
                            <Copy className="size-3.5" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(v.id, v.code)}
                            className="gap-2 text-xs text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {v.description && (
                    <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed">{v.description}</p>
                  )}
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-3">
                  {/* Quota & Redemptions Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                      <span>Redemptions</span>
                      <span className="font-mono">
                        {v.times_used || 0}
                        {v.usage_limit ? ` / ${v.usage_limit}` : " used"}
                      </span>
                    </div>
                    {usagePercent !== null && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            usagePercent >= 100 ? "bg-destructive" : usagePercent >= 80 ? "bg-amber-500" : "bg-primary",
                          )}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Conditions Pills */}
                  <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    {v.min_spend && v.min_spend > 0 && (
                      <span className="rounded bg-muted px-1.5 py-0.5">
                        Min. Rp {v.min_spend.toLocaleString("id-ID")}
                      </span>
                    )}
                    {v.max_discount && v.max_discount > 0 && (
                      <span className="rounded bg-muted px-1.5 py-0.5">
                        Max. Rp {v.max_discount.toLocaleString("id-ID")}
                      </span>
                    )}
                    {v.end_date && (
                      <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                        <Calendar className="size-2.5" />
                        Expires {new Date(v.end_date).toLocaleDateString("id-ID")}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT VOUCHER DIALOG ─────────────────────────────────── */}
      <VoucherDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        voucher={editingVoucher}
        onSave={handleSaveVoucher}
      />

      {/* ── FLOATING SAVE BAR ────────────────────────────────────────────── */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSaveToFirestore}
        onDiscard={handleReset}
        saveLabel="Save Vouchers"
      />
    </div>
  );
}
