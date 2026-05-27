"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: string;
  onChange: (value: string) => void;
  agencyId?: string;
};

export function AgencyLogoUploader({ value, onChange, agencyId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
    formData.append("type", "logo");

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
        <Label htmlFor="logo_url" className="text-base font-medium">
          Agency logo
        </Label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Add the logo that should appear at the top of every report. PNG or SVG
          with a transparent background works best.
        </p>
      </div>

      {value ? (
        <div className="rounded-xl border border-border/60 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Agency logo preview" className="h-16 object-contain" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No logo added yet
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input
          id="logo_url"
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
            {uploading ? "Uploading..." : "Upload logo"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste a link or upload a file. If upload is greyed out during onboarding,
        finish setup first then upload in Settings → Brand.
      </p>
    </div>
  );
}
