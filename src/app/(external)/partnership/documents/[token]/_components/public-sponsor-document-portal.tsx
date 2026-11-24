"use client";

import type React from "react";
import { useEffect, useRef, useState, useTransition } from "react";

import { CheckCircle2, Eraser, FileText, Loader2, PenTool, Printer, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { SponsorDocumentPreview } from "@/components/sponsor-document-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signSponsorDocumentPublicAction } from "@/server/sponsor-document-actions";
import type { SponsorDocument, SponsorDocumentTemplatesConfig } from "@/types/sponsor";

interface PublicSponsorDocumentPortalProps {
  initialDocument: SponsorDocument;
  templatesConfig?: SponsorDocumentTemplatesConfig;
}

export function PublicSponsorDocumentPortal({ initialDocument, templatesConfig }: PublicSponsorDocumentPortalProps) {
  const [doc, setDoc] = useState<SponsorDocument>(initialDocument);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);

  const [signedName, setSignedName] = useState(
    initialDocument.sponsor_signed_name || initialDocument.partner_signer_name || initialDocument.contact_name || "",
  );
  const [signedTitle, setSignedTitle] = useState(
    initialDocument.sponsor_signed_title || initialDocument.partner_signer_title || initialDocument.contact_title || "",
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>(initialDocument.sponsor_signature_data_url || "");

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasCanvasStrokes, setHasCanvasStrokes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmittingSign, startSignTransition] = useTransition();

  const docTypeTitle =
    doc.doc_type === "invoice"
      ? "Official Invoice"
      : doc.doc_type === "quotation"
        ? "Sponsorship Quotation"
        : doc.doc_type === "mou"
          ? "Partnership Memorandum of Understanding (MOU)"
          : "Sponsorship Letter of Agreement (LOA)";

  const canSignOnline = doc.doc_type === "quotation" || doc.doc_type === "loa" || doc.doc_type === "mou";

  // Setup canvas when modal opens
  useEffect(() => {
    if (!isSignModalOpen) return;
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }, 50);
    return () => clearTimeout(timer);
  }, [isSignModalOpen]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasCanvasStrokes(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasCanvasStrokes) {
      setSignatureDataUrl(canvas.toDataURL("image/png"));
    }
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasCanvasStrokes(false);
    setSignatureDataUrl("");
  };

  const handleUploadSignatureImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG or JPG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSignatureDataUrl(result);
      toast.success("Signature image loaded!");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleConfirmSignature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedName.trim()) {
      toast.error("Please enter your printed name.");
      return;
    }

    let finalSigUrl = signatureDataUrl;
    if (!finalSigUrl && hasCanvasStrokes && canvasRef.current) {
      finalSigUrl = canvasRef.current.toDataURL("image/png");
    }

    startSignTransition(async () => {
      try {
        const res = await signSponsorDocumentPublicAction({
          token: doc.token,
          signedName: signedName.trim(),
          signedTitle: signedTitle.trim(),
          signatureDataUrl: finalSigUrl,
        });

        if (res.success && res.document) {
          setDoc(res.document);
          setIsSignModalOpen(false);
          toast.success("Document signed and recorded successfully!");
        } else {
          toast.error(res.error || "Failed to record signature.");
        }
      } catch {
        toast.error("An error occurred while signing the document.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden when printing to PDF) */}
      <div className="print:hidden sticky top-4 z-20 mx-auto max-w-[210mm] rounded-xl border border-border bg-card/95 backdrop-blur p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base text-foreground">{docTypeTitle}</h1>
              <Badge variant="outline" className="font-mono text-xs">
                {doc.doc_number}
              </Badge>
              <Badge
                variant="outline"
                className={
                  doc.status === "signed" || doc.status === "paid"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 capitalize text-xs"
                    : doc.status === "cancelled"
                      ? "bg-rose-500/10 text-rose-600 border-rose-500/20 capitalize text-xs"
                      : "bg-blue-500/10 text-blue-600 border-blue-500/20 capitalize text-xs"
                }
              >
                {doc.status === "signed" ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Signed
                  </span>
                ) : (
                  doc.status
                )}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Prepared for <strong>{doc.company_legal_name || doc.company_name}</strong>
              {doc.event_title ? ` • ${doc.event_title}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canSignOnline && (
            <Button
              type="button"
              variant={doc.status === "signed" ? "outline" : "default"}
              size="sm"
              onClick={() => setIsSignModalOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <PenTool className="h-3.5 w-3.5" />
              {doc.status === "signed" ? "Update Counter-Signature" : "Sign / Acknowledge Online"}
            </Button>
          )}

          <Button
            type="button"
            variant={canSignOnline && doc.status !== "signed" ? "outline" : "default"}
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 text-xs font-semibold"
          >
            <Printer className="h-3.5 w-3.5" />
            Download / Print PDF
          </Button>
        </div>
      </div>

      {/* Pixel-accurate A4 Document Sheet */}
      <SponsorDocumentPreview document={doc} templatesConfig={templatesConfig} />

      {/* Online Counter-Sign Dialog */}
      <Dialog open={isSignModalOpen} onOpenChange={setIsSignModalOpen}>
        <DialogContent className="max-w-lg print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <PenTool className="h-5 w-5 text-primary" />
              Counter-Sign {docTypeTitle}
            </DialogTitle>
            <DialogDescription>
              Enter your signatory details and draw or upload your signature below to counter-sign{" "}
              <span className="font-mono font-medium text-foreground">{doc.doc_number}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmSignature} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="signedName" className="text-xs font-medium">
                Printed Name (Authorized Signatory) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="signedName"
                placeholder="Full Name"
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signedTitle" className="text-xs font-medium">
                Position / Title
              </Label>
              <Input
                id="signedTitle"
                placeholder={`e.g. Director, Head of Marketing — ${doc.company_legal_name || doc.company_name}`}
                value={signedTitle}
                onChange={(e) => setSignedTitle(e.target.value)}
              />
            </div>

            {/* Signature Pad / Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Digital Signature (Draw or Upload Image)</Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 px-2 text-xs"
                  >
                    <UploadCloud className="mr-1 h-3.5 w-3.5" />
                    Upload PNG
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearCanvas}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Eraser className="mr-1 h-3.5 w-3.5" />
                    Clear
                  </Button>
                </div>
              </div>

              <div className="relative rounded-lg border-2 border-dashed border-zinc-300 bg-white overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={150}
                  className="w-full h-36 cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasCanvasStrokes && signatureDataUrl && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/90 p-2">
                    <img
                      src={signatureDataUrl}
                      alt="Uploaded Signature"
                      className="max-h-28 max-w-full object-contain"
                    />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Sign above using your mouse, trackpad, or touch screen, or upload a transparent PNG signature.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleUploadSignatureImage}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsSignModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingSign}>
                {isSubmittingSign ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording Signature...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Confirm & Sign Document
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
