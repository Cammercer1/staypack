"use client";

import { useMemo } from "react";
import { useState } from "react";
import { useForm, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { BrandKitEditor } from "@/components/settings/BrandKitEditor";
import { BrandPreviewCard } from "@/components/settings/BrandPreviewCard";
import { BrandAgencyPreviewCard } from "@/components/settings/BrandAgencyPreviewCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CARD_SHADOW_PRESETS,
  DEFAULT_BRAND_ADVANCED,
  getBrandButtonInlineStyle,
  getBrandCardInlineStyle,
  hasBrandAdvancedOverrides,
  parseAgencyBrandAdvanced,
  resolveBrandAdvanced,
  type AgencyBrandAdvanced,
} from "@/lib/branding/advanced";
import { DEFAULT_REPORT_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { agencySchema, type AgencyInput } from "@/lib/validation/schemas";
import type { Agency } from "@/lib/types";

const BRAND_SETTINGS_TABS = [
  { id: "agency", label: "Agency" },
  { id: "brand", label: "Brand kit" },
  { id: "advanced", label: "Advanced styles" },
] as const;

type BrandSettingsTab = (typeof BRAND_SETTINGS_TABS)[number]["id"];

const TAB_DIRTY_FIELDS: Record<BrandSettingsTab, (keyof AgencyInput)[]> = {
  agency: ["name", "slug", "website_url", "email", "phone"],
  brand: [
    "logo_url",
    "logo_light_url",
    "logo_dark_url",
    "primary_colour",
    "secondary_colour",
    "accent_colour",
    "text_colour",
    "background_colour",
    "heading_font_family",
    "body_font_family",
    "heading_font_file_url",
    "body_font_file_url",
    "font_file_url",
    "font_family",
  ],
  advanced: ["brand_advanced_json"],
};

function tabIsDirty(
  dirtyFields: Partial<Record<keyof AgencyInput, boolean | object>>,
  tab: BrandSettingsTab,
) {
  return TAB_DIRTY_FIELDS[tab].some((field) => Boolean(dirtyFields[field]));
}

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

export function BrandSettingsForm({ agency: initialAgency }: { agency: Agency }) {
  const [agency, setAgency] = useState(initialAgency);
  const [tab, setTab] = useState<BrandSettingsTab>("brand");
  const [loading, setLoading] = useState(false);

  const form = useForm<AgencyInput>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: agency.name,
      slug: agency.slug,
      website_url: agency.website_url ?? "",
      email: agency.email ?? "",
      phone: agency.phone ?? "",
      logo_url: agency.logo_url ?? "",
      logo_light_url: agency.logo_light_url ?? "",
      logo_dark_url: agency.logo_dark_url ?? agency.logo_url ?? "",
      primary_colour: agency.primary_colour,
      secondary_colour: agency.secondary_colour,
      accent_colour: agency.accent_colour,
      text_colour: agency.text_colour ?? agency.primary_colour,
      background_colour: agency.background_colour ?? agency.secondary_colour,
      heading_font_family: agency.heading_font_family ?? agency.font_family ?? "fraunces",
      body_font_family: agency.body_font_family ?? agency.font_family ?? "inter",
      font_family: agency.body_font_family ?? agency.font_family ?? "inter",
      heading_font_file_url: agency.heading_font_file_url ?? "",
      body_font_file_url: agency.body_font_file_url ?? agency.font_file_url ?? "",
      font_file_url: agency.body_font_file_url ?? agency.font_file_url ?? "",
      default_report_title: agency.default_report_title,
      default_cta: agency.default_cta,
      default_disclaimer: agency.default_disclaimer ?? "",
      report_template_id: agency.report_template_id ?? DEFAULT_REPORT_TEMPLATE_ID,
      brand_advanced_json: parseAgencyBrandAdvanced(agency.brand_advanced_json),
    },
  });

  const preview = form.watch();
  const { isDirty, dirtyFields } = useFormState({ control: form.control });
  const showBuyerPreview = tab === "brand" || tab === "advanced";

  const tabDirty = useMemo(
    () => ({
      agency: tabIsDirty(dirtyFields, "agency"),
      brand: tabIsDirty(dirtyFields, "brand"),
      advanced: tabIsDirty(dirtyFields, "advanced"),
    }),
    [dirtyFields],
  );

  // Derive live advanced values for the inline preview
  const advancedDraft = (preview.brand_advanced_json ?? {}) as AgencyBrandAdvanced;
  const resolvedAdvanced = useMemo(
    () =>
      resolveBrandAdvanced({
        primary_colour: preview.primary_colour || agency.primary_colour,
        text_colour: preview.text_colour || agency.text_colour,
        brand_advanced_json: advancedDraft,
      }),
    [agency.primary_colour, agency.text_colour, advancedDraft, preview.primary_colour, preview.text_colour],
  );

  function updateAdvanced(patch: Partial<AgencyBrandAdvanced>) {
    const current = (form.getValues("brand_advanced_json") ?? {}) as AgencyBrandAdvanced;
    form.setValue(
      "brand_advanced_json",
      { ...current, ...patch } as AgencyInput["brand_advanced_json"],
      { shouldDirty: true },
    );
  }

  async function onSubmit(values: AgencyInput) {
    setLoading(true);
    const response = await fetch("/api/agencies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to update agency");
      setLoading(false);
      return;
    }

    if (payload.agency) {
      setAgency(payload.agency as Agency);
    }

    toast.success("Brand settings saved");
    setLoading(false);
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as BrandSettingsTab)}
    >
      <TabsList className="mb-3 h-auto bg-transparent px-0">
        {BRAND_SETTINGS_TABS.map((item) => (
          <TabsTrigger key={item.id} value={item.id} className="px-4 py-2 text-sm">
            <span className="flex items-center gap-1.5">
              {item.label}
              {tabDirty[item.id] ? (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unsaved changes" />
              ) : null}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="surface-card">
            <div className="px-6 py-8 md:px-8">

              {/* ── Agency ── */}
              <TabsContent value="agency" className="mt-0 space-y-6">
                <p className="text-sm text-muted-foreground">
                  How buyers and StayPacks identify your agency on public links.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name">Agency name</Label>
                    <Input id="name" {...form.register("name")} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="slug">Report link name</Label>
                    <Input id="slug" {...form.register("slug")} />
                    <p className="text-xs text-muted-foreground">
                      Used in public report and listing URLs for your agency.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website_url">Website</Label>
                    <Input id="website_url" {...form.register("website_url")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" {...form.register("email")} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" {...form.register("phone")} />
                  </div>
                </div>
              </TabsContent>

              {/* ── Brand kit ── */}
              <TabsContent value="brand" className="mt-0 space-y-8">
                <p className="text-sm text-muted-foreground">
                  Logo, colours and fonts used on reports, collateral and listing pages.
                </p>
                <BrandKitEditor
                  form={form}
                  agencyId={agency.id}
                  showPreview={false}
                  numberedSections={false}
                />
              </TabsContent>

              {/* ── Advanced styles ── */}
              <TabsContent value="advanced" className="mt-0 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Fine-tune buttons, corners and links on listing pages and collateral. All fields
                  default to your brand colours when left as-is.
                </p>

                <AdvancedSection
                  label="Buttons"
                  hint="Leave colours empty to use your brand primary and white text."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Background</Label>
                      <Input
                        type="color"
                        value={advancedDraft.button_background_colour ?? agency.primary_colour}
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

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Border width (px)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={8}
                        value={advancedDraft.button_border_width_px ?? 0}
                        onChange={(e) => updateAdvanced({ button_border_width_px: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Border colour</Label>
                      <Input
                        type="color"
                        value={advancedDraft.button_border_colour ?? "#002e36"}
                        onChange={(e) => updateAdvanced({ button_border_colour: e.target.value })}
                        className="h-11 w-full cursor-pointer"
                      />
                    </div>
                  </div>
                </AdvancedSection>

                <AdvancedSection
                  label="Links"
                  hint="Used for headings and text links on listing pages."
                >
                  <div className="space-y-1.5">
                    <Label className="text-xs">Link colour</Label>
                    <Input
                      type="color"
                      value={advancedDraft.link_colour ?? agency.primary_colour}
                      onChange={(e) => updateAdvanced({ link_colour: e.target.value })}
                      className="h-11 w-[8rem] cursor-pointer"
                    />
                  </div>
                </AdvancedSection>

                <AdvancedSection
                  label="Cards & panels"
                  hint="Applies to enquiry forms and info panels on listing pages."
                >
                  <div className="space-y-3">
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
                          onChange={(e) => updateAdvanced({ card_border_width_px: Number(e.target.value) })}
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
                  </div>
                </AdvancedSection>

                <AdvancedSection
                  label="Inputs"
                  hint="Text fields inside forms on listing pages."
                >
                  <div className="space-y-2">
                    <Label className="text-xs">Corner radius</Label>
                    <RadiusPresets
                      value={advancedDraft.input_border_radius_px ?? 4}
                      onChange={(px) => updateAdvanced({ input_border_radius_px: px })}
                      presets={[
                        { label: "Square", px: 0 },
                        { label: "Soft", px: 4 },
                        { label: "Rounded", px: 8 },
                      ]}
                    />
                  </div>
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
                        { shouldDirty: true },
                      )
                    }
                  >
                    Reset to defaults
                  </Button>
                ) : null}
              </TabsContent>
            </div>

            <div className="flex flex-col gap-3 rounded-b-2xl border-t border-border/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
              <p className="text-sm text-muted-foreground">
                {isDirty ? "You have unsaved changes." : "All changes saved."}
              </p>
              <Button type="submit" size="lg" disabled={loading} className="sm:min-w-44">
                {loading ? "Saving..." : "Save brand settings"}
              </Button>
            </div>
          </div>

          {/* Right — sticky preview */}
          <div className="surface-card h-fit p-6 md:p-8 xl:sticky xl:top-24">
            <h3 className="font-display text-xl tracking-tight">
              {showBuyerPreview ? "Live preview" : "Agency summary"}
            </h3>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              {showBuyerPreview
                ? "Check this looks right before saving. Buyers will see something similar on published collateral."
                : "How your agency appears on public links and contact blocks."}
            </p>
            {showBuyerPreview ? (
              <div className="space-y-4">
                <BrandPreviewCard preview={preview} />
                {tab === "advanced" ? (
                  <div className="rounded-xl border border-dashed border-border p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Button & panel preview
                    </p>
                    <div
                      className="space-y-3 p-4"
                      style={getBrandCardInlineStyle(resolvedAdvanced)}
                    >
                      <p className="text-sm font-semibold" style={{ color: resolvedAdvanced.linkColour }}>
                        Sample link colour
                      </p>
                      <Input
                        readOnly
                        value="Sample input"
                        className="bg-white"
                        style={{ borderRadius: resolvedAdvanced.inputBorderRadiusPx }}
                      />
                      <button
                        type="button"
                        className="px-5 py-2.5 text-sm font-semibold shadow-sm"
                        style={getBrandButtonInlineStyle(resolvedAdvanced)}
                      >
                        Sample button
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <BrandAgencyPreviewCard preview={preview} />
            )}
          </div>
        </div>
      </form>
    </Tabs>
  );
}
