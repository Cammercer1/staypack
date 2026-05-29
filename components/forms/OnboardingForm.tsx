"use client";

import { useEffect, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandPreviewCard } from "@/components/settings/BrandPreviewCard";
import { BrandKitEditor } from "@/components/settings/BrandKitEditor";
import { AdvancedStylesEditor } from "@/components/settings/AdvancedStylesEditor";
import {
  getBrandButtonInlineStyle,
  getBrandCardInlineStyle,
  resolveBrandAdvanced,
} from "@/lib/branding/advanced";
import { DEFAULT_REPORT_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { agencyToFormInput, DEFAULT_BRAND_VALUES } from "@/lib/branding/normalize";
import { agencySchema, type AgencyInput } from "@/lib/validation/schemas";
import { slugifyAgencyName } from "@/lib/reports/slugs";
import { DEFAULT_DISCLAIMER } from "@/lib/types";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: "details",
    label: "Agency details",
    description: "Your agency name, contact details and public report link.",
    fields: ["name", "slug", "website_url", "email", "phone"] as const,
  },
  {
    id: "logos",
    label: "Logos",
    description: "Upload logo versions for light and dark backgrounds.",
    fields: ["logo_url", "logo_light_url", "logo_dark_url"] as const,
  },
  {
    id: "colours",
    label: "Colours",
    description: "Choose the core colours buyers will see in reports and collateral.",
    fields: [
      "primary_colour",
      "secondary_colour",
      "accent_colour",
      "text_colour",
      "background_colour",
    ] as const,
  },
  {
    id: "fonts",
    label: "Fonts",
    description: "Choose heading and body fonts for a consistent look.",
    fields: [
      "heading_font_family",
      "body_font_family",
      "heading_font_file_url",
      "body_font_file_url",
      "font_file_url",
      "font_family",
    ] as const,
  },
  {
    id: "advanced",
    label: "Advanced styles",
    description: "Fine-tune buttons, corners, links and panel styles.",
    fields: ["brand_advanced_json"] as const,
  },
] as const;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

