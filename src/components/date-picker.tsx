"use client";

import * as React from "react";

import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  id?: string;
  value?: string | null;
  onChange: (value: string) => void;
  withTime?: boolean;
  outputFormat?: "date" | "datetime-local" | "iso" | "display";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "default" | "sm";
  clearable?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

const COMMON_TIMEZONES = ["WIB", "WITA", "WIT", "UTC"] as const;
const QUICK_TIME_PRESETS = ["09:00", "10:00", "13:00", "18:30", "19:00"] as const;

function parseAnyDate(val?: string | null): { date: Date | undefined; time: string; timezone: string } {
  if (!val?.trim()) {
    return { date: undefined, time: "09:00", timezone: "WIB" };
  }
  const str = val.trim();

  // Case 1: Human string with bullet '•' (e.g. "Saturday, Nov 14, 2026 • 09:00 WIB")
  if (str.includes("•")) {
    const [dPart, tPart] = str.split("•").map((s) => s.trim());
    const d = new Date(dPart);
    let time = "09:00";
    let timezone = "WIB";
    if (tPart) {
      const mTime = tPart.match(/(\d{1,2}:\d{2})/);
      if (mTime) {
        time = mTime[1].padStart(5, "0");
      }
      const mTz = tPart.match(/\b(WIB|WITA|WIT|UTC|GMT[+-]?\d*)\b/i);
      if (mTz) {
        timezone = mTz[1].toUpperCase();
      }
    }
    return { date: Number.isNaN(d.getTime()) ? undefined : d, time, timezone };
  }

  // Case 2: YYYY-MM-DDTHH:mm or ISO string
  if (str.includes("T")) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return { date: d, time, timezone: "WIB" };
    }
  }

  // Case 3: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, day] = str.split("-").map(Number);
    const d = new Date(y, m - 1, day, 12, 0);
    return { date: d, time: "09:00", timezone: "WIB" };
  }

  // Case 4: Any standard parseable date
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { date: d, time, timezone: "WIB" };
  }

  return { date: undefined, time: "09:00", timezone: "WIB" };
}

function formatOutput(
  date: Date | undefined,
  time: string,
  outputFormat: "date" | "datetime-local" | "iso" | "display",
  timezone = "WIB",
): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  if (outputFormat === "date") {
    return ymd;
  }
  if (outputFormat === "datetime-local") {
    return `${ymd}T${time}`;
  }
  if (outputFormat === "iso") {
    const [h, m] = time.split(":").map(Number);
    const copy = new Date(date);
    copy.setHours(h ?? 9, m ?? 0, 0, 0);
    return copy.toISOString();
  }
  if (outputFormat === "display") {
    const formattedDate = format(date, "EEEE, MMM d, yyyy");
    const tzSuffix = timezone ? ` ${timezone}` : "";
    return `${formattedDate} • ${time}${tzSuffix}`;
  }
  return ymd;
}

export function DatePicker({
  id,
  value,
  onChange,
  withTime = false,
  outputFormat: explicitOutputFormat,
  placeholder,
  disabled = false,
  className,
  size = "default",
  clearable = true,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const effectiveOutputFormat = explicitOutputFormat ?? (withTime ? "datetime-local" : "date");

  const parsed = React.useMemo(() => parseAnyDate(value), [value]);

  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(parsed.date);
  const [time, setTime] = React.useState<string>(parsed.time);
  const [timezone, setTimezone] = React.useState<string>(parsed.timezone);

  React.useEffect(() => {
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
    const result = formatOutput(newDate, time, effectiveOutputFormat, timezone);
    onChange(result);
    if (!withTime) {
      setOpen(false);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    const dateToUse = selectedDate ?? new Date();
    setSelectedDate(dateToUse);
    const result = formatOutput(dateToUse, newTime, effectiveOutputFormat, timezone);
    onChange(result);
  };

  const handleTimezoneChange = (newTz: string) => {
    setTimezone(newTz);
    if (selectedDate) {
      const result = formatOutput(selectedDate, time, effectiveOutputFormat, newTz);
      onChange(result);
    }
  };

  const handleClear = () => {
    setSelectedDate(undefined);
    onChange("");
  };

  const displayLabel = React.useMemo(() => {
    if (!selectedDate) return null;
    if (effectiveOutputFormat === "display" && value?.includes("•")) {
      return value;
    }
    if (withTime) {
      return `${format(selectedDate, "d MMM yyyy")}, ${time}`;
    }
    return format(selectedDate, "d MMM yyyy");
  }, [selectedDate, withTime, time, effectiveOutputFormat, value]);

  const isSmall = size === "sm";

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
                "w-full justify-start text-left font-normal transition-colors",
                isSmall ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
                !displayLabel && "text-muted-foreground",
                className,
              )}
            >
              <CalendarIcon className={cn("mr-2 shrink-0 text-muted-foreground", isSmall ? "size-3.5" : "size-4")} />
              <span className="flex-1 truncate">
                {displayLabel || placeholder || (withTime ? "Pick date & time" : "Pick date")}
              </span>
              {withTime && (
                <Clock
                  className={cn("ml-2 shrink-0 text-muted-foreground opacity-60", isSmall ? "size-3" : "size-3.5")}
                />
              )}
            </Button>
          </PopoverTrigger>

          {clearable && Boolean(value) && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Clear date"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className={cn(
                "absolute right-2 text-muted-foreground hover:text-foreground",
                isSmall ? "size-6" : "size-7",
              )}
            >
              <X className={isSmall ? "size-3" : "size-3.5"} />
            </Button>
          )}
        </div>

        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-1">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelectDate}
              defaultMonth={selectedDate ?? new Date()}
              disabled={(d) => (minDate ? d < minDate : false) || (maxDate ? d > maxDate : false)}
              className="rounded-md"
            />
          </div>

          {withTime && (
            <div className="space-y-2.5 border-t bg-muted/20 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="size-3.5 text-primary" />
                  Time & Timezone
                </span>
                {selectedDate && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {format(selectedDate, "d MMM yyyy")}, {time} {timezone}
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
                  <SelectTrigger className="h-8 w-24 font-medium text-xs">
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
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
