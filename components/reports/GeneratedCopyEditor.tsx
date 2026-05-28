"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { formatCurrency, formatPercent } from "@/lib/reports/formatters";
import { resolveReportDisplayPrice } from "@/lib/reports/resolveReportDisplayPrice";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import { enforceTemplateCopyLimits } from "@/lib/reports/enforceTemplateCopyLimits";
import { getTemplateCopyFieldLimit } from "@/lib/reports/getTemplateCopyLimits";
import { resolveReportTemplateIdForReport } from "@/lib/reports/templateFromEstimateTier";
import { ReportTemplatePicker } from "@/components/reports/ReportTemplatePicker";
import type { Agency, AgentProfile, AiCopyJson, Listing, Report } from "@/lib/types";

type Props = {
  agency: Agency;
  agencyAgents?: AgentProfile[];
  listing: Listing;
  report: Report;
  onComplete: (report: Report) => void;
  onContinueToPreview?: () => void;
};

type ApiError = {
  error?: string;
  code?: string;
};

export function GeneratedCopyEditor({
  agency,
  agencyAgents = [],
  listing,
  report,
  onComplete,
  onContinueToPreview,
}: Props) {
  const [copy, setCopy] = useState<AiCopyJson | null>(() =>
    report.ai_copy_json
      ? enforceTemplateCopyLimits(
          report.ai_copy_json,
          resolveReportTemplateIdForReport(agency, report),
        )
      : null,
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  // Tier is locked by the estimate step: full → detailed, summary/none → light
  const tier = report.airbtics_tier === "full" ? "detailed" : "light";
  const resolvedTemplateId = useMemo(
    () => resolveReportTemplateIdForReport(agency, report),
    [agency, report],
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(resolvedTemplateId);

  useEffect(() => {
    setSelectedTemplateId(resolvedTemplateId);
  }, [resolvedTemplateId]);

  const estimate = useMemo(() => resolveReportEstimate(report), [report]);
  const displayPrice = useMemo(() => resolveReportDisplayPrice(listing), [listing]);
  const previewReport = useMemo(() => {
    if (!copy || !estimate) return null;

    return buildFinalReportJson({
      agency,
      agencyAgents,
      listing,
      report: {
        ...report,
        template_id: selectedTemplateId,
      },
      estimate,
      copy,
      scraped: listing.scraped_listing_json,
    });
  }, [agency, agencyAgents, copy, estimate, listing, report, selectedTemplateId]);

  async function persistReportDraft(options?: { silent?: boolean }) {
    if (!copy) {
      return true;
    }

    setSaving(true);
    const response = await fetch(`/api/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai_copy_json: copy,
        template_id: selectedTemplateId,
      }),
    });
    const payload = (await response.json()) as ApiError & { report?: Report };

    if (!response.ok) {
      toast.error(getErrorMessage(payload));
      setSaving(false);
      return false;
    }

    if (payload.report) {
      onComplete(payload.report);
    }

    if (!options?.silent) {
      toast.success("Collateral saved");
    }

    setSaving(false);
    return true;
  }

  async function generateCopy() {
    if (!estimate) {
      toast.error("Run an STR estimate before generating collateral");
      return;
    }

    setGenerating(true);
    const response = await fetch(`/api/reports/${report.id}/generate-copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: selectedTemplateId }),
    });
    const payload = (await response.json()) as ApiError & {
      copy?: AiCopyJson;
      report?: Report;
    };

    if (!response.ok) {
      toast.error(getErrorMessage(payload));
      setGenerating(false);
      return;
    }

    if (payload.copy) {
      setCopy(enforceTemplateCopyLimits(payload.copy, selectedTemplateId));
    }

    if (payload.report) {
      onComplete(payload.report);
    }

    toast.success("Collateral generated");
    setGenerating(false);
  }

  async function saveCopy() {
    if (!copy) return;
    await persistReportDraft();
  }

  async function continueToPreview() {
    if (copy) {
      const saved = await persistReportDraft({ silent: true });
      if (!saved) {
        return;
      }
    }

    onContinueToPreview?.();
  }

  async function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);

    if (copy) {
      setCopy((current) =>
        current ? enforceTemplateCopyLimits(current, templateId) : current,
      );
    }

    if (!copy || !report.ai_copy_json) {
      return;
    }

    setSaving(true);
    const response = await fetch(`/api/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: templateId }),
    });
    const payload = (await response.json()) as ApiError & { report?: Report };
    setSaving(false);

    if (!response.ok) {
      toast.error(getErrorMessage(payload));
      return;
    }

    if (payload.report) {
      onComplete(payload.report);
    }
  }

  function updateField(field: keyof AiCopyJson, value: string | string[]) {
    setCopy((current) => {
      if (!current) return current;

      const next = { ...current, [field]: value };
      return enforceTemplateCopyLimits(next, selectedTemplateId);
    });
  }

  const headingLimit = getTemplateCopyFieldLimit(
    selectedTemplateId,
    "sales_pack_heading",
  );
  const blurbLimit = getTemplateCopyFieldLimit(
    selectedTemplateId,
    "sales_pack_blurb",
  );

  const addressLine = [
    listing.property_address,
    listing.suburb,
    listing.state,
    listing.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const overlayActive = generating;

  return (
    <AsyncLoadingOverlay
      active={overlayActive}
      title="Generating collateral"
      description="Writing buyer-facing collateral from your listing and STR numbers. This usually takes 10–20 seconds."
    >
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
          <p className="font-medium">Report context</p>
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
              label="Listing price"
              value={displayPrice ?? "—"}
            />
            {estimate ? (
              <>
                <ContextMetric
                  label="Annual revenue"
                  value={formatCurrency(estimate.annualRevenue)}
                />
                <ContextMetric
                  label="Occupancy"
                  value={formatPercent(estimate.occupancyRate)}
                />
                <ContextMetric
                  label="Nightly rate"
                  value={formatCurrency(estimate.nightlyRate)}
                />
                <ContextMetric
                  label="Booked nights"
                  value={
                    estimate.bookedNights != null
                      ? String(estimate.bookedNights)
                      : "—"
                  }
                />
              </>
            ) : (
              <p className="sm:col-span-2 text-muted-foreground">
                Run an STR estimate first to generate buyer-facing collateral.
              </p>
            )}
          </div>
          {!displayPrice ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Add a numeric listing price on the Review listing step to show
              estimated gross STR yield on the report.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={generateCopy}
            disabled={generating || saving || !estimate}
          >
            {generating ? (
              <>
                <Loader2 className="animate-spin" />
                Generating collateral...
              </>
            ) : copy ? (
              "Regenerate collateral"
            ) : (
              "Generate collateral"
            )}
          </Button>
        </div>

        {!estimate ? (
          <p className="text-sm text-muted-foreground">
            Go to the STR estimate tab and run an estimate before generating collateral.
          </p>
        ) : null}

        {copy ? (
          <div className="space-y-4">
            <Field
              label="Heading"
              value={copy.sales_pack_heading}
              onChange={(value) => updateField("sales_pack_heading", value)}
              limit={headingLimit}
            />
            <Field
              label="Blurb"
              value={copy.sales_pack_blurb}
              onChange={(value) => updateField("sales_pack_blurb", value)}
              textarea
              limit={blurbLimit}
            />
            <Field
              label="Appeal points"
              value={copy.property_appeal_points.join("\n")}
              onChange={(value) =>
                updateField(
                  "property_appeal_points",
                  value.split("\n").filter(Boolean),
                )
              }
              textarea
              hint="One point per line."
            />
            <Field
              label="Disclaimer"
              value={copy.disclaimer}
              onChange={(value) => updateField("disclaimer", value)}
              textarea
            />

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={saveCopy}
                disabled={generating || saving}
              >
                {saving ? "Saving..." : "Save collateral"}
              </Button>
              {onContinueToPreview ? (
                <Button
                  onClick={continueToPreview}
                  disabled={generating || saving}
                >
                  Continue to preview
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 xl:sticky xl:top-6 xl:self-start">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Live preview</p>
          <ReportTemplatePicker
            value={selectedTemplateId}
            tier={tier}
            onChange={handleTemplateChange}
          />
        </div>
        {previewReport ? (
          <FittedReportPreview
            report={previewReport}
            maxHeight="min(80vh, 900px)"
            fitToWidth
          />
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            Generate or edit collateral to preview the report.
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

function Field({
  label,
  value,
  onChange,
  textarea = false,
  hint,
  limit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  hint?: string;
  limit?: {
    max: number;
    hint: string;
  } | null;
}) {
  const atLimit = limit ? value.length >= limit.max : false;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        {limit ? (
          <span
            className={
              atLimit
                ? "text-xs font-medium text-amber-700"
                : "text-xs text-muted-foreground"
            }
          >
            {value.length}/{limit.max}
          </span>
        ) : null}
      </div>
      {textarea ? (
        <Textarea
          rows={4}
          value={value}
          maxLength={limit?.max}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          value={value}
          maxLength={limit?.max}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {limit ? (
        <p className="text-xs text-muted-foreground">{limit.hint}</p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function getErrorMessage(payload: ApiError) {
  if (payload.code === "missing_estimate") {
    return "Run an STR estimate before generating collateral.";
  }

  if (payload.code === "validation_failed") {
    return "Generated collateral did not pass validation. Try again.";
  }

  return payload.error ?? "Collateral generation failed";
}
