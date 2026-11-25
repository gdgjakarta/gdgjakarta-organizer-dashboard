"use client";

import { useEffect, useRef, useState } from "react";

import { Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildDefaultOverlayFields } from "@/lib/events/certificate-utils";
import type { CertificateOverlayField, CertificateType } from "@/lib/firestore/types";

const FIELD_KEY_OPTIONS = [
  { key: "recipient_name", label: "Recipient Name", sample: "Veronica Putri A." },
  { key: "event_name", label: "Event Name", sample: "I/O Extended Jakarta 2026" },
  { key: "event_date", label: "Event Date", sample: "June 20, 2026" },
  { key: "role", label: "Role", sample: "Speaker" },
  { key: "talk_title", label: "Talk Title", sample: "Building AI Agents" },
  { key: "certificate_id", label: "Certificate ID", sample: "GDGJKT-2026-A8F3K2" },
  { key: "qr_code", label: "Verification QR Code", sample: "[QR]" },
  { key: "verification_badge", label: "Verification Badge + QR", sample: "[X.509 Badge + QR]" },
] as const;

interface CertificateOverlayEditorProps {
  type: CertificateType;
  backgroundPdfUrl?: string | null;
  fields: CertificateOverlayField[];
  onChange: (fields: CertificateOverlayField[]) => void;
}

export function CertificateOverlayEditor({ type, backgroundPdfUrl, fields, onChange }: CertificateOverlayEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    async function renderPdf() {
      if (!backgroundPdfUrl || !canvasRef.current) return;
      setIsLoadingPdf(true);
      setPdfError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({ url: backgroundPdfUrl });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 1.25 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      } catch (err) {
        if (!cancelled) {
          setPdfError(err instanceof Error ? err.message : "Failed to render PDF background.");
        }
      } finally {
        if (!cancelled) setIsLoadingPdf(false);
      }
    }
    void renderPdf();
    return () => {
      cancelled = true;
    };
  }, [backgroundPdfUrl]);

  const updateField = (idx: number, patch: Partial<CertificateOverlayField>) => {
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => {
    onChange(fields.filter((_, i) => i !== idx));
    setSelectedIdx((prev) => Math.max(0, prev - 1));
  };

  const addField = () => {
    const unused = FIELD_KEY_OPTIONS.find((opt) => !fields.some((f) => f.key === opt.key)) ?? FIELD_KEY_OPTIONS[0];
    const next: CertificateOverlayField = {
      key: unused.key,
      x: 0.15,
      y: 0.5,
      width: unused.key === "qr_code" ? 0.09 : unused.key === "verification_badge" ? 0.35 : 0.7,
      font_size: 16,
      align: "center",
      bold: false,
      color: "#202124",
    };
    onChange([...fields, next]);
    setSelectedIdx(fields.length);
  };

  const selected = fields[selectedIdx];

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Google Drawing Overlay Positioning</p>
          <p className="text-xs text-muted-foreground">
            Coordinates are fractions (0–100%) of page width/height. Use Google Slides mode for exact Google Sans Flex
            fonts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange(buildDefaultOverlayFields(type));
              setSelectedIdx(0);
            }}
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Reset 4:3 Defaults
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="mr-1.5 size-3.5" />
            Add Field
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-md border bg-background">
          {!backgroundPdfUrl ? (
            <div className="flex aspect-[4/3] items-center justify-center p-6 text-center text-xs text-muted-foreground">
              Sync your Google Drawing background above to preview overlay positions here.
            </div>
          ) : (
            <div className="relative aspect-[4/3] w-full">
              {isLoadingPdf && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {pdfError && <div className="p-3 text-xs text-destructive">{pdfError}</div>}
              <canvas ref={canvasRef} className="h-full w-full object-contain" />
              {/* Overlay preview boxes */}
              <div className="pointer-events-none absolute inset-0">
                {fields.map((field, idx) => {
                  const meta = FIELD_KEY_OPTIONS.find((o) => o.key === field.key);
                  const isSelected = idx === selectedIdx;
                  return (
                    <button
                      key={`${field.key}-${idx}`}
                      type="button"
                      onClick={() => setSelectedIdx(idx)}
                      className={`pointer-events-auto absolute rounded border px-1 py-0.5 text-[10px] leading-tight transition ${
                        isSelected
                          ? "border-primary bg-primary/15 text-primary ring-1 ring-primary"
                          : "border-dashed border-muted-foreground/60 bg-background/60 text-foreground"
                      }`}
                      style={{
                        left: `${Math.max(0, Math.min(95, field.x * 100))}%`,
                        top: `${Math.max(0, Math.min(95, field.y * 100))}%`,
                        width: `${Math.max(6, Math.min(100, field.width * 100))}%`,
                        textAlign: field.align,
                        fontWeight: field.bold ? 700 : 400,
                      }}
                    >
                      {meta?.sample || field.key}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {fields.map((f, idx) => (
              <Badge
                key={`${f.key}-${idx}`}
                variant={idx === selectedIdx ? "default" : "secondary"}
                className="cursor-pointer"
                onClick={() => setSelectedIdx(idx)}
              >
                {FIELD_KEY_OPTIONS.find((o) => o.key === f.key)?.label || f.key}
              </Badge>
            ))}
          </div>

          {selected ? (
            <div className="space-y-3 rounded-md border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Field</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive"
                  onClick={() => removeField(selectedIdx)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <Select value={selected.key} onValueChange={(v) => updateField(selectedIdx, { key: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_KEY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px]">X (%)</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(selected.x * 100)}
                    onChange={(e) => updateField(selectedIdx, { x: Number(e.target.value) / 100 })}
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Y (%)</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(selected.y * 100)}
                    onChange={(e) => updateField(selectedIdx, { y: Number(e.target.value) / 100 })}
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Width (%)</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    min={5}
                    max={100}
                    step={1}
                    value={Math.round(selected.width * 100)}
                    onChange={(e) => updateField(selectedIdx, { width: Number(e.target.value) / 100 })}
                  />
                </div>
              </div>

              {selected.key !== "qr_code" && selected.key !== "verification_badge" && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[11px]">Font (pt)</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      min={8}
                      max={64}
                      value={selected.font_size}
                      onChange={(e) => updateField(selectedIdx, { font_size: Number(e.target.value) || 14 })}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Align</Label>
                    <Select
                      value={selected.align}
                      onValueChange={(v) => updateField(selectedIdx, { align: v as "left" | "center" | "right" })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]">Color</Label>
                    <Input
                      type="color"
                      className="h-8 p-1"
                      value={selected.color || "#202124"}
                      onChange={(e) => updateField(selectedIdx, { color: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {selected.key !== "qr_code" && selected.key !== "verification_badge" && (
                <div className="flex items-center gap-2 text-xs">
                  <Checkbox
                    id="overlay-field-bold"
                    checked={Boolean(selected.bold)}
                    onCheckedChange={(checked) => updateField(selectedIdx, { bold: Boolean(checked) })}
                  />
                  <Label htmlFor="overlay-field-bold" className="text-xs font-normal">
                    Bold text
                  </Label>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No overlay fields configured. Click Add Field to begin.</p>
          )}
        </div>
      </div>
    </div>
  );
}
