"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BrandKitEditor } from "@/components/settings/BrandKitEditor";
import { BrandPreviewCard } from "@/components/settings/BrandPreviewCard";
import { agencySchema, type AgencyInput } from "@/lib/validation/schemas";
import type { Agency } from "@/lib/types";

export function BrandSettingsForm({ agency }: { agency: Agency }) {
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
      report_template_id: agency.report_template_id ?? "classic",
    },
  });

  const preview = form.watch();

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

    toast.success("Brand settings saved");
    setLoading(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="surface-card p-6 md:p-8">
        <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Agency name</Label>
              <Input id="name" {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Report link name</Label>
              <Input id="slug" {...form.register("slug")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website_url">Website</Label>
              <Input id="website_url" {...form.register("website_url")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
          </div>

          <BrandKitEditor form={form} agencyId={agency.id} showPreview={false} />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default_report_title">Default report title</Label>
              <Input
                id="default_report_title"
                {...form.register("default_report_title")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_cta">Default call to action</Label>
              <Textarea id="default_cta" {...form.register("default_cta")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_disclaimer">Default disclaimer</Label>
              <Textarea
                id="default_disclaimer"
                rows={5}
                {...form.register("default_disclaimer")}
              />
            </div>
          </div>

          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Saving..." : "Save brand settings"}
          </Button>
        </form>
      </div>

      <div className="surface-card h-fit p-6 md:p-8 xl:sticky xl:top-24">
        <h3 className="font-display text-xl tracking-tight">Live preview</h3>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Check this looks right before saving. Buyers will see something similar
          on published reports.
        </p>
        <BrandPreviewCard preview={preview} />
      </div>
    </div>
  );
}
