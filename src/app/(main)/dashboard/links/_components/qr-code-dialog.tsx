"use client";

import * as React from "react";

import { Check, Copy, Download, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ShortLinkItem } from "@/lib/shortio/types";

interface QrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: ShortLinkItem | null;
}

export function QrCodeDialog({ open, onOpenChange, link }: QrCodeDialogProps) {
  const [copied, setCopied] = React.useState(false);

  if (!link) return null;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(
    link.shortURL,
  )}`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(link.shortURL);
    setCopied(true);
    toast.success("Short link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qrcode-${link.path || "link"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("QR Code downloaded");
    } catch {
      toast.error("Failed to download QR Code image");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
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
          <div className="flex size-64 items-center justify-center rounded-xl border bg-white p-3 shadow-sm">
            {/* biome-ignore lint/performance/noImgElement: External dynamic QR server image */}
            <img src={qrImageUrl} alt={`QR Code for ${link.shortURL}`} className="size-full object-contain" />
          </div>

          <div className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
            <span className="truncate font-medium font-mono text-foreground">{link.shortURL}</span>
            <Button
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

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="size-3.5" />
            Download PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
