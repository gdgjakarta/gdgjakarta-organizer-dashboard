"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  FileSpreadsheet,
  FolderOpen,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  clearCachedDriveAccessToken,
  type DriveSpreadsheetItem,
  getCachedDriveAccessToken,
  listDriveSpreadsheets,
  requestDriveAccessToken,
} from "@/lib/google-drive/venue-tickets";
import { cn, extractApiMessage } from "@/lib/utils";

import { fetchBevyEventDetailAction, fetchPublishedEventsAction } from "../_actions/fetch-published-events";
import { fetchSheetHeaders } from "../_actions/fetch-sheet-headers";
import { fetchSheetsList } from "../_actions/fetch-sheets-list";
import type { AudienceType, ResolvedRecipient } from "../_actions/resolve-audience-recipients";
import { sendEmailBlast } from "../_actions/send-email-blast";
import { sendQuickEmail } from "../_actions/send-quick-email";
import {
  type AttendeeDynamicPlaceholders,
  buildDefaultEventPlaceholders,
  type CustomPlaceholderDefinition,
  defaultAttendeePlaceholders,
  type EventDynamicPlaceholders,
  extractTokensFromHtml,
  formatTokenKeyToLabel,
  getStoredCustomAttendeePlaceholders,
  getStoredCustomEventPlaceholders,
  type PublishedEventOption,
  STANDARD_ATTENDEE_PLACEHOLDER_KEYS,
  STANDARD_EVENT_PLACEHOLDER_KEYS,
  saveStoredCustomAttendeePlaceholders,
  saveStoredCustomEventPlaceholders,
} from "../_types/placeholders";
import { AddPlaceholderDialog } from "./add-placeholder-dialog";
import { AudienceSelector } from "./audience-selector";
import { ConfirmEmailDialog } from "./confirm-email-dialog";
import {
  defaultHtmlTemplate,
  deleteCustomEmailBlastTemplate,
  type EmailBlastTemplate,
  getAllEmailBlastTemplates,
  saveEmailBlastAsTemplate,
  saveFeatureTemplateOverride,
} from "./default-html-template";
import { HtmlEditorPreview } from "./html-editor-preview";
import { PublishedEventSelector } from "./published-event-selector";
import { SaveEmailTemplateDialog } from "./save-email-template-dialog";
import {
  EMAIL_FEATURE_TEMPLATES,
  type EmailFeatureTemplateItem,
  resolveFeatureTemplateContent,
} from "./template-utils";

