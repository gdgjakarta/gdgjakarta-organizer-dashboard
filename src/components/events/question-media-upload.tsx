"use client";

import { useId, useRef, useState } from "react";

import Image from "next/image";

import { AlertCircle, CheckCircle2, Clipboard, ExternalLink, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/r2/utils";
import { cn } from "@/lib/utils";

interface QuestionMediaUploadProps {
  id?: string;
  value?: string | null;
  onChange: (url: string) => void;
  eventName: string;
  maxSizeMb?: number;
  allowedFileTypes?: string;
  disabled?: boolean;
  required?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

export function QuestionMediaUpload({
  id,
  value,
  onChange,
  eventName,
  maxSizeMb = 10,
  allowedFileTypes,
  disabled = false,
  required = false,
  hasError = false,
  errorMessage,
}: QuestionMediaUploadProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const fileInputRef = useRef<HTMLInputElement | null>(null as unknown as HTMLInputElement);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [localFileSize, setLocalFileSize] = useState<number | null>(null);

  const effectiveMaxMb = Math.max(1, Math.min(maxSizeMb ?? 10, 50));
  const maxBytes = effectiveMaxMb * 1024 * 1024;
  const isActionDisabled = disabled ? true : isUploading;

  const isImageFile = (urlOrName?: string | null) => {
    if (!urlOrName) return false;
    const lower = urlOrName.toLowerCase();
    return (
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".gif") ||
      lower.endsWith(".svg") ||
      lower.endsWith(".avif")
    );
  };

  const handleFileProcess = async (file: File) => {
    if (isActionDisabled) return;

    // 1. Client-side size validation
    if (file.size > maxBytes) {
      toast.error(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of ${effectiveMaxMb} MB.`,
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setIsUploading(true);
    setLocalFileName(file.name);
    setLocalFileSize(file.size);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventName", eventName || "event");
      formData.append("maxSizeMb", String(effectiveMaxMb));

      const response = await fetch("/api/events/upload-question-media", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        url?: string;
        name?: string;
      };

      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.error ?? "Failed to upload file");
      }

      onChange(data.url);
      setLocalFileName(data.name ?? file.name);
      toast.success(`Uploaded "${file.name}" successfully!`);
    } catch (err) {
      console.error("[QuestionMediaUpload] Upload failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to upload file";
      toast.error(msg);
      setLocalFileName(null);
      setLocalFileSize(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isActionDisabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (!isActionDisabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleClear = () => {
    if (isActionDisabled) return;
    onChange("");
    setLocalFileName(null);
    setLocalFileSize(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePasteFromClipboard = async () => {
    if (isActionDisabled) return;
    try {
      if (!navigator.clipboard?.read) {
        toast.info("Please focus on this area and press Cmd+V / Ctrl+V to paste your clipboard image.");
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
          const file = new File([blob], `pasted-media-${Date.now()}.${ext}`, { type: imageType });
          await handleFileProcess(file);
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

  const handleContainerPaste = (e: React.ClipboardEvent) => {
    if (isActionDisabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        e.stopPropagation();
        const file = item.getAsFile();
        if (file) {
          void handleFileProcess(file);
        }
        return;
      }
    }
  };

  const hasValue = Boolean(value?.trim());
  const displayName = localFileName ?? (value ? (value.split("/").pop() ?? "Uploaded media") : "");

  let dropzoneStyle = "border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-muted/40";
  if (isDragging) {
    dropzoneStyle = "border-primary bg-primary/10";
  } else if (hasError) {
    dropzoneStyle = "border-destructive/60 bg-destructive/5 hover:border-destructive";
  }

  return (
    <div className="w-full space-y-2" onPaste={handleContainerPaste}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept={allowedFileTypes ?? undefined}
        disabled={isActionDisabled}
        required={required}
        onChange={handleInputChange}
        className="sr-only"
      />

      {/* Uploaded state card */}
      {hasValue && !isUploading ? (
        <div
          className={cn(
            "relative flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-2xs transition-all",
            hasError ? "border-destructive/60 bg-destructive/5" : "border-border hover:border-primary/40",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            {/* Thumbnail or File Icon */}
            {isImageFile(value ?? localFileName) ? (
              <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted/40">
                <Image src={value as string} alt={displayName} fill unoptimized className="object-cover" sizes="48px" />
              </div>
            ) : (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                <FileText className="size-6" />
              </div>
            )}

            {/* File metadata */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-medium text-foreground text-xs sm:text-sm" title={displayName}>
                  {displayName}
                </p>
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
                {localFileSize && <span>{formatFileSize(localFileSize)}</span>}
                <Badge variant="outline" className="px-1 py-0 font-normal text-[10px]">
                  Uploaded
                </Badge>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-1.5">
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-7 text-muted-foreground hover:text-foreground"
                asChild
                title="View uploaded media in new tab"
              >
                <a href={value} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            )}

            {!disabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-7 px-2 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  title="Replace with another file"
                >
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-7 px-2 text-xs"
                  onClick={handlePasteFromClipboard}
                  title="Paste screenshot from clipboard to replace"
                >
                  <Clipboard className="mr-1 size-3" />
                  Paste
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleClear}
                  title="Remove file"
                  aria-label="Remove uploaded file"
                >
                  <X className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Dropzone / Upload Area */
        <section
          aria-label="Media upload dropzone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "group relative flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors",
            dropzoneStyle,
            isActionDisabled && "cursor-not-allowed opacity-60",
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <div className="space-y-0.5">
                <p className="font-medium text-foreground text-xs">Uploading to bucket storage...</p>
                {localFileName && <p className="text-[11px] text-muted-foreground">{localFileName}</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <UploadCloud className="size-5" />
              </div>
              <div className="space-y-0.5">
                <p className="font-medium text-foreground text-xs">
                  <button
                    type="button"
                    disabled={isActionDisabled}
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer text-primary hover:underline focus:outline-none"
                  >
                    Click to browse
                  </button>
                  {" or drag & drop"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {allowedFileTypes ? `Formats: ${allowedFileTypes} • ` : ""}Max file size: {effectiveMaxMb} MB
                </p>
              </div>

              {!disabled && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={isActionDisabled}
                    className="h-7 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse Files
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={isActionDisabled}
                    className="h-7 text-xs"
                    onClick={handlePasteFromClipboard}
                  >
                    <Clipboard className="mr-1 size-3" />
                    Paste from Clipboard
                  </Button>
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">(or press Cmd+V / Ctrl+V)</span>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Error message */}
      {hasError && errorMessage && (
        <div className="flex items-center gap-1.5 text-destructive text-xs">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
