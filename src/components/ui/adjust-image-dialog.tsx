"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface AdjustImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  aspectRatio?: number; // width / height, defaults to 1 (square)
  onConfirm: (croppedBlob: Blob) => Promise<void> | void;
}

export function AdjustImageDialog({
  open,
  onOpenChange,
  imageFile,
  aspectRatio = 1,
  onConfirm,
}: AdjustImageDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Load image preview source
  useEffect(() => {
    if (!imageFile) {
      setImageSrc(null);
      setNaturalSize({ width: 0, height: 0 });
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setNaturalSize({ width: naturalWidth, height: naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Base display dimensions inside the 256x256 crop window (contain fit)
  const CROP_BOX_SIZE = 256;
  const baseDims = React.useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) {
      return { width: CROP_BOX_SIZE, height: CROP_BOX_SIZE };
    }
    const scale = Math.max(
      CROP_BOX_SIZE / naturalSize.width,
      CROP_BOX_SIZE / naturalSize.height,
    );
    return {
      width: Math.round(naturalSize.width * scale),
      height: Math.round(naturalSize.height * scale),
    };
  }, [naturalSize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Generate cropped and compressed image output using canvas
  const handleSave = async () => {
    if (!imgRef.current || !containerRef.current) return;
    setIsSaving(true);

    try {
      const img = imgRef.current;
      const cropBox = containerRef.current.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      // Ratio of natural dimensions to rendered dimensions
      const scaleX = img.naturalWidth / imgRect.width;
      const scaleY = img.naturalHeight / imgRect.height;

      // Calculate the source and destination crop coordinates
      // When zoom < 1 (zoomed out), the rendered image can be smaller than the crop box.
      // We calculate the overlap between the crop box and the image in crop box coordinates.
      const overlapLeft = Math.max(cropBox.left, imgRect.left);
      const overlapTop = Math.max(cropBox.top, imgRect.top);
      const overlapRight = Math.min(cropBox.right, imgRect.right);
      const overlapBottom = Math.min(cropBox.bottom, imgRect.bottom);

      const targetDim = 800; // 800x800 is ideal for high-definition avatars
      const canvas = document.createElement("canvas");
      canvas.width = targetDim;
      canvas.height = Math.round(targetDim / aspectRatio);
      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("Canvas context not available");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Fill white background for transparent images
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (overlapRight > overlapLeft && overlapBottom > overlapTop) {
        const srcX = Math.max(0, (overlapLeft - imgRect.left) * scaleX);
        const srcY = Math.max(0, (overlapTop - imgRect.top) * scaleY);
        const srcWidth = Math.min(img.naturalWidth - srcX, (overlapRight - overlapLeft) * scaleX);
        const srcHeight = Math.min(img.naturalHeight - srcY, (overlapBottom - overlapTop) * scaleY);

        const destScaleX = canvas.width / cropBox.width;
        const destScaleY = canvas.height / cropBox.height;

        const destX = (overlapLeft - cropBox.left) * destScaleX;
        const destY = (overlapTop - cropBox.top) * destScaleY;
        const destWidth = (overlapRight - overlapLeft) * destScaleX;
        const destHeight = (overlapBottom - overlapTop) * destScaleY;

        ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, destX, destY, destWidth, destHeight);
      }

      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob"));
              return;
            }
            try {
              await onConfirm(blob);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          "image/jpeg",
          0.88,
        );
      });

      onOpenChange(false);
    } catch (err) {
      console.error("[AdjustImageDialog] crop failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6 sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Adjust Image</DialogTitle>
        </DialogHeader>

        {/* Viewport / Crop area container with macOS Preview-inspired translucent dark frosted glass surround */}
        <div className="relative flex h-80 w-full select-none items-center justify-center overflow-hidden rounded-xl bg-[#1e1e1e]/90 shadow-inner">
          {/* Subtle macOS Preview checkerboard / blur glass backdrop behind transparent pixels */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: `
                linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
                linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
                linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
              `,
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
            }}
          />
          {/* Frosted glass blur overlay */}
          <div className="absolute inset-0 pointer-events-none backdrop-blur-[20px] bg-gradient-to-b from-white/[0.04] to-black/30" />

          {/* Target crop frame with macOS Preview blue outline & subtle translucent matte surround */}
          <div
            ref={containerRef}
            className="pointer-events-none absolute z-10 size-64 rounded-2xl border-2 border-[#007AFF] shadow-[0_0_0_9999px_rgba(20,20,20,0.65)] ring-1 ring-black/40"
          />

          {/* Loading overlay when uploading to Bevy/storage */}
          {isSaving && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm text-white">
              <Loader2 className="size-8 animate-spin text-white" />
              <p className="text-xs font-medium tracking-wide">Uploading image to Bevy...</p>
            </div>
          )}

          {imageSrc && (
            <div
              className={`absolute ${isSaving ? "pointer-events-none" : "cursor-grab active:cursor-grabbing"}`}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
              onMouseDown={isSaving ? undefined : handleMouseDown}
              onTouchStart={isSaving ? undefined : handleTouchStart}
              onTouchMove={isSaving ? undefined : handleTouchMove}
              onTouchEnd={isSaving ? undefined : handleTouchEnd}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                draggable={false}
                onLoad={handleImageLoad}
                className="pointer-events-none select-none transition-transform duration-75"
                style={{
                  width: `${baseDims.width}px`,
                  height: `${baseDims.height}px`,
                  maxWidth: "none",
                  maxHeight: "none",
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                  imageRendering: "auto",
                }}
              />
            </div>
          )}
        </div>

        {/* Zoom Slider and Value control */}
        <div className="mt-2 flex items-center gap-4">
          <span className="text-xs font-medium text-muted-foreground">Zoom</span>
          <div className="flex-1">
            <Slider
              value={[zoom]}
              min={0.5}
              max={3}
              step={0.05}
              disabled={isSaving}
              onValueChange={(vals) => setZoom(vals[0] || 0.5)}
            />
          </div>
          <Input
            type="number"
            value={zoom.toFixed(1)}
            step={0.1}
            min={0.5}
            max={3}
            disabled={isSaving}
            onChange={(e) => {
              const val = Number.parseFloat(e.target.value);
              if (!Number.isNaN(val) && val >= 0.5 && val <= 3) {
                setZoom(val);
              }
            }}
            className="h-8 w-14 text-center text-xs font-medium"
          />
        </div>

        <DialogFooter className="mt-4 flex flex-row items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="text-xs text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !imageSrc}
            className="h-8 px-5 text-xs font-medium"
          >
            {isSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
