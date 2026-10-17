"use client";

import { useCallback, useEffect, useState } from "react";

import { CheckCircle2, ExternalLink, FileSpreadsheet, Info, Mail, Send, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBevyDashboardUrl } from "@/config/remote-config-utils";
import { extractApiMessage } from "@/lib/utils";

import { fetchBevyEventDetailAction, fetchPublishedEventsAction } from "../_actions/fetch-published-events";
import {
  type AttendeeDynamicPlaceholders,
  buildDefaultEventPlaceholders,
  defaultAttendeePlaceholders,
  type EventDynamicPlaceholders,
  type PublishedEventOption,
} from "../_types/placeholders";
import { EmailBlastForm } from "./email-blast-form";

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

export function EmailManager() {
  const [activeTab, setActiveTab] = useState("composer");

  // Shared event & dynamic placeholder state between Composer & Placeholders tabs
  const [publishedEvents, setPublishedEvents] = useState<PublishedEventOption[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isRefreshingEvents, setIsRefreshingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PublishedEventOption | undefined>();
  const [eventPlaceholders, setEventPlaceholders] = useState<EventDynamicPlaceholders>(() =>
    buildDefaultEventPlaceholders(),
  );
  const [attendeePlaceholders, setAttendeePlaceholders] = useState<AttendeeDynamicPlaceholders>(
    () => defaultAttendeePlaceholders,
  );
  const [isLoadingEventDetail, setIsLoadingEventDetail] = useState(false);

  // Function to load detail event and autofill dynamic placeholders + header banner
  const handleSelectEvent = useCallback(async (ev: PublishedEventOption, forceRefresh?: boolean) => {
    setSelectedEvent(ev);
    const initialDefaults = buildDefaultEventPlaceholders(ev);
    setEventPlaceholders(initialDefaults);

    setIsLoadingEventDetail(true);
    try {
      const res = await fetchBevyEventDetailAction(ev.id, { forceRefresh });
      if (res.success && res.event && res.placeholders) {
        setSelectedEvent(res.event);
        setEventPlaceholders(res.placeholders);
      }
    } catch (err) {
      console.error("Failed to load Bevy event detail:", err);
    } finally {
      setIsLoadingEventDetail(false);
    }
  }, []);

  // Force refresh handler triggered by organizer
  const handleRefreshEvents = useCallback(async () => {
    setIsRefreshingEvents(true);
    try {
      const res = await fetchPublishedEventsAction({ forceRefresh: true });
      if (res.success && res.events) {
        setPublishedEvents(res.events);
        writeClientEventsCache(res.events);
        toast.success("Bevy Events Refreshed", {
          description: `Loaded ${res.events.length} chapter event${res.events.length === 1 ? "" : "s"} from Bevy.`,
        });

        if (selectedEvent) {
          const matched = res.events.find((e) => e.id === selectedEvent.id);
          if (matched) {
            void handleSelectEvent(matched, true);
          } else if (res.events.length > 0) {
            void handleSelectEvent(res.events[0], true);
          }
        }
      } else {
        toast.error("Failed to refresh Bevy events", {
          description: res.error ?? "Could not retrieve fresh events from Bevy.",
        });
      }
    } catch (err) {
      console.error("Failed to refresh Bevy events:", err);
      toast.error("Failed to refresh Bevy events", {
        description: extractApiMessage(err),
      });
    } finally {
      setIsRefreshingEvents(false);
    }
  }, [handleSelectEvent, selectedEvent]);

  // Initial load of published events: read client cache first, then fetch if needed
  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      // 1. Try reading client cache
      const cached = readClientEventsCache();
      if (cached && cached.length > 0) {
        if (isMounted) {
          setPublishedEvents(cached);
          setIsLoadingEvents(false);
          void handleSelectEvent(cached[0]);
        }
        return;
      }

      // 2. Fetch from server action
      setIsLoadingEvents(true);
      try {
        const res = await fetchPublishedEventsAction();
        if (!isMounted) return;
        if (res.success && res.events) {
          setPublishedEvents(res.events);
          writeClientEventsCache(res.events);
          if (res.events.length > 0) {
            void handleSelectEvent(res.events[0]);
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
          setIsLoadingEvents(false);
        }
      }
    }

    void loadEvents();

    return () => {
      isMounted = false;
    };
  }, [handleSelectEvent]);

  const handleResetPlaceholders = () => {
    if (selectedEvent) {
      const resetVals = buildDefaultEventPlaceholders(selectedEvent);
      setEventPlaceholders(resetVals);
      toast.success("Placeholders Reset", {
        description: `Reset to Bevy defaults for "${selectedEvent.title}".`,
      });
    }
  };

  const handleResetAttendeePlaceholders = () => {
    setAttendeePlaceholders(defaultAttendeePlaceholders);
    toast.success("Attendee Placeholders Reset", {
      description: "Restored sample attendee values to defaults.",
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-3xl tracking-tight">Emails</h1>
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 font-semibold text-xs">
              <Sparkles className="size-3 text-amber-500" />
              Campaign Hub
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Select published events, choose from official GDG email templates, and dispatch quick single emails or
            audience-wide bulk campaigns with interactive confirmation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="default" variant="outline" asChild className="gap-1.5 shadow-xs">
            <a href={getBevyDashboardUrl("emails")} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              Open in Bevy
            </a>
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <TabsList className="h-9">
            <TabsTrigger value="composer" className="gap-2 text-xs">
              <Send className="size-3.5" />
              Email Composer (Single &amp; Bulk)
            </TabsTrigger>
            <TabsTrigger value="documentation" className="gap-2 text-xs">
              <Info className="size-3.5" />
              Integration &amp; Guide
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Full-Screen Bulk Email Composer */}
        <TabsContent value="composer" className="space-y-4 pt-2">
          <EmailBlastForm
            publishedEvents={publishedEvents}
            selectedEvent={selectedEvent}
            eventPlaceholders={eventPlaceholders}
            attendeePlaceholders={attendeePlaceholders}
            isLoadingEvents={isLoadingEvents}
            isLoadingEventDetail={isLoadingEventDetail}
            onSelectEvent={handleSelectEvent}
            onChangePlaceholders={setEventPlaceholders}
            onResetPlaceholders={handleResetPlaceholders}
            onChangeAttendeePlaceholders={setAttendeePlaceholders}
            onResetAttendeePlaceholders={handleResetAttendeePlaceholders}
            onRefreshEvents={handleRefreshEvents}
            isRefreshingEvents={isRefreshingEvents}
          />
        </TabsContent>

        {/* Tab 2: Documentation & Integration Guide */}
        <TabsContent value="documentation" className="space-y-4 pt-2">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Guide 1: Sending via Event Attendees Data */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="size-5 text-emerald-500" />
                  <CardTitle className="text-lg">Sending with Event Attendees</CardTitle>
                </div>
                <CardDescription>
                  How to dispatch personalized bulk emails using live attendee data from Bevy events.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>1. Select Target Event &amp; Audience</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    Choose a published Bevy chapter event and select an audience segment (such as confirmed ticket
                    holders, checked-in guests, or waitlisted members). The platform resolves verified, deduplicated
                    recipient records in real time.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>2. Review Event &amp; Attendee Placeholders</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    Event variables (<code>[[EventName]]</code>, <code>[[EventDate]]</code>, <code>[[EventVenue]]</code>
                    , <code>[[SessionTitle]]</code>, etc.) are autofilled from Bevy. Expand the collapsible placeholder
                    panels to review or edit sample values and attendee tokens (like <code>[[Name]]</code> and{" "}
                    <code>[[TicketType]]</code>).
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>3. Drag &amp; Drop Tokens in HTML Editor</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    Drag variable badges or pre-built HTML component blocks directly onto the code editor. Toggle the
                    Live Preview between desktop and mobile to verify layout styling.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>4. Send Blast with Dynamic Replacement</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    Click <strong>Send Email Blast</strong>. Each recipient receives a customized email with their
                    individual attendee data and event tokens replaced automatically.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Guide 2: Sending via Google Spreadsheets */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="size-5 text-teal-500" />
                  <CardTitle className="text-lg">Sending with Google Spreadsheets</CardTitle>
                </div>
                <CardDescription>
                  How to send bulk campaigns using custom recipient lists and columns from Google Sheets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-teal-500" />
                    <span>1. Connect Google Sheet URL</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    Under Recipient Source, switch to <strong>Google Spreadsheet</strong>. Paste your public or shared
                    Google Sheet URL and click <strong>Fetch Sheets</strong> to load available tabs.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-teal-500" />
                    <span>2. Select Worksheet Tab &amp; Header Row</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    Select your sheet tab from the dropdown. Specify the header row number (defaults to row 1)
                    containing your column titles, then click <strong>Fetch Headers</strong>.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-teal-500" />
                    <span>3. Use Extracted Column Tokens</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    All non-empty column names become draggable placeholder badges (e.g. <code>[[Email]]</code>,{" "}
                    <code>[[Full Name]]</code>, <code>[[Custom Note]]</code>). Ensure an <code>Email</code> column
                    exists to identify recipients.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-teal-500" />
                    <span>4. Preview &amp; Dispatch Campaign</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    Preview your email in desktop or mobile mode. When ready, click <strong>Send Email Blast</strong> to
                    deliver emails to all valid recipient rows extracted from your spreadsheet.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Guide 3: Quick Send to Single Recipient */}
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="size-5 text-emerald-500" />
                  <CardTitle className="text-lg">Quick Send (Single User) via Send Email API</CardTitle>
                </div>
                <CardDescription>
                  How to send individualized transactional or update emails directly to one recipient without queuing in
                  bulk.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>1. Input Recipient Email</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Switch Recipient Source to <strong>Quick Send (1 User)</strong> and enter the target
                    recipient&apos;s verified email address and optional recipient name.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>2. Select Official Template</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Choose from GDG official passes, waitlist notifications, registration receipts, or regret emails.
                    All tokens (<code>[[Name]]</code>, <code>[[EventName]]</code>, etc.) are personalized before
                    sending.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>3. Send Email API Dispatch</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Review and confirm in the dispatch dialog. The email is delivered via{" "}
                    <code>https://n8n.gdgjakarta.com/webhook/api/send-email</code> directly to the user.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
