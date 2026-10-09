"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface QuestionResponsesCellProps {
  answers?: Record<string, unknown>;
  formatQuestionLabel: (key: string) => string;
}

export function QuestionResponsesCell({ answers, formatQuestionLabel }: QuestionResponsesCellProps) {
  const { validEntries, displayEntries, remainingCount } = useMemo(() => {
    if (!answers || Object.keys(answers).length === 0) {
      return { validEntries: [], displayEntries: [], remainingCount: 0 };
    }

    const entries = Object.entries(answers).filter(
      ([k, v]) =>
        k !== "session_id" &&
        k !== "session_title" &&
        v !== undefined &&
        v !== null &&
        v !== "" &&
        !(Array.isArray(v) && v.length === 0),
    );

    // Look for prioritized highlighted fields
    const highlights: Array<{ key: string; label: string; value: string; isHighlight: boolean }> = [];
    const others: Array<{ key: string; label: string; value: string; isHighlight: boolean }> = [];

    for (const [key, val] of entries) {
      const keyLower = key.toLowerCase();
      const strVal = Array.isArray(val) ? val.join(", ") : String(val);
      const label = formatQuestionLabel(key);

      if (keyLower.includes("background") || keyLower.includes("experience")) {
        highlights.push({ key, label, value: strVal, isHighlight: true });
      } else {
        others.push({ key, label, value: strVal, isHighlight: false });
      }
    }

    const combined = [...highlights, ...others];
    const display = combined.slice(0, 2);
    const remaining = Math.max(0, combined.length - display.length);

    return {
      validEntries: entries,
      displayEntries: display,
      remainingCount: remaining,
    };
  }, [answers, formatQuestionLabel]);

  if (!answers || validEntries.length === 0) {
    return <span className="font-normal text-muted-foreground/70 text-xs italic">Standard RSVP</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="group flex max-w-[420px] flex-wrap items-center gap-1.5 py-1 text-left">
          {displayEntries.map((item) => {
            const isPill =
              item.value === "Tech" ||
              item.value === "Non-Tech" ||
              item.key.toLowerCase().includes("experience") ||
              item.key.toLowerCase().includes("background");

            if (isPill) {
              return (
                <Badge
                  key={item.key}
                  variant={item.value === "Tech" ? "secondary" : "outline"}
                  className="px-2 py-0.5 font-medium text-[11px] shadow-2xs transition-colors group-hover:border-border"
                >
                  <span className="font-normal text-muted-foreground opacity-80">{item.label}:</span>{" "}
                  <span className="font-semibold text-foreground">{item.value}</span>
                </Badge>
              );
            }

            return (
              <span
                key={item.key}
                className="inline-flex max-w-[210px] items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-medium text-xs shadow-2xs transition-colors hover:bg-muted/60"
              >
                <span className="shrink-0 font-normal text-muted-foreground text-[11px]">{item.label}:</span>
                <span className="truncate font-medium text-foreground text-xs">{item.value}</span>
              </span>
            );
          })}

          {remainingCount > 0 && (
            <Badge
              variant="outline"
              className="border-dashed px-1.5 py-0.5 font-normal text-[11px] text-muted-foreground transition-colors hover:bg-muted"
            >
              +{remainingCount} more
            </Badge>
          )}
        </div>
      </TooltipTrigger>

      <TooltipContent
        side="top"
        align="start"
        className="max-w-sm space-y-2 border border-border bg-popover p-3 text-popover-foreground shadow-md"
      >
        <div className="flex items-center justify-between border-b pb-1 font-semibold text-xs">
          <span>Question Responses</span>
          <span className="font-normal text-[10px] text-muted-foreground">({validEntries.length} total)</span>
        </div>

        <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
          {validEntries.map(([k, v]) => (
            <div key={k} className="flex flex-col text-xs">
              <span className="font-medium text-[11px] text-muted-foreground">{formatQuestionLabel(k)}</span>
              <span className="break-words font-medium text-foreground">
                {Array.isArray(v) ? v.join(", ") : String(v)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t pt-1 font-normal text-[10px] text-muted-foreground">
          Click row or badges to inspect full dossier
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
