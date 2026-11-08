"use client";

import * as React from "react";

import { Clock } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function TimePicker({ value = "09:00", onChange, className, disabled = false }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [typedValue, setTypedValue] = React.useState(value || "09:00");

  const hourListRef = React.useRef<HTMLDivElement>(null);
  const minuteListRef = React.useRef<HTMLDivElement>(null);

  // Parse hour & minute
  const [currentHour, currentMinute] = React.useMemo(() => {
    const parts = (value || "09:00").split(":");
    const h = (parts[0] || "09").padStart(2, "0");
    const m = (parts[1] || "00").padStart(2, "0");
    return [h, m];
  }, [value]);

  // Keep typed input in sync with external value
  React.useEffect(() => {
    setTypedValue(value || "09:00");
  }, [value]);

  // Auto-scroll selected items into view when opened or value changes
  React.useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const selectedHourEl = hourListRef.current?.querySelector<HTMLElement>("[data-selected='true']");
      const selectedMinuteEl = minuteListRef.current?.querySelector<HTMLElement>("[data-selected='true']");
      selectedHourEl?.scrollIntoView({ block: "center", behavior: "smooth" });
      selectedMinuteEl?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  const handleHourSelect = (newH: string) => {
    const newVal = `${newH}:${currentMinute}`;
    setTypedValue(newVal);
    onChange(newVal);
  };

  const handleMinuteSelect = (newM: string) => {
    const newVal = `${currentHour}:${newM}`;
    setTypedValue(newVal);
    onChange(newVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputStr = e.target.value;
    setTypedValue(inputStr);

    // Validate if it matches HH:mm or H:m
    const match = inputStr.match(/^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9])$/);
    if (match) {
      const h = match[1].padStart(2, "0");
      const m = match[2].padStart(2, "0");
      onChange(`${h}:${m}`);
    }
  };

  const handleInputBlur = () => {
    // If invalid format on blur, restore valid value
    const match = typedValue.match(/^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9])$/);
    if (match) {
      const h = match[1].padStart(2, "0");
      const m = match[2].padStart(2, "0");
      const normalized = `${h}:${m}`;
      setTypedValue(normalized);
      onChange(normalized);
    } else {
      setTypedValue(`${currentHour}:${currentMinute}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <div
        className={cn(
          "flex h-8 flex-1 items-center rounded-md border border-input bg-background font-mono text-xs shadow-xs transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <input
          type="text"
          value={typedValue}
          disabled={disabled}
          placeholder="HH:mm"
          maxLength={5}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => !disabled && setOpen(true)}
          className="h-full w-full bg-transparent px-2.5 font-mono text-xs outline-none"
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex h-full items-center px-2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
            title="Toggle time dropdown"
          >
            <Clock className="size-3.5 opacity-70" />
            <span className="sr-only">Toggle time dropdown</span>
          </button>
        </PopoverTrigger>
      </div>

      <PopoverContent className="w-auto p-2" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center gap-1.5">
          {/* Hours column */}
          <div className="flex flex-col items-center">
            <span className="mb-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">HH</span>
            <div
              ref={hourListRef}
              onWheel={(e) => e.stopPropagation()}
              className="h-48 w-14 overflow-y-auto overscroll-contain rounded-md border border-border/80 bg-background/50 p-1 touch-pan-y [scrollbar-width:thin]"
            >
              <div className="flex flex-col gap-0.5">
                {HOURS.map((h) => {
                  const isSelected = h === currentHour;
                  return (
                    <button
                      key={h}
                      type="button"
                      data-selected={isSelected}
                      className={cn(
                        "flex h-7 w-full items-center justify-center rounded-md font-mono text-xs transition-colors",
                        isSelected
                          ? "bg-foreground font-semibold text-background shadow-xs dark:bg-primary dark:text-primary-foreground"
                          : "text-foreground hover:bg-muted/70",
                      )}
                      onClick={() => handleHourSelect(h)}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <span className="mt-4 font-bold font-mono text-muted-foreground text-sm">:</span>

          {/* Minutes column */}
          <div className="flex flex-col items-center">
            <span className="mb-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">MM</span>
            <div
              ref={minuteListRef}
              onWheel={(e) => e.stopPropagation()}
              className="h-48 w-14 overflow-y-auto overscroll-contain rounded-md border border-border/80 bg-background/50 p-1 touch-pan-y [scrollbar-width:thin]"
            >
              <div className="flex flex-col gap-0.5">
                {MINUTES.map((m) => {
                  const isSelected = m === currentMinute;
                  return (
                    <button
                      key={m}
                      type="button"
                      data-selected={isSelected}
                      className={cn(
                        "flex h-7 w-full items-center justify-center rounded-md font-mono text-xs transition-colors",
                        isSelected
                          ? "bg-foreground font-semibold text-background shadow-xs dark:bg-primary dark:text-primary-foreground"
                          : "text-foreground hover:bg-muted/70",
                      )}
                      onClick={() => handleMinuteSelect(m)}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
