"use client";

import { useMemo, useRef, useState } from "react";

import Editor, { type OnMount } from "@monaco-editor/react";
import { Eye, Laptop, Smartphone, Wand2 } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type {
  AttendeeDynamicPlaceholders,
  EventDynamicPlaceholders,
  PublishedEventOption,
} from "../_types/placeholders";
import { DraggableTokensPanel } from "./draggable-tokens-panel";

type EditorInstance = Parameters<OnMount>[0];

interface HtmlEditorPreviewProps {
  value: string;
  onChange: (value: string) => void;
  selectedEvent?: PublishedEventOption;
  eventPlaceholders?: EventDynamicPlaceholders;
  attendeePlaceholders?: AttendeeDynamicPlaceholders;
  headerUrl?: string;
  availableTags?: string[];
  isLoadingTags?: boolean;
}

export function HtmlEditorPreview({
  value,
  onChange,
  selectedEvent,
  eventPlaceholders,
  attendeePlaceholders,
  headerUrl,
  availableTags = [],
  isLoadingTags = false,
}: HtmlEditorPreviewProps) {
  const editorRef = useRef<EditorInstance | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { theme } = useTheme();
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [interpolatePreview, setInterpolatePreview] = useState<boolean>(true);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Attach drop event listener on Monaco DOM node to handle HTML5 drop seamlessly
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

  const insertContent = (content: string) => {
    const selection = editorRef.current?.getSelection();
    if (!selection) return;

    const op = {
      range: selection,
      text: content,
      forceMoveMarkers: true,
    };

    editorRef.current?.executeEdits("insert-token", [op]);
    editorRef.current?.focus();
  };

  const formatDocument = () => {
    editorRef.current?.getAction("editor.action.formatDocument")?.run();
  };

  // Live rendered HTML with simulated or real event values
  const renderedHtml = useMemo(() => {
    if (!interpolatePreview) return value;

    const eventName = eventPlaceholders?.EventName ?? selectedEvent?.title ?? "DevFest Jakarta 2026";
    const eventDate = eventPlaceholders?.EventDate ?? selectedEvent?.formattedDate ?? "Friday, Oct 23, 2026";
    const eventTime = eventPlaceholders?.EventTime ?? selectedEvent?.formattedTime ?? "10:00 AM - 05:00 PM";
    const eventVenue = eventPlaceholders?.EventVenue ?? selectedEvent?.venueName ?? "Jakarta Convention Center";
    const eventAddress = eventPlaceholders?.EventAddress ?? selectedEvent?.venueAddress ?? "Jl. Gatot Subroto, Jakarta";
    const eventUrl = eventPlaceholders?.EventUrl ?? selectedEvent?.url ?? "https://gdg.community.dev/gdg-jakarta/";
    const eventBannerUrl =
      headerUrl ??
      eventPlaceholders?.EventBannerUrl ??
      selectedEvent?.bannerUrl ??
      "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";
    const eventDesc =
      eventPlaceholders?.EventDescription ??
      selectedEvent?.descriptionShort ??
      "Join the largest Google developer community conference in Jakarta!";

    const sessionTitle = eventPlaceholders?.SessionTitle ?? "Keynote: Building Production AI Agents with Gemini";

    return (
      value
        .replace(/\[\[EventName\]\]/g, eventName)
        .replace(/\[\[EventDate\]\]/g, eventDate)
        .replace(/\[\[EventTime\]\]/g, eventTime)
        .replace(/\[\[EventVenue\]\]/g, eventVenue)
        .replace(/\[\[EventAddress\]\]/g, eventAddress)
        .replace(/\[\[EventUrl\]\]/g, eventUrl)
        .replace(/\[\[EventBannerUrl\]\]/g, eventBannerUrl)
        .replace(/\[\[EventDescription\]\]/g, eventDesc)
        .replace(/\[\[SessionTitle\]\]/g, sessionTitle)
        // Attendee placeholders simulation (customizable preview)
        .replace(/\[\[Name\]\]/g, attendeePlaceholders?.Name ?? "Budi Santoso")
        .replace(/\[\[FirstName\]\]/g, attendeePlaceholders?.FirstName ?? "Budi")
        .replace(/\[\[LastName\]\]/g, attendeePlaceholders?.LastName ?? "Santoso")
        .replace(/\[\[Email\]\]/g, attendeePlaceholders?.Email ?? "budi.santoso@example.com")
        .replace(/\[\[TicketType\]\]/g, attendeePlaceholders?.TicketType ?? "In-Person Pass (Free)")
        .replace(/\[\[CheckinStatus\]\]/g, attendeePlaceholders?.CheckinStatus ?? "Checked In")
    );
  }, [value, interpolatePreview, selectedEvent, eventPlaceholders, attendeePlaceholders, headerUrl]);

  return (
    <div className="flex w-full flex-col space-y-4">
      {/* Draggable Template Tokens & Component Blocks */}
      <DraggableTokensPanel
        onInsertToken={insertContent}
        sheetTokens={availableTags}
        isLoadingSheetTokens={isLoadingTags}
      />

      {/* Editor & Preview Grid */}
      <div className="grid min-h-160 grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Monaco Code Editor */}
        <div
          ref={containerRef}
          className="flex h-full flex-col overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        >
          <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                HTML Source Code
              </Label>
              <span className="text-[10px] text-muted-foreground">(Drop tokens anywhere)</span>
            </div>
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
          <div className="relative h-full min-h-160 flex-1">
            <Editor
              height="100%"
              defaultLanguage="html"
              value={value}
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

        {/* Live Preview Panel */}
        <div className="flex h-full flex-col overflow-hidden rounded-md border bg-muted/20">
          <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2">
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
            </div>
            <div className="flex items-center gap-1 rounded-md border bg-background/50 p-0.5">
              <Button
                type="button"
                variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => setPreviewDevice("desktop")}
              >
                <Laptop className="size-3" />
                Desktop
              </Button>
              <Button
                type="button"
                variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => setPreviewDevice("mobile")}
              >
                <Smartphone className="size-3" />
                Mobile
              </Button>
            </div>
          </div>
          <div className="relative flex h-full flex-1 items-center justify-center overflow-auto bg-muted/10 p-4">
            <div
              className={cn(
                "relative h-full min-h-160 w-full overflow-hidden rounded-md border bg-white shadow-xs transition-all duration-200",
                previewDevice === "mobile" && "max-w-95 rounded-2xl border-2 shadow-md",
              )}
            >
              <iframe
                srcDoc={renderedHtml}
                className="absolute inset-0 h-full w-full border-0 bg-white"
                title="Email Preview"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
