"use client";

import { cn } from "@/lib/utils";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFormState, type FieldErrors } from "react-hook-form";
import { Check, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AgencyLogoUploader } from "./AgencyLogoUploader";
import { ColourField } from "./ColourField";
import { FontPicker } from "./FontPicker";
import { BrandAdvancedFields } from "./BrandAdvancedFields";
import { BrandPreviewCard } from "./BrandPreviewCard";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import { SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID } from "@/lib/collateral/templates/ids";
import { buildAgencyBrandSlice } from "@/lib/collateral/buildAgencyBrandSlice";
import {
  agencyToFormInput,
  normalizeAgencyBrandPayload,
} from "@/lib/branding/normalize";
import { BRAND_COLOUR_FIELDS } from "@/lib/branding/presets";
import { type AgencyInput } from "@/lib/validation/schemas";
import {
  agencyDetailsSchema,
  brandSettingsSchema,
  selectAgencySettings,
} from "@/lib/agencies/settingsInput";
import type { Agency } from "@/lib/types";

const sections = ["Logo", "Colours", "Fonts"] as const;
type Section = (typeof sections)[number] | "Agency";
const agencyFields = [
  ["name", "Agency name", "text"],
  ["website_url", "Website", "url"],
  ["email", "Contact email", "email"],
  ["phone", "Contact phone", "tel"],
  ["slug", "Public link name", "text"],
] as const;

