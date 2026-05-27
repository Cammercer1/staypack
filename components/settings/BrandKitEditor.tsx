"use client";

import type { UseFormReturn } from "react-hook-form";
import { BRAND_COLOUR_FIELDS } from "@/lib/branding/presets";
import type { AgencyInput } from "@/lib/validation/schemas";
import { AgencyLogoUploader } from "@/components/settings/AgencyLogoUploader";
import { BrandPreviewCard } from "@/components/settings/BrandPreviewCard";
import { ColourField } from "@/components/settings/ColourField";
import { FontPicker } from "@/components/settings/FontPicker";
import { ReportTemplatePicker } from "@/components/reports/ReportTemplatePicker";

type Props = {
  form: UseFormReturn<AgencyInput>;
  agencyId?: string;
  showPreview?: boolean;
};

export function BrandKitEditor({
  form,
  agencyId,
  showPreview = true,
}: Props) {
  const preview = form.watch();

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h3 className="font-display text-xl tracking-tight">Step 1 · Logo</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This appears at the top of every buyer-facing report.
          </p>
        </div>
        <AgencyLogoUploader
          value={preview.logo_url ?? ""}
          onChange={(value) => form.setValue("logo_url", value, { shouldDirty: true })}
          agencyId={agencyId}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-display text-xl tracking-tight">Step 2 · Colours</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the colours buyers will see. You do not need to know hex codes — just
            choose what looks like your agency brand.
          </p>
        </div>
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

      <section className="space-y-4">
        <div>
          <h3 className="font-display text-xl tracking-tight">Step 3 · Fonts</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a heading font and a body font for reports. Browse the full
            Google Fonts library, or upload custom font files if your marketing
            team provides them.
          </p>
        </div>
        <FontPicker form={form} agencyId={agencyId} />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-display text-xl tracking-tight">Step 4 · Report template</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the default layout for new reports. Agents can pick a different
            template when generating an individual report.
          </p>
        </div>
        <ReportTemplatePicker
          value={preview.report_template_id ?? "classic"}
          onChange={(templateId) =>
            form.setValue("report_template_id", templateId, { shouldDirty: true })
          }
        />
      </section>

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
