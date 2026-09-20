"use client";

import { useRef, useState } from "react";

import Editor, { type OnMount } from "@monaco-editor/react";
import { Laptop, Smartphone, Wand2 } from "lucide-react";
import { useTheme } from "next-themes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type EditorInstance = Parameters<OnMount>[0];

interface HtmlEditorPreviewProps {
  value: string;
  onChange: (value: string) => void;
  availableTags: string[];
}

export function HtmlEditorPreview({ value, onChange, availableTags }: HtmlEditorPreviewProps) {
  const editorRef = useRef<EditorInstance | null>(null);
  const { theme } = useTheme();
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const insertTag = (tag: string) => {
    const selection = editorRef.current?.getSelection();
    if (!selection) return;

    const tagString = `[[${tag}]]`;
    const op = {
      range: selection,
      text: tagString,
      forceMoveMarkers: true,
    };

    // Execute the edit to insert the tag
    editorRef.current?.executeEdits("insert-tag", [op]);
    editorRef.current?.focus();
  };

  const formatDocument = () => {
    editorRef.current?.getAction("editor.action.formatDocument")?.run();
  };

  return (
    <div className="flex w-full flex-col space-y-4">
      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm font-medium">Insert Tag:</span>
          {availableTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer transition-colors hover:bg-secondary/80 hover:text-foreground active:scale-95"
              onClick={() => insertTag(tag)}
            >
              [[{tag}]]
            </Badge>
          ))}
        </div>
      )}

      <div className="grid min-h-150 grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Code Editor */}
        <div className="flex h-full flex-col overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
            <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              HTML Source Code
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5"
              onClick={formatDocument}
            >
              <Wand2 className="size-3.5" />
              Format Code
            </Button>
          </div>
          <div className="relative h-full min-h-150 flex-1">
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
              }}
            />
          </div>
        </div>

        {/* Live Preview */}
        <div className="flex h-full flex-col overflow-hidden rounded-md border bg-muted/20">
          <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
            <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Live Preview</Label>
            <div className="flex items-center gap-1 rounded-md border bg-background/50 p-0.5">
              <Button
                type="button"
                variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => setPreviewDevice("desktop")}
              >
                <Laptop className="size-3" />
                Desktop
              </Button>
              <Button
                type="button"
                variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs gap-1"
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
                "relative h-full min-h-150 w-full overflow-hidden rounded-md border bg-white shadow-sm transition-all duration-200",
                previewDevice === "mobile" && "max-w-95 border-2 shadow-md rounded-2xl",
              )}
            >
              <iframe
                srcDoc={value}
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
