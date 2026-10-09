"use client";

import { useMemo, useState } from "react";

import { Columns, RotateCcw, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface AvailableQuestionField {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  responseCount: number;
}

export interface StandardColumnOption {
  id: string;
  label: string;
  description: string;
  locked?: boolean;
}

interface ColumnCustomizerProps {
  availableQuestions: AvailableQuestionField[];
  selectedQuestionKeys: string[];
  onToggleQuestion: (key: string) => void;
  onSelectAllQuestions: () => void;
  onClearAllQuestions: () => void;

  visibleStandardColumns: Record<string, boolean>;
  onToggleStandardColumn: (id: string) => void;
  hasSessions: boolean;
  hasTickets?: boolean;
  hasMerchandise?: boolean;
  onResetDefaults: () => void;
}

export function ColumnCustomizer({
  availableQuestions,
  selectedQuestionKeys,
  onToggleQuestion,
  onSelectAllQuestions,
  onClearAllQuestions,
  visibleStandardColumns,
  onToggleStandardColumn,
  hasSessions,
  hasTickets = false,
  hasMerchandise = false,
  onResetDefaults,
}: ColumnCustomizerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"questions" | "standard">("questions");

  const standardColumnDefs: StandardColumnOption[] = useMemo(() => {
    const list: StandardColumnOption[] = [
      { id: "applicant", label: "Applicant", description: "Name, email, and avatar", locked: true },
      { id: "status", label: "Status", description: "Approved, Pending, or Rejected badge" },
      { id: "reviewed_by", label: "Reviewed By", description: "Organizer who approved, rejected, or waitlisted" },
    ];

    if (hasTickets) {
      list.push({ id: "ticket", label: "Ticket Pass", description: "Selected ticket tier, price, or free status" });
    }

    if (hasMerchandise) {
      list.push({ id: "merchandise", label: "Merchandise", description: "Ordered event merchandise items and addons" });
    }

    if (hasSessions) {
      list.push({ id: "session", label: "Session Track", description: "Selected event session" });
    }

    list.push(
      { id: "checkin", label: "Check-In (Bevy)", description: "On-site check-in toggle and Bevy state" },
      { id: "all_responses", label: "Responses Summary", description: "Combined preview of all form answers" },
      { id: "registered_at", label: "Registered At", description: "Submission date and timestamp" },
      { id: "actions", label: "Actions", description: "Approve, Reject, and detail review actions" },
    );

    return list;
  }, [hasSessions, hasTickets, hasMerchandise]);

  // Filtered lists based on search
  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return availableQuestions;
    return availableQuestions.filter(
      (q) => q.label.toLowerCase().includes(query) || q.key.toLowerCase().includes(query),
    );
  }, [availableQuestions, search]);

  const filteredStandard = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return standardColumnDefs;
    return standardColumnDefs.filter(
      (c) => c.label.toLowerCase().includes(query) || c.description.toLowerCase().includes(query),
    );
  }, [standardColumnDefs, search]);

  const totalCustomSelected = selectedQuestionKeys.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "h-8 gap-1.5 text-xs transition-colors",
            totalCustomSelected > 0 && "border-primary/50 bg-primary/5 text-primary hover:bg-primary/10",
          )}
        >
          <SlidersHorizontal className="size-3.5" />
          <span>Customize Columns</span>
          {totalCustomSelected > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 bg-primary/15 px-1.5 py-0 font-semibold text-[10px] text-primary hover:bg-primary/20"
            >
              +{totalCustomSelected}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="flex max-h-[520px] w-80 flex-col gap-2.5 p-3 sm:w-96">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
              <Columns className="size-3.5 text-primary" />
              <span>Customize Table Columns</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Add question fields as columns to enable dynamic filtering.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute top-2 left-2.5 size-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search column or question name..."
            className="h-7 pl-7 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1.5 right-2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("questions")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1 font-medium text-[11px] transition-colors",
              activeTab === "questions"
                ? "bg-background font-semibold text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="size-3 text-primary" />
            <span>Questions</span>
            {totalCustomSelected > 0 && (
              <Badge variant="secondary" className="bg-primary/10 px-1 py-0 text-[9px] text-primary">
                {totalCustomSelected}
              </Badge>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("standard")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1 font-medium text-[11px] transition-colors",
              activeTab === "standard"
                ? "bg-background font-semibold text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Columns className="size-3" />
            <span>Standard</span>
          </button>
        </div>

        {/* Tab Content: Questions */}
        {activeTab === "questions" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-0.5 text-[11px] text-muted-foreground">
              <span>{availableQuestions.length} available question(s)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSelectAllQuestions}
                  className="text-[11px] transition-colors hover:text-primary hover:underline"
                >
                  Select All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={onClearAllQuestions}
                  className="text-[11px] transition-colors hover:text-destructive hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border bg-muted/20 p-1.5 pr-1">
              {filteredQuestions.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-xs">
                  No question fields match your search.
                </div>
              ) : (
                filteredQuestions.map((q) => {
                  const isChecked = selectedQuestionKeys.includes(q.key);
                  const checkboxId = `col-q-${q.key}`;
                  return (
                    <label
                      key={q.key}
                      htmlFor={checkboxId}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-md p-1.5 text-xs transition-colors",
                        isChecked ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          id={checkboxId}
                          checked={isChecked}
                          onCheckedChange={() => onToggleQuestion(q.key)}
                          className="size-3.5"
                        />
                        <span className="truncate font-medium text-foreground text-xs" title={q.label}>
                          {q.label}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {q.responseCount > 0 ? (
                          <Badge variant="outline" className="px-1 py-0 font-normal text-[10px]">
                            {q.responseCount} res
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 italic">0 res</span>
                        )}
                        {isChecked && (
                          <Badge
                            variant="secondary"
                            className="bg-primary/20 px-1 py-0 font-semibold text-[9px] text-primary"
                          >
                            Filtered
                          </Badge>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/80 italic leading-relaxed">
              💡 Selecting a question field adds it as a column and activates a dedicated dropdown filter in the
              toolbar.
            </p>
          </div>
        )}

        {/* Tab Content: Standard Columns */}
        {activeTab === "standard" && (
          <div className="flex flex-col gap-2">
            <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border bg-muted/20 p-1.5 pr-1">
              {filteredStandard.map((col) => {
                const isChecked = col.locked ? true : Boolean(visibleStandardColumns[col.id]);
                const checkboxId = `col-std-${col.id}`;
                return (
                  <label
                    key={col.id}
                    htmlFor={checkboxId}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md p-1.5 text-xs transition-colors",
                      col.locked ? "cursor-default bg-muted/30 opacity-75" : "cursor-pointer hover:bg-muted/60",
                      isChecked ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Checkbox
                        id={checkboxId}
                        checked={isChecked}
                        disabled={col.locked}
                        onCheckedChange={() => {
                          if (!col.locked) onToggleStandardColumn(col.id);
                        }}
                        className="size-3.5"
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground text-xs">{col.label}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{col.description}</div>
                      </div>
                    </div>
                    {col.locked && (
                      <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9px]">
                        Required
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <Separator className="my-0.5" />

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetDefaults}
            className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            <span>Reset Defaults</span>
          </Button>

          <Button type="button" size="sm" onClick={() => setOpen(false)} className="h-6 px-3 font-medium text-[11px]">
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
