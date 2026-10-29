"use client";

import * as React from "react";

import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  Laptop,
  MapPin,
  Maximize2,
  Play,
  Printer,
  Radio,
  RefreshCw,
  Square,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import {
  fetchBevyEventDetailAction,
  fetchPublishedEventsAction,
  type PublishedEventOption,
} from "@/app/(main)/dashboard/email-manager/_actions/fetch-published-events";
import { PublishedEventSelector } from "@/app/(main)/dashboard/email-manager/_components/published-event-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { enqueuePrintJobAction, savePrinterConfigAction, updatePrintJobStatusAction } from "@/lib/firestore/actions";
import {
  buildPrintDocument,
  DEFAULT_LABEL_TEMPLATE,
  ensureFullLabelHtml,
  renderLabelTemplate,
  syncTemplateDimensions,
} from "@/lib/printers/templates";
import { CLABEL_PAPER_PRESETS, type LabelTemplateData, type PrinterConfig, type PrintJob } from "@/lib/printers/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { LabelHtmlEditorPreview } from "./label-html-editor-preview";

const CLIENT_EVENTS_CACHE_KEY = "gdg_email_published_events_cache_v1";
const CLIENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface ClientEventsCacheData {
  events: PublishedEventOption[];
  timestamp: number;
}

function readClientEventsCache(): PublishedEventOption[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CLIENT_EVENTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientEventsCacheData;
    if (parsed && Array.isArray(parsed.events) && Date.now() - parsed.timestamp < CLIENT_CACHE_TTL_MS) {
      return parsed.events;
    }
  } catch {
    // Ignore malformed cache
  }
  return null;
}

