"use client";

import * as React from "react";

import { format, isPast, parseISO } from "date-fns";
import { Calendar, Check, CheckCircle2, Clock, Copy, Layers, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { fetchPublishedEventsAction } from "@/app/(main)/dashboard/email-manager/_actions/fetch-published-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BevyAgenda, BevyAgendaDay } from "@/lib/bevy/types";
import { toTimezoneDate } from "@/lib/date-utils";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface CopyAgendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEventId: string;
  onApplyAgenda: (days: BevyAgendaDay[], sourceTitle: string) => void;
}

interface EventAgendaOption {
  id: string;
  title: string;
  startDate: string;
  formattedDate: string;
  status: "Completed" | "Published" | "Draft" | "Canceled";
  agendaDays: BevyAgendaDay[];
  totalActivities: number;
}

function parseAgendaToDays(rawAgenda?: BevyAgenda): BevyAgendaDay[] {
  if (!rawAgenda) return [];
  const rec = rawAgenda as Record<string, unknown>;
  const rawDays = Array.isArray(rawAgenda.days)
    ? rawAgenda.days
    : Array.isArray(rawAgenda)
      ? (rawAgenda as BevyAgendaDay[])
      : [];

  if (rec.empty === true && rawDays.length === 0) return [];

  if (rawDays.length > 0) {
    const first = rawDays[0] as Record<string, unknown>;
    if (first && ("items" in first || "agenda" in first || "title" in first)) {
      return rawDays.map((day) => ({
        title: day.title ?? "",
        agenda: (day.agenda ?? day.items ?? []).map((item) => ({
          time: item.time || "",
          activity: item.activity || "",
          description: item.description || "",
          audience_type: item.audience_type || "IN_PERSON",
        })),
      }));
    }
  }

  return [];
}

