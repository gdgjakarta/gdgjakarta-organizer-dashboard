"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import Editor, { type OnMount } from "@monaco-editor/react";
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Eye,
  Info,
  Laptop,
  Mail,
  RotateCcw,
  Send,
  Smartphone,
  Sparkles,
  Terminal,
  Wand2,
  Workflow,
  XCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMAIL_TEMPLATES_CONFIG,
  type EmailTemplateKey,
  type EmailTemplateMeta,
  getDefaultTemplateByKey,
  interpolateTemplatePreview,
} from "@/lib/events/email-templates";
import { updateEventEmailTemplatesAction } from "@/lib/firestore/actions";
import type { EventEmailTemplates, FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

type EditorInstance = Parameters<OnMount>[0];

interface EmailTemplatesTabProps {
  event: FirestoreEvent;
}

export function EmailTemplatesTab({ event }: EmailTemplatesTabProps) {
  const { theme } = useTheme();
  const editorRef = useRef<EditorInstance | null>(null);

  // Dynamic curated status from Firestore
  const [isCurated, setIsCurated] = useState<boolean>(Boolean(event.requires_approval));

  // Default active key: interest for curated, accepted for non-curated
  const [activeKey, setActiveKey] = useState<EmailTemplateKey>(() =>
    event.requires_approval ? "interest" : "accepted",
  );

  // Template HTML state dictionary
  const [templates, setTemplates] = useState<Record<EmailTemplateKey, string>>(() => ({
    interest: event.email_templates?.interest ?? getDefaultTemplateByKey("interest"),
    accepted: event.email_templates?.accepted ?? getDefaultTemplateByKey("accepted"),
    rejected_hybrid: event.email_templates?.rejected_hybrid ?? getDefaultTemplateByKey("rejected_hybrid"),
    rejected_non_hybrid: event.email_templates?.rejected_non_hybrid ?? getDefaultTemplateByKey("rejected_non_hybrid"),
  }));

  // Initial templates reference for dirty tracking
  const [savedTemplates, setSavedTemplates] = useState<Record<EmailTemplateKey, string>>(() => ({
    interest: event.email_templates?.interest ?? getDefaultTemplateByKey("interest"),
    accepted: event.email_templates?.accepted ?? getDefaultTemplateByKey("accepted"),
    rejected_hybrid: event.email_templates?.rejected_hybrid ?? getDefaultTemplateByKey("rejected_hybrid"),
    rejected_non_hybrid: event.email_templates?.rejected_non_hybrid ?? getDefaultTemplateByKey("rejected_non_hybrid"),
  }));

  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewMode, setPreviewMode] = useState<"simulated" | "raw">("simulated");
  const [sampleAttendeeName, setSampleAttendeeName] = useState("Alex Pratama");
  const [isSaving, startTransition] = useTransition();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showN8nGuide, setShowN8nGuide] = useState(false);

  // Load latest templates & approval setting from Firestore on mount
  useEffect(() => {
    if (!event.id) return;
    async function loadLatestEventData() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData) {
          if (docData.requires_approval !== undefined) {
            setIsCurated(Boolean(docData.requires_approval));
          }
          if (docData.email_templates) {
            const loaded = {
              interest: docData.email_templates.interest ?? getDefaultTemplateByKey("interest"),
              accepted: docData.email_templates.accepted ?? getDefaultTemplateByKey("accepted"),
              rejected_hybrid: docData.email_templates.rejected_hybrid ?? getDefaultTemplateByKey("rejected_hybrid"),
              rejected_non_hybrid:
                docData.email_templates.rejected_non_hybrid ?? getDefaultTemplateByKey("rejected_non_hybrid"),
            };
            setTemplates(loaded);
            setSavedTemplates(loaded);
          }
        }
      } catch (err) {
        console.warn("[EmailTemplatesTab] Failed to load latest email templates from Firestore:", err);
      }
    }
    void loadLatestEventData();
  }, [event.id]);

  // Dirty state calculation
  const isDirty = useMemo(() => {
    return (
      templates.interest !== savedTemplates.interest ||
      templates.accepted !== savedTemplates.accepted ||
      templates.rejected_hybrid !== savedTemplates.rejected_hybrid ||
      templates.rejected_non_hybrid !== savedTemplates.rejected_non_hybrid
    );
  }, [templates, savedTemplates]);

  const activeMeta = useMemo<EmailTemplateMeta>(() => {
    const found = EMAIL_TEMPLATES_CONFIG.find((cfg) => cfg.key === activeKey);
    return (
      found ??
      EMAIL_TEMPLATES_CONFIG[0] ?? {
        key: "interest",
        name: "Registration Interest",
        badge: "Curated Flow",
        subjectDefault: "Registration Received",
        description: "",
        n8nNode: "loop-send-email",
        triggerDescription: "",
        defaultHtml: "",
        isCuratedOnly: true,
        variables: [],
      }
    );
  }, [activeKey]);

  // Interpolated preview HTML
  const previewHtml = useMemo(() => {
    const rawHtml = templates[activeKey] ?? "";
    if (previewMode === "raw") {
      return rawHtml;
    }
    return interpolateTemplatePreview(rawHtml, event, {
      sampleName: sampleAttendeeName.trim() !== "" ? sampleAttendeeName.trim() : "Alex Pratama",
    });
  }, [templates, activeKey, previewMode, event, sampleAttendeeName]);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleTextChange = (val: string | undefined) => {
    const nextVal = val ?? "";
    setTemplates((prev) => ({
      ...prev,
      [activeKey]: nextVal,
    }));
  };

  const handleInsertTag = (tag: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    editor.executeEdits("insert-n8n-tag", [
      {
        range: selection,
        text: tag,
        forceMoveMarkers: true,
      },
    ]);
    editor.focus();
    toast.success(`Inserted tag: ${tag}`);
  };

  const handleFormatCode = () => {
    editorRef.current?.getAction("editor.action.formatDocument")?.run();
    toast.info("Document formatted");
  };

  const handleResetToDefault = () => {
    const defaultHtml = getDefaultTemplateByKey(activeKey);
    setTemplates((prev) => ({
      ...prev,
      [activeKey]: defaultHtml,
    }));
    toast.info(`Reset "${activeMeta.name}" to default GDG template`);
  };

  const handleCopyHtml = async () => {
    const currentCode = templates[activeKey] ?? "";
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopiedKey(activeKey);
      toast.success("HTML template copied to clipboard! Paste it into your n8n Email node.");
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      toast.error("Failed to copy HTML to clipboard.");
    }
  };

  const handleDiscardChanges = () => {
    setTemplates(savedTemplates);
    toast.info("Unsaved edits discarded");
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const payload: EventEmailTemplates = {
          interest: templates.interest,
          accepted: templates.accepted,
          rejected_hybrid: templates.rejected_hybrid,
          rejected_non_hybrid: templates.rejected_non_hybrid,
        };
        const res = await updateEventEmailTemplatesAction(String(event.id), payload);
        if (res.success) {
          setSavedTemplates(templates);
          toast.success("Email templates saved to event successfully!");
        } else {
          toast.error(res.error ?? "Failed to save email templates.");
        }
      } catch (err) {
        console.error("[EmailTemplatesTab] Save error:", err);
        toast.error("An error occurred while saving templates.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* ── Workflow Flow Banner & Curation Logic ────────────────────── */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Workflow className="size-5 text-primary" />
                <CardTitle className="text-lg">Backend n8n Email Automation Flow</CardTitle>
                <Badge variant={isCurated ? "default" : "secondary"} className="gap-1 font-medium">
                  {isCurated ? (
                    <>
                      <Sparkles className="size-3" /> Curated Flow (Approval Required)
                    </>
                  ) : (
                    <>
                      <Send className="size-3" /> Direct Ticket Flow (Instant RSVP)
                    </>
                  )}
                </Badge>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                {isCurated
                  ? "Because this event requires attendee curation (requires_approval = true), n8n triggers an Interest Receipt email first, followed by Accepted or Rejected emails upon review."
                  : "Because this event does not require curation (requires_approval = false), n8n directly sends the Official Ticket email upon registration."}
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 self-start text-xs sm:self-auto"
              onClick={() => setShowN8nGuide((prev) => !prev)}
            >
              <Terminal className="size-3.5" />
              {showN8nGuide ? "Hide n8n Specs" : "View n8n Architecture"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Visual Flowchart */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 sm:p-4">
            <div className="mb-3 flex items-center gap-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              <Workflow className="size-3.5" /> Active Workflow Pipeline
            </div>

            {isCurated ? (
              <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-4">
                {/* Step 1: Registration */}
                <div className="flex flex-col justify-between rounded-lg border bg-background/80 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">Start</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      Trigger
                    </Badge>
                  </div>
                  <div className="font-medium text-foreground text-xs sm:text-sm">Attendee Registers</div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Webhook triggered with registration form responses
                  </p>
                </div>

                {/* Step 2: Interest Email */}
                <button
                  type="button"
                  onClick={() => setActiveKey("interest")}
                  className={cn(
                    "flex w-full cursor-pointer flex-col justify-between rounded-lg border p-3 text-left transition-all",
                    activeKey === "interest"
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                      : "bg-background/80 hover:border-primary/50",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-blue-600 uppercase tracking-wider dark:text-blue-400">
                      Step 1
                    </span>
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 px-1.5 py-0 text-[10px] text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    >
                      Auto Sent
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs sm:text-sm">
                    <Mail className="size-3.5 shrink-0 text-blue-500" />
                    Interest Receipt Email
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Explains curation process; clarifies this is not an entry pass
                  </p>
                </button>

                {/* Step 3: Organizer Review */}
                <div className="flex flex-col justify-between rounded-lg border bg-background/80 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">Action</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      Organizer
                    </Badge>
                  </div>
                  <div className="font-medium text-foreground text-xs sm:text-sm">Dashboard Curation</div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Organizer marks applicant as Approved or Rejected in Registrants tab
                  </p>
                </div>

                {/* Step 4: Outcome Branch */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveKey("accepted")}
                    className={cn(
                      "flex w-full cursor-pointer flex-col justify-between rounded-lg border p-2 text-left transition-all",
                      activeKey === "accepted"
                        ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                        : "bg-background/80 hover:border-emerald-500/40",
                    )}
                  >
                    <div className="flex items-center gap-1 font-semibold text-[11px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3 shrink-0" /> Approved
                    </div>
                    <div className="mt-0.5 font-medium text-[11px] text-foreground">Ticket Pass & QR</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveKey("rejected_hybrid")}
                    className={cn(
                      "flex w-full cursor-pointer flex-col justify-between rounded-lg border p-2 text-left transition-all",
                      activeKey.startsWith("rejected")
                        ? "border-red-500 bg-red-500/5 ring-1 ring-red-500"
                        : "bg-background/80 hover:border-red-500/40",
                    )}
                  >
                    <div className="flex items-center gap-1 font-semibold text-[11px] text-red-600 dark:text-red-400">
                      <XCircle className="size-3 shrink-0" /> Rejected
                    </div>
                    <div className="mt-0.5 font-medium text-[11px] text-foreground">Regret Notice</div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">
                {/* Non-Curated Step 1 */}
                <div className="flex flex-col justify-between rounded-lg border bg-background/80 p-3.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">Start</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      Trigger
                    </Badge>
                  </div>
                  <div className="font-semibold text-foreground text-xs sm:text-sm">Attendee Registers (RSVP)</div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Registration form submitted with instant confirmation policy
                  </p>
                </div>

                {/* Non-Curated Step 2 */}
                <button
                  type="button"
                  onClick={() => setActiveKey("accepted")}
                  className={cn(
                    "flex w-full cursor-pointer flex-col justify-between rounded-lg border p-3.5 text-left transition-all",
                    activeKey === "accepted"
                      ? "border-emerald-500 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500"
                      : "bg-background/80 hover:border-emerald-500/50",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-emerald-600 uppercase tracking-wider dark:text-emerald-400">
                      Direct Delivery
                    </span>
                    <Badge
                      variant="secondary"
                      className="bg-emerald-100 px-1.5 py-0 text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    >
                      Instant Pass
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs sm:text-sm">
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                    Official Ticket & QR Pass Email
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Directly delivers the entry pass and checklist to attendee&apos;s inbox
                  </p>
                </button>
              </div>
            )}
          </div>

          {/* Collapsible n8n Node Specs & Webhook Architecture */}
          {showN8nGuide && (
            <div className="space-y-3 rounded-xl border border-border/80 border-dashed bg-muted/20 p-4">
              <div className="flex items-center gap-2 font-semibold text-foreground text-xs uppercase tracking-wider">
                <Terminal className="size-3.5 text-primary" /> n8n Node Reference & Expression Guide
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                The n8n workflow executes when attendees register or when organizers change applicant status in the
                dashboard. HTML templates below consume standard n8n expression items. Make sure your n8n workflow nodes
                match these names:
              </p>
              <div className="grid grid-cols-1 gap-2.5 text-xs md:grid-cols-3">
                <div className="space-y-1 rounded-md border bg-background p-2.5">
                  <div className="font-mono font-semibold text-primary">event-params / bevy-config</div>
                  <p className="text-[11px] text-muted-foreground">
                    Provides `eventName`, `eventHeaderUrl`, `eventActionUrl`, `bevyEventDate`, `bevyEventLocation`.
                  </p>
                </div>
                <div className="space-y-1 rounded-md border bg-background p-2.5">
                  <div className="font-mono font-semibold text-primary">loop-send-email / rejected</div>
                  <p className="text-[11px] text-muted-foreground">
                    Iterates registrant records, injecting `Full Name` and recipient email into the mailer.
                  </p>
                </div>
                <div className="space-y-1 rounded-md border bg-background p-2.5">
                  <div className="font-mono font-semibold text-primary">generate-qrcode</div>
                  <p className="text-[11px] text-muted-foreground">
                    Generates base64 PNG QR code string `qrCode` injected into the ticket card pass.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Template Switcher & Actions ─────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Template Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/60 p-1">
            {EMAIL_TEMPLATES_CONFIG.map((cfg) => {
              const isSelected = activeKey === cfg.key;
              const isCurrentActiveInFlow = isCurated ? true : cfg.key === "accepted";
              return (
                <button
                  type="button"
                  key={cfg.key}
                  onClick={() => setActiveKey(cfg.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition-all",
                    isSelected
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                  )}
                >
                  {cfg.key === "interest" && <Mail className="size-3.5 text-blue-500" />}
                  {cfg.key === "accepted" && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                  {cfg.key.startsWith("rejected") && <XCircle className="size-3.5 text-red-500" />}
                  <span>{cfg.name}</span>
                  {!isCurrentActiveInFlow && (
                    <Badge variant="outline" className="ml-0.5 px-1 py-0 text-[9px] opacity-70">
                      Curated only
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopyHtml}>
              {copiedKey === activeKey ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Copy n8n HTML
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-muted-foreground text-xs hover:text-destructive"
              onClick={handleResetToDefault}
            >
              <RotateCcw className="size-3.5" />
              Reset Default
            </Button>
          </div>
        </div>

        {/* Selected Template Header Card */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{activeMeta.name}</span>
              <Badge variant="outline" className="text-xs">
                {activeMeta.badge}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[11px]">
                node: {activeMeta.n8nNode}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">{activeMeta.description}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
            <Info className="size-3.5" />
            <span>{activeMeta.triggerDescription}</span>
          </div>
        </div>

        {/* ── Monaco Editor & Interactive Live Preview ──────────────── */}
        <div className="flex flex-col gap-4">
          {/* Quick Insert Variables Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/30 p-2.5">
            <span className="mr-1 flex items-center gap-1 font-semibold text-muted-foreground text-xs">
              <Code2 className="size-3" /> Insert n8n Tag:
            </span>
            {activeMeta.variables.map((v) => (
              <Badge
                key={v.tag}
                variant="secondary"
                className="cursor-pointer font-mono text-[11px] transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95"
                title={`${v.label}: ${v.description}`}
                onClick={() => handleInsertTag(v.tag)}
              >
                {v.label}
              </Badge>
            ))}
          </div>

          {/* Split Editor and Preview Grid */}
          <div className="grid min-h-[640px] grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
            {/* LEFT: Code Editor */}
            <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Code2 className="size-3.5 text-muted-foreground" />
                  <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    HTML Source ({activeMeta.name})
                  </Label>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={handleFormatCode}
                  >
                    <Wand2 className="size-3" />
                    Format
                  </Button>
                </div>
              </div>

              <div className="relative min-h-[580px] flex-1">
                <Editor
                  height="100%"
                  defaultLanguage="html"
                  value={templates[activeKey]}
                  onChange={handleTextChange}
                  onMount={handleEditorDidMount}
                  theme={theme === "dark" ? "vs-dark" : "light"}
                  options={{
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                    fontLigatures: true,
                    minimap: { enabled: false },
                    wordWrap: "on",
                    formatOnPaste: true,
                    formatOnType: true,
                    tabSize: 2,
                    fontSize: 12.5,
                    padding: { top: 14, bottom: 14 },
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>
            </div>

            {/* RIGHT: Live Responsive Preview */}
            <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Eye className="size-3.5 text-muted-foreground" />
                  <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    Live Email Preview
                  </Label>

                  {/* Mode Selector */}
                  <div className="flex items-center rounded-md border bg-background/80 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("simulated")}
                      className={cn(
                        "rounded px-2 py-0.5 font-medium text-[11px] transition-colors",
                        previewMode === "simulated"
                          ? "bg-muted font-semibold text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      Simulated Data
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("raw")}
                      className={cn(
                        "rounded px-2 py-0.5 font-medium text-[11px] transition-colors",
                        previewMode === "raw" ? "bg-muted font-semibold text-foreground" : "text-muted-foreground",
                      )}
                    >
                      Raw Tags
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Sample Name Input */}
                  {previewMode === "simulated" && (
                    <div className="hidden items-center gap-1 text-xs sm:flex">
                      <span className="text-[11px] text-muted-foreground">Name:</span>
                      <Input
                        value={sampleAttendeeName}
                        onChange={(e) => setSampleAttendeeName(e.target.value)}
                        placeholder="Attendee Name"
                        className="h-6 w-28 px-1.5 text-[11px]"
                      />
                    </div>
                  )}

                  {/* Device Switcher */}
                  <div className="flex items-center gap-0.5 rounded-md border bg-background/80 p-0.5">
                    <Button
                      type="button"
                      variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={() => setPreviewDevice("desktop")}
                    >
                      <Laptop className="size-3" />
                      <span className="hidden sm:inline">Desktop</span>
                    </Button>
                    <Button
                      type="button"
                      variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={() => setPreviewDevice("mobile")}
                    >
                      <Smartphone className="size-3" />
                      <span className="hidden sm:inline">Mobile</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Preview Canvas Container */}
              <div className="relative flex min-h-[580px] flex-1 items-center justify-center overflow-auto bg-muted/20 p-4">
                <div
                  className={cn(
                    "relative h-full min-h-[560px] w-full overflow-hidden rounded-lg border bg-white shadow-sm transition-all duration-300",
                    previewDevice === "mobile" && "max-w-[400px] rounded-3xl border-4 border-neutral-800 shadow-xl",
                  )}
                >
                  <iframe
                    srcDoc={previewHtml}
                    className="absolute inset-0 h-full w-full border-0 bg-white"
                    title="Live Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating Save Bar ────────────────────────────────────────── */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscardChanges}
        saveLabel="Save Templates to Event"
        savingLabel="Saving Templates..."
        savedLabel="All Templates Saved"
        helperText={
          isDirty ? (
            <span>You have modified email templates. Save changes to update Firestore.</span>
          ) : (
            <span>Templates are synchronized with event Firestore document.</span>
          )
        }
      />
    </div>
  );
}
