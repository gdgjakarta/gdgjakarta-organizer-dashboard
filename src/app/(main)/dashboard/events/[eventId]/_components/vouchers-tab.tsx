"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  Calendar,
  CalendarX,
  CheckCircle2,
  Copy,
  Edit2,
  Eye,
  Gift,
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
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Shimmer } from "@/components/shimmer";
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
import { generateBundleFriendVouchers } from "@/lib/events/bundle-voucher-generator";
import {
  createVoucherFromTemplate,
  PRESET_VOUCHER_TEMPLATES,
  type VoucherTemplate,
} from "@/lib/events/voucher-templates";
import { formatVoucherDiscountDisplay } from "@/lib/events/voucher-utils";
import { updateEventReferralConfigAction, updateEventVouchersAction } from "@/lib/firestore/actions";
import type {
  BundleIssuedVoucher,
  EventVoucher,
  FirestoreEvent,
  FirestoreRegistration,
  VoucherStatus,
} from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { VoucherDialog } from "./voucher-dialog";
import { VoucherRedemptionsDialog } from "./voucher-redemptions-dialog";

const VOUCHER_SKELETON_KEYS = [
  "voucher-skeleton-1",
  "voucher-skeleton-2",
  "voucher-skeleton-3",
  "voucher-skeleton-4",
  "voucher-skeleton-5",
  "voucher-skeleton-6",
];

interface VouchersTabProps {
  event: FirestoreEvent;
  registrations?: FirestoreRegistration[];
}

