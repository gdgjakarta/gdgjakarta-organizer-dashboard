"use client";

import * as React from "react";

import { AlertCircle, Check, Copy, Download, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateQrSvgDataUrl } from "@/lib/printers/qr-svg";
import type { ShortLinkItem } from "@/lib/shortio/types";

interface QrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: ShortLinkItem | null;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function decodeSvgFromDataUrl(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return "";
  return decodeURIComponent(dataUrl.slice(commaIdx + 1));
}

async function rasterizeSvgDataUrlToPngBlob(dataUrl: string, size = 512): Promise<Blob> {
  const img = new Image();
  img.decoding = "sync";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to render SVG QR code onto canvas"));
    img.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable");
  }

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, size, size);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode PNG blob"));
    }, "image/png");
  });
}

export function QrCodeDialog({ open, onOpenChange, link }: QrCodeDialogProps) {
  const [copied, setCopied] = React.useState(false);

  const qrResult = React.useMemo(() => {
    if (!link?.shortURL) return { dataUrl: null as string | null, error: null as string | null };
    try {
      return { dataUrl: generateQrSvgDataUrl(link.shortURL), error: null };
    } catch (err) {
      return {
        dataUrl: null,
        error: err instanceof Error ? err.message : "Short URL exceeds offline QR code capacity.",
      };
    }
  }, [link?.shortURL]);

  if (!link) return null;

  const safeSlug = (link.path || "link").replace(/[^a-zA-Z0-9-_]+/g, "-");

  const handleCopy = () => {
    void navigator.clipboard.writeText(link.shortURL);
    setCopied(true);
    toast.success("Short link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!qrResult.dataUrl) return;
    try {
      const svgMarkup = decodeSvgFromDataUrl(qrResult.dataUrl);
      const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
      triggerBlobDownload(blob, `qrcode-${safeSlug}.svg`);
      toast.success("SVG QR Code downloaded");
    } catch {
      toast.error("Failed to download SVG QR Code");
    }
  };

  const handleDownloadPng = async () => {
    if (!qrResult.dataUrl) return;
    try {
      const pngBlob = await rasterizeSvgDataUrlToPngBlob(qrResult.dataUrl, 512);
      triggerBlobDownload(pngBlob, `qrcode-${safeSlug}.png`);
      toast.success("PNG QR Code downloaded");
    } catch {
      toast.error("Failed to export PNG QR Code");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <QrCode className="size-4" />
            </div>
            <div>
              <DialogTitle>QR Code</DialogTitle>
              <DialogDescription className="max-w-[260px] truncate">{link.title ?? link.path}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center gap-4 py-4">
          {qrResult.dataUrl ? (
            <div className="flex size-64 items-center justify-center rounded-xl border bg-white p-3 shadow-sm">
              {/* biome-ignore lint/performance/noImgElement: Offline generated inline SVG data URI */}
              <img src={qrResult.dataUrl} alt={`QR Code for ${link.shortURL}`} className="size-full object-contain" />
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>QR Generation Unavailable</AlertTitle>
              <AlertDescription>
                {qrResult.error ?? "This URL is too long for offline QR generation (106-byte limit)."}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
            <span className="truncate font-medium font-mono text-foreground">{link.shortURL}</span>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={handleCopy}
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Copy short URL"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadSvg}
            disabled={!qrResult.dataUrl}
            className="gap-1.5"
          >
            <Download className="size-3.5" />
            Download SVG
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleDownloadPng()}
            disabled={!qrResult.dataUrl}
            className="gap-1.5"
          >
            <Download className="size-3.5" />
            Download PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
