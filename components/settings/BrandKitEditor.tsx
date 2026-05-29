"use client";

import type { UseFormReturn } from "react-hook-form";
import { BRAND_COLOUR_FIELDS } from "@/lib/branding/presets";
import type { AgencyInput } from "@/lib/validation/schemas";
import { AgencyLogoUploader } from "@/components/settings/AgencyLogoUploader";
import { BrandPreviewCard } from "@/components/settings/BrandPreviewCard";
import { ColourField } from "@/components/settings/ColourField";
import { FontPicker } from "@/components/settings/FontPicker";

type Props = {
  form: UseFormReturn<AgencyInput>;
  agencyId?: string;
  showPreview?: boolean;
  numberedSections?: boolean;
  showSectionHeaders?: boolean;
  showLogos?: boolean;
  showColours?: boolean;
  showFonts?: boolean;
};

export function BrandKitEditor({
  form,
  agencyId,
  showPreview = true,
  numberedSections = true,
  showSectionHeaders = true,
  showLogos = true,
  showColours = true,
  showFonts = true,
}: Props) {
  const preview = form.watch();
  const sectionPrefix = numberedSections
    ? (index: number) => `Step ${index} · `
    : () => "";

  return (
    <div className="space-y-8">
      {showLogos ? (
        <section className="space-y-4">
          {showSectionHeaders ? (
            <div>
              <h3 className="font-display text-xl tracking-tight">
                {sectionPrefix(1)}Logos
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload two versions so reports and collateral pick the right mark for light
                and dark backgrounds.
              </p>
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <AgencyLogoUploader
              variant="dark"
              value={preview.logo_dark_url ?? preview.logo_url ?? ""}
              onChange={(value) => {
                form.setValue("logo_dark_url", value, { shouldDirty: true });
                if (!form.getValues("logo_light_url")) {
                  form.setValue("logo_url", value, { shouldDirty: true });
                }
              }}
              agencyId={agencyId}
            />
            <AgencyLogoUploader
              variant="light"
              value={preview.logo_light_url ?? ""}
              onChange={(value) =>
                form.setValue("logo_light_url", value, { shouldDirty: true })
              }
              agencyId={agencyId}
            />
          </div>
        </section>
      ) : null}

      {showColours ? (
        <section className="space-y-4">
          {showSectionHeaders ? (
            <div>
              <h3 className="font-display text-xl tracking-tight">
                {sectionPrefix(2)}Colours
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick the colours buyers will see. You do not need to know hex codes — just
                choose what looks like your agency brand.
              </p>
            </div>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-2">
            {BRAND_COLOUR_FIELDS.map((field) => (
              <ColourField
                key={field.key}
                form={form}
                name={field.key}
                label={field.label}
                helper={field.helper}
                example={field.example}
              />
            ))}
          </div>
        </section>
      ) : null}

      {showFonts ? (
        <section className="space-y-4">
          {showSectionHeaders ? (
            <div>
              <h3 className="font-display text-xl tracking-tight">
                {sectionPrefix(3)}Fonts
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a heading font and a body font for reports. Browse the full
                Google Fonts library, or upload custom font files if your marketing
                team provides them.
              </p>
            </div>
          ) : null}
          <FontPicker form={form} agencyId={agencyId} />
        </section>
      ) : null}

      {showPreview ? (
        <section className="space-y-4">
          <div>
            <h3 className="font-display text-xl tracking-tight">Live preview</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This is roughly how your report header will look to buyers.
            </p>
          </div>
          <BrandPreviewCard preview={preview} />
        </section>
      ) : null}
    </div>
  );
}
