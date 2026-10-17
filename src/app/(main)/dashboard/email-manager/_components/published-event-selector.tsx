"use client";

import { useMemo, useState } from "react";

import { Calendar, ChevronsUpDown, Loader2, RefreshCw } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { PublishedEventOption } from "../_actions/fetch-published-events";

interface PublishedEventSelectorProps {
  events: PublishedEventOption[];
  selectedEventId?: string;
  onSelectEvent: (event: PublishedEventOption) => void;
  isLoading?: boolean;
  isLoadingDetail?: boolean;
  disabled?: boolean;
  error?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function PublishedEventSelector({
  events,
  selectedEventId,
  onSelectEvent,
  isLoading = false,
  isLoadingDetail = false,
  disabled = false,
  error = false,
  onRefresh,
  isRefreshing = false,
}: PublishedEventSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId);
  }, [events, selectedEventId]);

  const renderTriggerContent = () => {
    if (isLoading || isRefreshing) {
      return (
        <div className="flex items-center gap-2 py-1 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>{isRefreshing ? "Refreshing Bevy events..." : "Loading Bevy chapter events..."}</span>
        </div>
      );
    }

    if (isLoadingDetail) {
      return (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="flex items-center gap-1.5 pr-1 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin text-primary" />
            <span className="hidden sm:inline">Loading event...</span>
          </div>
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
            <span className="font-semibold text-[11px] text-sky-600 dark:text-sky-400">
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

  const isBusy = (isLoading ? true : isRefreshing) ? true : isLoadingDetail;
  const isDisabled = disabled ? true : isBusy;

  return (
    <div className="flex w-full items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={isDisabled}
            className={cn(
              "h-auto min-h-10 flex-1 justify-between px-3 py-2 text-left font-normal transition-colors",
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
              <CommandGroup
                heading={
                  <div className="flex items-center justify-between pr-1">
                    <span>Bevy Chapter Events ({events.length})</span>
                    {onRefresh && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRefresh();
                        }}
                        disabled={isDisabled}
                        className="inline-flex cursor-pointer items-center gap-1 font-normal text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <RefreshCw className={cn("size-3", isRefreshing && "animate-spin")} />
                        <span>Refresh</span>
                      </button>
                    )}
                  </div>
                }
              >
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
                          <span className="font-semibold text-[11px] text-sky-600 dark:text-sky-400">
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

      {onRefresh && (
        <Button
          type="button"
          variant="outline"
          onClick={onRefresh}
          disabled={isDisabled}
          title="Force refresh Bevy events"
          className="h-10 shrink-0 gap-1.5 px-3 text-xs"
        >
          <RefreshCw className={cn("size-3.5", isBusy && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      )}
    </div>
  );
}
