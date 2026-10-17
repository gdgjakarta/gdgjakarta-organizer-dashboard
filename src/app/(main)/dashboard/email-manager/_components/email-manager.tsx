"use client";

import { useState } from "react";

import {
  Activity,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  Layers,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBevyDashboardUrl } from "@/config/remote-config-utils";

import { EmailBlastForm } from "./email-blast-form";

const standardEventTags = [
  {
    tag: "[[EventName]]",
    description: "Auto-populated title of the selected target event",
    example: "Road to DevFest Jakarta 2026",
  },
  { tag: "[[EventDate]]", description: "Formatted event date in uppercase", example: "FRIDAY, OCT 23, 2026" },
  { tag: "[[EventTime]]", description: "Formatted event start time", example: "10:00 AM" },
  { tag: "[[EventVenue]]", description: "Event venue name and location city", example: "Jakarta Convention Center" },
  {
    tag: "[[EventAddress]]",
    description: "Full street address of the venue",
    example: "Jl. Jend. Gatot Subroto, Jakarta",
  },
  {
    tag: "[[EventUrl]]",
    description: "Public landing page link to the event details",
    example: "https://gdg.community.dev/events/...",
  },
  {
    tag: "[[EventBannerUrl]]",
    description: "Direct URL of the event hero image",
    example: "https://assets.gdgjakarta.org/...",
  },
  {
    tag: "[[EventDescription]]",
    description: "Short overview description of the event",
    example: "Join the annual flagship GDG Jakarta conference...",
  },
];

const standardAttendeeTags = [
  { tag: "[[Name]]", description: "Recipient's full name from Bevy or Google Sheets", example: "Budi Santoso" },
  { tag: "[[FirstName]]", description: "Recipient's first given name", example: "Budi" },
  { tag: "[[LastName]]", description: "Recipient's surname or family name", example: "Santoso" },
  { tag: "[[Email]]", description: "Recipient's verified email address", example: "budi.santoso@example.com" },
  { tag: "[[TicketType]]", description: "Registered ticket tier or category", example: "In-Person Pass (Free)" },
  { tag: "[[CheckinStatus]]", description: "Whether the attendee has checked in", example: "Checked In" },
];

export function EmailManager() {
  const [activeTab, setActiveTab] = useState("composer");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to Clipboard", {
      description: `${text} copied. You can drag or paste it directly into your HTML template.`,
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
          <EmailBlastForm />
        </TabsContent>

        {/* Tab 2: Dynamic Placeholders Guide */}
        <TabsContent value="placeholders" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Supported Dynamic Variables</CardTitle>
              <CardDescription>
                Drag and drop these placeholders or click Copy to use them in your HTML subject or body. They are
                automatically replaced with real event and recipient data when dispatched.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Event Placeholders */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-sky-500" />
                  <h3 className="font-semibold text-foreground text-sm">Event Data Placeholders</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {standardEventTags.map((item) => (
                    <div
                      key={item.tag}
                      className="flex flex-col justify-between rounded-lg border p-3.5 transition-colors hover:bg-muted/40"
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
                        <p className="mt-2 text-foreground text-sm">{item.description}</p>
                      </div>
                      <div className="mt-2.5 rounded-md bg-muted/60 px-2.5 py-1 text-muted-foreground text-xs">
                        <span className="font-semibold text-foreground/80">Example: </span>
                        {item.example}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendee Placeholders */}
              <div className="space-y-3 border-t pt-5">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-emerald-500" />
                  <h3 className="font-semibold text-foreground text-sm">Attendee Data Placeholders</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {standardAttendeeTags.map((item) => (
                    <div
                      key={item.tag}
                      className="flex flex-col justify-between rounded-lg border p-3.5 transition-colors hover:bg-muted/40"
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
                        <p className="mt-2 text-foreground text-sm">{item.description}</p>
                      </div>
                      <div className="mt-2.5 rounded-md bg-muted/60 px-2.5 py-1 text-muted-foreground text-xs">
                        <span className="font-semibold text-foreground/80">Example: </span>
                        {item.example}
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