function writeClientEventsCache(events: PublishedEventOption[]) {
  if (typeof window === "undefined") return;
  try {
    const data: ClientEventsCacheData = {
      events,
      timestamp: Date.now(),
    };
    localStorage.setItem(CLIENT_EVENTS_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota/privacy errors
  }
}

const DEFAULT_SAMPLE_ATTENDEE = {
  name: "Fachridan Tio",
  email: "deathravenclaw@gmail.com",
  title: "Game Engineer",
  company: "Harvest Moon",
  sessionTrack: "Full Session",
  techStack: "Kotlin / Android",
  attendeeId: "263443955",
  ticketCode: "GOOGA263443955",
  checkinTime: "20:13",
};

interface PrintersDashboardProps {
  initialConfig: PrinterConfig;
}

export function PrintersDashboard({ initialConfig }: PrintersDashboardProps) {
  const user = useAuthStore((s) => s.user);
  const normalizeConfig = React.useCallback(
    (raw: PrinterConfig): PrinterConfig => ({
      ...raw,
      template_html: ensureFullLabelHtml(raw.template_html, raw.paper_width_mm, raw.paper_height_mm, raw.orientation),
    }),
    [],
  );

  const [config, setConfig] = React.useState<PrinterConfig>(() => normalizeConfig(initialConfig));
  const [savedConfig, setSavedConfig] = React.useState<PrinterConfig>(() => normalizeConfig(initialConfig));
  const [isSaving, setIsSaving] = React.useState(false);
  const [isStationRunning, setIsStationRunning] = React.useState(false);
  const [recentJobs, setRecentJobs] = React.useState<PrintJob[]>([]);
  const [selectedPreset, setSelectedPreset] = React.useState<string>(() => {
    const matched = CLABEL_PAPER_PRESETS.find(
      (p) =>
        (p.widthMm === initialConfig.paper_width_mm && p.heightMm === initialConfig.paper_height_mm) ||
        (p.heightMm === initialConfig.paper_width_mm && p.widthMm === initialConfig.paper_height_mm),
    );
    return matched?.id ?? "clabel-50x30";
  });

  // Target Bevy Event selector state (shared pattern with Email Templates)
  const [publishedEvents, setPublishedEvents] = React.useState<PublishedEventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = React.useState<PublishedEventOption | undefined>();
  const [isLoadingEvents, setIsLoadingEvents] = React.useState(true);
  const [isRefreshingEvents, setIsRefreshingEvents] = React.useState(false);
  const [isLoadingEventDetail, setIsLoadingEventDetail] = React.useState(false);

  // Hidden print iframe reference
  const printIframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const isPrintingRef = React.useRef<boolean>(false);

  // Select a Bevy event and fetch its detailed metadata
  const handleSelectEvent = React.useCallback(
    async (ev: PublishedEventOption, forceRefresh?: boolean, isInitialMount?: boolean) => {
      setSelectedEvent(ev);
      setConfig((prev) => ({
        ...prev,
        selected_event_id: ev.id,
        sample_data: prev.sample_data ? { ...prev.sample_data, eventTitle: undefined, eventId: undefined } : undefined,
      }));
      if (isInitialMount) {
        setSavedConfig((prev) => ({
          ...prev,
          selected_event_id: prev.selected_event_id || ev.id,
        }));
      }

      setIsLoadingEventDetail(true);
      try {
        const res = await fetchBevyEventDetailAction(ev.id, { forceRefresh });
        if (res.success && res.event) {
          setSelectedEvent(res.event);
        }
      } catch (err) {
        console.warn("[Printers] Could not fetch Bevy event detail:", err);
      } finally {
        setIsLoadingEventDetail(false);
      }
    },
    [],
  );

  // Force refresh Bevy events
  const handleRefreshEvents = React.useCallback(async () => {
    setIsRefreshingEvents(true);
    try {
      const res = await fetchPublishedEventsAction({ forceRefresh: true });
      if (res.success && res.events) {
        setPublishedEvents(res.events);
        writeClientEventsCache(res.events);
        toast.success(`Loaded ${res.events.length} chapter events from Bevy.`);

        if (selectedEvent) {
          const matched = res.events.find((e) => e.id === selectedEvent.id);
          if (matched) {
            void handleSelectEvent(matched, true);
          } else if (res.events.length > 0) {
            void handleSelectEvent(res.events[0], true);
          }
        } else if (res.events.length > 0) {
          void handleSelectEvent(res.events[0], true);
        }
      } else {
        toast.error(res.error || "Failed to refresh Bevy events.");
      }
    } catch {
      toast.error("Failed to refresh Bevy events.");
    } finally {
      setIsRefreshingEvents(false);
    }
  }, [handleSelectEvent, selectedEvent]);

  // Load Bevy events on mount
  React.useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      const cached = readClientEventsCache();
      if (cached && cached.length > 0) {
        if (isMounted) {
          setPublishedEvents(cached);
          setIsLoadingEvents(false);
          const initialMatch =
            (initialConfig.selected_event_id && cached.find((e) => e.id === initialConfig.selected_event_id)) ||
            cached[0];
          if (initialMatch) {
            void handleSelectEvent(initialMatch, false, true);
          }
        }
        return;
      }

      setIsLoadingEvents(true);
      try {
        const res = await fetchPublishedEventsAction();
        if (!isMounted) return;
        if (res.success && res.events) {
          setPublishedEvents(res.events);
          writeClientEventsCache(res.events);
          const initialMatch =
            (initialConfig.selected_event_id && res.events.find((e) => e.id === initialConfig.selected_event_id)) ||
            res.events[0];
          if (initialMatch) {
            void handleSelectEvent(initialMatch, false, true);
          }
        }
      } catch (err) {
        console.warn("[Printers] Failed to load Bevy events:", err);
      } finally {
        if (isMounted) {
          setIsLoadingEvents(false);
        }
      }
    }

    void loadEvents();
    return () => {
      isMounted = false;
    };
  }, [handleSelectEvent, initialConfig.selected_event_id]);

  // Sync printer configuration with Firestore live
  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const { subscribePrinterConfigDoc } = await import("@/lib/firestore/client");
        unsubscribe = subscribePrinterConfigDoc((updated) => {
          const normalized = normalizeConfig(updated);
          setConfig((prev) => ({
            ...normalized,
            selected_event_id: normalized.selected_event_id || prev.selected_event_id,
          }));
          setSavedConfig((prev) => ({
            ...normalized,
            selected_event_id: normalized.selected_event_id || prev.selected_event_id,
          }));
        });
      } catch (err) {
        console.warn("[Printers] Could not subscribe to printer config:", err);
      }
    })();
    return () => unsubscribe?.();
  }, [normalizeConfig]);

  // Listen to recent jobs
  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const { subscribeRecentPrintQueue } = await import("@/lib/firestore/client");
        unsubscribe = subscribeRecentPrintQueue(30, (jobs) => {
          setRecentJobs(jobs);
        });
      } catch (err) {
        console.warn("[Printers] Could not subscribe to recent queue:", err);
      }
    })();
    return () => unsubscribe?.();
  }, []);

  // Build active LabelTemplateData combining selected Bevy event + sample attendee overrides
  const activeSampleData = React.useMemo<LabelTemplateData>(() => {
    const custom = config.sample_data ?? {};
    const eventId = custom.eventId ?? selectedEvent?.id ?? config.selected_event_id ?? "132640";
    const attendeeId = custom.attendeeId ?? DEFAULT_SAMPLE_ATTENDEE.attendeeId;
    const ticketCode = custom.ticketCode ?? DEFAULT_SAMPLE_ATTENDEE.ticketCode;
    return {
      name: custom.name ?? DEFAULT_SAMPLE_ATTENDEE.name,
      email: custom.email ?? DEFAULT_SAMPLE_ATTENDEE.email,
      title: custom.title ?? DEFAULT_SAMPLE_ATTENDEE.title,
      company: custom.company ?? DEFAULT_SAMPLE_ATTENDEE.company,
      sessionTrack: custom.sessionTrack ?? DEFAULT_SAMPLE_ATTENDEE.sessionTrack,
      techStack: custom.techStack ?? DEFAULT_SAMPLE_ATTENDEE.techStack,
      eventTitle: custom.eventTitle ?? selectedEvent?.title ?? "DevFest Jakarta 2026",
      eventDate: custom.eventDate ?? selectedEvent?.formattedDate ?? "Sunday, Nov 01, 2026",
      eventTime: custom.eventTime ?? selectedEvent?.formattedTime ?? "07:45 AM - 05:00 PM",
      eventVenue: custom.eventVenue ?? selectedEvent?.venueName ?? "Gedung Sasono Utomo TMII",
      eventId,
      attendeeId,
      ticketCode,
      attendeeCode: custom.attendeeCode ?? ticketCode,
      qrPayload: `${eventId}:${attendeeId}`,
      checkinTime: custom.checkinTime ?? DEFAULT_SAMPLE_ATTENDEE.checkinTime,
    };
  }, [selectedEvent, config.selected_event_id, config.sample_data]);

  const handleSampleDataChange = React.useCallback((patch: Partial<LabelTemplateData>) => {
    setConfig((prev) => ({
      ...prev,
      sample_data: {
        ...(prev.sample_data ?? {}),
        ...patch,
      },
    }));
  }, []);

  const handleResetSampleData = React.useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      sample_data: undefined,
    }));
    toast.success("Sample data reset to default.");
  }, []);

  // Helper to execute silent print on an HTML snippet
  const executeSilentPrint = React.useCallback(
    async (renderedBodyHtml: string): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        try {
          const iframe = printIframeRef.current;
          if (!iframe) {
            reject(new Error("Print iframe element not mounted."));
            return;
          }

          const fullHtml = buildPrintDocument(
            renderedBodyHtml,
            config.paper_width_mm,
            config.paper_height_mm,
            config.orientation,
          );

          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) {
            reject(new Error("Cannot access iframe document."));
            return;
          }

          iframeDoc.open();
          iframeDoc.write(fullHtml);
          iframeDoc.close();

          const img = iframeDoc.querySelector("img");
          const triggerPrint = () => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              setTimeout(() => resolve(), 600);
            } catch (err) {
              reject(err);
            }
          };

          if (img && !img.complete) {
            img.onload = () => triggerPrint();
            img.onerror = () => triggerPrint();
          } else {
            setTimeout(triggerPrint, 150);
          }
        } catch (err) {
          reject(err);
        }
      });
    },
    [config.paper_width_mm, config.paper_height_mm, config.orientation],
  );

  // Background Print Station Listener loop
  React.useEffect(() => {
    if (!isStationRunning) return;

    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const { subscribePendingPrintQueue } = await import("@/lib/firestore/client");
        unsubscribe = subscribePendingPrintQueue(async (jobs) => {
          if (!jobs || jobs.length === 0 || isPrintingRef.current) return;

          isPrintingRef.current = true;
          for (const job of jobs) {
            try {
              await updatePrintJobStatusAction(job.id, "printing");
              await executeSilentPrint(job.rendered_html);
              await updatePrintJobStatusAction(job.id, "completed");
              toast.success(`Printed label for ${job.member_name}`);
            } catch (printErr) {
              const errMsg = printErr instanceof Error ? printErr.message : "Print execution error";
              console.error("[Print Station] Print failure:", printErr);
              await updatePrintJobStatusAction(job.id, "failed", errMsg);
              toast.error(`Print failed for ${job.member_name}: ${errMsg}`);
            }
          }
          isPrintingRef.current = false;
        });
      } catch (err) {
        console.warn("[Printers] Print Station subscription failed:", err);
      }
    })();

    return () => {
      unsubscribe?.();
      isPrintingRef.current = false;
    };
  }, [isStationRunning, executeSilentPrint]);

  // Handle Preset Selection
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const found = CLABEL_PAPER_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setConfig((prev) => {
        const nextWidth = prev.orientation === "portrait" ? found.heightMm : found.widthMm;
        const nextHeight = prev.orientation === "portrait" ? found.widthMm : found.heightMm;
        return {
          ...prev,
          paper_width_mm: nextWidth,
          paper_height_mm: nextHeight,
          template_html: syncTemplateDimensions(prev.template_html, nextWidth, nextHeight, prev.orientation),
        };
      });
    }
  };

  // Handle Orientation Change
  const handleOrientationChange = (nextOrientation: "portrait" | "landscape") => {
    setConfig((prev) => {
      const shouldSwap =
        (nextOrientation === "portrait" && prev.paper_width_mm > prev.paper_height_mm) ||
        (nextOrientation === "landscape" && prev.paper_height_mm > prev.paper_width_mm);
      const nextWidth = shouldSwap ? prev.paper_height_mm : prev.paper_width_mm;
      const nextHeight = shouldSwap ? prev.paper_width_mm : prev.paper_height_mm;
      return {
        ...prev,
        orientation: nextOrientation,
        paper_width_mm: nextWidth,
        paper_height_mm: nextHeight,
        template_html: syncTemplateDimensions(prev.template_html, nextWidth, nextHeight, nextOrientation),
      };
    });
  };

  // Handle Custom Width/Height Change
  const handleDimensionChange = (dimension: "width" | "height", value: number) => {
    setConfig((prev) => {
      const nextWidth = dimension === "width" ? value : prev.paper_width_mm;
      const nextHeight = dimension === "height" ? value : prev.paper_height_mm;
      return {
        ...prev,
        paper_width_mm: nextWidth,
        paper_height_mm: nextHeight,
        template_html: syncTemplateDimensions(prev.template_html, nextWidth, nextHeight, prev.orientation),
      };
    });
  };

  // Dirty check comparing active config against savedConfig
  const isDirty = React.useMemo(() => {
    return (
      config.paper_width_mm !== savedConfig.paper_width_mm ||
      config.paper_height_mm !== savedConfig.paper_height_mm ||
      config.orientation !== savedConfig.orientation ||
      config.auto_print_on_checkin !== savedConfig.auto_print_on_checkin ||
      config.template_html !== savedConfig.template_html ||
      (config.selected_event_id || "") !== (savedConfig.selected_event_id || "") ||
      JSON.stringify(config.sample_data ?? null) !== JSON.stringify(savedConfig.sample_data ?? null)
    );
  }, [config, savedConfig]);

  // Discard unsaved changes
  const handleDiscardChanges = React.useCallback(() => {
    setConfig(savedConfig);
    const matchedPreset = CLABEL_PAPER_PRESETS.find(
      (p) =>
        (p.widthMm === savedConfig.paper_width_mm && p.heightMm === savedConfig.paper_height_mm) ||
        (p.heightMm === savedConfig.paper_width_mm && p.widthMm === savedConfig.paper_height_mm),
    );
    if (matchedPreset) {
      setSelectedPreset(matchedPreset.id);
    }
    if (savedConfig.selected_event_id) {
      const matchedEvent = publishedEvents.find((e) => e.id === savedConfig.selected_event_id);
      if (matchedEvent) {
        setSelectedEvent(matchedEvent);
      }
    }
    toast.info("Discarded unsaved printer settings.");
  }, [savedConfig, publishedEvents]);

  // Save Settings
  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const nextToSave: PrinterConfig = {
        ...config,
        selected_event_id: selectedEvent?.id || config.selected_event_id,
        updated_by: user?.email || user?.name || "Organizer",
      };
      const res = await savePrinterConfigAction(nextToSave);
      if (res.success) {
        setSavedConfig(nextToSave);
        toast.success("Printer settings saved successfully.");
      } else {
        toast.error(res.error || "Failed to save settings.");
      }
    } catch {
      toast.error("An unexpected error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  // Run Test Print
  const handleTestPrint = async () => {
    try {
      const renderedHtml = renderLabelTemplate(config.template_html || DEFAULT_LABEL_TEMPLATE, activeSampleData);
      const jobPayload = {
        event_id: String(activeSampleData.eventId),
        attendee_id: activeSampleData.attendeeId,
        registration_id: "test-reg-id",
        member_name: activeSampleData.name,
        member_title: activeSampleData.title,
        member_company: activeSampleData.company,
        qr_payload: activeSampleData.qrPayload,
        rendered_html: renderedHtml,
      };

      if (isStationRunning) {
        const res = await enqueuePrintJobAction(jobPayload);
        if (!res.success) {
          await executeSilentPrint(renderedHtml);
          toast.success("Direct test print sent to Clabel 221B.");
        }
      } else {
        await executeSilentPrint(renderedHtml);
        const res = await enqueuePrintJobAction(jobPayload);
        if (res.success && res.jobId) {
          await updatePrintJobStatusAction(res.jobId, "completed");
        }
        toast.success("Test print sent to Clabel 221B.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test print failed");
    }
  };

  const pendingJobsCount = recentJobs.filter((j) => j.status === "pending").length;
  const completedJobsCount = recentJobs.filter((j) => j.status === "completed").length;

  return (
    <div className="flex flex-col gap-5">
      {/* Invisible iframe for silent printing */}
      <iframe
        ref={printIframeRef}
        title="Silent Print Frame"
        style={{
          position: "fixed",
          right: "-9999px",
          bottom: "-9999px",
          width: "1px",
          height: "1px",
          border: "none",
        }}
      />

      {/* Dashboard Header (matches /dashboard/organizer) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="font-semibold text-3xl text-foreground tracking-tight">Thermal Printers & Label Station</div>
          <p className="text-muted-foreground text-sm">
            Configure Clabel 221B badge roll dimensions, customize label templates, and run the automated kiosk print
            listener.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:w-fit">
          <Button
            size="sm"
            variant={isStationRunning ? "destructive" : "outline"}
            onClick={() => setIsStationRunning((prev) => !prev)}
            className="gap-1.5"
          >
            {isStationRunning ? (
              <>
                <Square className="size-3.5 fill-current" />
                Stop Print Station
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" />
                Start Print Station
              </>
            )}
          </Button>

          <Button size="sm" variant="outline" onClick={handleTestPrint} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Test Print
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards (matches /dashboard/organizer GDGKpiCards) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Station Listener Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Print Station Status</CardTitle>
            <CardAction>
              <Radio
                className={`size-4 ${isStationRunning ? "animate-pulse text-emerald-600" : "text-muted-foreground"}`}
              />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-3xl text-foreground leading-none tracking-tight">
                {isStationRunning ? "Listening" : "Idle"}
              </span>
              {isStationRunning ? (
                <Badge className="rounded-sm border-emerald-600/50 bg-emerald-500/10 px-1.5 font-normal text-emerald-700 text-xs dark:border-emerald-800/50 dark:bg-emerald-500/15 dark:text-emerald-300">
                  Live Queue
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-sm px-1.5 font-normal text-muted-foreground text-xs">
                  Standby
                </Badge>
              )}
            </div>
            <div className="mt-2 text-right text-muted-foreground text-xs">
              {isStationRunning ? "Auto-printing check-in badges" : "Click Start Print Station to listen"}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Active Roll Size */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Label Format</CardTitle>
            <CardAction>
              <Maximize2 className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-3xl text-foreground leading-none tracking-tight">
                {config.paper_width_mm} × {config.paper_height_mm} mm
              </span>
              <Badge className="rounded-sm border-blue-600/50 bg-blue-500/10 px-1.5 font-normal text-blue-700 text-xs capitalize dark:border-blue-800/50 dark:bg-blue-500/15 dark:text-blue-300">
                {config.orientation}
              </Badge>
            </div>
            <div className="mt-2 text-right text-muted-foreground text-xs">Clabel 221B Direct Thermal (203 DPI)</div>
          </CardContent>
        </Card>

        {/* Card 3: Print Queue Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Print Queue Activity</CardTitle>
            <CardAction>
              <Activity className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-3xl text-foreground leading-none tracking-tight">
                {completedJobsCount}
              </span>
              <Badge
                className={
                  pendingJobsCount > 0
                    ? "rounded-sm border-amber-600/50 bg-amber-500/10 px-1.5 font-normal text-amber-700 text-xs dark:border-amber-800/50 dark:bg-amber-500/15 dark:text-amber-300"
                    : "rounded-sm border-emerald-600/50 bg-emerald-500/10 px-1.5 font-normal text-emerald-700 text-xs dark:border-emerald-800/50 dark:bg-emerald-500/15 dark:text-emerald-300"
                }
              >
                {pendingJobsCount} Pending
              </Badge>
            </div>
            <div className="mt-2 text-right text-muted-foreground text-xs">Badges printed in recent queue</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="editor" className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="editor" className="gap-1.5">
              <Code2 className="size-3.5" />
              Template & Size
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-1.5">
              <Clock className="size-3.5" />
              Print Queue ({recentJobs.length})
            </TabsTrigger>
            <TabsTrigger value="instructions" className="gap-1.5">
              <Laptop className="size-3.5" />
              Station Setup
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: TEMPLATE & SIZE */}
        <TabsContent value="editor" className="mt-0 flex flex-col gap-5">
          {/* Top Configuration Row: Target Bevy Event + Paper & Roll Sizing */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            {/* Target Bevy Event Card */}
            <Card className="xl:col-span-6">
              <CardHeader>
                <CardTitle>Target Bevy Event</CardTitle>
                <CardDescription>
                  Select a Bevy chapter event to populate event data (<code>[[EventName]]</code>,{" "}
                  <code>[[eventId]]</code>, <code>[[EventDate]]</code>, <code>[[EventVenue]]</code>, and QR payload) for
                  live preview and test prints.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PublishedEventSelector
                  events={publishedEvents}
                  selectedEventId={selectedEvent?.id}
                  onSelectEvent={(ev) => void handleSelectEvent(ev)}
                  isLoading={isLoadingEvents}
                  isLoadingDetail={isLoadingEventDetail}
                  onRefresh={() => void handleRefreshEvents()}
                  isRefreshing={isRefreshingEvents}
                />

                {selectedEvent && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border bg-muted/20 px-3.5 py-2.5 text-muted-foreground text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        ID #{selectedEvent.id}
                      </Badge>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3.5 text-sky-600 dark:text-sky-400" />
                      {selectedEvent.formattedDate}
                      {selectedEvent.formattedTime ? ` • ${selectedEvent.formattedTime}` : ""}
                    </span>
                    {selectedEvent.venueName && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        {selectedEvent.venueName}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3.5">
                  <div className="space-y-0.5 pr-4">
                    <Label className="cursor-pointer font-medium text-sm" htmlFor="auto-print-switch">
                      Global Auto-Print on Check-in
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Automatically enqueue a badge print job whenever an attendee is checked in on Bevy.
                    </p>
                  </div>
                  <Switch
                    id="auto-print-switch"
                    checked={config.auto_print_on_checkin}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, auto_print_on_checkin: checked }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Clabel 221B Paper & Roll Sizing Card */}
            <Card className="xl:col-span-6">
              <CardHeader>
                <CardTitle>Clabel 221B Paper & Roll Sizing</CardTitle>
                <CardDescription>
                  Select a preset or enter custom thermal sticker roll dimensions in millimeters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Standard Preset</Label>
                    <Select value={selectedPreset} onValueChange={handlePresetChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select paper preset" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLABEL_PAPER_PRESETS.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Orientation</Label>
                    <Select value={config.orientation} onValueChange={handleOrientationChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Orientation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landscape">Landscape (Horizontal)</SelectItem>
                        <SelectItem value="portrait">Portrait (Vertical)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Width (mm)</Label>
                    <Input
                      type="number"
                      min={15}
                      max={150}
                      value={config.paper_width_mm}
                      onChange={(e) => handleDimensionChange("width", Number(e.target.value) || 50)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Height (mm)</Label>
                    <Input
                      type="number"
                      min={15}
                      max={150}
                      value={config.paper_height_mm}
                      onChange={(e) => handleDimensionChange("height", Number(e.target.value) || 30)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Side-by-Side Monaco HTML Source Code Editor & Live Preview Card (matches Email Templates) */}
          <Card>
            <CardHeader>
              <CardTitle>Label HTML Template &amp; Live Preview</CardTitle>
              <CardDescription>
                Edit the HTML source code and CSS styles directly, drag &amp; drop tokens, and preview your thermal
                badge in real time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LabelHtmlEditorPreview
                value={config.template_html}
                onChange={(nextHtml) => setConfig((prev) => ({ ...prev, template_html: nextHtml }))}
                sampleData={activeSampleData}
                onSampleDataChange={handleSampleDataChange}
                onResetSampleData={handleResetSampleData}
                widthMm={config.paper_width_mm}
                heightMm={config.paper_height_mm}
                orientation={config.orientation}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: PRINT QUEUE */}
        <TabsContent value="queue" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Real-Time Print Queue</CardTitle>
              <CardDescription>Latest 30 print jobs logged from QR check-in scans across the venue.</CardDescription>
              <CardAction>
                <Badge variant="outline" className="text-xs">
                  {pendingJobsCount} Pending
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                  <Printer className="mb-2 size-8 text-muted-foreground/50" />
                  <p className="font-medium text-sm">No print jobs in queue</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Scan an attendee QR code with Auto-Print enabled or click Test Print to verify your station.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Time</TableHead>
                        <TableHead>Attendee</TableHead>
                        <TableHead>Event ID</TableHead>
                        <TableHead>QR Payload</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-mono text-muted-foreground text-xs">
                            {new Date(job.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-xs">{job.member_name}</div>
                            {job.member_title && (
                              <div className="text-[11px] text-muted-foreground">{job.member_title}</div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">#{job.event_id}</TableCell>
                          <TableCell className="font-mono text-muted-foreground text-xs">{job.qr_payload}</TableCell>
                          <TableCell>
                            {job.status === "completed" && (
                              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600">
                                <CheckCircle2 className="mr-1 size-3" />
                                Printed
                              </Badge>
                            )}
                            {job.status === "pending" && (
                              <Badge className="border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-600">
                                <Clock className="mr-1 size-3" />
                                Queued
                              </Badge>
                            )}
                            {job.status === "printing" && (
                              <Badge className="animate-pulse border-blue-500/20 bg-blue-500/10 text-[10px] text-blue-600">
                                <Printer className="mr-1 size-3" />
                                Printing
                              </Badge>
                            )}
                            {job.status === "failed" && (
                              <Badge className="border-rose-500/20 bg-rose-500/10 text-[10px] text-rose-600">
                                <AlertCircle className="mr-1 size-3" />
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => executeSilentPrint(job.rendered_html)}
                            >
                              Reprint
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: STATION SETUP */}
        <TabsContent value="instructions" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Silent Printing Setup for Clabel 221B</CardTitle>
              <CardDescription>
                Step-by-step instructions for running the automated print station on a dedicated check-in PC.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5 rounded-lg border p-4">
                <div className="font-semibold text-foreground text-sm">1. Install Driver & Set Default Printer</div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Connect your Clabel 221B via USB and install the official Clabel driver from{" "}
                  <a
                    href="https://ga.ctaiot.com/pc"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary underline"
                  >
                    ga.ctaiot.com/pc <ExternalLink className="size-3" />
                  </a>
                  . Set <strong>Clabel 221B</strong> as your OS <strong>Default Printer</strong>.
                </p>
              </div>

              <div className="space-y-1.5 rounded-lg border p-4">
                <div className="font-semibold text-foreground text-sm">2. Configure Roll Dimensions in Driver</div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Open Printer Preferences &rarr; Page Setup. Set the paper size to match your sticker roll (e.g. 50mm ×
                  30mm) and set all margins to <strong>0mm</strong>.
                </p>
              </div>

              <div className="space-y-2 rounded-lg border p-4 md:col-span-2">
                <div className="font-semibold text-foreground text-sm">
                  3. Launch Chrome with Kiosk Printing (Zero Dialogs)
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  To bypass the browser print dialog completely, launch Chrome with the{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">--kiosk-printing</code>{" "}
                  flag on your check-in laptop:
                </p>
                <div className="space-y-1 overflow-x-auto rounded-lg bg-zinc-950 p-3.5 font-mono text-xs text-zinc-100">
                  <div className="text-zinc-400"># Windows (Command Prompt / Shortcut Target):</div>
                  <div className="text-emerald-400">
                    &quot;C:\Program Files\Google\Chrome\Application\chrome.exe&quot; --kiosk-printing
                    &quot;https://app.gdgjakarta.org/dashboard/printers&quot;
                  </div>
                  <div className="pt-2 text-zinc-400"># macOS (Terminal):</div>
                  <div className="text-emerald-400">
                    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --kiosk-printing
                    &quot;https://app.gdgjakarta.org/dashboard/printers&quot;
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fixed Floating Bottom Save Bar (matches Custom Form & Event Settings) */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={() => void handleSaveConfig()}
        onDiscard={handleDiscardChanges}
        discardLabel="Discard"
        saveLabel="Save All Settings"
        savingLabel="Saving Settings..."
        savedLabel="Saved (No Changes)"
        statusInfo={
          <span>
            Roll:{" "}
            <strong>
              {config.paper_width_mm}×{config.paper_height_mm}mm ({config.orientation})
            </strong>
          </span>
        }
        helperText="Roll dimensions, label template & auto-print preferences will immediately apply."
      />
    </div>
  );
}
