"use client";

import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BODY_FONT_PRESETS,
  HEADING_FONT_PRESETS,
} from "@/lib/branding/presets";
import {
  getFontDisplayName,
  POPULAR_BODY_FONTS,
  POPULAR_HEADING_FONTS,
  type GoogleFontListItem,
} from "@/lib/branding/google-fonts";
import { BrandFontLoader, useBrandFontStyles } from "@/components/settings/BrandFontLoader";
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
  onQuickPick,
}: {
  label: string;
  helper: string;
  value: string;
  popularPresets: string[];
  presets: typeof HEADING_FONT_PRESETS;
  onQuickPick: (fontId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GoogleFontListItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: trimmed,
          limit: "10",
        });
        const response = await fetch(`/api/google-fonts?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to search fonts");
        }
        setResults(payload.fonts ?? []);
        setOpen(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/80 p-4">
      <div>
        <Label className="text-base font-medium">{label}</Label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{helper}</p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Current font</p>
        <p className="mt-1 text-base font-medium">{getFontDisplayName(value)}</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 100);
          }}
          placeholder="Type 2+ letters to search Google Fonts"
          className="pl-9"
        />
        {open ? (
          <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-white p-1 shadow-md">
            {loading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Searching fonts...</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No fonts found.</div>
            ) : (
              results.map((font) => (
                <button
                  key={font.family}
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/60"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onQuickPick(font.family);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  {font.family}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

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
    </div>
  );
}

export function FontPicker({ form, agencyId }: Props) {
  const headingUploadRef = useRef<HTMLInputElement>(null);
  const bodyUploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"heading" | "body" | null>(null);

  const fonts = {
    heading_font_family: form.watch("heading_font_family") || "fraunces",
    body_font_family: form.watch("body_font_family") || "inter",
    heading_font_file_url: form.watch("heading_font_file_url") || "",
    body_font_file_url: form.watch("body_font_file_url") || "",
  };

  const { headingFamily, bodyFamily } = useBrandFontStyles(fonts);

  async function uploadFont(file: File, target: "heading" | "body") {
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
          onQuickPick={(fontId) =>
            form.setValue("body_font_family", fontId, { shouldDirty: true })
          }
        />
      </div>

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
