"use client";

import { useEffect, useId, useMemo, useState } from "react";

import Image from "next/image";

import { format, isPast, parseISO } from "date-fns";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  ImageIcon,
  ListChecks,
  Loader2,
  Search,
  Sparkles,
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
import {
  DEFAULT_CHECKLIST_ITEMS_BY_TYPE,
  EMAIL_TEMPLATES_CONFIG,
  type EmailTemplateKey,
  type TemplateSimulatedData,
} from "@/lib/events/email-templates";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

export interface CopyTemplateDataResult {
  copyBanner: boolean;
  bannerUrl?: string;
  copyChecklist: boolean;
  checklistItems?: string[];
  checklistMode: "replace" | "append";
  applyToAllTemplates: boolean;
  sourceEventTitle: string;
}

interface CopyTemplateDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEvent: FirestoreEvent;
  activeTemplateKey: EmailTemplateKey;
  currentTemplatesData?: Record<EmailTemplateKey, TemplateSimulatedData>;
  initialTarget?: "all" | "banner" | "checklist";
  onApply: (result: CopyTemplateDataResult) => void;
}

interface TemplateDataPerKey {
  headerEmailUrl: string;
  checklistItems: string[];
  hasCustomChecklist: boolean;
  hasCustomBanner: boolean;
}

interface EnrichedTemplateEventOption {
  id: string;
  title: string;
  startDate: string;
  formattedDate: string;
  status: "Completed" | "Published" | "Draft" | "Canceled";
  isCompleted: boolean;
  isCurrent: boolean;
  isHidden?: boolean;
  thumbnailUrl?: string;
  eventHeaderEmailUrl: string;
  templates: Record<EmailTemplateKey, TemplateDataPerKey>;
  totalCustomChecklists: number;
}

const FALLBACK_BANNER_URL = "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";