export function BrandSettingsForm({
  agency: initialAgency,
  mode = "brand",
}: {
  agency: Agency;
  mode?: "brand" | "details";
}) {
  const detailsOnly = mode === "details";
  const [agency, setAgency] = useState(initialAgency);
  const [section, setSection] = useState<Section>(
    detailsOnly ? "Agency" : "Logo",
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState("report");
  const [leaveUrl, setLeaveUrl] = useState<string | null>(null);
  const form = useForm<AgencyInput>({
    resolver: async (values) => {
      const result = (
        detailsOnly ? agencyDetailsSchema : brandSettingsSchema
      ).safeParse(values);
      if (result.success)
        return { values: { ...values, ...result.data }, errors: {} };
      const errors = Object.fromEntries(
        result.error.issues.map((issue) => [
          issue.path[0],
          { type: issue.code, message: issue.message },
        ]),
      ) as FieldErrors<AgencyInput>;
      return { values: {}, errors };
    },
    defaultValues: agencyToFormInput(initialAgency),
    shouldFocusError: false,
  });
  const { isDirty, errors } = useFormState({ control: form.control });
  const draft = form.watch();
  const busy = saving || uploading;
  const brochure = useMemo(
    () =>
      createPlaygroundSalesBrochureDocument(
        SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID,
      ),
    [],
  );
  const previewDocument = {
    ...brochure,
    agency: buildAgencyBrandSlice({
      ...agency,
      ...normalizeAgencyBrandPayload(draft),
    }),
  };

  useEffect(() => {
    if (!isDirty && !busy) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function navigate(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href, window.location.href);
      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) setLeaveUrl(link.href);
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
    };
  }, [isDirty, busy]);

  function invalid(fieldErrors: FieldErrors<AgencyInput>) {
    const key = Object.keys(fieldErrors)[0] as keyof AgencyInput;
    setSection(
      detailsOnly
        ? "Agency"
        : key.includes("colour")
          ? "Colours"
          : key.includes("font")
            ? "Fonts"
            : "Logo",
    );
    setSaveError("Please check the highlighted fields before saving.");
    requestAnimationFrame(() => document.getElementById(key)?.focus());
  }
  async function save(values: AgencyInput) {
    // Colours can also be CSS names (older brand kits use values such as “white”).
    const invalidColour =
      !detailsOnly &&
      BRAND_COLOUR_FIELDS.find(
        ({ key }) =>
          !values[key]?.trim() || !CSS.supports("color", values[key]!),
      );
    if (invalidColour) {
      form.setError(invalidColour.key, {
        message: "Enter a valid colour, such as #095b42.",
      });
      invalid({ [invalidColour.key]: { type: "validate" } });
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/agencies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectAgencySettings(values, mode),
          settings_section: mode,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.agency)
        throw new Error(
          payload?.error || "We couldn’t save your changes. Please try again.",
        );
      setAgency(payload.agency);
      form.reset(agencyToFormInput(payload.agency));
      toast.success(
        detailsOnly ? "Agency details saved" : "Brand settings saved",
      );
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "We couldn’t save your changes. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  function discard() {
    form.reset(agencyToFormInput(agency));
    setSaveError("");
  }
  const previewContent = (
    <div className="min-w-0 space-y-4">
      <div>
        <label
          htmlFor={previewOpen ? "mobile-preview-type" : "preview-type"}
          className="sr-only"
        >
          Preview format
        </label>
        <select
          aria-label="Preview format"
          id={previewOpen ? "mobile-preview-type" : "preview-type"}
          value={previewType}
          onChange={(event) => setPreviewType(event.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="report">Report brand sample</option>
          <option value="brochure">Sales brochure</option>
        </select>
      </div>
      {previewType === "report" ? (
        <BrandPreviewCard preview={draft} />
      ) : (
        <FittedBrochurePreview
          className="min-w-0 max-w-full"
          document={previewDocument}
          useDocumentBrand
          maxHeight={previewOpen ? "none" : "min(65vh, 700px)"}
          fitToWidth={previewOpen}
        />
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        {previewType === "report"
          ? "Sample content and estimate for preview only. Report layouts vary by template."
          : "A sample property in the Classic brochure template. Your brand updates as you edit."}
      </p>
    </div>
  );

  return (
    <>
      <form
        noValidate
        onSubmit={form.handleSubmit(save, invalid)}
        className="pb-28"
      >
        <div
          className={cn(
            "grid items-start gap-8",
            detailsOnly
              ? "max-w-2xl"
              : "xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]",
          )}
        >
          <div className="min-w-0 space-y-5">
            {!detailsOnly && (
              <div
                data-theme="staypack-workspace"
                className="grid grid-cols-3 gap-1 rounded-xl bg-base-200 p-1"
                role="tablist"
                aria-label="Brand settings sections"
              >
                {sections.map((item, index) => (
                  <button
                    key={item}
                    id={`tab-${item}`}
                    type="button"
                    role="tab"
                    aria-selected={section === item}
                    aria-controls={`panel-${item}`}
                    tabIndex={section === item ? 0 : -1}
                    disabled={busy}
                    className={cn(
                      "du-btn du-btn-sm min-h-11 border-0 px-2 shadow-none",
                      section === item
                        ? "bg-base-100 text-primary"
                        : "du-btn-ghost text-base-content/65",
                    )}
                    onClick={() => setSection(item)}
                    onKeyDown={(event) => {
                      const next =
                        event.key === "ArrowRight"
                          ? (index + 1) % sections.length
                          : event.key === "ArrowLeft"
                            ? (index + sections.length - 1) % sections.length
                            : event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? sections.length - 1
                                : -1;
                      if (next >= 0) {
                        event.preventDefault();
                        setSection(sections[next]);
                        document
                          .getElementById(`tab-${sections[next]}`)
                          ?.focus();
                      }
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
            <fieldset
              disabled={busy}
              role={detailsOnly ? undefined : "tabpanel"}
              aria-label={detailsOnly ? "Agency details" : undefined}
              id={`panel-${section}`}
              aria-labelledby={detailsOnly ? undefined : `tab-${section}`}
              className="min-w-0 space-y-6 rounded-2xl border border-border/70 bg-card p-5 sm:p-6"
            >
              {section === "Logo" && (
                <>
                  <div>
                    <h2 className="font-display text-2xl">
                      Start with your logo
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Add the logo you use on light backgrounds. We’ll use it
                      across your branded documents and listing pages.
                    </p>
                  </div>
                  <AgencyLogoUploader
                    variant="dark"
                    value={draft.logo_dark_url || ""}
                    onUploadStateChange={setUploading}
                    onChange={(value) => {
                      form.setValue("logo_dark_url", value, {
                        shouldDirty: true,
                      });
                      form.setValue("logo_url", value, { shouldDirty: true });
                    }}
                  />
                  <details className="rounded-xl border border-border/60 p-4">
                    <summary className="cursor-pointer font-medium">
                      Alternate logo{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </summary>
                    <p className="my-3 text-sm text-muted-foreground">
                      Add a white or light version if your agency uses a
                      separate mark on dark backgrounds.
                    </p>
                    <AgencyLogoUploader
                      variant="light"
                      value={draft.logo_light_url || ""}
                      onUploadStateChange={setUploading}
                      onChange={(value) =>
                        form.setValue("logo_light_url", value, {
                          shouldDirty: true,
                        })
                      }
                    />
                  </details>
                </>
              )}
              {section === "Colours" && (
                <>
                  <div>
                    <h2 className="font-display text-2xl">
                      Your brand palette
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Choose a colour or paste its code. Check the preview to
                      make sure the text is easy to read.
                    </p>
                  </div>
                  <div className="space-y-4">
                    {BRAND_COLOUR_FIELDS.slice(0, 3).map((field) => (
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
                  <details
                    className="rounded-xl border border-border/60 p-4"
                    open={
                      BRAND_COLOUR_FIELDS.slice(3).some(
                        (field) => errors[field.key],
                      )
                        ? true
                        : undefined
                    }
                  >
                    <summary className="cursor-pointer font-medium">
                      Highlight colours
                    </summary>
                    <div className="mt-4 space-y-4">
                      {BRAND_COLOUR_FIELDS.slice(3).map((field) => (
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
                  </details>
                  <BrandAdvancedFields form={form} />
                </>
              )}
              {section === "Fonts" && (
                <>
                  <div>
                    <h2 className="font-display text-2xl">Set the tone</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Choose fonts your agency already uses, or try one of the
                      popular options.
                    </p>
                  </div>
                  <FontPicker form={form} onUploadStateChange={setUploading} />
                </>
              )}
              {section === "Agency" && (
                <>
                  <div>
                    <h2 className="font-display text-2xl">Agency details</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      The name and contact details shown on your branded
                      material.
                    </p>
                  </div>
                  <div className="space-y-5">
                    {agencyFields.map(([key, label, type]) => (
                      <div key={key}>
                        <label
                          htmlFor={key}
                          className="mb-2 block text-sm font-medium"
                        >
                          {label}
                          {key !== "name" && key !== "slug" && (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              (optional)
                            </span>
                          )}
                        </label>
                        <input
                          aria-label={label}
                          id={key}
                          type={type === "url" ? "text" : type}
                          {...form.register(key)}
                          aria-invalid={!!errors[key]}
                          aria-describedby={
                            errors[key]
                              ? `${key}-error`
                              : key === "slug"
                                ? "slug-hint"
                                : undefined
                          }
                          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive"
                        />
                        {errors[key] && (
                          <p
                            id={`${key}-error`}
                            role="alert"
                            className="mt-2 text-sm text-destructive"
                          >
                            {errors[key]?.message}
                          </p>
                        )}
                        {key === "slug" && (
                          <p
                            id="slug-hint"
                            className="mt-2 break-all text-xs leading-5 text-muted-foreground"
                          >
                            Example listing link: staypack.app/
                            {draft.slug || "your-agency"}/l/example-property
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </fieldset>
            {!detailsOnly && (
              <fieldset disabled={busy} className="min-w-0">
                {" "}
                <details className="rounded-xl border border-border/60 p-4">
                  <summary className="cursor-pointer font-medium">
                    Report defaults{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </summary>
                  <div className="mt-4 space-y-4">
                    {(
                      [
                        ["default_report_title", "Default report title"],
                        ["default_cta", "Call to action"],
                        ["default_disclaimer", "Agency disclaimer"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <label
                          className="mb-2 block text-sm font-medium"
                          htmlFor={key}
                        >
                          {label}
                        </label>
                        <textarea
                          aria-label={label}
                          id={key}
                          {...form.register(key)}
                          rows={key === "default_disclaimer" ? 4 : 2}
                          className="w-full rounded-lg border border-border bg-background p-3 text-sm"
                        />
                      </div>
                    ))}
                    <p className="text-xs leading-5 text-muted-foreground">
                      Leave this blank to use StayPack’s standard report
                      disclaimer. Every report includes a disclaimer.
                    </p>
                  </div>
                </details>
              </fieldset>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              {detailsOnly
                ? "These details are shared across your agency’s branded material and public listing pages."
                : "Saved branding is used for new documents and pages that use your agency brand. Published report snapshots stay unchanged."}
            </p>
          </div>
          {!detailsOnly && (
            <aside
              aria-label="Live brand preview"
              className="sticky top-8 hidden min-w-0 space-y-4 xl:block"
            >
              <div>
                <h2 className="font-display text-2xl">See it come together</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your draft brand, before you save.
                </p>
              </div>
              {!previewOpen && previewContent}
            </aside>
          )}
        </div>
        <div
          data-theme="staypack-workspace"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100 px-5 py-3 text-base-content shadow-sm lg:left-64"
        >
          <div className="mx-auto max-w-6xl space-y-2">
            {saveError && (
              <p role="alert" className="text-sm text-error">
                {saveError}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                role="status"
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                {!isDirty && !busy && (
                  <Check className="size-4 text-primary" aria-hidden="true" />
                )}
                {uploading
                  ? "Uploading asset…"
                  : saving
                    ? "Saving changes…"
                    : isDirty
                      ? "Unsaved changes"
                      : "All changes saved"}
              </p>
              <div className="flex items-center gap-1 sm:gap-2">
                {!detailsOnly && (
                  <button
                    type="button"
                    className="du-btn du-btn-ghost du-btn-sm min-h-11 xl:hidden"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    Preview
                  </button>
                )}
                <button
                  type="button"
                  className="du-btn du-btn-ghost du-btn-sm min-h-11"
                  disabled={!isDirty || busy}
                  onClick={discard}
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="du-btn du-btn-primary du-btn-sm min-h-11 px-4"
                  disabled={!isDirty || busy}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogTitle>Brand preview</DialogTitle>
          <DialogDescription>Check your draft before saving.</DialogDescription>
          {previewOpen && previewContent}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!leaveUrl}
        onOpenChange={(open) => {
          if (!open) setLeaveUrl(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription>
            You have unsaved changes. Stay here to save them, or discard them
            and leave.
          </DialogDescription>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLeaveUrl(null)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              onClick={() => {
                const url = leaveUrl;
                discard();
                setLeaveUrl(null);
                if (url) setTimeout(() => window.location.assign(url), 0);
              }}
            >
              Discard and leave
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
