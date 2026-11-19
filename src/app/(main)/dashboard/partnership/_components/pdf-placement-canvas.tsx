"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChevronLeft, ChevronRight, Copy, Layers, Loader2, Trash2, ZoomIn, ZoomOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PdfPlacement } from "@/types/partner-signage";

import type { CreatedSignatureAsset } from "./signature-creator-studio";

interface PdfPlacementCanvasProps {
  file: File;
  activePageIndex: number;
  onActivePageChange: (pageIndex: number) => void;
  onPageCountResolved: (pageCount: number) => void;
  placements: PdfPlacement[];
  selectedPlacementId: string | null;
  onSelectPlacement: (id: string | null) => void;
  onUpdatePlacement: (id: string, patch: Partial<PdfPlacement>) => void;
  onDeletePlacement: (id: string) => void;
  onDuplicatePlacement: (id: string) => void;
  onCopyPlacementToAllPages: (id: string) => void;
  assetsById: Record<string, CreatedSignatureAsset>;
  signerName: string;
  signerTitle: string;
  /** Upper bound (px) for "fit" zoom when the parent column wraps PDF content width. */
  maxFitWidth?: number;
}

type ZoomOption = "fit" | 0.75 | 1 | 1.25;

interface DragSession {
  mode: "move" | "resize";
  placementId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  boxWidthPx: number;
  boxHeightPx: number;
  aspectRatio?: number;
}

