"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useEdgeStore } from "@/lib/edgestore";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, X, Upload, Loader2, Clipboard, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import NextImage from "next/image";

interface ImageInfo {
  url: string;
  width: number;
  height: number;
  aspectRatio: "portrait" | "landscape" | "square";
  size: number;
}

interface ImagePasteInputProps {
  questionId: string;
  label?: string;
  description?: string;
  value?: ImageInfo[];
  onChange: (images: ImageInfo[]) => void;
  maxImages?: number;
  maxSizeKB?: number;
  disabled?: boolean;
  placeholder?: string;
}

function detectAspectRatio(width: number, height: number): "portrait" | "landscape" | "square" {
  const ratio = width / height;
  if (ratio > 1.1) return "landscape";
  if (ratio < 0.9) return "portrait";
  return "square";
}

export function ImagePasteInput({
  questionId,
  label = "Add images",
  description = "Paste image (Ctrl+V) or click to upload",
  value = [],
  onChange,
  maxImages = 4,
  maxSizeKB = 5120, // 5MB default
  disabled = false,
  placeholder = "Paste or drop an image here",
}: ImagePasteInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  const { edgestore } = useEdgeStore();

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Upload image to EdgeStore
  const uploadImage = useCallback(
    async (file: File) => {
      if (disabled || value.length >= maxImages) {
        setError(`Maximum ${maxImages} images allowed`);
        return;
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file");
        return;
      }

      // Validate file size
      const sizeKB = file.size / 1024;
      if (sizeKB > maxSizeKB) {
        setError(`Image too large. Max size: ${maxSizeKB / 1024}MB`);
        return;
      }

      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      try {
        // Get image dimensions before upload
        const dimensions = await getImageDimensions(file);

        // Upload to EdgeStore
        const res = await edgestore.myPublicImages.upload({
          file,
          onProgressChange: (progress) => {
            setUploadProgress(progress);
          },
        });

        const imageInfo: ImageInfo = {
          url: res.url,
          width: dimensions.width,
          height: dimensions.height,
          aspectRatio: detectAspectRatio(dimensions.width, dimensions.height),
          size: file.size,
        };

        onChange([...value, imageInfo]);
      } catch (err) {
        console.error("Upload error:", err);
        setError("Failed to upload image. Please try again.");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [disabled, value, maxImages, maxSizeKB, edgestore, onChange]
  );

  // Get image dimensions
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  // Handle paste event
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            uploadImage(file);
          }
          break;
        }
      }
    },
    [uploadImage]
  );

  // Handle drop event
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith("image/")) {
        uploadImage(files[0]);
      }
    },
    [uploadImage]
  );

  // Handle file input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadImage(file);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [uploadImage]
  );

  // Remove image
  const removeImage = useCallback(
    (index: number) => {
      const newImages = value.filter((_, i) => i !== index);
      onChange(newImages);
    },
    [value, onChange]
  );

  // Global paste listener when focused
  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Only handle if this component's drop zone is focused or hovered
      if (document.activeElement === dropZone || isDragOver) {
        handlePaste(e);
      }
    };

    document.addEventListener("paste", handleGlobalPaste);
    return () => document.removeEventListener("paste", handleGlobalPaste);
  }, [handlePaste, isDragOver]);

  const canAddMore = value.length < maxImages;

  return (
    <div className="w-full space-y-4">
      {/* Label */}
      {label && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">{label}</h4>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      {/* Image Grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {value.map((img, index) => (
              <motion.div
                key={`${questionId}-img-${index}`}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={cn(
                  "relative group rounded-lg overflow-hidden border bg-muted",
                  img.aspectRatio === "portrait" && "row-span-2",
                  img.aspectRatio === "landscape" && "col-span-2"
                )}
              >
                <div className="relative w-full min-h-[100px] h-full">
                  <NextImage
                    src={img.url}
                    alt={`Uploaded image ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
                
                {/* Aspect ratio badge */}
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] font-medium bg-black/60 text-white rounded">
                  {img.aspectRatio} • {img.width}×{img.height}
                </div>

                {/* Remove button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Drop Zone */}
      {canAddMore && (
        <div
          ref={dropZoneRef}
          tabIndex={disabled ? -1 : 0}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onPaste={(e) => handlePaste(e.nativeEvent as ClipboardEvent)}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={cn(
            "relative flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-dashed transition-all cursor-pointer outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isDragOver
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50",
            isUploading && "pointer-events-none opacity-70",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={disabled || isUploading}
            className="sr-only"
            aria-label="Upload image"
          />

          {isUploading ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <div className="w-full max-w-[200px]">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-muted">
                  <ImagePlus className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="p-2 rounded-full bg-muted">
                  <Clipboard className="w-6 h-6 text-muted-foreground" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  {placeholder}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Click, drag & drop, or press Ctrl+V
                </p>
              </div>
              {value.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {value.length}/{maxImages} images
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-2 text-sm text-destructive bg-destructive/10 rounded-lg flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ImagePasteInput;
