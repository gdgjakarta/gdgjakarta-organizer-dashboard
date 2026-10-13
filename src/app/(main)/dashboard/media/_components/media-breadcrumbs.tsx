"use client";

import * as React from "react";

import { ArrowUp, ChevronRight, HardDrive } from "lucide-react";

import { Button } from "@/components/ui/button";

interface MediaBreadcrumbsProps {
  currentPrefix: string;
  onNavigate: (prefix: string) => void;
}

export function MediaBreadcrumbs({ currentPrefix, onNavigate }: MediaBreadcrumbsProps) {
  const segments = React.useMemo(() => {
    if (!currentPrefix) return [];
    const parts = currentPrefix.replace(/\/+$/, "").split("/").filter(Boolean);
    let accum = "";
    return parts.map((part) => {
      accum += `${part}/`;
      return {
        name: part,
        prefix: accum,
      };
    });
  }, [currentPrefix]);

  const handleGoUp = () => {
    if (segments.length <= 1) {
      onNavigate("");
    } else {
      const parentSegment = segments[segments.length - 2];
      onNavigate(parentSegment.prefix);
    }
  };

  return (
    <nav aria-label="Directory Breadcrumbs" className="flex items-center gap-1.5 overflow-x-auto py-1 text-sm">
      {currentPrefix && (
        <Button variant="outline" size="icon-xs" onClick={handleGoUp} title="Go up one level" className="mr-1 shrink-0">
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Root Item */}
      <button
        type="button"
        onClick={() => onNavigate("")}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors hover:bg-muted ${
          !currentPrefix ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <HardDrive className="h-4 w-4" />
        <span>Root</span>
      </button>

      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <React.Fragment key={seg.prefix}>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <button
              type="button"
              onClick={() => onNavigate(seg.prefix)}
              className={`rounded-md px-2 py-1 font-medium transition-colors hover:bg-muted ${
                isLast ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {seg.name}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
