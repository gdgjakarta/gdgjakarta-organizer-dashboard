"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Calendar,
  Check,
  Copy,
  Download,
  Layers,
  Loader2,
  Mail,
  Phone,
  Search,
  Tag,
  Ticket,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatVoucherDiscountDisplay } from "@/lib/events/voucher-utils";
import type { EventVoucher, FirestoreRegistration } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface VoucherRedemptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucher: EventVoucher | null;
  eventId: string;
  eventTitle?: string;
}

export function VoucherRedemptionsDialog({
  open,
  onOpenChange,
  voucher,
  eventId,
  eventTitle,
}: VoucherRedemptionsDialogProps) {
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Load event registrations whenever dialog opens for a valid event
  useEffect(() => {
    if (!open || !eventId) return;

    let isMounted = true;
    async function loadRegistrations() {
      setIsLoading(true);
      try {
        const { getEventRegistrations } = await import("@/lib/firestore/client");
        const list = await getEventRegistrations(eventId);
        if (isMounted) {
          setRegistrations(list);
        }
      } catch (err) {
        console.error("[VoucherRedemptionsDialog] Failed to fetch registrations:", err);
        if (isMounted) {
          toast.error("Failed to load registrations for voucher verification.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRegistrations();

    return () => {
      isMounted = false;
    };
  }, [open, eventId]);

  // Find all registrations that redeemed this specific voucher
  const redeemedRegistrations = useMemo(() => {
    if (!voucher) return [];

    const normVoucherCode = voucher.code.trim().toUpperCase();

    const matched = registrations.filter((reg) => {
      const regCode = reg.voucher_code ? reg.voucher_code.trim().toUpperCase() : "";
      const matchesCode = regCode.length > 0 && regCode === normVoucherCode;
      const matchesId = Boolean(reg.voucher_id && reg.voucher_id === voucher.id);
      return matchesCode || matchesId;
    });

    // Fallback: If no registrations matched but the voucher document has direct redemption metadata
    // (e.g. from bundle friend vouchers or direct claim update), synthesize a record so organizers still see it.
    if (matched.length === 0 && (voucher.redeemed_by_name || voucher.redeemed_by_email)) {
      const syntheticReg: FirestoreRegistration = {
        id: `synthetic_${voucher.id}`,
        event_id: eventId,
        event_title: eventTitle ?? "Event",
        member_id: voucher.redeemed_by_member_id ?? "member",
        member_name: voucher.redeemed_by_name ?? "Friend",
        member_email: voucher.redeemed_by_email ?? "-",
        status: "approved",
        registered_at: voucher.redeemed_at ?? voucher.updated_at ?? new Date().toISOString(),
        voucher_code: voucher.code,
        voucher_id: voucher.id,
        voucher_discount_amount: voucher.discount_value,
        voucher_discount_type: voucher.discount_type,
      };
      return [syntheticReg];
    }

    return matched;
  }, [registrations, voucher, eventId, eventTitle]);

  // Search filter
  const filteredRedemptions = useMemo(() => {
    if (!searchQuery.trim()) return redeemedRegistrations;
    const q = searchQuery.toLowerCase();
    return redeemedRegistrations.filter((r) => {
      const name = (r.member_name || "").toLowerCase();
      const email = (r.member_email || "").toLowerCase();
      const phone = (r.member_phone || "").toLowerCase();
      const ticket = (r.ticket_name || r.ticket_tier || "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || ticket.includes(q);
    });
  }, [redeemedRegistrations, searchQuery]);

  // Aggregate metrics
  const totalDiscountGiven = useMemo(() => {
    return redeemedRegistrations.reduce((sum, r) => {
      if (typeof r.voucher_discount_amount === "number") {
        return sum + r.voucher_discount_amount;
      }
      if (voucher && voucher.discount_type === "fixed") {
        return sum + (voucher.discount_value || 0);
      }
      return sum;
    }, 0);
  }, [redeemedRegistrations, voucher]);

  const paidOrApprovedCount = useMemo(() => {
    return redeemedRegistrations.filter(
      (r) =>
        r.status === "approved" ||
        r.status === "registered" ||
        r.status === "paid_and_registered" ||
        r.status === "attended" ||
        r.payment_status === "paid",
    ).length;
  }, [redeemedRegistrations]);

  const handleCopyEmail = (email: string) => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      toast.success(`Copied "${email}" to clipboard!`);
      setTimeout(() => setCopiedEmail(null), 2000);
    }
  };

  const handleExportCSV = () => {
    if (redeemedRegistrations.length === 0 || !voucher) {
      toast.info("No redemptions to export.");
      return;
    }

    const headers = [
      "Attendee Name",
      "Email",
      "Phone",
      "Ticket / Tier",
      "Voucher Code",
      "Discount Type",
      "Discount Amount (IDR)",
      "Payment Amount (IDR)",
      "Payment Status",
      "Registration Status",
      "Redeemed Date",
    ];

    const rows = redeemedRegistrations.map((r) => {
      let discountVal: string | number = "-";
      if (typeof r.voucher_discount_amount === "number") {
        discountVal = r.voucher_discount_amount;
      } else if (voucher.discount_type === "fixed") {
        discountVal = voucher.discount_value;
      }

      return [
        `"${(r.member_name || "").replace(/"/g, '""')}"`,
        `"${(r.member_email || "").replace(/"/g, '""')}"`,
        `"${(r.member_phone || "").replace(/"/g, '""')}"`,
        `"${(r.ticket_name || r.ticket_tier || r.bundle_name || "General Pass").replace(/"/g, '""')}"`,
        `"${(voucher.code || "").replace(/"/g, '""')}"`,
        `"${voucher.discount_type}"`,
        discountVal,
        r.payment_amount ?? 0,
        `"${r.payment_status || "N/A"}"`,
        `"${r.status || "N/A"}"`,
        `"${r.registered_at ? new Date(r.registered_at).toLocaleString("id-ID") : "-"}"`,
      ].join(",");
    });

    const csvContent = `\uFEFF${[headers.join(","), ...rows].join("\r\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `voucher-${voucher.code}-redemptions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${redeemedRegistrations.length} redemptions to CSV!`);
  };

  if (!voucher) return null;

  const discountDisplay = formatVoucherDiscountDisplay(voucher);
  const isPercentage = voucher.discount_type === "percentage";

  const renderAppliesTo = () => {
    if (voucher.applies_to === "all") {
      return "All Items";
    }
    if (voucher.applies_to === "ticket") {
      return (
        <span className="flex items-center gap-1">
          <Ticket className="size-2.5" /> Tickets
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1">
        <Layers className="size-2.5" /> Merch
      </span>
    );
  };

  const getStatusBadgeClass = (isApproved: boolean, status?: string) => {
    if (isApproved) {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    }
    if (status === "pending") {
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
    }
    return "border-muted bg-muted/40 text-muted-foreground";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        {/* Header */}
        <DialogHeader className="space-y-3 border-b p-6 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-4" />
                </div>
                <div>
                  <DialogTitle className="font-bold text-base sm:text-lg">Voucher Redemptions</DialogTitle>
                  <DialogDescription className="text-xs">
                    View and manage all community members and attendees who redeemed this code.
                  </DialogDescription>
                </div>
              </div>

              {/* Voucher Code Tag & Conditions */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="rounded border bg-muted px-2 py-0.5 font-bold font-mono text-xs tracking-wider">
                  {voucher.code}
                </span>

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
                  {renderAppliesTo()}
                </Badge>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] capitalize",
                    voucher.status === "active"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-muted bg-muted/40 text-muted-foreground",
                  )}
                >
                  {voucher.status}
                </Badge>
              </div>

              {/* Bundle Source Attribution if applicable */}
              {voucher.purchaser_name && (
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Generated from ticket bundle purchased by{" "}
                  <strong className="text-foreground">{voucher.purchaser_name}</strong>
                  {voucher.purchaser_email ? ` (${voucher.purchaser_email})` : ""}
                </p>
              )}
            </div>

            {/* Quick CSV Export */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={isLoading || redeemedRegistrations.length === 0}
              className="h-8 shrink-0 gap-1.5 self-start text-xs"
            >
              <Download className="size-3.5" />
              Export CSV
            </Button>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <Card className="border-border/60 bg-muted/20 shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 font-medium text-[11px] text-muted-foreground">
                  <UserCheck className="size-3 text-primary" />
                  <span>Redemptions</span>
                </div>
                <div className="mt-1 font-bold text-foreground text-lg">
                  {redeemedRegistrations.length}
                  {voucher.usage_limit ? (
                    <span className="font-normal text-muted-foreground text-xs"> / {voucher.usage_limit}</span>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-muted/20 shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 font-medium text-[11px] text-muted-foreground">
                  <Tag className="size-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Discount Given</span>
                </div>
                <div className="mt-1 font-bold text-emerald-600 text-lg dark:text-emerald-400">
                  {totalDiscountGiven > 0 ? `Rp ${totalDiscountGiven.toLocaleString("id-ID")}` : "Rp 0"}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-muted/20 shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 font-medium text-[11px] text-muted-foreground">
                  <Check className="size-3 text-blue-500" />
                  <span>Confirmed Passes</span>
                </div>
                <div className="mt-1 font-bold text-foreground text-lg">{paidOrApprovedCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Search bar */}
          <div className="relative pt-1">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search redeemed attendees by name, email, or ticket..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </DialogHeader>

        {/* Content list */}
        <ScrollArea className="flex-1 p-6 pt-4">
          {(() => {
            if (isLoading) {
              return (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p className="text-xs">Loading voucher redemptions...</p>
                </div>
              );
            }

            if (filteredRedemptions.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                    <Users className="size-6 opacity-60" />
                  </div>
                  <h4 className="mt-3 font-semibold text-foreground text-sm">
                    {redeemedRegistrations.length === 0 ? "No redemptions yet" : "No matching attendees found"}
                  </h4>
                  <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                    {redeemedRegistrations.length === 0
                      ? `Voucher "${voucher.code}" hasn't been redeemed by any attendees yet. Redemptions will automatically appear here once used at checkout.`
                      : `No redemptions matched your search "${searchQuery}". Try a different name or email.`}
                  </p>
                  {searchQuery && (
                    <Button variant="outline" size="sm" onClick={() => setSearchQuery("")} className="mt-3 h-7 text-xs">
                      Clear Search
                    </Button>
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-2.5">
                {filteredRedemptions.map((reg) => {
                  const initials = (reg.member_name || "A")
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase();

                  const discountAmount =
                    typeof reg.voucher_discount_amount === "number"
                      ? `Rp ${reg.voucher_discount_amount.toLocaleString("id-ID")}`
                      : discountDisplay;

                  const isPaid = reg.payment_status === "paid";
                  const isApproved =
                    reg.status === "approved" ||
                    reg.status === "registered" ||
                    reg.status === "paid_and_registered" ||
                    reg.status === "attended";

                  return (
                    <div
                      key={reg.id}
                      className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card p-3.5 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      {/* Attendee Info */}
                      <div className="flex min-w-0 items-start gap-3">
                        <Avatar className="size-9 shrink-0">
                          {reg.member_avatar && <AvatarImage src={reg.member_avatar} alt={reg.member_name} />}
                          <AvatarFallback className="font-semibold text-xs">{initials}</AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="max-w-[180px] truncate font-semibold text-foreground text-xs sm:max-w-[240px]">
                              {reg.member_name || "Unknown Attendee"}
                            </span>

                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 text-[10px] capitalize",
                                getStatusBadgeClass(isApproved, reg.status),
                              )}
                            >
                              {reg.status.replace(/_/g, " ")}
                            </Badge>

                            {reg.payment_status && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "shrink-0 font-medium font-mono text-[10px] uppercase",
                                  isPaid
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {reg.payment_status}
                              </Badge>
                            )}
                          </div>

                          {/* Email & Phone */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Mail className="size-3 shrink-0" />
                              <span className="max-w-[200px] truncate">{reg.member_email}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyEmail(reg.member_email)}
                                className="ml-0.5 text-muted-foreground transition-colors hover:text-foreground"
                                title="Copy email address"
                              >
                                {copiedEmail === reg.member_email ? (
                                  <Check className="size-3 text-emerald-500" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            </div>

                            {reg.member_phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="size-3 shrink-0" />
                                <span>{reg.member_phone}</span>
                              </div>
                            )}
                          </div>

                          {/* Ticket Tier / Order */}
                          <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <Ticket className="size-3 shrink-0 text-primary" />
                              {reg.ticket_name || reg.ticket_tier || reg.bundle_name || "Event Pass"}
                            </span>

                            <span>•</span>

                            <span className="flex items-center gap-1">
                              <Calendar className="size-3 shrink-0" />
                              {reg.registered_at
                                ? new Date(reg.registered_at).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Applied Discount and Paid Breakdown */}
                      <div className="flex shrink-0 items-center justify-between border-border/50 border-t pt-2 sm:flex-col sm:items-end sm:gap-1 sm:border-0 sm:pt-0">
                        <div className="text-right">
                          <span className="block text-[10px] text-muted-foreground">Discount Saved</span>
                          <span className="font-semibold text-emerald-600 text-xs dark:text-emerald-400">
                            -{discountAmount}
                          </span>
                        </div>

                        {typeof reg.payment_amount === "number" && (
                          <div className="text-right text-[11px] text-muted-foreground">
                            Final:{" "}
                            <span className="font-medium text-foreground">
                              {reg.payment_amount === 0 ? "Free" : `Rp ${reg.payment_amount.toLocaleString("id-ID")}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