export function CopyTemplateDataDialog({
  open,
  onOpenChange,
  currentEvent,
  activeTemplateKey,
  currentTemplatesData,
  initialTarget = "all",
  onApply,
}: CopyTemplateDataDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<EnrichedTemplateEventOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "custom" | "hidden" | "completed" | "upcoming">("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"select" | "preview">("select");

  // Copy customization states
  const [copyBanner, setCopyBanner] = useState(true);
  const [copyChecklist, setCopyChecklist] = useState(true);
  const [bannerSource, setBannerSource] = useState<"template" | "event">("template");
  const [sourceChecklistTemplateKey, setSourceChecklistTemplateKey] = useState<EmailTemplateKey>(activeTemplateKey);
  const [checklistMode, setChecklistMode] = useState<"replace" | "append">("replace");
  const [targetScope, setTargetScope] = useState<"current" | "all">("current");

  const searchInputId = useId();
  const sourceTemplateSelectId = useId();

  // Reset or preset state when dialog opens or initialTarget changes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setMobileTab("select");
      return;
    }

    setMobileTab("select");
    setSourceChecklistTemplateKey(activeTemplateKey);
    setChecklistMode("replace");
    setTargetScope("current");
    setBannerSource("template");

    if (initialTarget === "banner") {
      setCopyBanner(true);
      setCopyChecklist(false);
    } else if (initialTarget === "checklist") {
      setCopyBanner(false);
      setCopyChecklist(true);
    } else {
      setCopyBanner(true);
      setCopyChecklist(true);
    }
  }, [open, activeTemplateKey, initialTarget]);

  // Load events when dialog opens
  useEffect(() => {
    if (!open) return;

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

        const eventsById = new Map<string, EnrichedTemplateEventOption>();

        // 1. Add Current Event at the top of list
        const currentEventIdStr = String(currentEvent.id);
        const currentRawStart = currentEvent.start_date || "";
        let currentFormattedDate = "Date TBD";
        if (currentRawStart) {
          try {
            const parsed = parseISO(currentRawStart);
            currentFormattedDate = format(toTimezoneDate(parsed), "dd MMM yyyy, h:mm a");
          } catch {
            currentFormattedDate = currentRawStart;
          }
        }

        const currentTemplatesMap: Record<EmailTemplateKey, TemplateDataPerKey> = {} as Record<
          EmailTemplateKey,
          TemplateDataPerKey
        >;
        let currentCustomCount = 0;

        for (const cfg of EMAIL_TEMPLATES_CONFIG) {
          const k = cfg.key;
          const liveData = currentTemplatesData?.[k];
          const savedData = currentEvent.email_templates?.templates_data?.[k];
          const legacySaved = k === "accepted" ? currentEvent.email_templates?.template_data : undefined;
          const activeSaved = savedData ?? legacySaved;

          const defaultItems = DEFAULT_CHECKLIST_ITEMS_BY_TYPE[k] ?? [];
          let checklistItems = defaultItems;
          if (liveData?.event.eventChecklistItems && liveData.event.eventChecklistItems.length > 0) {
            checklistItems = liveData.event.eventChecklistItems;
          } else if (activeSaved?.eventChecklistItems && activeSaved.eventChecklistItems.length > 0) {
            checklistItems = activeSaved.eventChecklistItems;
          }

          const hasCustomChecklist = Boolean(
            (liveData?.event.eventChecklistItems && liveData.event.eventChecklistItems.length > 0) ||
              (activeSaved?.eventChecklistItems && activeSaved.eventChecklistItems.length > 0),
          );
          if (hasCustomChecklist) currentCustomCount++;

          const banner =
            liveData?.event.headerEmailUrl ||
            activeSaved?.headerEmailUrl ||
            currentEvent.headerEmailUrl ||
            currentEvent.header_email_url ||
            currentEvent.banner_url ||
            currentEvent.picture_url ||
            FALLBACK_BANNER_URL;

          const hasCustomBanner = Boolean(
            liveData?.event.headerEmailUrl || activeSaved?.headerEmailUrl || currentEvent.headerEmailUrl,
          );

          currentTemplatesMap[k] = {
            headerEmailUrl: banner,
            checklistItems,
            hasCustomChecklist,
            hasCustomBanner,
          };
        }

        const isCurrentHidden = Boolean(currentEvent.is_hidden ?? (currentEvent as { hidden?: boolean }).hidden);

        eventsById.set(currentEventIdStr, {
          id: currentEventIdStr,
          title: currentEvent.title || "Current Event",
          startDate: currentRawStart,
          formattedDate: currentFormattedDate,
          status: currentEvent.status || "Published",
          isCompleted: currentEvent.status === "Completed",
          isCurrent: true,
          isHidden: isCurrentHidden,
          thumbnailUrl: currentEvent.picture_url ?? currentEvent.banner_url,
          eventHeaderEmailUrl:
            currentEvent.headerEmailUrl ??
            currentEvent.header_email_url ??
            currentEvent.banner_url ??
            currentEvent.picture_url ??
            FALLBACK_BANNER_URL,
          templates: currentTemplatesMap,
          totalCustomChecklists: currentCustomCount,
        });

        // 2. Process all Firestore events
        for (const doc of firestoreDocs) {
          const docId = String(doc.id);
          if (docId === currentEventIdStr) continue;

          const bevyMatch = bevyMap.get(docId);
          const rawStart = doc.start_date || bevyMatch?.startDate || "";
          const isDocHidden = Boolean(doc.is_hidden ?? (doc as { hidden?: boolean }).hidden);

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

          const eventDefaultBanner =
            doc.headerEmailUrl ||
            doc.header_email_url ||
            doc.banner_url ||
            doc.picture_url ||
            bevyMatch?.bannerUrl ||
            FALLBACK_BANNER_URL;

          const templatesMap: Record<EmailTemplateKey, TemplateDataPerKey> = {} as Record<
            EmailTemplateKey,
            TemplateDataPerKey
          >;
          let customCount = 0;

          for (const cfg of EMAIL_TEMPLATES_CONFIG) {
            const k = cfg.key;
            const savedData = doc.email_templates?.templates_data?.[k];
            const legacySaved = k === "accepted" ? doc.email_templates?.template_data : undefined;
            const activeSaved = savedData ?? legacySaved;

            const defaultItems = DEFAULT_CHECKLIST_ITEMS_BY_TYPE[k] ?? [];
            const hasCustomChecklist = Boolean(
              activeSaved?.eventChecklistItems && activeSaved.eventChecklistItems.length > 0,
            );
            if (hasCustomChecklist) customCount++;

            const checklistItems = hasCustomChecklist ? (activeSaved?.eventChecklistItems ?? []) : defaultItems;

            const hasCustomBanner = Boolean(activeSaved?.headerEmailUrl);
            const headerEmailUrl = activeSaved?.headerEmailUrl || eventDefaultBanner;

            templatesMap[k] = {
              headerEmailUrl,
              checklistItems,
              hasCustomChecklist,
              hasCustomBanner,
            };
          }

          eventsById.set(docId, {
            id: docId,
            title: doc.title || bevyMatch?.title || "Untitled Event",
            startDate: rawStart,
            formattedDate,
            status: finalStatus,
            isCompleted,
            isCurrent: false,
            isHidden: isDocHidden,
            thumbnailUrl: doc.picture_url || doc.banner_url || bevyMatch?.thumbnailUrl || bevyMatch?.bannerUrl,
            eventHeaderEmailUrl: eventDefaultBanner,
            templates: templatesMap,
            totalCustomChecklists: customCount,
          });
        }

        // 3. Process remaining Bevy events
        for (const be of bevyResult.events || []) {
          const beId = String(be.id);
          if (eventsById.has(beId)) continue;

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

          const defaultBanner = be.bannerUrl || FALLBACK_BANNER_URL;
          const templatesMap: Record<EmailTemplateKey, TemplateDataPerKey> = {} as Record<
            EmailTemplateKey,
            TemplateDataPerKey
          >;

          for (const cfg of EMAIL_TEMPLATES_CONFIG) {
            const k = cfg.key;
            templatesMap[k] = {
              headerEmailUrl: defaultBanner,
              checklistItems: DEFAULT_CHECKLIST_ITEMS_BY_TYPE[k] ?? [],
              hasCustomChecklist: false,
              hasCustomBanner: false,
            };
          }

          eventsById.set(beId, {
            id: beId,
            title: be.title,
            startDate: be.startDate,
            formattedDate,
            status: isCompleted ? "Completed" : "Published",
            isCompleted,
            isCurrent: false,
            thumbnailUrl: be.thumbnailUrl || be.bannerUrl,
            eventHeaderEmailUrl: defaultBanner,
            templates: templatesMap,
            totalCustomChecklists: 0,
          });
        }

        const list = Array.from(eventsById.values());
        setEvents(list);

        // Pre-select first non-current event if available, otherwise current event
        if (!selectedEventId && list.length > 0) {
          const preferred =
            list.find((e) => !e.isCurrent && (e.totalCustomChecklists > 0 || e.eventHeaderEmailUrl)) || list[0];
          setSelectedEventId(preferred.id);
        }
      } catch (err) {
        console.error("Failed to load events for copy template dialog:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadEventsData();

    return () => {
      isMounted = false;
    };
  }, [open, currentEvent, currentTemplatesData, selectedEventId]);

  // On-demand fallback: fetch single event details when selected
  useEffect(() => {
    if (!selectedEventId || !open) return;
    const current = events.find((e) => e.id === selectedEventId);
    if (!current || current.isCurrent) return;

    let isMounted = true;
    void (async () => {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const doc = await getFirestoreEventById(selectedEventId);
        if (!isMounted || !doc) return;

        const isHidden = Boolean(doc.is_hidden || (doc as { hidden?: boolean }).hidden);

        const eventDefaultBanner =
          doc.headerEmailUrl ||
          doc.header_email_url ||
          doc.banner_url ||
          doc.picture_url ||
          current.eventHeaderEmailUrl ||
          FALLBACK_BANNER_URL;

        const updatedTemplates: Record<EmailTemplateKey, TemplateDataPerKey> = { ...current.templates };
        let customCount = 0;

        for (const cfg of EMAIL_TEMPLATES_CONFIG) {
          const k = cfg.key;
          const savedData = doc.email_templates?.templates_data?.[k];
          const legacySaved = k === "accepted" ? doc.email_templates?.template_data : undefined;
          const activeSaved = savedData ?? legacySaved;

          const defaultItems = DEFAULT_CHECKLIST_ITEMS_BY_TYPE[k] ?? [];
          const hasCustomChecklist = Boolean(
            activeSaved?.eventChecklistItems && activeSaved.eventChecklistItems.length > 0,
          );
          if (hasCustomChecklist) customCount++;

          const checklistItems = hasCustomChecklist ? (activeSaved?.eventChecklistItems ?? []) : defaultItems;
          const hasCustomBanner = Boolean(activeSaved?.headerEmailUrl);
          const headerEmailUrl = activeSaved?.headerEmailUrl || eventDefaultBanner;

          updatedTemplates[k] = {
            headerEmailUrl,
            checklistItems,
            hasCustomChecklist,
            hasCustomBanner,
          };
        }

        setEvents((prev) =>
          prev.map((ev) => {
            if (ev.id !== selectedEventId) return ev;
            return {
              ...ev,
              isHidden,
              eventHeaderEmailUrl: eventDefaultBanner,
              templates: updatedTemplates,
              totalCustomChecklists: customCount,
            };
          }),
        );
      } catch (err) {
        console.error("[CopyTemplateDataDialog] Error fetching single event details:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedEventId, open, events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesDate = ev.formattedDate.toLowerCase().includes(q);
        const matchesId = ev.id.toLowerCase().includes(q);
        const matchesHidden = Boolean(ev.isHidden && "hidden".includes(q));
        if (!matchesTitle && !matchesDate && !matchesId && !matchesHidden) return false;
      }

      if (activeFilter === "custom") {
        return ev.totalCustomChecklists > 0 || ev.eventHeaderEmailUrl !== FALLBACK_BANNER_URL;
      }
      if (activeFilter === "hidden") {
        return Boolean(ev.isHidden);
      }
      if (activeFilter === "completed") {
        return ev.isCompleted;
      }
      if (activeFilter === "upcoming") {
        return !ev.isCompleted;
      }
      return true;
    });
  }, [events, searchQuery, activeFilter]);

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Source template info
  const sourceTemplateData = useMemo(() => {
    if (!selectedEvent) return null;
    return selectedEvent.templates[sourceChecklistTemplateKey];
  }, [selectedEvent, sourceChecklistTemplateKey]);

  // Resolved banner URL to copy
  const resolvedBannerUrl = useMemo(() => {
    if (!selectedEvent) return "";
    if (bannerSource === "event") {
      return selectedEvent.eventHeaderEmailUrl;
    }
    return sourceTemplateData?.headerEmailUrl || selectedEvent.eventHeaderEmailUrl;
  }, [selectedEvent, bannerSource, sourceTemplateData]);

  // Resolved checklist items to copy
  const resolvedChecklistItems = useMemo(() => {
    return sourceTemplateData?.checklistItems || [];
  }, [sourceTemplateData]);

  const currentMeta = EMAIL_TEMPLATES_CONFIG.find((c) => c.key === activeTemplateKey) ?? EMAIL_TEMPLATES_CONFIG[0];
  const sourceMeta =
    EMAIL_TEMPLATES_CONFIG.find((c) => c.key === sourceChecklistTemplateKey) ?? EMAIL_TEMPLATES_CONFIG[0];

  const handleApply = () => {
    if (!selectedEvent) return;
    if (!copyBanner && !copyChecklist) return;

    onApply({
      copyBanner,
      bannerUrl: copyBanner ? resolvedBannerUrl : undefined,
      copyChecklist,
      checklistItems: copyChecklist ? resolvedChecklistItems : undefined,
      checklistMode,
      applyToAllTemplates: targetScope === "all",
      sourceEventTitle: selectedEvent.title,
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
            <DialogTitle className="text-base font-semibold">Copy Template Data from Existing Event</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Import the Header Banner Image URL and Checklist Items from any completed or published GDG Jakarta event
            into your email template configuration.
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
            <span>2. Data & Preview</span>
            {selectedEvent && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] shrink-0">
                Selected
              </Badge>
            )}
          </button>
        </div>

        {/* Main Content Split layout on desktop */}
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
                  id={searchInputId}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events by title or date..."
                  className="pl-8 text-xs h-8"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "custom", label: "With Custom Data" },
                    { id: "hidden", label: "Hidden" },
                    { id: "completed", label: "Completed" },
                    { id: "upcoming", label: "Upcoming" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id)}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors shrink-0",
                      activeFilter === tab.id
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Event List */}
            <ScrollArea className="flex-1 min-h-0">
              {isLoading && (
                <div className="p-8 flex flex-col items-center justify-center text-center space-y-2">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Loading published and past events...</p>
                </div>
              )}
              {!isLoading && filteredEvents.length === 0 && (
                <div className="p-8 text-center text-muted-foreground space-y-2">
                  <AlertCircle className="size-6 mx-auto opacity-40" />
                  <p className="text-xs">No events match your search query.</p>
                </div>
              )}
              {!isLoading && filteredEvents.length > 0 && (
                <div className="p-2 space-y-1.5">
                  {filteredEvents.map((ev) => {
                    const isSelected = ev.id === selectedEventId;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => {
                          setSelectedEventId(ev.id);
                          setMobileTab("preview");
                        }}
                        className={cn(
                          "w-full text-left p-2.5 rounded-lg border transition-all relative flex flex-col gap-1.5",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-2xs ring-1 ring-primary/40"
                            : "border-border/50 bg-background/60 hover:bg-muted/40 hover:border-border",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            {ev.isCurrent && (
                              <Badge variant="default" className="text-[9px] h-4 px-1.5 shrink-0 bg-blue-600">
                                Current Event
                              </Badge>
                            )}
                            {ev.isHidden && (
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4 px-1.5 shrink-0 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                              >
                                Hidden
                              </Badge>
                            )}
                            <Badge
                              variant={ev.isCompleted ? "secondary" : "outline"}
                              className={cn(
                                "text-[9px] h-4 px-1.5 shrink-0",
                                ev.isCompleted && "bg-muted text-muted-foreground",
                              )}
                            >
                              {ev.status}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground truncate">{ev.formattedDate}</span>
                          </div>
                          {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                        </div>

                        <div className="font-medium text-xs text-foreground line-clamp-1">{ev.title}</div>

                        {/* Badges for Banner & Checklists */}
                        <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
                          {ev.eventHeaderEmailUrl && ev.eventHeaderEmailUrl !== FALLBACK_BANNER_URL ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <ImageIcon className="size-3" />
                              <span>Custom Banner</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <ImageIcon className="size-3 opacity-60" />
                              <span>Default Banner</span>
                            </span>
                          )}

                          <span className="text-muted-foreground/40">•</span>

                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              ev.totalCustomChecklists > 0 ? "text-primary font-medium" : "text-muted-foreground",
                            )}
                          >
                            <ListChecks className="size-3" />
                            <span>
                              {ev.totalCustomChecklists > 0
                                ? `${ev.totalCustomChecklists} Custom Checklists`
                                : "Standard Checklists"}
                            </span>
                          </span>
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
            {selectedEvent ? (
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 sm:p-5 space-y-5">
                  {/* Selected Event Card Banner */}
                  <div className="rounded-xl border border-border/60 bg-card p-3.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {selectedEvent.isCurrent && (
                            <Badge variant="default" className="text-[9px] h-4 px-1.5 bg-blue-600">
                              Current Event
                            </Badge>
                          )}
                          {selectedEvent.isHidden && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 px-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                            >
                              Hidden
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {selectedEvent.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="size-3" />
                            {selectedEvent.formattedDate}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground line-clamp-1">{selectedEvent.title}</h3>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Header Banner Image URL */}
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          id="copy-banner-checkbox"
                          checked={copyBanner}
                          onCheckedChange={(c) => setCopyBanner(Boolean(c))}
                          className="mt-0.5"
                        />
                        <div>
                          <Label htmlFor="copy-banner-checkbox" className="text-xs font-semibold cursor-pointer">
                            Copy Header Banner Image URL
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Injected into {"{{ headerEmailUrl }}"} at the top of outgoing emails
                          </p>
                        </div>
                      </div>

                      {resolvedBannerUrl && (
                        <a
                          href={resolvedBannerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                        >
                          <span>Open image</span>
                          <ExternalLink className="size-2.5" />
                        </a>
                      )}
                    </div>

                    {copyBanner && (
                      <div className="space-y-3 pt-1">
                        {/* If source template banner differs from event primary banner */}
                        {sourceTemplateData?.headerEmailUrl &&
                          selectedEvent.eventHeaderEmailUrl &&
                          sourceTemplateData.headerEmailUrl !== selectedEvent.eventHeaderEmailUrl && (
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-muted-foreground text-[11px]">Source banner:</span>
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs">
                                <input
                                  type="radio"
                                  name="bannerSource"
                                  value="template"
                                  checked={bannerSource === "template"}
                                  onChange={() => setBannerSource("template")}
                                  className="accent-primary"
                                />
                                <span>Template Banner ({sourceMeta.name.split(" ")[0]})</span>
                              </label>
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs">
                                <input
                                  type="radio"
                                  name="bannerSource"
                                  value="event"
                                  checked={bannerSource === "event"}
                                  onChange={() => setBannerSource("event")}
                                  className="accent-primary"
                                />
                                <span>Event Primary Banner</span>
                              </label>
                            </div>
                          )}

                        {/* Banner Image Preview */}
                        {resolvedBannerUrl ? (
                          <div className="space-y-1.5">
                            <div className="relative w-full h-20 sm:h-24 rounded-lg overflow-hidden border bg-muted/30">
                              <Image
                                src={resolvedBannerUrl}
                                alt="Header Banner Preview"
                                fill
                                sizes="100vw"
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono truncate px-1">
                              {resolvedBannerUrl}
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 text-center text-xs text-muted-foreground rounded-lg border border-dashed">
                            No banner URL available for this selection.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Checklist Items */}
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          id="copy-checklist-checkbox"
                          checked={copyChecklist}
                          onCheckedChange={(c) => setCopyChecklist(Boolean(c))}
                          className="mt-0.5"
                        />
                        <div>
                          <Label htmlFor="copy-checklist-checkbox" className="text-xs font-semibold cursor-pointer">
                            Copy Checklist Items ({resolvedChecklistItems.length} items)
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Formatted reminders, guidelines, and instructions for attendees
                          </p>
                        </div>
                      </div>

                      {sourceTemplateData?.hasCustomChecklist && (
                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/30">
                          Customized
                        </Badge>
                      )}
                    </div>

                    {copyChecklist && (
                      <div className="space-y-3 pt-1">
                        {/* Source Template Selector */}
                        <div className="space-y-1">
                          <Label htmlFor={sourceTemplateSelectId} className="text-xs font-medium text-muted-foreground">
                            Copy from template:
                          </Label>
                          <select
                            id={sourceTemplateSelectId}
                            value={sourceChecklistTemplateKey}
                            onChange={(e) => setSourceChecklistTemplateKey(e.target.value as EmailTemplateKey)}
                            className="w-full h-8 text-xs bg-background border border-input rounded-md px-2.5 focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {EMAIL_TEMPLATES_CONFIG.map((cfg) => {
                              const tData = selectedEvent.templates[cfg.key];
                              const count = tData?.checklistItems.length ?? 0;
                              const isCustom = tData?.hasCustomChecklist;
                              return (
                                <option key={cfg.key} value={cfg.key}>
                                  {cfg.name} ({count} items{isCustom ? " • Custom" : ""})
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Checklist Items Preview List */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Items Preview ({resolvedChecklistItems.length}):
                          </span>
                          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                            {resolvedChecklistItems.map((item, idx) => {
                              const colonIdx = item.indexOf(":");
                              const title = colonIdx > -1 ? item.slice(0, colonIdx) : "";
                              const desc = colonIdx > -1 ? item.slice(colonIdx + 1).trim() : item;

                              return (
                                <div
                                  key={`${item.slice(0, 15)}-${idx}`}
                                  className="flex items-start gap-2 p-2 rounded-md border bg-background/60 text-xs"
                                >
                                  <span className="h-4 w-4 rounded-full bg-primary/10 text-primary font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <p className="text-[11px] leading-relaxed break-words">
                                    {title && <span className="font-semibold text-foreground">{title}: </span>}
                                    <span className="text-muted-foreground">{desc}</span>
                                  </p>
                                </div>
                              );
                            })}

                            {resolvedChecklistItems.length === 0 && (
                              <div className="p-3 text-center text-xs text-muted-foreground rounded-lg border border-dashed">
                                No checklist items found in this source template.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Merge Mode */}
                        <div className="pt-2 border-t border-border/50 space-y-1.5">
                          <Label className="text-xs font-medium text-foreground">Action Mode:</Label>
                          <RadioGroup
                            value={checklistMode}
                            onValueChange={(v) => setChecklistMode(v as "replace" | "append")}
                            className="flex flex-col sm:flex-row gap-2 sm:gap-4"
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="replace" id="mode-replace" />
                              <Label htmlFor="mode-replace" className="text-xs font-normal cursor-pointer">
                                Replace existing items
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="append" id="mode-append" />
                              <Label htmlFor="mode-append" className="text-xs font-normal cursor-pointer">
                                Append (keep current and add new)
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Target Scope */}
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2 shadow-2xs">
                    <Label className="text-xs font-semibold text-foreground block">Apply Copied Data To:</Label>
                    <RadioGroup
                      value={targetScope}
                      onValueChange={(v) => setTargetScope(v as "current" | "all")}
                      className="space-y-1.5"
                    >
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="current" id="scope-current" className="mt-0.5" />
                        <div>
                          <Label htmlFor="scope-current" className="text-xs font-medium cursor-pointer">
                            Current Template Only ({currentMeta.name})
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Only updates variables for the currently open template tab.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="all" id="scope-all" className="mt-0.5" />
                        <div>
                          <Label htmlFor="scope-all" className="text-xs font-medium cursor-pointer">
                            All 9 Email Templates
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Synchronizes banner URL and/or checklist items across all event templates.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
                <Search className="size-8 opacity-30" />
                <p className="text-xs">Select an event from the left column to view its banner and checklist items.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="m-0 border-t bg-muted/20 p-4 px-6 pb-6 pt-4 flex flex-row items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!selectedEvent || (!copyBanner && !copyChecklist)}
            onClick={handleApply}
            className="text-xs h-8 gap-1.5 px-4 font-medium"
          >
            <Copy className="size-3.5" />
            <span>
              {targetScope === "all" ? "Apply to All Templates" : `Apply to ${currentMeta.name.split(" ")[0]}`}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
