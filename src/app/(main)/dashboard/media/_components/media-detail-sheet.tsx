"use client";

import * as React from "react";

import { Check, Code, Copy, Download, Edit2, ExternalLink, Move, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MediaItem } from "@/lib/r2/types";
import { formatFileSize } from "@/lib/r2/utils";

interface MediaDetailSheetProps {
  item: MediaItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (item: MediaItem) => void;
  onMove: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}

export function MediaDetailSheet({ item, isOpen, onOpenChange, onRename, onMove, onDelete }: MediaDetailSheetProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  if (!item) return null;

  const fullUrl =
    typeof window !== "undefined" && item.url.startsWith("/") ? `${window.location.origin}${item.url}` : item.url;

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`${label} disalin ke clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownload = () => {
    const downloadUrl = `${item.url}${item.url.includes("?") ? "&" : "?"}download=1`;
    window.open(downloadUrl, "_blank");
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[11px] uppercase">
              {item.category}
            </Badge>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={item.url} target="_blank" rel="noopener noreferrer" title="Buka URL asli">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <SheetTitle className="truncate text-left font-semibold text-lg" title={item.name}>
            {item.name}
          </SheetTitle>
          <SheetDescription className="break-all text-left font-mono text-muted-foreground text-xs">
            {item.key}
          </SheetDescription>
        </SheetHeader>

        {/* Media Preview Box */}
        <div className="flex max-h-72 min-h-48 w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/40 p-2">
          {(() => {
            if (item.category === "image") {
              return (
                // biome-ignore lint/performance/noImgElement: R2 asset direct preview
                <img src={item.url} alt={item.name} className="max-h-64 w-auto rounded object-contain" />
              );
            }
            if (item.category === "video") {
              return (
                <video controls src={item.url} className="max-h-64 w-full rounded">
                  <track kind="captions" />
                </video>
              );
            }
            if (item.category === "audio") {
              return (
                <audio controls src={item.url} className="w-full">
                  <track kind="captions" />
                </audio>
              );
            }
            return (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                <span className="font-mono text-xs uppercase">{item.contentType}</span>
                <p className="text-sm">Pratinjau langsung tidak tersedia untuk format ini</p>
              </div>
            );
          })()}
        </div>

        {/* Quick Embed Snippets */}
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
          <p className="font-medium text-foreground text-xs">Salin Tautan Cepat</p>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">Direct URL</span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => copyToClipboard(fullUrl, "Direct URL")}
              className="gap-1 text-xs"
            >
              {copiedKey === "Direct URL" ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              Salin URL
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">Markdown Tag</span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => copyToClipboard(`![${item.name}](${fullUrl})`, "Markdown")}
              className="gap-1 text-xs"
            >
              {copiedKey === "Markdown" ? <Check className="h-3 w-3 text-emerald-500" /> : <Code className="h-3 w-3" />}
              Markdown
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">HTML &lt;img&gt;</span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => copyToClipboard(`<img src="${fullUrl}" alt="${item.name}" />`, "HTML")}
              className="gap-1 text-xs"
            >
              {copiedKey === "HTML" ? <Check className="h-3 w-3 text-emerald-500" /> : <Code className="h-3 w-3" />}
              HTML Tag
            </Button>
          </div>
        </div>

        {/* Technical Details */}
        <div className="space-y-2 text-xs">
          <p className="font-medium text-foreground">Detail File</p>
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-3">
            <div>
              <p className="text-muted-foreground">Ukuran</p>
              <p className="font-medium font-mono">{formatFileSize(item.size)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Format MIME</p>
              <p className="truncate font-medium font-mono" title={item.contentType}>
                {item.contentType}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Diunggah</p>
              <p className="font-medium">
                {new Date(item.updatedAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">ETag</p>
              <p className="truncate font-medium font-mono" title={item.etag}>
                {item.etag ?? "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="mt-auto flex flex-col gap-2 border-t pt-4">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => onRename(item)} className="gap-1.5">
              <Edit2 className="h-3.5 w-3.5" /> Ubah Nama
            </Button>
            <Button variant="outline" size="sm" onClick={() => onMove(item)} className="gap-1.5">
              <Move className="h-3.5 w-3.5" /> Pindahkan
            </Button>
          </div>
          <Button variant="secondary" size="sm" onClick={handleDownload} className="w-full gap-1.5">
            <Download className="h-3.5 w-3.5" /> Unduh Berkas
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onDelete(item);
            }}
            className="w-full gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Hapus dari R2
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
