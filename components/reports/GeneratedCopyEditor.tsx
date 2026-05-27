"use client";

import { useMemo, useState } from "react";
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
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import { enforceTemplateCopyLimits } from "@/lib/reports/enforceTemplateCopyLimits";
import { getTemplateCopyFieldLimit } from "@/lib/reports/getTemplateCopyLimits";
import { DEFAULT_REPORT_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { ReportTemplatePicker } from "@/components/reports/ReportTemplatePicker";
import type { Agency, AiCopyJson, Report } from "@/lib/types";

type Props = {
  agency: Agency;
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
  report,
  onComplete,
  onContinueToPreview,
}: Props) {
  const [copy, setCopy] = useState<AiCopyJson | null>(() =>
    report.ai_copy_json
      ? enforceTemplateCopyLimits(
          report.ai_copy_json,
          report.template_id ?? agency.report_template_id ?? DEFAULT_REPORT_TEMPLATE_ID,
        )
      : null,
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () => report.template_id ?? agency.report_template_id ?? DEFAULT_REPORT_TEMPLATE_ID,
  );

  const estimate = useMemo(() => resolveReportEstimate(report), [report]);
  const previewReport = useMemo(() => {
    if (!copy || !estimate) return null;

    return buildFinalReportJson({
      agency,
      report: {
        ...report,
        template_id: selectedTemplateId,
      },
      estimate,
      copy,
      scraped: report.scraped_listing_json,
    });
  }, [agency, copy, estimate, report, selectedTemplateId]);

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
      toast.success("Copy saved");
    }

    setSaving(false);
    return true;
  }

  async function generateCopy() {
    if (!estimate) {
      toast.error("Run an STR estimate before generating copy");
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

    toast.success("Report copy generated");
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
  const metricsLimit = getTemplateCopyFieldLimit(
    selectedTemplateId,
    "key_metrics_line",
  );

  const addressLine = [
    report.property_address,
    report.suburb,
    report.state,
    report.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const overlayActive = generating;

  return (
    <AsyncLoadingOverlay
      active={overlayActive}
      title="Generating report copy"
      description="Writing buyer-facing copy from your listing and STR numbers. This usually takes 10–20 seconds."
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
              value={report.bedrooms != null ? String(report.bedrooms) : "—"}
            />
            <ContextMetric
              label="Bathrooms"
              value={report.bathrooms != null ? String(report.bathrooms) : "—"}
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
                Run an STR estimate first to generate buyer-facing copy.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={generateCopy}
            disabled={generating || saving || !estimate}
          >
            {generating ? (
              <>
                <Loader2 className="animate-spin" />
                Generating copy...
              </>
            ) : copy ? (
              "Regenerate copy"
            ) : (
              "Generate report copy"
            )}
          </Button>
        </div>

        {!estimate ? (
          <p className="text-sm text-muted-foreground">
            Go to the STR estimate tab and run an estimate before generating copy.
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
              label="Key metrics line"
              value={copy.key_metrics_line}
              onChange={(value) => updateField("key_metrics_line", value)}
              limit={metricsLimit}
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
            />
            <Field
              label="Supporting factors"
              value={copy.performance_supporting_factors.join("\n")}
              onChange={(value) =>
                updateField(
                  "performance_supporting_factors",
                  value.split("\n").filter(Boolean),
                )
              }
              textarea
            />
            <Field
              label="Buyer checks"
              value={copy.buyer_checks.join("\n")}
              onChange={(value) =>
                updateField("buyer_checks", value.split("\n").filter(Boolean))
              }
              textarea
            />
            <Field
              label="Methodology note"
              value={copy.methodology_note}
              onChange={(value) => updateField("methodology_note", value)}
              textarea
            />
            <Field
              label="Disclaimer"
              value={copy.disclaimer}
              onChange={(value) => updateField("disclaimer", value)}
              textarea
            />
            <Field
              label="Confidence notes (internal)"
              value={copy.confidence_notes}
              onChange={(value) => updateField("confidence_notes", value)}
              textarea
              hint="Staff-only notes. Not shown on the published report."
            />

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={saveCopy}
                disabled={generating || saving}
              >
                {saving ? "Saving..." : "Save copy"}
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

      <div className="space-y-3 xl:sticky xl:top-6 xl:self-start">
        <div className="space-y-3">
          <p className="text-sm font-medium">Report layout</p>
          <ReportTemplatePicker
            value={selectedTemplateId}
            onChange={handleTemplateChange}
            defaultTemplateId={agency.report_template_id ?? DEFAULT_REPORT_TEMPLATE_ID}
          />
        </div>

        <p className="text-sm font-medium">Live preview</p>
        {previewReport ? (
          <FittedReportPreview report={previewReport} />
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            Generate or edit copy to preview the report layout.
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
    return "Run an STR estimate before generating copy.";
  }

  if (payload.code === "validation_failed") {
    return "Generated copy did not pass validation. Try again.";
  }

  return payload.error ?? "Copy generation failed";
}
