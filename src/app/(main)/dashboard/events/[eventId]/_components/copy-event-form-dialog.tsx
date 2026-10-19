"use client";

import { useEffect, useMemo, useState } from "react";

import { format, isPast, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Layers,
  ListChecks,
  Loader2,
  Search,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";

import { fetchPublishedEventsAction } from "@/app/(main)/dashboard/email-manager/_actions/fetch-published-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toTimezoneDate } from "@/lib/date-utils";
import type { CustomQuestion, EventSession, EventTicketTier, FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

export interface CopiedFormData {
  sourceEventTitle: string;
  sourceEventId: string;
  questions: CustomQuestion[];
  replaceQuestions: boolean;
  policy?: {
    requiresApproval: boolean;
    allowWaitlist: boolean;
    maxAttendees: string;
  };
  sessions?: EventSession[];
  default_session_name?: string;
  default_session_time?: string;
  default_session_checkin_deadline?: string;
  default_session_location?: string;
  default_session_location_url?: string;
  tickets?: EventTicketTier[];
}

interface CopyEventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEventId: string;
  onApplyCopy: (data: CopiedFormData) => void;
}

interface EnrichedEventOption {
  id: string;
  title: string;
  startDate: string;
  formattedDate: string;
  status: "Completed" | "Published" | "Draft" | "Canceled";
  isCompleted: boolean;
  questions: CustomQuestion[];
  sessions: EventSession[];
  defaultSessionName?: string;
  defaultSessionTime?: string;
  defaultSessionCheckinDeadline?: string;
  defaultSessionLocation?: string;
  defaultSessionLocationUrl?: string;
  tickets: EventTicketTier[];
  requiresApproval: boolean;
  allowWaitlist: boolean;
  maxAttendees?: string;
  thumbnailUrl?: string;
  venueName?: string;
}

export function CopyEventFormDialog({ open, onOpenChange, currentEventId, onApplyCopy }: CopyEventFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<EnrichedEventOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "completed" | "upcoming" | "has_form">("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"select" | "preview">("select");

  // Copy customization states
  const [copyMode, setCopyMode] = useState<"replace" | "append">("replace");
  const [copyQuestions, setCopyQuestions] = useState(true);
  const [copyPolicy, setCopyPolicy] = useState(false);
  const [copySessions, setCopySessions] = useState(false);
  const [copyTickets, setCopyTickets] = useState(false);

  // Section accordion state for question preview
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Load events when dialog opens
  useEffect(() => {
    if (!open) {
      setSelectedEventId(null);
      setSearchQuery("");
      setMobileTab("select");
      return;
    }

    setMobileTab("select");

    let isMounted = true;
    async function loadEventsData() {
      setIsLoading(true);
      try {
        const { getFirestoreEvents } = await import("@/lib/firestore/client");
        const [firestoreDocs, bevyResult] = await Promise.all([
          getFirestoreEvents(500, true),
          fetchPublishedEventsAction(),
        ]);

        if (!isMounted) return;

        const bevyMap = new Map<string, (typeof bevyResult.events)[0]>();
        if (bevyResult.success && bevyResult.events) {
          for (const be of bevyResult.events) {
            bevyMap.set(String(be.id), be);
          }
        }

        const eventsById = new Map<string, EnrichedEventOption>();

        // 1. Process Firestore events (which contain custom_questions, sessions, tickets)
        for (const doc of firestoreDocs) {
          const docId = String(doc.id);
          if (docId === String(currentEventId)) continue;

          const bevyMatch = bevyMap.get(docId);
          const rawStart = doc.start_date || bevyMatch?.startDate || "";

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

          const questions = doc.custom_questions && Array.isArray(doc.custom_questions) ? doc.custom_questions : [];
          const sessions = doc.sessions && Array.isArray(doc.sessions) ? doc.sessions : [];
          const tickets = doc.tickets && Array.isArray(doc.tickets) ? doc.tickets : [];

          eventsById.set(docId, {
            id: docId,
            title: doc.title || bevyMatch?.title || "Untitled Event",
            startDate: rawStart,
            formattedDate,
            status: finalStatus,
            isCompleted,
            questions,
            sessions,
            defaultSessionName: doc.default_session_name,
            defaultSessionTime: doc.default_session_time,
            defaultSessionCheckinDeadline: doc.default_session_checkin_deadline,
            defaultSessionLocation: doc.default_session_location,
            defaultSessionLocationUrl: doc.default_session_location_url,
            tickets,
            requiresApproval: Boolean(
              doc.requires_approval || (doc as unknown as Record<string, unknown>).curation_mode,
            ),
            allowWaitlist: doc.allow_waitlist !== false,
            maxAttendees: doc.max_attendees ? String(doc.max_attendees) : "",
            thumbnailUrl: doc.picture_url || doc.banner_url || bevyMatch?.thumbnailUrl || bevyMatch?.bannerUrl,
            venueName: doc.venue?.name || bevyMatch?.venueName,
          });
        }

        // 2. Include any Bevy events not yet explicitly in Firestore
        for (const be of bevyResult.events || []) {
          const beId = String(be.id);
          if (beId === String(currentEventId) || eventsById.has(beId)) continue;

          let isCompleted = false;
          let formattedDate = be.formattedDate || "Date TBD";
          if (be.startDate) {
            try {
              const parsed = parseISO(be.startDate);
              formattedDate = format(toTimezoneDate(parsed), "dd MMM yyyy, h:mm a");
              if (isPast(parsed)) {
                isCompleted = true;
              }
            } catch {
              formattedDate = be.startDate;
            }
          }

          eventsById.set(beId, {
            id: beId,
            title: be.title,
            startDate: be.startDate,
            formattedDate,
            status: isCompleted ? "Completed" : "Published",
            isCompleted,
            questions: [],
            sessions: [],
            tickets: [],
            requiresApproval: false,
            allowWaitlist: true,
            maxAttendees: "",
            thumbnailUrl: be.thumbnailUrl || be.bannerUrl,
            venueName: be.venueName,
          });
        }

        // Sort: events with questions first, then by date descending
        const sorted = Array.from(eventsById.values()).sort((a, b) => {
          const aHasQ = a.questions.length > 0 ? 1 : 0;
          const bHasQ = b.questions.length > 0 ? 1 : 0;
          if (aHasQ !== bHasQ) return bHasQ - aHasQ;

          const timeA = a.startDate ? new Date(a.startDate).getTime() : 0;
          const timeB = b.startDate ? new Date(b.startDate).getTime() : 0;
          return timeB - timeA;
        });

        setEvents(sorted);

        // Pre-select the first event that has questions if available
        const firstWithForm = sorted.find((e) => e.questions.length > 0);
        if (firstWithForm) {
          setSelectedEventId(firstWithForm.id);
        } else if (sorted.length > 0) {
          setSelectedEventId(sorted[0]?.id ?? null);
        }
      } catch (err) {
        console.error("[CopyEventFormDialog] Failed to load events:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadEventsData();

    return () => {
      isMounted = false;
    };
  }, [open, currentEventId]);

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // On-demand fallback: if an event is selected and has 0 questions, check if Firestore has it directly
  useEffect(() => {
    if (!selectedEventId || !open) return;
    const current = events.find((e) => e.id === selectedEventId);
    if (current && current.questions.length === 0) {
      let isMounted = true;
      void (async () => {
        try {
          const { getFirestoreEventById } = await import("@/lib/firestore/client");
          const doc = await getFirestoreEventById(selectedEventId);
          if (!isMounted || !doc) return;
          const questions = doc.custom_questions && Array.isArray(doc.custom_questions) ? doc.custom_questions : [];
          if (questions.length > 0) {
            setEvents((prev) =>
              prev.map((ev) => {
                if (ev.id !== selectedEventId) return ev;
                return {
                  ...ev,
                  questions,
                  sessions: doc.sessions && Array.isArray(doc.sessions) ? doc.sessions : ev.sessions,
                  tickets: doc.tickets && Array.isArray(doc.tickets) ? doc.tickets : ev.tickets,
                  requiresApproval: Boolean(
                    doc.requires_approval || (doc as unknown as Record<string, unknown>).curation_mode,
                  ),
                  allowWaitlist: doc.allow_waitlist !== false,
                  maxAttendees: doc.max_attendees ? String(doc.max_attendees) : ev.maxAttendees,
                };
              }),
            );
          }
        } catch (err) {
          console.error("[CopyEventFormDialog] Error fetching single event details:", err);
        }
      })();
      return () => {
        isMounted = false;
      };
    }
  }, [selectedEventId, open, events]);

  // Group questions by section for clean preview
  const questionsBySection = useMemo(() => {
    if (!selectedEvent || selectedEvent.questions.length === 0) return {};
    const grouped: Record<string, CustomQuestion[]> = {};
    for (const q of selectedEvent.questions) {
      const section = q.section || "General Information";
      if (!grouped[section]) grouped[section] = [];
      grouped[section]?.push(q);
    }
    return grouped;
  }, [selectedEvent]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // 1. Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = e.title.toLowerCase().includes(query);
        const matchesDate = e.formattedDate.toLowerCase().includes(query);
        const matchesVenue = e.venueName?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDate && !matchesVenue) return false;
      }

      // 2. Tab filter
      if (activeFilter === "completed" && !e.isCompleted) return false;
      if (activeFilter === "upcoming" && e.isCompleted) return false;
      if (activeFilter === "has_form" && e.questions.length === 0) return false;

      return true;
    });
  }, [events, searchQuery, activeFilter]);

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleApply = () => {
    if (!selectedEvent) return;

    if (!copyQuestions && !copyPolicy && !copySessions && !copyTickets) {
      return;
    }

    // 1. Re-key questions safely
    const now = Date.now();
    const clonedQuestions: CustomQuestion[] = copyQuestions
      ? selectedEvent.questions.map((q, idx) => {
          // Keep standard IDs for standard locked questions
          const isStandardId =
            q.id === "full_name" ||
            q.id === "email" ||
            q.id === "whatsapp" ||
            q.id === "institution" ||
            q.id === "current_job_role" ||
            q.id === "linkedin_url";

          return {
            ...q,
            id: isStandardId ? q.id : `q_${now}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            options: q.options ? [...q.options] : undefined,
          };
        })
      : [];

    // 2. Clone sessions with fresh IDs
    const clonedSessions: EventSession[] | undefined =
      copySessions && selectedEvent.sessions.length > 0
        ? selectedEvent.sessions.map((sess, idx) => ({
            ...sess,
            id: `sess_${now}_${idx}`,
            total_registered: 0,
            related_links: sess.related_links ? [...sess.related_links] : undefined,
          }))
        : undefined;

    // 3. Clone tickets with fresh IDs
    const clonedTickets: EventTicketTier[] | undefined =
      copyTickets && selectedEvent.tickets.length > 0
        ? selectedEvent.tickets.map((t, idx) => ({
            ...t,
            id: t.id.startsWith("regular") ? t.id : `ticket_${now}_${idx}`,
            total_registered: 0,
            perks: t.perks ? [...t.perks] : undefined,
          }))
        : undefined;

    // 4. Policy settings
    const policyData = copyPolicy
      ? {
          requiresApproval: selectedEvent.requiresApproval,
          allowWaitlist: selectedEvent.allowWaitlist,
          maxAttendees: selectedEvent.maxAttendees || "",
        }
      : undefined;

    onApplyCopy({
      sourceEventTitle: selectedEvent.title,
      sourceEventId: selectedEvent.id,
      questions: clonedQuestions,
      replaceQuestions: copyMode === "replace",
      policy: policyData,
      sessions: clonedSessions,
      default_session_name: copySessions ? selectedEvent.defaultSessionName : undefined,
      default_session_time: copySessions ? selectedEvent.defaultSessionTime : undefined,
      default_session_checkin_deadline: copySessions ? selectedEvent.defaultSessionCheckinDeadline : undefined,
      default_session_location: copySessions ? selectedEvent.defaultSessionLocation : undefined,
      default_session_location_url: copySessions ? selectedEvent.defaultSessionLocationUrl : undefined,
      tickets: clonedTickets,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col w-[calc(100%-1.5rem)] sm:w-full max-w-none sm:max-w-4xl lg:max-w-5xl p-0 gap-0 overflow-hidden h-[90vh] sm:h-[720px] max-h-[92vh]">
        {/* Header */}
        <DialogHeader className="shrink-0 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 border-b border-border/60 bg-muted/20 pr-12 sm:pr-12">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="size-4 shrink-0" />
            <DialogTitle className="text-base font-semibold">Copy Registration Form from Existing Event</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1 line-clamp-2 sm:line-clamp-none">
            Import custom questionnaire fields, attendance policies, breakout sessions, and ticket tiers from any
            completed or published GDG Jakarta event.
          </DialogDescription>
        </DialogHeader>

        {/* Mobile Navigation Tabs */}
        <div className="flex items-center border-b border-border/60 bg-muted/30 p-1 md:hidden shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab("select")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
              mobileTab === "select"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Search className="size-3.5" />
            <span>1. Select Event</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
              mobileTab === "preview"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ListChecks className="size-3.5" />
            <span>2. Options & Preview</span>
            {selectedEvent && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] shrink-0">
                {selectedEvent.questions.length}
              </Badge>
            )}
          </button>
        </div>

        {/* Main Content: Split layout on desktop, tabbed on mobile */}
        <div className="flex-1 min-h-0 overflow-hidden md:grid md:grid-cols-12 flex flex-col">
          {/* Left Column: Event Picker (5 cols) */}
          <div
            className={cn(
              "bg-card flex-col min-h-0 overflow-hidden md:col-span-5 md:border-r md:border-border/60",
              mobileTab === "select" ? "flex flex-1" : "hidden md:flex",
            )}
          >
            {/* Search and Filters */}
            <div className="p-3 border-b border-border/50 space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events by title or date..."
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={activeFilter === "all" ? "secondary" : "ghost"}
                  onClick={() => setActiveFilter("all")}
                  className="h-6 px-2 text-[11px] rounded-full shrink-0"
                >
                  All ({events.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeFilter === "completed" ? "secondary" : "ghost"}
                  onClick={() => setActiveFilter("completed")}
                  className="h-6 px-2 text-[11px] rounded-full shrink-0"
                >
                  Completed ({events.filter((e) => e.isCompleted).length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeFilter === "has_form" ? "secondary" : "ghost"}
                  onClick={() => setActiveFilter("has_form")}
                  className="h-6 px-2 text-[11px] rounded-full shrink-0"
                >
                  With Form ({events.filter((e) => e.questions.length > 0).length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeFilter === "upcoming" ? "secondary" : "ghost"}
                  onClick={() => setActiveFilter("upcoming")}
                  className="h-6 px-2 text-[11px] rounded-full shrink-0"
                >
                  Upcoming ({events.filter((e) => !e.isCompleted).length})
                </Button>
              </div>
            </div>

            {/* Event List */}
            <ScrollArea className="flex-1 min-h-0">
              {isLoading && (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span className="text-xs">Loading chapter events...</span>
                </div>
              )}
              {!isLoading && filteredEvents.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-xs">
                  No events found matching your criteria.
                </div>
              )}
              {!isLoading && filteredEvents.length > 0 && (
                <div className="space-y-1 p-2">
                  {filteredEvents.map((evt) => {
                    const isSelected = evt.id === selectedEventId;
                    const hasQuestions = evt.questions.length > 0;

                    return (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => {
                          setSelectedEventId(evt.id);
                          setMobileTab("preview");
                        }}
                        className={cn(
                          "flex w-full flex-col gap-1.5 rounded-lg border p-2.5 text-left transition-all",
                          isSelected
                            ? "border-primary/60 bg-primary/5 shadow-2xs"
                            : "border-transparent hover:border-border hover:bg-muted/40",
                          !hasQuestions && "opacity-75",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-1 font-medium text-foreground text-xs leading-snug">
                            {evt.title}
                          </span>
                          <Badge
                            variant={evt.isCompleted ? "secondary" : "default"}
                            className="h-4 shrink-0 px-1.5 py-0 text-[9px]"
                          >
                            {evt.status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1 truncate">
                            <Calendar className="size-3 shrink-0" />
                            <span className="truncate">{evt.formattedDate}</span>
                          </div>
                        </div>

                        {/* Badges for questions, sessions, curation */}
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {hasQuestions ? (
                            <Badge
                              variant="outline"
                              className="h-4 border-emerald-500/30 bg-emerald-500/5 px-1.5 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                            >
                              {evt.questions.length} Questions
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px] text-muted-foreground">
                              No Custom Form
                            </Badge>
                          )}

                          {evt.sessions.length > 0 && (
                            <span className="rounded bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">
                              {evt.sessions.length} Tracks
                            </span>
                          )}

                          {evt.requiresApproval && (
                            <span className="rounded bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400">
                              Curated
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right Column: Preview & Options (7 cols) */}
          <div
            className={cn(
              "bg-muted/10 flex-col min-h-0 overflow-hidden md:col-span-7",
              mobileTab === "preview" ? "flex flex-1" : "hidden md:flex",
            )}
          >
            {/* Mobile Quick Switch Bar */}
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-3.5 py-2 md:hidden shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMobileTab("select")}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                <span>Change Event</span>
              </Button>
              {selectedEvent && (
                <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
                  {selectedEvent.title}
                </span>
              )}
            </div>

            {!selectedEvent && (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Copy className="mb-2 size-8 text-muted-foreground/60 stroke-[1.5]" />
                <p className="font-medium text-foreground text-sm">Select an event from the list</p>
                <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                  Choose any existing or completed event to preview its registration questions and select what you want
                  to copy.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileTab("select")}
                  className="mt-4 md:hidden text-xs gap-1"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Browse Events</span>
                </Button>
              </div>
            )}
            {selectedEvent && selectedEvent.questions.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <AlertCircle className="mb-2 size-8 text-amber-500/80 stroke-[1.5]" />
                <p className="font-medium text-foreground text-sm">No Custom Registration Form</p>
                <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                  &ldquo;{selectedEvent.title}&rdquo; used Bevy&apos;s standard RSVP without custom registration
                  questions. Please select an event with configured form questions.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileTab("select")}
                  className="mt-4 md:hidden text-xs gap-1"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Choose Another Event</span>
                </Button>
              </div>
            )}
            {selectedEvent && selectedEvent.questions.length > 0 && (
              <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
                    {/* Selected Event Card Summary */}
                    <div className="rounded-lg border border-border bg-card p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                            Source Event
                          </span>
                          <h4 className="font-semibold text-sm text-foreground truncate">{selectedEvent.title}</h4>
                        </div>
                        <Badge
                          variant={selectedEvent.isCompleted ? "secondary" : "default"}
                          className="text-[10px] shrink-0"
                        >
                          {selectedEvent.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-muted-foreground shrink-0" />
                          <span>{selectedEvent.formattedDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ListChecks className="size-3.5 text-emerald-500 shrink-0" />
                          <span className="font-medium text-foreground">
                            {selectedEvent.questions.length} Questions
                          </span>
                        </div>
                        {selectedEvent.sessions.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Layers className="size-3.5 text-sky-500 shrink-0" />
                            <span>{selectedEvent.sessions.length} Sessions</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Copy Configuration Controls */}
                    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                      <div className="space-y-1">
                        <h4 className="font-medium text-xs text-foreground uppercase tracking-wider">
                          Import Strategy
                        </h4>
                        <RadioGroup
                          value={copyMode}
                          onValueChange={(val) => setCopyMode(val as "replace" | "append")}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1"
                        >
                          <Label
                            htmlFor="mode-replace"
                            className={cn(
                              "flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer text-xs transition-all",
                              copyMode === "replace"
                                ? "border-primary bg-primary/5 text-foreground font-medium"
                                : "border-border text-muted-foreground hover:bg-muted/40",
                            )}
                          >
                            <RadioGroupItem value="replace" id="mode-replace" className="mt-0.5" />
                            <div>
                              <span className="block font-medium">Replace Existing Form</span>
                              <span className="block text-[11px] text-muted-foreground font-normal">
                                Overwrite current questions with source event&apos;s questionnaire.
                              </span>
                            </div>
                          </Label>

                          <Label
                            htmlFor="mode-append"
                            className={cn(
                              "flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer text-xs transition-all",
                              copyMode === "append"
                                ? "border-primary bg-primary/5 text-foreground font-medium"
                                : "border-border text-muted-foreground hover:bg-muted/40",
                            )}
                          >
                            <RadioGroupItem value="append" id="mode-append" className="mt-0.5" />
                            <div>
                              <span className="block font-medium">Append to Existing</span>
                              <span className="block text-[11px] text-muted-foreground font-normal">
                                Keep your current questions and add source questions to the end.
                              </span>
                            </div>
                          </Label>
                        </RadioGroup>
                      </div>

                      {/* Components Selection Checkboxes */}
                      <div className="space-y-2 pt-1 border-t border-border/60">
                        <span className="font-medium text-xs text-foreground uppercase tracking-wider">
                          Components to Copy
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          <Label className="flex items-center gap-2 text-xs font-normal cursor-pointer">
                            <Checkbox
                              checked={copyQuestions}
                              onCheckedChange={(checked) => setCopyQuestions(Boolean(checked))}
                            />
                            <span>
                              Registration Questions{" "}
                              <strong className="font-semibold text-primary">({selectedEvent.questions.length})</strong>
                            </span>
                          </Label>

                          <Label className="flex items-center gap-2 text-xs font-normal cursor-pointer">
                            <Checkbox
                              checked={copyPolicy}
                              onCheckedChange={(checked) => setCopyPolicy(Boolean(checked))}
                            />
                            <span>
                              Attendance Policies{" "}
                              <span className="text-[11px] text-muted-foreground">
                                ({selectedEvent.requiresApproval ? "Curated" : "Open RSVP"})
                              </span>
                            </span>
                          </Label>

                          {selectedEvent.sessions.length > 0 && (
                            <Label className="flex items-center gap-2 text-xs font-normal cursor-pointer">
                              <Checkbox
                                checked={copySessions}
                                onCheckedChange={(checked) => setCopySessions(Boolean(checked))}
                              />
                              <span>
                                Breakout Sessions{" "}
                                <strong className="font-semibold text-sky-600">
                                  ({selectedEvent.sessions.length})
                                </strong>
                              </span>
                            </Label>
                          )}

                          {selectedEvent.tickets.length > 0 && (
                            <Label className="flex items-center gap-2 text-xs font-normal cursor-pointer">
                              <Checkbox
                                checked={copyTickets}
                                onCheckedChange={(checked) => setCopyTickets(Boolean(checked))}
                              />
                              <span>
                                Ticket Tiers{" "}
                                <strong className="font-semibold text-amber-600">
                                  ({selectedEvent.tickets.length})
                                </strong>
                              </span>
                            </Label>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Questionnaire Live Preview */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground uppercase tracking-wider">
                          Questions Preview ({selectedEvent.questions.length})
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {Object.keys(questionsBySection).length} Sections
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {Object.entries(questionsBySection).map(([sectionName, sectionQuestions]) => {
                          const isCollapsed = Boolean(collapsedSections[sectionName]);
                          return (
                            <div
                              key={sectionName}
                              className="rounded-lg border border-border/80 bg-card overflow-hidden shadow-2xs"
                            >
                              <button
                                type="button"
                                onClick={() => toggleSection(sectionName)}
                                className="w-full flex items-center justify-between p-2.5 bg-muted/30 text-left hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {isCollapsed ? (
                                    <ChevronRight className="size-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="size-3.5 text-muted-foreground" />
                                  )}
                                  <span className="font-semibold text-xs text-foreground">{sectionName}</span>
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                  {sectionQuestions.length} questions
                                </span>
                              </button>

                              {!isCollapsed && (
                                <div className="p-2.5 divide-y divide-border/40 space-y-1.5">
                                  {sectionQuestions.map((q, qIdx) => (
                                    <div
                                      key={q.id || qIdx}
                                      className="pt-1.5 first:pt-0 flex items-start justify-between gap-3 text-xs"
                                    >
                                      <div className="space-y-0.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-medium text-foreground break-words">{q.label}</span>
                                          {q.required && (
                                            <span className="text-rose-500 font-bold text-xs" title="Required">
                                              *
                                            </span>
                                          )}
                                        </div>
                                        {q.description && (
                                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                                            {q.description}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] px-1.5 py-0 h-4 uppercase font-mono"
                                        >
                                          {q.type}
                                        </Badge>
                                        {q.validation_type && q.validation_type !== "none" && (
                                          <Badge
                                            variant="secondary"
                                            className="text-[9px] px-1 py-0 h-4 text-muted-foreground"
                                          >
                                            {q.validation_type}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="m-0 px-4 py-3 sm:px-6 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-between sm:justify-between shrink-0">
          <div className="text-[11px] text-muted-foreground hidden lg:block max-w-md truncate">
            {selectedEvent && selectedEvent.questions.length > 0 && (
              <span>
                Changes will be applied to the form editor. You can review and save before committing to Firestore.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {mobileTab === "select" && selectedEvent && selectedEvent.questions.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMobileTab("preview")}
                className="md:hidden text-xs gap-1"
              >
                <span>Review</span>
                <ChevronRight className="size-3.5" />
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={
                !selectedEvent ||
                selectedEvent.questions.length === 0 ||
                (!copyQuestions && !copyPolicy && !copySessions && !copyTickets)
              }
              onClick={handleApply}
              className="gap-1.5 text-xs shadow-xs"
            >
              <Copy className="size-3.5" />
              <span className="hidden sm:inline">Copy Registration Form</span>
              <span className="sm:hidden">Copy Form</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
