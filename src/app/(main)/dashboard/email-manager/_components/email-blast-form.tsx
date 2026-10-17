"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, extractApiMessage } from "@/lib/utils";

import { fetchBevyEventDetailAction, fetchPublishedEventsAction } from "../_actions/fetch-published-events";
import { fetchSheetHeaders } from "../_actions/fetch-sheet-headers";
import { fetchSheetsList } from "../_actions/fetch-sheets-list";
import type { AudienceType, ResolvedRecipient } from "../_actions/resolve-audience-recipients";
import { sendEmailBlast } from "../_actions/send-email-blast";
import {
  type AttendeeDynamicPlaceholders,
  buildDefaultEventPlaceholders,
  defaultAttendeePlaceholders,
  type EventDynamicPlaceholders,
  type PublishedEventOption,
} from "../_types/placeholders";
import { AudienceSelector } from "./audience-selector";
import {
  defaultHtmlTemplate,
  deleteCustomEmailBlastTemplate,
  type EmailBlastTemplate,
  getAllEmailBlastTemplates,
} from "./default-html-template";
import { HtmlEditorPreview } from "./html-editor-preview";
import { PublishedEventSelector } from "./published-event-selector";
import { SaveEmailTemplateDialog } from "./save-email-template-dialog";

const formSchema = z.object({
  eventId: z.string().min(1, { message: "Event is required." }),
  recipientSource: z.enum(["audience", "spreadsheet"]),
  audienceType: z.string().optional(),
  spreadsheetUrl: z.string().optional(),
  sheetName: z.string().optional(),
  headerRow: z.number().int().min(1, { message: "Header row position must be at least 1." }),
  subject: z.string().min(1, { message: "Subject is required." }),
  headerUrl: z.string().optional(),
  body: z.string().min(1, { message: "Email HTML body is required." }),
});

export type FormValues = z.infer<typeof formSchema>;

export interface EmailBlastFormProps {
  onSuccess?: () => void;
  showHeader?: boolean;
  publishedEvents?: PublishedEventOption[];
  selectedEvent?: PublishedEventOption;
  eventPlaceholders?: EventDynamicPlaceholders;
  attendeePlaceholders?: AttendeeDynamicPlaceholders;
  isLoadingEvents?: boolean;
  isLoadingEventDetail?: boolean;
  onSelectEvent?: (event: PublishedEventOption) => void;
  onChangePlaceholders?: (placeholders: EventDynamicPlaceholders) => void;
  onResetPlaceholders?: () => void;
  onChangeAttendeePlaceholders?: (placeholders: AttendeeDynamicPlaceholders) => void;
  onResetAttendeePlaceholders?: () => void;
  onRefreshEvents?: () => void;
  isRefreshingEvents?: boolean;
  initialTemplate?: EmailBlastTemplate | null;
  onTemplateChange?: (template: EmailBlastTemplate | null) => void;
}

interface AttendeeFieldItem {
  key: keyof AttendeeDynamicPlaceholders;
  label: string;
  tag: string;
  placeholder: string;
}

const ATTENDEE_FIELDS: AttendeeFieldItem[] = [
  { key: "Name", label: "Recipient Name", tag: "[[Name]]", placeholder: "e.g. Budi Santoso" },
  { key: "FirstName", label: "First Name", tag: "[[FirstName]]", placeholder: "e.g. Budi" },
  { key: "LastName", label: "Last Name", tag: "[[LastName]]", placeholder: "e.g. Santoso" },
  { key: "Email", label: "Email Address", tag: "[[Email]]", placeholder: "e.g. budi.santoso@example.com" },
  { key: "TicketType", label: "Ticket Tier", tag: "[[TicketType]]", placeholder: "e.g. In-Person Pass (Free)" },
  { key: "CheckinStatus", label: "Check-in Status", tag: "[[CheckinStatus]]", placeholder: "e.g. Checked In" },
];

