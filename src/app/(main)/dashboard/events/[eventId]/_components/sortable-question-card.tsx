"use client";

import { useState } from "react";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { ChevronDown, ChevronUp, GripVertical, Maximize2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isOtherOption, VALIDATION_TYPE_OPTIONS } from "@/lib/events/question-validator";
import { REGISTRATION_SECTIONS } from "@/lib/events/registration-defaults";
import type { CustomQuestion, QuestionValidationType } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface SortableQuestionCardProps {
  question: CustomQuestion;
  index: number;
  totalQuestions: number;
  onUpdate: (id: string, updates: Partial<CustomQuestion>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export function SortableQuestionCard({
  question: q,
  index,
  totalQuestions,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: SortableQuestionCardProps) {
  const { handleRef, isDragging, ref } = useSortable({
    id: q.id,
    index,
    type: "question",
    accept: "question",
    group: "questions",
    modifiers: [RestrictToVerticalAxis],
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [optionsDraft, setOptionsDraft] = useState("");

  const handleOpenDialog = () => {
    setOptionsDraft(q.options && q.options.length > 0 ? q.options.join("\n") : "");
    setIsDialogOpen(true);
  };

  const handleSaveDialogOptions = () => {
    const delimiter = optionsDraft.includes("\n") ? "\n" : ",";
    const parsed = optionsDraft
      .split(delimiter)
      .map((item) => item.trim())
      .filter(Boolean);

    onUpdate(q.id, { options: parsed });
    setIsDialogOpen(false);
  };

  const parsedPreviewOptions = optionsDraft
    .split(optionsDraft.includes("\n") ? "\n" : ",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-2xs transition-all",
        isDragging &&
          "relative z-30 scale-[1.008] border-primary bg-primary/5 opacity-80 shadow-md ring-2 ring-primary/40",
      )}
    >
      {/* Question Header: Drag Handle, Title, Move Up/Down, Delete */}
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          {/* Draggable Handle */}
          <Button
            ref={handleRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 cursor-grab text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            title="Drag to reorder question"
            aria-label={`Drag to reorder question ${index + 1}`}
          >
            <GripVertical className="size-4" />
          </Button>

          <span className="font-semibold text-muted-foreground text-xs uppercase">Question #{index + 1}</span>

          {q.section && (
            <Badge variant="outline" className="text-[10px]">
              {q.section}
            </Badge>
          )}

          {q.required && (
            <Badge variant="secondary" className="h-4 px-1 font-medium text-[9px] text-amber-600 dark:text-amber-400">
              Required
            </Badge>
          )}
        </div>

        {/* Action Controls: Move Up, Move Down, Delete */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25"
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            title="Move question up"
            aria-label="Move question up"
          >
            <ChevronUp className="size-3.5" />
          </Button>

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25"
            onClick={() => onMoveDown(index)}
            disabled={index === totalQuestions - 1}
            title="Move question down"
            aria-label="Move question down"
          >
            <ChevronDown className="size-3.5" />
          </Button>

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(q.id)}
            title="Delete question"
            aria-label="Delete question"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Question Fields */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-5">
          <Field>
            <FieldLabel className="text-xs">Question Label *</FieldLabel>
            <Input
              placeholder="e.g. Primary Tech Stack or Project Idea"
              value={q.label}
              onChange={(e) => onUpdate(q.id, { label: e.target.value })}
            />
          </Field>
        </div>

        <div className="md:col-span-3">
          <Field>
            <FieldLabel className="text-xs">Section Group</FieldLabel>
            <Select
              value={q.section ?? "Additional Information"}
              onValueChange={(val) => onUpdate(q.id, { section: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGISTRATION_SECTIONS.map((sec) => (
                  <SelectItem key={sec} value={sec}>
                    {sec}
                  </SelectItem>
                ))}
                <SelectItem value="Additional Information">Additional Information</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field>
            <FieldLabel className="text-xs">Input Type</FieldLabel>
            <Select value={q.type} onValueChange={(val: CustomQuestion["type"]) => onUpdate(q.id, { type: val })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Short Text</SelectItem>
                <SelectItem value="textarea">Paragraph</SelectItem>
                <SelectItem value="select">Dropdown</SelectItem>
                <SelectItem value="radio">Single Choice</SelectItem>
                <SelectItem value="multiselect">Multi-select</SelectItem>
                <SelectItem value="checkbox">Agreement Checkbox</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex items-end pb-2 md:col-span-2">
          <label htmlFor={`required-${q.id}`} className="flex cursor-pointer items-center gap-2 font-medium text-xs">
            <Checkbox
              id={`required-${q.id}`}
              checked={q.required}
              onCheckedChange={(checked) => onUpdate(q.id, { required: Boolean(checked) })}
            />
            Required
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field>
          <FieldLabel className="text-xs">Help Text / Description (Optional)</FieldLabel>
          <Input
            placeholder="Guidance shown beneath the question"
            value={q.description ?? ""}
            onChange={(e) => onUpdate(q.id, { description: e.target.value })}
          />
        </Field>

        {["select", "radio", "multiselect", "checkbox"].includes(q.type) && (
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel className="text-xs">Options (Comma separated)</FieldLabel>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={handleOpenDialog}
                title="Expand options in popup dialog"
                aria-label="Expand options in popup dialog"
              >
                <Maximize2 className="size-3" />
                <span>Expand Editor</span>
              </Button>
            </div>
            <div className="relative flex items-center">
              <Input
                placeholder="Option 1, Option 2, Option 3"
                value={q.options?.join(", ") ?? ""}
                onChange={(e) =>
                  onUpdate(q.id, {
                    options: e.target.value
                      .split(",")
                      .map((o) => o.trim())
                      .filter(Boolean),
                  })
                }
                className="pr-8"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute right-1 size-6 text-muted-foreground hover:text-foreground"
                onClick={handleOpenDialog}
                title="Expand options in popup dialog"
                aria-label="Expand options in popup dialog"
              >
                <Maximize2 className="size-3.5" />
              </Button>
            </div>

            {/* Other option toggle & settings for Single Choice, Dropdown, and Multi-select */}
            {["radio", "select", "multiselect"].includes(q.type) && (
              <div className="space-y-1.5 pt-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor={`allow-other-${q.id}`}
                    className="flex cursor-pointer items-center gap-2 font-normal text-xs text-muted-foreground select-none hover:text-foreground"
                  >
                    <Checkbox
                      id={`allow-other-${q.id}`}
                      checked={q.allow_other === true || (q.options?.some(isOtherOption) ?? false)}
                      onCheckedChange={(checked) => {
                        const isChecked = Boolean(checked);
                        if (isChecked) {
                          const hasOther = q.options?.some(isOtherOption);
                          const updatedOptions = hasOther ? q.options : [...(q.options ?? []), "Other"];
                          onUpdate(q.id, { allow_other: true, options: updatedOptions });
                        } else {
                          const filteredOptions = q.options?.filter((opt) => !isOtherOption(opt));
                          onUpdate(q.id, { allow_other: false, options: filteredOptions });
                        }
                      }}
                    />
                    <span>Allow &quot;Other&quot; option with custom text input</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground">Like Google Forms</span>
                </div>

                {(q.allow_other === true || (q.options?.some(isOtherOption) ?? false)) && (
                  <Input
                    placeholder="Custom placeholder for 'Other' input (optional, e.g. Please specify...)"
                    value={q.other_placeholder ?? ""}
                    onChange={(e) => onUpdate(q.id, { other_placeholder: e.target.value })}
                    className="h-7 text-xs"
                  />
                )}
              </div>
            )}

            {/* Popup Dialog for Expanded Options Editing */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-base">
                    Edit Options for {q.label ? `"${q.label}"` : `Question #${index + 1}`}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Expand and edit long options or clauses comfortably. Enter each option on a new line or separate by
                    commas.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground text-xs">Options List</span>
                    {["radio", "select", "multiselect"].includes(q.type) && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        className="h-6 gap-1 text-[11px]"
                        onClick={() => {
                          const delimiter = optionsDraft.includes("\n") ? "\n" : ",";
                          const lines = optionsDraft.split(delimiter);
                          if (!lines.some(isOtherOption)) {
                            setOptionsDraft((prev) => (prev.trim() ? `${prev.trim()}\nOther` : "Other"));
                          }
                        }}
                      >
                        + Add &quot;Other&quot; option
                      </Button>
                    )}
                  </div>

                  <Textarea
                    rows={6}
                    className="min-h-[140px] font-mono text-xs leading-relaxed"
                    placeholder="Enter options (one per line or comma separated)..."
                    value={optionsDraft}
                    onChange={(e) => setOptionsDraft(e.target.value)}
                  />

                  {parsedPreviewOptions.length > 0 && (
                    <div className="space-y-1.5 rounded-md border bg-muted/30 p-2.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-medium">Parsed Choices Preview:</span>
                        <span>
                          {parsedPreviewOptions.length} choice{parsedPreviewOptions.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="max-h-36 space-y-1 overflow-y-auto">
                        {parsedPreviewOptions.map((opt, i) => (
                          <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: Preview list order represents line indices
                            key={`${i}-${opt}`}
                            className="flex items-start gap-1.5 rounded border bg-background px-2 py-1 text-foreground text-xs"
                          >
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{i + 1}.</span>
                            <span className="break-words leading-snug">{opt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleSaveDialogOptions}>
                    Apply Options
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Field>
        )}
      </div>

      {/* Validation & Constraints for Text & Paragraph inputs */}
      {["text", "textarea"].includes(q.type) && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center justify-between border-b pb-1.5">
            <span className="font-medium text-foreground text-xs">Validation & Constraints</span>
            <span className="text-[10px] text-muted-foreground">
              Enforce format, character limits, and error message
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {/* Validation Rule Dropdown */}
            <Field className={q.validation_type === "customRegex" ? "" : "sm:col-span-2 md:col-span-1"}>
              <FieldLabel className="text-xs">Validation Rule</FieldLabel>
              <Select
                value={q.validation_type ?? "none"}
                onValueChange={(val: QuestionValidationType) => onUpdate(q.id, { validation_type: val })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALIDATION_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Custom Regex Pattern input */}
            {q.validation_type === "customRegex" && (
              <Field className="sm:col-span-2 md:col-span-2">
                <FieldLabel className="text-xs">Custom Regex Pattern</FieldLabel>
                <Input
                  placeholder="e.g. ^[A-Za-z0-9_-]{3,20}$"
                  value={q.regex_pattern ?? ""}
                  onChange={(e) => onUpdate(q.id, { regex_pattern: e.target.value })}
                  className="font-mono text-xs"
                />
              </Field>
            )}

            {/* Minimum Characters */}
            <Field>
              <FieldLabel className="text-xs">Min Characters</FieldLabel>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 5"
                value={q.min_length !== undefined ? String(q.min_length) : ""}
                onChange={(e) =>
                  onUpdate(q.id, {
                    min_length: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </Field>

            {/* Maximum Characters */}
            <Field>
              <FieldLabel className="text-xs">Max Characters</FieldLabel>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 100"
                value={q.max_length !== undefined ? String(q.max_length) : ""}
                onChange={(e) =>
                  onUpdate(q.id, {
                    max_length: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </Field>
          </div>

          {/* Custom Error Message */}
          <Field>
            <FieldLabel className="text-xs">Custom Error Message (Optional)</FieldLabel>
            <Input
              placeholder="Leave blank to generate friendly message automatically"
              value={q.custom_error_message ?? ""}
              onChange={(e) => onUpdate(q.id, { custom_error_message: e.target.value })}
            />
            <p className="pt-0.5 text-[10px] text-muted-foreground">
              Leave blank if you want the app to generate intelligent, context-aware error messages by default.
            </p>
          </Field>
        </div>
      )}
    </div>
  );
}
