"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFirestoreEvents } from "@/lib/firestore/client";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { extractApiMessage } from "@/lib/utils";

import { fetchSheetHeaders } from "../_actions/fetch-sheet-headers";
import { fetchSheetsList } from "../_actions/fetch-sheets-list";
import { sendEmailBlast } from "../_actions/send-email-blast";
import { defaultHtmlTemplate } from "./default-html-template";
import { HtmlEditorPreview } from "./html-editor-preview";

const formSchema = z.object({
  eventId: z.string().min(1, { message: "Event is required." }),
  spreadsheetUrl: z.string().url({ message: "Please enter a valid URL." }),
  sheetName: z.string().min(1, { message: "Sheet Name is required." }),
  subject: z.string().min(1, { message: "Subject is required." }),
  headerUrl: z.string().optional(),
  body: z.string().min(1, { message: "Email body is required." }),
});

type FormValues = z.infer<typeof formSchema>;

export function EmailBlastForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [events, setEvents] = useState<FirestoreEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isPending, startTransition] = useTransition();

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
      spreadsheetUrl: "",
      sheetName: "",
      subject: "",
      headerUrl: "",
      body: defaultHtmlTemplate,
    },
  });

  const spreadsheetUrl = watch("spreadsheetUrl");
  const sheetName = watch("sheetName");
  const bodyValue = watch("body");
  const eventId = watch("eventId");

  const combinedTags = ["EventName", ...availableTags];

  const lastFetchedUrl = useRef("");
  const lastFetchedSheetName = useRef("");

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await getFirestoreEvents(100);
        setEvents(data);
      } catch (error) {
        console.error("Failed to load events:", error);
      } finally {
        setIsLoadingEvents(false);
      }
    }
    void loadEvents();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: auto-fetch on spreadsheetUrl change
  useEffect(() => {
    // Only auto-fetch if it looks like a valid spreadsheet url
    const match = spreadsheetUrl?.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return;

    if (spreadsheetUrl === lastFetchedUrl.current) return;

    const timer = setTimeout(() => {
      void handleLoadSheets();
    }, 1000);

    return () => clearTimeout(timer);
  }, [spreadsheetUrl]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: auto-fetch tags on sheetName/spreadsheetUrl change
  useEffect(() => {
    if (!sheetName || !spreadsheetUrl) return;

    // Only fetch if combination changes
    const currentCombination = `${spreadsheetUrl}|${sheetName}`;
    if (currentCombination === lastFetchedSheetName.current) return;

    lastFetchedSheetName.current = currentCombination;
    void handleLoadTags();
  }, [sheetName, spreadsheetUrl]);

  async function handleLoadSheets() {
    if (!spreadsheetUrl) {
      toast.error("Missing Information", {
        description: "Please enter a Spreadsheet URL first.",
      });
      return;
    }

    setIsLoadingSheets(true);
    setAvailableSheets([]);
    setValue("sheetName", "", { shouldValidate: true });
    lastFetchedUrl.current = spreadsheetUrl;

    try {
      const res = await fetchSheetsList(spreadsheetUrl);
      if (res.success && res.sheets) {
        setAvailableSheets(res.sheets);
        toast.success("Sheets Loaded", {
          description:
            res.message || `Successfully loaded ${res.sheets.length} sheet${res.sheets.length === 1 ? "" : "s"}.`,
        });
        if (res.sheets.length > 0) {
          setValue("sheetName", res.sheets[0], { shouldValidate: true });
        }
      } else {
        toast.error("Failed to Load Sheets", {
          description: extractApiMessage(res.error, "Could not fetch sheets from the provided URL."),
        });
      }
    } catch (error) {
      toast.error("Failed to Load Sheets", {
        description: extractApiMessage(error, "An unexpected error occurred."),
      });
    } finally {
      setIsLoadingSheets(false);
    }
  }

  async function handleLoadTags() {
    if (!spreadsheetUrl || !sheetName) {
      toast.error("Missing Information", {
        description: "Please enter Spreadsheet URL and Sheet Name first.",
      });
      return;
    }
    startTransition(async () => {
      const res = await fetchSheetHeaders(spreadsheetUrl, sheetName);
      if (res.success && res.headers) {
        setAvailableTags(res.headers);
        toast.success("Tags Loaded", {
          description: res.message || `Successfully loaded ${res.headers.length} tags from the sheet.`,
        });
      } else {
        toast.error("Failed to Load Tags", {
          description: extractApiMessage(res.error, "Could not fetch columns from spreadsheet."),
        });
      }
    });
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);

    try {
      const selectedEvent = events.find((e) => e.id === data.eventId);
      const eventTitle = selectedEvent?.title || "";

      const processedData = {
        ...data,
        body: data.body.replace(/\[\[EventName\]\]/g, eventTitle),
      };

      const result = await sendEmailBlast(processedData);

      if (!result.success) {
        throw new Error(result.error || "Failed to send email blast request.");
      }

      toast.success("Email Blast Sent", {
        description: result.message || "Your email blast request was sent successfully.",
      });
      reset();
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = extractApiMessage(error, "Failed to send email blast request.");
      toast.error("Failed to Send Email", {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>Compose Email</CardTitle>
          <CardDescription>
            Provide the spreadsheet containing the recipient details and compose your email subject and body.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field>
            <FieldLabel htmlFor="eventId">Event</FieldLabel>
            <FieldContent>
              <Select
                value={eventId || undefined}
                onValueChange={(val) => setValue("eventId", val, { shouldValidate: true })}
                disabled={isSubmitting || isLoadingEvents}
              >
                <SelectTrigger id="eventId" className="w-full" aria-invalid={!!errors.eventId}>
                  <SelectValue placeholder={isLoadingEvents ? "Loading events..." : "Select an event"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>Select the event this email is directing to.</FieldDescription>
              {errors.eventId && <FieldError>{errors.eventId.message}</FieldError>}
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="spreadsheetUrl">Spreadsheet URL</FieldLabel>
            <FieldContent>
              <div className="flex gap-2">
                <Input
                  id="spreadsheetUrl"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  {...register("spreadsheetUrl")}
                  disabled={isSubmitting || isLoadingSheets}
                  aria-invalid={!!errors.spreadsheetUrl}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleLoadSheets}
                  disabled={isSubmitting || isLoadingSheets || !spreadsheetUrl}
                >
                  {isLoadingSheets ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 size-4" />
                  )}
                  Fetch Sheets
                </Button>
              </div>
              <FieldDescription>Link to the Google Sheet containing recipients.</FieldDescription>
              {errors.spreadsheetUrl && <FieldError>{errors.spreadsheetUrl.message}</FieldError>}
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="sheetName">Sheet Name</FieldLabel>
            <FieldContent>
              <Select
                value={sheetName || undefined}
                onValueChange={(val) => setValue("sheetName", val, { shouldValidate: true })}
                disabled={isSubmitting || isLoadingSheets || availableSheets.length === 0}
              >
                <SelectTrigger id="sheetName" className="w-full" aria-invalid={!!errors.sheetName}>
                  <SelectValue placeholder={availableSheets.length > 0 ? "Select a sheet" : "Fetch sheets first"} />
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
              <FieldDescription>Exact name of the sheet tab in the document.</FieldDescription>
              {errors.sheetName && <FieldError>{errors.sheetName.message}</FieldError>}
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="subject">Subject</FieldLabel>
            <FieldContent>
              <Input
                id="subject"
                placeholder="Email Subject"
                {...register("subject")}
                disabled={isSubmitting}
                aria-invalid={!!errors.subject}
              />
              {errors.subject && <FieldError>{errors.subject.message}</FieldError>}
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="headerUrl">Header Image URL (Optional)</FieldLabel>
            <FieldContent>
              <Input
                id="headerUrl"
                placeholder="https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png"
                {...register("headerUrl")}
                disabled={isSubmitting}
                aria-invalid={!!errors.headerUrl}
              />
              <FieldDescription>If left blank, a default GDG Jakarta header image will be used.</FieldDescription>
              {errors.headerUrl && <FieldError>{errors.headerUrl.message}</FieldError>}
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="body">Email Body</FieldLabel>
            <FieldContent>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  Available tags: {availableTags.length > 0 ? availableTags.join(", ") : "None loaded"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadTags}
                  disabled={isPending || !spreadsheetUrl || !sheetName}
                >
                  {isPending && <RefreshCw className="mr-2 h-3 w-3 animate-spin" />}
                  Load Tags
                </Button>
              </div>
              <HtmlEditorPreview
                value={bodyValue}
                onChange={(val) => setValue("body", val, { shouldValidate: true })}
                availableTags={combinedTags}
              />
              <FieldDescription>
                The raw HTML of your email. Click the tags above to insert dynamic values.
              </FieldDescription>
              {errors.body && <FieldError>{errors.body.message}</FieldError>}
            </FieldContent>
          </Field>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Email Blast
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
