"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Activity,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  Layers,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getBevyDashboardUrl } from "@/config/remote-config-utils";

import { fetchBevyEventDetailAction, fetchPublishedEventsAction } from "../_actions/fetch-published-events";
import {
  type AttendeeDynamicPlaceholders,
  buildDefaultEventPlaceholders,
  defaultAttendeePlaceholders,
  type EventDynamicPlaceholders,
  type PublishedEventOption,
} from "../_types/placeholders";
import { EmailBlastForm } from "./email-blast-form";
import { PublishedEventSelector } from "./published-event-selector";

interface EventTagItem {
  key: keyof EventDynamicPlaceholders;
  tag: string;
  description: string;
  isTextarea?: boolean;
}

interface AttendeeTagItem {
  key: keyof AttendeeDynamicPlaceholders;
  tag: string;
  description: string;
  example: string;
}

const standardEventTags: EventTagItem[] = [
  {
    key: "EventName",
    tag: "[[EventName]]",
    description: "Auto-populated title of the selected target event",
  },
  {
    key: "EventDate",
    tag: "[[EventDate]]",
    description: "Formatted event date (e.g. Friday, Oct 23, 2026)",
  },
  {
    key: "EventTime",
    tag: "[[EventTime]]",
    description: "Formatted event start & end time (e.g. 10:00 AM - 05:00 PM)",
  },
  {
    key: "EventVenue",
    tag: "[[EventVenue]]",
    description: "Event venue name and location city",
  },
  {
    key: "EventAddress",
    tag: "[[EventAddress]]",
    description: "Full street address of the venue",
  },
  {
    key: "EventUrl",
    tag: "[[EventUrl]]",
    description: "Public landing page link to the event details",
  },
  {
    key: "EventBannerUrl",
    tag: "[[EventBannerUrl]]",
    description: "Direct URL of the event hero banner image (recommended: 1850 × 560 px)",
  },
  {
    key: "EventDescription",
    tag: "[[EventDescription]]",
    description: "Short overview description of the event",
    isTextarea: true,
  },
];

const standardAttendeeTags: AttendeeTagItem[] = [
  {
    key: "Name",
    tag: "[[Name]]",
    description: "Recipient's full name from Bevy or Google Sheets",
    example: "Budi Santoso",
  },
  {
    key: "FirstName",
    tag: "[[FirstName]]",
    description: "Recipient's first given name",
    example: "Budi",
  },
  {
    key: "LastName",
    tag: "[[LastName]]",
    description: "Recipient's surname or family name",
    example: "Santoso",
  },
  {
    key: "Email",
    tag: "[[Email]]",
    description: "Recipient's verified email address",
    example: "budi.santoso@example.com",
  },
  {
    key: "TicketType",
    tag: "[[TicketType]]",
    description: "Registered ticket tier or category",
    example: "In-Person Pass (Free)",
  },
  {
    key: "CheckinStatus",
    tag: "[[CheckinStatus]]",
    description: "Whether the attendee has checked in",
    example: "Checked In",
  },
];

