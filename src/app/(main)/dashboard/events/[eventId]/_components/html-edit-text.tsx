"use client";

import { useEffect, useRef, useState } from "react";

import { Bold, Code, Eye, Italic, Link2, List, ListOrdered } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HtmlEditTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function HtmlEditText({
  value,
  onChange,
  placeholder = "Session prerequisites or topics...",
  className,
  minHeight = "min-h-[100px]",
}: HtmlEditTextProps) {
  const [isCodeMode, setIsCodeMode] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync external value to contentEditable when not currently editing in visual mode
  useEffect(() => {
    if (!isCodeMode && editorRef.current) {
      if (document.activeElement !== editorRef.current) {
        if (editorRef.current.innerHTML !== (value || "")) {
          editorRef.current.innerHTML = value || "";
        }
      }
    }
  }, [value, isCodeMode]);

  const handleVisualInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // Clean empty div/br artifacts
      const cleaned = html === "<br>" || html === "<p><br></p>" ? "" : html;
      onChange(cleaned);
    }
  };

  const handleVisualBlur = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const cleaned = html === "<br>" || html === "<p><br></p>" ? "" : html;
      onChange(cleaned);
    }
  };

  const executeCommand = (command: string, arg?: string) => {
    if (isCodeMode) {
      // In Raw HTML Code mode, insert tags into textarea around selection
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.substring(start, end);

      let replacement = "";
      switch (command) {
        case "bold":
          replacement = `<b>${selected || "bold text"}</b>`;
          break;
        case "italic":
          replacement = `<i>${selected || "italic text"}</i>`;
          break;
        case "createLink": {
          const url = window.prompt("Enter link URL:", "https://")?.trim();
          if (!url) return;
          replacement = `<a href="${url}" target="_blank" rel="noopener noreferrer">${selected || "link text"}</a>`;
          break;
        }
        case "insertUnorderedList":
          replacement = `<ul>\n  <li>${selected || "List item"}</li>\n</ul>`;
          break;
        case "insertOrderedList":
          replacement = `<ol>\n  <li>${selected || "Numbered item"}</li>\n</ol>`;
          break;
        default:
          return;
      }

      const nextVal = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
      onChange(nextVal);

      // Re-focus textarea
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + replacement.length, start + replacement.length);
      }, 0);
    } else {
      // In Visual Mode, use document.execCommand
      if (!editorRef.current) return;
      editorRef.current.focus();

      if (command === "createLink") {
        const url = window.prompt("Enter link URL:", "https://")?.trim();
        if (url) {
          document.execCommand(command, false, url);
          handleVisualInput();
        }
      } else {
        document.execCommand(command, false, arg);
        handleVisualInput();
      }
    }
  };

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-card shadow-2xs transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
        className,
      )}
    >
      {/* Editor Formatting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-border/70 border-b bg-muted/30 px-2 py-1">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Bold (<b> / <strong>)"
            aria-label="Bold"
            onClick={() => executeCommand("bold")}
          >
            <Bold className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Italic (<i> / <em>)"
            aria-label="Italic"
            onClick={() => executeCommand("italic")}
          >
            <Italic className="size-3.5" />
          </Button>

          <div className="mx-1 h-3.5 w-px bg-border/80" />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Hyperlink (<a>)"
            aria-label="Hyperlink"
            onClick={() => executeCommand("createLink")}
          >
            <Link2 className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Bullet List (<ul><li>)"
            aria-label="Bullet List"
            onClick={() => executeCommand("insertUnorderedList")}
          >
            <List className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Numbered List (<ol><li>)"
            aria-label="Numbered List"
            onClick={() => executeCommand("insertOrderedList")}
          >
            <ListOrdered className="size-3.5" />
          </Button>
        </div>

        {/* Mode Toggle: Visual vs HTML Source */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant={isCodeMode ? "secondary" : "ghost"}
            size="sm"
            className="h-6 gap-1 px-1.5 font-mono text-[10px]"
            title={isCodeMode ? "Switch to Visual WYSIWYG editor" : "Switch to Raw HTML Code editor"}
            onClick={() => {
              if (isCodeMode && editorRef.current) {
                editorRef.current.innerHTML = value || "";
              }
              setIsCodeMode(!isCodeMode);
            }}
          >
            {isCodeMode ? (
              <>
                <Eye className="size-3" />
                <span>Visual</span>
              </>
            ) : (
              <>
                <Code className="size-3" />
                <span>&lt;&gt; HTML</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor Canvas */}
      <div className="relative">
        {isCodeMode ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="<p>Enter HTML formatted description here...</p>"
            className={cn(
              "w-full resize-y bg-transparent p-2.5 font-mono text-foreground text-xs leading-relaxed outline-none placeholder:text-muted-foreground",
              minHeight,
            )}
          />
        ) : (
          // biome-ignore lint/a11y/useSemanticElements: contentEditable container requires div
          <div
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            tabIndex={0}
            contentEditable
            suppressContentEditableWarning
            onInput={handleVisualInput}
            onBlur={handleVisualBlur}
            data-placeholder={placeholder}
            className={cn(
              "w-full cursor-text p-2.5 text-foreground text-xs leading-relaxed outline-none",
              "[&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
              "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
              minHeight,
            )}
          />
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="flex items-center justify-between border-border/40 border-t bg-muted/20 px-2.5 py-1 text-[10px] text-muted-foreground">
        <span>HTML format for email details (supports bold, italic, links, lists)</span>
        <span className="font-mono">{isCodeMode ? "HTML Mode" : "Visual Mode"}</span>
      </div>
    </div>
  );
}
