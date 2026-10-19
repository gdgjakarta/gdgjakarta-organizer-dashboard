"use client";

import { useRef, useState } from "react";

import Image from "next/image";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  ExternalLink,
  GripVertical,
  HardDrive,
  Image as ImageIcon,
  Link2,
  Loader2,
  Maximize2,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import {
  CHECKBOX_REQUIREMENT_OPTIONS,
  getCheckboxRequirement,
  isOtherOption,
  isTermsOrConsentQuestion,
  VALIDATION_TYPE_OPTIONS,
} from "@/lib/events/question-validator";
import { REGISTRATION_SECTIONS } from "@/lib/events/registration-defaults";
import type { CheckboxRequirementRule, CustomQuestion, QuestionValidationType } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

const INPUT_TYPE_LABELS: Record<CustomQuestion["type"], string> = {
  text: "Short Text",
  textarea: "Paragraph",
  select: "Dropdown",
  radio: "Single Choice",
  multiselect: "Multi-select",
  checkbox: "Agreement Checkbox",
  media: "Media / File Upload",
};

interface SortableQuestionCardProps {
  question: CustomQuestion;
  index: number;
  totalQuestions: number;
  eventName?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onUpdate: (id: string, updates: Partial<CustomQuestion>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export function SortableQuestionCard({
  question: q,
  index,
  totalQuestions,
  eventName = "event",
  isExpanded: isExpandedProp,
  onToggleExpand,
  onUpdate,
  onRemove,
  onDuplicate,
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

  const isLocked = Boolean(q.locked) || Boolean(q.is_payment_required_field) || q.section === "Payment Details";

  // Card expansion state (supports controlled via prop or internal fallback)
  const [internalExpanded, setInternalExpanded] = useState(true);
  const isExpanded = isExpandedProp ?? internalExpanded;

  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  // Sub-panel collapse states for helpers & advanced settings
  const [isImageOpen, setIsImageOpen] = useState(() => Boolean(q.helper_image_url));
  const [isLinkOpen, setIsLinkOpen] = useState(() => Boolean(q.helper_link_url));
  const [isTypeSettingsOpen, setIsTypeSettingsOpen] = useState(() => {
    if (q.type === "media") return true;
    if (["text", "textarea"].includes(q.type)) {
      return (
        Boolean(q.validation_type && q.validation_type !== "none") || Boolean(q.min_length) || Boolean(q.max_length)
      );
    }
    if (["checkbox", "multiselect"].includes(q.type)) {
      return Boolean(q.checkbox_requirement && q.checkbox_requirement !== "at_least_one") || Boolean(q.min_selected);
    }
    return false;
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [optionsDraft, setOptionsDraft] = useState("");
  const [isUploadingHelper, setIsUploadingHelper] = useState(false);
  const helperFileInputRef = useRef<HTMLInputElement | null>(null as unknown as HTMLInputElement);

  const handleUploadHelperImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please provide an image file (PNG, JPG, WebP, etc.).");
      return;
    }
    setIsUploadingHelper(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventName", eventName ?? "event");
      formData.append("maxSizeMb", "10");

      const res = await fetch("/api/events/upload-question-media", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as { success?: boolean; url?: string; error?: string };
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error ?? "Failed to upload helper image");
      }

      onUpdate(q.id, { helper_image_url: data.url, image_url: data.url });
      setIsImageOpen(true);
      toast.success("Image helper attached from clipboard successfully!");
    } catch (err) {
      console.error("[Helper Image Upload] Failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to upload image";
      toast.error(msg);
    } finally {
      setIsUploadingHelper(false);
      if (helperFileInputRef.current) {
        helperFileInputRef.current.value = "";
      }
    }
  };

  const handlePasteHelperFromClipboard = async () => {
    if (isUploadingHelper) return;
    try {
      if (!navigator.clipboard?.read) {
        toast.info("Please focus on this question and press Cmd+V / Ctrl+V to paste your clipboard image.");
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      let foundImage = false;
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          foundImage = true;
          const blob = await item.getType(imageType);
          const ext = imageType.split("/")[1] || "png";
          const file = new File([blob], `question-helper-${Date.now()}.${ext}`, { type: imageType });
          await handleUploadHelperImage(file);
          break;
        }
      }
      if (!foundImage) {
        toast.error("No image found in clipboard. Please copy a screenshot or image first.");
      }
    } catch (err) {
      console.warn("Clipboard access:", err);
      toast.info("Clipboard access restricted. Press Cmd+V / Ctrl+V to paste your copied image.");
    }
  };

  const handlePasteLinkFromClipboard = async () => {
    if (isLocked) return;
    try {
      if (!navigator.clipboard?.readText) {
        toast.info("Please paste the link directly into the URL input.");
        return;
      }
      const text = await navigator.clipboard.readText();
      const trimmed = text?.trim();
      if (!trimmed) {
        toast.error("Clipboard is empty.");
        return;
      }

      let url = trimmed;
      if (!/^https?:\/\//i.test(url)) {
        if (url.startsWith("www.") || url.includes(".")) {
          url = `https://${url}`;
        } else {
          toast.error("Clipboard does not contain a valid web URL.");
          return;
        }
      }

      onUpdate(q.id, { helper_link_url: url });
      setIsLinkOpen(true);
      toast.success("Reference link pasted from clipboard!");
    } catch (err) {
      console.warn("Clipboard access:", err);
      toast.info("Clipboard access restricted. Please paste the link directly into the URL input.");
    }
  };

  const handleCardPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        e.stopPropagation();
        const file = item.getAsFile();
        if (file) {
          void handleUploadHelperImage(file);
        }
        return;
      }
    }
  };

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

  const hasTypeSettings = ["media", "text", "textarea", "checkbox", "multiselect"].includes(q.type);

  const getCheckboxSummary = () => {
    if (q.checkbox_requirement === "all" || (!q.checkbox_requirement && isTermsOrConsentQuestion(q))) {
      return "All Required";
    }
    if (q.checkbox_requirement === "min_count") {
      return `Min ${q.min_selected ?? 2} Options`;
    }
    return "At Least 1 Option";
  };

  return (
    <div
      ref={ref}
      onPaste={handleCardPaste}
      className={cn(
        "flex flex-col rounded-xl border bg-card transition-all",
        isExpanded
          ? "gap-3.5 border-border p-4 shadow-xs"
          : "gap-0 border-border/80 p-3 shadow-2xs hover:border-border hover:bg-muted/10",
        isDragging &&
          "relative z-30 scale-[1.008] border-primary bg-primary/5 opacity-80 shadow-md ring-2 ring-primary/40",
      )}
    >
      {/* ── Question Header (Collapsible Trigger Row) ── */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-t-lg transition-colors",
          isExpanded ? "border-b border-border/60 pb-3" : "py-0.5",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Draggable Handle */}
          <button
            type="button"
            ref={handleRef}
            className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            title="Drag to reorder question"
            aria-label={`Drag to reorder question ${index + 1}`}
          >
            <GripVertical className="size-4" />
          </button>

          {/* Collapsible Trigger for Title & Badges */}
          <button
            type="button"
            onClick={handleToggleExpand}
            className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-2 rounded p-0.5 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="shrink-0 font-semibold text-muted-foreground text-xs uppercase">#{index + 1}</span>

            {/* Question Label Summary */}
            <span
              className={cn(
                "max-w-[140px] truncate text-xs sm:max-w-[260px] md:max-w-[360px]",
                q.label.trim() ? "font-semibold text-foreground" : "italic text-muted-foreground",
              )}
              title={q.label || "Untitled Question"}
            >
              {q.label.trim() || "Untitled Question"}
            </span>

            {isLocked ? (
              <Badge
                variant="outline"
                className="shrink-0 border-amber-300 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
              >
                Payment Details (Locked)
              </Badge>
            ) : (
              q.section && (
                <Badge
                  variant="outline"
                  className="hidden shrink-0 text-[10px] md:inline-flex"
                  title={`Section: ${q.section}`}
                >
                  <span className="max-w-[160px] truncate">{q.section}</span>
                </Badge>
              )
            )}

            <Badge variant="secondary" className="hidden shrink-0 text-[10px] sm:inline-flex">
              {INPUT_TYPE_LABELS[q.type] || q.type}
            </Badge>

            {q.required && !isLocked && (
              <Badge
                variant="secondary"
                className="h-4 shrink-0 px-1 font-medium text-[9px] text-amber-600 dark:text-amber-400"
              >
                Required
              </Badge>
            )}

            {q.helper_image_url && (
              <Badge
                variant="outline"
                className="hidden shrink-0 gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 lg:inline-flex dark:text-emerald-400"
              >
                <ImageIcon className="size-3" />
                <span>Image</span>
              </Badge>
            )}

            {q.helper_link_url && (
              <Badge
                variant="outline"
                className="hidden shrink-0 gap-1 border-primary/30 bg-primary/10 text-[10px] text-primary lg:inline-flex"
              >
                <Link2 className="size-3" />
                <span>Link</span>
              </Badge>
            )}
          </button>
        </div>

        {/* Action Controls: Move Up, Move Down, Duplicate, Delete, Expand/Collapse */}
        <div className="flex shrink-0 items-center gap-0.5">
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
            className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            onClick={() => onDuplicate(q.id)}
            disabled={isLocked}
            title={isLocked ? "Payment Details fields cannot be duplicated" : "Duplicate question"}
            aria-label="Duplicate question"
          >
            <Copy className="size-3.5" />
          </Button>

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
            onClick={() => onRemove(q.id)}
            disabled={isLocked}
            title={isLocked ? "Payment Details fields cannot be removed" : "Delete question"}
            aria-label="Delete question"
          >
            <Trash2 className="size-3.5" />
          </Button>

          <div className="mx-1 h-4 w-px bg-border/60" />

          {/* Expand / Collapse Button */}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={cn(
              "size-7 transition-colors",
              isExpanded ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={handleToggleExpand}
            title={isExpanded ? "Collapse question" : "Expand question"}
            aria-label={isExpanded ? "Collapse question" : "Expand question"}
          >
            <ChevronDown className={cn("size-4 transition-transform duration-200", isExpanded && "rotate-180")} />
          </Button>
        </div>
      </div>

      {/* ── Question Body (Rendered only when expanded) ── */}
      {isExpanded && (
        <div className="space-y-4 pt-1">
          {isLocked && (
            <div className="rounded border border-amber-300/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-800 dark:text-amber-300">
              Required Payment Details question for attendee ticketing and DOKU invoicing. Cannot be changed or removed.
            </div>
          )}

          {/* 1. Core Question Fields */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <Field>
                <FieldLabel className="text-xs">Question Label *</FieldLabel>
                <Input
                  placeholder="e.g. Primary Tech Stack or Project Idea"
                  value={q.label}
                  disabled={isLocked}
                  onChange={(e) => onUpdate(q.id, { label: e.target.value })}
                />
              </Field>
            </div>

            <div className="md:col-span-3">
              <Field>
                <FieldLabel className="text-xs">Section Group</FieldLabel>
                <Select
                  value={q.section ?? "Payment Details"}
                  disabled={isLocked}
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
                <Select
                  value={q.type}
                  disabled={isLocked}
                  onValueChange={(val: CustomQuestion["type"]) => onUpdate(q.id, { type: val })}
                >
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
                    <SelectItem value="media">Media / File Upload</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-2 md:col-span-2">
              <label
                htmlFor={`required-${q.id}`}
                className={cn(
                  "flex items-center gap-2 font-medium text-xs",
                  isLocked ? "cursor-not-allowed opacity-80" : "cursor-pointer",
                )}
              >
                <Checkbox
                  id={`required-${q.id}`}
                  checked={isLocked ? true : q.required}
                  disabled={isLocked}
                  onCheckedChange={(checked) => onUpdate(q.id, { required: Boolean(checked) })}
                />
                Required
              </label>
              {["checkbox", "multiselect"].includes(q.type) && q.required && (
                <Badge variant="outline" className="font-normal text-[10px] text-muted-foreground">
                  {(() => {
                    const req = getCheckboxRequirement(q);
                    if (req.rule === "all") return "All Options Required";
                    if (req.rule === "min_count") return `Min ${req.minSelected} Options`;
                    return "At Least 1 Option";
                  })()}
                </Badge>
              )}
            </div>
          </div>

          {/* 2. Secondary Question Inputs: Description & Options */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field>
              <FieldLabel className="text-xs">Help Text / Description (Optional)</FieldLabel>
              <Input
                placeholder="Guidance shown beneath the question"
                value={q.description ?? ""}
                disabled={isLocked}
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
                    className="pr-8 text-xs"
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
                        className="flex cursor-pointer select-none items-center gap-2 font-normal text-muted-foreground text-xs hover:text-foreground"
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
                        Expand and edit long options or clauses comfortably. Enter each option on a new line or separate
                        by commas.
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
                            <span>+ Add &quot;Other&quot;</span>
                          </Button>
                        )}
                      </div>

                      <Textarea
                        rows={8}
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                        value={optionsDraft}
                        onChange={(e) => setOptionsDraft(e.target.value)}
                        className="font-mono text-xs leading-relaxed"
                      />

                      <div className="rounded border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                        <div className="flex items-center justify-between pb-1 font-medium text-foreground">
                          <span>Live Preview ({parsedPreviewOptions.length} options)</span>
                          <span className="text-[10px]">One option per line or separated by commas</span>
                        </div>
                        {parsedPreviewOptions.length === 0 ? (
                          <span className="italic">No options entered yet</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {parsedPreviewOptions.map((opt) => (
                              <Badge key={opt} variant="outline" className="font-normal text-[10px]">
                                {opt}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
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

          {/* 3. Unified Additional Configurations & Helpers (Replaces clutter of multiple nested boxes) */}
          <div className="mt-1 overflow-hidden rounded-lg border border-border/70 bg-muted/15 divide-y divide-border/50">
            {/* ── Sub-panel A: Visual Guide (Screenshot / Reference Image) ── */}
            <div>
              <button
                type="button"
                onClick={() => setIsImageOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-3.5 text-primary" />
                  <span className="font-medium text-foreground text-xs">Visual Guide / Image Helper</span>
                </div>
                <div className="flex items-center gap-2">
                  {q.helper_image_url ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 font-normal text-[10px] text-emerald-600 dark:text-emerald-400"
                    >
                      Image Attached
                    </Badge>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Optional</span>
                  )}
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform duration-200",
                      isImageOpen && "rotate-180",
                    )}
                  />
                </div>
              </button>

              {isImageOpen && (
                <div className="space-y-2.5 bg-background/50 p-3.5 pt-1">
                  {q.helper_image_url ? (
                    <div className="flex flex-col justify-between gap-3 rounded-md border border-border/60 bg-card p-2.5 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted/40">
                          <Image
                            src={q.helper_image_url}
                            alt="Question visual guide"
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium font-mono text-foreground text-xs">
                            {q.helper_image_url.split("/").pop() ?? "helper-image.png"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Shown as reference visual guide for respondents filling this question.
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          asChild
                          title="Open helper image in new tab"
                        >
                          <a href={q.helper_image_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-3.5" />
                          </a>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="h-7 gap-1 text-xs"
                          disabled={isUploadingHelper}
                          onClick={handlePasteHelperFromClipboard}
                          title="Paste another image from clipboard"
                        >
                          {isUploadingHelper ? (
                            <Loader2 className="size-3 animate-spin text-primary" />
                          ) : (
                            <Clipboard className="size-3" />
                          )}
                          <span>Paste New</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => onUpdate(q.id, { helper_image_url: undefined, image_url: undefined })}
                          title="Remove helper image"
                          aria-label="Remove helper image"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-between gap-2 rounded-md border border-border/80 border-dashed bg-background/50 p-2.5 text-muted-foreground text-xs sm:flex-row sm:items-center">
                      <div className="flex min-w-0 items-center gap-2">
                        <Clipboard className="size-3.5 shrink-0 text-primary" />
                        <span className="text-[11px]">
                          Copy any screenshot and press{" "}
                          <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Cmd+V</kbd> /{" "}
                          <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl+V</kbd> to
                          paste
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <input
                          ref={helperFileInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleUploadHelperImage(file);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="h-7 gap-1 text-xs"
                          disabled={isUploadingHelper}
                          onClick={handlePasteHelperFromClipboard}
                          title="Paste image directly from clipboard"
                        >
                          {isUploadingHelper ? (
                            <Loader2 className="size-3 animate-spin text-primary" />
                          ) : (
                            <Clipboard className="size-3" />
                          )}
                          <span>Paste from Clipboard</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="h-7 text-muted-foreground text-xs hover:text-foreground"
                          disabled={isUploadingHelper}
                          onClick={() => helperFileInputRef.current?.click()}
                          title="Upload image file"
                        >
                          Browse...
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Sub-panel B: Reference Link / Documentation ── */}
            <div>
              <button
                type="button"
                onClick={() => setIsLinkOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-2">
                  <Link2 className="size-3.5 text-primary" />
                  <span className="font-medium text-foreground text-xs">Reference URL / External Guide</span>
                </div>
                <div className="flex items-center gap-2">
                  {q.helper_link_url ? (
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 font-normal text-[10px] text-primary"
                    >
                      Link Configured
                    </Badge>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Optional</span>
                  )}
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform duration-200",
                      isLinkOpen && "rotate-180",
                    )}
                  />
                </div>
              </button>

              {isLinkOpen && (
                <div className="space-y-2.5 bg-background/50 p-3.5 pt-1">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                    <div className="sm:col-span-7">
                      <Field>
                        <FieldLabel className="text-xs">Reference URL</FieldLabel>
                        <div className="relative flex items-center">
                          <Link2 className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
                          <Input
                            type="url"
                            placeholder="https://example.com/guidelines-or-docs"
                            value={q.helper_link_url ?? ""}
                            disabled={isLocked}
                            onChange={(e) => onUpdate(q.id, { helper_link_url: e.target.value })}
                            className="h-8 pl-8 text-xs"
                          />
                        </div>
                      </Field>
                    </div>

                    <div className="sm:col-span-5">
                      <Field>
                        <FieldLabel className="text-xs">Link Label / Title (Optional)</FieldLabel>
                        <div className="flex items-center gap-1.5">
                          <Input
                            placeholder="e.g. View Guidelines (Default: Reference Link)"
                            value={q.helper_link_label ?? ""}
                            disabled={isLocked}
                            onChange={(e) => onUpdate(q.id, { helper_link_label: e.target.value })}
                            className="h-8 text-xs"
                          />
                          {q.helper_link_url && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                                asChild
                                title="Test open link in new tab"
                              >
                                <a
                                  href={
                                    q.helper_link_url.startsWith("http://") || q.helper_link_url.startsWith("https://")
                                      ? q.helper_link_url
                                      : `https://${q.helper_link_url}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="size-3.5" />
                                </a>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                disabled={isLocked}
                                onClick={() =>
                                  onUpdate(q.id, { helper_link_url: undefined, helper_link_label: undefined })
                                }
                                title="Remove helper link"
                                aria-label="Remove helper link"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </Field>
                    </div>
                  </div>

                  {q.helper_link_url ? (
                    <div className="flex items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
                      <span>Preview for respondents:</span>
                      <a
                        href={
                          q.helper_link_url.startsWith("http://") || q.helper_link_url.startsWith("https://")
                            ? q.helper_link_url
                            : `https://${q.helper_link_url}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        <span>{q.helper_link_label?.trim() || "Reference Link"}</span>
                      </a>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-between gap-2 rounded-md border border-border/60 border-dashed bg-background/50 px-2.5 py-1.5 sm:flex-row sm:items-center">
                      <span className="text-[11px] text-muted-foreground">
                        Provide an external reference, documentation, or tutorial link for respondents filling this
                        question.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="h-6 shrink-0 gap-1 text-[11px]"
                        disabled={isLocked}
                        onClick={handlePasteLinkFromClipboard}
                        title="Paste URL from clipboard"
                      >
                        <Clipboard className="size-3" />
                        <span>Paste URL</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Sub-panel C: Input-Type Specific Settings ── */}
            {hasTypeSettings && (
              <div>
                {/* 1. Media Upload Settings */}
                {q.type === "media" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsTypeSettingsOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2">
                        <UploadCloud className="size-3.5 text-primary" />
                        <span className="font-medium text-foreground text-xs">Media Upload Settings</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          Max {q.max_file_size_mb ?? 10} MB{q.allowed_file_types ? ` • ${q.allowed_file_types}` : ""}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-muted-foreground transition-transform duration-200",
                            isTypeSettingsOpen && "rotate-180",
                          )}
                        />
                      </div>
                    </button>

                    {isTypeSettingsOpen && (
                      <div className="space-y-3 bg-background/50 p-3.5 pt-1">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field>
                            <FieldLabel className="text-xs">Max File Size (MB)</FieldLabel>
                            <Input
                              type="number"
                              min="1"
                              max="50"
                              placeholder="10"
                              value={q.max_file_size_mb !== undefined ? String(q.max_file_size_mb) : "10"}
                              onChange={(e) =>
                                onUpdate(q.id, {
                                  max_file_size_mb: e.target.value
                                    ? Math.max(1, Math.min(Number(e.target.value), 50))
                                    : 10,
                                })
                              }
                              className="h-8 text-xs"
                            />
                            <p className="pt-0.5 text-[10px] text-muted-foreground">
                              Maximum file size allowed per submission (1 to 50 MB, default: 10 MB).
                            </p>
                          </Field>

                          <Field>
                            <FieldLabel className="text-xs">Allowed File Formats (Optional)</FieldLabel>
                            <Input
                              placeholder="e.g. image/*, application/pdf, .png, .jpg"
                              value={q.allowed_file_types ?? ""}
                              onChange={(e) => onUpdate(q.id, { allowed_file_types: e.target.value })}
                              className="h-8 text-xs"
                            />
                            <p className="pt-0.5 text-[10px] text-muted-foreground">
                              Leave blank to allow any media format. Use standard MIME types or comma-separated
                              extensions.
                            </p>
                          </Field>
                        </div>

                        <Field>
                          <FieldLabel className="text-xs">Custom Error Message (Optional)</FieldLabel>
                          <Input
                            placeholder="e.g. Please upload your ID card or certificate photo"
                            value={q.custom_error_message ?? ""}
                            onChange={(e) => onUpdate(q.id, { custom_error_message: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </Field>

                        <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                          <HardDrive className="mt-0.5 size-3.5 shrink-0 text-primary" />
                          <div>
                            <span className="font-medium text-foreground">Storage Bucket Location: </span>
                            Uploaded media will be securely stored in bucket storage under{" "}
                            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">
                              temp/&lt;event-name&gt;/&lt;file-name&gt;-&lt;timestamp&gt;
                            </code>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 2. Text Validation & Character Constraints */}
                {["text", "textarea"].includes(q.type) && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsTypeSettingsOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="size-3.5 text-primary" />
                        <span className="font-medium text-foreground text-xs">
                          Validation &amp; Character Constraints
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {q.validation_type && q.validation_type !== "none"
                            ? VALIDATION_TYPE_OPTIONS.find((opt) => opt.value === q.validation_type)?.label ||
                              q.validation_type
                            : "Standard Text"}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-muted-foreground transition-transform duration-200",
                            isTypeSettingsOpen && "rotate-180",
                          )}
                        />
                      </div>
                    </button>

                    {isTypeSettingsOpen && (
                      <div className="space-y-3 bg-background/50 p-3.5 pt-1">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                          <Field className={q.validation_type === "customRegex" ? "" : "sm:col-span-2 md:col-span-1"}>
                            <FieldLabel className="text-xs">Validation Rule</FieldLabel>
                            <Select
                              value={q.validation_type ?? "none"}
                              onValueChange={(val: QuestionValidationType) => onUpdate(q.id, { validation_type: val })}
                            >
                              <SelectTrigger className="h-8 text-xs">
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

                          {q.validation_type === "customRegex" && (
                            <Field className="sm:col-span-2 md:col-span-2">
                              <FieldLabel className="text-xs">Custom Regex Pattern</FieldLabel>
                              <Input
                                placeholder="e.g. ^[A-Za-z0-9_-]{3,20}$"
                                value={q.regex_pattern ?? ""}
                                onChange={(e) => onUpdate(q.id, { regex_pattern: e.target.value })}
                                className="h-8 font-mono text-xs"
                              />
                            </Field>
                          )}

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
                              className="h-8 text-xs"
                            />
                          </Field>

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
                              className="h-8 text-xs"
                            />
                          </Field>
                        </div>

                        <Field>
                          <FieldLabel className="text-xs">Custom Error Message (Optional)</FieldLabel>
                          <Input
                            placeholder="Leave blank to generate friendly message automatically"
                            value={q.custom_error_message ?? ""}
                            onChange={(e) => onUpdate(q.id, { custom_error_message: e.target.value })}
                            className="h-8 text-xs"
                          />
                          <p className="pt-0.5 text-[10px] text-muted-foreground">
                            Leave blank if you want the app to generate intelligent, context-aware error messages by
                            default.
                          </p>
                        </Field>
                      </div>
                    )}
                  </>
                )}

                {/* 3. Checkbox Selection Rules */}
                {["checkbox", "multiselect"].includes(q.type) && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsTypeSettingsOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2">
                        <CheckSquare className="size-3.5 text-primary" />
                        <span className="font-medium text-foreground text-xs">Selection Rules &amp; Constraints</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{getCheckboxSummary()}</span>
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-muted-foreground transition-transform duration-200",
                            isTypeSettingsOpen && "rotate-180",
                          )}
                        />
                      </div>
                    </button>

                    {isTypeSettingsOpen && (
                      <div className="space-y-3 bg-background/50 p-3.5 pt-1">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                          <Field
                            className={q.checkbox_requirement === "min_count" ? "" : "sm:col-span-2 md:col-span-2"}
                          >
                            <FieldLabel className="text-xs">Required Selection Rule</FieldLabel>
                            <Select
                              value={q.checkbox_requirement ?? (isTermsOrConsentQuestion(q) ? "all" : "at_least_one")}
                              onValueChange={(val: CheckboxRequirementRule) =>
                                onUpdate(q.id, { checkbox_requirement: val })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CHECKBOX_REQUIREMENT_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="pt-0.5 text-[10px] text-muted-foreground">
                              {(() => {
                                if (
                                  q.checkbox_requirement === "all" ||
                                  (!q.checkbox_requirement && isTermsOrConsentQuestion(q))
                                ) {
                                  return "Respondent must check all options (ideal for Terms & Conditions and Code of Conduct).";
                                }
                                if (q.checkbox_requirement === "min_count") {
                                  return "Respondent must check at least the specified number of options (some of it).";
                                }
                                return "Respondent only needs to check at least one box to proceed.";
                              })()}
                            </p>
                          </Field>

                          {q.checkbox_requirement === "min_count" && (
                            <Field>
                              <FieldLabel className="text-xs">Min Options Required</FieldLabel>
                              <Input
                                type="number"
                                min="1"
                                max={q.options?.length ? String(q.options.length) : "10"}
                                placeholder="2"
                                value={q.min_selected !== undefined ? String(q.min_selected) : "2"}
                                onChange={(e) =>
                                  onUpdate(q.id, {
                                    min_selected: e.target.value ? Math.max(1, Number(e.target.value)) : 2,
                                  })
                                }
                                className="h-8 text-xs"
                              />
                              <p className="pt-0.5 text-[10px] text-muted-foreground">
                                Minimum number of checkboxes that must be selected.
                              </p>
                            </Field>
                          )}

                          <Field>
                            <FieldLabel className="text-xs">Max Options Allowed (Optional)</FieldLabel>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Leave blank for no limit"
                              value={q.max_selected !== undefined ? String(q.max_selected) : ""}
                              onChange={(e) =>
                                onUpdate(q.id, {
                                  max_selected: e.target.value ? Math.max(1, Number(e.target.value)) : undefined,
                                })
                              }
                              className="h-8 text-xs"
                            />
                            <p className="pt-0.5 text-[10px] text-muted-foreground">
                              Optional limit on maximum number of choices.
                            </p>
                          </Field>
                        </div>

                        <Field>
                          <FieldLabel className="text-xs">Custom Error Message (Optional)</FieldLabel>
                          <Input
                            placeholder="e.g. You must agree to all terms and community guidelines to continue"
                            value={q.custom_error_message ?? ""}
                            onChange={(e) => onUpdate(q.id, { custom_error_message: e.target.value })}
                            className="h-8 text-xs"
                          />
                          <p className="pt-0.5 text-[10px] text-muted-foreground">
                            Leave blank to automatically display intelligent progress messages.
                          </p>
                        </Field>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
