"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_BRAND_ADVANCED,
  getBrandButtonInlineStyle,
  hasBrandAdvancedOverrides,
  parseAgencyBrandAdvanced,
  resolveBrandAdvanced,
  type AgencyBrandAdvanced,
} from "@/lib/branding/advanced";
import type { Agency } from "@/lib/types";
import type { AgencyInput } from "@/lib/validation/schemas";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agency: Agency;
  form: UseFormReturn<AgencyInput>;
  onSaved?: (agency: Agency) => void;
};

type FieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
};

function AdvancedField({ label, hint, children }: FieldProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function RadiusPresetButtons({
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

export function BrandAdvancedSettingsModal({
  open,
  onOpenChange,
  agency,
  form,
  onSaved,
}: Props) {
  const [draft, setDraft] = useState<AgencyBrandAdvanced>(DEFAULT_BRAND_ADVANCED);
  const [saving, setSaving] = useState(false);

  const previewAgency = useMemo(
    () => ({
      primary_colour: form.watch("primary_colour") || agency.primary_colour,
      text_colour: form.watch("text_colour") || agency.text_colour,
      brand_advanced_json: draft,
    }),
    [agency.primary_colour, agency.text_colour, draft, form],
  );

  const resolved = useMemo(
    () => resolveBrandAdvanced(previewAgency),
    [previewAgency],
  );

  useEffect(() => {
    if (!open) return;

    const current = parseAgencyBrandAdvanced(
      form.getValues("brand_advanced_json") ?? agency.brand_advanced_json,
    );
    setDraft(current);
  }, [agency.brand_advanced_json, form, open]);

  function updateDraft(patch: Partial<AgencyBrandAdvanced>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      ...form.getValues(),
      brand_advanced_json: draft,
    };

    const response = await fetch("/api/agencies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      toast.error(result.error ?? "Failed to save advanced settings");
      setSaving(false);
      return;
    }

    form.setValue(
      "brand_advanced_json",
      draft as AgencyInput["brand_advanced_json"],
      { shouldDirty: false },
    );
    onSaved?.(result.agency as Agency);
    toast.success("Advanced settings saved");
    setSaving(false);
    onOpenChange(false);
  }

  function handleReset() {
    setDraft(DEFAULT_BRAND_ADVANCED);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,820px)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Advanced brand settings
          </DialogTitle>
          <DialogDescription>
            Fine-tune buttons, corners, and links on landing pages and buyer-facing
            collateral. Changes apply across your account immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <AdvancedField
            label="Buttons"
            hint="Leave colours empty to use your brand primary and white text."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="adv_button_bg" className="text-xs">
                  Background
                </Label>
                <Input
                  id="adv_button_bg"
                  type="color"
                  value={draft.button_background_colour ?? agency.primary_colour}
                  onChange={(event) =>
                    updateDraft({ button_background_colour: event.target.value })
                  }
                  className="h-11 w-full cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adv_button_text" className="text-xs">
                  Text
                </Label>
                <Input
                  id="adv_button_text"
                  type="color"
                  value={draft.button_text_colour ?? "#ffffff"}
                  onChange={(event) =>
                    updateDraft({ button_text_colour: event.target.value })
                  }
                  className="h-11 w-full cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Corner radius</Label>
              <RadiusPresetButtons
                value={draft.button_border_radius_px ?? 0}
                onChange={(px) => updateDraft({ button_border_radius_px: px })}
                presets={[
                  { label: "Square", px: 0 },
                  { label: "Soft", px: 6 },
                  { label: "Rounded", px: 12 },
                  { label: "Pill", px: 32 },
                ]}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="adv_button_border_w" className="text-xs">
                  Border width (px)
                </Label>
                <Input
                  id="adv_button_border_w"
                  type="number"
                  min={0}
                  max={8}
                  value={draft.button_border_width_px ?? 0}
                  onChange={(event) =>
                    updateDraft({
                      button_border_width_px: Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adv_button_border_c" className="text-xs">
                  Border colour
                </Label>
                <Input
                  id="adv_button_border_c"
                  type="color"
                  value={draft.button_border_colour ?? "#002e36"}
                  onChange={(event) =>
                    updateDraft({ button_border_colour: event.target.value })
                  }
                  className="h-11 w-full cursor-pointer"
                />
              </div>
            </div>
          </AdvancedField>

          <AdvancedField
            label="Links & panels"
            hint="Used for enquiry forms, cards, and text links on listing pages."
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="adv_link" className="text-xs">
                  Link colour
                </Label>
                <Input
                  id="adv_link"
                  type="color"
                  value={draft.link_colour ?? agency.primary_colour}
                  onChange={(event) =>
                    updateDraft({ link_colour: event.target.value })
                  }
                  className="h-11 w-full max-w-[8rem] cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Panel corner radius</Label>
                <RadiusPresetButtons
                  value={draft.card_border_radius_px ?? 0}
                  onChange={(px) => updateDraft({ card_border_radius_px: px })}
                  presets={[
                    { label: "Square", px: 0 },
                    { label: "Soft", px: 8 },
                    { label: "Rounded", px: 16 },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Input corner radius</Label>
                <RadiusPresetButtons
                  value={draft.input_border_radius_px ?? 4}
                  onChange={(px) => updateDraft({ input_border_radius_px: px })}
                  presets={[
                    { label: "Square", px: 0 },
                    { label: "Soft", px: 4 },
                    { label: "Rounded", px: 8 },
                  ]}
                />
              </div>
            </div>
          </AdvancedField>

          <div className="rounded-xl border border-dashed border-border/80 bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <div
              className="mt-3 space-y-3 border border-black/10 bg-white/90 p-4"
              style={{ borderRadius: resolved.cardBorderRadiusPx }}
            >
              <p className="text-sm font-semibold" style={{ color: resolved.linkColour }}>
                Sample heading link colour
              </p>
              <Input
                readOnly
                value="Sample input"
                className="bg-white"
                style={{ borderRadius: resolved.inputBorderRadiusPx }}
              />
              <button
                type="button"
                className="px-5 py-2.5 text-sm font-semibold shadow-sm"
                style={getBrandButtonInlineStyle(resolved)}
              >
                Sample button
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={saving || !hasBrandAdvancedOverrides(draft)}
          >
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save advanced settings"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
