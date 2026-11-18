"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface SponsorLogoCropperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  onCropped: (croppedBlob: Blob, previewUrl: string) => void;
  isUploading?: boolean;
}

/**
 * 16:9 Aspect Ratio Sponsor Logo Cropper Dialog
 * Replicates Bevy's "Adjust Image" modal:
 * - Wide rectangular 16:9 crop framing window
 * - Centered pan / drag
 * - Zoom slider from 1x to 3x with direct number input
 * - High-resolution canvas PNG export
 */
export function SponsorLogoCropperDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropped,
  isUploading = false,
}: SponsorLogoCropperDialogProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  // Viewport / container dimensions
  const CONTAINER_WIDTH = 480;
  const CONTAINER_HEIGHT = 270;
  // 16:9 crop target frame fills container
  const CROP_WIDTH = 480;
  const CROP_HEIGHT = 270;

  useEffect(() => {
    if (!open || !imageSrc) {
      setImageLoaded(false);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageObjRef.current = img;
      setImageLoaded(true);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [open, imageSrc]);

  // Render preview canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded || !imageObjRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CONTAINER_WIDTH, CONTAINER_HEIGHT);

    // 1. Draw dim/dark background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CONTAINER_WIDTH, CONTAINER_HEIGHT);

    const img = imageObjRef.current;
    // Calculate base scale to fit crop frame
    const baseScale = Math.min(CROP_WIDTH / img.width, CROP_HEIGHT / img.height);
    const currentScale = baseScale * zoom;

    const scaledWidth = img.width * currentScale;
    const scaledHeight = img.height * currentScale;

    const centerX = CONTAINER_WIDTH / 2 + pan.x;
    const centerY = CONTAINER_HEIGHT / 2 + pan.y;

    const imgX = centerX - scaledWidth / 2;
    const imgY = centerY - scaledHeight / 2;

    // Draw the image
    ctx.drawImage(img, imgX, imgY, scaledWidth, scaledHeight);

    // 2. Draw 16:9 crop border box (sky-blue highlight matching Bevy Adjust Image UI)
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#38bdf8"; // sky-400
    ctx.strokeRect(0, 0, CONTAINER_WIDTH, CONTAINER_HEIGHT);
  }, [imageLoaded, zoom, pan]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Drag pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Export cropped 16:9 image
  const handleSaveCrop = () => {
    if (!imageObjRef.current || !imageLoaded) return;

    // Render output canvas at high-res 16:9 (1280 x 720)
    const exportWidth = 1280;
    const exportHeight = 720;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    const img = imageObjRef.current;
    const baseScale = Math.min(CROP_WIDTH / img.width, CROP_HEIGHT / img.height);
    const currentScale = baseScale * zoom;

    // Scale factor from preview container to export canvas
    const exportScaleRatio = exportWidth / CROP_WIDTH;

    const scaledWidth = img.width * currentScale * exportScaleRatio;
    const scaledHeight = img.height * currentScale * exportScaleRatio;

    const centerX = exportWidth / 2 + pan.x * exportScaleRatio;
    const centerY = exportHeight / 2 + pan.y * exportScaleRatio;

    const imgX = centerX - scaledWidth / 2;
    const imgY = centerY - scaledHeight / 2;

    // White background for 16:9 sponsor banner export (Bevy compatibility)
    exportCtx.fillStyle = "#ffffff";
    exportCtx.fillRect(0, 0, exportWidth, exportHeight);
    exportCtx.drawImage(img, imgX, imgY, scaledWidth, scaledHeight);

    exportCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const previewUrl = URL.createObjectURL(blob);
        onCropped(blob, previewUrl);
      },
      "image/png",
      0.95,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[560px] sm:max-w-[560px] p-6 sm:rounded-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">Adjust Image</DialogTitle>
        </DialogHeader>

        {/* Canvas viewport container with 16:9 aspect ratio */}
        <div className="flex flex-col items-center justify-center w-full">
          <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-white shadow-inner select-none cursor-grab active:cursor-grabbing border border-border">
            <canvas
              ref={canvasRef}
              width={CONTAINER_WIDTH}
              height={CONTAINER_HEIGHT}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="touch-none block w-full h-full object-contain"
            />
          </div>

          {/* Zoom controls */}
          <div className="mt-5 flex w-full items-center gap-4 px-2">
            <span className="text-sm font-medium text-muted-foreground w-12">Zoom</span>
            <Slider
              min={0.5}
              max={3}
              step={0.05}
              value={[zoom]}
              onValueChange={([val]) => setZoom(val)}
              className="flex-1"
            />
            <Input
              type="number"
              min={0.5}
              max={3}
              step={0.1}
              value={Number(zoom.toFixed(1))}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0.5 && val <= 3) {
                  setZoom(val);
                }
              }}
              className="w-16 h-8 text-center text-sm font-mono"
            />
          </div>
        </div>

        <DialogFooter className="mt-6 flex items-center justify-between gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSaveCrop} disabled={!imageLoaded || isUploading} className="min-w-24">
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
