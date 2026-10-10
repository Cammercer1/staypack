"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { DEFAULT_STR_MANAGEMENT_ASSUMPTIONS, strManagementPresetsSchema } from "@/lib/reports/strEstimateAdjustments";
import { jsonRequest, reportRequest } from "@/lib/reports/reportRequests";
import type { StrManagementAssumptions, StrManagementPreset } from "@/lib/types";

type PresetFields = {
  id: string;
  name: string;
  mode: "uplift" | "relative" | "absolute";
  upliftPercent: number;
  isDefault: boolean;
  adrPercent: number;
  occupancyPoints: number;
  nightlyRate: number;
  occupancyRate: number;
  assumptions: StrManagementAssumptions;
};

function formPreset(preset: StrManagementPreset): PresetFields {
  return {
    ...preset, mode: preset.mode ?? "absolute", isDefault: preset.isDefault ?? false,
    upliftPercent: preset.mode === "uplift" ? preset.upliftPercent : 0,
    adrPercent: preset.mode === "relative" ? preset.adrPercent : 0,
    occupancyPoints: preset.mode === "relative" ? preset.occupancyPoints : 0,
    nightlyRate: preset.mode !== "relative" && preset.mode !== "uplift" ? preset.nightlyRate : 0,
    occupancyRate: preset.mode !== "relative" && preset.mode !== "uplift" ? preset.occupancyRate : 0,
  };
}

