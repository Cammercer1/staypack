"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  MAX_REPORT_IMAGES,
  MAX_UPLOADED_IMAGES,
} from "@/lib/reports/constants";
import { cn } from "@/lib/utils";
import { dedupeImageUrls } from "@/lib/listings/dedupeImageUrls";

const COMPRESS_IF_BYTES = 4 * 1024 * 1024;
const MAX_UPLOAD_LONG_EDGE = 4000;
const PRINT_SAFE_LONG_EDGE = 2500;

type UploadStatus = {
  currentName: string;
  currentSizeBytes: number;
  currentIndex: number;
  total: number;
  progressPercent: number;
  optimizedCount: number;
};

type Props = {
  scrapedImages?: string[];
  rawScrapedCount?: number;
  uploadedImages: string[];
  heroImageUrl?: string;
  selectedImageUrls?: string[];
  reportId?: string;
  listingId?: string;
  maxSelected?: number;
  maxUploads?: number;
  title?: string;
  selectionHint?: string;
  onUploaded: (uploadedImageUrls: string[]) => void;
  onChange: (heroImageUrl: string, selectedImageUrls: string[]) => void;
};

export function ReportMediaPicker({
  scrapedImages = [],
  rawScrapedCount,
  uploadedImages,
  heroImageUrl = "",
  selectedImageUrls = [],
  reportId,
  listingId,
  maxSelected = MAX_REPORT_IMAGES,
  maxUploads = MAX_UPLOADED_IMAGES,
  title = "Report photos",
  selectionHint,
  onUploaded,
  onChange,
}: Props) {
  const displayScrapedImages = dedupeImageUrls(scrapedImages);
  const importedTotal = rawScrapedCount ?? scrapedImages.length;
  const canUpload = Boolean(reportId || listingId);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);

  const selected = selectedImageUrls.length
    ? selectedImageUrls
    : heroImageUrl
      ? [heroImageUrl]
      : [];

  const uploadSlotsRemaining = Math.max(0, maxUploads - uploadedImages.length);
  const selectionSlotsRemaining = Math.max(0, maxSelected - selected.length);

  async function getImageDimensions(file: File) {
    return new Promise<{ width: number; height: number }>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Unable to read image dimensions"));
      };
      img.src = url;
    });
  }

  async function optimizeImageIfNeeded(file: File) {
    if (!file.type.startsWith("image/")) {
      return { file, optimized: false, width: 0, height: 0 };
    }

    const { width, height } = await getImageDimensions(file);
    const longEdge = Math.max(width, height);
    const shouldCompress = file.size >= COMPRESS_IF_BYTES || longEdge > MAX_UPLOAD_LONG_EDGE;

    if (!shouldCompress) {
      return { file, optimized: false, width, height };
    }

    const scale = longEdge > MAX_UPLOAD_LONG_EDGE ? MAX_UPLOAD_LONG_EDGE / longEdge : 1;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return { file, optimized: false, width, height };
    }

    const imageBitmap = await createImageBitmap(file);
    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
    imageBitmap.close();

    const outputType =
      file.type === "image/jpeg" || file.type === "image/webp" || file.type === "image/avif"
        ? file.type
        : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, 0.88);
    });

    if (!blob || blob.size >= file.size * 0.98) {
      return { file, optimized: false, width, height };
    }

    const optimizedFile = new File([blob], file.name, {
      type: outputType,
      lastModified: file.lastModified,
    });

    return {
      file: optimizedFile,
      optimized: true,
      width: targetWidth,
      height: targetHeight,
    };
  }

  async function uploadAssetWithProgress(
    formData: FormData,
    onProgress: (percent: number) => void,
  ) {
    return new Promise<{ ok: boolean; status: number; payload: any }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/reports/upload-asset");
      xhr.responseType = "text";
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
        onProgress(percent);
      };
      xhr.onerror = () => reject(new Error("Image upload failed"));
      xhr.onload = () => {
        let payload: any = {};
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch {
          payload = {};
        }
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, payload });
      };
      xhr.send(formData);
    });
  }

  function toggleImage(image: string) {
    if (selected.includes(image)) {
      const nextSelected = selected.filter((item) => item !== image);
      const nextHero = heroImageUrl === image ? nextSelected[0] ?? "" : heroImageUrl;
      onChange(nextHero, nextSelected);
      return;
    }

    if (selected.length >= maxSelected) {
      toast.error(`You can select up to ${maxSelected} images`);
      return;
    }

    const nextSelected = [...selected, image];
    onChange(heroImageUrl || image, nextSelected);
  }

  function setHero(image: string) {
    if (!selected.includes(image)) {
      if (selected.length >= maxSelected) {
        toast.error(`You can select up to ${maxSelected} images for the report`);
        return;
      }
      onChange(image, [...selected, image]);
      return;
    }

    onChange(image, selected);
  }

  async function uploadImages(files: File[]) {
    if (!reportId && !listingId) {
      toast.error("Save the listing first to upload photos.");
      return;
    }

    if (uploadSlotsRemaining <= 0) {
      toast.error(`You can upload up to ${maxUploads} photos per report`);
      return;
    }

    const filesToUpload = files.slice(0, uploadSlotsRemaining);
    if (files.length > uploadSlotsRemaining) {
      toast.message(
        `Only ${uploadSlotsRemaining} upload slot${uploadSlotsRemaining === 1 ? "" : "s"} left`,
      );
    }

    setUploading(true);
    setUploadStatus(null);
    let nextUploaded = [...uploadedImages];
    let nextSelected = [...selected];
    let nextHero = heroImageUrl;
    let optimizedCount = 0;
    let lowResCount = 0;

    for (const [index, originalFile] of filesToUpload.entries()) {
      const { file, optimized, width, height } = await optimizeImageIfNeeded(originalFile);
      if (optimized) {
        optimizedCount += 1;
      }
      if (Math.max(width, height) < PRINT_SAFE_LONG_EDGE) {
        lowResCount += 1;
      }

      setUploadStatus({
        currentName: originalFile.name,
        currentSizeBytes: file.size,
        currentIndex: index + 1,
        total: filesToUpload.length,
        progressPercent: 0,
        optimizedCount,
      });

      const formData = new FormData();
      formData.append("file", file);
      if (reportId) {
        formData.append("report_id", reportId);
      }
      if (listingId) {
        formData.append("listing_id", listingId);
      }

      const { ok, payload } = await uploadAssetWithProgress(formData, (progressPercent) => {
        setUploadStatus((current) =>
          current
            ? {
                ...current,
                progressPercent,
              }
            : current,
        );
      });

      if (!ok) {
        toast.error(payload.error ?? "Image upload failed");
        break;
      }

      if (!nextUploaded.includes(payload.url)) {
        nextUploaded = [...nextUploaded, payload.url];
      }

      if (
        nextSelected.length < maxSelected &&
        !nextSelected.includes(payload.url)
      ) {
        nextSelected = [...nextSelected, payload.url];
        if (!nextHero) {
          nextHero = payload.url;
        }
      }
    }

    if (nextUploaded.length > uploadedImages.length) {
      onUploaded(nextUploaded);
      onChange(nextHero, nextSelected);
      toast.success(
        nextUploaded.length - uploadedImages.length === 1
          ? "Photo uploaded"
          : `${nextUploaded.length - uploadedImages.length} photos uploaded`,
      );
      if (optimizedCount > 0) {
        toast.message(
          `Optimized ${optimizedCount} photo${optimizedCount === 1 ? "" : "s"} for faster upload while keeping print-safe quality.`,
        );
      }
      if (lowResCount > 0) {
        toast.message(
          `${lowResCount} photo${lowResCount === 1 ? "" : "s"} may look soft in A4 print due to low resolution.`,
        );
      }
    }

    setUploadStatus(null);
    setUploading(false);
  }

  function handleFiles(files: FileList | File[]) {
    const imageFiles = [...files].filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      toast.error("Choose PNG, JPG, WEBP or AVIF images");
      return;
    }

    void uploadImages(imageFiles);
  }

  const hasMedia = displayScrapedImages.length > 0 || uploadedImages.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {title ? <p className="text-sm font-medium">{title}</p> : null}
          <p className="text-xs text-muted-foreground">
            {selected.length} of {maxSelected} selected
            {selectionHint ? ` · ${selectionHint}` : ""} · {uploadedImages.length}{" "}
            uploaded
          </p>
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-border/80 bg-muted/10",
          (!canUpload || uploading || uploadSlotsRemaining <= 0) && "opacity-60",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (!canUpload || uploading || uploadSlotsRemaining <= 0) return;
          handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={uploadRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="hidden"
          multiple
          onChange={(event) => {
            const files = event.target.files;
            if (!files?.length) return;
            handleFiles(files);
            event.target.value = "";
          }}
        />
        <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          Add your own photos
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag and drop up to {maxUploads} photos, or browse from your device.
          Importing from a listing URL often misses gallery images — uploads fill the gap.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={uploading || !canUpload || uploadSlotsRemaining <= 0}
          onClick={() => uploadRef.current?.click()}
        >
          {uploading ? "Uploading..." : "Browse photos"}
        </Button>
        {uploadStatus ? (
          <div className="mx-auto mt-3 max-w-md space-y-2 text-left">
            <p className="text-xs text-muted-foreground">
              Uploading {uploadStatus.currentIndex} of {uploadStatus.total}:{" "}
              <span className="font-medium text-foreground">{uploadStatus.currentName}</span>
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-150"
                style={{ width: `${uploadStatus.progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {uploadStatus.progressPercent}% · {(uploadStatus.currentSizeBytes / (1024 * 1024)).toFixed(1)}MB
              {uploadStatus.optimizedCount > 0
                ? ` · ${uploadStatus.optimizedCount} optimized`
                : ""}
            </p>
          </div>
        ) : null}
      </div>

      {displayScrapedImages.length ? (
        <MediaSection
          title="From listing"
          subtitle={`${displayScrapedImages.length} unique${
            importedTotal !== displayScrapedImages.length
              ? ` (${importedTotal} imported)`
              : " photos"
          }`}
          images={displayScrapedImages}
          selected={selected}
          heroImageUrl={heroImageUrl}
          onToggle={toggleImage}
          onSetHero={setHero}
        />
      ) : null}

      {uploadedImages.length ? (
        <MediaSection
          title="Your uploads"
          subtitle={`${uploadedImages.length} saved`}
          images={uploadedImages}
          selected={selected}
          heroImageUrl={heroImageUrl}
          onToggle={toggleImage}
          onSetHero={setHero}
        />
      ) : null}

      {!hasMedia ? (
        <p className="text-sm text-muted-foreground">
          No photos yet. Upload property photos above, or import a listing URL to
          import some automatically.
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Click to select (max {maxSelected}). Double-click to set the hero image.
      </p>
    </div>
  );
}

function MediaSection({
  title,
  subtitle,
  images,
  selected,
  heroImageUrl,
  onToggle,
  onSetHero,
}: {
  title: string;
  subtitle: string;
  images: string[];
  selected: string[];
  heroImageUrl: string;
  onToggle: (image: string) => void;
  onSetHero: (image: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.map((image) => {
          const isSelected = selected.includes(image);
          const isHero = heroImageUrl === image;

          return (
            <button
              key={image}
              type="button"
              onClick={() => onToggle(image)}
              onDoubleClick={() => onSetHero(image)}
              className={cn(
                "relative overflow-hidden rounded-lg border",
                isSelected && "ring-2 ring-primary",
                isHero && "ring-2 ring-foreground",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="aspect-[4/3] w-full object-cover" />
              {isHero ? (
                <span className="absolute top-2 left-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
                  Hero
                </span>
              ) : null}
              {isSelected && !isHero ? (
                <span className="absolute top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Selected
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
