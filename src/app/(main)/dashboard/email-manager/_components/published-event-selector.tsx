"use client";

import { useMemo, useState } from "react";

import { Calendar, ChevronsUpDown, Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { PublishedEventOption } from "../_actions/fetch-published-events";

interface PublishedEventSelectorProps {
  events: PublishedEventOption[];
  selectedEventId?: string;
  onSelectEvent: (event: PublishedEventOption) => void;
  isLoading?: boolean;
  disabled?: boolean;
  error?: boolean;
}

export function PublishedEventSelector({
  events,
  selectedEventId,
  onSelectEvent,
  isLoading = false,
  disabled = false,
  error = false,
}: PublishedEventSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId);
  }, [events, selectedEventId]);

  const renderTriggerContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 py-1 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Loading Bevy chapter events...</span>
        </div>
      );
    }

    if (selectedEvent) {
      return (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar className="size-9 shrink-0 rounded-lg border bg-muted/40">
            {selectedEvent.thumbnailUrl && (
              <AvatarImage src={selectedEvent.thumbnailUrl} alt={selectedEvent.title} className="object-cover" />
            )}
            <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
              <Calendar className="size-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col text-left">
            <span className="font-semibold text-[11px] text-sky-600 uppercase tracking-wider dark:text-sky-400">
              {selectedEvent.formattedDate}
            </span>
            <span className="truncate font-medium text-foreground text-sm">{selectedEvent.title}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 py-1 text-muted-foreground text-sm">
        <Calendar className="size-4 text-muted-foreground" />
        <span>Select Bevy event...</span>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled ? true : isLoading}
          className={cn(
            "h-auto w-full justify-between px-3 py-2 text-left font-normal transition-colors",
            error && "border-destructive ring-1 ring-destructive",
            !selectedEvent && "text-muted-foreground",
          )}
        >
          {renderTriggerContent()}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search Bevy events by title or date..." />
          <CommandList className="max-h-80">
            <CommandEmpty>No events found on Bevy.</CommandEmpty>
            <CommandGroup heading={`Bevy Chapter Events (${events.length})`}>
              {events.map((event) => {
                const isSelected = event.id === selectedEventId;
                return (
                  <CommandItem
                    key={event.id}
                    value={`${event.title} ${event.formattedDate} ${event.venueName ?? ""}`}
                    data-checked={isSelected}
                    onSelect={() => {
                      onSelectEvent(event);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 transition-colors aria-selected:bg-accent group-data-[checked=true]/command-item:[&>svg:last-child]:text-primary"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar className="size-8.5 shrink-0 rounded-lg border bg-muted/40">
                        {event.thumbnailUrl && (
                          <AvatarImage src={event.thumbnailUrl} alt={event.title} className="object-cover" />
                        )}
                        <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                          <Calendar className="size-3.5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col text-left">
                        {/* Styled Uppercase Date matching Bevy UI */}
                        <span className="font-semibold text-[11px] text-sky-600 uppercase tracking-wider dark:text-sky-400">
                          {event.formattedDate}
                        </span>
                        <span className="truncate font-medium text-foreground text-sm">{event.title}</span>
                        {event.venueName && (
                          <span className="truncate text-[11px] text-muted-foreground">{event.venueName}</span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
