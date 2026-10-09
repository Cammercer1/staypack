"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "./AgentAvatar";
import { cropSource, validateAgentPhoto } from "@/lib/agents/photo";

type Props = {
  value: string;
  onChange: (value: string) => void;
  fieldId: string;
  fallbackInitial?: string;
  hoverToChange?: boolean;
  readOnly?: boolean;
  onBusyChange?: (busy: boolean) => void;
};
export function AgentPhotoUploader({
  value,
  onChange,
  fieldId,
  fallbackInitial = "",
  readOnly = false,
  onBusyChange,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = !!source || uploading;
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (!source) return;
    const picture = new Image();
    picture.onload = () => {
      image.current = picture;
      setLoaded(true);
    };
    picture.onerror = () => {
      setError("This photo could not be opened. Choose another image.");
      setSource(null);
    };
    picture.src = source;
    return () => {
      picture.onload = null;
      picture.onerror = null;
      URL.revokeObjectURL(source);
    };
  }, [source]);
  useEffect(() => {
    if (!loaded || !image.current || !canvas.current) return;
    const context = canvas.current.getContext("2d");
    const picture = image.current;
    const crop = cropSource(
      picture.naturalWidth,
      picture.naturalHeight,
      zoom,
      x,
      y,
    );
    context?.clearRect(0, 0, 640, 640);
    context?.drawImage(
      picture,
      crop.x,
      crop.y,
      crop.size,
      crop.size,
      0,
      0,
      640,
      640,
    );
  }, [loaded, zoom, x, y]);

  function choose(file: File) {
    const problem = validateAgentPhoto(file);
    setError(problem);
    if (problem) return;
    setLoaded(false);
    setZoom(1);
    setX(50);
    setY(50);
    setSource(URL.createObjectURL(file));
  }
  async function upload() {
    if (!canvas.current || !loaded) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.current!.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("Could not prepare this photo.")),
          "image/webp",
          0.9,
        ),
      );
      const body = new FormData();
      body.append(
        "file",
        new File([blob], "agent-photo.webp", { type: "image/webp" }),
      );
      const response = await fetch("/api/agents/upload-photo", {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.url)
        throw new Error(
          payload?.error || "Photo upload failed. Please try again.",
        );
      onChange(payload.url);
      setSource(null);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Photo upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }
  return (
    <section className="space-y-3" aria-label="Agent photo">
      <div className="flex flex-wrap items-center gap-4">
        <AgentAvatar
          name={fallbackInitial}
          src={value}
          className="size-20 text-xl"
        />
        {!readOnly && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <Upload className="size-4" />
                {value ? "Change photo" : "Upload photo"}
              </Button>
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onChange("")}
                >
                  <X className="size-4" />
                  Remove photo
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Optional · PNG, JPG, WebP or AVIF · Up to 5 MB
            </p>
          </div>
        )}
      </div>
      <input
        ref={input}
        id={fieldId}
        aria-label="Choose agent photo"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="sr-only"
        disabled={readOnly || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) choose(file);
          event.target.value = "";
        }}
      />
      {source && (
        <div className="space-y-4 rounded-xl border border-base-300 bg-muted/30 p-4">
          <div>
            <h3 className="font-medium">Frame your photo</h3>
            <p className="text-xs text-muted-foreground">
              Adjust the position and zoom. The circle previews your profile
              photo.
            </p>
          </div>
          <canvas
            ref={canvas}
            width={640}
            height={640}
            aria-label="Cropped agent photo preview"
            className="mx-auto aspect-square w-40 max-w-full rounded-full bg-muted"
          />
          {!loaded && <p role="status">Opening photo…</p>}
          {[
            {
              label: "Zoom",
              value: zoom,
              set: setZoom,
              min: 1,
              max: 3,
              step: 0.05,
            },
            {
              label: "Horizontal position",
              value: x,
              set: setX,
              min: 0,
              max: 100,
              step: 1,
            },
            {
              label: "Vertical position",
              value: y,
              set: setY,
              min: 0,
              max: 100,
              step: 1,
            },
          ].map((control) => (
            <label key={control.label} className="block text-sm">
              {control.label}
              <input
                type="range"
                className="mt-2 block w-full accent-primary"
                aria-label={control.label}
                min={control.min}
                max={control.max}
                step={control.step}
                value={control.value}
                disabled={uploading || !loaded}
                onChange={(event) => control.set(Number(event.target.value))}
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={uploading || !loaded}
              onClick={upload}
            >
              {uploading ? "Uploading…" : "Use photo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => setSource(null)}
            >
              Cancel photo change
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {value && !source && !readOnly && (
        <p className="text-xs text-muted-foreground">
          Save your changes to keep this photo.
        </p>
      )}
    </section>
  );
}
