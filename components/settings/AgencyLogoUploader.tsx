"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BrandLogoSurface } from "@/lib/branding/logos";

export type AgencyLogoVariant = BrandLogoSurface;

const VARIANT_COPY: Record<
  AgencyLogoVariant,
  { title: string; description: string; previewBg: string; uploadType: string; fieldId: string }
> = {
  light: {
    title: "Logo for dark backgrounds",
    description:
      "Light or white version of your mark — for coloured headers, photos, and dark panels.",
    previewBg: "bg-[#002e36]",
    uploadType: "logo-light",
    fieldId: "logo_light_url",
  },
  dark: {
    title: "Logo for light backgrounds",
    description:
      "Full-colour or dark version of your mark — for report pages, white cards, and light panels.",
    previewBg: "bg-white",
    uploadType: "logo-dark",
    fieldId: "logo_dark_url",
  },
};

type Props = {
  variant: AgencyLogoVariant;
  value: string;
  onChange: (value: string) => void;
  agencyId?: string;
};

export function AgencyLogoUploader({ variant, value, onChange, agencyId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const copy = VARIANT_COPY[variant];

  async function uploadLogo(file: File) {
    if (!agencyId) {
      toast.error("Paste a logo link for now. After onboarding you can upload a file in Settings.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file for your logo.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", copy.uploadType);

    const response = await fetch("/api/agencies/upload-asset", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    setUploading(false);

    if (!response.ok) {
      toast.error(payload.error ?? "Logo upload failed");
      return;
    }

    onChange(payload.url);
    toast.success("Logo uploaded");
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4">
      <div>
        <Label htmlFor={copy.fieldId} className="text-base font-medium">
          {copy.title}
        </Label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.description}</p>
      </div>

      {value ? (
        <div className={`rounded-xl border border-border/60 p-4 ${copy.previewBg}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-16 object-contain" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No logo added yet
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input
          id={copy.fieldId}
          placeholder="https://your-agency.com/logo.png"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadLogo(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  );
}
