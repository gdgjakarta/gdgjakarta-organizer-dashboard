"use client";

import * as React from "react";

import { CheckCircle2, FileIcon, Loader2, UploadCloud, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatFileSize, sanitizeStorageName } from "@/lib/r2/utils";

interface UploadFileItem {
  id: string;
  file: File;
  sanitizedName: string;
  status: "pending" | "uploading" | "success" | "error";
  errorMessage?: string;
}

interface UploadMediaDialogProps {
  currentPrefix: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UploadMediaDialog({ currentPrefix, isOpen, onOpenChange, onSuccess }: UploadMediaDialogProps) {
  const [fileList, setFileList] = React.useState<UploadFileItem[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (incomingFiles: FileList | null) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    const newItems: UploadFileItem[] = [];
    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i];
      const sanitized = sanitizeStorageName(file.name, false);
      newItems.push({
        id: `${file.name}-${file.size}-${Date.now()}-${i}`,
        file,
        sanitizedName: sanitized,
        status: "pending",
      });
    }

    setFileList((prev) => [...prev, ...newItems]);
  };

  const removeFile = (id: string) => {
    setFileList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleUploadAll = async () => {
    if (fileList.length === 0) return;

    setIsUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append("prefix", currentPrefix);

    for (const item of fileList) {
      formData.append("files", item.file);
    }

    try {
      setUploadProgress(40);
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(80);
      const data = (await res.json()) as {
        success?: boolean;
        uploadedCount?: number;
        error?: string;
      };

      if (res.ok && data.success) {
        setUploadProgress(100);
        toast.success(`Berhasil mengunggah ${data.uploadedCount ?? 0} berkas ke R2`);
        setFileList([]);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(data.error ?? "Gagal mengunggah berkas");
      }
    } catch {
      toast.error("Terjadi kegagalan jaringan saat mengunggah berkas");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" />
            Unggah Berkas ke R2
          </DialogTitle>
          <DialogDescription>
            Unggah berkas ke direktori{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              {currentPrefix ? `/${currentPrefix}` : "/ (Root)"}
            </code>
            . Nama file otomatis diformat menjadi huruf kecil &amp; strip (-).
          </DialogDescription>
        </DialogHeader>

        {/* Drag and Drop Box */}
        <button
          type="button"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="mt-3 font-medium text-sm">Tarik berkas ke sini, atau klik untuk memilih</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Mendukung gambar, video, dokumen, audio, dan arsip zip hingga 50 MB
          </p>
        </button>

        {/* Selected Files Preview List */}
        {fileList.length > 0 && (
          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            <p className="font-medium text-foreground text-xs">Daftar Berkas ({fileList.length})</p>
            {fileList.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border bg-card p-2 text-xs">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="overflow-hidden">
                    <p className="truncate font-medium text-foreground">{item.sanitizedName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Asli: {item.file.name} • {formatFileSize(item.file.size)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {item.status === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {item.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                  {!isUploading && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeFile(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>Mengunggah berkas...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-1.5" />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFileList([]);
              onOpenChange(false);
            }}
            disabled={isUploading}
          >
            Batal
          </Button>
          <Button type="button" onClick={handleUploadAll} disabled={isUploading || fileList.length === 0}>
            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Unggah {fileList.length > 0 ? `(${fileList.length}) Berkas` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