export function CopyAgendaDialog({ open, onOpenChange, currentEventId, onApplyAgenda }: CopyAgendaDialogProps) {
  const [events, setEvents] = React.useState<EventAgendaOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedEventId, setSelectedEventId] = React.useState<string>("");
  const [filterMode, setFilterMode] = React.useState<"with_agenda" | "all">("with_agenda");

  React.useEffect(() => {
    if (!open) return;

    let active = true;
    async function loadEvents() {
      setIsLoading(true);
      try {
        const { getFirestoreEvents } = await import("@/lib/firestore/client");
        const [firestoreDocs, bevyResult] = await Promise.all([
          getFirestoreEvents(500, true),
          fetchPublishedEventsAction().catch(() => ({ success: true, events: [] })),
        ]);

        if (!active) return;

        const eventsById = new Map<string, EventAgendaOption>();

        for (const doc of firestoreDocs) {
          const docId = String(doc.id);
          if (docId === String(currentEventId)) continue;

          const rawStart = doc.start_date;
          let isCompleted = doc.status === "Completed";
          let formattedDate = "Date TBD";

          if (rawStart) {
            try {
              const parsed = parseISO(rawStart);
              formattedDate = format(toTimezoneDate(parsed), "dd MMM yyyy, h:mm a");
              if (!isCompleted && isPast(parsed)) {
                isCompleted = true;
              }
            } catch {
              formattedDate = rawStart;
            }
          }

          const rawStatus = doc.status || (isCompleted ? "Completed" : "Published");
          let finalStatus: "Completed" | "Published" | "Draft" | "Canceled" = "Published";
          if (rawStatus === "Completed" || isCompleted) {
            finalStatus = "Completed";
          } else if (rawStatus === "Draft") {
            finalStatus = "Draft";
          } else if (rawStatus === "Canceled") {
            finalStatus = "Canceled";
          }

          const agendaDays = parseAgendaToDays(doc.agenda);
          const totalActivities = agendaDays.reduce((acc, d) => acc + (d.agenda?.length ?? 0), 0);

          eventsById.set(docId, {
            id: docId,
            title: doc.title || "Untitled Event",
            startDate: rawStart || "",
            formattedDate,
            status: finalStatus,
            agendaDays,
            totalActivities,
          });
        }

        // Also check any Bevy events that might have agenda directly
        for (const be of bevyResult.events || []) {
          const beId = String(be.id);
          if (beId === String(currentEventId) || eventsById.has(beId)) continue;

          let isCompleted = false;
          let formattedDate = be.formattedDate || "Date TBD";
          if (be.startDate) {
            try {
              const parsed = parseISO(be.startDate);
              formattedDate = format(toTimezoneDate(parsed), "dd MMM yyyy, h:mm a");
              if (isPast(parsed)) isCompleted = true;
            } catch {
              formattedDate = be.startDate;
            }
          }

          eventsById.set(beId, {
            id: beId,
            title: be.title,
            startDate: be.startDate || "",
            formattedDate,
            status: isCompleted ? "Completed" : "Published",
            agendaDays: [],
            totalActivities: 0,
          });
        }

        const sorted = Array.from(eventsById.values()).sort((a, b) => {
          if (a.totalActivities > 0 && b.totalActivities === 0) return -1;
          if (b.totalActivities > 0 && a.totalActivities === 0) return 1;
          const timeA = a.startDate ? new Date(a.startDate).getTime() : 0;
          const timeB = b.startDate ? new Date(b.startDate).getTime() : 0;
          return timeB - timeA;
        });

        setEvents(sorted);

        const firstWithAgenda = sorted.find((e) => e.agendaDays.length > 0);
        if (firstWithAgenda) {
          setSelectedEventId(firstWithAgenda.id);
        }
      } catch (err) {
        console.error("[CopyAgendaDialog] Failed to load events:", err);
        toast.error("Failed to load events for agenda copying.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadEvents();
    return () => {
      active = false;
    };
  }, [open, currentEventId]);

  const filteredEvents = React.useMemo(() => {
    let list = events;
    if (filterMode === "with_agenda") {
      list = list.filter((e) => e.agendaDays.length > 0);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((e) => e.title.toLowerCase().includes(q));
    }
    return list;
  }, [events, filterMode, searchQuery]);

  const selectedEvent = React.useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  const handleApply = () => {
    if (!selectedEvent || selectedEvent.agendaDays.length === 0) {
      toast.error("Please select an event that has an agenda configured.");
      return;
    }

    onApplyAgenda(selectedEvent.agendaDays, selectedEvent.title);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full max-w-none sm:max-w-3xl lg:max-w-4xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Copy className="size-5 text-primary" />
            <DialogTitle className="text-base sm:text-lg">Copy Agenda from Existing Event</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Select an event to clone its schedule timeline, tracks, and session start/end times into this event.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events by title..."
                className="h-9 pl-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/20 p-1 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode("with_agenda")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filterMode === "with_agenda"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                With Agenda ({events.filter((e) => e.agendaDays.length > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filterMode === "all"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                All ({events.length})
              </button>
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="flex-1 min-h-[260px] overflow-hidden border rounded-lg mt-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center text-xs text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary mb-2" />
              <span>Loading events...</span>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center text-xs text-muted-foreground">
              <Layers className="size-8 text-muted-foreground/40 mb-2" />
              <span className="font-medium">No matching events found</span>
              <span className="text-[11px] text-muted-foreground mt-0.5">
                {filterMode === "with_agenda"
                  ? "None of the events have agenda tracks. Try switching to 'All' or creating tracks manually."
                  : "Try adjusting your search query."}
              </span>
            </div>
          ) : (
            <ScrollArea className="h-[280px]">
              <RadioGroup
                value={selectedEventId}
                onValueChange={setSelectedEventId}
                className="divide-y divide-border/50"
              >
                {filteredEvents.map((ev) => {
                  const isSelected = selectedEventId === ev.id;
                  const hasAgenda = ev.agendaDays.length > 0;
                  return (
                    <label
                      key={ev.id}
                      htmlFor={`ev-${ev.id}`}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3 text-xs transition-colors cursor-pointer hover:bg-muted/30",
                        isSelected && "bg-primary/5",
                        !hasAgenda && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <RadioGroupItem id={`ev-${ev.id}`} value={ev.id} disabled={!hasAgenda} className="shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate text-xs">{ev.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <span>{ev.formattedDate}</span>
                            <span>•</span>
                            <span className="capitalize">{ev.status}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasAgenda ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-normal"
                          >
                            {ev.agendaDays.length} Track{ev.agendaDays.length === 1 ? "" : "s"} · {ev.totalActivities}{" "}
                            Session{ev.totalActivities === 1 ? "" : "s"}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">No agenda</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </ScrollArea>
          )}
        </div>

        {/* Selected Event Preview */}
        {selectedEvent && selectedEvent.agendaDays.length > 0 && (
          <div className="rounded-lg border bg-muted/20 p-3 mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Preview: {selectedEvent.agendaDays.length} Track(s), {selectedEvent.totalActivities} Total
                Activity/Activities
              </span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{selectedEvent.title}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] max-h-28 overflow-y-auto pr-1">
              {selectedEvent.agendaDays.map((day, dIdx) => (
                <div key={dIdx} className="rounded-md border bg-background p-2">
                  <span className="font-semibold text-foreground block truncate">
                    {day.title || (selectedEvent.agendaDays.length > 1 ? `Day ${dIdx + 1}` : "Main Session")} (
                    {day.agenda?.length ?? 0} items)
                  </span>
                  <div className="mt-1 space-y-0.5 text-muted-foreground">
                    {(day.agenda ?? []).slice(0, 3).map((item, iIdx) => (
                      <p key={iIdx} className="truncate">
                        • {item.time ? `${item.time}: ` : ""}
                        {item.activity}
                      </p>
                    ))}
                    {(day.agenda?.length ?? 0) > 3 && (
                      <p className="text-[10px] text-primary italic">
                        + {(day.agenda?.length ?? 0) - 3} more session(s)
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selectedEvent || selectedEvent.agendaDays.length === 0}
            onClick={handleApply}
            className="gap-1.5"
          >
            <Check className="size-3.5" />
            <span>Apply Agenda</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
