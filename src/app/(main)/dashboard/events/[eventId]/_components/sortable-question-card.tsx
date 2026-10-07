"use client";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VALIDATION_TYPE_OPTIONS } from "@/lib/events/question-validator";
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
            <FieldLabel className="text-xs">Options (Comma separated)</FieldLabel>
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
            />
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
