"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandAdvancedSettingsModal } from "@/components/settings/BrandAdvancedSettingsModal";
import { hasBrandAdvancedOverrides } from "@/lib/branding/advanced";
import type { Agency } from "@/lib/types";
import type { AgencyInput } from "@/lib/validation/schemas";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  agency: Agency;
  form: UseFormReturn<AgencyInput>;
  onAgencyUpdated?: (agency: Agency) => void;
};

export function BrandAdvancedSettingsPrompt({
  agency,
  form,
  onAgencyUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const advanced = form.watch("brand_advanced_json") ?? agency.brand_advanced_json;
  const customized = hasBrandAdvancedOverrides(advanced);

  return (
    <>
      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Advanced brand settings</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Customise button colours, corner radius, borders, and form styling
                on listing pages and collateral.
              </p>
              {customized ? (
                <p className="mt-2 text-xs font-medium text-primary">
                  Custom advanced styling is active
                </p>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-primary/30 bg-background"
            onClick={() => setOpen(true)}
          >
            Open advanced settings
          </Button>
        </div>
      </div>

      <BrandAdvancedSettingsModal
        open={open}
        onOpenChange={setOpen}
        agency={agency}
        form={form}
        onSaved={onAgencyUpdated}
      />
    </>
  );
}