export function EmailManager() {
  const [activeTab, setActiveTab] = useState("composer");

  // Shared event & dynamic placeholder state between Composer & Placeholders tabs
  const [publishedEvents, setPublishedEvents] = useState<PublishedEventOption[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<PublishedEventOption | undefined>();
  const [eventPlaceholders, setEventPlaceholders] = useState<EventDynamicPlaceholders>(() =>
    buildDefaultEventPlaceholders(),
  );
  const [attendeePlaceholders, setAttendeePlaceholders] = useState<AttendeeDynamicPlaceholders>(
    () => defaultAttendeePlaceholders,
  );
  const [isLoadingEventDetail, setIsLoadingEventDetail] = useState(false);

  // Function to load detail event and autofill dynamic placeholders + header banner
  const handleSelectEvent = useCallback(async (ev: PublishedEventOption) => {
    setSelectedEvent(ev);
    const initialDefaults = buildDefaultEventPlaceholders(ev);
    setEventPlaceholders(initialDefaults);

    setIsLoadingEventDetail(true);
    try {
      const res = await fetchBevyEventDetailAction(ev.id);
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

  // Initial load of published events
  useEffect(() => {
    async function loadEvents() {
      setIsLoadingEvents(true);
      try {
        const res = await fetchPublishedEventsAction();
        if (res.success && res.events) {
          setPublishedEvents(res.events);
          if (res.events.length > 0 && !selectedEvent) {
            const first = res.events[0];
            void handleSelectEvent(first);
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
  }, [handleSelectEvent, selectedEvent]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to Clipboard", {
      description: `${text} copied. You can drag or paste it directly into your HTML template.`,
    });
  };

  const handlePlaceholderChange = (key: keyof EventDynamicPlaceholders, val: string) => {
    setEventPlaceholders((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleResetPlaceholders = () => {
    if (selectedEvent) {
      const resetVals = buildDefaultEventPlaceholders(selectedEvent);
      setEventPlaceholders(resetVals);
      toast.success("Placeholders Reset", {
        description: `Reset to Bevy defaults for "${selectedEvent.title}".`,
      });
    }
  };

  const handleAttendeePlaceholderChange = (key: keyof AttendeeDynamicPlaceholders, val: string) => {
    setAttendeePlaceholders((prev) => ({
      ...prev,
      [key]: val,
    }));
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
            Select published events, filter Bevy attendee audiences, and compose drag-and-drop bulk HTML emails.
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
              Bulk Email Composer
            </TabsTrigger>
            <TabsTrigger value="placeholders" className="gap-2 text-xs">
              <Layers className="size-3.5" />
              Dynamic Placeholders
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
          />
        </TabsContent>

        {/* Tab 2: Dynamic Placeholders with Live Autofill & Organizer Editing */}
        <TabsContent value="placeholders" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Supported Dynamic Variables</CardTitle>
                  <CardDescription className="mt-1">
                    Event data placeholders below are <strong>autofilled from the selected Bevy event</strong> and can
                    be directly modified by organizers. Modified values apply to live preview and outgoing emails.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetPlaceholders}
                  disabled={isLoadingEventDetail || !selectedEvent}
                  className="shrink-0 gap-1.5 text-xs shadow-xs"
                >
                  <RotateCcw className="size-3.5" />
                  Reset to Bevy Defaults
                </Button>
              </div>

              {/* Event Selector in Placeholders Tab for quick switching */}
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-sky-500" />
                  <span className="font-medium text-foreground text-xs">Target Event for Autofill:</span>
                </div>
                <div className="w-full sm:w-80">
                  <PublishedEventSelector
                    events={publishedEvents}
                    selectedEventId={selectedEvent?.id}
                    onSelectEvent={handleSelectEvent}
                    isLoading={isLoadingEvents}
                    disabled={isLoadingEventDetail}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Event Placeholders */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-sky-500" />
                    <h3 className="font-semibold text-foreground text-sm">Event Data Placeholders</h3>
                  </div>
                  {isLoadingEventDetail && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Loader2 className="size-3 animate-spin text-primary" />
                      <span>Syncing event details from Bevy...</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                  {standardEventTags.map((item) => (
                    <div
                      key={item.tag}
                      className="flex flex-col justify-between rounded-lg border p-3.5 transition-colors hover:bg-muted/20"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className="font-bold font-mono text-sky-600 text-xs dark:text-sky-400"
                          >
                            {item.tag}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
                            onClick={() => copyToClipboard(item.tag)}
                          >
                            <Copy className="mr-1 size-3" />
                            Copy
                          </Button>
                        </div>
                        <p className="mt-1.5 text-muted-foreground text-xs">{item.description}</p>
                      </div>

                      {/* Image Preview for EventBannerUrl */}
                      {item.key === "EventBannerUrl" && eventPlaceholders.EventBannerUrl && (
                        <div className="mt-3 overflow-hidden rounded-md border bg-muted/40">
                          <div className="relative aspect-[1850/560] w-full overflow-hidden bg-muted">
                            {/* biome-ignore lint/performance/noImgElement: dynamic external banner preview */}
                            <img
                              src={eventPlaceholders.EventBannerUrl}
                              alt="Event Banner Preview"
                              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[11px] text-foreground/80">
                            Default / Autofilled Value:
                          </span>
                          <span className="text-[10px] text-muted-foreground">(Editable)</span>
                        </div>
                        {item.isTextarea ? (
                          <Textarea
                            rows={2}
                            value={eventPlaceholders[item.key] || ""}
                            onChange={(e) => handlePlaceholderChange(item.key, e.target.value)}
                            placeholder={`Autofilled from Bevy ${item.tag}...`}
                            className="resize-none text-xs"
                          />
                        ) : (
                          <Input
                            value={eventPlaceholders[item.key] || ""}
                            onChange={(e) => handlePlaceholderChange(item.key, e.target.value)}
                            placeholder={`Autofilled from Bevy ${item.tag}...`}
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendee Placeholders */}
              <div className="space-y-3 border-t pt-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-emerald-500" />
                      <h3 className="font-semibold text-foreground text-sm">Attendee Data Placeholders</h3>
                    </div>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      Attendee tokens are dynamically resolved and replaced for each individual recipient during bulk
                      delivery.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetAttendeePlaceholders}
                    className="h-7 w-fit gap-1 px-2.5 text-xs shadow-xs"
                  >
                    <RotateCcw className="size-3" />
                    Reset to Defaults
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {standardAttendeeTags.map((item) => (
                    <div
                      key={item.tag}
                      className="flex flex-col justify-between rounded-lg border bg-card p-3.5 shadow-xs transition-colors hover:bg-muted/30"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className="font-bold font-mono text-emerald-600 text-xs dark:text-emerald-400"
                          >
                            {item.tag}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
                            onClick={() => copyToClipboard(item.tag)}
                          >
                            <Copy className="mr-1 size-3" />
                            Copy
                          </Button>
                        </div>
                        <p className="mt-1.5 text-muted-foreground text-xs">{item.description}</p>
                      </div>

                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[11px] text-foreground/80">
                            Default / Autofilled Value:
                          </span>
                          <span className="text-[10px] text-muted-foreground">(Editable)</span>
                        </div>
                        <Input
                          value={attendeePlaceholders[item.key] || ""}
                          onChange={(e) => handleAttendeePlaceholderChange(item.key, e.target.value)}
                          placeholder={`Preview value for ${item.tag}...`}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Documentation & Integration Guide */}
        <TabsContent value="documentation" className="space-y-4 pt-2">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="size-5 text-emerald-500" />
                  <CardTitle className="text-lg">Bevy Audience Segments</CardTitle>
                </div>
                <CardDescription>How attendee data is resolved from Bevy for bulk campaigns.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>1. Real-Time Attendee Roster</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    When you select a published event and choose an audience segment (such as confirmed ticket holders,
                    checked-in guests, or waitlisted users), the dashboard queries Bevy directly and resolves
                    deduplicated verified recipient records.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>2. Drag &amp; Drop Tokens</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    In the HTML editor, drag any variable badge (e.g. <code>[[EventName]]</code>,{" "}
                    <code>[[EventDate]]</code>, <code>[[Name]]</code>) or pre-built HTML component card directly onto
                    the code editor.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>3. Sample Data Live Preview</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    Use the Live Preview panel on desktop or mobile view with Sample Data toggled to inspect exactly how
                    the rendered email will appear in recipient inboxes.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="size-5 text-blue-500" />
                  <CardTitle className="text-lg">n8n Automation Pipeline</CardTitle>
                </div>
                <CardDescription>Overview of how the background email queue process works.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Activity className="size-4 text-blue-500" />
                    <span>1. Webhook Ingestion</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    Submitting the email blast dispatches the payload to{" "}
                    <code>https://n8n.gdgjakarta.com/webhook/api/send-bulk-email</code> with the full verified recipient
                    array.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Layers className="size-4 text-blue-500" />
                    <span>2. Batch Queuing &amp; Throttling</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    The n8n workflow processes the recipients list, replaces all template placeholders per individual,
                    and throttles delivery to maintain high deliverability and avoid spam triggers.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="size-4 text-blue-500" />
                    <span>3. Secure Server Authorization</span>
                  </div>
                  <p className="pl-6 text-muted-foreground text-xs">
                    Authorization headers are attached securely on the server via <code>N8N_WEBHOOK_API_KEY</code>.
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
