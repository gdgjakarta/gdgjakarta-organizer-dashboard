"use client";

import { useCallback, useMemo, useState } from "react";

import {
  AlertTriangle,
  Ban,
  BarChart3,
  CalendarX,
  CheckCircle2,
  Clock,
  CreditCard,
  Hourglass,
  Layers,
  TrendingDown,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEffectiveRegistrationStatus, isEventCurationMode, isPaidRegistration } from "@/lib/events/payment-deadline";
import { DEFAULT_COMBINED_QUESTIONS } from "@/lib/events/registration-defaults";
import type { CustomQuestion, EventSession, FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { parseMerchandiseVariations } from "./merchandise-helpers";

interface RegistrantStatisticsProps {
  registrations: FirestoreRegistration[];
  customQuestions?: CustomQuestion[];
  sessions?: EventSession[];
  maxAttendees?: number | null;
  activeStatusFilter?: string;
  event?: FirestoreEvent;
  onSelectStatusFilter?: (status: string) => void;
  onSelectSearchFilter?: (term: string) => void;
  onSelectSessionFilter?: (sessionId: string) => void;
  onSelectMerchandiseFilter?: (merchandise: string, variant?: string) => void;
}

interface DistributionItem {
  key: string;
  label: string;
  count: number;
  percentage: number;
  colorClass: string;
  bgLightClass: string;
}

// Color palette for segmented distribution meters
const PALETTE = [
  { bar: "bg-blue-500", text: "text-blue-600 dark:text-blue-400", bgLight: "bg-blue-500/10 border-blue-500/20" },
  {
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bgLight: "bg-emerald-500/10 border-emerald-500/20",
  },
  { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", bgLight: "bg-amber-500/10 border-amber-500/20" },
  {
    bar: "bg-purple-500",
    text: "text-purple-600 dark:text-purple-400",
    bgLight: "bg-purple-500/10 border-purple-500/20",
  },
  { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", bgLight: "bg-rose-500/10 border-rose-500/20" },
  { bar: "bg-cyan-500", text: "text-cyan-600 dark:text-cyan-400", bgLight: "bg-cyan-500/10 border-cyan-500/20" },
  {
    bar: "bg-indigo-500",
    text: "text-indigo-600 dark:text-indigo-400",
    bgLight: "bg-indigo-500/10 border-indigo-500/20",
  },
  { bar: "bg-slate-400", text: "text-muted-foreground", bgLight: "bg-muted/60 border-border/60" },
];

export function RegistrantStatistics({
  registrations,
  customQuestions = [],
  sessions = [],
  maxAttendees,
  activeStatusFilter = "all",
  event,
  onSelectStatusFilter,
  onSelectSearchFilter,
  onSelectSessionFilter,
  onSelectMerchandiseFilter,
}: RegistrantStatisticsProps) {
  // Primary selected field to analyze in detail
  const [selectedField, setSelectedField] = useState<string>("professional_background");
  // Scope: analyze all registrants, approved only, checked in only, or not checked in (drop)
  const [analysisScope, setAnalysisScope] = useState<"all" | "approved" | "checked_in" | "not_checked_in">("all");
  // Organizer can pin multiple fields to display comparison overview cards
  const [pinnedFields, setPinnedFields] = useState<string[]>(["professional_background"]);

  const isCurationMode = isEventCurationMode(event);

  // Calculate totals
  const totalRegistrations = registrations.length;
  const totalApproved = useMemo(() => {
    return registrations.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();
      return s === "approved" || s === "attended" || s === "confirmed" || s === "registered";
    }).length;
  }, [registrations]);

  const totalCheckedIn = useMemo(() => {
    return registrations.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();
      return Boolean(r.is_checked_in) || s === "attended";
    }).length;
  }, [registrations]);

  const totalDropped = useMemo(() => {
    return Math.max(0, totalApproved - totalCheckedIn);
  }, [totalApproved, totalCheckedIn]);

  const dropRateNumber = totalApproved > 0 ? (totalDropped / totalApproved) * 100 : 0;
  const formattedDropRate = `${dropRateNumber % 1 === 0 ? dropRateNumber.toFixed(0) : dropRateNumber.toFixed(1)}%`;

  const totalRejected = useMemo(() => {
    return registrations.filter((r) => (r.status || "").toLowerCase().trim() === "rejected").length;
  }, [registrations]);

  const totalWaitlisted = useMemo(() => {
    return registrations.filter((r) => (r.status || "").toLowerCase().trim() === "waitlisted").length;
  }, [registrations]);

  const totalPending = useMemo(() => {
    return registrations.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();
      return s === "pending" || s === "applied" || s === "review" || !s;
    }).length;
  }, [registrations]);

  // Paid Registration Flow Counters
  const totalWaitingForPayment = useMemo(() => {
    return registrations.filter((r) => {
      const s = getEffectiveRegistrationStatus(r, event);
      return s === "waiting_for_payment";
    }).length;
  }, [registrations, event]);

  const totalPaidAndRegistered = useMemo(() => {
    return registrations.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();
      const ps = (r.payment_status || "").toLowerCase().trim();
      return (
        s === "paid_and_registered" ||
        ((s === "approved" || s === "registered" || s === "attended") && (isPaidRegistration(r) || ps === "paid"))
      );
    }).length;
  }, [registrations]);

  const totalExpired = useMemo(() => {
    return registrations.filter((r) => {
      return getEffectiveRegistrationStatus(r, event) === "expired";
    }).length;
  }, [registrations, event]);

  const totalFailed = useMemo(() => {
    return registrations.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();
      const ps = (r.payment_status || "").toLowerCase().trim();
      return s === "failed" || ps === "failed";
    }).length;
  }, [registrations]);

  const totalCanceled = useMemo(() => {
    return registrations.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();
      return s === "canceled" || s === "cancelled";
    }).length;
  }, [registrations]);

  const totalPaidFlow = useMemo(() => {
    return totalWaitingForPayment + totalPaidAndRegistered + totalExpired + totalFailed + totalCanceled;
  }, [totalWaitingForPayment, totalPaidAndRegistered, totalExpired, totalFailed, totalCanceled]);

  const hasPaidFlow = useMemo(() => {
    if (event?.tickets?.some((t) => t.type === "paid" || t.type === "commitment_fee" || (t.price && t.price > 0))) {
      return true;
    }
    if (event?.merchandise && event.merchandise.length > 0) return true;
    if (event?.bundles && event.bundles.length > 0) return true;
    return totalPaidFlow > 0 || registrations.some((r) => isPaidRegistration(r));
  }, [event, totalPaidFlow, registrations]);

  const approvedPercent = totalRegistrations > 0 ? ((totalApproved / totalRegistrations) * 100).toFixed(1) : "0.0";
  let checkedInPercent = "0.0";
  if (totalApproved > 0) {
    checkedInPercent = ((totalCheckedIn / totalApproved) * 100).toFixed(1);
  } else if (totalRegistrations > 0) {
    checkedInPercent = ((totalCheckedIn / totalRegistrations) * 100).toFixed(1);
  }
  const pendingPercent = totalRegistrations > 0 ? ((totalPending / totalRegistrations) * 100).toFixed(1) : "0.0";
  const waitlistedPercent = totalRegistrations > 0 ? ((totalWaitlisted / totalRegistrations) * 100).toFixed(1) : "0.0";
  const rejectedPercent = totalRegistrations > 0 ? ((totalRejected / totalRegistrations) * 100).toFixed(1) : "0.0";

  // Build full dictionary of available fields from questions and registration answers
  const availableFields = useMemo(() => {
    const fieldMap = new Map<string, { id: string; label: string; count: number }>();

    // 0. Ticket Tiers
    if (registrations.some((r) => r.ticket_name || r.ticket_type)) {
      fieldMap.set("ticket_tier", {
        id: "ticket_tier",
        label: "Ticket Tier (Free / Paid / Commitment)",
        count: registrations.filter((r) => r.ticket_name || r.ticket_type).length,
      });
    }

    // 0. Merchandise Orders
    if (registrations.some((r) => r.selected_merchandise && r.selected_merchandise.length > 0)) {
      fieldMap.set("merchandise_orders", {
        id: "merchandise_orders",
        label: "Merchandise & Swag Orders",
        count: registrations.filter((r) => r.selected_merchandise && r.selected_merchandise.length > 0).length,
      });
    }

    // 1. Session Track
    if (sessions.length > 0) {
      fieldMap.set("session_track", {
        id: "session_track",
        label: "Session Track / Workshop",
        count: registrations.filter((r) => r.session_id || r.session_title || r.answers?.session_id).length,
      });
    }

    // 2. Default combined questions
    for (const q of DEFAULT_COMBINED_QUESTIONS) {
      if (q.id && q.label) {
        fieldMap.set(q.id, {
          id: q.id,
          label: q.label,
          count: 0,
        });
      }
    }

    // 3. Event custom questions
    for (const q of customQuestions) {
      if (q.id && q.label) {
        fieldMap.set(q.id, {
          id: q.id,
          label: q.label,
          count: 0,
        });
      }
    }

    // 4. Count presence in registrant answers
    for (const r of registrations) {
      if (!r.answers) continue;
      for (const [key, val] of Object.entries(r.answers)) {
        if (key === "session_id" || key === "session_title") continue;
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          const existing = fieldMap.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            // Humanize key
            const label = key
              .replace(/[_-]+/g, " ")
              .split(" ")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
            fieldMap.set(key, { id: key, label, count: 1 });
          }
        }
      }
    }

    // Convert map to sorted array: items with more responses prioritized
    const list = Array.from(fieldMap.values());
    list.sort((a, b) => {
      // Prioritize professional_background
      if (a.id === "professional_background") return -1;
      if (b.id === "professional_background") return 1;
      return b.count - a.count;
    });

    return list;
  }, [sessions, customQuestions, registrations]);

  // Target pool based on analysis scope
  const targetPool = useMemo(() => {
    if (analysisScope === "approved") {
      return registrations.filter((r) => {
        const s = (r.status ?? "").toLowerCase().trim();
        return s === "approved" || s === "attended" || s === "confirmed" || s === "registered";
      });
    }
    if (analysisScope === "checked_in") {
      return registrations.filter((r) => {
        const s = (r.status ?? "").toLowerCase().trim();
        return Boolean(r.is_checked_in) || s === "attended";
      });
    }
    if (analysisScope === "not_checked_in") {
      return registrations.filter((r) => {
        const s = (r.status ?? "").toLowerCase().trim();
        const isApproved = s === "approved" || s === "attended" || s === "confirmed" || s === "registered";
        const isCheckedIn = Boolean(r.is_checked_in) || s === "attended";
        return isApproved && !isCheckedIn;
      });
    }
    return registrations;
  }, [registrations, analysisScope]);

  // Helper to compute distributions for any field
  const computeDistribution = useCallback(
    (fieldId: string): { items: DistributionItem[]; totalResponses: number } => {
      if (!fieldId || targetPool.length === 0) {
        return { items: [], totalResponses: 0 };
      }

      const counts = new Map<string, number>();
      let totalCounted = 0;

      if (fieldId === "session_track") {
        for (const r of targetPool) {
          let title = r.session_title ?? (r.answers?.session_title as string);
          if (!title && r.session_id) {
            const match = sessions.find((s) => s.id === r.session_id);
            title = match ? match.title : `Track ${r.session_id}`;
          }
          const val = title ?? "Standard RSVP";
          counts.set(val, (counts.get(val) ?? 0) + 1);
          totalCounted += 1;
        }
      } else if (fieldId === "ticket_tier") {
        for (const r of targetPool) {
          const val = r.ticket_name ?? (r.ticket_type ? `Ticket: ${r.ticket_type}` : "General RSVP");
          counts.set(val, (counts.get(val) ?? 0) + 1);
          totalCounted += 1;
        }
      } else if (fieldId === "merchandise_orders") {
        for (const r of targetPool) {
          if (r.selected_merchandise && r.selected_merchandise.length > 0) {
            for (const item of r.selected_merchandise) {
              const variations = parseMerchandiseVariations(item, r.answers);
              const varSummary = variations.map((v) => (v.label ? `${v.label}: ${v.value}` : v.value)).join(", ");
              const label = varSummary ? `${item.name} (${varSummary})` : item.name;
              counts.set(label, (counts.get(label) ?? 0) + 1);
              totalCounted += 1;
            }
          } else {
            counts.set("No Merchandise", (counts.get("No Merchandise") ?? 0) + 1);
            totalCounted += 1;
          }
        }
      } else {
        for (const r of targetPool) {
          const raw = r.answers?.[fieldId];
          if (raw === undefined || raw === null || String(raw).trim() === "") {
            counts.set("Not Specified", (counts.get("Not Specified") ?? 0) + 1);
            totalCounted += 1;
            continue;
          }

          if (Array.isArray(raw)) {
            for (const item of raw) {
              const str = String(item).trim();
              if (str) {
                counts.set(str, (counts.get(str) ?? 0) + 1);
                totalCounted += 1;
              }
            }
          } else {
            const str = String(raw).trim();
            counts.set(str, (counts.get(str) ?? 0) + 1);
            totalCounted += 1;
          }
        }
      }

      // Convert to sorted items
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      const items: DistributionItem[] = sorted.map(([key, count], index) => {
        const paletteItem = PALETTE[index % PALETTE.length];
        const percentage = totalCounted > 0 ? (count / totalCounted) * 100 : 0;
        return {
          key,
          label: key,
          count,
          percentage,
          colorClass: paletteItem.bar,
          bgLightClass: paletteItem.bgLight,
        };
      });

      return { items, totalResponses: totalCounted };
    },
    [targetPool, sessions],
  );

  const primaryDistribution = useMemo(() => {
    if (!selectedField) return { items: [], totalResponses: 0 };
    return computeDistribution(selectedField);
  }, [selectedField, computeDistribution]);

  // Active field metadata
  const currentFieldMeta = useMemo(() => {
    if (!selectedField) return null;
    return (
      availableFields.find((f) => f.id === selectedField) ?? {
        id: selectedField,
        label: selectedField,
        count: 0,
      }
    );
  }, [availableFields, selectedField]);

  const togglePinField = (fieldId: string) => {
    if (pinnedFields.includes(fieldId)) {
      const nextPinned = pinnedFields.filter((id) => id !== fieldId);
      setPinnedFields(nextPinned);
      if (selectedField === fieldId) {
        if (nextPinned.length > 0) {
          setSelectedField(nextPinned[0]);
        } else {
          setSelectedField("");
        }
      }
    } else {
      const nextPinned = [...pinnedFields, fieldId];
      setPinnedFields(nextPinned);
      if (!selectedField) {
        setSelectedField(fieldId);
      }
    }
  };

  const handleFilterClick = (item: DistributionItem) => {
    if (selectedField === "session_track") {
      const sessionMatch = sessions.find((s) => s.title === item.key);
      if (sessionMatch && onSelectSessionFilter) {
        onSelectSessionFilter(sessionMatch.id);
        return;
      }
    }
    if (selectedField === "merchandise_orders") {
      if (item.key === "No Merchandise") {
        if (onSelectMerchandiseFilter) {
          onSelectMerchandiseFilter("no_merchandise");
          return;
        }
      } else {
        const match = item.key.match(/^(.*?)(?:\s*\((.*?)\))?$/);
        const productName = (match?.[1] || item.key).trim();
        const variationStr = match?.[2]?.trim();
        if (onSelectMerchandiseFilter) {
          onSelectMerchandiseFilter(productName, variationStr);
          return;
        }
      }
    }
    if (onSelectSearchFilter && item.key !== "Not Specified") {
      onSelectSearchFilter(item.key);
    }
  };

  const renderAnalyticsContent = () => {
    if (targetPool.length === 0) {
      return (
        <div className="rounded-xl border border-dashed py-8 text-center text-muted-foreground text-xs">
          No registrants available in this filter scope to compute statistics.
        </div>
      );
    }

    if (pinnedFields.length === 0 || !selectedField) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Layers className="size-5" />
          </div>
          <div className="font-semibold text-sm">No Pinned Statistics</div>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            All form fields have been unpinned. Select or pin a questionnaire response field to display demographic
            statistics and attendee breakdowns.
          </p>
          {availableFields.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {availableFields.slice(0, 4).map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedField(f.id);
                    setPinnedFields([f.id]);
                  }}
                  className="h-7 rounded-full px-3 text-xs"
                >
                  Pin {f.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (primaryDistribution.items.length === 0) {
      return (
        <div className="rounded-xl border border-dashed py-8 text-center text-muted-foreground text-xs">
          No recorded answers found for &quot;{currentFieldMeta?.label}&quot;.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Distribution Header & Count info */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm">{currentFieldMeta?.label}</span>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {primaryDistribution.totalResponses} respondents
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => togglePinField(selectedField)}
              className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
              title="Unpin this field"
            >
              Unpin
            </Button>
          </div>
          <span className="text-muted-foreground text-[11px]">Click any option below to filter registrant table</span>
        </div>

        {/* Segmented Distribution Meter Bar */}
        <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-muted shadow-inner">
          {primaryDistribution.items.map((item) => {
            if (item.percentage <= 0) return null;
            return (
              <div
                key={item.key}
                style={{ width: `${Math.max(item.percentage, 1.5)}%` }}
                className={cn("h-full transition-all duration-300", item.colorClass)}
                title={`${item.label}: ${item.count} (${item.percentage.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        {/* Detailed Breakdown Options Grid */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {primaryDistribution.items.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => handleFilterClick(item)}
              className={cn(
                "group flex flex-col justify-between rounded-xl border p-3 text-left transition-all hover:border-primary/50 hover:shadow-xs",
                item.bgLightClass,
              )}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="font-medium text-foreground text-xs leading-snug group-hover:text-primary transition-colors">
                  {item.label}
                </span>
                <span className="font-bold text-xs">{item.percentage.toFixed(1)}%</span>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{item.count} attendees</span>
                <span className="opacity-0 group-hover:opacity-100 text-primary transition-opacity text-[10px]">
                  Filter ↗
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Secondary Pinned Metrics (if organizer pinned other fields) */}
        {pinnedFields.filter((f) => f !== selectedField).length > 0 && (
          <div className="mt-6 space-y-3 border-t pt-4">
            <div className="font-semibold text-foreground text-xs">Pinned Comparisons:</div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {pinnedFields
                .filter((f) => f !== selectedField)
                .map((fieldId) => {
                  const dist = computeDistribution(fieldId);
                  const meta = availableFields.find((f) => f.id === fieldId) || { id: fieldId, label: fieldId };

                  return (
                    <div key={fieldId} className="rounded-xl border bg-card p-3.5 shadow-xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">{meta.label}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedField(fieldId)}
                            className="h-6 text-[10px] text-primary"
                          >
                            View Detailed
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => togglePinField(fieldId)}
                            className="h-6 px-1 text-[10px] text-muted-foreground hover:text-destructive"
                            title="Unpin comparison"
                          >
                            Unpin
                          </Button>
                        </div>
                      </div>

                      {/* Mini bar */}
                      <div className="my-2 flex h-2 w-full overflow-hidden rounded-full bg-muted">
                        {dist.items.map((item) => (
                          <div
                            key={item.key}
                            style={{ width: `${item.percentage}%` }}
                            className={cn("h-full", item.colorClass)}
                          />
                        ))}
                      </div>

                      {/* Top 3 pills */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {dist.items.slice(0, 3).map((item) => (
                          <Badge key={item.key} variant="outline" className="text-[10px] font-normal">
                            {item.label}: <strong className="ml-1">{item.percentage.toFixed(0)}%</strong>
                          </Badge>
                        ))}
                        {dist.items.length > 3 && (
                          <Badge variant="secondary" className="text-[10px]">
                            +{dist.items.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Top Level Status Overview ──────────────────────────────── */}
      <div
        className={cn(
          "grid gap-3 sm:gap-4",
          isCurationMode ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2",
        )}
      >
        {/* Total Registrants */}
        <Card
          onClick={() => onSelectStatusFilter?.("all")}
          className={cn(
            "cursor-pointer transition-all hover:border-primary/50 hover:shadow-xs",
            activeStatusFilter === "all" && "border-primary/50 bg-primary/5 ring-1 ring-primary/30",
          )}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="font-medium">Total Registrants</span>
              <Users className="size-4 text-primary" />
            </div>
            <div className="mt-2 font-bold text-2xl tracking-tight sm:text-3xl">{totalRegistrations}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {maxAttendees ? (
                <span>
                  Capacity: {Math.round((totalRegistrations / maxAttendees) * 100)}% of {maxAttendees}
                </span>
              ) : (
                <span>All registered applicants</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Approved - only when curation mode is on */}
        {isCurationMode && (
          <Card
            onClick={() => onSelectStatusFilter?.("approved")}
            className={cn(
              "cursor-pointer transition-all hover:border-emerald-500/50 hover:shadow-xs",
              activeStatusFilter === "approved" && "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30",
            )}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="font-medium">Approved</span>
                <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2 font-bold text-2xl tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                {totalApproved}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge
                  variant="outline"
                  className="border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 font-semibold text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  {approvedPercent}%
                </Badge>
                <span>of total</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Checked In */}
        <Card
          onClick={() => onSelectStatusFilter?.(activeStatusFilter === "checked_in" ? "all" : "checked_in")}
          className={cn(
            "cursor-pointer transition-all hover:border-purple-500/50 hover:shadow-xs",
            activeStatusFilter === "checked_in" && "border-purple-500/50 bg-purple-500/5 ring-1 ring-purple-500/30",
          )}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="font-medium">Checked In</span>
              <UserCheck className="size-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="font-bold text-2xl tracking-tight text-purple-600 dark:text-purple-400 sm:text-3xl">
                {totalCheckedIn}
              </div>
              {totalApproved > 0 && (
                <div
                  className="flex items-center gap-0.5 text-xs"
                  title={`${totalDropped} of ${totalApproved} approved attendees not checked in`}
                >
                  <TrendingDown
                    className={cn(
                      "size-3.5",
                      dropRateNumber > 60
                        ? "text-rose-500"
                        : dropRateNumber > 35
                          ? "text-amber-500"
                          : "text-emerald-500",
                    )}
                  />
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      dropRateNumber > 60
                        ? "text-rose-600 dark:text-rose-400"
                        : dropRateNumber > 35
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {formattedDropRate}
                  </span>
                  <span className="text-muted-foreground text-[10px]">drop</span>
                </div>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <Badge
                variant="outline"
                className="border-purple-500/20 bg-purple-500/10 px-1.5 py-0 font-semibold text-[10px] text-purple-600 dark:text-purple-400"
              >
                {checkedInPercent}%
              </Badge>
              <span>turnout</span>
              {totalApproved > 0 && (
                <>
                  <span>•</span>
                  <span>{totalDropped} no-show</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Review - only when curation mode is on */}
        {isCurationMode && (
          <Card
            onClick={() => onSelectStatusFilter?.("pending")}
            className={cn(
              "cursor-pointer transition-all hover:border-amber-500/50 hover:shadow-xs",
              activeStatusFilter === "pending" && "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/30",
            )}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="font-medium">Pending Review</span>
                <Clock className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="mt-2 font-bold text-2xl tracking-tight text-amber-600 dark:text-amber-400 sm:text-3xl">
                {totalPending}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge
                  variant="outline"
                  className="border-amber-500/20 bg-amber-500/10 px-1.5 py-0 font-semibold text-[10px] text-amber-600 dark:text-amber-400"
                >
                  {pendingPercent}%
                </Badge>
                <span>requires review</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Waitlisted - only when curation mode is on */}
        {isCurationMode && (
          <Card
            onClick={() => onSelectStatusFilter?.("waitlisted")}
            className={cn(
              "cursor-pointer transition-all hover:border-blue-500/50 hover:shadow-xs",
              activeStatusFilter === "waitlisted" && "border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/30",
            )}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="font-medium">Waitlisted</span>
                <Hourglass className="size-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="mt-2 font-bold text-2xl tracking-tight text-blue-600 dark:text-blue-400 sm:text-3xl">
                {totalWaitlisted}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge
                  variant="outline"
                  className="border-blue-500/20 bg-blue-500/10 px-1.5 py-0 font-semibold text-[10px] text-blue-600 dark:text-blue-400"
                >
                  {waitlistedPercent}%
                </Badge>
                <span>on waitlist</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejected - only when curation mode is on */}
        {isCurationMode && (
          <Card
            onClick={() => onSelectStatusFilter?.("rejected")}
            className={cn(
              "cursor-pointer transition-all hover:border-destructive/50 hover:shadow-xs",
              activeStatusFilter === "rejected" && "border-destructive/50 bg-destructive/5 ring-1 ring-destructive/30",
            )}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="font-medium">Rejected</span>
                <UserX className="size-4 text-destructive" />
              </div>
              <div className="mt-2 font-bold text-2xl tracking-tight text-destructive sm:text-3xl">{totalRejected}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge
                  variant="outline"
                  className="border-destructive/20 bg-destructive/10 px-1.5 py-0 font-semibold text-[10px] text-destructive"
                >
                  {rejectedPercent}%
                </Badge>
                <span>declined</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Paid Registration Flow 5-Card Status Counter ────────────────────────── */}
      {hasPaidFlow && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <CreditCard className="size-3.5 text-primary" />
              <span>Paid Registration Flow</span>
              <Badge variant="outline" className="ml-1 text-[10px] font-medium border-primary/30 text-primary">
                {totalPaidFlow} total
              </Badge>
            </div>
            {activeStatusFilter !== "all" &&
              ["waiting_for_payment", "paid_and_registered", "expired", "failed", "canceled"].includes(
                activeStatusFilter,
              ) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelectStatusFilter?.("all")}
                  className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Clear filter
                </Button>
              )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
            {/* 1. Waiting for Payment */}
            <Card
              onClick={() =>
                onSelectStatusFilter?.(activeStatusFilter === "waiting_for_payment" ? "all" : "waiting_for_payment")
              }
              className={cn(
                "cursor-pointer transition-all hover:border-amber-500/50 hover:shadow-xs",
                activeStatusFilter === "waiting_for_payment" &&
                  "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/30",
              )}
            >
              <CardContent className="p-3.5 sm:p-4">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Waiting for Payment</span>
                  <Clock className="size-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="mt-2 font-bold text-2xl tracking-tight text-amber-600 dark:text-amber-400 sm:text-3xl">
                  {totalWaitingForPayment}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Badge
                    variant="outline"
                    className="border-amber-500/20 bg-amber-500/10 px-1.5 py-0 font-semibold text-[10px] text-amber-600 dark:text-amber-400"
                  >
                    {totalPaidFlow > 0 ? ((totalWaitingForPayment / totalPaidFlow) * 100).toFixed(0) : 0}%
                  </Badge>
                  <span>pending checkout</span>
                </div>
              </CardContent>
            </Card>

            {/* 2. Paid & Registered */}
            <Card
              onClick={() =>
                onSelectStatusFilter?.(activeStatusFilter === "paid_and_registered" ? "all" : "paid_and_registered")
              }
              className={cn(
                "cursor-pointer transition-all hover:border-emerald-500/50 hover:shadow-xs",
                activeStatusFilter === "paid_and_registered" &&
                  "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30",
              )}
            >
              <CardContent className="p-3.5 sm:p-4">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Paid & Registered</span>
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="mt-2 font-bold text-2xl tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                  {totalPaidAndRegistered}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Badge
                    variant="outline"
                    className="border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 font-semibold text-[10px] text-emerald-600 dark:text-emerald-400"
                  >
                    {totalPaidFlow > 0 ? ((totalPaidAndRegistered / totalPaidFlow) * 100).toFixed(0) : 0}%
                  </Badge>
                  <span>confirmed</span>
                </div>
              </CardContent>
            </Card>

            {/* 3. Expired */}
            <Card
              onClick={() => onSelectStatusFilter?.(activeStatusFilter === "expired" ? "all" : "expired")}
              className={cn(
                "cursor-pointer transition-all hover:border-zinc-500/50 hover:shadow-xs",
                activeStatusFilter === "expired" && "border-zinc-500/50 bg-zinc-500/5 ring-1 ring-zinc-500/30",
              )}
            >
              <CardContent className="p-3.5 sm:p-4">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Expired</span>
                  <CalendarX className="size-4 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="mt-2 font-bold text-2xl tracking-tight text-zinc-700 dark:text-zinc-300 sm:text-3xl">
                  {totalExpired}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="text-[10px]">deadline overdue</span>
                </div>
              </CardContent>
            </Card>

            {/* 4. Failed */}
            <Card
              onClick={() => onSelectStatusFilter?.(activeStatusFilter === "failed" ? "all" : "failed")}
              className={cn(
                "cursor-pointer transition-all hover:border-rose-500/50 hover:shadow-xs",
                activeStatusFilter === "failed" && "border-rose-500/50 bg-rose-500/5 ring-1 ring-rose-500/30",
              )}
            >
              <CardContent className="p-3.5 sm:p-4">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Failed</span>
                  <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="mt-2 font-bold text-2xl tracking-tight text-rose-600 dark:text-rose-400 sm:text-3xl">
                  {totalFailed}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="text-[10px]">payment error</span>
                </div>
              </CardContent>
            </Card>

            {/* 5. Canceled */}
            <Card
              onClick={() => onSelectStatusFilter?.(activeStatusFilter === "canceled" ? "all" : "canceled")}
              className={cn(
                "cursor-pointer transition-all hover:border-slate-500/50 hover:shadow-xs",
                activeStatusFilter === "canceled" && "border-slate-500/50 bg-slate-500/5 ring-1 ring-slate-500/30",
              )}
            >
              <CardContent className="p-3.5 sm:p-4">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Canceled</span>
                  <Ban className="size-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="mt-2 font-bold text-2xl tracking-tight text-slate-700 dark:text-slate-300 sm:text-3xl">
                  {totalCanceled}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="text-[10px]">cancelled orders</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Attendee Form Field Analytics (Customizable by Organizer) ────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" />
                <CardTitle className="text-base sm:text-lg">Attendee Form Statistics & Demographics</CardTitle>
              </div>
              <CardDescription className="mt-0.5 text-xs">
                Inspect questionnaire response breakdowns (e.g. Tech vs. Non-Tech background, tracks, seniority).
                Organizers can choose which field to display.
              </CardDescription>
            </div>

            {/* Scope & Field Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Scope filter: All vs Approved */}
              <div className="flex items-center rounded-lg border bg-muted/30 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAnalysisScope("all")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    analysisScope === "all"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  All ({totalRegistrations})
                </button>
                {isCurationMode && (
                  <button
                    type="button"
                    onClick={() => setAnalysisScope("approved")}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium transition-colors",
                      analysisScope === "approved"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Approved Only ({totalApproved})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAnalysisScope("checked_in")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    analysisScope === "checked_in"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Checked In ({totalCheckedIn})
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisScope("not_checked_in")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    analysisScope === "not_checked_in"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Approved attendees who have not checked in"
                >
                  Not Checked In ({totalDropped})
                </button>
              </div>

              {/* Field dropdown selector */}
              <div className="w-[220px]">
                <Select
                  value={selectedField || undefined}
                  onValueChange={(val) => {
                    setSelectedField(val);
                    if (!pinnedFields.includes(val)) {
                      setPinnedFields((prev) => [...prev, val]);
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Choose form field..." />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {availableFields.map((field) => (
                      <SelectItem key={field.id} value={field.id} className="text-xs">
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pin/Toggle Fields Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Layers className="size-3.5" />
                    Pinned ({pinnedFields.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto text-xs">
                  <DropdownMenuLabel>Pinned Comparison Fields</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableFields.map((field) => (
                    <DropdownMenuCheckboxItem
                      key={field.id}
                      checked={pinnedFields.includes(field.id)}
                      onCheckedChange={() => togglePinField(field.id)}
                      onSelect={(event) => event.preventDefault()}
                      className="text-xs"
                    >
                      {field.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {pinnedFields.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          setPinnedFields([]);
                          setSelectedField("");
                        }}
                        className="justify-center text-center text-xs cursor-pointer"
                      >
                        Unpin all fields
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Quick-switch pills for common organizer metrics */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
            <span className="mr-1 font-medium text-[11px] text-muted-foreground">Quick Select:</span>
            {availableFields.slice(0, 5).map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={selectedField === f.id ? "secondary" : "outline"}
                onClick={() => {
                  setSelectedField(f.id);
                  if (!pinnedFields.includes(f.id)) {
                    setPinnedFields((prev) => [...prev, f.id]);
                  }
                }}
                className={cn(
                  "h-6 rounded-full px-2.5 text-[11px]",
                  selectedField === f.id && "bg-primary/10 font-semibold text-primary border-primary/30",
                )}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-0">{renderAnalyticsContent()}</CardContent>
      </Card>
    </div>
  );
}
