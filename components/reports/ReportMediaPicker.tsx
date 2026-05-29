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
import { createClient } from "@/lib/supabase/client";
import {
  PRINT_SAFE_LONG_EDGE,
  createOptimizerWorker,
  optimizeOnMainThread,
  optimizeWithWorker,
} from "@/lib/reports/imageOptimizer";

// Number of files compressed + uploaded in parallel. Listings carry ~5-15
// photos, so a small cap keeps the network/CPU busy without overwhelming the
// browser or hitting storage rate limits.
const UPLOAD_CONCURRENCY = 4;

type UploadStatus = {
  total: number;
  completed: number;
  optimizedCount: number;
};

type SignedUpload = {
  path: string;
  token: string;
  publicUrl: string;
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
    setUploadStatus({ total: filesToUpload.length, completed: 0, optimizedCount: 0 });

    try {
      const signRes = await fetch("/api/reports/upload-asset/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: reportId,
          listing_id: listingId,
          files: filesToUpload.map((file) => ({ name: file.name, type: file.type })),
        }),
      });
      const signPayload = await signRes.json().catch(() => ({}));

      if (!signRes.ok) {
        toast.error(signPayload.error ?? "Upload failed");
        return;
      }

      const signedUploads: SignedUpload[] = signPayload.uploads ?? [];
      if (signedUploads.length !== filesToUpload.length) {
        toast.error("Upload failed");
        return;
      }

      const supabase = createClient();
      const concurrency = Math.min(UPLOAD_CONCURRENCY, filesToUpload.length);
      const workers = Array.from({ length: concurrency }, () => createOptimizerWorker());

      // Results are stored by original index so newly added photos keep their
      // upload order regardless of which lane finished first.
      const results: (SignedUpload | null)[] = new Array(filesToUpload.length).fill(null);
      let cursor = 0;
      let completed = 0;
      let optimizedCount = 0;
      let lowResCount = 0;
      let firstError: string | null = null;

      const runLane = async (worker: Worker | null) => {
        while (true) {
          const index = cursor;
          cursor += 1;
          if (index >= filesToUpload.length) return;

          const originalFile = filesToUpload[index];
          const target = signedUploads[index];

          try {
            const { file, optimized, width, height } = worker
              ? await optimizeWithWorker(worker, originalFile).catch(() =>
                  optimizeOnMainThread(originalFile),
                )
              : await optimizeOnMainThread(originalFile);

            if (optimized) {
              optimizedCount += 1;
            }
            if (width > 0 && Math.max(width, height) < PRINT_SAFE_LONG_EDGE) {
              lowResCount += 1;
            }

            const { error } = await supabase.storage
              .from("report-assets")
              .uploadToSignedUrl(target.path, target.token, file, {
                contentType: file.type || "image/jpeg",
              });

            if (error) {
              throw error;
            }

            results[index] = target;
          } catch (error) {
            if (!firstError) {
              firstError = error instanceof Error ? error.message : "Image upload failed";
            }
          } finally {
            completed += 1;
            const completedSoFar = completed;
            const optimizedSoFar = optimizedCount;
            setUploadStatus((current) =>
              current
                ? { ...current, completed: completedSoFar, optimizedCount: optimizedSoFar }
                : current,
            );
          }
        }
      };

      try {
        await Promise.all(workers.map((worker) => runLane(worker)));
      } finally {
        workers.forEach((worker) => worker?.terminate());
      }

      const succeeded = results.filter((result): result is SignedUpload => result !== null);

      if (succeeded.length === 0) {
        toast.error(firstError ?? "Image upload failed");
        return;
      }

      const finalizeRes = await fetch("/api/reports/upload-asset/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: reportId,
          listing_id: listingId,
          paths: succeeded.map((upload) => upload.path),
        }),
      });
      const finalizePayload = await finalizeRes.json().catch(() => ({}));

      if (!finalizeRes.ok) {
        toast.error(finalizePayload.error ?? "Failed to save uploads");
        return;
      }

      const serverUrls: string[] = finalizePayload.uploaded_image_urls ?? [];
      let nextSelected = [...selected];
      let nextHero = heroImageUrl;

      for (const upload of succeeded) {
        if (nextSelected.length < maxSelected && !nextSelected.includes(upload.publicUrl)) {
          nextSelected = [...nextSelected, upload.publicUrl];
          if (!nextHero) {
            nextHero = upload.publicUrl;
          }
        }
      }

      onUploaded(serverUrls);
      onChange(nextHero, nextSelected);

      toast.success(
        succeeded.length === 1 ? "Photo uploaded" : `${succeeded.length} photos uploaded`,
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
      if (firstError) {
        toast.error(
          `${filesToUpload.length - succeeded.length} photo${
            filesToUpload.length - succeeded.length === 1 ? "" : "s"
          } failed to upload`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploadStatus(null);
      setUploading(false);
    }
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
              Uploading{" "}
              <span className="font-medium text-foreground">
                {uploadStatus.completed} of {uploadStatus.total}
              </span>{" "}
              photo{uploadStatus.total === 1 ? "" : "s"}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-150"
                style={{
                  width: `${
                    uploadStatus.total
                      ? Math.round((uploadStatus.completed / uploadStatus.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {uploadStatus.total
                ? Math.round((uploadStatus.completed / uploadStatus.total) * 100)
                : 0}
              %
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