export function EmailBlastForm({
  onSuccess,
  showHeader = true,
  publishedEvents: propEvents,
  selectedEvent: propSelectedEvent,
  eventPlaceholders: propPlaceholders,
  attendeePlaceholders: propAttendeePlaceholders,
  isLoadingEvents: propIsLoadingEvents,
  isLoadingEventDetail: propIsLoadingDetail,
  onSelectEvent: propOnSelectEvent,
  onChangePlaceholders: propOnChangePlaceholders,
  onResetPlaceholders: propOnResetPlaceholders,
  onChangeAttendeePlaceholders: propOnChangeAttendeePlaceholders,
  onResetAttendeePlaceholders: propOnResetAttendeePlaceholders,
  onRefreshEvents: propOnRefreshEvents,
  isRefreshingEvents: propIsRefreshingEvents,
  initialTemplate,
  onTemplateChange,
}: EmailBlastFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [internalEvents, setInternalEvents] = useState<PublishedEventOption[]>([]);
  const [internalLoadingEvents, setInternalLoadingEvents] = useState(true);
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const [internalSelectedEvent, setInternalSelectedEvent] = useState<PublishedEventOption | undefined>();
  const [internalPlaceholders, setInternalPlaceholders] = useState<EventDynamicPlaceholders>(() =>
    buildDefaultEventPlaceholders(),
  );
  const [internalAttendeePlaceholders, setInternalAttendeePlaceholders] = useState<AttendeeDynamicPlaceholders>(
    () => defaultAttendeePlaceholders,
  );
  const [internalLoadingDetail, setInternalLoadingDetail] = useState(false);
  const [isPlaceholdersOpen, setIsPlaceholdersOpen] = useState(false);
  const [isAttendeePlaceholdersOpen, setIsAttendeePlaceholdersOpen] = useState(false);

  // Email blast templates state
  const [templatesData, setTemplatesData] = useState(() => getAllEmailBlastTemplates());
  const [activeTemplate, setActiveTemplate] = useState<EmailBlastTemplate | null>(initialTemplate ?? null);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);

  const refreshTemplates = useCallback(() => {
    setTemplatesData(getAllEmailBlastTemplates());
  }, []);

  const publishedEvents = propEvents ?? internalEvents;
  const isLoadingEvents = propIsLoadingEvents ?? internalLoadingEvents;
  const isRefreshingEvents = propIsRefreshingEvents ?? internalRefreshing;
  const selectedEvent = propSelectedEvent ?? internalSelectedEvent;
  const eventPlaceholders = propPlaceholders ?? internalPlaceholders;
  const attendeePlaceholders = propAttendeePlaceholders ?? internalAttendeePlaceholders;
  const isLoadingEventDetail = propIsLoadingDetail ?? internalLoadingDetail;

  // Audience resolution state
  const [resolvedRecipients, setResolvedRecipients] = useState<ResolvedRecipient[]>([]);
  const [recipientCount, setRecipientCount] = useState<number>(0);
  const [isResolvingAudience, setIsResolvingAudience] = useState(false);

  // Google Sheets state (legacy fallback)
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  const [, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eventId: selectedEvent?.id || "",
      recipientSource: "audience",
      audienceType: "ticket_all",
      spreadsheetUrl: "",
      sheetName: "",
      headerRow: 1,
      subject: "",
      headerUrl: eventPlaceholders.EventBannerUrl,
      body: defaultHtmlTemplate,
    },
  });

  const eventId = watch("eventId");
  const recipientSource = watch("recipientSource");
  const audienceType = watch("audienceType");
  const spreadsheetUrl = watch("spreadsheetUrl");
  const sheetName = watch("sheetName");
  const headerRow = watch("headerRow");
  const headerUrlValue = watch("headerUrl");
  const bodyValue = watch("body");

  const isResolvingRecipients =
    recipientSource === "audience" &&
    (isResolvingAudience || isLoadingEventDetail || isRefreshingEvents || (isLoadingEvents && !selectedEvent));

  const submitButtonLabel = (() => {
    if (isSubmitting) return "Dispatching...";
    if (isResolvingRecipients) return "Send Bulk Email (...)";
    if (recipientSource === "audience" && recipientCount > 0) {
      return `Send Bulk Email (${recipientCount.toLocaleString()})`;
    }
    return "Send Bulk Email";
  })();

  const lastFetchedUrl = useRef("");
  const lastFetchedSheetName = useRef("");
  const hasInitializedEventRef = useRef(false);

  // Function to load detail event and autofill dynamic placeholders + header banner
  const loadEventDetail = useCallback(
    async (ev: PublishedEventOption) => {
      if (propOnSelectEvent) {
        propOnSelectEvent(ev);
        return;
      }

      setInternalSelectedEvent(ev);
      setValue("eventId", ev.id, { shouldValidate: true });

      const initialDefaults = buildDefaultEventPlaceholders(ev);
      setInternalPlaceholders(initialDefaults);
      setValue("headerUrl", initialDefaults.EventBannerUrl);

      setInternalLoadingDetail(true);
      try {
        const res = await fetchBevyEventDetailAction(ev.id);
        if (res.success && res.event && res.placeholders) {
          setInternalSelectedEvent(res.event);
          setInternalPlaceholders(res.placeholders);
          setValue("headerUrl", res.placeholders.EventBannerUrl);
        }
      } catch (err) {
        console.error("Failed to load Bevy event detail:", err);
      } finally {
        setInternalLoadingDetail(false);
      }
    },
    [propOnSelectEvent, setValue],
  );

  // Refresh handler for published events
  const handleRefreshEvents = useCallback(async () => {
    if (propOnRefreshEvents) {
      propOnRefreshEvents();
      return;
    }

    setInternalRefreshing(true);
    try {
      const res = await fetchPublishedEventsAction({ forceRefresh: true });
      if (res.success && res.events) {
        setInternalEvents(res.events);
        toast.success("Bevy Events Refreshed", {
          description: `Loaded ${res.events.length} chapter event${res.events.length === 1 ? "" : "s"} from Bevy.`,
        });
        if (internalSelectedEvent) {
          const matched = res.events.find((e) => e.id === internalSelectedEvent.id);
          if (matched) {
            void loadEventDetail(matched);
          } else if (res.events.length > 0) {
            void loadEventDetail(res.events[0]);
          }
        }
      } else {
        toast.error("Failed to refresh Bevy events", {
          description: res.error ?? "Could not retrieve fresh events from Bevy.",
        });
      }
    } catch (err) {
      console.error("Failed to refresh Bevy events:", err);
      toast.error("Failed to refresh Bevy events", { description: extractApiMessage(err) });
    } finally {
      setInternalRefreshing(false);
    }
  }, [propOnRefreshEvents, internalSelectedEvent, loadEventDetail]);

  // Load published events on mount if standalone (e.g. in Quick Blast Modal)
  useEffect(() => {
    if (propEvents) return; // Controlled by EmailManager

    let isMounted = true;
    async function loadEvents() {
      setInternalLoadingEvents(true);
      try {
        const res = await fetchPublishedEventsAction();
        if (!isMounted) return;
        if (res.success && res.events) {
          setInternalEvents(res.events);
          if (res.events.length > 0 && !hasInitializedEventRef.current) {
            hasInitializedEventRef.current = true;
            const first = res.events[0];
            void loadEventDetail(first);
          }
        } else {
          toast.error("Could not load Bevy events", {
            description: res.error,
          });
        }
      } catch (err) {
        console.error("Failed to fetch Bevy events:", err);
      } finally {
        if (isMounted) {
          setInternalLoadingEvents(false);
        }
      }
    }
    void loadEvents();

    return () => {
      isMounted = false;
    };
  }, [propEvents, loadEventDetail]);

  // Keep form values in sync when controlled selectedEvent or eventPlaceholders change
  useEffect(() => {
    if (selectedEvent?.id && selectedEvent.id !== eventId) {
      setIsResolvingAudience(true);
      setValue("eventId", selectedEvent.id, { shouldValidate: true });
    }
  }, [selectedEvent?.id, eventId, setValue]);

  useEffect(() => {
    if (eventPlaceholders?.EventBannerUrl && !headerUrlValue) {
      setValue("headerUrl", eventPlaceholders.EventBannerUrl);
    }
  }, [eventPlaceholders?.EventBannerUrl, headerUrlValue, setValue]);

  // Sync initialTemplate if supplied from parent tab
  useEffect(() => {
    if (initialTemplate) {
      setActiveTemplate(initialTemplate);
      setValue("body", initialTemplate.body, { shouldValidate: true });
      if (initialTemplate.subject) {
        setValue("subject", initialTemplate.subject, { shouldValidate: true });
      }
      if (initialTemplate.headerUrl) {
        setValue("headerUrl", initialTemplate.headerUrl);
      }
    }
  }, [initialTemplate, setValue]);

  const handleApplyTemplate = (tpl: EmailBlastTemplate) => {
    setActiveTemplate(tpl);
    setValue("body", tpl.body, { shouldValidate: true });
    if (tpl.subject) {
      setValue("subject", tpl.subject, { shouldValidate: true });
    }
    if (tpl.headerUrl) {
      setValue("headerUrl", tpl.headerUrl);
    }
    if (onTemplateChange) {
      onTemplateChange(tpl);
    }
    toast.success(`Template Applied: ${tpl.name}`, {
      description: "Subject and HTML body updated with template content.",
    });
  };

  const handleDeleteCustomTemplate = (e: React.MouseEvent, tplId: string, tplName: string) => {
    e.stopPropagation();
    deleteCustomEmailBlastTemplate(tplId);
    refreshTemplates();
    if (activeTemplate?.id === tplId) {
      setActiveTemplate(null);
    }
    toast.success("Template Deleted", {
      description: `Removed "${tplName}" from your custom templates.`,
    });
  };

  // Handle Event selection
  const handleSelectEvent = (event: PublishedEventOption) => {
    setIsResolvingAudience(true);
    setValue("eventId", event.id, { shouldValidate: true });
    void loadEventDetail(event);

    // Pre-fill a helpful subject if empty
    const currentSubject = watch("subject");
    if (!currentSubject) {
      setValue("subject", `Important Update: ${event.title}`, { shouldValidate: true });
    }
  };

  const handlePlaceholderChange = (key: keyof EventDynamicPlaceholders, val: string) => {
    const updated = {
      ...eventPlaceholders,
      [key]: val,
    };
    if (key === "EventBannerUrl") {
      setValue("headerUrl", val);
    }
    if (propOnChangePlaceholders) {
      propOnChangePlaceholders(updated);
    } else {
      setInternalPlaceholders(updated);
    }
  };

  const handleResetPlaceholders = () => {
    if (propOnResetPlaceholders) {
      propOnResetPlaceholders();
    } else if (selectedEvent) {
      const resetVals = buildDefaultEventPlaceholders(selectedEvent);
      setInternalPlaceholders(resetVals);
      setValue("headerUrl", resetVals.EventBannerUrl);
      toast.success("Placeholders Reset", {
        description: "Dynamic placeholders reset to Bevy event defaults.",
      });
    }
  };

  const handleAttendeePlaceholderChange = (key: keyof AttendeeDynamicPlaceholders, val: string) => {
    const updated = {
      ...attendeePlaceholders,
      [key]: val,
    };
    if (propOnChangeAttendeePlaceholders) {
      propOnChangeAttendeePlaceholders(updated);
    } else {
      setInternalAttendeePlaceholders(updated);
    }
  };

  const handleResetAttendeePlaceholders = () => {
    if (propOnResetAttendeePlaceholders) {
      propOnResetAttendeePlaceholders();
    } else {
      setInternalAttendeePlaceholders(defaultAttendeePlaceholders);
      toast.success("Attendee Placeholders Reset", {
        description: "Restored sample attendee values to defaults.",
      });
    }
  };

  const handleAudienceTypeChange = useCallback(
    (audience: AudienceType) => {
      setValue("audienceType", audience, { shouldValidate: true });
      setIsResolvingAudience(true);
    },
    [setValue],
  );

  // Handle Audience selection callback
  const handleSelectAudience = useCallback(
    (audience: AudienceType, result: { count: number; recipients: ResolvedRecipient[] }) => {
      setValue("audienceType", audience, { shouldValidate: true });
      setResolvedRecipients(result.recipients);
      setRecipientCount(result.count);
    },
    [setValue],
  );

  const handleLoadSheets = useCallback(async () => {
    if (!spreadsheetUrl) return;
    setIsLoadingSheets(true);
    setAvailableSheets([]);
    setValue("sheetName", "", { shouldValidate: true });
    lastFetchedUrl.current = spreadsheetUrl;

    try {
      const res = await fetchSheetsList(spreadsheetUrl);
      if (res.success && res.sheets) {
        setAvailableSheets(res.sheets);
        toast.success("Sheets Loaded", {
          description: `Loaded ${res.sheets.length} sheet tab${res.sheets.length === 1 ? "" : "s"}.`,
        });
        if (res.sheets.length > 0) {
          setValue("sheetName", res.sheets[0], { shouldValidate: true });
        }
      } else {
        lastFetchedUrl.current = "";
        toast.error("Failed to load sheet tabs", {
          description: res.error || "Could not retrieve sheets from spreadsheet.",
        });
      }
    } catch (err) {
      lastFetchedUrl.current = "";
      toast.error("Failed to load sheet tabs", { description: extractApiMessage(err) });
    } finally {
      setIsLoadingSheets(false);
    }
  }, [spreadsheetUrl, setValue]);

  const handleLoadTags = useCallback(async () => {
    if (!spreadsheetUrl || !sheetName) return;
    const rowNum = Math.max(1, Math.floor(Number(headerRow) || 1));
    setIsLoadingTags(true);
    startTransition(async () => {
      try {
        const res = await fetchSheetHeaders(spreadsheetUrl, sheetName, rowNum);
        if (res.success && res.headers) {
          setAvailableTags(res.headers);
          if (res.headers.length > 0) {
            toast.success("Sheet Headers Loaded", {
              description: `Loaded ${res.headers.length} column token${res.headers.length === 1 ? "" : "s"} from row ${rowNum}.`,
            });
          } else {
            toast.info("No Column Titles Found", {
              description: `Row ${rowNum} contains no non-empty column titles.`,
            });
          }
        } else if (!res.success && res.error) {
          setAvailableTags([]);
          toast.error("Failed to load sheet headers", {
            description: res.error,
          });
        }
      } catch (err) {
        setAvailableTags([]);
        toast.error("Failed to load sheet headers", {
          description: extractApiMessage(err),
        });
      } finally {
        setIsLoadingTags(false);
      }
    });
  }, [spreadsheetUrl, sheetName, headerRow]);

  // Google Sheets auto-fetch listeners
  useEffect(() => {
    if (recipientSource !== "spreadsheet" || !spreadsheetUrl) return;
    const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return;
    if (spreadsheetUrl === lastFetchedUrl.current) return;

    const timer = setTimeout(() => {
      void handleLoadSheets();
    }, 1000);

    return () => clearTimeout(timer);
  }, [spreadsheetUrl, recipientSource, handleLoadSheets]);

  useEffect(() => {
    if (recipientSource !== "spreadsheet" || !sheetName || !spreadsheetUrl) return;
    const combination = `${spreadsheetUrl}|${sheetName}|${headerRow || 1}`;
    if (combination === lastFetchedSheetName.current) return;

    const timer = setTimeout(() => {
      lastFetchedSheetName.current = combination;
      void handleLoadTags();
    }, 400);

    return () => clearTimeout(timer);
  }, [sheetName, spreadsheetUrl, headerRow, recipientSource, handleLoadTags]);

  async function onSubmit(data: FormValues) {
    if (data.recipientSource === "audience" && recipientCount === 0) {
      toast.error("No Recipients Found", {
        description: "The selected audience segment has no recipients. Please select another segment.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const eventTitle = selectedEvent?.title;

      const result = await sendEmailBlast({
        eventId: data.eventId,
        eventTitle,
        recipientSource: data.recipientSource,
        audienceType: data.audienceType,
        audienceLabel: data.audienceType,
        spreadsheetUrl: data.spreadsheetUrl,
        sheetName: data.sheetName,
        headerRow: data.headerRow ?? 1,
        subject: data.subject,
        headerUrl: data.headerUrl,
        body: data.body,
        recipients: data.recipientSource === "audience" ? resolvedRecipients : undefined,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to dispatch bulk email.");
      }

      toast.success("Bulk Email Blast Sent", {
        description: result.message || `Campaign successfully queued for ${recipientCount} recipients.`,
      });

      reset();
      onSuccess?.();
    } catch (error: unknown) {
      console.error(error);
      const msg = extractApiMessage(error, "Failed to dispatch bulk email.");
      toast.error("Dispatch Failed", { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card className="shadow-xs">
        {showHeader && (
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle>Bulk Email Campaign Composer</CardTitle>
                {activeTemplate && (
                  <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                    <Bookmark className="mr-1 size-3 text-primary" />
                    {activeTemplate.name}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Select your published event target, configure audience recipients, and design your responsive HTML
                email.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Bookmark className="size-3.5 text-primary" />
                    <span>Templates</span>
                    <ChevronDown className="size-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                  <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Prebuilt Templates
                  </DropdownMenuLabel>
                  {templatesData.defaultTemplates.map((tpl) => (
                    <DropdownMenuItem
                      key={tpl.id}
                      onClick={() => handleApplyTemplate(tpl)}
                      className="flex cursor-pointer flex-col items-start gap-1 py-2"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-medium text-xs text-foreground">{tpl.name}</span>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                          {tpl.badge}
                        </Badge>
                      </div>
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">{tpl.description}</span>
                    </DropdownMenuItem>
                  ))}

                  {templatesData.customTemplates.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        My Saved Templates
                      </DropdownMenuLabel>
                      {templatesData.customTemplates.map((tpl) => (
                        <DropdownMenuItem
                          key={tpl.id}
                          onClick={() => handleApplyTemplate(tpl)}
                          className="group flex cursor-pointer items-start justify-between gap-2 py-2"
                        >
                          <div className="flex flex-col items-start gap-1 overflow-hidden">
                            <span className="font-medium text-xs text-foreground">{tpl.name}</span>
                            <span className="line-clamp-1 text-[11px] text-muted-foreground">{tpl.description}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0 text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"
                            onClick={(e) => handleDeleteCustomTemplate(e, tpl.id, tpl.name)}
                            title="Delete custom template"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setIsSaveTemplateOpen(true)}
              >
                <BookmarkPlus className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Save as Template</span>
              </Button>
            </div>
          </CardHeader>
        )}
        <CardContent className="space-y-6 pt-6">
          {/* 1. Bevy Event Selector */}
          <Field>
            <FieldLabel htmlFor="eventId">Target Bevy Event</FieldLabel>
            <FieldContent>
              <PublishedEventSelector
                events={publishedEvents}
                selectedEventId={eventId}
                onSelectEvent={handleSelectEvent}
                isLoading={isLoadingEvents}
                isLoadingDetail={isLoadingEventDetail}
                disabled={isSubmitting}
                error={!!errors.eventId}
                onRefresh={handleRefreshEvents}
                isRefreshing={isRefreshingEvents}
              />
              <FieldDescription>
                Select the Bevy chapter event this communication campaign is associated with.
              </FieldDescription>
              {errors.eventId && <FieldError>{errors.eventId.message}</FieldError>}
            </FieldContent>
          </Field>

          {/* 2. Recipient Selector: Bevy Audience (Screenshots 1 & 2) vs Google Sheets */}
          <Field>
            <FieldLabel>Recipient Source</FieldLabel>
            <FieldContent>
              <Tabs
                value={recipientSource}
                onValueChange={(val) => setValue("recipientSource", val as "audience" | "spreadsheet")}
                className="w-full space-y-3"
              >
                <TabsList className="grid h-9 w-full grid-cols-2">
                  <TabsTrigger value="audience" className="gap-1.5 text-xs">
                    <Users className="size-3.5" />
                    Bevy Event Audience
                  </TabsTrigger>
                  <TabsTrigger value="spreadsheet" className="gap-1.5 text-xs">
                    <FileSpreadsheet className="size-3.5" />
                    Google Sheets Import
                  </TabsTrigger>
                </TabsList>

                {/* Audience Segment Option (Redesigned Bevy Audience) */}
                <TabsContent value="audience" className="space-y-2 pt-1">
                  <AudienceSelector
                    eventId={eventId}
                    selectedAudience={audienceType as AudienceType}
                    onSelectAudience={handleSelectAudience}
                    onAudienceTypeChange={handleAudienceTypeChange}
                    onResolvingChange={setIsResolvingAudience}
                    isLoadingEvent={isLoadingEventDetail}
                    disabled={isSubmitting || !eventId || isLoadingEventDetail}
                  />
                  <FieldDescription>
                    Filter confirmed attendees, check-in status, ticket types, or chapter members directly from Bevy.
                  </FieldDescription>
                </TabsContent>

                {/* Google Sheets Option (Legacy Fallback) */}
                <TabsContent value="spreadsheet" className="space-y-4 pt-1">
                  <div className="space-y-3 rounded-lg border p-3.5">
                    <div className="space-y-1">
                      <FieldLabel htmlFor="spreadsheetUrl" className="text-xs">
                        Spreadsheet URL
                      </FieldLabel>
                      <div className="flex gap-2">
                        <Input
                          id="spreadsheetUrl"
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          {...register("spreadsheetUrl")}
                          disabled={isSubmitting || isLoadingSheets}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleLoadSheets}
                          disabled={isSubmitting || isLoadingSheets || !spreadsheetUrl}
                          className="gap-1.5 text-xs"
                        >
                          {isLoadingSheets ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                          Fetch Sheets
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <FieldLabel htmlFor="sheetName" className="text-xs">
                          Sheet Tab Name
                        </FieldLabel>
                        <Select
                          value={sheetName || ""}
                          onValueChange={(val) => setValue("sheetName", val, { shouldValidate: true })}
                          disabled={isSubmitting || isLoadingSheets || availableSheets.length === 0}
                        >
                          <SelectTrigger id="sheetName" className="w-full">
                            <SelectValue
                              placeholder={
                                availableSheets.length > 0
                                  ? "Select a sheet tab"
                                  : "Enter spreadsheet URL to load sheets"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {availableSheets.map((sheet) => (
                                <SelectItem key={sheet} value={sheet}>
                                  {sheet}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <FieldLabel htmlFor="headerRow" className="text-xs">
                            Row Title Position (Row #)
                          </FieldLabel>
                          <span className="text-[10px] text-muted-foreground">Default: 1</span>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            id="headerRow"
                            type="number"
                            min={1}
                            placeholder="1"
                            {...register("headerRow", { valueAsNumber: true })}
                            disabled={isSubmitting || isLoadingTags}
                            className="h-9"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleLoadTags}
                            disabled={isSubmitting || isLoadingTags || !spreadsheetUrl || !sheetName}
                            className="h-9 shrink-0 gap-1 px-2.5 text-xs"
                          >
                            {isLoadingTags ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3.5" />
                            )}
                            Fetch Headers
                          </Button>
                        </div>
                        <FieldDescription className="text-[11px]">
                          Position of the row that contains column titles.
                        </FieldDescription>
                        {errors.headerRow && <FieldError>{errors.headerRow.message}</FieldError>}
                      </div>
                    </div>

                    {availableTags.length > 0 && (
                      <div className="flex items-center gap-1.5 rounded-md border border-teal-500/20 bg-teal-500/5 px-2.5 py-1.5 text-teal-700 text-xs dark:text-teal-300">
                        <FileSpreadsheet className="size-3.5 shrink-0" />
                        <span>
                          <strong>{availableTags.length}</strong> non-empty column{" "}
                          {availableTags.length === 1 ? "token" : "tokens"} loaded from row {headerRow || 1}. Drag and
                          drop them in the editor below.
                        </span>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </FieldContent>
          </Field>

          {/* 3. Email Subject */}
          <Field>
            <FieldLabel htmlFor="subject">Email Subject</FieldLabel>
            <FieldContent>
              <Input
                id="subject"
                placeholder="e.g. Important Update: Google I/O Extended Jakarta 2026"
                {...register("subject")}
                disabled={isSubmitting}
                aria-invalid={!!errors.subject}
              />
              <FieldDescription>
                Subject line delivered to recipient inboxes. Dynamic tokens like <code>[[EventName]]</code> or{" "}
                <code>[[Name]]</code> are supported.
              </FieldDescription>
              {errors.subject && <FieldError>{errors.subject.message}</FieldError>}
            </FieldContent>
          </Field>

          {/* 4. Header Image URL */}
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="headerUrl">Header Image URL (Optional)</FieldLabel>
              {selectedEvent?.bannerUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    const fallbackBanner = selectedEvent.bannerUrl ?? "";
                    setValue("headerUrl", fallbackBanner);
                    handlePlaceholderChange("EventBannerUrl", fallbackBanner);
                    toast.success("Header Image Reset", {
                      description: "Reset to Bevy event banner image.",
                    });
                  }}
                >
                  <RotateCcw className="size-3" />
                  Reset to Event Banner
                </Button>
              )}
            </div>
            <FieldContent>
              {isLoadingEventDetail ? (
                <div className="space-y-2.5">
                  <Skeleton className="h-9 w-full animate-pulse rounded-md" />
                  <Skeleton className="aspect-[1850/560] w-full animate-pulse rounded-md" />
                </div>
              ) : (
                <>
                  <Input
                    id="headerUrl"
                    placeholder="https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png"
                    {...register("headerUrl")}
                    onChange={(e) => {
                      setValue("headerUrl", e.target.value);
                      handlePlaceholderChange("EventBannerUrl", e.target.value);
                    }}
                    disabled={isSubmitting}
                  />
                  {headerUrlValue && (
                    <div className="mt-2.5 overflow-hidden rounded-md border bg-muted/40">
                      <div className="relative aspect-[1850/560] w-full overflow-hidden bg-muted">
                        {/* biome-ignore lint/performance/noImgElement: dynamic external banner preview */}
                        <img
                          src={headerUrlValue}
                          alt="Header Banner Preview"
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              <FieldDescription>
                Autofilled from the selected Bevy event banner (recommended: 1850 × 560 px). Editable by organizer.
              </FieldDescription>
            </FieldContent>
          </Field>

          {/* 5. Dynamic Event Placeholders Collapsible Panel */}
          <Collapsible open={isPlaceholdersOpen} onOpenChange={setIsPlaceholdersOpen} className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-sky-500" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-xs">
                      Dynamic Event Placeholders (Autofilled from Bevy)
                    </span>
                    {isLoadingEventDetail && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-sky-500/30 bg-sky-500/10 px-1.5 py-0 text-[10px] text-sky-600 dark:text-sky-400"
                      >
                        <Loader2 className="size-2.5 animate-spin" />
                        <span>Syncing data...</span>
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Custom values override default tokens like <code>[[EventName]]</code>, <code>[[EventVenue]]</code>,
                    etc.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={handleResetPlaceholders}
                  disabled={isSubmitting || isLoadingEventDetail}
                >
                  <RotateCcw className="size-3" />
                  Reset to Bevy Defaults
                </Button>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform duration-200",
                        isPlaceholdersOpen && "rotate-180",
                      )}
                    />
                    <span className="sr-only">Toggle Dynamic Placeholders</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>

            <CollapsibleContent className="space-y-3 pt-1">
              <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card/50 p-3.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs">Event Title</FieldLabel>
                    <code className="text-[10px] text-sky-600 dark:text-sky-400">[[EventName]]</code>
                  </div>
                  {isLoadingEventDetail ? (
                    <Skeleton className="h-8 w-full animate-pulse rounded-md" />
                  ) : (
                    <Input
                      value={eventPlaceholders?.EventName || ""}
                      onChange={(e) => handlePlaceholderChange("EventName", e.target.value)}
                      disabled={isSubmitting}
                      placeholder="e.g. Road to DevFest Jakarta"
                      className="h-8 text-xs"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs">Event Date</FieldLabel>
                    <code className="text-[10px] text-sky-600 dark:text-sky-400">[[EventDate]]</code>
                  </div>
                  {isLoadingEventDetail ? (
                    <Skeleton className="h-8 w-full animate-pulse rounded-md" />
                  ) : (
                    <Input
                      value={eventPlaceholders?.EventDate || ""}
                      onChange={(e) => handlePlaceholderChange("EventDate", e.target.value)}
                      disabled={isSubmitting}
                      placeholder="e.g. FRIDAY, OCT 23, 2026"
                      className="h-8 text-xs"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs">Event Time</FieldLabel>
                    <code className="text-[10px] text-sky-600 dark:text-sky-400">[[EventTime]]</code>
                  </div>
                  {isLoadingEventDetail ? (
                    <Skeleton className="h-8 w-full animate-pulse rounded-md" />
                  ) : (
                    <Input
                      value={eventPlaceholders?.EventTime || ""}
                      onChange={(e) => handlePlaceholderChange("EventTime", e.target.value)}
                      disabled={isSubmitting}
                      placeholder="e.g. 10:00 AM - 05:00 PM"
                      className="h-8 text-xs"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs">Venue Location</FieldLabel>
                    <code className="text-[10px] text-sky-600 dark:text-sky-400">[[EventVenue]]</code>
                  </div>
                  {isLoadingEventDetail ? (
                    <Skeleton className="h-8 w-full animate-pulse rounded-md" />
                  ) : (
                    <Input
                      value={eventPlaceholders?.EventVenue || ""}
                      onChange={(e) => handlePlaceholderChange("EventVenue", e.target.value)}
                      disabled={isSubmitting}
                      placeholder="e.g. Jakarta Convention Center"
                      className="h-8 text-xs"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs">Venue Address</FieldLabel>
                    <code className="text-[10px] text-sky-600 dark:text-sky-400">[[EventAddress]]</code>
                  </div>
                  {isLoadingEventDetail ? (
                    <Skeleton className="h-8 w-full animate-pulse rounded-md" />
                  ) : (
                    <Input
                      value={eventPlaceholders?.EventAddress || ""}
                      onChange={(e) => handlePlaceholderChange("EventAddress", e.target.value)}
                      disabled={isSubmitting}
                      placeholder="e.g. Jl. Jend. Gatot Subroto, Jakarta"
                      className="h-8 text-xs"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs">Event URL</FieldLabel>
                    <code className="text-[10px] text-sky-600 dark:text-sky-400">[[EventUrl]]</code>
                  </div>
                  {isLoadingEventDetail ? (
                    <Skeleton className="h-8 w-full animate-pulse rounded-md" />
                  ) : (
                    <Input
                      value={eventPlaceholders?.EventUrl || ""}
                      onChange={(e) => handlePlaceholderChange("EventUrl", e.target.value)}
                      disabled={isSubmitting}
                      placeholder="https://gdg.community.dev/..."
                      className="h-8 text-xs"
                    />
                  )}
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs">Short Description</FieldLabel>
                    <code className="text-[10px] text-sky-600 dark:text-sky-400">[[EventDescription]]</code>
                  </div>
                  {isLoadingEventDetail ? (
                    <Skeleton className="h-8 w-full animate-pulse rounded-md" />
                  ) : (
                    <Input
                      value={eventPlaceholders?.EventDescription || ""}
                      onChange={(e) => handlePlaceholderChange("EventDescription", e.target.value)}
                      disabled={isSubmitting}
                      placeholder="Short description of the event..."
                      className="h-8 text-xs"
                    />
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Dynamic Attendee Data Placeholders Collapsible Panel */}
          <Collapsible
            open={isAttendeePlaceholdersOpen}
            onOpenChange={setIsAttendeePlaceholdersOpen}
            className="space-y-2"
          >
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-emerald-500" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-xs">
                      Dynamic Attendee Data Placeholders (Recipient Tokens)
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Tokens are dynamically resolved per recipient. Sample values below are used for live preview.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={handleResetAttendeePlaceholders}
                  disabled={isSubmitting}
                >
                  <RotateCcw className="size-3" />
                  Reset to Defaults
                </Button>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform duration-200",
                        isAttendeePlaceholdersOpen && "rotate-180",
                      )}
                    />
                    <span className="sr-only">Toggle Attendee Placeholders</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>

            <CollapsibleContent className="space-y-3 pt-1">
              <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card/50 p-3.5 sm:grid-cols-2">
                {ATTENDEE_FIELDS.map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <FieldLabel className="text-xs">{item.label}</FieldLabel>
                      <code className="text-[10px] text-emerald-600 dark:text-emerald-400">{item.tag}</code>
                    </div>
                    <Input
                      value={attendeePlaceholders?.[item.key] ?? ""}
                      onChange={(e) => handleAttendeePlaceholderChange(item.key, e.target.value)}
                      disabled={isSubmitting}
                      placeholder={item.placeholder}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* 6. Drag-and-Drop HTML Editor & Live Preview */}
          <Field>
            <FieldLabel htmlFor="body">Email HTML Content &amp; Live Preview</FieldLabel>
            <FieldContent>
              <HtmlEditorPreview
                value={bodyValue}
                onChange={(newVal) => setValue("body", newVal, { shouldValidate: true })}
                selectedEvent={selectedEvent}
                eventPlaceholders={eventPlaceholders}
                attendeePlaceholders={attendeePlaceholders}
                headerUrl={headerUrlValue}
                availableTags={availableTags}
                isLoadingTags={isLoadingTags}
              />
              {errors.body && <FieldError>{errors.body.message}</FieldError>}
            </FieldContent>
          </Field>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground text-xs">
            {recipientSource === "audience" ? (
              <span>
                Ready to deliver to{" "}
                {isResolvingRecipients ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                    <Loader2 className="size-3 animate-spin text-primary" />
                    <span>calculating recipients...</span>
                  </span>
                ) : (
                  <strong className="text-foreground">
                    {recipientCount.toLocaleString()} {recipientCount === 1 ? "recipient" : "recipients"}
                  </strong>
                )}
              </span>
            ) : (
              <span>Google Sheets automated column extraction active</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="gap-1.5 text-xs"
              onClick={() => setIsSaveTemplateOpen(true)}
            >
              <BookmarkPlus className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>Save as Template</span>
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || (recipientSource === "audience" && (recipientCount === 0 || isResolvingRecipients))
              }
              size="lg"
              className="min-w-44 gap-2"
            >
              {isSubmitting || isResolvingRecipients ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {submitButtonLabel}
            </Button>
          </div>
        </CardFooter>
      </Card>

      <SaveEmailTemplateDialog
        open={isSaveTemplateOpen}
        onOpenChange={setIsSaveTemplateOpen}
        currentSubject={watch("subject") || ""}
        currentHeaderUrl={headerUrlValue || ""}
        currentBody={bodyValue || defaultHtmlTemplate}
        onSaved={(newTpl) => {
          refreshTemplates();
          setActiveTemplate(newTpl);
          if (onTemplateChange) {
            onTemplateChange(newTpl);
          }
        }}
      />
    </form>
  );
}
