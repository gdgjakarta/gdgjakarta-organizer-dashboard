"use client";

import * as React from "react";

import Editor, { type OnMount } from "@monaco-editor/react";
import {
  Calendar,
  Code,
  Eye,
  GripVertical,
  Laptop,
  Maximize2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  User,
  Wand2,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildDefaultLabelTemplate, ensureFullLabelHtml, renderLabelTemplate } from "@/lib/printers/templates";
import type { LabelTemplateData } from "@/lib/printers/types";
import { cn } from "@/lib/utils";

type EditorInstance = Parameters<OnMount>[0];

interface TokenItem {
  id: string;
  tag: string;
  label: string;
  description: string;
  snippet?: string;
}

const EVENT_TOKENS: TokenItem[] = [
  { id: "event_name", tag: "[[EventName]]", label: "Event Title", description: "Title of the selected Bevy event" },
  { id: "event_id", tag: "[[eventId]]", label: "Event ID", description: "Bevy Event ID (used in QR payload)" },
  { id: "event_date", tag: "[[EventDate]]", label: "Event Date", description: "Formatted event date" },
  { id: "event_time", tag: "[[EventTime]]", label: "Event Time", description: "Formatted start/end time" },
  { id: "event_venue", tag: "[[EventVenue]]", label: "Venue Name", description: "Event venue location" },
];

const ATTENDEE_TOKENS: TokenItem[] = [
  { id: "name", tag: "[[Name]]", label: "Full Name", description: "e.g. Fachridan Tio" },
  { id: "title", tag: "[[title]]", label: "Job Title / Role", description: "e.g. Game Engineer" },
  { id: "company", tag: "[[company]]", label: "Company / Org", description: "e.g. Harvest Moon" },
  {
    id: "ticket_code",
    tag: "[[ticketCode]]",
    label: "Ticket Code",
    description: "Official Bevy ticket code (e.g. GOOGA263443955)",
  },
  { id: "qr", tag: "[[qr]]", label: "QR Code Image", description: "Rendered <img> tag for eventId:attendeeId" },
  { id: "session_track", tag: "[[sessionTrack]]", label: "Session Track", description: "e.g. Full Session" },
];

const LABEL_HTML_BLOCKS: TokenItem[] = [
  {
    id: "block_full_badge",
    tag: "Official Entry Pass Badge",
    label: "Official Entry Pass Badge",
    description: "Complete GDG dashed badge layout with QR and attendee details",
    snippet: `<div class="ticket-badge">
  <div class="ticket-header">
    <div class="brand-row">
      <span class="brand-title">GDG JAKARTA</span>
      <span class="ticket-badge-pill">ENTRY PASS</span>
    </div>
    <div class="event-name">[[EventName]]</div>
  </div>
  <div class="ticket-body">
    <div class="ticket-details">
      <div class="attendee-name">[[Name]]</div>
      <div class="attendee-title">[[title]]</div>
      <div class="attendee-company">[[company]]</div>
      <div class="ref-pill">
        <span class="ref-label">TICKET:</span>
        <span class="ref-code">[[ticketCode]]</span>
      </div>
    </div>
    <div class="ticket-qr-section">
      <div class="qr-container">[[qr]]</div>
      <div class="scan-hint">SCAN TO VERIFY</div>
    </div>
  </div>
</div>`,
  },
  {
    id: "block_qr_box",
    tag: "QR Verification Box",
    label: "QR Verification Box",
    description: "Framed QR code container with SCAN TO VERIFY caption",
    snippet: `<div class="ticket-qr-section">
  <div class="qr-container">
    [[qr]]
  </div>
  <div class="scan-hint">SCAN TO VERIFY</div>
</div>`,
  },
  {
    id: "block_ref_pill",
    tag: "Ticket Code Pill",
    label: "Ticket Code Pill",
    description: "Monospace ticket code badge displaying [[ticketCode]]",
    snippet: `<div class="ref-pill">
  <span class="ref-label">TICKET:</span>
  <span class="ref-code">[[ticketCode]]</span>
</div>`,
  },
];

interface LabelHtmlEditorPreviewProps {
  value: string;
  onChange: (value: string) => void;
  sampleData: LabelTemplateData;
  onSampleDataChange?: (patch: Partial<LabelTemplateData>) => void;
  onResetSampleData?: () => void;
  widthMm: number;
  heightMm: number;
  orientation: "portrait" | "landscape";
}

