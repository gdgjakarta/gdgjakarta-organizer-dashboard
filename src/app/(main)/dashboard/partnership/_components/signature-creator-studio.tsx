"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Eraser, ImageUp, PenTool, Plus, Sparkles, Stamp, Type, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SignatureInputMode } from "@/types/partner-signage";

export interface CreatedSignatureAsset {
  id: string;
  mode: SignatureInputMode;
  kind: "signature" | "initials";
  dataUrl: string;
  blob: Blob;
  aspectRatio: number;
  label: string;
}

interface SignatureCreatorStudioProps {
  defaultFullName: string;
  savedTemplateSignatureUrl?: string;
  onAddPlacement: (asset: CreatedSignatureAsset) => void;
  onAddTextStamp: (asset?: CreatedSignatureAsset) => void;
  disabled?: boolean;
}

type TypeStyleId = "script" | "serif" | "monogram";

interface DrawStroke {
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
}

const INK_COLORS = [
  { id: "slate", label: "Midnight Slate", hex: "#0f172a" },
  { id: "blue", label: "Royal Blue", hex: "#1d4ed8" },
  { id: "black", label: "Pure Black", hex: "#111827" },
] as const;

const TYPE_STYLES: Array<{ id: TypeStyleId; label: string }> = [
  { id: "script", label: "Script" },
  { id: "serif", label: "Executive" },
  { id: "monogram", label: "Monogram" },
];

function deriveInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  if (words.length === 0) return "";
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words
    .slice(0, 4)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function toSameOriginMediaUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/api/media/") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const publicR2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/+$/, "");
    const publicR2Host = publicR2 ? new URL(publicR2).hostname : "";
    if (
      parsed.hostname === "assets.gdgjakarta.org" ||
      (publicR2Host && parsed.hostname === publicR2Host) ||
      parsed.hostname.endsWith(".r2.dev")
    ) {
      const cleanKey = parsed.pathname.replace(/^\/+/, "");
      return `/api/media/${cleanKey}`;
    }
  } catch {
    // Fall back to original string if URL parsing fails
  }
  return trimmed;
}

async function trimCanvasToPng(
  sourceCanvas: HTMLCanvasElement,
  padding = 12,
): Promise<{ dataUrl: string; blob: Blob; aspectRatio: number } | null> {
  const ctx = sourceCanvas.getContext("2d");
  if (!ctx) return null;

  const { width, height } = sourceCanvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const outCanvas = document.createElement("canvas");
  outCanvas.width = cropW + padding * 2;
  outCanvas.height = cropH + padding * 2;

  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return null;

  outCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, padding, padding, cropW, cropH);

  const dataUrl = outCanvas.toDataURL("image/png");
  const blob = await new Promise<Blob | null>((resolve) => outCanvas.toBlob(resolve, "image/png"));
  if (!blob) return null;

  return {
    dataUrl,
    blob,
    aspectRatio: Math.max(0.25, Math.min(8, outCanvas.width / outCanvas.height)),
  };
}

function renderTypedSignatureToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  styleId: TypeStyleId,
  inkColor: string,
  isInitials: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const trimmed = text.trim();
  if (!trimmed) return;

  ctx.save();
  ctx.fillStyle = inkColor;
  ctx.strokeStyle = inkColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontFamily =
    styleId === "script"
      ? "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', 'Apple Chancery', cursive"
      : styleId === "serif"
        ? "Georgia, 'Times New Roman', serif"
        : "system-ui, -apple-system, 'Segoe UI', sans-serif";

  let fontSize = isInitials ? 88 : 66;
  const buildFont = (sz: number) => {
    if (styleId === "script") return `italic 600 ${sz}px ${fontFamily}`;
    if (styleId === "serif") return `italic 700 ${sz}px ${fontFamily}`;
    return `700 ${sz}px ${fontFamily}`;
  };

  ctx.font = buildFont(fontSize);
  const maxTextW = w - (styleId === "monogram" ? 76 : 40);
  while (fontSize > 22 && ctx.measureText(trimmed).width > maxTextW) {
    fontSize -= 2;
    ctx.font = buildFont(fontSize);
  }

  const metrics = ctx.measureText(trimmed);

  if (styleId === "monogram") {
    const boxW = Math.min(w - 24, Math.max(metrics.width + 44, isInitials ? 116 : 160));
    const boxH = Math.min(h - 24, fontSize + 36);
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;
    const radius = isInitials ? 14 : 10;

    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, radius);
    ctx.stroke();
  }

  ctx.fillText(trimmed, w / 2, h / 2 + (styleId === "script" ? 2 : 0));

  if (styleId !== "monogram") {
    const lineW = Math.min(w - 36, Math.max(metrics.width + 18, 90));
    const lineY = h / 2 + fontSize * 0.44;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo((w - lineW) / 2, lineY);
    ctx.lineTo((w + lineW) / 2, lineY);
    ctx.stroke();
  }

  ctx.restore();
}

