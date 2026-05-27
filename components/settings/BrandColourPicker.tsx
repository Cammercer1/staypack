"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AgencyInput } from "@/lib/validation/schemas";

export function BrandColourPicker({
  form,
}: {
  form: UseFormReturn<AgencyInput>;
}) {
  const colours = [
    { key: "primary_colour", label: "Primary colour" },
    { key: "secondary_colour", label: "Secondary colour" },
    { key: "accent_colour", label: "Accent colour" },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {colours.map((colour) => (
        <div key={colour.key} className="space-y-2">
          <Label htmlFor={colour.key}>{colour.label}</Label>
          <Input
            id={colour.key}
            type="color"
            {...form.register(colour.key)}
            className="h-11 p-1"
          />
        </div>
      ))}
    </div>
  );
}
