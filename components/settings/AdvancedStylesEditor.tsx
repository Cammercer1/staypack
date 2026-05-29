"use client";

import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CARD_SHADOW_PRESETS,
  DEFAULT_BRAND_ADVANCED,
  hasBrandAdvancedOverrides,
  type AgencyBrandAdvanced,
} from "@/lib/branding/advanced";
import type { AgencyInput } from "@/lib/validation/schemas";

function RadiusPresets({
  value,
  onChange,
  presets,
}: {
  value: number;
  onChange: (px: number) => void;
  presets: { label: string; px: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.label}
          type="button"
          size="sm"
          variant={value === preset.px ? "default" : "outline"}
          onClick={() => onChange(preset.px)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}

function AdvancedSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

type Props = {
  form: UseFormReturn<AgencyInput>;
};

export function AdvancedStylesEditor({ form }: Props) {
  const preview = form.watch();
  const primaryColour = preview.primary_colour || "#2563eb";
  const advancedDraft = (preview.brand_advanced_json ?? {}) as AgencyBrandAdvanced;

  function updateAdvanced(patch: Partial<AgencyBrandAdvanced>) {
    const current = (form.getValues("brand_advanced_json") ?? {}) as AgencyBrandAdvanced;
    form.setValue(
      "brand_advanced_json",
      { ...current, ...patch } as AgencyInput["brand_advanced_json"],
      { shouldDirty: true, shouldValidate: true },
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Fine-tune buttons, corners and links for listing pages and collateral.
      </p>

      <AdvancedSection
        label="Buttons"
        hint="Leave colours as-is to follow your brand colours."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Background</Label>
            <Input
              type="color"
              value={advancedDraft.button_background_colour ?? primaryColour}
              onChange={(e) => updateAdvanced({ button_background_colour: e.target.value })}
              className="h-11 w-full cursor-pointer"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Text</Label>
            <Input
              type="color"
              value={advancedDraft.button_text_colour ?? "#ffffff"}
              onChange={(e) => updateAdvanced({ button_text_colour: e.target.value })}
              className="h-11 w-full cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Corner radius</Label>
          <RadiusPresets
            value={advancedDraft.button_border_radius_px ?? 0}
            onChange={(px) => updateAdvanced({ button_border_radius_px: px })}
            presets={[
              { label: "Square", px: 0 },
              { label: "Soft", px: 6 },
              { label: "Rounded", px: 12 },
              { label: "Pill", px: 32 },
            ]}
          />
        </div>
      </AdvancedSection>

      <AdvancedSection
        label="Links"
        hint="Used for links and accented headings."
      >
        <div className="space-y-1.5">
          <Label className="text-xs">Link colour</Label>
          <Input
            type="color"
            value={advancedDraft.link_colour ?? primaryColour}
            onChange={(e) => updateAdvanced({ link_colour: e.target.value })}
            className="h-11 w-[8rem] cursor-pointer"
          />
        </div>
      </AdvancedSection>

      <AdvancedSection
        label="Cards & panels"
        hint="Applies to enquiry forms and info panels."
      >
        <div className="space-y-2">
          <Label className="text-xs">Corner radius</Label>
          <RadiusPresets
            value={advancedDraft.card_border_radius_px ?? 0}
            onChange={(px) => updateAdvanced({ card_border_radius_px: px })}
            presets={[
              { label: "Square", px: 0 },
              { label: "Soft", px: 8 },
              { label: "Rounded", px: 16 },
            ]}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Border width (px)</Label>
            <Input
              type="number"
              min={0}
              max={8}
              value={advancedDraft.card_border_width_px ?? 1}
              onChange={(e) =>
                updateAdvanced({
                  card_border_width_px: Number.isNaN(Number(e.target.value))
                    ? 1
                    : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Border colour</Label>
            <Input
              type="color"
              value={advancedDraft.card_border_colour ?? "#e5e7eb"}
              onChange={(e) => updateAdvanced({ card_border_colour: e.target.value })}
              className="h-11 w-full cursor-pointer"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Background colour</Label>
            <Input
              type="color"
              value={advancedDraft.card_background_colour ?? "#ffffff"}
              onChange={(e) => updateAdvanced({ card_background_colour: e.target.value })}
              className="h-11 w-full cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Drop shadow</Label>
          <div className="flex flex-wrap gap-2">
            {CARD_SHADOW_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                size="sm"
                variant={(advancedDraft.card_shadow ?? "none") === preset.value ? "default" : "outline"}
                onClick={() => updateAdvanced({ card_shadow: preset.value })}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </AdvancedSection>

      <AdvancedSection
        label="Inputs"
        hint="Text field corner style."
      >
        <RadiusPresets
          value={advancedDraft.input_border_radius_px ?? 4}
          onChange={(px) => updateAdvanced({ input_border_radius_px: px })}
          presets={[
            { label: "Square", px: 0 },
            { label: "Soft", px: 4 },
            { label: "Rounded", px: 8 },
          ]}
        />
      </AdvancedSection>

      {hasBrandAdvancedOverrides(advancedDraft) ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            form.setValue(
              "brand_advanced_json",
              DEFAULT_BRAND_ADVANCED as AgencyInput["brand_advanced_json"],
              { shouldDirty: true, shouldValidate: true },
            )
          }
        >
          Reset to defaults
        </Button>
      ) : null}
    </div>
  );
}
