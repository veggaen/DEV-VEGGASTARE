"use client";

/**
 * ImagePositionAdjuster — drag-to-frame an image in a dialog before saving.
 *
 * A thin dialog around ImageFramer (which owns the geometry, drag, zoom and
 * canvas export). Used by Settings; the profile page frames in place instead.
 */

import { useCallback, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FiMove } from "react-icons/fi";
import { FramerZoom, ImageFramer, type ImageFramerHandle } from "@/components/uicustom/image-framer";
import { cn } from "@/lib/utils";

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

export function ImagePositionAdjuster({ file, aspect, round = false, outputWidth, outputHeight, title = "Position your image", onCancel, onConfirm }: ImagePositionAdjusterProps) {
  const framer = useRef<ImageFramerHandle>(null);
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const onReady = useCallback((value: boolean) => setReady(value), []);

  const handleConfirm = async () => {
    if (!framer.current) return;
    setExporting(true);
    try {
      onConfirm(await framer.current.export(outputWidth, outputHeight));
    } catch {
      // Fall back: cancel gracefully rather than trapping the user
      onCancel();
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={file !== null} onOpenChange={(open) => { if (!open && !exporting) { setZoom(1); onCancel(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="flex items-center gap-2 text-base">
          <FiMove className="h-4 w-4 text-brand-accent" />
          {title}
        </DialogTitle>
        <p className="-mt-2 text-sm text-muted-foreground">Drag to move · scroll or use the slider to zoom · arrow keys to nudge</p>
        <ImageFramer
          ref={framer}
          file={file}
          aspect={aspect}
          round={round}
          zoom={zoom}
          onZoomChange={setZoom}
          onReady={onReady}
          // Tall frames (avatars) are capped by the viewport height; width follows so the ratio holds.
          className={cn("mx-auto rounded-xl border border-border", aspect < 1.5 && "w-[min(100%,56vh)]")}
        />
        <FramerZoom zoom={zoom} onZoomChange={setZoom} onReset={() => framer.current?.reset()} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setZoom(1); onCancel(); }} disabled={exporting}>Cancel</Button>
          <Button variant="vegaEmeraldBtn" onClick={handleConfirm} disabled={exporting || !ready}>{exporting ? "Preparing…" : "Use this framing"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ImagePositionAdjuster;
