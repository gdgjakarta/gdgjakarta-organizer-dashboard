"use client";

import { useCallback, useMemo, useState } from "react";

import { BarChart3, Clock, Layers, UserCheck, Users, UserX } from "lucide-react";

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
import { DEFAULT_COMBINED_QUESTIONS } from "@/lib/events/registration-defaults";
import type { CustomQuestion, EventSession, FirestoreRegistration } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface RegistrantStatisticsProps {
  registrations: FirestoreRegistration[];
  customQuestions?: CustomQuestion[];
  sessions?: EventSession[];
  maxAttendees?: number | null;
  activeStatusFilter?: string;
  onSelectStatusFilter?: (status: string) => void;
  onSelectSearchFilter?: (term: string) => void;
  onSelectSessionFilter?: (sessionId: string) => void;
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
  onSelectStatusFilter,
  onSelectSearchFilter,
  onSelectSessionFilter,
}: RegistrantStatisticsProps) {
  // Primary selected field to analyze in detail
  const [selectedField, setSelectedField] = useState<string>("professional_background");
  // Scope: analyze all registrants or approved only
  const [analysisScope, setAnalysisScope] = useState<"all" | "approved">("all");
  // Organizer can pin multiple fields to display comparison overview cards
  const [pinnedFields, setPinnedFields] = useState<string[]>(["professional_background"]);

  // Calculate totals
  const totalRegistrations = registrations.length;
  const totalApproved = useMemo(() => {
    return registrations.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();
      return s === "approved" || s === "attended" || s === "confirmed" || s === "registered";
    }).length;
  }, [registrations]);

  const totalRejected = useMemo(() => {
    return registrations.filter((r) => (r.status || "").toLowerCase().trim() === "rejected").length;
  }, [registrations]);

  const totalPending = useMemo(() => {
    return registrations.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();
      return s === "pending" || s === "applied" || s === "review" || !s;
    }).length;
  }, [registrations]);

  const approvedPercent = totalRegistrations > 0 ? ((totalApproved / totalRegistrations) * 100).toFixed(1) : "0.0";
  const pendingPercent = totalRegistrations > 0 ? ((totalPending / totalRegistrations) * 100).toFixed(1) : "0.0";
  const rejectedPercent = totalRegistrations > 0 ? ((totalRejected / totalRegistrations) * 100).toFixed(1) : "0.0";

  // Build full dictionary of available fields from questions and registration answers
  const availableFields = useMemo(() => {
    const fieldMap = new Map<string, { id: string; label: string; count: number }>();

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
      {/* ── Top Level 4-Card Status Overview ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
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

        {/* Total Approved */}
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

        {/* Pending Review */}
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

        {/* Rejected */}
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
      </div>

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
