"use client";

/**
 * @fileOverview  ImageFramer — the drag-to-frame surface itself, with no
 *                dialog around it. Renders a file (or the current image) at
 *                cover scale inside its frame; the user drags to pan, zooms
 *                with the wheel, a slider (controlled `zoom`) or the keyboard,
 *                and `export()` bakes exactly what the frame shows into a webp.
 *
 *                Used in place (the profile banner and avatar become editable
 *                where they sit) and inside ImagePositionAdjuster (a dialog).
 *
 *                Reduced-motion safe, touch + mouse, keyboard-nudgeable.
 * @stability     evolving
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export const FRAMER_MIN_ZOOM = 1;
export const FRAMER_MAX_ZOOM = 3;

export interface ImageFramerHandle {
  /** Bake the visible framing into a webp Blob of the given size. */
  export: (outputWidth: number, outputHeight: number) => Promise<Blob>;
  /** Back to cover scale, centred. */
  reset: () => void;
}

export interface ImageFramerProps {
  file: File | null;
  /** Frame aspect ratio when `fill` is false (e.g. 3 for a banner). */
  aspect: number;
  /** Fill the parent (which must be `relative`) instead of laying out an aspect box. */
  fill?: boolean;
  round?: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  className?: string;
  /** Called once the image has loaded and the frame is measured. */
  onReady?: (ready: boolean) => void;
}

const clampZoom = (z: number) => Math.min(FRAMER_MAX_ZOOM, Math.max(FRAMER_MIN_ZOOM, z));

export const ImageFramer = React.forwardRef<ImageFramerHandle, ImageFramerProps>(function ImageFramer(
  { file, aspect, fill = false, round = false, zoom, onZoomChange, className, onReady },
  ref,
) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const dragRef = React.useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = React.useState({ w: 0, h: 0 });
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);

  // File → object URL + natural size. A new file resets the framing.
  React.useEffect(() => {
    if (!file) { setObjectUrl(null); setNatural(null); setOffset({ x: 0, y: 0 }); return; }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setOffset({ x: 0, y: 0 });
    const probe = new window.Image();
    probe.onload = () => setNatural({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Frame size follows layout (dialog animating in, viewport resizing).
  React.useEffect(() => {
    const el = frameRef.current;
    if (!el || !file) return;
    const measure = () => setFrame({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const raf = requestAnimationFrame(measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [file]);

  const geometry = React.useMemo(() => {
    if (!natural || frame.w === 0 || frame.h === 0) return null;
    const scale = Math.max(frame.w / natural.w, frame.h / natural.h) * zoom;
    const dispW = natural.w * scale, dispH = natural.h * scale;
    return { scale, dispW, dispH, maxX: Math.max(0, (dispW - frame.w) / 2), maxY: Math.max(0, (dispH - frame.h) / 2) };
  }, [natural, frame, zoom]);

  const ready = Boolean(objectUrl && geometry);
  React.useEffect(() => { onReady?.(ready); }, [ready, onReady]);

  const clamp = React.useCallback((x: number, y: number) => {
    if (!geometry) return { x: 0, y: 0 };
    return { x: Math.min(geometry.maxX, Math.max(-geometry.maxX, x)), y: Math.min(geometry.maxY, Math.max(-geometry.maxY, y)) };
  }, [geometry]);

  // Zooming out can strand the offset outside the new bounds.
  React.useEffect(() => { setOffset((p) => clamp(p.x, p.y)); }, [clamp]);

  // Wheel zooms. Native listener: React's onWheel is passive and cannot preventDefault.
  React.useEffect(() => {
    const el = frameRef.current;
    if (!el || !file) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); onZoomChange(clampZoom(zoom - e.deltaY * 0.0015)); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [file, zoom, onZoomChange]);

  React.useImperativeHandle(ref, () => ({
    reset: () => { onZoomChange(1); setOffset({ x: 0, y: 0 }); },
    export: async (outputWidth, outputHeight) => {
      if (!natural || !geometry || !objectUrl) throw new Error("Image not ready");
      const img = imgRef.current ?? await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new window.Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = objectUrl;
      });
      const srcW = frame.w / geometry.scale, srcH = frame.h / geometry.scale;
      const srcX = natural.w / 2 - offset.x / geometry.scale - srcW / 2;
      const srcY = natural.h / 2 - offset.y / geometry.scale - srcH / 2;
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth; canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputWidth, outputHeight);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
      if (!blob) throw new Error("Export failed");
      return blob;
    },
  }), [natural, geometry, objectUrl, frame, offset, onZoomChange]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setOffset(clamp(dragRef.current.baseX + (e.clientX - dragRef.current.startX), dragRef.current.baseY + (e.clientY - dragRef.current.startY)));
  };
  const endDrag = () => { dragRef.current = null; setDragging(false); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    if (e.key === "ArrowLeft") setOffset((p) => clamp(p.x + step, p.y));
    else if (e.key === "ArrowRight") setOffset((p) => clamp(p.x - step, p.y));
    else if (e.key === "ArrowUp") setOffset((p) => clamp(p.x, p.y + step));
    else if (e.key === "ArrowDown") setOffset((p) => clamp(p.x, p.y - step));
    else if (e.key === "+" || e.key === "=") onZoomChange(clampZoom(zoom + 0.1));
    else if (e.key === "-") onZoomChange(clampZoom(zoom - 0.1));
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={frameRef}
      role="application"
      aria-label="Image framing area: drag to move, scroll to zoom, arrow keys to nudge"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className={cn(
        "select-none overflow-hidden bg-foreground/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-ring",
        fill ? "absolute inset-0" : "relative w-full",
        dragging ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
      style={{ touchAction: "none", ...(fill ? {} : { aspectRatio: `${aspect}` }) }}
    >
      {objectUrl && geometry ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={objectUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
            style={{ width: geometry.dispW, height: geometry.dispH, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
          />
          {/* Rule-of-thirds grid while dragging */}
          <div aria-hidden className={cn("pointer-events-none absolute inset-0 transition-opacity duration-200", dragging ? "opacity-100" : "opacity-0")}>
            <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
            <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
            <div className="absolute left-0 top-1/3 h-px w-full bg-white/40" />
            <div className="absolute left-0 top-2/3 h-px w-full bg-white/40" />
          </div>
          {round && <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at center, transparent 49.5%, rgba(0,0,0,0.55) 50%)" }} />}
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading image…</div>
      )}
    </div>
  );
});

/** The zoom slider that pairs with an ImageFramer; lives wherever the toolbar is. */
export function FramerZoom({ zoom, onZoomChange, className, onReset }: { zoom: number; onZoomChange: (z: number) => void; className?: string; onReset?: () => void }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span aria-hidden className="text-[11px] text-muted-foreground">−</span>
      <input
        type="range" min={FRAMER_MIN_ZOOM} max={FRAMER_MAX_ZOOM} step={0.01} value={zoom}
        onChange={(e) => onZoomChange(Number(e.target.value))} aria-label="Zoom"
        className="h-1.5 w-full min-w-16 cursor-pointer appearance-none rounded-full bg-foreground/[0.15] accent-[hsl(var(--brand-accent))]"
      />
      <span aria-hidden className="text-[11px] text-muted-foreground">+</span>
      {onReset && <button type="button" onClick={onReset} className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground">Reset</button>}
    </div>
  );
}

export default ImageFramer;
