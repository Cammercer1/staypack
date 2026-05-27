"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AgencyInput } from "@/lib/validation/schemas";

type ColourKey =
  | "background_colour"
  | "text_colour"
  | "primary_colour"
  | "accent_colour";

type Props = {
  form: UseFormReturn<AgencyInput>;
  name: ColourKey;
  label: string;
  helper: string;
  example: string;
};

export function ColourField({ form, name, label, helper, example }: Props) {
  const value = form.watch(name) || example;
  const error = form.formState.errors[name]?.message;

  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="flex items-start gap-4">
        <div className="space-y-2">
          <Label htmlFor={name} className="text-base font-medium">
            {label}
          </Label>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">{helper}</p>
        </div>
        <Input
          id={name}
          type="color"
          aria-invalid={!!error}
          {...form.register(name)}
          className="ml-auto h-14 w-20 shrink-0 cursor-pointer rounded-xl p-1"
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div
          className="h-10 flex-1 rounded-xl border border-border/60"
          style={{ backgroundColor: value }}
        />
        <Input
          value={value}
          onChange={(event) =>
            form.setValue(name, event.target.value, { shouldValidate: true })
          }
          className="w-32 font-mono text-sm"
          placeholder={example}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{String(error)}</p> : null}
    </div>
  );
}
