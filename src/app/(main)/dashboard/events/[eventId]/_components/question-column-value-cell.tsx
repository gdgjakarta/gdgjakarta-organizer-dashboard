"use client";

import { ExternalLink, FileText, Image as ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatFirestoreDate, parseFirestoreDate } from "@/lib/date-utils";

interface QuestionColumnValueCellProps {
  value: unknown;
}

export function QuestionColumnValueCell({ value }: QuestionColumnValueCellProps) {
  if (value === undefined || value === null || value === "") {
    return <span className="font-mono text-muted-foreground/40 text-xs">—</span>;
  }

  // Firestore Timestamp object
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const parsed = parseFirestoreDate(value);
    if (parsed && ("seconds" in value || "_seconds" in value || "toDate" in value)) {
      return (
        <span className="font-mono text-muted-foreground text-xs">
          {formatFirestoreDate(parsed, "dd MMM yyyy, h:mm a")}
        </span>
      );
    }
  }

  // Boolean
  if (typeof value === "boolean") {
    return value ? (
      <Badge variant="secondary" className="px-1.5 py-0 font-normal text-[11px]">
        Yes
      </Badge>
    ) : (
      <Badge variant="outline" className="px-1.5 py-0 font-normal text-[11px] text-muted-foreground">
        No
      </Badge>
    );
  }

  // Array of values
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="font-mono text-muted-foreground/40 text-xs">—</span>;
    }

    const firstTwo = value.slice(0, 2);
    const remaining = value.length - firstTwo.length;

    return (
      <div className="flex max-w-[220px] flex-wrap items-center gap-1" title={value.join(", ")}>
        {firstTwo.map((item) => (
          <Badge
            key={String(item)}
            variant="secondary"
            className="max-w-[140px] truncate px-1.5 py-0 font-normal text-[11px]"
          >
            {String(item)}
          </Badge>
        ))}
        {remaining > 0 && (
          <Badge variant="outline" className="px-1 py-0 text-[10px] text-muted-foreground">
            +{remaining}
          </Badge>
        )}
      </div>
    );
  }

  const str = String(value).trim();
  if (!str) {
    return <span className="font-mono text-muted-foreground/40 text-xs">—</span>;
  }

  // Media / Storage file uploads
  if (
    str.includes("/api/media/") ||
    str.includes("temp/") ||
    /\.(png|jpe?g|webp|gif|svg|avif|pdf|doc|docx|zip)(\?.*)?$/i.test(str)
  ) {
    const isImg = /\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i.test(str);
    const fileName = str.split("/").pop() || "Media file";
    const href = str.startsWith("http") || str.startsWith("/") ? str : `/${str}`;

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="group inline-flex max-w-[200px] items-center gap-1.5 rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 font-medium text-foreground text-xs transition-colors hover:border-primary/50 hover:bg-muted/70 hover:text-primary"
        title={str}
      >
        {isImg ? (
          <ImageIcon className="size-3.5 shrink-0 text-primary" />
        ) : (
          <FileText className="size-3.5 shrink-0 text-primary" />
        )}
        <span className="truncate text-[11px]">{fileName}</span>
        <ExternalLink className="size-3 shrink-0 opacity-60 group-hover:opacity-100" />
      </a>
    );
  }

  // URL / Social links
  if (/^(https?:\/\/|www\.|linkedin\.com|github\.com)/i.test(str)) {
    const href = str.startsWith("http") ? str : `https://${str}`;
    let display = str.replace(/^https?:\/\/(www\.)?/, "");
    if (display.length > 22) {
      display = `${display.slice(0, 20)}...`;
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex max-w-[200px] items-center gap-1 font-medium text-primary text-xs hover:underline"
        title={str}
      >
        <span className="truncate">{display}</span>
        <ExternalLink className="size-3 shrink-0 opacity-70" />
      </a>
    );
  }

  // Standard category pill tags
  const lower = str.toLowerCase();
  if (lower === "tech") {
    return (
      <Badge
        variant="secondary"
        className="border-blue-500/20 bg-blue-500/10 px-2 py-0 text-[11px] text-blue-600 dark:text-blue-400"
      >
        Tech
      </Badge>
    );
  }
  if (lower === "non-tech" || lower === "non tech") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/20 bg-amber-500/10 px-2 py-0 text-[11px] text-amber-600 dark:text-amber-400"
      >
        Non-Tech
      </Badge>
    );
  }
  if (lower === "student") {
    return (
      <Badge
        variant="outline"
        className="border-purple-500/20 bg-purple-500/10 px-2 py-0 text-[11px] text-purple-600 dark:text-purple-400"
      >
        Student
      </Badge>
    );
  }
  if (lower === "professional" || lower === "working professional") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/20 bg-emerald-500/10 px-2 py-0 text-[11px] text-emerald-600 dark:text-emerald-400"
      >
        Professional
      </Badge>
    );
  }

  return (
    <span className="block max-w-[220px] truncate font-medium text-foreground text-xs" title={str}>
      {str}
    </span>
  );
}