export function VouchersTab({ event, registrations: initialRegistrations }: VouchersTabProps) {
  const [vouchers, setVouchers] = useState<EventVoucher[]>(event.vouchers ?? []);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState<boolean>(
    () => !event.vouchers || event.vouchers.length === 0,
  );
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>(initialRegistrations ?? []);
  const [editingVoucher, setEditingVoucher] = useState<EventVoucher | null>(null);
  const [viewingRedemptionsVoucher, setViewingRedemptionsVoucher] = useState<EventVoucher | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRedemptionsDialogOpen, setIsRedemptionsDialogOpen] = useState(false);
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

  // Load latest event vouchers from secure private collection
  useEffect(() => {
    if (!event.id) return;

    async function loadLatestVouchers() {
      try {
        const { getEventVouchers } = await import("@/lib/firestore/client");
        const list = await getEventVouchers(String(event.id));
        if (list && list.length > 0) {
          setVouchers(list);
        }
      } catch (err) {
        console.warn("[VouchersTab] Failed to fetch latest vouchers:", err);
      } finally {
        setIsLoadingVouchers(false);
      }
    }

    void loadLatestVouchers();
  }, [event.id]);

  // Sync prop registrations when changed
  useEffect(() => {
    if (initialRegistrations && initialRegistrations.length > 0) {
      setRegistrations(initialRegistrations);
    }
  }, [initialRegistrations]);

  // Subscribe to live registrations for real-time voucher redemptions
  useEffect(() => {
    if (!event.id) return;
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    async function setupRegistrations() {
      try {
        const { getEventRegistrations, subscribeEventRegistrations } = await import("@/lib/firestore/client");
        const list = await getEventRegistrations(String(event.id));
        if (isMounted) {
          setRegistrations(list);
        }

        unsubscribe = subscribeEventRegistrations(String(event.id), (updatedList) => {
          if (isMounted) {
            setRegistrations(updatedList);
          }
        });
      } catch (err) {
        console.warn("[VouchersTab] Failed to fetch or subscribe to registrations:", err);
      }
    }

    void setupRegistrations();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [event.id]);

  const syncedCodesRef = useRef<Set<string>>(new Set());

  // Merge stored event_vouchers with bundle_vouchers issued on registrations
  const allVouchers = useMemo(() => {
    const byCode = new Map<string, EventVoucher>();
    for (const v of vouchers) {
      if (!v.code) continue;
      byCode.set(v.code.trim().toUpperCase(), v);
    }

    const terminalStatuses = new Set(["canceled", "cancelled", "rejected", "refunded", "expired", "failed"]);

    for (const reg of registrations) {
      if (terminalStatuses.has((reg.status || "").toLowerCase())) continue;
      if (!Array.isArray(reg.bundle_vouchers) || reg.bundle_vouchers.length === 0) continue;

      const bundlePkg = event.bundles?.find((b) => b.id === reg.bundle_id || b.name === reg.bundle_name);
      const bundleLabel = reg.bundle_name || bundlePkg?.name || "Ticket Bundle";

      for (const bv of reg.bundle_vouchers) {
        if (!bv.code) continue;
        const cleanCode = bv.code.trim().toUpperCase();
        const existing = byCode.get(cleanCode);

        if (existing) {
          byCode.set(cleanCode, {
            ...existing,
            source_bundle_id: existing.source_bundle_id ?? reg.bundle_id ?? bundlePkg?.id,
            source_registration_id: existing.source_registration_id ?? reg.id,
            purchaser_member_id: existing.purchaser_member_id ?? reg.member_id,
            purchaser_name: existing.purchaser_name ?? reg.member_name,
            purchaser_email: existing.purchaser_email ?? reg.member_email,
            redeemed_by_member_id: existing.redeemed_by_member_id ?? bv.redeemed_by_member_id,
            redeemed_by_name: existing.redeemed_by_name ?? bv.redeemed_by_name,
            redeemed_by_email: existing.redeemed_by_email ?? bv.redeemed_by_email,
            redeemed_at: existing.redeemed_at ?? bv.redeemed_at,
            times_used: Math.max(existing.times_used ?? 0, bv.status === "redeemed" ? 1 : 0),
          });
        } else {
          byCode.set(cleanCode, {
            id: bv.voucher_id || `bndl-vch-${reg.id}-${cleanCode}`,
            code: cleanCode,
            description: `100% Ticket Pass sponsored by ${reg.member_name || "Bundle Purchaser"} (${bundleLabel})`,
            discount_type: "percentage",
            discount_value: 100,
            applies_to: "ticket",
            usage_limit: 1,
            times_used: bv.status === "redeemed" ? 1 : 0,
            min_spend: null,
            max_discount: null,
            start_date: reg.registered_at ?? null,
            end_date: bundlePkg?.sales_end_date ?? event.start_date ?? null,
            status: "active",
            source_bundle_id: reg.bundle_id ?? bundlePkg?.id ?? "bundle",
            source_registration_id: reg.id,
            purchaser_member_id: reg.member_id,
            purchaser_name: reg.member_name,
            purchaser_email: reg.member_email,
            redeemed_by_member_id: bv.redeemed_by_member_id,
            redeemed_by_name: bv.redeemed_by_name,
            redeemed_by_email: bv.redeemed_by_email,
            redeemed_at: bv.redeemed_at,
            created_at: reg.registered_at ?? new Date().toISOString(),
            updated_at: bv.redeemed_at ?? reg.registered_at ?? new Date().toISOString(),
          });
        }
      }
    }

    return Array.from(byCode.values());
  }, [vouchers, registrations, event.bundles, event.start_date]);

  // Auto-sync missing bundle vouchers from registrations (and backfill multi-ticket bundle registrations missing bundle_vouchers)
  useEffect(() => {
    if (!event.id || registrations.length === 0) return;

    const existingStoredCodes = new Set(vouchers.map((v) => v.code.trim().toUpperCase()));
    const existingRegIdsWithVouchers = new Set(
      vouchers.map((v) => v.source_registration_id).filter((id): id is string => Boolean(id)),
    );
    const terminalStatuses = new Set(["canceled", "cancelled", "rejected", "refunded", "expired", "failed"]);

    const toSyncVouchers: EventVoucher[] = [];
    const toUpdateRegistrations: Array<{ registrationId: string; bundleVouchers: BundleIssuedVoucher[] }> = [];

    for (const reg of registrations) {
      if (terminalStatuses.has((reg.status || "").toLowerCase())) continue;

      if (Array.isArray(reg.bundle_vouchers) && reg.bundle_vouchers.length > 0) {
        const bundlePkg = event.bundles?.find((b) => b.id === reg.bundle_id || b.name === reg.bundle_name);
        const bundleLabel = reg.bundle_name || bundlePkg?.name || "Ticket Bundle";

        for (const bv of reg.bundle_vouchers) {
          if (!bv.code) continue;
          const cleanCode = bv.code.trim().toUpperCase();
          if (!existingStoredCodes.has(cleanCode) && !syncedCodesRef.current.has(cleanCode)) {
            syncedCodesRef.current.add(cleanCode);
            toSyncVouchers.push({
              id: bv.voucher_id || `bndl-vch-${reg.id}-${cleanCode}`,
              code: cleanCode,
              description: `100% Ticket Pass sponsored by ${reg.member_name || "Bundle Purchaser"} (${bundleLabel})`,
              discount_type: "percentage",
              discount_value: 100,
              applies_to: "ticket",
              usage_limit: 1,
              times_used: bv.status === "redeemed" ? 1 : 0,
              min_spend: null,
              max_discount: null,
              start_date: reg.registered_at ?? null,
              end_date: bundlePkg?.sales_end_date ?? event.start_date ?? null,
              status: "active",
              source_bundle_id: reg.bundle_id ?? bundlePkg?.id ?? "bundle",
              source_registration_id: reg.id,
              purchaser_member_id: reg.member_id,
              purchaser_name: reg.member_name,
              purchaser_email: reg.member_email,
              redeemed_by_member_id: bv.redeemed_by_member_id,
              redeemed_by_name: bv.redeemed_by_name,
              redeemed_by_email: bv.redeemed_by_email,
              redeemed_at: bv.redeemed_at,
              created_at: reg.registered_at ?? new Date().toISOString(),
              updated_at: bv.redeemed_at ?? reg.registered_at ?? new Date().toISOString(),
            });
          }
        }
      } else if (
        (reg.bundle_id || reg.bundle_name) &&
        !existingRegIdsWithVouchers.has(reg.id) &&
        !syncedCodesRef.current.has(`reg_${reg.id}`)
      ) {
        const matchingBundle = event.bundles?.find(
          (b) =>
            (reg.bundle_id && b.id === reg.bundle_id) ||
            (reg.bundle_name && b.name.toLowerCase() === reg.bundle_name.toLowerCase()),
        );
        if (matchingBundle && (matchingBundle.ticket_quantity ?? 1) > 1 && matchingBundle.generate_vouchers !== false) {
          syncedCodesRef.current.add(`reg_${reg.id}`);
          const matchingTicketTier = event.tickets?.find((t) => t.id === matchingBundle.ticket_id);
          const generated = generateBundleFriendVouchers({
            bundle: matchingBundle,
            buyerRegistrationId: reg.id,
            buyerMemberId: reg.member_id,
            buyerName: reg.member_name || "Bundle Purchaser",
            buyerEmail: reg.member_email,
            ticketTier: matchingTicketTier,
            eventStartDate: event.start_date,
          });
          if (generated.newEventVouchers.length > 0) {
            for (const fv of generated.newEventVouchers) {
              syncedCodesRef.current.add(fv.code.trim().toUpperCase());
              toSyncVouchers.push(fv);
            }
            toUpdateRegistrations.push({
              registrationId: reg.id,
              bundleVouchers: generated.registrationVouchers,
            });
          }
        }
      }
    }

    if (toSyncVouchers.length > 0 || toUpdateRegistrations.length > 0) {
      void (async () => {
        try {
          const { syncMissingBundleVouchers } = await import("@/lib/firestore/client");
          await syncMissingBundleVouchers(String(event.id), toSyncVouchers, toUpdateRegistrations);
        } catch (err) {
          console.warn("[VouchersTab] Background bundle voucher sync error:", err);
        }
      })();
    }
  }, [event.id, event.bundles, event.tickets, event.start_date, registrations, vouchers]);

  // Matched registrations per voucher ID
  const redeemedRegistrationsMap = useMemo(() => {
    const map = new Map<string, FirestoreRegistration[]>();

    for (const v of allVouchers) {
      const normCode = v.code.trim().toUpperCase();
      const matched = registrations.filter((reg) => {
        const regCode = reg.voucher_code ? reg.voucher_code.trim().toUpperCase() : "";
        const matchesCode = regCode.length > 0 && regCode === normCode;
        const matchesId = Boolean(reg.voucher_id && reg.voucher_id === v.id);
        return matchesCode || matchesId;
      });
      map.set(v.id, matched);
    }

    return map;
  }, [allVouchers, registrations]);

  // Dynamic redemptions count mapped per voucher, aligned with VoucherRedemptionsDialog
  const redemptionsCountMap = useMemo(() => {
    const map = new Map<string, number>();

    for (const v of allVouchers) {
      const matched = redeemedRegistrationsMap.get(v.id) ?? [];
      let count = matched.length;
      // Fallback: If no registrations matched but the voucher document has direct redemption metadata
      if (count === 0 && (v.redeemed_by_name || v.redeemed_by_email)) {
        count = 1;
      }

      // Best effort: take the maximum between live registrations count and stored times_used
      map.set(v.id, Math.max(count, v.times_used || 0));
    }

    return map;
  }, [allVouchers, redeemedRegistrationsMap]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = allVouchers.length;
    const active = allVouchers.filter((v) => v.status === "active").length;
    const totalRedeemed = allVouchers.reduce((sum, v) => sum + (redemptionsCountMap.get(v.id) ?? v.times_used ?? 0), 0);
    const ticketVouchers = allVouchers.filter((v) => v.applies_to === "ticket" || v.applies_to === "all").length;
    const merchVouchers = allVouchers.filter((v) => v.applies_to === "merchandise" || v.applies_to === "all").length;
    const bundleVouchersCount = allVouchers.filter((v) =>
      Boolean(v.source_bundle_id || v.purchaser_name || v.code.toUpperCase().startsWith("BNDL-")),
    ).length;

    return { total, active, totalRedeemed, ticketVouchers, merchVouchers, bundleVouchersCount };
  }, [allVouchers, redemptionsCountMap]);

  // Filtered List
  const filteredVouchers = useMemo(() => {
    return allVouchers.filter((v) => {
      const isBundleVoucher = Boolean(
        v.source_bundle_id || v.purchaser_name || v.code.toUpperCase().startsWith("BNDL-"),
      );

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = v.code.toLowerCase().includes(q);
        const matchesDesc = (v.description || "").toLowerCase().includes(q);
        const matchesPurchaser =
          (v.purchaser_name || "").toLowerCase().includes(q) || (v.purchaser_email || "").toLowerCase().includes(q);
        const matchesRedeemer =
          (v.redeemed_by_name || "").toLowerCase().includes(q) ||
          (v.redeemed_by_email || "").toLowerCase().includes(q) ||
          (redeemedRegistrationsMap.get(v.id) ?? []).some(
            (r) => (r.member_name || "").toLowerCase().includes(q) || (r.member_email || "").toLowerCase().includes(q),
          );
        if (!matchesCode && !matchesDesc && !matchesPurchaser && !matchesRedeemer) return false;
      }

      if (statusFilter !== "all" && v.status !== statusFilter) {
        return false;
      }

      if (targetFilter === "bundle") {
        if (!isBundleVoucher) return false;
      } else if (targetFilter === "promo") {
        if (isBundleVoucher) return false;
      } else if (targetFilter !== "all" && v.applies_to !== targetFilter) {
        return false;
      }

      return true;
    });
  }, [allVouchers, redeemedRegistrationsMap, searchQuery, statusFilter, targetFilter]);

  const handleCreateNew = () => {
    setEditingVoucher(null);
    setIsDialogOpen(true);
  };

  const handleViewRedemptions = (v: EventVoucher) => {
    setViewingRedemptionsVoucher(v);
    setIsRedemptionsDialogOpen(true);
  };

  const handleEdit = (v: EventVoucher) => {
    const liveCount = redemptionsCountMap.get(v.id) ?? v.times_used ?? 0;
    setEditingVoucher({
      ...v,
      times_used: Math.max(liveCount, v.times_used ?? 0),
    });
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
    setVouchers((prev) => prev.filter((v) => v.id !== id && v.code.toUpperCase() !== code.toUpperCase()));
    setIsDirty(true);
    toast.success(`Removed voucher "${code}".`);
  };

  const handleToggleStatus = (id: string, currentStatus: VoucherStatus) => {
    const nextStatus: VoucherStatus = currentStatus === "active" ? "inactive" : "active";
    setVouchers((prev) => {
      const exists = prev.some((v) => v.id === id);
      if (exists) {
        return prev.map((v) => (v.id === id ? { ...v, status: nextStatus, updated_at: new Date().toISOString() } : v));
      }
      const target = allVouchers.find((v) => v.id === id);
      if (target) {
        return [...prev, { ...target, status: nextStatus, updated_at: new Date().toISOString() }];
      }
      return prev;
    });
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
      const idx = prev.findIndex(
        (v) => v.id === savedVoucher.id || v.code.toUpperCase() === savedVoucher.code.toUpperCase(),
      );
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
        const syncedVouchers = allVouchers.map((v) => {
          const liveCount = redemptionsCountMap.get(v.id) ?? v.times_used ?? 0;
          return {
            ...v,
            times_used: Math.max(liveCount, v.times_used ?? 0),
          };
        });

        const res = await updateEventVouchersAction(String(event.id), syncedVouchers, event);
        if (res.success) {
          setVouchers(syncedVouchers);
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

  const handleReset = async () => {
    try {
      const { getEventVouchers } = await import("@/lib/firestore/client");
      const list = await getEventVouchers(String(event.id));
      if (list && list.length > 0) {
        setVouchers(list);
      } else {
        setVouchers(event.vouchers ?? []);
      }
    } catch {
      setVouchers(event.vouchers ?? []);
    }
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
            {isLoadingVouchers ? (
              <Shimmer className="my-1 h-8 w-16" />
            ) : (
              <CardTitle className="font-bold text-2xl">{metrics.total}</CardTitle>
            )}
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-4">
            {isLoadingVouchers ? (
              <Shimmer className="h-3.5 w-24" />
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {metrics.active} active
                {metrics.bundleVouchersCount > 0 ? ` • ${metrics.bundleVouchersCount} bundle` : ""}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Active Codes
            </CardDescription>
            {isLoadingVouchers ? (
              <Shimmer className="my-1 h-8 w-16" />
            ) : (
              <CardTitle className="font-bold text-2xl text-emerald-600 dark:text-emerald-400">
                {metrics.active}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-4">
            {isLoadingVouchers ? (
              <Shimmer className="h-3.5 w-28" />
            ) : (
              <p className="text-[11px] text-muted-foreground">Ready for redemption</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Users className="size-3.5 text-blue-500" />
              Total Redemptions
            </CardDescription>
            {isLoadingVouchers ? (
              <Shimmer className="my-1 h-8 w-16" />
            ) : (
              <CardTitle className="font-bold text-2xl text-blue-600 dark:text-blue-400">
                {metrics.totalRedeemed}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-4">
            {isLoadingVouchers ? (
              <Shimmer className="h-3.5 w-32" />
            ) : (
              <p className="text-[11px] text-muted-foreground">Used across registrations</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Layers className="size-3.5 text-purple-500" />
              Coverage
            </CardDescription>
            {isLoadingVouchers ? (
              <Shimmer className="my-1 h-8 w-20" />
            ) : (
              <CardTitle className="font-bold text-2xl text-foreground">
                {metrics.ticketVouchers} / {metrics.merchVouchers}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-4">
            {isLoadingVouchers ? (
              <Shimmer className="h-3.5 w-28" />
            ) : (
              <p className="text-[11px] text-muted-foreground">Tickets / Merch eligible</p>
            )}
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
                <CardTitle className="font-semibold text-sm">Event Referral Program</CardTitle>
                <CardDescription className="text-xs">
                  Configure whether attendee referral codes can be applied for tickets to this event and customize the
                  discount rate.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id="referral-enabled-toggle" checked={referralEnabled} onCheckedChange={setReferralEnabled} />
                <label htmlFor="referral-enabled-toggle" className="cursor-pointer font-medium text-foreground text-xs">
                  {referralEnabled ? "Enabled" : "Disabled"}
                </label>
              </div>
            </div>
          </div>
        </CardHeader>

        {isGloballyExcluded ? (
          <div className="mx-4 mb-2 flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-800 text-xs dark:text-amber-300">
            <CalendarX className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <span className="font-semibold">Globally Excluded: </span>
              This event is in the chapter-wide Referral Excluded Events list. Attendees are prevented from redeeming
              referral codes for this event.
            </div>
          </div>
        ) : globalIneligibilityReason ? (
          <div className="mx-4 mb-2 flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 p-2.5 text-muted-foreground text-xs">
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
              <span className="font-medium text-[11px] text-muted-foreground">Discount Type:</span>
              <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
                <button
                  type="button"
                  disabled={!referralEnabled}
                  onClick={() => setReferralDiscountType("percentage")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-xs transition-all disabled:opacity-50",
                    referralDiscountType === "percentage"
                      ? "bg-background font-semibold text-foreground shadow-xs"
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
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-xs transition-all disabled:opacity-50",
                    referralDiscountType === "fixed"
                      ? "bg-background font-semibold text-foreground shadow-xs"
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
                  className="mb-1 block font-medium text-[11px] text-muted-foreground"
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
                    className="h-8 pr-7 font-mono text-xs"
                  />
                  <Percent className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div className="w-full max-w-[200px]">
                <label
                  htmlFor="event-referral-fixed-input"
                  className="mb-1 block font-medium text-[11px] text-muted-foreground"
                >
                  Fixed Discount (Rp):
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 font-medium text-muted-foreground text-xs">
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
                    className="h-8 pl-8 font-mono text-xs"
                  />
                </div>
              </div>
            )}

            <p className="max-w-sm text-[11px] text-muted-foreground sm:pt-4">
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
            className="h-8 shrink-0 self-end text-xs sm:self-center"
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
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, buyer, or redeemer..."
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
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Targets</SelectItem>
              <SelectItem value="bundle">Bundle Vouchers</SelectItem>
              <SelectItem value="promo">Promo Vouchers</SelectItem>
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
                  className="flex cursor-pointer flex-col items-start gap-0.5 py-2 text-xs"
                >
                  <span className="font-semibold text-foreground">{tpl.name}</span>
                  <span className="line-clamp-1 text-[11px] text-muted-foreground">{tpl.description}</span>
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
      {isLoadingVouchers && vouchers.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VOUCHER_SKELETON_KEYS.map((key) => (
            <Card key={key} className="flex flex-col justify-between overflow-hidden shadow-xs">
              <CardHeader className="space-y-3 p-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5">
                    <Shimmer className="h-5 w-28" />
                    <div className="flex gap-1.5 pt-0.5">
                      <Shimmer className="h-5 w-16 rounded-full" />
                      <Shimmer className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                  <Shimmer className="size-6 rounded-md" />
                </div>
                <div className="space-y-1 pt-1">
                  <Shimmer className="h-3.5 w-full" />
                  <Shimmer className="h-3.5 w-3/4" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Shimmer className="h-3 w-14" />
                    <Shimmer className="h-3 w-10" />
                  </div>
                  <Shimmer className="h-1.5 w-full rounded-full" />
                </div>
                <div className="flex items-center justify-between border-t border-border/40 pt-3">
                  <Shimmer className="h-3 w-28" />
                  <div className="flex gap-1">
                    <Shimmer className="size-7 rounded-md" />
                    <Shimmer className="size-7 rounded-md" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredVouchers.length === 0 ? (
        <Card className="border-dashed p-8 text-center shadow-xs">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TicketPercent className="size-6" />
          </div>
          <h3 className="mt-4 font-semibold text-foreground text-sm">No vouchers found</h3>
          <p className="mx-auto mt-1 max-w-sm text-muted-foreground text-xs">
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
            const actualRedeemed = redemptionsCountMap.get(v.id) ?? v.times_used ?? 0;
            const matchedRedemptions = redeemedRegistrationsMap.get(v.id) ?? [];
            const isBundleVoucher = Boolean(
              v.source_bundle_id || v.purchaser_name || v.code.toUpperCase().startsWith("BNDL-"),
            );
            const primaryRedeemer = matchedRedemptions[0];
            const redeemerName = primaryRedeemer?.member_name || v.redeemed_by_name;
            const redeemerEmail = primaryRedeemer?.member_email || v.redeemed_by_email;
            const redeemedAt = primaryRedeemer?.registered_at || v.redeemed_at;
            const usagePercent =
              v.usage_limit && v.usage_limit > 0
                ? Math.min(100, Math.round((actualRedeemed / v.usage_limit) * 100))
                : null;

            return (
              <Card
                key={v.id}
                className={cn(
                  "relative flex flex-col justify-between overflow-hidden shadow-xs transition-all duration-200",
                  v.status === "inactive" && "border-dashed bg-muted/20 opacity-75",
                  isBundleVoucher && "border-primary/25",
                )}
              >
                <CardHeader className="space-y-2.5 p-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-foreground text-sm tracking-wider">{v.code}</span>
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

                        {isBundleVoucher && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-purple-500/30 bg-purple-500/10 font-medium text-[10px] text-purple-700 dark:text-purple-300"
                          >
                            <Gift className="size-2.5" /> Bundle Pass
                          </Badge>
                        )}
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
                          <DropdownMenuItem onClick={() => handleViewRedemptions(v)} className="gap-2 text-xs">
                            <Users className="size-3.5" /> View Redemptions
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(v)} className="gap-2 text-xs">
                            <Edit2 className="size-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(v)} className="gap-2 text-xs">
                            <Copy className="size-3.5" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(v.id, v.code)}
                            className="gap-2 text-destructive text-xs focus:text-destructive"
                          >
                            <Trash2 className="size-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {v.description && (
                    <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">{v.description}</p>
                  )}

                  {/* Bundle Buyer & Redemption Attribution */}
                  {isBundleVoucher && (
                    <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[11px]">
                      {v.purchaser_name && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="shrink-0 text-muted-foreground">Bundle Buyer:</span>
                          <span className="truncate text-right font-semibold text-foreground" title={v.purchaser_email}>
                            {v.purchaser_name}
                            {v.purchaser_email ? (
                              <span className="block font-normal text-[10px] text-muted-foreground">
                                {v.purchaser_email}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2 border-border/50 border-t pt-1.5">
                        <span className="shrink-0 text-muted-foreground">Redemption:</span>
                        {actualRedeemed > 0 && redeemerName ? (
                          <button
                            type="button"
                            onClick={() => handleViewRedemptions(v)}
                            className="truncate text-right font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            <span className="inline-flex items-center gap-1">
                              <UserCheck className="size-3 shrink-0" />
                              {redeemerName}
                            </span>
                            {redeemerEmail && (
                              <span className="block font-normal text-[10px] text-muted-foreground">
                                {redeemerEmail}
                                {redeemedAt ? ` • ${new Date(redeemedAt).toLocaleDateString("id-ID")}` : ""}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="font-medium text-amber-600 dark:text-amber-400">Available (Unclaimed)</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-3 p-4 pt-0">
                  {/* Quota & Redemptions Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between font-medium text-[11px] text-muted-foreground">
                      <span>Redemptions</span>
                      <button
                        type="button"
                        onClick={() => handleViewRedemptions(v)}
                        className={cn(
                          "flex items-center gap-1 font-mono text-xs transition-colors hover:underline",
                          actualRedeemed > 0
                            ? "cursor-pointer font-semibold text-primary hover:text-primary/80"
                            : "cursor-pointer hover:text-foreground",
                        )}
                        title="View attendees who redeemed this voucher"
                      >
                        <span>
                          {actualRedeemed}
                          {v.usage_limit ? ` / ${v.usage_limit}` : " used"}
                        </span>
                        <Eye className="ml-0.5 size-3 opacity-70" />
                      </button>
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

      {/* ── VOUCHER REDEMPTIONS DIALOG ──────────────────────────────────── */}
      <VoucherRedemptionsDialog
        open={isRedemptionsDialogOpen}
        onOpenChange={setIsRedemptionsDialogOpen}
        voucher={viewingRedemptionsVoucher}
        eventId={String(event.id)}
        eventTitle={event.title}
        registrations={registrations}
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
