"use client";

import type { UseFormReturn } from "react-hook-form";
import {
  resolveBrandAdvanced,
  type AgencyBrandAdvanced,
} from "@/lib/branding/advanced";
import type { AgencyInput } from "@/lib/validation/schemas";

const colours = [
  ["button_background_colour", "Button background", "buttonBackground"],
  ["button_text_colour", "Button text", "buttonText"],
  ["button_border_colour", "Button border", "buttonBorderColour"],
  ["link_colour", "Links", "linkColour"],
  ["card_border_colour", "Panel border", "cardBorderColour"],
  ["card_background_colour", "Panel background", "cardBackgroundColour"],
] as const;
const dimensions = [
  ["button_border_radius_px", "Button corners", "buttonBorderRadiusPx", 32],
  ["button_border_width_px", "Button border width", "buttonBorderWidthPx", 8],
  ["card_border_radius_px", "Panel corners", "cardBorderRadiusPx", 24],
  ["card_border_width_px", "Panel border width", "cardBorderWidthPx", 8],
  ["input_border_radius_px", "Input corners", "inputBorderRadiusPx", 16],
] as const;

export function BrandAdvancedFields({
  form,
}: {
  form: UseFormReturn<AgencyInput>;
}) {
  const values = form.watch();
  const advanced = (values.brand_advanced_json ?? {}) as AgencyBrandAdvanced;
  const resolved = resolveBrandAdvanced(values);
  function update(patch: Partial<AgencyBrandAdvanced>) {
    form.setValue(
      "brand_advanced_json",
      { ...advanced, ...patch },
      { shouldDirty: true },
    );
  }
  return (
    <details
      data-theme="staypack-workspace"
      className="rounded-xl border border-base-300 p-4"
    >
      <summary className="cursor-pointer font-medium">
        Advanced appearance
      </summary>
      <p className="my-4 text-sm text-base-content/65">
        Buttons, links and panels on listing pages. Reset any colour to follow
        your brand defaults.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {colours.map(([key, label, resolvedKey]) => (
          <div key={key}>
            <label htmlFor={key} className="mb-2 block text-sm">
              {label}
            </label>
            <div className="flex items-center gap-2">
              <input
                aria-label={`${label} (px)`}
                id={key}
                type="color"
                className="h-10 w-16 cursor-pointer rounded border border-base-300"
                value={
                  /^#[0-9a-f]{6}$/i.test(resolved[resolvedKey])
                    ? resolved[resolvedKey]
                    : "#ffffff"
                }
                onChange={(event) => update({ [key]: event.target.value })}
              />
              <button
                type="button"
                className="du-btn du-btn-ghost du-btn-sm"
                aria-label={`Reset ${label.toLowerCase()}`}
                disabled={advanced[key] == null}
                onClick={() => update({ [key]: null })}
              >
                Reset
              </button>
            </div>
          </div>
        ))}
        {dimensions.map(([key, label, resolvedKey, max]) => (
          <div key={key}>
            <label htmlFor={key} className="mb-2 block text-sm">
              {label} (px)
            </label>
            <input
              aria-label={`${label} (px)`}
              id={key}
              type="number"
              min={0}
              max={max}
              className="du-input w-full"
              value={resolved[resolvedKey]}
              onChange={(event) =>
                update({
                  [key]: Math.min(max, Math.max(0, Number(event.target.value))),
                })
              }
            />
          </div>
        ))}
        <div>
          <label htmlFor="brand-shadow" className="mb-2 block text-sm">
            Panel shadow
          </label>
          <select
            id="brand-shadow"
            className="du-select w-full"
            value={advanced.card_shadow ?? "none"}
            onChange={(event) =>
              update({
                card_shadow: event.target
                  .value as AgencyBrandAdvanced["card_shadow"],
              })
            }
          >
            {["none", "soft", "medium", "strong"].map((shadow) => (
              <option key={shadow} value={shadow}>
                {shadow}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        className="du-btn du-btn-ghost mt-4"
        onClick={() =>
          form.setValue("brand_advanced_json", {}, { shouldDirty: true })
        }
      >
        Reset advanced appearance
      </button>
    </details>
  );
}