function OnboardingStepIndicator({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 md:hidden">
        <p className="text-sm font-medium">
          Step {currentStep + 1} of {steps.length}
        </p>
        <p className="text-sm text-muted-foreground">{steps[currentStep].label}</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted md:hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      <ol className="hidden items-start md:flex">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = index < currentStep;

          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick(index)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                    isComplete &&
                      "border-primary bg-primary text-primary-foreground",
                    isCurrent &&
                      "border-primary bg-background text-foreground ring-4 ring-primary/15",
                    !isComplete &&
                      !isCurrent &&
                      "border-border bg-background text-muted-foreground",
                    isClickable && "cursor-pointer hover:bg-primary/90 hover:text-primary-foreground",
                    !isClickable && "cursor-default",
                  )}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                </button>
                <div className="mt-3 w-full max-w-[11rem] px-1 text-center">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isCurrent ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={cn(
                    "mx-3 mt-4 h-px flex-1",
                    index < currentStep ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function OnboardingForm() {
  const [loading, setLoading] = useState(false);
  const [stepLoading, setStepLoading] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const form = useForm<AgencyInput>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: "",
      slug: "",
      website_url: "",
      email: "",
      phone: "",
      logo_url: "",
      logo_light_url: "",
      logo_dark_url: "",
      ...DEFAULT_BRAND_VALUES,
      heading_font_family: "fraunces",
      body_font_family: "inter",
      default_report_title: "Short-Term Rental Potential Report",
      default_cta:
        "Speak with the agent for the full buyer pack and property details.",
      default_disclaimer: DEFAULT_DISCLAIMER,
      report_template_id: DEFAULT_REPORT_TEMPLATE_ID,
    } as AgencyInput,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = form;

  const name = watch("name");
  const preview = watch();
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const resolvedAdvanced = resolveBrandAdvanced({
    primary_colour: preview.primary_colour || "#2563eb",
    text_colour: preview.text_colour || "#333333",
    brand_advanced_json: preview.brand_advanced_json,
  });

  useEffect(() => {
    if (name) {
      setValue("slug", slugifyAgencyName(name), { shouldValidate: true });
    }
  }, [name, setValue]);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/agencies");
      if (!response.ok) return;

      const payload = await response.json();
      if (!payload.agency) return;

      setAgencyId(payload.agency.id);
      form.reset(agencyToFormInput(payload.agency));
    })();
    // Load any in-progress agency once on mount (e.g. after refresh mid-onboarding).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistAgency(values: AgencyInput) {
    const response = await fetch("/api/agencies", {
      method: agencyId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to save agency");
    }

    if (!agencyId && payload.agency?.id) {
      setAgencyId(payload.agency.id);
    }

    return payload.agency;
  }

  async function validateStep(stepIndex: number) {
    const fields = steps[stepIndex].fields as readonly FieldPath<AgencyInput>[];
    return trigger(fields);
  }

  async function goToStep(nextStep: number) {
    if (nextStep > currentStep) {
      const valid = await validateStep(currentStep);
      if (!valid) {
        toast.error("Please fix the highlighted fields before continuing.");
        return;
      }

      setStepLoading(true);
      try {
        await persistAgency(form.getValues());
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save agency details",
        );
        setStepLoading(false);
        return;
      }
      setStepLoading(false);
    }

    setCurrentStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(values: AgencyInput) {
    setLoading(true);

    try {
      await persistAgency(values);
      toast.success("Brand setup saved");
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
      setLoading(false);
    }
  }

  function onInvalid() {
    toast.error("Please fix the highlighted fields before continuing.");
  }

  return (
    <div className="space-y-6">
      <OnboardingStepIndicator
        currentStep={currentStep}
        onStepClick={(stepIndex) => {
          void goToStep(stepIndex);
        }}
      />

      <div className="surface-card p-6 md:p-8">
        <div className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Step {currentStep + 1} of {steps.length}
          </p>
          <h2 className="font-display text-2xl tracking-tight">{step.label}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {step.description}
          </p>
        </div>

        <form
          className="grid gap-8"
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          noValidate
        >
          {step.id === "details" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Agency name</Label>
                <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
                <FieldError message={errors.name?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Report link name</Label>
                <Input id="slug" aria-invalid={!!errors.slug} {...register("slug")} />
                <p className="text-xs text-muted-foreground">
                  Used in public report links. Example: mercer-industries
                </p>
                <FieldError message={errors.slug?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website_url">Website</Label>
                <Input
                  id="website_url"
                  aria-invalid={!!errors.website_url}
                  {...register("website_url")}
                />
                <FieldError message={errors.website_url?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Main email</Label>
                <Input
                  id="email"
                  type="email"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                <FieldError message={errors.email?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Main phone</Label>
                <Input id="phone" {...register("phone")} />
              </div>
            </div>
          ) : null}

          {step.id === "logos" ? (
            <BrandKitEditor
              form={form}
              agencyId={agencyId ?? undefined}
              showPreview={false}
              numberedSections={false}
              showSectionHeaders={false}
              showLogos
              showColours={false}
              showFonts={false}
            />
          ) : null}

          {step.id === "colours" ? (
            <BrandKitEditor
              form={form}
              agencyId={agencyId ?? undefined}
              showPreview={false}
              numberedSections={false}
              showSectionHeaders={false}
              showLogos={false}
              showColours
              showFonts={false}
            />
          ) : null}

          {step.id === "fonts" ? (
            <BrandKitEditor
              form={form}
              agencyId={agencyId ?? undefined}
              showPreview={false}
              numberedSections={false}
              showSectionHeaders={false}
              showLogos={false}
              showColours={false}
              showFonts
            />
          ) : null}

          {step.id === "advanced" ? (
            <div className="space-y-8">
              <AdvancedStylesEditor form={form} />

              <section className="space-y-4">
                <div>
                  <h3 className="font-display text-xl tracking-tight">Live preview</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Final check of your full brand setup before continuing to dashboard.
                  </p>
                </div>

                <div className="space-y-4">
                  <BrandPreviewCard preview={preview} />
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
                </div>
              </section>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={currentStep === 0 || loading || stepLoading}
              onClick={() => {
                setCurrentStep((value) => Math.max(0, value - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            {isLastStep ? (
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? "Saving..." : "Continue to dashboard"}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                disabled={stepLoading}
                onClick={() => {
                  void goToStep(currentStep + 1);
                }}
              >
                {stepLoading ? "Saving..." : "Continue"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