export function SignatureCreatorStudio({
  defaultFullName,
  savedTemplateSignatureUrl,
  onAddPlacement,
  onAddTextStamp,
  disabled = false,
}: SignatureCreatorStudioProps) {
  const [activeMode, setActiveMode] = useState<"initials" | "draw" | "upload">("initials");

  // ── Mode 1: Initials / Typed Name ──
  const [fullNameInput, setFullNameInput] = useState(defaultFullName || "");
  const [initialsInput, setInitialsInput] = useState(deriveInitials(defaultFullName || ""));
  const [initialsEditedManually, setInitialsEditedManually] = useState(false);
  const [typedTarget, setTypedTarget] = useState<"initials" | "full_name">("initials");
  const [typeStyle, setTypeStyle] = useState<TypeStyleId>("script");
  const [typeInkColor, setTypeInkColor] = useState<string>(INK_COLORS[0].hex);
  const typedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!defaultFullName) return;
    setFullNameInput((prev) => prev || defaultFullName);
    if (!initialsEditedManually) {
      setInitialsInput((prev) => prev || deriveInitials(defaultFullName));
    }
  }, [defaultFullName, initialsEditedManually]);

  const activeTypedText = typedTarget === "initials" ? initialsInput : fullNameInput;

  useEffect(() => {
    const canvas = typedCanvasRef.current;
    if (!canvas) return;
    renderTypedSignatureToCanvas(canvas, activeTypedText, typeStyle, typeInkColor, typedTarget === "initials");
  }, [activeTypedText, typeStyle, typeInkColor, typedTarget]);

  // ── Mode 2: Freehand Draw ──
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<DrawStroke[]>([]);
  const activeStrokeRef = useRef<DrawStroke | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [drawInkColor, setDrawInkColor] = useState<string>(INK_COLORS[0].hex);
  const [drawWidth, setDrawWidth] = useState<number>(3);

  const redrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawSingleStroke = (stroke: DrawStroke) => {
      if (stroke.points.length === 0) return;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.points.length === 1) {
        const pt = stroke.points[0];
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
          const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
        }
        const last = stroke.points[stroke.points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }
      ctx.restore();
    };

    for (const s of strokesRef.current) {
      drawSingleStroke(s);
    }
    if (activeStrokeRef.current) {
      drawSingleStroke(activeStrokeRef.current);
    }
  }, []);

  const getDrawPointerPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
    };
  };

  const handleDrawPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getDrawPointerPoint(e);
    activeStrokeRef.current = {
      points: [pt],
      color: drawInkColor,
      width: drawWidth * 1.4,
    };
    redrawCanvas();
  };

  const handleDrawPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStrokeRef.current) return;
    const pt = getDrawPointerPoint(e);
    activeStrokeRef.current.points.push(pt);
    redrawCanvas();
  };

  const handleDrawPointerEnd = () => {
    if (!activeStrokeRef.current) return;
    strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
    activeStrokeRef.current = null;
    setStrokeCount(strokesRef.current.length);
    redrawCanvas();
  };

  const handleUndoStroke = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    redrawCanvas();
  };

  const handleClearDraw = () => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setStrokeCount(0);
    redrawCanvas();
  };

  // ── Mode 3: Upload / Saved Organizer Signature ──
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string>("");
  const [uploadedSourceKind, setUploadedSourceKind] = useState<"upload" | "template">("upload");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true);
  const [processedUploadUrl, setProcessedUploadUrl] = useState<string>("");
  const [isLoadingTemplateSig, setIsLoadingTemplateSig] = useState(false);
  const processedUploadCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!uploadedImageSrc) {
      setProcessedUploadUrl("");
      processedUploadCanvasRef.current = null;
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const maxDim = 900;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, w, h);

      if (removeWhiteBg) {
        const imgData = ctx.getImageData(0, 0, w, h);
        const px = imgData.data;
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i];
          const g = px[i + 1];
          const b = px[i + 2];
          const a = px[i + 3];
          if (a === 0) continue;
          const brightness = (r + g + b) / 3;
          const saturation = Math.max(r, g, b) - Math.min(r, g, b);
          if (brightness > 228 && saturation < 28) {
            px[i + 3] = 0;
          } else if (brightness > 195 && saturation < 24) {
            // Feather near-white edge pixels smoothly
            px[i + 3] = Math.round(a * Math.max(0, (228 - brightness) / 33));
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      processedUploadCanvasRef.current = canvas;
      setProcessedUploadUrl(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      if (!cancelled) {
        toast.error("Could not decode signature image.");
      }
    };
    img.src = uploadedImageSrc;

    return () => {
      cancelled = true;
    };
  }, [uploadedImageSrc, removeWhiteBg]);

  const handleUploadImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a PNG, JPG, or WebP signature image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Signature image must be 5 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImageSrc(String(reader.result || ""));
      setUploadedSourceKind("upload");
      setUploadedFileName(file.name);
      setRemoveWhiteBg(file.type !== "image/png");
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSavedTemplateSignature = async () => {
    if (!savedTemplateSignatureUrl) return;
    setIsLoadingTemplateSig(true);
    try {
      const sameOriginUrl = toSameOriginMediaUrl(savedTemplateSignatureUrl);
      const res = await fetch(sameOriginUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read signature blob"));
        reader.readAsDataURL(blob);
      });
      setUploadedImageSrc(dataUrl);
      setUploadedSourceKind("template");
      setUploadedFileName("Saved Organizer Signature");
      setRemoveWhiteBg(false);
      toast.success("Loaded saved organizer signature from Document Templates!");
    } catch {
      toast.error("Failed to load saved organizer signature.");
    } finally {
      setIsLoadingTemplateSig(false);
    }
  };

  // ── Export Current Signature & Place on Active PDF Page ──
  const [isExporting, setIsExporting] = useState(false);

  const handlePlaceSignature = async () => {
    setIsExporting(true);
    try {
      let targetCanvas: HTMLCanvasElement | null = null;
      let mode: SignatureInputMode = "initials";
      let kind: "signature" | "initials" = "signature";
      let label = "Signature";

      if (activeMode === "initials") {
        if (!activeTypedText.trim()) {
          toast.error(typedTarget === "initials" ? "Enter initials first." : "Enter full name first.");
          return;
        }
        targetCanvas = typedCanvasRef.current;
        mode = "initials";
        kind = typedTarget === "initials" ? "initials" : "signature";
        label = `${typedTarget === "initials" ? "Initials" : "Signature"}: ${activeTypedText.trim()}`;
      } else if (activeMode === "draw") {
        if (strokesRef.current.length === 0) {
          toast.error("Draw your signature on the pad first.");
          return;
        }
        targetCanvas = drawCanvasRef.current;
        mode = "draw";
        kind = "signature";
        label = "Drawn Signature";
      } else {
        if (!processedUploadCanvasRef.current) {
          toast.error("Upload a signature image or load the saved organizer signature first.");
          return;
        }
        targetCanvas = processedUploadCanvasRef.current;
        mode = uploadedSourceKind;
        kind = "signature";
        label = uploadedFileName || "Uploaded Signature";
      }

      if (!targetCanvas) {
        toast.error("Signature preview is not ready.");
        return;
      }

      const exported = await trimCanvasToPng(targetCanvas, 10);
      if (!exported) {
        toast.error("Signature canvas is empty.");
        return;
      }

      const assetId = `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      onAddPlacement({
        id: assetId,
        mode,
        kind,
        dataUrl: exported.dataUrl,
        blob: exported.blob,
        aspectRatio: exported.aspectRatio,
        label,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePlaceStamp = async () => {
    setIsExporting(true);
    try {
      let sourceCanvas: HTMLCanvasElement | null = null;
      let mode: SignatureInputMode = "draw";
      let label = "Stamp Signature";

      if (activeMode === "draw" && strokesRef.current.length > 0) {
        sourceCanvas = drawCanvasRef.current;
        mode = "draw";
        label = "Drawn Signature";
      } else if (activeMode === "upload" && processedUploadCanvasRef.current) {
        sourceCanvas = processedUploadCanvasRef.current;
        mode = uploadedSourceKind;
        label = uploadedFileName || "Uploaded Signature";
      } else if (strokesRef.current.length > 0) {
        sourceCanvas = drawCanvasRef.current;
        mode = "draw";
        label = "Drawn Signature";
      } else if (processedUploadCanvasRef.current) {
        sourceCanvas = processedUploadCanvasRef.current;
        mode = uploadedSourceKind;
        label = uploadedFileName || "Uploaded Signature";
      }

      if (!sourceCanvas) {
        onAddTextStamp(undefined);
        return;
      }

      const exported = await trimCanvasToPng(sourceCanvas, 8);
      if (!exported) {
        onAddTextStamp(undefined);
        return;
      }

      const assetId = `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      onAddTextStamp({
        id: assetId,
        mode,
        kind: "signature",
        dataUrl: exported.dataUrl,
        blob: exported.blob,
        aspectRatio: exported.aspectRatio,
        label,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as "initials" | "draw" | "upload")}>
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="initials" className="text-xs gap-1.5">
            <Type className="h-3.5 w-3.5" />
            Initials / Type
          </TabsTrigger>
          <TabsTrigger value="draw" className="text-xs gap-1.5">
            <PenTool className="h-3.5 w-3.5" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="upload" className="text-xs gap-1.5">
            <ImageUp className="h-3.5 w-3.5" />
            Upload
          </TabsTrigger>
        </TabsList>

        {/* ── 1. Initials / Typed Name ── */}
        <TabsContent value="initials" className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="sig-full-name" className="text-[11px]">
                Full Name
              </Label>
              <Input
                id="sig-full-name"
                value={fullNameInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setFullNameInput(val);
                  if (!initialsEditedManually) {
                    setInitialsInput(deriveInitials(val));
                  }
                }}
                placeholder="Fachridan Tio M."
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sig-initials" className="text-[11px]">
                Initials
              </Label>
              <Input
                id="sig-initials"
                value={initialsInput}
                maxLength={8}
                onChange={(e) => {
                  setInitialsEditedManually(true);
                  setInitialsInput(e.target.value.toUpperCase());
                }}
                placeholder="FTM"
                className="h-8 text-xs font-semibold uppercase"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setTypedTarget("initials")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  typedTarget === "initials"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Initials ({initialsInput || "—"})
              </button>
              <button
                type="button"
                onClick={() => setTypedTarget("full_name")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  typedTarget === "full_name"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Full Name
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {INK_COLORS.map((ink) => (
                <button
                  key={ink.id}
                  type="button"
                  title={ink.label}
                  aria-label={ink.label}
                  onClick={() => setTypeInkColor(ink.hex)}
                  className={`size-5 rounded-full border transition-transform cursor-pointer ${
                    typeInkColor === ink.hex ? "ring-2 ring-primary ring-offset-2 scale-110" : "border-border"
                  }`}
                  style={{ backgroundColor: ink.hex }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {TYPE_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setTypeStyle(style.id)}
                className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  typeStyle === style.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-dashed border-border bg-white p-2 flex items-center justify-center">
            <canvas ref={typedCanvasRef} width={520} height={170} className="h-24 w-full object-contain" />
          </div>
        </TabsContent>

        {/* ── 2. Freehand Draw ── */}
        <TabsContent value="draw" className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {INK_COLORS.map((ink) => (
                <button
                  key={ink.id}
                  type="button"
                  title={ink.label}
                  aria-label={ink.label}
                  onClick={() => setDrawInkColor(ink.hex)}
                  className={`size-5 rounded-full border transition-transform cursor-pointer ${
                    drawInkColor === ink.hex ? "ring-2 ring-primary ring-offset-2 scale-110" : "border-border"
                  }`}
                  style={{ backgroundColor: ink.hex }}
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleUndoStroke}
                disabled={strokeCount === 0}
                className="h-7 px-2 text-xs"
              >
                <Undo2 className="mr-1 h-3.5 w-3.5" />
                Undo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearDraw}
                disabled={strokeCount === 0}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <Eraser className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-[11px] text-muted-foreground shrink-0">Pen Width ({drawWidth}px)</Label>
            <Slider
              value={[drawWidth]}
              min={1.5}
              max={5}
              step={0.5}
              onValueChange={(vals) => setDrawWidth(vals[0] ?? 3)}
            />
          </div>

          <div className="relative rounded-lg border-2 border-dashed border-border bg-white overflow-hidden">
            <canvas
              ref={drawCanvasRef}
              width={600}
              height={220}
              className="h-32 w-full cursor-crosshair touch-none"
              onPointerDown={handleDrawPointerDown}
              onPointerMove={handleDrawPointerMove}
              onPointerUp={handleDrawPointerEnd}
              onPointerCancel={handleDrawPointerEnd}
            />
            {strokeCount === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-zinc-400">Draw your signature or initials here</span>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── 3. Upload Image / Saved Template Signature ── */}
        <TabsContent value="upload" className="space-y-3 pt-2">
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleUploadImageFile}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => uploadInputRef.current?.click()}
              className="flex-1 h-8 text-xs gap-1.5"
            >
              <ImageUp className="h-3.5 w-3.5" />
              {uploadedImageSrc ? "Choose Different Image" : "Upload Signature Image"}
            </Button>

            {savedTemplateSignatureUrl && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isLoadingTemplateSig}
                onClick={() => void handleLoadSavedTemplateSignature()}
                className="h-8 text-xs gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Use Saved Organizer Signature
              </Button>
            )}
          </div>

          {processedUploadUrl ? (
            <div className="space-y-2">
              <div
                className="rounded-lg border border-border p-3 flex items-center justify-center min-h-24"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                  backgroundColor: "#ffffff",
                }}
              >
                <img
                  src={processedUploadUrl}
                  alt="Uploaded signature preview"
                  className="max-h-24 max-w-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
                <Label htmlFor="remove-white-bg" className="text-[11px] font-medium cursor-pointer">
                  Remove white background (transparent PNG)
                </Label>
                <Switch id="remove-white-bg" checked={removeWhiteBg} onCheckedChange={setRemoveWhiteBg} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-border bg-muted/20 p-5 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <ImageUp className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-foreground">PNG, JPG, or WebP signature image</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                White backgrounds can be stripped automatically
              </p>
            </button>
          )}
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || isExporting}
          onClick={() => void handlePlaceSignature()}
          className="h-8 text-xs font-semibold gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Place Signature on Page
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isExporting}
          onClick={() => void handlePlaceStamp()}
          className="h-8 text-xs font-medium gap-1.5"
        >
          <Stamp className="h-3.5 w-3.5 text-primary" />
          Place Signer &amp; E-Cert Stamp
        </Button>
      </div>
    </div>
  );
}
