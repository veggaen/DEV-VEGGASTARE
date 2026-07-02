"use client";

/**
 * ImagePositionAdjuster — drag-to-frame an image before saving.
 *
 * Shown after picking a banner/avatar file: the user drags to position,
 * zooms with a slider, and the final framing is baked into the exported
 * image via canvas — so it renders identically everywhere with no extra
 * DB fields or object-position bookkeeping.
 *
 * Reduced-motion safe, touch + mouse (pointer events), keyboard-nudgeable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FiZoomIn, FiZoomOut, FiMove, FiRotateCcw } from "react-icons/fi";

export interface ImagePositionAdjusterProps {
  /** File to adjust — dialog is open while non-null */
  file: File | null;
  /** Output frame aspect ratio, e.g. 3 for a 3:1 banner, 1 for avatars */
  aspect: number;
  /** Render a circular mask preview (avatars) */
  round?: boolean;
  /** Exported image dimensions */
  outputWidth: number;
  outputHeight: number;
  title?: string;
  onCancel: () => void;
  /** Receives the framed image as a webp Blob */
  onConfirm: (blob: Blob) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function ImagePositionAdjuster({
  file,
  aspect,
  round = false,
  outputWidth,
  outputHeight,
  title = "Position your image",
  onCancel,
  onConfirm,
}: ImagePositionAdjusterProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frameW, setFrameW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);

  const frameH = frameW > 0 ? frameW / aspect : 0;

  // Load the file into an object URL + read natural dimensions
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      setNatural(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    const probe = new window.Image();
    probe.onload = () => setNatural({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Measure the frame (and re-measure on resize)
  useEffect(() => {
    if (!file) return;
    const measure = () => {
      if (frameRef.current) setFrameW(frameRef.current.clientWidth);
    };
    measure();
    // Dialog animates in — measure again next frame to catch final layout
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [file]);

  // Geometry: scale needed for the image to exactly cover the frame, × zoom
  const geometry = useMemo(() => {
    if (!natural || frameW === 0 || frameH === 0) return null;
    const coverScale = Math.max(frameW / natural.w, frameH / natural.h);
    const scale = coverScale * zoom;
    const dispW = natural.w * scale;
    const dispH = natural.h * scale;
    return {
      scale,
      dispW,
      dispH,
      maxX: Math.max(0, (dispW - frameW) / 2),
      maxY: Math.max(0, (dispH - frameH) / 2),
    };
  }, [natural, frameW, frameH, zoom]);

  const clamp = useCallback(
    (x: number, y: number) => {
      if (!geometry) return { x: 0, y: 0 };
      return {
        x: Math.min(geometry.maxX, Math.max(-geometry.maxX, x)),
        y: Math.min(geometry.maxY, Math.max(-geometry.maxY, y)),
      };
    },
    [geometry]
  );

  // Re-clamp when zoom changes (zooming out can strand the offset)
  useEffect(() => {
    setOffset((prev) => clamp(prev.x, prev.y));
  }, [clamp]);

  // ── Pointer drag ──────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clamp(dragRef.current.baseX + dx, dragRef.current.baseY + dy));
  };
  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  // Keyboard nudge (accessibility)
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    if (e.key === "ArrowLeft") setOffset((p) => clamp(p.x + step, p.y));
    else if (e.key === "ArrowRight") setOffset((p) => clamp(p.x - step, p.y));
    else if (e.key === "ArrowUp") setOffset((p) => clamp(p.x, p.y + step));
    else if (e.key === "ArrowDown") setOffset((p) => clamp(p.x, p.y - step));
    else return;
    e.preventDefault();
  };

  // ── Export: bake the framing into a canvas ────────────────────────────
  const handleConfirm = async () => {
    if (!natural || !geometry || !objectUrl) return;
    setExporting(true);
    try {
      const img = imgElRef.current ?? await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new window.Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = objectUrl;
      });

      // Visible source rect (in natural pixels)
      const srcW = frameW / geometry.scale;
      const srcH = frameH / geometry.scale;
      const srcX = natural.w / 2 - offset.x / geometry.scale - srcW / 2;
      const srcY = natural.h / 2 - offset.y / geometry.scale - srcH / 2;

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputWidth, outputHeight);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.92)
      );
      if (!blob) throw new Error("Export failed");
      onConfirm(blob);
    } catch {
      // Fall back: cancel gracefully rather than trapping the user
      onCancel();
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={file !== null} onOpenChange={(open) => { if (!open && !exporting) onCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="flex items-center gap-2 text-base">
          <FiMove className="h-4 w-4 text-brand-accent" />
          {title}
        </DialogTitle>
        <p className="-mt-2 text-sm text-muted-foreground">
          Drag to position · scroll the slider to zoom · arrow keys to nudge
        </p>

        {/* Frame */}
        <div
          ref={frameRef}
          role="application"
          aria-label="Image positioning area — drag or use arrow keys"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          className={`relative w-full select-none overflow-hidden rounded-xl border border-border bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            dragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ aspectRatio: `${aspect}`, touchAction: "none" }}
        >
          {objectUrl && natural && geometry ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgElRef}
                src={objectUrl}
                alt="Adjust position"
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: geometry.dispW,
                  height: geometry.dispH,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
              {/* Rule-of-thirds grid — appears while dragging */}
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${dragging ? "opacity-100" : "opacity-0"}`}
              >
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
                <div className="absolute top-1/3 left-0 w-full h-px bg-white/40" />
                <div className="absolute top-2/3 left-0 w-full h-px bg-white/40" />
              </div>
              {/* Circular mask preview for avatars */}
              {round && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: "radial-gradient(circle at center, transparent 49.5%, rgba(0,0,0,0.55) 50%)",
                  }}
                />
              )}
            </>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              Loading image…
            </div>
          )}
        </div>

        {/* Zoom control */}
        <div className="flex items-center gap-3">
          <FiZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[hsl(var(--brand-accent))]"
          />
          <FiZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          <button
            type="button"
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Reset position and zoom"
          >
            <FiRotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={exporting}>
            Cancel
          </Button>
          <Button variant="vegaEmeraldBtn" onClick={handleConfirm} disabled={exporting || !geometry}>
            {exporting ? "Preparing…" : "Use this framing"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ImagePositionAdjuster;
