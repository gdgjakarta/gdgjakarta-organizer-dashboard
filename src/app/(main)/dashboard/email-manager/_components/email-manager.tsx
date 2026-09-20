"use client";

import { useState } from "react";

import {
  Activity,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Layers,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EmailBlastDialog } from "./email-blast-dialog";
import { EmailBlastForm } from "./email-blast-form";

const standardTags = [
  { tag: "[[Name]]", description: "Recipient's full name from Google Sheets", example: "Budi Santoso" },
  { tag: "[[Email]]", description: "Recipient's email address", example: "budi.santoso@example.com" },
  {
    tag: "[[EventName]]",
    description: "Auto-populated title of the selected target event",
    example: "Google I/O Extended Jakarta 2026",
  },
  {
    tag: "[[AnyColumnHeader]]",
    description: "Any column name present in your sheet tab",
    example: "[[TicketType]], [[SeatNumber]], [[Company]]",
  },
];

export function EmailManager() {
  const [activeTab, setActiveTab] = useState("blast");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to Clipboard", {
      description: `${text} copied. You can paste it directly into your HTML template.`,
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-3xl tracking-tight">Email Manager</h1>
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs font-semibold">
              <Sparkles className="size-3 text-amber-500" />
              Campaign Hub
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Manage email communications, subscriber campaigns, and dispatch personalized bulk email blasts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EmailBlastDialog
            trigger={
              <Button size="default" className="gap-2 shadow-xs">
                <Send className="size-4" />
                Email Blast
              </Button>
            }
          />
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 bg-linear-to-br from-card to-muted/20 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="font-medium text-sm text-muted-foreground">Blast Engine</CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Zap className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="font-bold text-2xl tracking-tight">n8n Workflow</span>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]"
              >
                <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ready
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground text-xs">Automated delivery pipeline</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-card to-muted/20 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="font-medium text-sm text-muted-foreground">Recipient Sync</CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl tracking-tight">Google Sheets</div>
            <p className="mt-1 text-muted-foreground text-xs">Dynamic column header ingestion</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-card to-muted/20 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="font-medium text-sm text-muted-foreground">Template Engine</CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Code2 className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl tracking-tight">Monaco HTML</div>
            <p className="mt-1 text-muted-foreground text-xs">Real-time desktop & mobile preview</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-card to-muted/20 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="font-medium text-sm text-muted-foreground">Security & Limits</CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl tracking-tight">Encrypted API</div>
            <p className="mt-1 text-muted-foreground text-xs">Server-side authenticated key storage</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <TabsList className="h-9">
            <TabsTrigger value="blast" className="gap-2 text-xs">
              <Send className="size-3.5" />
              Email Blast Composer
            </TabsTrigger>
            <TabsTrigger value="placeholders" className="gap-2 text-xs">
              <Layers className="size-3.5" />
              Dynamic Placeholders
            </TabsTrigger>
            <TabsTrigger value="documentation" className="gap-2 text-xs">
              <Info className="size-3.5" />
              Integration & Guide
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Email Blast Form */}
        <TabsContent value="blast" className="space-y-4 pt-2">
          <EmailBlastForm />
        </TabsContent>

        {/* Tab 2: Dynamic Placeholders Guide */}
        <TabsContent value="placeholders" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Supported Dynamic Variables</CardTitle>
              <CardDescription>
                Use these placeholders in your HTML subject or body. They will be automatically replaced with recipient
                details when dispatched.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {standardTags.map((item) => (
                  <div
                    key={item.tag}
                    className="flex flex-col justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="font-mono text-xs font-bold text-primary">
                          {item.tag}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(item.tag)}
                        >
                          <Copy className="size-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <p className="mt-2 text-sm text-foreground">{item.description}</p>
                    </div>
                    <div className="mt-3 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground/80">Example Output: </span>
                      {item.example}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-700 dark:text-blue-300">
                <div className="flex items-start gap-2.5">
                  <Info className="size-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold">Automatic Column Tag Detection</span>
                    <p className="text-xs text-blue-600/90 dark:text-blue-300/90">
                      When you enter a Google Spreadsheet URL in the Email Blast form and click{" "}
                      <strong>Fetch Sheets</strong>, all column headers in row 1 are parsed automatically. Click on any
                      badge above the code editor to insert the tag instantly at your cursor location.
                    </p>
                  </div>
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
                  <FileSpreadsheet className="size-5 text-emerald-500" />
                  <CardTitle className="text-lg">Google Sheets Setup</CardTitle>
                </div>
                <CardDescription>How to prepare your recipient spreadsheet for optimal delivery.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>1. Column Headers in Row 1</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-6">
                    Ensure the first row of your sheet contains clean column names such as <code>Email</code>,{" "}
                    <code>Name</code>, <code>TicketType</code>, etc.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>2. Share Permissions</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-6">
                    Set Google Sheet sharing permission to <strong>&quot;Anyone with the link can view&quot;</strong> or
                    ensure your configured Google API Service Account has Read access.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>3. Valid Email Formats</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-6">
                    Verify that email entries do not contain leading or trailing spaces to avoid bounced messages.
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
                    <span>1. Instant Webhook Ingestion</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-6">
                    When you submit an email blast, the dashboard forwards the request securely to{" "}
                    <code>https://n8n.gdgjakarta.com/webhook/api/send-bulk-email</code>.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Layers className="size-4 text-blue-500" />
                    <span>2. Batch Queuing & Throttling</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-6">
                    The n8n workflow reads rows from your sheet, renders template variables, and throttles delivery to
                    prevent spam classification.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="size-4 text-blue-500" />
                    <span>3. Authentication Secret</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-6">
                    Authentication headers are passed via the server environment variable{" "}
                    <code>N8N_WEBHOOK_API_KEY</code>.
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
