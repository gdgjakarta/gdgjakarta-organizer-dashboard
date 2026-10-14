"use client";

import { useEffect, useMemo, useState } from "react";

import { Package, Ruler, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EventMerchandiseItem } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface MerchandiseGalleryDialogProps {
  item: EventMerchandiseItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVariations?: Record<string, string>;
  isIncludedInTicket?: boolean;
  onOpenGuideline?: (item: EventMerchandiseItem) => void;
}

export function MerchandiseGalleryDialog({
  item,
  open,
  onOpenChange,
  selectedVariations,
  isIncludedInTicket,
  onOpenGuideline,
}: MerchandiseGalleryDialogProps) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Aggregate all unique images in prioritized order
  const images = useMemo(() => {
    if (!item) return [];
    const list: string[] = [];

    // 1. If currently selected variation has a specific image, place it first
    if (selectedVariations && item.variations) {
      for (const v of item.variations) {
        const selectedOpt = selectedVariations[v.name];
        if (selectedOpt) {
          const varImg = v.option_details?.[selectedOpt]?.image_url;
          if (varImg && !list.includes(varImg)) {
            list.push(varImg);
          }
        }
      }
    }

    // 2. Add primary image_url
    if (item.image_url && !list.includes(item.image_url)) {
      list.push(item.image_url);
    }

    // 3. Add all gallery photos from item.images
    if (item.images && item.images.length > 0) {
      for (const img of item.images) {
        if (img && !list.includes(img)) {
          list.push(img);
        }
      }
    }

    // 4. Add any other variation images not yet included
    if (item.variations) {
      for (const v of item.variations) {
        if (v.option_details) {
          for (const optKey of Object.keys(v.option_details)) {
            const optImg = v.option_details[optKey]?.image_url;
            if (optImg && !list.includes(optImg)) {
              list.push(optImg);
            }
          }
        }
      }
    }

    return list;
  }, [item, selectedVariations]);

  // Synchronize carousel slide index
  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrentSlide(api.selectedScrollSnap());
    };

    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);

    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  // Reset to first slide when item changes or modal reopens
  useEffect(() => {
    if (open && api) {
      api.scrollTo(0, true);
      setCurrentSlide(0);
    }
  }, [open, api]);

  if (!item) return null;

  const hasMultipleImages = images.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="font-semibold text-lg">{item.name}</DialogTitle>
            {isIncludedInTicket ? (
              <Badge
                variant="secondary"
                className="gap-1 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-xs text-amber-700 dark:text-amber-400"
              >
                <Sparkles className="size-3 text-amber-500" />
                Included with Ticket
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className={cn(
                  "px-2 py-0.5 font-medium text-xs",
                  item.is_free
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                )}
              >
                {item.is_free ? "Free Perk" : `Rp ${(item.price || 0).toLocaleString("id-ID")}`}
              </Badge>
            )}
            {item.tag && (
              <Badge variant="outline" className="text-xs">
                {item.tag}
              </Badge>
            )}
          </div>
          {item.description && (
            <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
              {item.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {images.length > 0 ? (
            <div className="relative">
              {/* Carousel Container */}
              <Carousel setApi={setApi} className="w-full">
                <CarouselContent>
                  {images.map((src, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: image list index
                    <CarouselItem key={`${src}-${index}`}>
                      <div className="relative flex aspect-square max-h-[50vh] w-full items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/30">
                        {/* biome-ignore lint/performance/noImgElement: gallery preview */}
                        {/* biome-ignore lint/a11y/useAltText: merchandise gallery image */}
                        <img src={src} className="size-full object-contain p-2 transition-transform duration-300" />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>

                {hasMultipleImages && (
                  <>
                    <CarouselPrevious className="left-2 bg-background/80 shadow-md backdrop-blur-xs hover:bg-background" />
                    <CarouselNext className="right-2 bg-background/80 shadow-md backdrop-blur-xs hover:bg-background" />
                  </>
                )}
              </Carousel>

              {/* Photo Counter Badge */}
              {hasMultipleImages && (
                <div className="absolute right-3 bottom-3 z-10">
                  <Badge
                    variant="secondary"
                    className="border border-border/50 bg-background/90 font-mono text-[11px] shadow-xs backdrop-blur-xs"
                  >
                    {currentSlide + 1} / {images.length}
                  </Badge>
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-square max-h-[40vh] w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 text-muted-foreground">
              <Package className="size-12 opacity-30" />
              <p className="mt-2 text-xs">No product photos available for this merchandise item.</p>
            </div>
          )}

          {/* Thumbnail Strip */}
          {hasMultipleImages && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {images.map((src, idx) => {
                const isActive = idx === currentSlide;
                return (
                  <button
                    type="button"
                    // biome-ignore lint/suspicious/noArrayIndexKey: thumbnail index
                    key={`thumb-${src}-${idx}`}
                    onClick={() => api?.scrollTo(idx)}
                    className={cn(
                      "relative size-14 shrink-0 overflow-hidden rounded-lg border bg-muted/30 transition-all cursor-pointer",
                      isActive
                        ? "border-primary ring-2 ring-primary/40 shadow-xs"
                        : "border-border/70 opacity-60 hover:opacity-100",
                    )}
                  >
                    {/* biome-ignore lint/performance/noImgElement: thumbnail */}
                    {/* biome-ignore lint/a11y/useAltText: thumbnail */}
                    <img src={src} className="size-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Sizing Guideline Shortcut if available */}
          {item.guideline &&
            (Boolean(item.guideline.title) || Boolean(item.guideline.text) || Boolean(item.guideline.image_url)) && (
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 p-2.5">
                <div className="flex items-center gap-2">
                  <Ruler className="size-4 text-primary" />
                  <span className="font-medium text-foreground text-xs">
                    {item.guideline.title ?? "Sizing Guideline & Measurements"}
                  </span>
                </div>
                {onOpenGuideline && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenGuideline(item);
                    }}
                  >
                    View Guideline
                  </Button>
                )}
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
