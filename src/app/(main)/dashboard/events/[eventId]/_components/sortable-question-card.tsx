"use client";

import { useRef, useState } from "react";

import Image from "next/image";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import {
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
import { isOtherOption, VALIDATION_TYPE_OPTIONS } from "@/lib/events/question-validator";
import { REGISTRATION_SECTIONS } from "@/lib/events/registration-defaults";
import type { CustomQuestion, QuestionValidationType } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface SortableQuestionCardProps {
  question: CustomQuestion;
  index: number;
  totalQuestions: number;
  eventName?: string;
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

  return (
    <div
      ref={ref}
      onPaste={handleCardPaste}
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

          {isLocked ? (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
            >
              Payment Details (Locked)
            </Badge>
          ) : (
            q.section && (
              <Badge variant="outline" className="text-[10px]">
                {q.section}
              </Badge>
            )
          )}

          {q.required && !isLocked && (
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
        </div>
      </div>

      {isLocked && (
        <div className="rounded border border-amber-300/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-800 dark:text-amber-300">
          Required Payment Details question for attendee ticketing and DOKU invoicing. Cannot be changed or removed.
        </div>
      )}

      {/* Main Question Fields */}
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

        <div className="flex items-end pb-2 md:col-span-2">
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
        </div>
      </div>

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

      {/* Image Helper (Visual Guide / Screenshot Attached from Clipboard) */}
      <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
            <ImageIcon className="size-3.5 text-primary" />
            <span>Image Helper (Visual Guide / Screenshot)</span>
          </div>
          {q.helper_image_url && (
            <Badge variant="outline" className="border-primary/20 bg-primary/10 font-normal text-[10px] text-primary">
              Image Attached
            </Badge>
          )}
        </div>

        {q.helper_image_url ? (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded border bg-muted/40">
                <Image
                  src={q.helper_image_url}
                  alt="Question helper visual guide"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="48px"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground text-xs">
                  {q.helper_image_url.split("/").pop() ?? "Helper image"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Shown as reference visual guide for respondents filling this question
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
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
          <div className="flex flex-col justify-between gap-2 rounded-md border border-border/80 border-dashed bg-background/50 p-2.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                <Clipboard className="size-3.5" />
              </div>
              <div className="min-w-0 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Attach visual guideline: </span>
                <span>
                  Copy any screenshot and press{" "}
                  <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Cmd+V</kbd> /{" "}
                  <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl+V</kbd>
                </span>
              </div>
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

      {/* Link Helper (Reference Link / External Documentation) */}
      <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
            <Link2 className="size-3.5 text-primary" />
            <span>Link Helper (Reference URL / External Guide)</span>
          </div>
          {q.helper_link_url && (
            <Badge variant="outline" className="border-primary/20 bg-primary/10 font-normal text-[10px] text-primary">
              Link Configured
            </Badge>
          )}
        </div>

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
                      onClick={() => onUpdate(q.id, { helper_link_url: undefined, helper_link_label: undefined })}
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
              Provide an external reference, documentation, or tutorial link for respondents filling this question.
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

      {/* Media Upload Settings */}
      {q.type === "media" && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center justify-between border-b pb-1.5">
            <div className="flex items-center gap-2">
              <UploadCloud className="size-4 text-primary" />
              <span className="font-medium text-foreground text-xs">Media Upload Settings</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Configurable maximum file size &amp; file formats</span>
          </div>

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
                    max_file_size_mb: e.target.value ? Math.max(1, Math.min(Number(e.target.value), 50)) : 10,
                  })
                }
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
              />
              <p className="pt-0.5 text-[10px] text-muted-foreground">
                Leave blank to allow any media format. Use standard MIME types or comma-separated extensions.
              </p>
            </Field>
          </div>

          {/* Custom Error Message */}
          <Field>
            <FieldLabel className="text-xs">Custom Error Message (Optional)</FieldLabel>
            <Input
              placeholder="e.g. Please upload your ID card or certificate photo"
              value={q.custom_error_message ?? ""}
              onChange={(e) => onUpdate(q.id, { custom_error_message: e.target.value })}
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
    </div>
  );
}
