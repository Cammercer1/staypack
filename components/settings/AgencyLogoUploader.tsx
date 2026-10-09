"use client";

import { cn } from "@/lib/utils";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadBrandAsset } from "@/lib/branding/assetUpload";
import type { BrandLogoSurface } from "@/lib/branding/logos";

export type AgencyLogoVariant = BrandLogoSurface;
type Props = {
  variant: AgencyLogoVariant;
  value: string;
  onChange: (value: string) => void;
  agencyId?: string;
  onUploadStateChange?: (busy: boolean) => void;
};

export function AgencyLogoUploader({
  variant,
  value,
  onChange,
  onUploadStateChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const title = variant === "dark" ? "Main logo" : "Logo for dark backgrounds";
  async function upload(file: File) {
    setError("");
    setUploading(true);
    onUploadStateChange?.(true);
    try {
      onChange(
        await uploadBrandAsset(
          file,
          variant === "dark" ? "logo-dark" : "logo-light",
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
      onUploadStateChange?.(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex min-h-32 items-center justify-center rounded-xl border border-border/60 p-6",
          variant === "light" ? "bg-foreground" : "bg-white",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt={`${title} preview`}
            width={240}
            height={80}
            className="h-20 w-60 max-w-full object-contain"
          />
        ) : (
          <p
            className={cn(
              "text-sm",
              variant === "light" ? "text-background" : "text-muted-foreground",
            )}
          >
            Your logo will appear here
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        aria-label={title}
        id={`logo-${variant}`}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          {uploading
            ? "Uploading…"
            : value
              ? `Replace ${title.toLowerCase()}`
              : `Upload ${title.toLowerCase()}`}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            disabled={uploading}
            onClick={() => {
              onChange("");
              setError("");
            }}
          >
            Remove {title.toLowerCase()}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        PNG, JPG, WebP or SVG · Up to 5 MB. A transparent background works best.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