export function StrManagementPresetsForm({ presets = [] }: { presets?: StrManagementPreset[] | null }) {
  const { register, control, handleSubmit, reset, setValue } = useForm<{ presets: PresetFields[] }>({
    defaultValues: { presets: (presets ?? []).map(formPreset) },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "presets", keyName: "formKey" });
  const values = useWatch({ control, name: "presets" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  function addPreset(mode: "uplift" | "absolute") {
    append({
      id: crypto.randomUUID(), name: mode === "uplift" ? "Company management uplift" : "",
      mode, isDefault: mode === "uplift" && !values.some((preset) => preset.isDefault),
      upliftPercent: 0, adrPercent: 0, occupancyPoints: 0, nightlyRate: 0, occupancyRate: 0,
      assumptions: { ...DEFAULT_STR_MANAGEMENT_ASSUMPTIONS },
    });
    setSaved(false);
  }
  return (
    <form id="str-management-presets" className="du-card du-card-border bg-base-100" onChange={() => setSaved(false)} onSubmit={handleSubmit(async (values) => {
      setError(null); setSaved(false);
      const parsed = strManagementPresetsSchema.safeParse(values.presets.map((preset) => ({
        id: preset.id, name: preset.name, assumptions: preset.assumptions,
        ...(preset.mode === "uplift"
          ? { mode: "uplift", isDefault: preset.isDefault, upliftPercent: preset.upliftPercent }
          : preset.mode === "relative"
          ? { mode: "relative", isDefault: preset.isDefault, adrPercent: preset.adrPercent, occupancyPoints: preset.occupancyPoints }
          : { mode: "absolute", nightlyRate: preset.nightlyRate, occupancyRate: preset.occupancyRate }),
      })));
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your preset assumptions"); return; }
      setBusy(true);
      try {
        const response = await reportRequest<{ presets: StrManagementPreset[] }>("/api/agencies/str-presets", jsonRequest({ presets: parsed.data }, "PATCH"));
        reset({ presets: response.presets.map(formPreset) }); setSaved(true);
      } catch (err) { setError(err instanceof Error ? err.message : "Unable to save defaults"); }
      finally { setBusy(false); }
    })}>
      <div className="du-card-body gap-5 p-6">
        <div>
          <h2 className="du-card-title">Management estimate defaults</h2>
          <p className="mt-2 text-sm text-muted-foreground">Set your management uplift once. New reports apply it to each property’s market benchmark, ready for your team to review. Existing reports keep their saved figures.</p>
        </div>
        <fieldset disabled={busy} className="space-y-5">
          {fields.map((field, index) => {
            const relative = values[index]?.mode === "relative";
            const uplift = values[index]?.mode === "uplift";
            return (
              <fieldset key={field.formKey} className="space-y-4 rounded-xl border border-base-300 p-4">
                <legend className="px-2 text-sm font-medium">{values[index]?.isDefault ? "Company default" : `Preset ${index + 1}`}</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">Preset name
                    <input className="du-input mt-1 w-full" maxLength={80} placeholder="e.g. Coastal family homes" {...register(`presets.${index}.name`)} /></label>
                  <label className="block text-sm">How this preset works
                    <select className="du-select mt-1 w-full" {...register(`presets.${index}.mode`, { onChange: (event) => {
                      if (event.target.value === "absolute") setValue(`presets.${index}.isDefault`, false);
                    } })}>
                      <option value="uplift">Management uplift</option>
                      <option value="relative">Separate ADR and occupancy adjustments</option>
                      <option value="absolute">Set specific ADR and occupancy</option>
                    </select></label>
                </div>
                {uplift ? <div className="space-y-2">
                  <label className="block text-sm">Management uplift (%)
                    <input className="du-input mt-1 w-full" type="number" min="-100" max="300" step="0.1" {...register(`presets.${index}.upliftPercent`, { valueAsNumber: true })} />
                  </label>
                  <p className="text-xs text-muted-foreground">For example, 28% turns a $60,000 market estimate into $76,800. The revenue change is shared across ADR and relative occupancy; occupancy is capped by available nights and ADR supplies the remainder.</p>
                </div> : null}
                {uplift || relative ? <>
                  {relative && <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">ADR adjustment (%)
                      <input className="du-input mt-1 w-full" type="number" min="-99" max="300" step="0.1" {...register(`presets.${index}.adrPercent`, { valueAsNumber: true })} />
                      <span className="mt-1 block text-xs text-muted-foreground">For example, +10% turns a $300 benchmark ADR into $330.</span>
                    </label>
                    <label className="block text-sm">Occupancy adjustment (percentage points)
                      <input className="du-input mt-1 w-full" type="number" min="-100" max="100" step="0.1" {...register(`presets.${index}.occupancyPoints`, { valueAsNumber: true })} />
                      <span className="mt-1 block text-xs text-muted-foreground">For example, +5 points turns 65% into 70%, capped by available nights.</span>
                    </label>
                  </div>
                  </>}
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" className="du-checkbox du-checkbox-sm" {...register(`presets.${index}.isDefault`, { onChange: (event) => {
                      if (event.target.checked) fields.forEach((_, other) => { if (other !== index) setValue(`presets.${other}.isDefault`, false); });
                    } })} />Apply automatically to new reports
                  </label>
                </> : <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">ADR ($)
                      <input className="du-input mt-1 w-full" type="number" min="0.01" max="100000" step="0.01" {...register(`presets.${index}.nightlyRate`, { valueAsNumber: true })} /></label>
                    <label className="block text-sm">Annual occupancy (%)
                      <input className="du-input mt-1 w-full" type="number" min="0" max="100" step="0.01" {...register(`presets.${index}.occupancyRate`, { valueAsNumber: true })} /></label>
                  </div>
                  <p className="text-xs text-muted-foreground">Specific rates are applied by the report author, for properties suited to this preset.</p>
                </>}
                <details className="rounded-lg bg-base-200/40 p-3">
                  <summary className="cursor-pointer text-sm font-medium">Availability & report wording</summary>
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm">Unavailable nights / year
                        <input className="du-input mt-1 w-full" type="number" min="0" max="365" step="1" {...register(`presets.${index}.assumptions.unavailableNights`, { valueAsNumber: true })} /></label>
                      <label className="block text-sm">Operating stage
                        <select className="du-select mt-1 w-full" {...register(`presets.${index}.assumptions.listingStage`)}>
                          <option value="established">Established listing</option><option value="launch_year">Launch year</option>
                        </select></label>
                    </div>
                    <label className="block text-sm">Basis for these assumptions
                      <textarea className="du-textarea mt-1 w-full" rows={3} maxLength={300} {...register(`presets.${index}.assumptions.rationale`)} /></label>
                    <p className="text-xs text-muted-foreground">Occupancy is the share of all 365 nights booked. Unavailable nights are not deducted twice. Launch-year assumptions should allow time to build reviews.</p>
                  </div>
                </details>
                <button type="button" className="du-btn du-btn-sm du-btn-ghost" onClick={() => { remove(index); setSaved(false); }}>Remove preset {index + 1}</button>
              </fieldset>
            );
          })}
          {!fields.length && <p className="text-sm text-muted-foreground">Until you set company defaults, reports start with the property’s market figures. No uplift is added.</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="du-btn du-btn-outline" disabled={fields.length >= 5} onClick={() => addPreset("uplift")}>{fields.length ? "Add uplift preset" : "Set up company defaults"}</button>
            <button type="button" className="du-btn du-btn-ghost" disabled={fields.length >= 5} onClick={() => addPreset("absolute")}>Add property preset</button>
            <button type="submit" className="du-btn du-btn-primary">{busy ? "Saving…" : "Save management defaults"}</button>
          </div>
          <p className="text-xs text-muted-foreground">Save up to five presets, with one uplift or relative preset as your company default. Adjustments are your company’s assumptions, not a measured management premium.</p>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {saved && <p role="status" className="text-sm">Company defaults saved. Existing reports keep their saved assumptions.</p>}
      </div>
    </form>
  );
}