export function LabelHtmlEditorPreview({
  value,
  onChange,
  sampleData,
  onSampleDataChange,
  onResetSampleData,
  widthMm,
  heightMm,
  orientation,
}: LabelHtmlEditorPreviewProps) {
  const editorRef = React.useRef<EditorInstance | null>(null);
  const { theme } = useTheme();
  const [interpolatePreview, setInterpolatePreview] = React.useState<boolean>(true);
  const [isEditingSampleData, setIsEditingSampleData] = React.useState<boolean>(false);
  const [previewScaleMode, setPreviewScaleMode] = React.useState<"badge" | "expanded">("badge");

  // Ensure the editor always displays a complete <!DOCTYPE html> document with <style>
  const normalizedValue = React.useMemo(
    () => ensureFullLabelHtml(value, widthMm, heightMm, orientation),
    [value, widthMm, heightMm, orientation],
  );

  const insertContent = React.useCallback((content: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    editor.executeEdits("insert-token", [
      {
        range: selection,
        text: content,
        forceMoveMarkers: true,
      },
    ]);
    editor.focus();
  }, []);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;

    const domNode = editor.getDomNode();
    if (domNode) {
      domNode.addEventListener("dragover", (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = "copy";
        }
      });

      domNode.addEventListener("drop", (e: DragEvent) => {
        e.preventDefault();
        const text = e.dataTransfer?.getData("text/plain");
        if (!text) return;

        const target = editor.getTargetAtClientPoint(e.clientX, e.clientY);
        if (target?.position) {
          editor.executeEdits("drop-token", [
            {
              range: {
                startLineNumber: target.position.lineNumber,
                startColumn: target.position.column,
                endLineNumber: target.position.lineNumber,
                endColumn: target.position.column,
              },
              text,
              forceMoveMarkers: true,
            },
          ]);
          editor.focus();
        } else {
          insertContent(text);
        }
      });
    }
  };

  const formatDocument = () => {
    editorRef.current?.getAction("editor.action.formatDocument")?.run();
  };

  const handleDragStart = (e: React.DragEvent<HTMLElement>, content: string) => {
    e.dataTransfer.setData("text/plain", content);
    e.dataTransfer.effectAllowed = "copy";
  };

  // Rendered HTML for the live preview iframe
  const renderedHtml = React.useMemo(() => {
    if (!interpolatePreview) {
      return normalizedValue;
    }
    return renderLabelTemplate(normalizedValue, sampleData);
  }, [normalizedValue, interpolatePreview, sampleData]);

  // Scale factor for the true-mm iframe (1mm = 3.7795275591px at 96 DPI)
  const scaleFactor = previewScaleMode === "expanded" ? 2.25 : 1.85;
  const exactWidthPx = widthMm * 3.7795275591;
  const exactHeightPx = heightMm * 3.7795275591;
  const scaledWidthPx = Math.ceil(exactWidthPx * scaleFactor);
  const scaledHeightPx = Math.ceil(exactHeightPx * scaleFactor);

  return (
    <div className="flex w-full flex-col space-y-4">
      {/* Draggable Template Tokens & Component Blocks */}
      <div className="flex flex-col rounded-lg border bg-card/60 p-3 shadow-xs">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-amber-500" />
            <span className="font-semibold text-foreground text-xs tracking-tight">
              Template Tokens &amp; Components
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">Drag &amp; drop into editor or click to insert</span>
        </div>

        <Tabs defaultValue="attendee" className="w-full">
          <TabsList className="grid h-8 w-full grid-cols-3">
            <TabsTrigger value="attendee" className="gap-1 text-[11px]">
              <User className="size-3 text-emerald-500" />
              Attendee &amp; QR Data
            </TabsTrigger>
            <TabsTrigger value="event" className="gap-1 text-[11px]">
              <Calendar className="size-3 text-sky-500" />
              Event Data
            </TabsTrigger>
            <TabsTrigger value="blocks" className="gap-1 text-[11px]">
              <Code className="size-3 text-indigo-500" />
              HTML Blocks
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Attendee & QR Tokens */}
          <TabsContent value="attendee" className="mt-2.5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {ATTENDEE_TOKENS.map((token) => (
                <button
                  type="button"
                  key={token.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, token.tag)}
                  onClick={() => insertContent(token.tag)}
                  title={`${token.description} (Drag to editor or click to insert)`}
                  className="group flex cursor-grab items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-left transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 active:cursor-grabbing"
                >
                  <GripVertical className="size-3 shrink-0 text-emerald-500/50 group-hover:text-emerald-500" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold text-[11px] text-emerald-700 dark:text-emerald-300">
                      {token.label}
                    </span>
                    <span className="truncate font-mono text-[9px] text-muted-foreground">{token.tag}</span>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>

          {/* Tab 2: Event Data Tokens */}
          <TabsContent value="event" className="mt-2.5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {EVENT_TOKENS.map((token) => (
                <button
                  type="button"
                  key={token.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, token.tag)}
                  onClick={() => insertContent(token.tag)}
                  title={`${token.description} (Drag to editor or click to insert)`}
                  className="group flex cursor-grab items-center gap-1.5 rounded-md border border-sky-500/20 bg-sky-500/5 px-2 py-1.5 text-left transition-all hover:border-sky-500/40 hover:bg-sky-500/10 active:cursor-grabbing"
                >
                  <GripVertical className="size-3 shrink-0 text-sky-500/50 group-hover:text-sky-500" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold text-[11px] text-sky-700 dark:text-sky-300">
                      {token.label}
                    </span>
                    <span className="truncate font-mono text-[9px] text-muted-foreground">{token.tag}</span>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>

          {/* Tab 3: Pre-built HTML Blocks */}
          <TabsContent value="blocks" className="mt-2.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {LABEL_HTML_BLOCKS.map((block) => (
                <button
                  type="button"
                  key={block.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, block.snippet || block.tag)}
                  onClick={() => insertContent(block.snippet || block.tag)}
                  title={`${block.description} (Drag to editor or click to insert)`}
                  className="group flex cursor-grab items-center gap-2 rounded-md border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-2 text-left transition-all hover:border-indigo-500/40 hover:bg-indigo-500/10 active:cursor-grabbing"
                >
                  <GripVertical className="size-3.5 shrink-0 text-indigo-500/50 group-hover:text-indigo-500" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[11px] text-indigo-700 dark:text-indigo-300">
                        {block.label}
                      </span>
                      <Badge variant="outline" className="px-1 py-0 text-[9px]">
                        HTML
                      </Badge>
                    </div>
                    <span className="line-clamp-1 text-[10px] text-muted-foreground">{block.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Side-by-Side Monaco Code Editor & Live Preview Grid (matches Email Templates) */}
      <div className="grid min-h-140 grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Left: Monaco HTML Source Code Editor */}
        <div className="flex h-full flex-col overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                HTML Source Code
              </Label>
              <span className="text-[10px] text-muted-foreground">(Drop tokens anywhere)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => onChange(buildDefaultLabelTemplate(widthMm, heightMm, orientation))}
                title="Reset to default GDG badge template for current paper size"
              >
                <RotateCcw className="size-3" />
                Reset
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={formatDocument}
              >
                <Wand2 className="size-3.5" />
                Format Code
              </Button>
            </div>
          </div>
          <div className="relative h-full min-h-130 flex-1">
            <Editor
              height="100%"
              defaultLanguage="html"
              value={normalizedValue}
              onChange={(val) => onChange(val || "")}
              onMount={handleEditorDidMount}
              theme={theme === "dark" ? "vs-dark" : "light"}
              options={{
                fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
                fontLigatures: true,
                minimap: { enabled: false },
                wordWrap: "on",
                formatOnPaste: true,
                formatOnType: true,
                tabSize: 2,
                fontSize: 13,
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                dragAndDrop: true,
              }}
            />
          </div>
        </div>

        {/* Right: Live Preview Panel */}
        <div className="flex h-full flex-col overflow-hidden rounded-md border bg-muted/20">
          <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Live Preview
              </Label>
              <Button
                type="button"
                variant={interpolatePreview ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setInterpolatePreview(!interpolatePreview)}
                className="h-6 gap-1 px-2 text-[11px]"
                title="Toggle real interpolated values versus raw placeholder tags"
              >
                <Eye className="size-3" />
                <span>{interpolatePreview ? "Sample Data" : "Raw Tags"}</span>
              </Button>
              {onSampleDataChange && (
                <Button
                  type="button"
                  variant={isEditingSampleData ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditingSampleData((prev) => !prev)}
                  className="h-6 gap-1 px-2 text-[11px]"
                  title="Configure sample attendee and event values used in Live Preview and Test Print"
                >
                  <SlidersHorizontal className="size-3" />
                  <span>Configure</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1 rounded-md border bg-background/50 p-0.5">
              <Button
                type="button"
                variant={previewScaleMode === "badge" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => setPreviewScaleMode("badge")}
              >
                <Laptop className="size-3" />
                {widthMm}×{heightMm}mm
              </Button>
              <Button
                type="button"
                variant={previewScaleMode === "expanded" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => setPreviewScaleMode("expanded")}
              >
                <Maximize2 className="size-3" />
                Zoom 130%
              </Button>
            </div>
          </div>

          {isEditingSampleData && onSampleDataChange && (
            <div className="border-b bg-card/90 p-3 shadow-xs">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="size-3.5 text-primary" />
                  <span className="font-semibold text-foreground text-xs">Configure Sample Data</span>
                  <span className="text-[11px] text-muted-foreground">(Updates preview &amp; test print live)</span>
                </div>
                <div className="flex items-center gap-1">
                  {onResetSampleData && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-[11px]"
                      onClick={onResetSampleData}
                      title="Restore default sample attendee data"
                    >
                      <RotateCcw className="size-3" />
                      Reset Default
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-6 p-0"
                    onClick={() => setIsEditingSampleData(false)}
                    title="Close sample data configuration"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label className="font-medium text-[11px] text-muted-foreground">Full Name [[Name]]</Label>
                  <Input
                    value={sampleData.name}
                    onChange={(e) => onSampleDataChange({ name: e.target.value })}
                    placeholder="Fachridan Tio"
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-medium text-[11px] text-muted-foreground">Job Title [[title]]</Label>
                  <Input
                    value={sampleData.title || ""}
                    onChange={(e) => onSampleDataChange({ title: e.target.value })}
                    placeholder="Game Engineer"
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-medium text-[11px] text-muted-foreground">Company / Org [[company]]</Label>
                  <Input
                    value={sampleData.company || ""}
                    onChange={(e) => onSampleDataChange({ company: e.target.value })}
                    placeholder="Harvest Moon"
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-medium text-[11px] text-muted-foreground">Ticket Code [[ticketCode]]</Label>
                  <Input
                    value={sampleData.ticketCode || ""}
                    onChange={(e) => onSampleDataChange({ ticketCode: e.target.value, attendeeCode: e.target.value })}
                    placeholder="GOOGA263443955"
                    className="h-7 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-medium text-[11px] text-muted-foreground">Attendee ID [[attendeeId]]</Label>
                  <Input
                    value={String(sampleData.attendeeId ?? "")}
                    onChange={(e) => onSampleDataChange({ attendeeId: e.target.value })}
                    placeholder="263443955"
                    className="h-7 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-medium text-[11px] text-muted-foreground">
                    Session Track [[sessionTrack]]
                  </Label>
                  <Input
                    value={sampleData.sessionTrack || ""}
                    onChange={(e) => onSampleDataChange({ sessionTrack: e.target.value })}
                    placeholder="Full Session"
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="font-medium text-[11px] text-muted-foreground">Event Title [[EventName]]</Label>
                  <Input
                    value={sampleData.eventTitle || ""}
                    onChange={(e) => onSampleDataChange({ eventTitle: e.target.value })}
                    placeholder="DevFest Jakarta 2026"
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-medium text-[11px] text-muted-foreground">Event ID [[eventId]]</Label>
                  <Input
                    value={String(sampleData.eventId ?? "")}
                    onChange={(e) => onSampleDataChange({ eventId: e.target.value })}
                    placeholder="132640"
                    className="h-7 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="relative flex h-full min-h-130 flex-1 flex-col items-center justify-center overflow-auto bg-muted/10 p-6">
            {/* Outer card frame like Email Preview */}
            <div className="flex flex-col items-center justify-center gap-4">
              <div
                className={cn(
                  "relative overflow-hidden rounded-md border border-zinc-200 bg-white shadow-md transition-all duration-200",
                )}
                style={{
                  width: `${scaledWidthPx}px`,
                  height: `${scaledHeightPx}px`,
                }}
              >
                <iframe
                  srcDoc={renderedHtml}
                  className="block border-0 bg-white"
                  style={{
                    width: `${widthMm}mm`,
                    height: `${heightMm}mm`,
                    transform: `scale(${scaleFactor})`,
                    transformOrigin: "top left",
                  }}
                  title="Badge Label Preview"
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 text-muted-foreground text-xs">
                <Badge variant="outline" className="font-mono text-[11px]">
                  {widthMm} × {heightMm} mm
                </Badge>
                <span>•</span>
                <span>Event: {sampleData.eventTitle}</span>
                <span>•</span>
                <span className="font-mono">QR {sampleData.qrPayload}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
