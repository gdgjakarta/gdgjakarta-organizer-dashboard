"use client";

import { useEffect, useMemo, useState } from "react";

import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const COMMON_TIMEZONES = ["WIB", "WITA", "WIT", "UTC"] as const;
const QUICK_TIME_PRESETS = ["09:00", "10:00", "13:00", "18:30", "19:00"] as const;

function parseDatePart(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  const directDate = new Date(dateStr);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }
  const commaIdx = dateStr.indexOf(",");
  if (commaIdx !== -1) {
    const afterComma = dateStr.substring(commaIdx + 1).trim();
    const cleanDate = new Date(afterComma);
    if (!Number.isNaN(cleanDate.getTime())) {
      return cleanDate;
    }
  }
  return undefined;
}

function parseTimePart(timeStr: string): { time: string; timezone: string } {
  let time = "09:00";
  let timezone = "WIB";
  if (!timeStr) return { time, timezone };

  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (timeMatch) {
    let hours = Number.parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const ampm = timeMatch[3]?.toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    time = `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  const tzMatch = timeStr.match(/\b(WIB|WITA|WIT|UTC|GMT[+-]?\d*)\b/i);
  if (tzMatch) {
    timezone = tzMatch[1].toUpperCase();
  }

  return { time, timezone };
}

function formatResult(date: Date, time: string, timezone: string): string {
  const formattedDate = format(date, "EEEE, MMM d, yyyy");
  const tzSuffix = timezone ? ` ${timezone.trim()}` : "";
  return `${formattedDate} • ${time}${tzSuffix}`;
}

export function DateTimePicker({
  id,
  value = "",
  onChange,
  placeholder = "Select event date & time...",
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);

  // Parse incoming value into date, time, and timezone
  const parsed = useMemo(() => {
    if (!value?.trim()) {
      return { date: undefined, time: "09:00", timezone: "WIB" };
    }
    const [rawDate, rawTime] = value.includes("•") ? value.split("•").map((s) => s.trim()) : [value, ""];
    const date = parseDatePart(rawDate);
    const { time, timezone } = parseTimePart(rawTime);
    return { date, time, timezone };
  }, [value]);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(parsed.date);
  const [time, setTime] = useState<string>(parsed.time);
  const [timezone, setTimezone] = useState<string>(parsed.timezone);

  // Synchronize internal state when parsed value changes externally
  useEffect(() => {
    setSelectedDate(parsed.date);
    setTime(parsed.time);
    setTimezone(parsed.timezone);
  }, [parsed]);

  const handleSelectDate = (newDate: Date | undefined) => {
    setSelectedDate(newDate);
    if (!newDate) {
      onChange("");
      return;
    }
    onChange(formatResult(newDate, time, timezone));
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    const dateToUse = selectedDate ?? new Date();
    setSelectedDate(dateToUse);
    onChange(formatResult(dateToUse, newTime, timezone));
  };

  const handleTimezoneChange = (newTz: string) => {
    setTimezone(newTz);
    if (selectedDate) {
      onChange(formatResult(selectedDate, time, newTz));
    }
  };

  const handleClear = () => {
    setSelectedDate(undefined);
    onChange("");
  };

  const canClear = Boolean(value) && !disabled;

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative flex items-center">
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                "h-10 w-full justify-start px-3 text-left font-normal transition-colors",
                canClear && "pr-9",
                !value && "text-muted-foreground",
                className,
              )}
            >
              <CalendarIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
              {/* biome-ignore lint/nursery/useNullishCoalescing: empty string should fall back to placeholder */}
              <span className="flex-1 truncate">{value || placeholder}</span>
              {!canClear && <Clock className="ml-2 size-4 shrink-0 text-muted-foreground opacity-60" />}
            </Button>
          </PopoverTrigger>

          {canClear && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Clear date & time"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="absolute top-1/2 right-1.5 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
              <span className="sr-only">Clear date & time</span>
            </Button>
          )}
        </div>

        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-1">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelectDate}
              defaultMonth={selectedDate || new Date()}
              className="rounded-md"
            />
          </div>

          <div className="space-y-3 border-t bg-muted/20 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Clock className="size-3.5 text-primary" />
                Time & Timezone
              </span>
              {selectedDate && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatResult(selectedDate, time, timezone)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="h-8 flex-1 font-mono text-xs"
              />
              <Select value={timezone} onValueChange={handleTimezoneChange}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue placeholder="TZ" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick time preset chips */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[11px] text-muted-foreground">Presets:</span>
              {QUICK_TIME_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={time === preset ? "secondary" : "outline"}
                  size="sm"
                  className="h-6 px-2 font-mono text-[11px]"
                  onClick={() => handleTimeChange(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>

            {/* Manual text toggle fallback */}
            <div className="flex items-center justify-between border-t pt-2 text-[11px]">
              <button
                type="button"
                onClick={() => setIsManualMode(!isManualMode)}
                className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {isManualMode ? "Hide manual edit" : "Edit as plain text"}
              </button>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1 text-destructive hover:underline"
                >
                  <RotateCcw className="size-3" />
                  Clear
                </button>
              )}
            </div>

            {isManualMode && (
              <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="e.g. Saturday, Nov 14, 2026 • 09:00 WIB"
                className="h-8 text-xs"
              />
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
