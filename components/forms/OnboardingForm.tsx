"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BrandKitEditor } from "@/components/settings/BrandKitEditor";
import { DEFAULT_BRAND_VALUES } from "@/lib/branding/normalize";
import { agencySchema, type AgencyInput } from "@/lib/validation/schemas";
import { slugifyAgencyName } from "@/lib/reports/slugs";
import { DEFAULT_DISCLAIMER } from "@/lib/types";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function OnboardingForm() {
  const [loading, setLoading] = useState(false);
  const form = useForm<AgencyInput>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: "",
      slug: "",
      website_url: "",
      email: "",
      phone: "",
      logo_url: "",
      ...DEFAULT_BRAND_VALUES,
      heading_font_family: "fraunces",
      body_font_family: "inter",
      default_report_title: "Short-Term Rental Potential Report",
      default_cta:
        "Speak with the agent for the full buyer pack and property details.",
      default_disclaimer: DEFAULT_DISCLAIMER,
      report_template_id: "classic-light",
    } as AgencyInput,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const name = watch("name");

  useEffect(() => {
    if (name) {
      setValue("slug", slugifyAgencyName(name), { shouldValidate: true });
    }
  }, [name, setValue]);

  async function onSubmit(values: AgencyInput) {
    setLoading(true);

    try {
      const response = await fetch("/api/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Failed to create agency");
        setLoading(false);
        return;
      }

      toast.success("Agency created");
      window.location.href = "/dashboard";
    } catch {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  function onInvalid() {
    toast.error("Please fix the highlighted fields before continuing.");
  }

  return (
    <div className="space-y-8">
      <div className="surface-card p-6 md:p-8">
        <div className="mb-8">
          <h2 className="font-display text-2xl tracking-tight">Agency details</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with the basics. Brand colours and fonts are in plain English below —
            no design skills needed.
          </p>
        </div>

        <form
          className="grid gap-8"
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          noValidate
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
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
                placeholder="mercerindustries.com"
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

          <BrandKitEditor form={form} showPreview />

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="default_report_title">Default report title</Label>
              <Input
                id="default_report_title"
                {...register("default_report_title")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_cta">Default call to action</Label>
              <Textarea id="default_cta" {...register("default_cta")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_disclaimer">Default disclaimer</Label>
              <Textarea
                id="default_disclaimer"
                rows={5}
                {...register("default_disclaimer")}
              />
            </div>
          </div>

          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Creating agency..." : "Continue to dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
