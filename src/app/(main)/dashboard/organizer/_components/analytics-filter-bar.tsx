"use client";

import { useMemo, useState } from "react";

import { CalendarIcon, ChevronDown, Copy, FileText, Handshake, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, formatMonthLabel, formatShortDateLabel, getTodayWibDateStr } from "@/lib/analytics/date-range";
import type { ReportPromptPurpose } from "@/lib/analytics/prompt-builder";
import { cn } from "@/lib/utils";

export interface AnalyticsFilterState {
  mode: "all_time" | "month" | "year" | "date_range";
  month: string; // YYYY-MM
  year: string; // YYYY
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

interface AnalyticsFilterBarProps {
  filter: AnalyticsFilterState;
  onChange: (next: AnalyticsFilterState) => void;
  onRefresh: () => void;
  onCopyPrompt: (purpose: ReportPromptPurpose) => void;
  isLoading: boolean;
  isCopyingPrompt: boolean;
}

function getRecentMonths(count = 12): Array<{ value: string; label: string }> {
  const today = getTodayWibDateStr();
  const [startYear, startMonth] = today.split("-").map(Number);
  const items: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(startYear, startMonth - 1 - i, 1));
    const val = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    items.push({ value: val, label: formatMonthLabel(val) });
  }
  return items;
}

function getRecentYears(count = 5): string[] {
  const currentYear = Number(getTodayWibDateStr().slice(0, 4));
  return Array.from({ length: count }, (_, i) => String(currentYear - i));
}

function toLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AnalyticsFilterBar({
  filter,
  onChange,
  onRefresh,
  onCopyPrompt,
  isLoading,
  isCopyingPrompt,
}: AnalyticsFilterBarProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const months = useMemo(() => getRecentMonths(12), []);
  const years = useMemo(() => getRecentYears(5), []);
  const todayWib = getTodayWibDateStr();
  const maxDate = useMemo(() => toLocalDate(todayWib), [todayWib]);

  const applyPreset = (days: number) => {
    const to = getTodayWibDateStr();
    const from = addDays(to, -(days - 1));
    onChange({ ...filter, mode: "date_range", from, to });
  };

  const activePresetDays = useMemo(() => {
    if (filter.mode !== "date_range" || filter.to !== todayWib) return null;
    for (const d of [7, 14, 30]) {
      if (filter.from === addDays(todayWib, -(d - 1))) return d;
    }
    return null;
  }, [filter.from, filter.mode, filter.to, todayWib]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Mode Switch */}
        <div className="inline-flex h-8 items-center rounded-md border bg-muted/50 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onChange({ ...filter, mode: "all_time" })}
            className={cn(
              "h-full rounded-sm px-2.5 font-medium transition-colors",
              filter.mode === "all_time"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All Time
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filter, mode: "date_range" })}
            className={cn(
              "h-full rounded-sm px-2.5 font-medium transition-colors",
              filter.mode === "date_range"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Date Range
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filter, mode: "month" })}
            className={cn(
              "h-full rounded-sm px-2.5 font-medium transition-colors",
              filter.mode === "month"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filter, mode: "year" })}
            className={cn(
              "h-full rounded-sm px-2.5 font-medium transition-colors",
              filter.mode === "year"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Yearly
          </button>
        </div>

        {filter.mode === "year" ? (
          <Select value={filter.year} onValueChange={(year) => onChange({ ...filter, mode: "year", year })}>
            <SelectTrigger size="sm" className="w-[100px] text-xs tabular-nums" aria-label="Select year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y} className="text-xs tabular-nums">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {filter.mode === "month" ? (
          <Select value={filter.month} onValueChange={(month) => onChange({ ...filter, mode: "month", month })}>
            <SelectTrigger size="sm" className="w-[140px] text-xs" aria-label="Select month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {filter.mode === "date_range" ? (
          <div className="flex flex-wrap items-center gap-1">
            {([7, 14, 30] as const).map((days) => (
              <Button
                key={days}
                type="button"
                size="sm"
                variant={activePresetDays === days ? "secondary" : "outline"}
                onClick={() => applyPreset(days)}
                className="h-8 px-2 text-xs tabular-nums"
              >
                {days}D
              </Button>
            ))}

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs tabular-nums">
                  <CalendarIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>
                    {formatShortDateLabel(filter.from)} – {formatShortDateLabel(filter.to)}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="range"
                  numberOfMonths={1}
                  selected={{
                    from: toLocalDate(filter.from),
                    to: toLocalDate(filter.to),
                  }}
                  onSelect={(range: DateRange | undefined) => {
                    if (!range?.from) return;
                    const fromStr = fromLocalDate(range.from);
                    const toStr = range.to ? fromLocalDate(range.to) : fromStr;
                    onChange({
                      ...filter,
                      mode: "date_range",
                      from: fromStr,
                      to: toStr > todayWib ? todayWib : toStr,
                    });
                    if (range.from && range.to) {
                      setCalendarOpen(false);
                    }
                  }}
                  disabled={{ after: maxDate }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isCopyingPrompt}
              className="h-8 gap-1.5 text-xs"
            >
              {isCopyingPrompt ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              )}
              <span>{isCopyingPrompt ? "Preparing MD..." : "Copy AI Prompt"}</span>
              <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              Copy Markdown Data + Prompt
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onCopyPrompt("proposal")} className="gap-2 text-xs">
              <Handshake className="size-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="font-medium">Sponsor Proposal Prompt</span>
                <span className="text-[10px] text-muted-foreground">All 5 tabs in MD for pitching partners</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCopyPrompt("partner_report")} className="gap-2 text-xs">
              <FileText className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="font-medium">Partner Impact Report Prompt</span>
                <span className="text-[10px] text-muted-foreground">All 5 tabs in MD for partner reporting</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onCopyPrompt("active_tab")} className="gap-2 text-xs">
              <Copy className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="font-medium">Current Tab Only (MD)</span>
                <span className="text-[10px] text-muted-foreground">Instant copy of active tab metrics</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh analytics"
          aria-label="Refresh analytics"
        >
          <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
}
