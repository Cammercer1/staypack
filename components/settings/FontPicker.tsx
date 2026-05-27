"use client";

import { useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  BODY_FONT_PRESETS,
  HEADING_FONT_PRESETS,
} from "@/lib/branding/presets";
import {
  getFontDisplayName,
  POPULAR_BODY_FONTS,
  POPULAR_HEADING_FONTS,
} from "@/lib/branding/google-fonts";
import { BrandFontLoader, useBrandFontStyles } from "@/components/settings/BrandFontLoader";
import { GoogleFontPickerModal } from "@/components/settings/GoogleFontPickerModal";
import type { AgencyInput } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";

type Props = {
  form: UseFormReturn<AgencyInput>;
  agencyId?: string;
};

function FontField({
  label,
  helper,
  value,
  popularPresets,
  presets,
  onBrowse,
  onQuickPick,
}: {
  label: string;
  helper: string;
  value: string;
  popularPresets: string[];
  presets: typeof HEADING_FONT_PRESETS;
  onBrowse: () => void;
  onQuickPick: (fontId: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/80 p-4">
      <div>
        <Label className="text-base font-medium">{label}</Label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{helper}</p>
      </div>

      <button
        type="button"
        onClick={onBrowse}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <div>
          <p className="text-sm text-muted-foreground">Current font</p>
          <p className="mt-1 text-base font-medium">{getFontDisplayName(value)}</p>
        </div>
        <Search className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Popular picks
        </p>
        <div className="flex flex-wrap gap-2">
          {popularPresets.map((presetId) => {
            const preset = presets.find((item) => item.id === presetId);
            if (!preset) return null;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onQuickPick(preset.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted/60",
                  value === preset.id && "border-primary bg-primary/5 text-primary",
                )}
              >
                {preset.label.split(" · ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={onBrowse}>
        <Search className="mr-2 h-4 w-4" />
        Browse all Google Fonts
      </Button>
    </div>
  );
}

export function FontPicker({ form, agencyId }: Props) {
  const headingUploadRef = useRef<HTMLInputElement>(null);
  const bodyUploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"heading" | "body" | null>(null);
  const [headingModalOpen, setHeadingModalOpen] = useState(false);
  const [bodyModalOpen, setBodyModalOpen] = useState(false);

  const fonts = {
    heading_font_family: form.watch("heading_font_family") || "fraunces",
    body_font_family: form.watch("body_font_family") || "inter",
    heading_font_file_url: form.watch("heading_font_file_url") || "",
    body_font_file_url: form.watch("body_font_file_url") || "",
  };

  const { headingFamily, bodyFamily } = useBrandFontStyles(fonts);

  async function uploadFont(file: File, target: "heading" | "body") {
    if (!agencyId) {
      toast.error("Finish onboarding first, then upload custom fonts in Settings.");
      return;
    }

    const allowed = [".woff", ".woff2", ".ttf", ".otf"];
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowed.includes(extension)) {
      toast.error("Upload a .woff, .woff2, .ttf or .otf font file.");
      return;
    }

    setUploading(target);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", target === "heading" ? "heading-font" : "body-font");

    const response = await fetch("/api/agencies/upload-asset", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    setUploading(null);

    if (!response.ok) {
      toast.error(payload.error ?? "Font upload failed");
      return;
    }

    if (target === "heading") {
      form.setValue("heading_font_file_url", payload.url, { shouldDirty: true });
    } else {
      form.setValue("body_font_file_url", payload.url, { shouldDirty: true });
    }

    toast.success(`${target === "heading" ? "Heading" : "Body"} font uploaded`);
  }

  return (
    <div className="space-y-6 rounded-2xl border border-border/70 bg-background/70 p-4">
      <BrandFontLoader fonts={fonts} />

      <div>
        <Label className="text-base font-medium">Report fonts</Label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Choose from the full Google Fonts library, or upload a custom font file
          if your agency has one from your marketing team.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FontField
          label="Heading font"
          helper="Used for report titles, property address and section headings."
          value={fonts.heading_font_family}
          popularPresets={POPULAR_HEADING_FONTS}
          presets={HEADING_FONT_PRESETS}
          onBrowse={() => setHeadingModalOpen(true)}
          onQuickPick={(fontId) =>
            form.setValue("heading_font_family", fontId, { shouldDirty: true })
          }
        />
        <FontField
          label="Body font"
          helper="Used for descriptions, notes, disclaimers and smaller text."
          value={fonts.body_font_family}
          popularPresets={POPULAR_BODY_FONTS}
          presets={BODY_FONT_PRESETS}
          onBrowse={() => setBodyModalOpen(true)}
          onQuickPick={(fontId) =>
            form.setValue("body_font_family", fontId, { shouldDirty: true })
          }
        />
      </div>

      <GoogleFontPickerModal
        open={headingModalOpen}
        onOpenChange={setHeadingModalOpen}
        title="Choose a heading font"
        description="Browse the full Google Fonts catalog. Headings look best in serif or display styles."
        value={fonts.heading_font_family}
        onSelect={(fontId) =>
          form.setValue("heading_font_family", fontId, { shouldDirty: true })
        }
      />

      <GoogleFontPickerModal
        open={bodyModalOpen}
        onOpenChange={setBodyModalOpen}
        title="Choose a body font"
        description="Browse the full Google Fonts catalog. Body text should stay clean and easy to read."
        value={fonts.body_font_family}
        onSelect={(fontId) =>
          form.setValue("body_font_family", fontId, { shouldDirty: true })
        }
      />

      <div
        className="rounded-xl border border-dashed border-border p-4"
        style={{ fontFamily: bodyFamily, color: "inherit" }}
      >
        <p className="text-lg font-semibold" style={{ fontFamily: headingFamily }}>
          Short-Term Rental Potential Report
        </p>
        <p className="mt-2 text-sm opacity-80">
          12 Example Street, Sunshine Coast QLD
        </p>
        <p className="mt-3 text-sm leading-6 opacity-80">
          This preview shows your heading font on the title and your body font on
          the property details and paragraph text.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="heading_font_upload">Custom heading font (optional)</Label>
          <input
            ref={headingUploadRef}
            id="heading_font_upload"
            type="file"
            accept=".woff,.woff2,.ttf,.otf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadFont(file, "heading");
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading === "heading"}
            onClick={() => headingUploadRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading === "heading" ? "Uploading..." : "Upload heading font"}
          </Button>
          {fonts.heading_font_file_url ? (
            <p className="text-xs text-muted-foreground">Custom heading font attached.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="body_font_upload">Custom body font (optional)</Label>
          <input
            ref={bodyUploadRef}
            id="body_font_upload"
            type="file"
            accept=".woff,.woff2,.ttf,.otf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadFont(file, "body");
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading === "body"}
            onClick={() => bodyUploadRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading === "body" ? "Uploading..." : "Upload body font"}
          </Button>
          {fonts.body_font_file_url ? (
            <p className="text-xs text-muted-foreground">Custom body font attached.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