const formSchema = z
  .object({
    eventId: z.string().min(1, { message: "Event is required." }),
    recipientSource: z.enum(["audience", "spreadsheet", "single"]),
    recipientEmail: z.string().optional(),
    recipientName: z.string().optional(),
    audienceType: z.string().optional(),
    spreadsheetUrl: z.string().optional(),
    sheetName: z.string().optional(),
    headerRow: z.number().int().min(1, { message: "Header row position must be at least 1." }),
    subject: z.string().min(1, { message: "Subject is required." }),
    headerUrl: z.string().optional(),
    body: z.string().min(1, { message: "Email HTML body is required." }),
  })
  .superRefine((data, ctx) => {
    if (data.recipientSource === "single") {
      if (!data.recipientEmail?.includes("@")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recipientEmail"],
          message: "A valid recipient email address is required.",
        });
      }
    } else if (data.recipientSource === "spreadsheet") {
      if (!data.spreadsheetUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["spreadsheetUrl"],
          message: "Spreadsheet URL is required.",
        });
      }
    }
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
  key: string;
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
  {
    key: "VenueTicketUrl",
    label: "Venue Ticket URL",
    tag: "[[VenueTicketUrl]]",
    placeholder: "https://drive.google.com/file/d/.../view",
  },
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

  // Dynamic custom placeholders state (loaded after mount to avoid SSR hydration mismatch)
  const [customEventPlaceholders, setCustomEventPlaceholders] = useState<CustomPlaceholderDefinition[]>([]);
  const [customAttendeePlaceholders, setCustomAttendeePlaceholders] = useState<CustomPlaceholderDefinition[]>([]);
  const [isAddPlaceholderOpen, setIsAddPlaceholderOpen] = useState(false);
  const [addPlaceholderCategory, setAddPlaceholderCategory] = useState<"event" | "attendee">("event");

  // Email blast templates state
  const [templatesData, setTemplatesData] = useState<{
    defaultTemplates: EmailBlastTemplate[];
    customTemplates: EmailBlastTemplate[];
  }>(() => ({
    defaultTemplates: getAllEmailBlastTemplates().defaultTemplates,
    customTemplates: [],
  }));
  const [activeTemplate, setActiveTemplate] = useState<EmailBlastTemplate | null>(initialTemplate ?? null);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);

  const refreshTemplates = useCallback(() => {
    setTemplatesData(getAllEmailBlastTemplates());
  }, []);

  useEffect(() => {
    setCustomEventPlaceholders(getStoredCustomEventPlaceholders());
    setCustomAttendeePlaceholders(getStoredCustomAttendeePlaceholders());
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

  // Google Sheets state (legacy fallback + Drive picker)
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [sheetRowCount, setSheetRowCount] = useState<number>(0);
  const [sheetSampleRow, setSheetSampleRow] = useState<Record<string, string>>({});
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<DriveSpreadsheetItem[]>([]);
  const [isLoadingDriveSpreadsheets, setIsLoadingDriveSpreadsheets] = useState(false);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [driveSearchQuery, setDriveSearchQuery] = useState("");

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
      recipientEmail: "",
      recipientName: "",
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
  const recipientEmail = watch("recipientEmail");
  const recipientName = watch("recipientName");
  const audienceType = watch("audienceType");
  const spreadsheetUrl = watch("spreadsheetUrl");
  const sheetName = watch("sheetName");
  const headerRow = watch("headerRow");
  const headerUrlValue = watch("headerUrl");
  const bodyValue = watch("body");
  const subjectValue = watch("subject");

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormValues | null>(null);
  const [currentFeatureTemplateId, setCurrentFeatureTemplateId] = useState<string>("default");
  const [templateBaseline, setTemplateBaseline] = useState<{ subject: string; body: string }>({
    subject: "",
    body: defaultHtmlTemplate,
  });

  const hasTemplateChanges =
    (bodyValue || defaultHtmlTemplate) !== templateBaseline.body || (subjectValue || "") !== templateBaseline.subject;

  const currentTemplateName = useMemo(() => {
    if (activeTemplate) return activeTemplate.name;
    const found = EMAIL_FEATURE_TEMPLATES.find((t) => t.id === currentFeatureTemplateId);
    return found ? found.name : "Custom Template";
  }, [activeTemplate, currentFeatureTemplateId]);

  const resolvedAttendeePlaceholders = useMemo<AttendeeDynamicPlaceholders>(() => {
    if (recipientSource === "single" && recipientEmail) {
      const rawName = (recipientName || "").trim();
      const fallbackFromEmail = recipientEmail.split("@")[0] || "Attendee";
      const name = rawName || fallbackFromEmail;
      const parts = name.split(" ");
      const firstName = parts[0] || name;
      const lastName = parts.slice(1).join(" ") || firstName;
      return {
        Name: name,
        FirstName: firstName,
        LastName: lastName,
        Email: recipientEmail,
        TicketType: "Confirmed Entry Pass",
        CheckinStatus: "Confirmed",
        VenueTicketUrl: attendeePlaceholders.VenueTicketUrl,
      };
    }
    return attendeePlaceholders;
  }, [recipientSource, recipientEmail, recipientName, attendeePlaceholders]);

  const isResolvingRecipients =
    recipientSource === "audience" &&
    (isResolvingAudience || isLoadingEventDetail || isRefreshingEvents || (isLoadingEvents && !selectedEvent));

  const submitButtonLabel = (() => {
    if (isSubmitting) return "Dispatching...";
    if (recipientSource === "single") {
      return "Send Email";
    }
    if (isResolvingRecipients) return "Send Bulk Email (...)";
    if (recipientSource === "audience" && recipientCount > 0) {
      return `Send Bulk Email (${recipientCount.toLocaleString()})`;
    }
    if (recipientSource === "spreadsheet") {
      if (isLoadingSheets || isLoadingTags) return "Send Bulk Email (...)";
      if (sheetRowCount > 0) return `Send Bulk Email (${sheetRowCount.toLocaleString()})`;
      return "Send Bulk Email (Sheet)";
    }
    return "Send Bulk Email";
  })();

  const lastFetchedUrl = useRef("");
  const lastFetchedSheetName = useRef("");
  const hasInitializedEventRef = useRef(false);
  const dismissedTokensRef = useRef<Set<string>>(new Set());

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

  // Load default template override on mount if none was passed via initialTemplate
  useEffect(() => {
    if (initialTemplate) return;
    const defaultTpl = EMAIL_FEATURE_TEMPLATES.find((t) => t.id === "default");
    if (!defaultTpl) return;
    const resolved = resolveFeatureTemplateContent(defaultTpl);
    const nextSubject =
      resolved.subject && resolved.subject !== defaultTpl.defaultSubject ? resolved.subject : watch("subject") || "";
    if (resolved.body !== defaultTpl.getRawHtml()) {
      setValue("body", resolved.body);
    }
    if (resolved.subject && resolved.subject !== defaultTpl.defaultSubject) {
      setValue("subject", resolved.subject);
    }
    if (resolved.headerUrl) {
      setValue("headerUrl", resolved.headerUrl);
    }
    setTemplateBaseline({ subject: nextSubject, body: resolved.body });
  }, [initialTemplate, setValue, watch]);

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
      setTemplateBaseline({
        subject: initialTemplate.subject || watch("subject") || "",
        body: initialTemplate.body,
      });
    }
  }, [initialTemplate, setValue, watch]);

  const handleApplyTemplate = (tpl: EmailBlastTemplate) => {
    setActiveTemplate(tpl);
    setValue("body", tpl.body, { shouldValidate: true });
    if (tpl.subject) {
      setValue("subject", tpl.subject, { shouldValidate: true });
    }
    if (tpl.headerUrl) {
      setValue("headerUrl", tpl.headerUrl);
    }
    setTemplateBaseline({
      subject: tpl.subject || watch("subject") || "",
      body: tpl.body,
    });
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
      const nextSubj = `Important Update: ${event.title}`;
      setValue("subject", nextSubj, { shouldValidate: true });
      setTemplateBaseline((prev) => ({ ...prev, subject: nextSubj }));
    }
  };

  const handlePlaceholderChange = useCallback(
    (key: string, val: string) => {
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
    },
    [eventPlaceholders, setValue, propOnChangePlaceholders],
  );

  const handleResetPlaceholders = () => {
    if (propOnResetPlaceholders) {
      propOnResetPlaceholders();
    } else if (selectedEvent) {
      const resetVals = buildDefaultEventPlaceholders(selectedEvent);
      const customEntries: Record<string, string> = {};
      for (const [k, v] of Object.entries(eventPlaceholders)) {
        if (!STANDARD_EVENT_PLACEHOLDER_KEYS.includes(k)) {
          customEntries[k] = v;
        }
      }
      const merged = { ...resetVals, ...customEntries };
      setInternalPlaceholders(merged);
      setValue("headerUrl", merged.EventBannerUrl);
      toast.success("Placeholders Reset", {
        description: "Dynamic placeholders reset to Bevy event defaults.",
      });
    }
  };

  const handleAttendeePlaceholderChange = useCallback(
    (key: string, val: string) => {
      const updated = {
        ...attendeePlaceholders,
        [key]: val,
      };
      if (propOnChangeAttendeePlaceholders) {
        propOnChangeAttendeePlaceholders(updated);
      } else {
        setInternalAttendeePlaceholders(updated);
      }
    },
    [attendeePlaceholders, propOnChangeAttendeePlaceholders],
  );

  const handleResetAttendeePlaceholders = () => {
    if (propOnResetAttendeePlaceholders) {
      propOnResetAttendeePlaceholders();
    } else {
      const customEntries: Record<string, string> = {};
      for (const [k, v] of Object.entries(attendeePlaceholders)) {
        if (!STANDARD_ATTENDEE_PLACEHOLDER_KEYS.includes(k)) {
          customEntries[k] = v;
        }
      }
      setInternalAttendeePlaceholders({ ...defaultAttendeePlaceholders, ...customEntries });
      toast.success("Attendee Placeholders Reset", {
        description: "Restored sample attendee values to defaults.",
      });
    }
  };

  const handleOpenAddPlaceholder = useCallback((cat: "event" | "attendee") => {
    setAddPlaceholderCategory(cat);
    setIsAddPlaceholderOpen(true);
  }, []);

  const handleAddCustomPlaceholder = useCallback(
    (newPlaceholder: CustomPlaceholderDefinition) => {
      dismissedTokensRef.current.delete(newPlaceholder.key.toLowerCase());
      if (newPlaceholder.category === "event") {
        setCustomEventPlaceholders((prev) => {
          const next = [...prev.filter((p) => p.key !== newPlaceholder.key), newPlaceholder];
          saveStoredCustomEventPlaceholders(next);
          return next;
        });
        handlePlaceholderChange(newPlaceholder.key, newPlaceholder.sampleValue);
        setIsPlaceholdersOpen(true);
      } else {
        setCustomAttendeePlaceholders((prev) => {
          const next = [...prev.filter((p) => p.key !== newPlaceholder.key), newPlaceholder];
          saveStoredCustomAttendeePlaceholders(next);
          return next;
        });
        handleAttendeePlaceholderChange(newPlaceholder.key, newPlaceholder.sampleValue);
        setIsAttendeePlaceholdersOpen(true);
      }
    },
    [handlePlaceholderChange, handleAttendeePlaceholderChange],
  );

  const handleDeleteCustomPlaceholder = useCallback(
    (key: string, category: "event" | "attendee") => {
      dismissedTokensRef.current.add(key.toLowerCase());
      if (category === "event") {
        setCustomEventPlaceholders((prev) => {
          const next = prev.filter((p) => p.key !== key);
          saveStoredCustomEventPlaceholders(next);
          return next;
        });
        const updated = { ...eventPlaceholders };
        delete updated[key];
        if (propOnChangePlaceholders) {
          propOnChangePlaceholders(updated);
        } else {
          setInternalPlaceholders(updated);
        }
        toast.success(`Removed [[${key}]]`, {
          description: "Removed custom event placeholder.",
        });
      } else {
        setCustomAttendeePlaceholders((prev) => {
          const next = prev.filter((p) => p.key !== key);
          saveStoredCustomAttendeePlaceholders(next);
          return next;
        });
        const updated = { ...attendeePlaceholders };
        delete updated[key];
        if (propOnChangeAttendeePlaceholders) {
          propOnChangeAttendeePlaceholders(updated);
        } else {
          setInternalAttendeePlaceholders(updated);
        }
        toast.success(`Removed [[${key}]]`, {
          description: "Removed custom attendee placeholder.",
        });
      }
    },
    [eventPlaceholders, attendeePlaceholders, propOnChangePlaceholders, propOnChangeAttendeePlaceholders],
  );

  // Auto-detect new placeholders from HTML body content
  useEffect(() => {
    if (!bodyValue) return;

    const timer = setTimeout(() => {
      const detectedTokens = extractTokensFromHtml(bodyValue);
      if (detectedTokens.length === 0) return;

      const knownEventKeys = new Set([
        ...STANDARD_EVENT_PLACEHOLDER_KEYS.map((k) => k.toLowerCase()),
        ...customEventPlaceholders.map((p) => p.key.toLowerCase()),
      ]);

      const knownAttendeeKeys = new Set([
        ...STANDARD_ATTENDEE_PLACEHOLDER_KEYS.map((k) => k.toLowerCase()),
        ...customAttendeePlaceholders.map((p) => p.key.toLowerCase()),
      ]);

      const newlyDetected: CustomPlaceholderDefinition[] = [];

      for (const tokenKey of detectedTokens) {
        const lower = tokenKey.toLowerCase();
        if (knownEventKeys.has(lower) || knownAttendeeKeys.has(lower)) {
          continue;
        }
        if (dismissedTokensRef.current.has(lower)) {
          continue;
        }

        const label = formatTokenKeyToLabel(tokenKey);
        newlyDetected.push({
          key: tokenKey,
          label,
          sampleValue: `[${label}]`,
          category: "attendee",
          description: "Auto-detected from HTML template",
        });
      }

      if (newlyDetected.length === 0) return;

      setCustomAttendeePlaceholders((prev) => {
        const next = [...prev, ...newlyDetected];
        saveStoredCustomAttendeePlaceholders(next);
        return next;
      });

      const updatedValues: AttendeeDynamicPlaceholders = { ...attendeePlaceholders };
      for (const item of newlyDetected) {
        updatedValues[item.key] = item.sampleValue;
      }

      if (propOnChangeAttendeePlaceholders) {
        propOnChangeAttendeePlaceholders(updatedValues);
      } else {
        setInternalAttendeePlaceholders(updatedValues);
      }

      const tokenNames = newlyDetected.map((d) => `[[${d.key}]]`).join(", ");
      toast.info(`Detected New Placeholder${newlyDetected.length > 1 ? "s" : ""}`, {
        description: `Added ${tokenNames} to attendee placeholders.`,
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [
    bodyValue,
    customEventPlaceholders,
    customAttendeePlaceholders,
    attendeePlaceholders,
    propOnChangeAttendeePlaceholders,
  ]);

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

  const handleLoadDriveSpreadsheets = useCallback(async (searchQuery = "", promptIfMissing = false) => {
    let token = getCachedDriveAccessToken();
    if (!token && promptIfMissing) {
      try {
        token = await requestDriveAccessToken();
      } catch (err) {
        toast.error("Google Drive Authorization Failed", { description: extractApiMessage(err) });
        return;
      }
    }
    if (!token) return;

    setIsLoadingDriveSpreadsheets(true);
    try {
      const sheets = await listDriveSpreadsheets(token, searchQuery);
      setDriveSpreadsheets(sheets);
    } catch (err) {
      const msg = extractApiMessage(err);
      if (msg.includes("401") || msg.includes("403") || msg.toLowerCase().includes("expired")) {
        clearCachedDriveAccessToken();
        if (promptIfMissing) {
          try {
            const freshToken = await requestDriveAccessToken();
            const retrySheets = await listDriveSpreadsheets(freshToken, searchQuery);
            setDriveSpreadsheets(retrySheets);
            return;
          } catch (retryErr) {
            toast.error("Failed to load Google Spreadsheets", { description: extractApiMessage(retryErr) });
          }
        }
      } else if (promptIfMissing) {
        toast.error("Failed to load Google Spreadsheets", { description: msg });
      }
    } finally {
      setIsLoadingDriveSpreadsheets(false);
    }
  }, []);

  useEffect(() => {
    if (recipientSource === "spreadsheet" && getCachedDriveAccessToken() && driveSpreadsheets.length === 0) {
      void handleLoadDriveSpreadsheets("", false);
    }
  }, [recipientSource, driveSpreadsheets.length, handleLoadDriveSpreadsheets]);

  useEffect(() => {
    if (!isDrivePickerOpen || !getCachedDriveAccessToken()) return;
    const timer = setTimeout(() => {
      void handleLoadDriveSpreadsheets(driveSearchQuery, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [driveSearchQuery, isDrivePickerOpen, handleLoadDriveSpreadsheets]);

  const selectedDriveSpreadsheet = useMemo(() => {
    if (!spreadsheetUrl) return null;
    const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const id = match?.[1];
    return driveSpreadsheets.find((s) => s.id === id || s.webViewLink === spreadsheetUrl) ?? null;
  }, [spreadsheetUrl, driveSpreadsheets]);

  const handleLoadSheets = useCallback(async () => {
    if (!spreadsheetUrl) return;
    setIsLoadingSheets(true);
    setAvailableSheets([]);
    setSheetRowCount(0);
    setSheetSampleRow({});
    setValue("sheetName", "", { shouldValidate: true });
    lastFetchedUrl.current = spreadsheetUrl;

    try {
      const accessToken = getCachedDriveAccessToken() ?? undefined;
      const res = await fetchSheetsList(spreadsheetUrl, accessToken);
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
        const accessToken = getCachedDriveAccessToken() ?? undefined;
        const res = await fetchSheetHeaders(spreadsheetUrl, sheetName, rowNum, accessToken);
        if (res.success && res.headers) {
          setAvailableTags(res.headers);
          setSheetRowCount(res.rowCount ?? 0);
          if (res.sampleRow) {
            setSheetSampleRow(res.sampleRow);
          }
          if (res.headers.length > 0) {
            const countSuffix =
              typeof res.rowCount === "number" && res.rowCount > 0
                ? ` and ${res.rowCount.toLocaleString()} recipient rows`
                : "";
            toast.success("Sheet Headers Loaded", {
              description: `Loaded ${res.headers.length} column token${res.headers.length === 1 ? "" : "s"}${countSuffix} from row ${rowNum}.`,
            });
          } else {
            toast.info("No Column Titles Found", {
              description: `Row ${rowNum} contains no non-empty column titles.`,
            });
          }
        } else if (!res.success && res.error) {
          setAvailableTags([]);
          setSheetRowCount(0);
          setSheetSampleRow({});
          toast.error("Failed to load sheet headers", {
            description: res.error,
          });
        }
      } catch (err) {
        setAvailableTags([]);
        setSheetRowCount(0);
        setSheetSampleRow({});
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

  const handleSelectFeatureTemplate = (tpl: EmailFeatureTemplateItem) => {
    setCurrentFeatureTemplateId(tpl.id);
    setActiveTemplate(null);
    const resolved = resolveFeatureTemplateContent(tpl);
    setValue("body", resolved.body, { shouldValidate: true });
    if (resolved.subject) {
      setValue("subject", resolved.subject, { shouldValidate: true });
    }
    if (resolved.headerUrl) {
      setValue("headerUrl", resolved.headerUrl);
    }
    setTemplateBaseline({
      subject: resolved.subject || watch("subject") || "",
      body: resolved.body,
    });
    toast.success("Email Template Loaded", {
      description: `Loaded "${tpl.name}". Subject and HTML body have been updated.`,
    });
  };

  const handleSaveCurrentTemplate = () => {
    const currentSubj = watch("subject") || "Important Update: [[EventName]]";
    const currentBody = bodyValue || defaultHtmlTemplate;
    if (!currentBody.trim()) {
      toast.error("Email HTML content cannot be empty.");
      return;
    }

    if (activeTemplate?.isCustom) {
      const saved = saveEmailBlastAsTemplate({
        id: activeTemplate.id,
        name: activeTemplate.name,
        badge: activeTemplate.badge,
        description: activeTemplate.description,
        subject: currentSubj,
        headerUrl: headerUrlValue?.trim() || undefined,
        body: currentBody,
      });
      refreshTemplates();
      setActiveTemplate(saved);
      setTemplateBaseline({ subject: watch("subject") || "", body: currentBody });
      onTemplateChange?.(saved);
      toast.success("Template Updated", {
        description: `Saved changes to "${saved.name}".`,
      });
      return;
    }

    const foundFeature = EMAIL_FEATURE_TEMPLATES.find((t) => t.id === currentFeatureTemplateId);
    if (foundFeature) {
      saveFeatureTemplateOverride({
        id: foundFeature.id,
        subject: currentSubj,
        headerUrl: headerUrlValue?.trim() || undefined,
        body: currentBody,
      });
      setTemplateBaseline({ subject: watch("subject") || "", body: currentBody });
      toast.success("Template Updated", {
        description: `Saved changes to "${foundFeature.name}".`,
      });
      return;
    }

    setIsSaveTemplateOpen(true);
  };

  async function onSubmit(data: FormValues) {
    if (data.recipientSource === "audience" && recipientCount === 0) {
      toast.error("No Recipients Found", {
        description: "The selected audience segment has no recipients. Please select another segment.",
      });
      return;
    }
    if (data.recipientSource === "single" && !data.recipientEmail?.includes("@")) {
      toast.error("Invalid Recipient Email", {
        description: "Please enter a valid recipient email address.",
      });
      return;
    }
    if (data.recipientSource === "spreadsheet") {
      if (!data.spreadsheetUrl) {
        toast.error("Missing Spreadsheet URL", {
          description: "Please enter a valid Google Spreadsheet URL.",
        });
        return;
      }
      if (!data.sheetName) {
        toast.error("Missing Sheet Tab", {
          description: "Please select or fetch a Google Sheet tab.",
        });
        return;
      }
    }

    setPendingFormData(data);
    setConfirmDialogOpen(true);
  }

  async function handleExecuteConfirmedSend() {
    if (!pendingFormData) return;
    const data = pendingFormData;
    setIsSubmitting(true);

    try {
      const eventTitle = selectedEvent?.title;

      if (data.recipientSource === "single") {
        const customEventMap: Record<string, string> = {};
        if (eventPlaceholders) {
          for (const [k, v] of Object.entries(eventPlaceholders)) {
            if (v) {
              customEventMap[k] = v;
            }
          }
        }
        const customAttendeeMap: Record<string, string> = {};
        if (attendeePlaceholders) {
          for (const [k, v] of Object.entries(attendeePlaceholders)) {
            if (!STANDARD_ATTENDEE_PLACEHOLDER_KEYS.includes(k) && v) {
              customAttendeeMap[k] = v;
            }
          }
        }

        const result = await sendQuickEmail({
          eventId: data.eventId,
          eventTitle: eventPlaceholders?.EventName || eventTitle,
          recipientEmail: data.recipientEmail || "",
          recipientName: data.recipientName,
          subject: data.subject,
          headerUrl: data.headerUrl || eventPlaceholders?.EventBannerUrl,
          body: data.body,
          sessionTitle: eventPlaceholders?.SessionTitle,
          venueGuideUrl: eventPlaceholders?.EventVenueUrl,
          vehicleTicketUrl: eventPlaceholders?.VehicleTicketUrl,
          customEventPlaceholders: customEventMap,
          customAttendeePlaceholders: customAttendeeMap,
          eventDetails: {
            formattedDate: eventPlaceholders?.EventDate || selectedEvent?.formattedDate,
            formattedTime: eventPlaceholders?.EventTime || selectedEvent?.formattedTime,
            venueName: eventPlaceholders?.EventVenue || selectedEvent?.venueName,
            venueAddress: eventPlaceholders?.EventAddress || selectedEvent?.venueAddress,
            url: eventPlaceholders?.EventUrl || selectedEvent?.url,
            bannerUrl: data.headerUrl || eventPlaceholders?.EventBannerUrl || selectedEvent?.bannerUrl,
            descriptionShort: eventPlaceholders?.EventDescription || selectedEvent?.descriptionShort,
            isVirtual: selectedEvent?.isVirtual,
          },
        });

        if (!result.success) {
          throw new Error(result.error ?? "Failed to dispatch quick email.");
        }

        toast.success("Quick Email Sent", {
          description: result.message ?? `Email sent successfully to ${data.recipientEmail}.`,
        });

        setConfirmDialogOpen(false);
        setPendingFormData(null);
        reset();
        onSuccess?.();
        return;
      }

      // Bulk Email dispatch
      const isSheetSource = data.recipientSource === "spreadsheet";

      // Pre-interpolate all event-level placeholders into subject and body so n8n receives resolved event tokens
      let blastSubject = data.subject;
      let blastBody = data.body;
      if (eventPlaceholders) {
        for (const [k, v] of Object.entries(eventPlaceholders)) {
          if (v !== undefined && v !== null && v !== "") {
            const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            blastSubject = blastSubject.replace(new RegExp(`\\[\\[\\s*${escaped}\\s*\\]\\]`, "gi"), String(v));
            blastBody = blastBody.replace(new RegExp(`\\[\\[\\s*${escaped}\\s*\\]\\]`, "gi"), String(v));
          }
        }
        if (eventPlaceholders.EventVenueUrl) {
          blastSubject = blastSubject.replace(/\[\[\s*VenueGuideUrl\s*\]\]/gi, String(eventPlaceholders.EventVenueUrl));
          blastBody = blastBody.replace(/\[\[\s*VenueGuideUrl\s*\]\]/gi, String(eventPlaceholders.EventVenueUrl));
        }
      }
      if (data.headerUrl) {
        blastSubject = blastSubject.replace(/\[\[\s*EventBannerUrl\s*\]\]/gi, data.headerUrl);
        blastBody = blastBody.replace(/\[\[\s*EventBannerUrl\s*\]\]/gi, data.headerUrl);
      }

      const result = await sendEmailBlast({
        eventId: data.eventId,
        eventTitle,
        recipientSource: data.recipientSource,
        audienceType: isSheetSource ? undefined : data.audienceType,
        audienceLabel: isSheetSource ? undefined : data.audienceType,
        spreadsheetUrl: data.spreadsheetUrl,
        sheetName: data.sheetName,
        headerRow: data.headerRow ?? 1,
        sheetRowCount: isSheetSource ? sheetRowCount : undefined,
        subject: blastSubject,
        headerUrl: data.headerUrl,
        body: blastBody,
        recipients: data.recipientSource === "audience" ? resolvedRecipients : undefined,
      });

      if (!result.success) {
        throw new Error(result.error ?? "Failed to dispatch bulk email.");
      }

      let countMsg = `${recipientCount.toLocaleString()} recipients`;
      if (isSheetSource) {
        countMsg =
          sheetRowCount > 0
            ? `${sheetRowCount.toLocaleString()} recipients from sheet "${data.sheetName}"`
            : `recipients from sheet "${data.sheetName}"`;
      }

      toast.success("Bulk Email Blast Sent", {
        description: result.message ?? `Campaign successfully queued for ${countMsg}.`,
      });

      setConfirmDialogOpen(false);
      setPendingFormData(null);
      reset();
      onSuccess?.();
    } catch (error: unknown) {
      console.error(error);
      const msg = extractApiMessage(error, "Failed to dispatch email.");
      toast.error("Dispatch Failed", { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderFooterRecipientStatus() {
    if (recipientSource === "single") {
      if (recipientEmail) {
        return (
          <span>
            Ready to send quick email to <strong className="text-foreground">{recipientEmail}</strong>
          </span>
        );
      }
      return <span>Enter recipient email address above</span>;
    }

    if (recipientSource === "audience") {
      return (
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
      );
    }

    if (isLoadingTags || isLoadingSheets) {
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <Loader2 className="size-3 animate-spin text-primary" />
          <span>reading sheet data...</span>
        </span>
      );
    }

    if (sheetRowCount > 0) {
      return (
        <span>
          Ready to deliver to <strong className="text-foreground">{sheetRowCount.toLocaleString()} recipients</strong>{" "}
          from sheet tab <strong className="text-foreground">&quot;{sheetName}&quot;</strong>
        </span>
      );
    }

    if (sheetName) {
      return (
        <span>
          Targeting Google Sheet tab: <strong className="text-foreground">&quot;{sheetName}&quot;</strong> (
          {availableTags.length} columns)
        </span>
      );
    }

    return <span>Configure Google Sheet URL and tab name above</span>;
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
              <Badge variant="secondary" className="h-8 gap-1.5 px-2.5 text-xs font-normal">
                <span className="text-muted-foreground">Template:</span>
                <span className="max-w-[170px] truncate font-medium text-foreground">{currentTemplateName}</span>
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Bookmark className="size-3.5 text-primary" />
                    <span>Templates</span>
                    <ChevronDown className="size-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-[30rem] overflow-y-auto">
                  <DropdownMenuItem
                    onClick={() => setIsSaveTemplateOpen(true)}
                    className="flex cursor-pointer items-center gap-2 py-2 font-medium text-xs text-primary focus:text-primary"
                  >
                    <BookmarkPlus className="size-3.5" />
                    <span>Save Current as Template...</span>
                  </DropdownMenuItem>

                  {templatesData.customTemplates.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        My Saved Templates ({templatesData.customTemplates.length})
                      </DropdownMenuLabel>
                      {templatesData.customTemplates.map((tpl) => (
                        <DropdownMenuItem
                          key={tpl.id}
                          onClick={() => handleApplyTemplate(tpl)}
                          className="group flex cursor-pointer items-start justify-between gap-2 py-2"
                        >
                          <div className="flex flex-col items-start gap-1 overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              {activeTemplate?.id === tpl.id && <Check className="size-3.5 text-primary shrink-0" />}
                              <span className="font-medium text-xs text-foreground">{tpl.name}</span>
                              <Badge variant="secondary" className="text-[9px] py-0 px-1 font-normal">
                                {tpl.badge}
                              </Badge>
                            </div>
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

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Pre-built Templates
                  </DropdownMenuLabel>

                  {/* General */}
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    General &amp; Updates
                  </div>
                  {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "general").map((tpl) => (
                    <DropdownMenuItem
                      key={tpl.id}
                      onClick={() => handleSelectFeatureTemplate(tpl)}
                      className="flex cursor-pointer flex-col items-start gap-0.5 py-1.5"
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {currentFeatureTemplateId === tpl.id && !activeTemplate && (
                            <Check className="size-3.5 text-primary shrink-0" />
                          )}
                          <span className="font-medium text-xs text-foreground">{tpl.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal">
                          {tpl.badge}
                        </Badge>
                      </div>
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">{tpl.description}</span>
                    </DropdownMenuItem>
                  ))}

                  {/* RSVP & Tickets */}
                  <div className="mt-1 border-t px-2 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    RSVP &amp; Tickets
                  </div>
                  {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "rsvp").map((tpl) => (
                    <DropdownMenuItem
                      key={tpl.id}
                      onClick={() => handleSelectFeatureTemplate(tpl)}
                      className="flex cursor-pointer flex-col items-start gap-0.5 py-1.5"
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {currentFeatureTemplateId === tpl.id && !activeTemplate && (
                            <Check className="size-3.5 text-primary shrink-0" />
                          )}
                          <span className="font-medium text-xs text-foreground">{tpl.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal">
                          {tpl.badge}
                        </Badge>
                      </div>
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">{tpl.description}</span>
                    </DropdownMenuItem>
                  ))}

                  {/* Curation & Registration */}
                  <div className="mt-1 border-t px-2 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Curation &amp; Registration
                  </div>
                  {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "curation").map((tpl) => (
                    <DropdownMenuItem
                      key={tpl.id}
                      onClick={() => handleSelectFeatureTemplate(tpl)}
                      className="flex cursor-pointer flex-col items-start gap-0.5 py-1.5"
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {currentFeatureTemplateId === tpl.id && !activeTemplate && (
                            <Check className="size-3.5 text-primary shrink-0" />
                          )}
                          <span className="font-medium text-xs text-foreground">{tpl.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal">
                          {tpl.badge}
                        </Badge>
                      </div>
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">{tpl.description}</span>
                    </DropdownMenuItem>
                  ))}

                  {/* Waitlist Notifications */}
                  <div className="mt-1 border-t px-2 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Waitlist Notifications
                  </div>
                  {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "waitlist").map((tpl) => (
                    <DropdownMenuItem
                      key={tpl.id}
                      onClick={() => handleSelectFeatureTemplate(tpl)}
                      className="flex cursor-pointer flex-col items-start gap-0.5 py-1.5"
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {currentFeatureTemplateId === tpl.id && !activeTemplate && (
                            <Check className="size-3.5 text-primary shrink-0" />
                          )}
                          <span className="font-medium text-xs text-foreground">{tpl.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal">
                          {tpl.badge}
                        </Badge>
                      </div>
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">{tpl.description}</span>
                    </DropdownMenuItem>
                  ))}

                  {/* Cancellations */}
                  <div className="mt-1 border-t px-2 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Cancellations
                  </div>
                  {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "cancellation").map((tpl) => (
                    <DropdownMenuItem
                      key={tpl.id}
                      onClick={() => handleSelectFeatureTemplate(tpl)}
                      className="flex cursor-pointer flex-col items-start gap-0.5 py-1.5"
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {currentFeatureTemplateId === tpl.id && !activeTemplate && (
                            <Check className="size-3.5 text-primary shrink-0" />
                          )}
                          <span className="font-medium text-xs text-foreground">{tpl.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal">
                          {tpl.badge}
                        </Badge>
                      </div>
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">{tpl.description}</span>
                    </DropdownMenuItem>
                  ))}

                  {/* Outreach & Invitations */}
                  <div className="mt-1 border-t px-2 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Outreach &amp; Invitations
                  </div>
                  {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "invitation").map((tpl) => (
                    <DropdownMenuItem
                      key={tpl.id}
                      onClick={() => handleSelectFeatureTemplate(tpl)}
                      className="flex cursor-pointer flex-col items-start gap-0.5 py-1.5"
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {currentFeatureTemplateId === tpl.id && !activeTemplate && (
                            <Check className="size-3.5 text-primary shrink-0" />
                          )}
                          <span className="font-medium text-xs text-foreground">{tpl.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal">
                          {tpl.badge}
                        </Badge>
                      </div>
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">{tpl.description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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

          {/* 2. Recipient Selector: Bevy Audience vs Google Sheets vs Quick Send (1 User) */}
          <Field>
            <FieldLabel>Recipient Source</FieldLabel>
            <FieldContent>
              <Tabs
                value={recipientSource}
                onValueChange={(val) => setValue("recipientSource", val as "audience" | "spreadsheet" | "single")}
                className="w-full space-y-3"
              >
                <TabsList className="grid h-9 w-full grid-cols-3">
                  <TabsTrigger value="audience" className="gap-1.5 text-xs">
                    <Users className="size-3.5" />
                    Bevy Event Audience
                  </TabsTrigger>
                  <TabsTrigger value="spreadsheet" className="gap-1.5 text-xs">
                    <FileSpreadsheet className="size-3.5" />
                    Google Sheets Import
                  </TabsTrigger>
                  <TabsTrigger value="single" className="gap-1.5 text-xs">
                    <User className="size-3.5" />
                    Quick Send (1 User)
                  </TabsTrigger>
                </TabsList>

                {/* Single Recipient Option (Quick Send) */}
                <TabsContent value="single" className="space-y-4 pt-1">
                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <FieldLabel htmlFor="recipientEmail" className="text-xs font-semibold">
                          Recipient Email Address <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                          id="recipientEmail"
                          type="email"
                          placeholder="e.g. attendee@example.com"
                          {...register("recipientEmail")}
                          disabled={isSubmitting}
                          aria-invalid={!!errors.recipientEmail}
                          className="h-9"
                        />
                        {errors.recipientEmail && <FieldError>{errors.recipientEmail.message}</FieldError>}
                      </div>

                      <div className="space-y-1">
                        <FieldLabel htmlFor="recipientName" className="text-xs font-semibold">
                          Recipient Name (Optional)
                        </FieldLabel>
                        <Input
                          id="recipientName"
                          placeholder="e.g. Jane Doe"
                          {...register("recipientName")}
                          disabled={isSubmitting}
                          className="h-9"
                        />
                        <FieldDescription className="text-[11px]">
                          Used to personalize [[Name]], [[FirstName]], and [[LastName]].
                        </FieldDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-emerald-800 text-xs dark:text-emerald-300">
                      <Mail className="size-3.5 shrink-0" />
                      <span>
                        Dispatched individually via <strong>Send Email API (/webhook/api/send-email)</strong>. Dynamic
                        event and attendee tokens are personalized before sending.
                      </span>
                    </div>
                  </div>
                </TabsContent>

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

                {/* Google Sheets Option (Drive Picker + Manual URL) */}
                <TabsContent value="spreadsheet" className="space-y-4 pt-1">
                  <div className="space-y-3 rounded-lg border p-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <FieldLabel className="text-xs">Select from Google Drive (Recent &amp; Searchable)</FieldLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => void handleLoadDriveSpreadsheets(driveSearchQuery, true)}
                          disabled={isLoadingDriveSpreadsheets || isSubmitting}
                        >
                          {isLoadingDriveSpreadsheets ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <FolderOpen className="size-3 text-emerald-600 dark:text-emerald-400" />
                          )}
                          <span>{driveSpreadsheets.length > 0 ? "Refresh Drive List" : "Connect Google Drive"}</span>
                        </Button>
                      </div>

                      <Popover
                        open={isDrivePickerOpen}
                        onOpenChange={(open) => {
                          setIsDrivePickerOpen(open);
                          if (open && driveSpreadsheets.length === 0) {
                            void handleLoadDriveSpreadsheets(driveSearchQuery, true);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={isDrivePickerOpen}
                            disabled={isSubmitting}
                            className="h-9 w-full justify-between px-3 font-normal text-xs"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <FileSpreadsheet className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              {selectedDriveSpreadsheet ? (
                                <span className="truncate font-medium text-foreground">
                                  {selectedDriveSpreadsheet.name}
                                </span>
                              ) : (
                                <span className="truncate text-muted-foreground">
                                  Search or pick a recent spreadsheet from your Google Drive...
                                </span>
                              )}
                            </span>
                            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search your Google Spreadsheets by name..."
                              value={driveSearchQuery}
                              onValueChange={setDriveSearchQuery}
                              className="text-xs"
                            />
                            <CommandList>
                              {isLoadingDriveSpreadsheets ? (
                                <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-xs">
                                  <Loader2 className="size-3.5 animate-spin text-primary" />
                                  <span>Loading spreadsheets from Google Drive...</span>
                                </div>
                              ) : driveSpreadsheets.length === 0 ? (
                                <CommandEmpty className="py-4 text-center text-xs">
                                  <div className="space-y-2 px-3">
                                    <p className="text-muted-foreground">
                                      No spreadsheets loaded yet or no matching files found.
                                    </p>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      className="h-7 gap-1.5 text-xs"
                                      onClick={() => void handleLoadDriveSpreadsheets(driveSearchQuery, true)}
                                    >
                                      <FolderOpen className="size-3.5" />
                                      Authorize &amp; Load Recent Spreadsheets
                                    </Button>
                                  </div>
                                </CommandEmpty>
                              ) : (
                                <CommandGroup
                                  heading={driveSearchQuery.trim() ? "Matching Spreadsheets" : "Recent Spreadsheets"}
                                >
                                  {driveSpreadsheets.map((sheet) => {
                                    const isSelected = selectedDriveSpreadsheet?.id === sheet.id;
                                    const lastDate = sheet.viewedByMeTime || sheet.modifiedTime;
                                    return (
                                      <CommandItem
                                        key={sheet.id}
                                        value={sheet.id}
                                        onSelect={() => {
                                          setValue("spreadsheetUrl", sheet.webViewLink, { shouldValidate: true });
                                          setIsDrivePickerOpen(false);
                                        }}
                                        className="flex cursor-pointer items-center justify-between gap-2 py-2 text-xs"
                                      >
                                        <div className="flex min-w-0 items-center gap-2">
                                          <Check
                                            className={cn(
                                              "size-3.5 shrink-0 text-primary",
                                              isSelected ? "opacity-100" : "opacity-0",
                                            )}
                                          />
                                          <FileSpreadsheet className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                          <div className="flex min-w-0 flex-col">
                                            <span className="truncate font-medium">{sheet.name}</span>
                                            {sheet.ownerEmail && (
                                              <span className="truncate text-[10px] text-muted-foreground">
                                                Owner: {sheet.ownerEmail}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        {lastDate && (
                                          <span className="shrink-0 text-[10px] text-muted-foreground">
                                            {new Date(lastDate).toLocaleDateString()}
                                          </span>
                                        )}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-1">
                      <FieldLabel htmlFor="spreadsheetUrl" className="text-xs">
                        Or Paste Spreadsheet URL Directly
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
                          <strong>{availableTags.length}</strong> column{" "}
                          {availableTags.length === 1 ? "token" : "tokens"}
                          {sheetRowCount > 0 && (
                            <>
                              {" "}
                              and <strong>{sheetRowCount.toLocaleString()}</strong> recipient{" "}
                              {sheetRowCount === 1 ? "row" : "rows"}
                            </>
                          )}{" "}
                          loaded from row {headerRow || 1}. Drag and drop them in the editor below.
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
                    Custom values override default tokens like <code>[[EventName]]</code>, <code>[[SessionTitle]]</code>
                    ,<code>[[EventVenue]]</code>, etc.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => handleOpenAddPlaceholder("event")}
                  disabled={isSubmitting}
                >
                  <Plus className="size-3 text-sky-500" />
                  Add Event Token
                </Button>
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

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs">Session Title (Topic)</FieldLabel>
                    <code className="text-[10px] text-sky-600 dark:text-sky-400">[[SessionTitle]]</code>
                  </div>
                  {isLoadingEventDetail ? (
                    <Skeleton className="h-8 w-full animate-pulse rounded-md" />
                  ) : (
                    <Input
                      value={eventPlaceholders?.SessionTitle || ""}
                      onChange={(e) => handlePlaceholderChange("SessionTitle", e.target.value)}
                      disabled={isSubmitting}
                      placeholder="e.g. Keynote: Building Production AI Agents with Gemini"
                      className="h-8 text-xs"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs">Venue URL</FieldLabel>
                    <code className="text-[10px] text-sky-600 dark:text-sky-400">[[EventVenueUrl]]</code>
                  </div>
                  {isLoadingEventDetail ? (
                    <Skeleton className="h-8 w-full animate-pulse rounded-md" />
                  ) : (
                    <Input
                      value={eventPlaceholders?.EventVenueUrl || ""}
                      onChange={(e) => handlePlaceholderChange("EventVenueUrl", e.target.value)}
                      disabled={isSubmitting}
                      placeholder="https://maps.google.com/..."
                      className="h-8 text-xs"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs">Vehicle Ticket Link</FieldLabel>
                    <code className="text-[10px] text-sky-600 dark:text-sky-400">[[VehicleTicketUrl]]</code>
                  </div>
                  {isLoadingEventDetail ? (
                    <Skeleton className="h-8 w-full animate-pulse rounded-md" />
                  ) : (
                    <Input
                      value={eventPlaceholders?.VehicleTicketUrl || ""}
                      onChange={(e) => handlePlaceholderChange("VehicleTicketUrl", e.target.value)}
                      disabled={isSubmitting}
                      placeholder="https://drive.google.com/file/d/..."
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

                {customEventPlaceholders.map((custom) => (
                  <div
                    key={`custom_event_${custom.key}`}
                    className="space-y-1 rounded-md border border-sky-500/30 bg-sky-500/5 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FieldLabel className="text-xs font-medium text-foreground truncate">{custom.label}</FieldLabel>
                        <Badge
                          variant="outline"
                          className="h-4 px-1 font-normal text-[9px] border-sky-500/40 text-sky-600 dark:text-sky-400"
                        >
                          Custom
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <code className="text-[10px] text-sky-600 dark:text-sky-400">[[{custom.key}]]</code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteCustomPlaceholder(custom.key, "event")}
                          title={`Remove [[${custom.key}]]`}
                        >
                          <Trash2 className="size-3" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    </div>
                    <Input
                      value={eventPlaceholders?.[custom.key] ?? custom.sampleValue}
                      onChange={(e) => handlePlaceholderChange(custom.key, e.target.value)}
                      disabled={isSubmitting}
                      placeholder={custom.sampleValue || `Value for [[${custom.key}]]`}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                ))}
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
                  onClick={() => handleOpenAddPlaceholder("attendee")}
                  disabled={isSubmitting}
                >
                  <Plus className="size-3 text-emerald-500" />
                  Add Attendee Token
                </Button>
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

                {customAttendeePlaceholders.map((custom) => (
                  <div
                    key={`custom_attendee_${custom.key}`}
                    className="space-y-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FieldLabel className="text-xs font-medium text-foreground truncate">{custom.label}</FieldLabel>
                        <Badge
                          variant="outline"
                          className="h-4 px-1 font-normal text-[9px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        >
                          Custom
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <code className="text-[10px] text-emerald-600 dark:text-emerald-400">[[{custom.key}]]</code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteCustomPlaceholder(custom.key, "attendee")}
                          title={`Remove [[${custom.key}]]`}
                        >
                          <Trash2 className="size-3" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    </div>
                    <Input
                      value={attendeePlaceholders?.[custom.key] ?? custom.sampleValue}
                      onChange={(e) => handleAttendeePlaceholderChange(custom.key, e.target.value)}
                      disabled={isSubmitting}
                      placeholder={custom.sampleValue || `Sample for [[${custom.key}]]`}
                      className="h-8 text-xs bg-background"
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
                attendeePlaceholders={resolvedAttendeePlaceholders}
                headerUrl={headerUrlValue}
                availableTags={availableTags}
                isLoadingTags={isLoadingTags}
                sheetSampleData={sheetSampleRow}
                customEventTokens={customEventPlaceholders}
                customAttendeeTokens={customAttendeePlaceholders}
                onOpenAddPlaceholder={handleOpenAddPlaceholder}
              />
              {errors.body && <FieldError>{errors.body.message}</FieldError>}
            </FieldContent>
          </Field>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground text-xs">{renderFooterRecipientStatus()}</div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                (recipientSource === "single" && !recipientEmail?.includes("@")) ||
                (recipientSource === "audience" && (recipientCount === 0 || isResolvingRecipients)) ||
                (recipientSource === "spreadsheet" &&
                  (!spreadsheetUrl || !sheetName || isLoadingSheets || isLoadingTags))
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

      {/* Floating Action Button: Save as New Template or Save as Current Template */}
      {hasTemplateChanges && (
        <div className="fixed right-6 bottom-6 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-11 gap-2 rounded-full border-border/80 bg-background/95 px-5 text-xs font-medium shadow-lg backdrop-blur-md hover:bg-accent"
              >
                <BookmarkPlus className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Save as Template</span>
                <ChevronUp className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-64">
              <DropdownMenuItem
                onClick={handleSaveCurrentTemplate}
                className="flex cursor-pointer items-start gap-2.5 py-2.5 text-xs"
              >
                <BookmarkCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold text-foreground">Save as Current Template</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    Overwrite &ldquo;{currentTemplateName}&rdquo;
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsSaveTemplateOpen(true)}
                className="flex cursor-pointer items-start gap-2.5 py-2.5 text-xs"
              >
                <BookmarkPlus className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold text-foreground">Save as New Template</span>
                  <span className="text-[11px] text-muted-foreground">Create a new reusable custom template</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <SaveEmailTemplateDialog
        open={isSaveTemplateOpen}
        onOpenChange={setIsSaveTemplateOpen}
        currentSubject={watch("subject") || ""}
        currentHeaderUrl={headerUrlValue || ""}
        currentBody={bodyValue || defaultHtmlTemplate}
        onSaved={(newTpl) => {
          refreshTemplates();
          setActiveTemplate(newTpl);
          setTemplateBaseline({
            subject: watch("subject") || "",
            body: bodyValue || defaultHtmlTemplate,
          });
          if (onTemplateChange) {
            onTemplateChange(newTpl);
          }
        }}
      />

      <AddPlaceholderDialog
        open={isAddPlaceholderOpen}
        onOpenChange={setIsAddPlaceholderOpen}
        defaultCategory={addPlaceholderCategory}
        existingEventKeys={customEventPlaceholders.map((p) => p.key)}
        existingAttendeeKeys={customAttendeePlaceholders.map((p) => p.key)}
        onAdd={handleAddCustomPlaceholder}
      />

      <ConfirmEmailDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handleExecuteConfirmedSend}
        isSubmitting={isSubmitting}
        mode={recipientSource}
        eventTitle={selectedEvent?.title}
        subject={watch("subject") || ""}
        singleRecipient={
          recipientSource === "single"
            ? {
                email: recipientEmail || "",
                name: recipientName || undefined,
              }
            : undefined
        }
        audienceCount={recipientSource === "audience" ? recipientCount : undefined}
        audienceLabel={audienceType}
        sheetName={sheetName}
        sheetRowCount={recipientSource === "spreadsheet" ? sheetRowCount : undefined}
      />
    </form>
  );
}
