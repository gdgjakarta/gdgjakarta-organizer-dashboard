"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { CalendarDays, Clock, Copy, Layers, MapPin, Monitor, Network, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { TimePicker } from "@/components/time-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BevyAgenda, BevyAgendaDay, BevyAgendaItem } from "@/lib/bevy/types";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { updateBevyEventAction } from "@/server/bevy-actions";

import { CopyAgendaDialog } from "./copy-agenda-dialog";

interface BevyAgendaSectionProps {
  event: FirestoreEvent;
  agenda?: BevyAgenda;
  onAgendaUpdated?: (newAgenda: BevyAgenda) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  registerSyncHandler?: (handler: () => Promise<boolean>) => void;
  registerDiscardHandler?: (handler: () => void) => void;
}

// Helper to convert "HH:mm" (24h) to "hh:mm AM/PM" (12h)
function format24to12(time24: string): string {
  if (!time24) return "";
  const parts = time24.split(":");
  if (parts.length < 2) return time24;
  let h = Number.parseInt(parts[0], 10);
  const m = parts[1].padStart(2, "0");
  if (Number.isNaN(h)) return time24;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  const h12 = (h ? h : 12).toString().padStart(2, "0");
  return `${h12}:${m} ${ampm}`;
}

// Helper to convert "hh:mm AM/PM" or "HH:mm" to "HH:mm" for TimePicker
function parseTo24(timeStr: string): string {
  if (!timeStr) return "09:00";
  const trimmed = timeStr.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    let h = Number.parseInt(match12[1], 10);
    const m = match12[2].padStart(2, "0");
    const ampm = match12[3]?.toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${m}`;
  }
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = match24[1].padStart(2, "0");
    const m = match24[2].padStart(2, "0");
    return `${h}:${m}`;
  }
  return "09:00";
}

function parseInitialAgendaDays(rawAgenda?: BevyAgenda): BevyAgendaDay[] {
  if (!rawAgenda) return [];

  const rec = rawAgenda as Record<string, unknown>;
  const rawDays = Array.isArray(rawAgenda.days)
    ? rawAgenda.days
    : Array.isArray(rawAgenda)
      ? (rawAgenda as BevyAgendaDay[])
      : [];

  // Only consider empty if explicit empty flag AND no configured tracks/days
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
    return [
      {
        title: "",
        agenda: (rawDays as unknown as BevyAgendaItem[]).map((item) => ({
          time: item.time || "",
          activity: item.activity || "",
          description: item.description || "",
          audience_type: item.audience_type || "IN_PERSON",
        })),
      },
    ];
  }

  return [];
}

function formatAudienceBadge(type?: string) {
  if (type === "VIRTUAL") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 font-medium text-[10px] text-sky-700 tracking-wide dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300">
        <Monitor className="size-2.5 text-sky-600 dark:text-sky-400" />
        <span>Virtual</span>
      </span>
    );
  }
  if (type === "HYBRID") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/25 bg-purple-500/10 px-2 py-0.5 font-medium text-[10px] text-purple-700 tracking-wide dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300">
        <Network className="size-2.5 text-purple-600 dark:text-purple-400" />
        <span>Hybrid</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-medium text-[10px] text-emerald-700 tracking-wide dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
      <MapPin className="size-2.5 text-emerald-600 dark:text-emerald-400" />
      <span>In-Person</span>
    </span>
  );
}

export function BevyAgendaSection({
  event,
  agenda,
  onAgendaUpdated,
  onDirtyChange,
  registerSyncHandler,
  registerDiscardHandler,
}: BevyAgendaSectionProps) {
  const router = useRouter();
  const [days, setDays] = React.useState<BevyAgendaDay[]>(() => parseInitialAgendaDays(agenda));
  const initialDaysSnapshotRef = React.useRef<string>(JSON.stringify(parseInitialAgendaDays(agenda)));
  const [copyDialogOpen, setCopyDialogOpen] = React.useState(false);

  // Edit / Add Activity Modal state
  const [activityDialogOpen, setActivityDialogOpen] = React.useState(false);
  const [activeDayIndex, setActiveDayIndex] = React.useState<number>(0);
  const [editingItemIndex, setEditingItemIndex] = React.useState<number | null>(null);

  const [formStartTime, setFormStartTime] = React.useState("09:00");
  const [formEndTime, setFormEndTime] = React.useState("09:45");
  const [formActivity, setFormActivity] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");
  const [formAudienceType, setFormAudienceType] = React.useState<"IN_PERSON" | "VIRTUAL" | "HYBRID">("IN_PERSON");

  // Keep in sync if prop changes
  React.useEffect(() => {
    if (agenda) {
      const parsed = parseInitialAgendaDays(agenda);
      setDays(parsed);
      initialDaysSnapshotRef.current = JSON.stringify(parsed);
    }
  }, [agenda]);

  // Listen to window event if agenda was updated externally (e.g. from Breakout Sessions)
  React.useEffect(() => {
    const handleExternalAgenda = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId: string; agenda: BevyAgenda }>;
      if (customEvent.detail && String(customEvent.detail.eventId) === String(event.id)) {
        const parsed = parseInitialAgendaDays(customEvent.detail.agenda);
        setDays(parsed);
        initialDaysSnapshotRef.current = JSON.stringify(parsed);
      }
    };
    window.addEventListener("gdg:agenda-updated", handleExternalAgenda);
    return () => window.removeEventListener("gdg:agenda-updated", handleExternalAgenda);
  }, [event.id]);

  // Dirty state calculation
  const currentDaysSnapshot = JSON.stringify(days);
  const isDirty = initialDaysSnapshotRef.current !== currentDaysSnapshot;

  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleAddDay = () => {
    setDays((prev) => [...prev, { title: "", agenda: [] }]);
    toast.success("Added new agenda track/day.");
  };

  const handleRemoveDay = (dayIdx: number) => {
    setDays((prev) => prev.filter((_, idx) => idx !== dayIdx));
    toast.success("Removed agenda track/day.");
  };

  const handleUpdateDayTitle = (dayIdx: number, newTitle: string) => {
    setDays((prev) => prev.map((day, idx) => (idx === dayIdx ? { ...day, title: newTitle } : day)));
  };

  const openAddActivity = (dayIdx: number) => {
    setActiveDayIndex(dayIdx);
    setEditingItemIndex(null);
    setFormStartTime("09:00");
    setFormEndTime("09:45");
    setFormActivity("");
    setFormDescription("");
    setFormAudienceType("IN_PERSON");
    setActivityDialogOpen(true);
  };

  const openEditActivity = (dayIdx: number, itemIdx: number) => {
    const targetItem = days[dayIdx]?.agenda?.[itemIdx];
    if (!targetItem) return;
    setActiveDayIndex(dayIdx);
    setEditingItemIndex(itemIdx);

    const rawTime = targetItem.time || "";
    // If time is a range like "09:30 AM - 10:15 AM" or "09:30 - 10:15"
    if (rawTime.includes("-") || rawTime.includes("–")) {
      const parts = rawTime.split(/[-–]/);
      setFormStartTime(parseTo24(parts[0]));
      setFormEndTime(parseTo24(parts[1]));
    } else if (rawTime) {
      setFormStartTime(parseTo24(rawTime));
      setFormEndTime("");
    } else {
      setFormStartTime("09:00");
      setFormEndTime("09:45");
    }

    setFormActivity(targetItem.activity || "");
    setFormDescription(targetItem.description || "");
    setFormAudienceType((targetItem.audience_type as "IN_PERSON" | "VIRTUAL" | "HYBRID") || "IN_PERSON");
    setActivityDialogOpen(true);
  };

  const handleDeleteActivity = (dayIdx: number, itemIdx: number) => {
    setDays((prev) =>
      prev.map((day, dIdx) => {
        if (dIdx !== dayIdx) return day;
        const nextAgenda = (day.agenda ?? []).filter((_, iIdx) => iIdx !== itemIdx);
        return { ...day, agenda: nextAgenda };
      }),
    );
  };

  const handleSaveActivity = () => {
    if (!formActivity.trim()) {
      toast.error("Please enter an activity title or topic.");
      return;
    }

    const start12 = formStartTime ? format24to12(formStartTime) : "";
    const end12 = formEndTime ? format24to12(formEndTime) : "";
    const computedTime = start12 && end12 ? `${start12} - ${end12}` : start12 || end12;

    const newItem: BevyAgendaItem = {
      time: computedTime,
      activity: formActivity.trim(),
      description: formDescription.trim(),
      audience_type: formAudienceType,
    };

    setDays((prev) =>
      prev.map((day, dIdx) => {
        if (dIdx !== activeDayIndex) return day;
        const currentItems = [...(day.agenda ?? [])];
        if (editingItemIndex !== null) {
          currentItems[editingItemIndex] = newItem;
        } else {
          currentItems.push(newItem);
        }
        return { ...day, agenda: currentItems };
      }),
    );

    setActivityDialogOpen(false);
  };

  const handleDiscard = React.useCallback(() => {
    try {
      const snap = JSON.parse(initialDaysSnapshotRef.current) as BevyAgendaDay[];
      setDays(snap);
      toast.info("Discarded unsaved Bevy agenda changes.");
    } catch {
      // ignore
    }
  }, []);

  const handleSyncToBevy = React.useCallback(async (): Promise<boolean> => {
    try {
      const payloadAgenda: BevyAgenda = {
        multiday: days.length > 1,
        empty: days.length === 0 || days.every((d) => (d.agenda ?? []).length === 0),
        any_descriptions: days.some((d) => (d.agenda ?? []).some((i) => Boolean(i.description?.trim()))),
        days: days.map((d) => ({
          title: d.title ? d.title.trim() : "",
          agenda: d.agenda ?? [],
        })),
      };

      const result = await updateBevyEventAction(String(event.id), {
        agenda: payloadAgenda,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update agenda on Bevy.");
      }

      initialDaysSnapshotRef.current = JSON.stringify(days);
      onAgendaUpdated?.(payloadAgenda);
      toast.success("Agenda synchronized successfully to Bevy & Firestore!");
      router.refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync agenda to Bevy.");
      return false;
    }
  }, [days, event.id, onAgendaUpdated, router]);

  React.useEffect(() => {
    registerSyncHandler?.(handleSyncToBevy);
  }, [registerSyncHandler, handleSyncToBevy]);

  React.useEffect(() => {
    registerDiscardHandler?.(handleDiscard);
  }, [registerDiscardHandler, handleDiscard]);

  const totalActivities = days.reduce((acc, d) => acc + (d.agenda?.length ?? 0), 0);

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <CardTitle className="text-base sm:text-lg">Bevy Agenda Sessions (Timeline)</CardTitle>
          </div>
          <CardDescription className="mt-1">
            Build schedule tracks, session start/end times, and descriptions. Directly pushes to Bevy&apos;s public
            agenda API.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCopyDialogOpen(true)} className="h-8 gap-1.5 text-xs">
            <Copy className="size-3.5" />
            <span>Copy from Event</span>
          </Button>

          <Button size="sm" variant="outline" onClick={handleAddDay} className="h-8 gap-1.5 text-xs">
            <Plus className="size-3.5" />
            <span>Add Day / Track</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-0">
        {days.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 border-dashed py-10 text-center">
            <Layers className="mb-2 size-8 text-muted-foreground/40" />
            <p className="font-medium text-sm">No agenda tracks configured</p>
            <p className="mt-1 max-w-sm text-muted-foreground text-xs">
              Agenda is optional. Click &quot;Add Day / Track&quot; above if you want to publish session timelines to
              Bevy.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCopyDialogOpen(true)}
                className="h-8 gap-1.5 text-xs"
              >
                <Copy className="size-3.5" />
                <span>Copy from Existing Event</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleAddDay} className="h-8 gap-1.5 text-xs">
                <Plus className="size-3.5 text-primary" />
                <span>Add Day / Track</span>
              </Button>
            </div>
          </div>
        ) : (
          days.map((day, dIdx) => (
            <div key={dIdx} className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-border/40 border-b pb-3">
                <div className="flex max-w-xs flex-1 items-center gap-2">
                  <Layers className="size-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={day.title ?? ""}
                    onChange={(e) => handleUpdateDayTitle(dIdx, e.target.value)}
                    placeholder={`e.g. Day ${dIdx + 1}, Main Stage/Track, or Morning Session`}
                    className="h-8 font-semibold text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openAddActivity(dIdx)}
                    className="h-7 gap-1 px-2.5 text-primary text-xs hover:text-primary"
                  >
                    <Plus className="size-3" />
                    Add Activity
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveDay(dIdx)}
                    className="h-7 px-2 text-destructive text-xs hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>

              {/* Activities list */}
              {!day.agenda || day.agenda.length === 0 ? (
                <div className="rounded-lg border border-border/60 border-dashed py-6 text-center text-muted-foreground text-xs">
                  No activities yet for this track. Click &quot;Add Activity&quot; to add a session.
                </div>
              ) : (
                <div className="space-y-2">
                  {day.agenda.map((act, iIdx) => (
                    <div
                      key={iIdx}
                      className="flex flex-col justify-between gap-2.5 rounded-lg border border-border/50 bg-background p-3 text-xs transition-colors hover:border-border sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex shrink-0 items-center gap-1 rounded bg-muted/50 px-2 py-1 font-medium text-muted-foreground">
                          <Clock className="size-3 text-muted-foreground/80" />
                          <span>{act.time || "--:--"}</span>
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold text-foreground">{act.activity}</span>
                            {formatAudienceBadge(act.audience_type)}
                          </div>
                          {act.description && (
                            <p className="line-clamp-1 text-[11px] text-muted-foreground">{act.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditActivity(dIdx, iIdx)}
                          className="h-7 px-2 text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteActivity(dIdx, iIdx)}
                          className="h-7 px-2 text-destructive text-xs hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        <div className="flex items-center justify-between border-border/40 border-t pt-1 text-muted-foreground text-xs">
          <span>Total Tracks: {days.length}</span>
          <span>Total Sessions: {totalActivities}</span>
        </div>
      </CardContent>

      {/* Add / Edit Activity Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItemIndex !== null ? "Edit Agenda Activity" : "Add Agenda Activity"}</DialogTitle>
            <DialogDescription>Provide the session time, activity title, format, and description.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Time (Start – End)</Label>
                <div className="flex items-center gap-1.5">
                  <TimePicker value={formStartTime} onChange={setFormStartTime} className="h-8" />
                  <span className="text-muted-foreground text-xs">–</span>
                  <TimePicker value={formEndTime} onChange={setFormEndTime} className="h-8" />
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  Preview: {formStartTime ? format24to12(formStartTime) : "--:--"} –{" "}
                  {formEndTime ? format24to12(formEndTime) : "--:--"}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="agenda-audience" className="text-xs">
                  Format
                </Label>
                <Select
                  value={formAudienceType}
                  onValueChange={(val: "IN_PERSON" | "VIRTUAL" | "HYBRID") => setFormAudienceType(val)}
                >
                  <SelectTrigger id="agenda-audience" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN_PERSON">In-Person</SelectItem>
                    <SelectItem value="VIRTUAL">Virtual</SelectItem>
                    <SelectItem value="HYBRID">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agenda-title" className="font-semibold text-xs">
                Activity / Session Title *
              </Label>
              <Input
                id="agenda-title"
                placeholder="e.g. Keynote: Building AI Agents with Flutter & Gemini"
                value={formActivity}
                onChange={(e) => setFormActivity(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agenda-desc" className="text-xs">
                Description / Speakers Overview
              </Label>
              <Textarea
                id="agenda-desc"
                placeholder="Brief summary of what will be covered in this session..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                className="resize-none text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActivityDialogOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveActivity} className="text-xs">
              Save Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Agenda from Existing Event Dialog */}
      <CopyAgendaDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        currentEventId={String(event.id)}
        onApplyAgenda={(copiedDays, sourceTitle) => {
          setDays(copiedDays);
          toast.success(`Copied agenda from "${sourceTitle}". Click "Sync Agenda to Bevy" to publish.`);
        }}
      />
    </Card>
  );
}