export function PdfPlacementCanvas({
  file,
  activePageIndex,
  onActivePageChange,
  onPageCountResolved,
  placements,
  selectedPlacementId,
  onSelectPlacement,
  onUpdatePlacement,
  onDeletePlacement,
  onDuplicatePlacement,
  onCopyPlacementToAllPages,
  assetsById,
  signerName,
  signerTitle,
  maxFitWidth,
}: PdfPlacementCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(680);
  const [zoomMode, setZoomMode] = useState<ZoomOption>("fit");

  const [pdfDoc, setPdfDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(true);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 595,
    height: 842,
  });

  const dragSessionRef = useRef<DragSession | null>(null);
  const placementRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const onPageCountResolvedRef = useRef(onPageCountResolved);
  const onActivePageChangeRef = useRef(onActivePageChange);
  onPageCountResolvedRef.current = onPageCountResolved;
  onActivePageChangeRef.current = onActivePageChange;

  // Auto-scroll and focus newly selected/placed signature overlay
  useEffect(() => {
    if (!selectedPlacementId) return;
    const rafId = requestAnimationFrame(() => {
      const el = placementRefs.current.get(selectedPlacementId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        el.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [selectedPlacementId]);

  // Measure available container width for Fit mode (skipped when parent supplies maxFitWidth to avoid w-fit resize loops)
  useEffect(() => {
    if (typeof maxFitWidth === "number" && maxFitWidth > 0) {
      setContainerWidth(Math.max(280, maxFitWidth));
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const next = Math.max(280, el.clientWidth - 24);
      setContainerWidth(next);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [maxFitWidth]);

  // Load PDF document from File using pdfjs-dist
  useEffect(() => {
    let cancelled = false;
    let loadingTask: import("pdfjs-dist").PDFDocumentLoadingTask | null = null;

    const loadPdf = async () => {
      setIsLoadingDoc(true);
      setLoadError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const rawBuf = await file.arrayBuffer();
        const bytesCopy = new Uint8Array(rawBuf.slice(0));
        loadingTask = pdfjs.getDocument({ data: bytesCopy });
        const loadedDoc = await loadingTask.promise;

        if (cancelled) {
          await loadingTask.destroy();
          return;
        }

        setPdfDoc(loadedDoc);
        setPageCount(loadedDoc.numPages);
        onPageCountResolvedRef.current(loadedDoc.numPages);
        onActivePageChangeRef.current(0);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load PDF preview.";
          setLoadError(
            msg.toLowerCase().includes("password")
              ? "This PDF is password-protected. Please upload an unlocked PDF."
              : msg,
          );
          setPdfDoc(null);
          setPageCount(0);
          onPageCountResolvedRef.current(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDoc(false);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      if (loadingTask) {
        void loadingTask.destroy();
      }
    };
  }, [file]);

  // Render active page onto canvas
  useEffect(() => {
    if (!pdfDoc || pageCount === 0) return;
    const safePageNum = Math.min(Math.max(1, activePageIndex + 1), pageCount);

    let cancelled = false;
    let renderTask: import("pdfjs-dist").RenderTask | null = null;

    const renderPage = async () => {
      setIsRenderingPage(true);
      try {
        const page = await pdfDoc.getPage(safePageNum);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const maxFitScale = typeof maxFitWidth === "number" && maxFitWidth > 0 ? 1 : 2;
        const targetScale =
          zoomMode === "fit"
            ? Math.max(0.45, Math.min(maxFitScale, containerWidth / Math.max(1, baseViewport.width)))
            : zoomMode;

        const viewport = page.getViewport({ scale: targetScale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
        canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        renderTask = page.render({
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });

        await renderTask.promise;
      } catch (err) {
        // Ignore expected render cancellations on rapid page/zoom switches
        if (
          err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name: string }).name === "RenderingCancelledException"
        ) {
          return;
        }
        if (!cancelled) {
          console.error("[PdfPlacementCanvas] Render error:", err);
        }
      } finally {
        if (!cancelled) {
          setIsRenderingPage(false);
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageCount, activePageIndex, zoomMode, containerWidth, maxFitWidth]);

  const currentPagePlacements = useMemo(
    () => placements.filter((p) => p.pageIndex === activePageIndex),
    [placements, activePageIndex],
  );

  const placementCountsByPage = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of placements) {
      counts.set(p.pageIndex, (counts.get(p.pageIndex) ?? 0) + 1);
    }
    return counts;
  }, [placements]);

  const startPointerDrag = (e: React.PointerEvent<HTMLElement>, placement: PdfPlacement, mode: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    onSelectPlacement(placement.id);

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const asset = placement.assetId ? assetsById[placement.assetId] : undefined;
    dragSessionRef.current = {
      mode,
      placementId: placement.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: placement.xPct,
      startY: placement.yPct,
      startW: placement.widthPct,
      startH: placement.heightPct,
      boxWidthPx: Math.max(1, viewportSize.width),
      boxHeightPx: Math.max(1, viewportSize.height),
      aspectRatio: placement.kind === "text_stamp" ? undefined : asset?.aspectRatio,
    };
  };

  const handlePointerMoveOverlay = (e: React.PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current;
    if (!session) return;

    const dxPct = (e.clientX - session.startClientX) / session.boxWidthPx;
    const dyPct = (e.clientY - session.startClientY) / session.boxHeightPx;

    if (session.mode === "move") {
      const nextX = Math.min(Math.max(0, session.startX + dxPct), 1 - session.startW);
      const nextY = Math.min(Math.max(0, session.startY + dyPct), 1 - session.startH);
      onUpdatePlacement(session.placementId, {
        xPct: nextX,
        yPct: nextY,
      });
    } else {
      const minW = 0.06;
      const maxW = Math.min(0.8, 1 - session.startX);
      let nextW = Math.min(maxW, Math.max(minW, session.startW + dxPct));
      let nextH: number;

      if (session.aspectRatio && session.aspectRatio > 0) {
        const canvasAspect = session.boxWidthPx / session.boxHeightPx;
        nextH = (nextW * canvasAspect) / session.aspectRatio;
        if (session.startY + nextH > 1) {
          nextH = 1 - session.startY;
          nextW = Math.max(minW, (nextH * session.aspectRatio) / canvasAspect);
        }
      } else {
        const minH = 0.045;
        const maxH = Math.min(0.35, 1 - session.startY);
        nextH = Math.min(maxH, Math.max(minH, session.startH + dyPct));
      }

      onUpdatePlacement(session.placementId, {
        widthPct: nextW,
        heightPct: nextH,
      });
    }
  };

  const handlePointerEndOverlay = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragSessionRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragSessionRef.current = null;
  };

  const handleOverlayKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, placement: PdfPlacement) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onDeletePlacement(placement.id);
      return;
    }

    const step = e.shiftKey ? 0.02 : 0.005;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onUpdatePlacement(placement.id, { xPct: Math.max(0, placement.xPct - step) });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onUpdatePlacement(placement.id, { xPct: Math.min(1 - placement.widthPct, placement.xPct + step) });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onUpdatePlacement(placement.id, { yPct: Math.max(0, placement.yPct - step) });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onUpdatePlacement(placement.id, { yPct: Math.min(1 - placement.heightPct, placement.yPct + step) });
    }
  };

  const zoomOut = () => {
    if (zoomMode === "fit" || zoomMode === 1) setZoomMode(0.75);
    else if (zoomMode === 1.25) setZoomMode(1);
  };

  const zoomIn = () => {
    if (zoomMode === 0.75) setZoomMode(1);
    else if (zoomMode === 1 || zoomMode === "fit") setZoomMode(1.25);
  };

  return (
    <div className="flex max-w-full flex-col rounded-xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7"
            disabled={activePageIndex <= 0 || pageCount === 0}
            onClick={() => onActivePageChange(Math.max(0, activePageIndex - 1))}
            title="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[84px] text-center text-xs font-medium text-foreground">
            {pageCount > 0 ? `Page ${activePageIndex + 1} / ${pageCount}` : "Loading..."}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7"
            disabled={pageCount === 0 || activePageIndex >= pageCount - 1}
            onClick={() => onActivePageChange(Math.min(pageCount - 1, activePageIndex + 1))}
            title="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7"
            onClick={zoomOut}
            disabled={zoomMode === 0.75}
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          {(["fit", 0.75, 1, 1.25] as ZoomOption[]).map((opt) => (
            <Button
              key={String(opt)}
              type="button"
              variant={zoomMode === opt ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => setZoomMode(opt)}
            >
              {opt === "fit" ? "Fit" : `${Math.round(opt * 100)}%`}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7"
            onClick={zoomIn}
            disabled={zoomMode === 1.25}
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Scrollable Canvas Stage */}
      <div
        ref={containerRef}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || e.target === canvasRef.current) {
            onSelectPlacement(null);
          }
        }}
        className="relative flex min-h-[460px] max-h-[72vh] w-full items-start justify-center overflow-auto bg-zinc-200/70 dark:bg-zinc-900/70 p-3"
      >
        {isLoadingDoc ? (
          <div className="flex h-[380px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs font-medium">Rendering PDF pages locally...</p>
          </div>
        ) : loadError ? (
          <div className="my-12 max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-center">
            <p className="text-sm font-semibold text-destructive">Unable to open PDF</p>
            <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
          </div>
        ) : (
          <div
            className="relative shrink-0 shadow-lg ring-1 ring-black/10 bg-white"
            style={{ width: viewportSize.width, height: viewportSize.height }}
          >
            <canvas ref={canvasRef} className="block" />

            {isRenderingPage && (
              <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-background/85 px-2 py-1 text-[11px] font-medium shadow-xs flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                Rendering...
              </div>
            )}

            {/* Placement Overlay Layer */}
            <div className="pointer-events-none absolute inset-0">
              {currentPagePlacements.map((placement) => {
                const isSelected = selectedPlacementId === placement.id;
                const asset = placement.assetId ? assetsById[placement.assetId] : undefined;
                const showToolbarBelow = placement.yPct < 0.09;

                return (
                  <div
                    key={placement.id}
                    style={{
                      left: `${placement.xPct * 100}%`,
                      top: `${placement.yPct * 100}%`,
                      width: `${placement.widthPct * 100}%`,
                      height: `${placement.heightPct * 100}%`,
                    }}
                    className={`pointer-events-auto group absolute select-none rounded transition-shadow ${
                      isSelected
                        ? "ring-2 ring-primary bg-primary/5 shadow-sm z-20"
                        : "ring-1 ring-primary/50 hover:ring-primary bg-primary/2 z-10"
                    }`}
                  >
                    <button
                      ref={(el) => {
                        if (el) {
                          placementRefs.current.set(placement.id, el);
                        } else {
                          placementRefs.current.delete(placement.id);
                        }
                      }}
                      type="button"
                      aria-label={`${placement.kind} placement on page ${placement.pageIndex + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPlacement(placement.id);
                      }}
                      onKeyDown={(e) => handleOverlayKeyDown(e, placement)}
                      onPointerDown={(e) => startPointerDrag(e, placement, "move")}
                      onPointerMove={handlePointerMoveOverlay}
                      onPointerUp={handlePointerEndOverlay}
                      onPointerCancel={handlePointerEndOverlay}
                      className="block h-full w-full touch-none cursor-grab active:cursor-grabbing rounded focus:outline-hidden"
                    >
                      {placement.kind === "text_stamp" ? (
                        <div className="flex h-full w-full items-center justify-between gap-2 overflow-hidden rounded border border-blue-200 bg-sky-50/95 pl-2 pr-2 py-1 text-left shadow-2xs border-l-4 border-l-blue-600">
                          <div className="flex min-w-0 flex-1 flex-col justify-center">
                            {placement.includeCertBadge !== false && (
                              <span className="truncate text-[8px] font-bold uppercase tracking-wide text-emerald-700">
                                Digitally Signed • GDG Jakarta
                              </span>
                            )}
                            <span className="truncate text-[10px] font-bold text-slate-900">
                              {placement.signerName || signerName || "Authorized Organizer"}
                            </span>
                            {(placement.signerTitle || signerTitle) && (
                              <span className="truncate text-[8px] text-slate-600">
                                {placement.signerTitle || signerTitle}
                              </span>
                            )}
                            <span className="truncate text-[8px] text-slate-500">
                              {placement.signedDateText || "Signed Date"}
                            </span>
                          </div>
                          {asset && (
                            <img
                              src={asset.dataUrl}
                              alt={asset.label}
                              draggable={false}
                              className="pointer-events-none h-full max-w-[38%] shrink-0 object-contain"
                            />
                          )}
                        </div>
                      ) : asset ? (
                        <img
                          src={asset.dataUrl}
                          alt={asset.label}
                          draggable={false}
                          className="pointer-events-none h-full w-full object-contain"
                        />
                      ) : null}
                    </button>

                    {/* Floating Quick Toolbar when selected */}
                    {isSelected && (
                      <div
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`absolute left-0 flex items-center gap-0.5 rounded-md border border-border bg-popover px-1 py-0.5 shadow-md z-30 ${
                          showToolbarBelow ? "top-full mt-1.5" : "-top-8"
                        }`}
                      >
                        {pageCount > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] gap-1"
                            title="Copy this placement to all pages"
                            onClick={() => onCopyPlacementToAllPages(placement.id)}
                          >
                            <Layers className="h-3 w-3 text-primary" />
                            All Pages
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          title="Duplicate on this page"
                          onClick={() => onDuplicatePlacement(placement.id)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remove placement"
                          onClick={() => onDeletePlacement(placement.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Bottom-Right Resize Handle */}
                    <button
                      type="button"
                      aria-label="Resize placement"
                      onPointerDown={(e) => startPointerDrag(e, placement, "resize")}
                      onPointerMove={handlePointerMoveOverlay}
                      onPointerUp={handlePointerEndOverlay}
                      onPointerCancel={handlePointerEndOverlay}
                      title="Drag to resize"
                      className={`absolute -bottom-1.5 -right-1.5 size-3.5 touch-none rounded-full border-2 border-white bg-primary shadow-sm cursor-nwse-resize ${
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Page Switcher Strip */}
      {pageCount > 1 && (
        <div className="flex w-full lg:w-0 lg:min-w-full items-center gap-1.5 overflow-x-auto border-t border-border bg-muted/20 px-3 py-2">
          <span className="text-[11px] font-medium text-muted-foreground shrink-0 mr-1">Pages:</span>
          {Array.from({ length: pageCount }, (_, idx) => {
            const count = placementCountsByPage.get(idx) ?? 0;
            const isActive = idx === activePageIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onActivePageChange(idx)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                <span>P{idx + 1}</span>
                {count > 0 && (
                  <Badge
                    variant={isActive ? "secondary" : "outline"}
                    className="h-4 min-w-4 px-1 text-[10px] leading-none"
                  >
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
