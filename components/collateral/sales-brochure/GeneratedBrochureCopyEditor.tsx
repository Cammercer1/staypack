"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { enforceSalesBrochureCopyLimits } from "@/lib/collateral/sales-brochure/copyLimits";
import { SALES_BROCHURE_COPY_LIMITS } from "@/lib/collateral/sales-brochure/copyLimits";
import {
  isSalesBrochureDocument,
  type SalesBrochureCopyJson,
  type SalesBrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { resolveReportDisplayPrice } from "@/lib/reports/resolveReportDisplayPrice";
import type { Agency, CollateralItem, Listing } from "@/lib/types";

type Props = {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  onCollateralChange: (collateral: CollateralItem) => void;
  onContinueToPreview?: () => void;
};

type ApiError = {
  error?: string;
  code?: string;
};

export function GeneratedBrochureCopyEditor({
  listing,
  collateral,
  onCollateralChange,
  onContinueToPreview,
}: Props) {
  const initialCopy = useMemo(() => {
    const document = collateral.document_json;
    if (document && isSalesBrochureDocument(document)) {
      return enforceSalesBrochureCopyLimits(document.copy);
    }
    return null;
  }, [collateral.document_json]);

  const [copy, setCopy] = useState<SalesBrochureCopyJson | null>(initialCopy);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const document = collateral.document_json;
    if (document && isSalesBrochureDocument(document)) {
      setCopy(enforceSalesBrochureCopyLimits(document.copy));
    }
  }, [collateral.document_json]);
  const [saving, setSaving] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const displayPrice = useMemo(
    () => resolveReportDisplayPrice(listing),
    [listing],
  );

  const previewDocument = useMemo((): SalesBrochureDocumentJson | null => {
    const document = collateral.document_json;
    if (!document || !isSalesBrochureDocument(document) || !copy) {
      return null;
    }

    return {
      ...document,
      copy,
    };
  }, [collateral.document_json, copy]);

  async function persistBrochure(options?: { silent?: boolean }) {
    if (!copy) {
      return true;
    }

    setSaving(true);
    const response = await fetch(`/api/collateral/${collateral.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copy }),
    });
    const payload = (await response.json()) as ApiError & {
      collateral?: CollateralItem;
    };

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to save brochure");
      setSaving(false);
      return false;
    }

    if (payload.collateral) {
      onCollateralChange(payload.collateral);
    }

    if (!options?.silent) {
      toast.success("Brochure saved");
    }

    setSaving(false);
    return true;
  }

  async function generateCopy() {
    if (copy && !confirmRegenerate) {
      setConfirmRegenerate(true);
      return;
    }

    setConfirmRegenerate(false);
    setGenerating(true);

    const response = await fetch(`/api/collateral/${collateral.id}/generate-copy`, {
      method: "POST",
    });
    const payload = (await response.json()) as ApiError & {
      copy?: SalesBrochureCopyJson;
      collateral?: CollateralItem;
    };

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to generate brochure");
      setGenerating(false);
      return;
    }

    if (payload.copy) {
      setCopy(enforceSalesBrochureCopyLimits(payload.copy));
    }

    if (payload.collateral) {
      onCollateralChange(payload.collateral);
    }

    toast.success("Brochure generated");
    setGenerating(false);
  }

  async function continueToPreview() {
    if (copy) {
      const saved = await persistBrochure({ silent: true });
      if (!saved) {
        return;
      }
    }

    onContinueToPreview?.();
  }

  function updateField(field: keyof SalesBrochureCopyJson, value: string | string[]) {
    setCopy((current) => {
      if (!current) return current;
      const next = { ...current, [field]: value };
      return enforceSalesBrochureCopyLimits(next);
    });
  }

  const addressLine = [
    listing.property_address,
    listing.suburb,
    listing.state,
    listing.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const limits = SALES_BROCHURE_COPY_LIMITS;

  return (
    <AsyncLoadingOverlay
      active={generating}
      title="Generating collateral"
      description="Writing buyer-facing brochure copy from your listing. This usually takes 10–20 seconds."
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Content generation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate and refine buyer-facing copy for your brochure.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
            <p className="font-medium">Listing context</p>
            <p className="mt-1 text-muted-foreground">
              {addressLine || "No property address saved yet"}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ContextMetric
                label="Bedrooms"
                value={listing.bedrooms != null ? String(listing.bedrooms) : "—"}
              />
              <ContextMetric
                label="Bathrooms"
                value={listing.bathrooms != null ? String(listing.bathrooms) : "—"}
              />
              <ContextMetric
                label="Guide price"
                value={displayPrice ?? listing.display_price ?? "—"}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={generateCopy} disabled={generating || saving}>
              {generating ? (
                <>
                  <Loader2 className="animate-spin" />
                  Generating...
                </>
              ) : copy && confirmRegenerate ? (
                "Confirm regenerate"
              ) : copy ? (
                "Regenerate copy"
              ) : (
                "Generate collateral"
              )}
            </Button>
            {copy ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => persistBrochure()}
                  disabled={generating || saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={continueToPreview}
                  disabled={generating || saving}
                >
                  Continue to preview
                </Button>
              </>
            ) : null}
          </div>

          {copy ? (
            <div className="space-y-4">
              <CopyField
                id="heading"
                label={limits.heading.label}
                hint={limits.heading.hint}
                value={copy.heading}
                maxLength={limits.heading.max}
                onChange={(value) => updateField("heading", value)}
              />
              <CopyField
                id="blurb"
                label={limits.blurb.label}
                hint={limits.blurb.hint}
                value={copy.blurb}
                maxLength={limits.blurb.max}
                multiline
                onChange={(value) => updateField("blurb", value)}
              />
              <StringListField
                label={limits.appeal_points.label}
                hint={limits.appeal_points.hint}
                values={copy.appeal_points}
                maxItems={limits.appeal_points.max}
                onChange={(values) => updateField("appeal_points", values)}
              />
              <StringListField
                label={limits.feature_highlights.label}
                hint={limits.feature_highlights.hint}
                values={copy.feature_highlights}
                maxItems={limits.feature_highlights.max}
                onChange={(values) => updateField("feature_highlights", values)}
              />
              <CopyField
                id="inspection_cta"
                label={limits.inspection_cta.label}
                hint={limits.inspection_cta.hint}
                value={copy.inspection_cta}
                maxLength={limits.inspection_cta.max}
                onChange={(value) => updateField("inspection_cta", value)}
              />
              <CopyField
                id="page_two_note"
                label={limits.page_two_note.label}
                hint={limits.page_two_note.hint}
                value={copy.page_two_note ?? ""}
                maxLength={limits.page_two_note.max}
                multiline
                onChange={(value) => updateField("page_two_note", value)}
              />
              <CopyField
                id="disclaimer"
                label={limits.disclaimer.label}
                hint={limits.disclaimer.hint}
                value={copy.disclaimer}
                maxLength={limits.disclaimer.max}
                multiline
                onChange={(value) => updateField("disclaimer", value)}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate collateral to create brochure copy from your listing photos and
              details.
            </p>
          )}
        </div>

        <div>
          {previewDocument ? (
            <FittedBrochurePreview document={previewDocument} />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              Generate collateral to preview your brochure.
            </div>
          )}
        </div>
      </div>
    </AsyncLoadingOverlay>
  );
}

function ContextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function CopyField({
  id,
  label,
  hint,
  value,
  maxLength,
  multiline,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  maxLength: number;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={4}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <p className="text-xs text-muted-foreground">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}

function StringListField({
  label,
  hint,
  values,
  maxItems,
  onChange,
}: {
  label: string;
  hint: string;
  values: string[];
  maxItems: number;
  onChange: (values: string[]) => void;
}) {
  const items = [...values];
  while (items.length < Math.min(3, maxItems)) {
    items.push("");
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {items.slice(0, maxItems).map((value, index) => (
        <Input
          key={`${label}-${index}`}
          value={value}
          placeholder={`Point ${index + 1}`}
          onChange={(event) => {
            const next = [...values];
            next[index] = event.target.value;
            onChange(next.filter((item, itemIndex) => item.trim() || itemIndex < index + 1));
          }}
        />
      ))}
    </div>
  );
}
