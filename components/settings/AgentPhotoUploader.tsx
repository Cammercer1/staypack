"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  fieldId: string;
  fallbackInitial?: string;
  /** Hover-to-change photo on the avatar instead of a replace button. */
  hoverToChange?: boolean;
  readOnly?: boolean;
};

export function AgentPhotoUploader({
  value,
  onChange,
  fieldId,
  fallbackInitial = "?",
  hoverToChange = false,
  readOnly = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadPhoto(file: File) {
    if (readOnly) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/agents/upload-photo", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    setUploading(false);

    if (!response.ok) {
      toast.error(payload.error ?? "Photo upload failed");
      return;
    }

    onChange(payload.url);
    toast.success("Photo uploaded");
  }

  function openFilePicker() {
    if (!uploading && !readOnly) {
      inputRef.current?.click();
    }
  }

  const avatarClassName =
    "h-20 w-20 shrink-0 rounded-full object-cover ring-1 ring-border/60";
  const placeholderClassName =
    "flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-medium ring-1 ring-border/60";

  return (
    <div className="space-y-3 md:col-span-2">
      {!hoverToChange ? <Label htmlFor={fieldId}>Photo</Label> : null}

      <div className="flex flex-wrap items-center gap-4">
        {hoverToChange && readOnly ? (
          value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className={avatarClassName} />
          ) : (
            <div className={placeholderClassName}>
              {fallbackInitial.trim().charAt(0) || "?"}
            </div>
          )
        ) : hoverToChange ? (
          <button
            type="button"
            aria-label={value ? "Change photo" : "Add photo"}
            disabled={uploading}
            onClick={openFilePicker}
            className={cn(
              "group relative shrink-0 overflow-hidden rounded-full ring-1 ring-border/60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              uploading && "cursor-wait opacity-70",
            )}
          >
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" className={avatarClassName} />
            ) : (
              <div className={placeholderClassName}>
                {fallbackInitial.trim().charAt(0) || "?"}
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 px-2 text-center text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {uploading ? "Uploading..." : value ? "Change photo" : "Add photo"}
            </span>
          </button>
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={avatarClassName} />
        ) : (
          <div className={placeholderClassName}>
            {fallbackInitial.trim().charAt(0) || "?"}
          </div>
        )}

        {!hoverToChange && !readOnly ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={openFilePicker}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : value ? "Replace photo" : "Upload photo"}
            </Button>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={() => onChange("")}
              >
                <X className="mr-2 h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
        ) : hoverToChange && !readOnly && value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading}
            onClick={() => onChange("")}
          >
            <X className="mr-2 h-4 w-4" />
            Remove
          </Button>
        ) : null}

        <input
          id={fieldId}
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          disabled={readOnly}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void uploadPhoto(file);
            }
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
