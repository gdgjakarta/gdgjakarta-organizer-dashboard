"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileSpreadsheet, Loader2, RefreshCw, Send, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractApiMessage } from "@/lib/utils";

import { fetchPublishedEventsAction, type PublishedEventOption } from "../_actions/fetch-published-events";
import { fetchSheetHeaders } from "../_actions/fetch-sheet-headers";
import { fetchSheetsList } from "../_actions/fetch-sheets-list";
import type { AudienceType, ResolvedRecipient } from "../_actions/resolve-audience-recipients";
import { sendEmailBlast } from "../_actions/send-email-blast";
import { AudienceSelector } from "./audience-selector";
import { defaultHtmlTemplate } from "./default-html-template";
import { HtmlEditorPreview } from "./html-editor-preview";
import { PublishedEventSelector } from "./published-event-selector";

const formSchema = z.object({
  eventId: z.string().min(1, { message: "Event is required." }),
  recipientSource: z.enum(["audience", "spreadsheet"]),
  audienceType: z.string().optional(),
  spreadsheetUrl: z.string().optional(),
  sheetName: z.string().optional(),
  subject: z.string().min(1, { message: "Subject is required." }),
  headerUrl: z.string().optional(),
  body: z.string().min(1, { message: "Email HTML body is required." }),
});

export type FormValues = z.infer<typeof formSchema>;

interface EmailBlastFormProps {
  onSuccess?: () => void;
  showHeader?: boolean;
}

export function EmailBlastForm({ onSuccess, showHeader = true }: EmailBlastFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishedEvents, setPublishedEvents] = useState<PublishedEventOption[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<PublishedEventOption | undefined>();

  // Audience resolution state
  const [resolvedRecipients, setResolvedRecipients] = useState<ResolvedRecipient[]>([]);
  const [recipientCount, setRecipientCount] = useState<number>(0);

  // Google Sheets state (legacy fallback)
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);

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
      eventId: "",
      recipientSource: "audience",
      audienceType: "ticket_all",
      spreadsheetUrl: "",
      sheetName: "",
      subject: "",
      headerUrl: "",
      body: defaultHtmlTemplate,
    },
  });

  const eventId = watch("eventId");
  const recipientSource = watch("recipientSource");
  const audienceType = watch("audienceType");
  const spreadsheetUrl = watch("spreadsheetUrl");
  const sheetName = watch("sheetName");
  const bodyValue = watch("body");

  const lastFetchedUrl = useRef("");
  const lastFetchedSheetName = useRef("");

  // Load published events on mount
  useEffect(() => {
    async function loadEvents() {
      setIsLoadingEvents(true);
      try {
        const res = await fetchPublishedEventsAction();
        if (res.success && res.events) {
          setPublishedEvents(res.events);
          if (res.events.length > 0 && !eventId) {
            const first = res.events[0];
            setSelectedEvent(first);
            setValue("eventId", first.id, { shouldValidate: true });
          }
        } else {
          toast.error("Could not load Bevy events", {
            description: res.error,
          });
        }
      } catch (err) {
        console.error("Failed to fetch Bevy events:", err);
      } finally {
        setIsLoadingEvents(false);
      }
    }
    void loadEvents();
  }, [setValue, eventId]);

  // Handle Event selection
  const handleSelectEvent = (event: PublishedEventOption) => {
    setSelectedEvent(event);
    setValue("eventId", event.id, { shouldValidate: true });

    // Pre-fill a helpful subject if empty
    const currentSubject = watch("subject");
    if (!currentSubject) {
      setValue("subject", `Important Update: ${event.title}`, { shouldValidate: true });
    }
  };

  // Handle Audience selection callback
  const handleSelectAudience = (audience: AudienceType, result: { count: number; recipients: ResolvedRecipient[] }) => {
    setValue("audienceType", audience, { shouldValidate: true });
    setResolvedRecipients(result.recipients);
    setRecipientCount(result.count);
  };

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
    startTransition(async () => {
      try {
        const res = await fetchSheetHeaders(spreadsheetUrl, sheetName);
        if (res.success && res.headers) {
          setAvailableTags(res.headers);
        } else if (!res.success && res.error) {
          toast.error("Failed to load sheet headers", {
            description: res.error,
          });
        }
      } catch (err) {
        toast.error("Failed to load sheet headers", {
          description: extractApiMessage(err),
        });
      }
    });
  }, [spreadsheetUrl, sheetName]);

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
    const combination = `${spreadsheetUrl}|${sheetName}`;
    if (combination === lastFetchedSheetName.current) return;

    lastFetchedSheetName.current = combination;
    void handleLoadTags();
  }, [sheetName, spreadsheetUrl, recipientSource, handleLoadTags]);

  async function onSubmit(data: FormValues) {
    if (data.recipientSource === "audience" && recipientCount === 0) {
      toast.error("No Recipients Found", {
        description: "The selected audience segment has no recipients. Please select another segment.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const eventTitle = selectedEvent?.title ?? "";

      const result = await sendEmailBlast({
        eventId: data.eventId,
        eventTitle,
        recipientSource: data.recipientSource,
        audienceType: data.audienceType,
        audienceLabel: data.audienceType,
        spreadsheetUrl: data.spreadsheetUrl,
        sheetName: data.sheetName,
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
          <CardHeader>
            <CardTitle>Bulk Email Campaign Composer</CardTitle>
            <CardDescription>
              Select your published event target, configure audience recipients, and design your responsive HTML email.
            </CardDescription>
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
                disabled={isSubmitting}
                error={!!errors.eventId}
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
                    disabled={isSubmitting || !eventId}
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
                              availableSheets.length > 0 ? "Select a sheet tab" : "Enter spreadsheet URL to load sheets"
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
            <FieldLabel htmlFor="headerUrl">Header Image URL (Optional)</FieldLabel>
            <FieldContent>
              <Input
                id="headerUrl"
                placeholder="https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png"
                {...register("headerUrl")}
                disabled={isSubmitting}
              />
              <FieldDescription>Defaults to the official GDG Jakarta blue banner if left empty.</FieldDescription>
            </FieldContent>
          </Field>

          {/* 5. Drag-and-Drop HTML Editor & Live Preview */}
          <Field>
            <FieldLabel htmlFor="body">Email HTML Content &amp; Live Preview</FieldLabel>
            <FieldContent>
              <HtmlEditorPreview
                value={bodyValue}
                onChange={(newVal) => setValue("body", newVal, { shouldValidate: true })}
                selectedEvent={selectedEvent}
                availableTags={availableTags}
              />
              {errors.body && <FieldError>{errors.body.message}</FieldError>}
            </FieldContent>
          </Field>
        </CardContent>

        <CardFooter className="flex justify-between border-t bg-muted/20 px-6 py-4">
          <div className="text-muted-foreground text-xs">
            {recipientSource === "audience" ? (
              <span>
                Ready to deliver to{" "}
                <strong className="text-foreground">
                  {recipientCount.toLocaleString()} {recipientCount === 1 ? "recipient" : "recipients"}
                </strong>
              </span>
            ) : (
              <span>Google Sheets automated column extraction active</span>
            )}
          </div>
          <Button
            type="submit"
            disabled={isSubmitting || (recipientSource === "audience" && recipientCount === 0)}
            size="lg"
            className="min-w-44 gap-2"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {isSubmitting
              ? "Dispatching..."
              : `Send Bulk Email ${recipientCount > 0 && recipientSource === "audience" ? `(${recipientCount})` : ""}`}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
