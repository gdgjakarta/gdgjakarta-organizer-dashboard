"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface QuestionResponsesCellProps {
  answers?: Record<string, unknown>;
  formatQuestionLabel: (key: string) => string;
}

function getFieldPriority(key: string, value: string): number {
  const k = key.toLowerCase();
  // Specific professional background field
  if (k === "professional_background" || k === "background" || k === "job_background") {
    return 100;
  }
  // Specific years of experience field
  if (
    k === "years_of_professional_experience" ||
    k === "years_of_experience" ||
    k === "experience_level" ||
    k === "years" ||
    k === "years_experience"
  ) {
    return 90;
  }
  // Role / Job title
  if (k === "job_title" || k === "current_role" || k === "role" || k === "occupation" || k.includes("job_title")) {
    return 80;
  }
  // Company / Organization / Institution
  if (k === "company" || k === "organization" || k === "institution" || k === "current_company" || k === "university") {
    return 70;
  }
  // Generic background keyword (if not an open-ended survey question)
  if (k.includes("background") && value.length < 30) {
    return 65;
  }
  // Generic experience keyword only if it mentions years or has a short response
  if (k.includes("experience") && (k.includes("year") || value.length < 25)) {
    return 60;
  }
  // Short categorical answers (e.g. t-shirt size, dietary, tracks)
  if (value.length <= 25 && key.length <= 35) {
    return 40;
  }
  // Medium answers
  if (value.length <= 50) {
    return 20;
  }
  // Long open-ended answers (e.g. narrative essay or long tech survey answers)
  return 10;
}

function getCompactLabel(key: string, fullLabel: string): string {
  const k = key.toLowerCase();
  if (k.includes("background")) return "Background";
  if (k.includes("experience") || k.includes("year")) return "Experience";
  if (k.includes("role") || k.includes("job_title")) return "Role";
  if (k.includes("company") || k.includes("organization") || k.includes("university")) return "Company";
  if (k.includes("tshirt") || k.includes("t_shirt") || k.includes("size")) return "Size";
  if (k.includes("dietary") || k.includes("diet")) return "Diet";

  // If fullLabel is concise (<= 14 characters), keep it intact
  if (fullLabel.length <= 14) return fullLabel;

  // Otherwise, use first 12 characters followed by an ellipsis
  return `${fullLabel.slice(0, 12)}…`;
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

    // Sort entries deterministically based on priority weight, then length, then alphabetical key
    const sorted = [...entries].sort((a, b) => {
      const valStrA = Array.isArray(a[1]) ? a[1].join(", ") : String(a[1]);
      const valStrB = Array.isArray(b[1]) ? b[1].join(", ") : String(b[1]);
      const prioA = getFieldPriority(a[0], valStrA);
      const prioB = getFieldPriority(b[0], valStrB);

      if (prioB !== prioA) {
        return prioB - prioA;
      }

      // Stable secondary sort: shorter value length first
      if (valStrA.length !== valStrB.length) {
        return valStrA.length - valStrB.length;
      }

      // Deterministic tertiary tiebreaker
      return a[0].localeCompare(b[0]);
    });

    const display = sorted.slice(0, 2).map(([key, val]) => {
      const fullLabel = formatQuestionLabel(key);
      const compactLabel = getCompactLabel(key, fullLabel);
      const value = Array.isArray(val) ? val.join(", ") : String(val);
      const keyLower = key.toLowerCase();
      const isPill =
        value === "Tech" ||
        value === "Non-Tech" ||
        keyLower.includes("background") ||
        (keyLower.includes("experience") && (keyLower.includes("year") || value.length < 25));

      return {
        key,
        fullLabel,
        compactLabel,
        value,
        isPill,
      };
    });

    const remaining = Math.max(0, sorted.length - display.length);

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
        <div className="group flex max-w-[360px] flex-wrap items-center gap-1.5 py-1 text-left">
          {displayEntries.map((item) => {
            if (item.isPill) {
              return (
                <Badge
                  key={item.key}
                  variant={item.value === "Tech" ? "secondary" : "outline"}
                  title={`${item.fullLabel}: ${item.value}`}
                  className="inline-flex max-w-[170px] items-center gap-1 overflow-hidden px-2 py-0.5 font-medium text-[11px] shadow-2xs transition-colors group-hover:border-border"
                >
                  <span className="shrink-0 font-normal text-muted-foreground opacity-80">{item.compactLabel}:</span>
                  <span className="truncate font-semibold text-foreground">{item.value}</span>
                </Badge>
              );
            }

            return (
              <span
                key={item.key}
                title={`${item.fullLabel}: ${item.value}`}
                className="inline-flex max-w-[170px] items-center gap-1 overflow-hidden rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-medium text-xs shadow-2xs transition-colors hover:bg-muted/60"
              >
                <span className="shrink-0 font-normal text-muted-foreground text-[11px]">{item.compactLabel}:</span>
                <span className="truncate font-medium text-foreground text-xs">{item.value}</span>
              </span>
            );
          })}

          {remainingCount > 0 && (
            <Badge
              variant="outline"
              className="shrink-0 border-dashed px-1.5 py-0.5 font-normal text-[11px] text-muted-foreground transition-colors hover:bg-muted"
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
