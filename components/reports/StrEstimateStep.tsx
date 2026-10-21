"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ArrowLeft, ArrowRight, ExternalLink, Info, SlidersHorizontal, X } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Link from "next/link";
import { matchingManagedComps } from "@/lib/str/managementEvidence";
import { ComparableFilters } from "@/components/appraisals/ComparableFilters";
import { AppraisalStepPanel, AppraisalStepTabs } from "@/components/appraisals/AppraisalStepTabs";
import { MAX_STR_FEATURED_COMPS, rankStrComps } from "@/lib/str/comparables";
import { matchingStrAmenities, readStrPropertyContext } from "@/lib/str/propertyInputs";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";
import {
  applyStrEstimateAdjustments,
  resolveStrRevenueBand,
  reconcileStrEstimate,
  strRateInputsSchema,
  strAdjustmentSchema,
  readStrRateOverride,
  DEFAULT_STR_MANAGEMENT_ASSUMPTIONS,
  initialStrManagementScenario,
  resolveStrManagementPreset,
  resolveStrUplift,
  strUpliftPercentSchema,
  strManagementAssumptionsSchema,
} from "@/lib/reports/strEstimateAdjustments";
import { marketForCountry } from "@/lib/property-market";
import { formatCurrency as currencyAmount, formatPercent } from "@/lib/reports/formatters";
import { jsonRequest, reportRequest } from "@/lib/reports/reportRequests";
import { DEFAULT_DISCLAIMER, type Agency, type Listing, type Report, type StrManagementPreset } from "@/lib/types";

function controlValues(report: Report) {
  const estimate = report.final_estimate_json;
  const reconciled = estimate && (report.user_overrides_json?.strAdjustment ? estimate : reconcileStrEstimate(estimate));
  return {
    nightlyRate: reconciled?.nightlyRate == null ? "" : String(Number(reconciled.nightlyRate.toFixed(2))),
    occupancyRate: reconciled?.occupancyRate == null ? "" : String(Math.min(Number(reconciled.occupancyRate.toFixed(2)), Math.floor((365 - (report.user_overrides_json?.strManagement?.unavailableNights ?? 0)) / 365 * 10000) / 100)),
    unavailableNights: String(report.user_overrides_json?.strManagement?.unavailableNights ?? 0),
    listingStage: report.user_overrides_json?.strManagement?.listingStage ?? "established" as const,
    rationale: report.user_overrides_json?.strManagement?.rationale ?? DEFAULT_STR_MANAGEMENT_ASSUMPTIONS.rationale,
    presetName: report.user_overrides_json?.strManagement?.presetName ?? "",
    presetAdjustment: report.user_overrides_json?.strManagement?.presetAdjustment,
    presetUpliftPercent: report.user_overrides_json?.strManagement?.presetUpliftPercent,
  };
}

export type StrEstimateHandle = {
  savePendingEdits: () => Promise<Report | null>;
};
export const StrEstimateStep = forwardRef<
  StrEstimateHandle,
  {
    listing: Listing;
    agency?: Pick<Agency, "name" | "str_management_presets">;
    report: Report;
    busy: boolean;
    canManageDefaults?: boolean;
    onCompanyPresetsChange?: (presets: StrManagementPreset[]) => void;
    onBusyChange?: (busy: boolean) => void;
    onComplete: (report: Report) => void;
    onContinue: () => void;
    continueLabel?: string;
    onBack: () => void;
  }
>(function StrEstimateStep(
  { listing, agency, report, busy, canManageDefaults = false, onCompanyPresetsChange, onBusyChange, onComplete, onContinue, onBack, continueLabel },
  ref,
) {
  const currency = marketForCountry(listing.country).currency;
  const formatCurrency = (value: number | null | undefined) => currencyAmount(value, currency);
  const estimate = report.final_estimate_json;
  const enrichment = report.str_enrichment_json;
  const initialValues = controlValues(report);
  const { register, control, setValue, reset, getValues } = useForm({ defaultValues: initialValues });
  const nightlyRate = useWatch({ control, name: "nightlyRate" });
  const occupancy = useWatch({ control, name: "occupancyRate" });
  const values = useWatch({ control });
  const [section, setSection] = useState("estimate");
  const [presetId, setPresetId] = useState("");
  const [upliftDraft, setUpliftDraft] = useState<string | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [presetPrecision, setPresetPrecision] = useState<{
    rates: { nightlyRate: number; occupancyRate: number };
    controls: Pick<ReturnType<typeof controlValues>, "nightlyRate" | "occupancyRate">;
  } | null>(null);
  const baseline = report.original_estimate_json ? reconcileStrEstimate(report.original_estimate_json) : null;
  const [error, setError] = useState<string | null>(null);
  const [selectionLimitId, setSelectionLimitId] = useState<string | null>(null);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const assumptionsSnapshot = useRef<{
    values: ReturnType<typeof controlValues>;
    precision: typeof presetPrecision;
    uplift: typeof upliftDraft;
    presetId: string;
    error: string | null;
  } | null>(null);
  function changeAssumptionsOpen(open: boolean) {
    if (open) {
      assumptionsSnapshot.current = { values: getValues(), precision: presetPrecision, uplift: upliftDraft, presetId, error };
      setError(null);
    } else if (assumptionsSnapshot.current) {
      const previous = assumptionsSnapshot.current;
      reset(previous.values);
      setPresetPrecision(previous.precision);
      setUpliftDraft(previous.uplift);
      setPresetId(previous.presetId);
      setError(previous.error);
      assumptionsSnapshot.current = null;
    }
    setAssumptionsOpen(open);
  }
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [managedOnly, setManagedOnly] = useState(false);
  const propertyContext = readStrPropertyContext(listing, report);
  const savedComps = enrichment?.comp_pool ?? enrichment?.comps ?? [];
  const comps = propertyContext.amenities.length ? rankStrComps(savedComps, {
    bedrooms: listing.bedrooms ?? 0, bathrooms: listing.bathrooms ?? 0, accommodates: listing.accommodates ?? 0,
    property_type: listing.property_type, suburb: listing.suburb, amenities: propertyContext.amenities,
  }) : savedComps;
  const savedIds = (enrichment?.selected_comp_ids ?? enrichment?.comps.map((comp) => comp.listing_id) ?? []).slice(0, MAX_STR_FEATURED_COMPS);
  const [selectedIds, setSelectedIds] = useState(() => savedIds.slice(0, MAX_STR_FEATURED_COMPS));
  const [browsingComps, setBrowsingComps] = useState(savedIds.length === 0);
  const selectionDirty = JSON.stringify(savedIds) !== JSON.stringify(selectedIds);
  const fetchedAt = enrichment?.fetched_at ?? report.airbtics_fetched_at;
  function toggleComp(id: string) {
    setError(null);
    setSelectionLimitId(null);
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((item) => item !== id));
    else if (selectedIds.length < MAX_STR_FEATURED_COMPS) setSelectedIds([...selectedIds, id]);
    else setSelectionLimitId(id);
  }
  const band = useMemo(
    () => resolveStrRevenueBand(enrichment, estimate),
    [enrichment, estimate],
  );
  // Keep full saved precision until the author edits the corresponding control.
  const savedEstimate = estimate && (readStrRateOverride(report) ? estimate : reconcileStrEstimate(estimate));
  const parsed = strRateInputsSchema.safeParse({
    nightlyRate: presetPrecision && nightlyRate === presetPrecision.controls.nightlyRate ? presetPrecision.rates.nightlyRate
      : nightlyRate === initialValues.nightlyRate ? savedEstimate?.nightlyRate : nightlyRate.trim() ? Number(nightlyRate) : NaN,
    occupancyRate: presetPrecision && occupancy === presetPrecision.controls.occupancyRate ? presetPrecision.rates.occupancyRate
      : occupancy === initialValues.occupancyRate ? savedEstimate?.occupancyRate : occupancy.trim() ? Number(occupancy) : NaN,
  });
  const assumptions = {
    unavailableNights: values.unavailableNights?.trim() ? Number(values.unavailableNights) : NaN,
    listingStage: values.listingStage,
    rationale: values.rationale,
    ...(values.presetName ? { presetName: values.presetName } : {}),
    ...(values.presetAdjustment ? { presetAdjustment: values.presetAdjustment } : {}),
    ...(values.presetUpliftPercent != null ? { presetUpliftPercent: values.presetUpliftPercent } : {}),
  };
  const managementInput = strAdjustmentSchema.safeParse({ mode: "management", ...(parsed.success ? parsed.data : {}), assumptions });
  const upliftIssue = upliftDraft === null ? null
    : !upliftDraft.trim() || !strUpliftPercentSchema.safeParse(Number(upliftDraft)).success ? "Enter an uplift between -100% and 300%."
    : !baseline || !resolveStrUplift(baseline, Number(upliftDraft), assumptions.unavailableNights) ? "This uplift cannot fit the available nights and ADR limits. Review the assumptions below." : null;
  const valid = parsed.success && managementInput.success && !upliftIssue;
  const dirty = nightlyRate !== initialValues.nightlyRate || occupancy !== initialValues.occupancyRate ||
    (parsed.success && (parsed.data.nightlyRate !== savedEstimate?.nightlyRate || parsed.data.occupancyRate !== savedEstimate?.occupancyRate)) ||
    ["unavailableNights", "listingStage", "rationale", "presetName", "presetAdjustment", "presetUpliftPercent"].some((key) => JSON.stringify(values[key as keyof typeof values]) !== JSON.stringify(initialValues[key as keyof typeof initialValues]));
  const needsManagement = !report.final_report_json && !report.user_overrides_json?.strManagement && !!baseline;
  const adjusted = estimate && parsed.success && dirty ? applyStrEstimateAdjustments(estimate, parsed.data) : estimate;
  const delta = adjusted?.annualRevenue != null && baseline?.annualRevenue != null
    ? adjusted.annualRevenue - baseline.annualRevenue : null;
  const managedIds = new Set(matchingManagedComps(comps, listing).map((comp) => comp.listing_id));
  const companyDefault = agency?.str_management_presets?.find((preset) => preset.isDefault);
  const inferredUplift = baseline?.annualRevenue != null && baseline.annualRevenue > 0 && parsed.success
    ? String(Number(((parsed.data.nightlyRate * parsed.data.occupancyRate / 100 * 365 / baseline.annualRevenue - 1) * 100).toFixed(2))) : "";
  const upliftValue = upliftDraft ?? inferredUplift;
  const canSetDefault = canManageDefaults && !companyDefault && !defaultSaved && (agency?.str_management_presets?.length ?? 0) < 5;
  function changeUplift(next: string, unavailableNights = assumptions.unavailableNights) {
    const rates = next.trim() && baseline ? resolveStrUplift(baseline, Number(next), unavailableNights) : null;
    if (rates && baseline) {
      const controls = controlValues({ ...report, final_estimate_json: applyStrEstimateAdjustments(baseline, rates), user_overrides_json: {
        strAdjustment: rates, strManagement: { ...DEFAULT_STR_MANAGEMENT_ASSUMPTIONS, unavailableNights },
      } });
      setPresetPrecision({ rates, controls });
      setValue("nightlyRate", controls.nightlyRate);
      setValue("occupancyRate", controls.occupancyRate);
      setError(null);
    }
    setUpliftDraft(next);
  }
  async function saveCompanyDefault() {
    const checkedAssumptions = strManagementAssumptionsSchema.safeParse(assumptions);
    if (!valid || !checkedAssumptions.success || !upliftValue.trim() || !strUpliftPercentSchema.safeParse(Number(upliftValue)).success) return;
    setSavingDefault(true); onBusyChange?.(true); setError(null);
    try {
      const result = await reportRequest<{ presets: StrManagementPreset[] }>("/api/agencies/str-presets", jsonRequest({ upliftPercent: Number(upliftValue), assumptions: checkedAssumptions.data }, "POST"));
      onCompanyPresetsChange?.(result.presets);
      setDefaultSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save company default"); }
    finally { setSavingDefault(false); onBusyChange?.(false); }
  }
  function applyScenario(scenario: ReturnType<typeof initialStrManagementScenario>) {
    if (!scenario || !baseline) return;
    const controls = controlValues({ ...report, final_estimate_json: applyStrEstimateAdjustments(baseline, scenario.rates), user_overrides_json: { strAdjustment: scenario.rates, strManagement: scenario.assumptions } });
    // Display rounding must not change the preset when it is applied or restored.
    setPresetPrecision({ rates: scenario.rates, controls });
    reset(controls);
    setUpliftDraft(null);
    setError(null);
  }
  useImperativeHandle(ref, () => ({
    savePendingEdits: async () => {
      // Modal drafts must be applied before navigation can persist them.
      if (assumptionsOpen) return null;
      setError(null);
      if (savingDefault) return null;
      if (!valid && upliftIssue) { setError(upliftIssue); return null; }
      if (!dirty && !selectionDirty && !needsManagement) return report;
      if (!adjusted || !valid || (comps.length > 0 && selectedIds.length === 0)) {
        setError(
          !managementInput.success ? managementInput.error.issues[0]?.message ?? "Check your management assumptions" :
          "Enter ADR above $0 and up to $100,000, occupancy from 0% to 100%, and select at least one available comparable.",
        );
        return null;
      }
      try {
        const payload = await reportRequest<{ report: Report }>(
          `/api/reports/${report.id}`,
          jsonRequest(
            {
              ...(selectionDirty && comps.length ? { selected_comp_listing_ids: selectedIds } : {}),
              ...(dirty || needsManagement ? { str_adjustment: { mode: "management", ...(parsed.success ? parsed.data : {}), assumptions } } : {}),
            },
            "PATCH",
          ),
        );
        setPresetPrecision(null);
        setUpliftDraft(null);
        reset(controlValues(payload.report));
        onComplete(payload.report);
        return payload.report;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to save your figures. Try again.",
        );
        return null;
      }
    },
  }));
  if (!adjusted) return null;
  const shownComps = comps.filter((comp) => browsingComps
    ? (!managedOnly || managedIds.has(comp.listing_id)) && (!selectedOnly || selectedIds.includes(comp.listing_id)) &&
      `${comp.name} ${comp.suburb ?? ""} ${comp.property_type ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
    : selectedIds.includes(comp.listing_id));
  const missingComparables = comps.length > 0 && selectedIds.length === 0;
  const stepActions = <>
    <button type="button" className="du-btn du-btn-outline min-h-11" disabled={busy || savingDefault} onClick={onBack}>
      <ArrowLeft className="size-4" aria-hidden="true" />Back to property
    </button>
    <button type="button" className="du-btn du-btn-primary min-h-11 h-auto py-3 whitespace-normal" disabled={busy || savingDefault || !valid || missingComparables} onClick={onContinue}>
      {continueLabel ?? "Use this estimate"}
      <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
    </button>
  </>;
  return (
    <section data-theme="staypack-workspace" className="space-y-5">
      <DocumentStepHeader
        title="Review estimate"
        description="Review the estimate and comparables."
        status={
          <span className="du-badge du-badge-sm">
            {dirty || selectionDirty || needsManagement ? "Unsaved changes" : "Saved figures"}
          </span>
        }
      >
        {stepActions}
      </DocumentStepHeader>
      {error && !assumptionsOpen ? (
        <p role="alert" className="du-alert du-alert-error du-alert-soft">
          {error}
        </p>
      ) : null}
      {!valid && !assumptionsOpen && <div role="alert" className="du-alert du-alert-error du-alert-soft flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>{upliftIssue ?? (!managementInput.success ? managementInput.error.issues[0]?.message : "Enter ADR above $0 and up to $100,000, and occupancy between 0% and 100%.")}</span>
        {section !== "estimate" && <button type="button" className="du-btn du-btn-sm min-h-11" disabled={busy || savingDefault} onClick={() => setSection("estimate")}>Review estimate</button>}
      </div>}
      {missingComparables && <div role="alert" className="du-alert du-alert-warning du-alert-soft flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>Select at least one comparable before using this estimate.</span>
        {section !== "comparables" && <button type="button" className="du-btn du-btn-sm min-h-11" disabled={busy || savingDefault} onClick={() => setSection("comparables")}>Choose comparables</button>}
      </div>}
      <AppraisalStepTabs label="Estimate sections" value={section} onValueChange={setSection} disabled={busy || savingDefault || assumptionsOpen} tabs={[{ value: "estimate", label: "Estimate" }, { value: "comparables", label: "Comparables" }]}>
      <AppraisalStepPanel value="estimate">
      <div className="du-card du-card-border bg-base-100">
        <div className="du-card-body gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
            <p>
              {listing.property_address} · {listing.bedrooms} bed ·{" "}
              {listing.bathrooms} bath · {listing.accommodates} guests
            </p>
            {fetchedAt ? (
              <p>
                Updated{" "}
                {new Date(fetchedAt).toLocaleDateString(
                  "en-AU", { timeZone: "Australia/Sydney" },
                )}
              </p>
            ) : null}
          </div>
          <div className="space-y-5">
            <div className="rounded-xl bg-base-200/60 p-5 sm:p-6" aria-live="polite" aria-atomic="true">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium">Estimated annual gross STR revenue</p>
                <Popover.Root>
                  <Popover.Trigger openOnHover aria-label="How these figures work" className="du-btn du-btn-sm du-btn-ghost du-btn-circle size-11 shrink-0 text-muted-foreground">
                    <Info className="size-4" aria-hidden="true" />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
                      <Popover.Popup data-theme="staypack-workspace" className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-base-300 bg-base-100 p-4 text-sm text-base-content shadow-lg outline-none">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Popover.Title className="font-semibold">How these figures work</Popover.Title>
                          <Popover.Close aria-label="Close explanation" className="du-btn du-btn-sm du-btn-ghost du-btn-circle size-11 shrink-0">
                            <X className="size-4" aria-hidden="true" />
                          </Popover.Close>
                        </div>
                        <div className="space-y-3 leading-relaxed text-muted-foreground">
                          <p>Estimated annual gross revenue = ADR × occupancy × 365, before operating costs. ADR is the effective revenue per booked night; figures are rounded.</p>
                          <p>Comparables support your report without changing the estimate. Management uplift reflects your operating assumptions, not a measured management premium.</p>
                          {band && band.source !== "fallback" ? <p>Market reference: {formatCurrency(band.min)}–{formatCurrency(band.max)} / year (25th–90th percentiles). Context, not a limit on your assumptions.</p> : null}
                        </div>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              </div>
              {agency?.name && <p className="mt-1 text-xs text-muted-foreground">Under {agency.name} management</p>}
              <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                {valid ? formatCurrency(adjusted.annualRevenue) : "—"}
                <span className="ml-2 text-sm font-normal text-muted-foreground">/ year</span>
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {valid ? `${formatCurrency(adjusted.monthlyRevenue)} / month · About ${adjusted.bookedNights} booked nights` : "Check your assumptions to preview your estimate."}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">{values.presetName ? `Using ${values.presetName} assumptions.` : readStrRateOverride(report) ? "Using this report’s operating assumptions." : "Based on this property’s market figures."}</p>
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                Before management fees, cleaning, furnishing and other operating costs.
              </p>
            </div>
            <fieldset disabled={busy || savingDefault || !baseline} className="min-w-0 space-y-5">
              <Dialog open={assumptionsOpen} onOpenChange={changeAssumptionsOpen}>
                <DialogTrigger disabled={busy || savingDefault || !baseline} className="du-btn du-btn-sm du-btn-outline min-h-11 w-full sm:w-auto">
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  Adjust estimate
                </DialogTrigger>
                <DialogContent data-theme="staypack-workspace" showCloseButton={false} className="inset-x-0 top-auto bottom-0 flex max-h-[94dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-2xl bg-base-100 p-0 text-base-content sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[90dvh] sm:w-[calc(100%-3rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
                  <div className="flex shrink-0 items-start justify-between gap-3 border-b border-base-300 p-5 sm:px-6">
                    <div>
                      <DialogTitle className="text-xl leading-tight">Adjust estimate</DialogTitle>
                      <DialogDescription className="mt-1">Adjust rates, availability and report wording.</DialogDescription>
                    </div>
                    <DialogClose aria-label="Cancel assumption changes" className="du-btn du-btn-sm du-btn-ghost du-btn-circle min-h-11 min-w-11">
                      <X className="size-4" aria-hidden="true" />
                    </DialogClose>
                  </div>
                  <div className="min-h-0 overflow-y-auto overscroll-contain">
                  <fieldset disabled={busy || savingDefault || !baseline} className="min-w-0 space-y-5 p-5 sm:p-6">
                  {baseline?.annualRevenue != null && delta != null ? (
                    <div className="rounded-xl bg-base-200/60 p-4 text-sm" aria-label="Market benchmark comparison">
                      <p className="font-medium">Market benchmark: {formatCurrency(baseline.annualRevenue)} / year</p>
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        <p>Estimated gross STR revenue at {formatCurrency(baseline.nightlyRate)} ADR and {formatPercent(baseline.occupancyRate)} annual occupancy.</p>
                        <p className="font-medium text-base-content">{!valid ? "Check your assumptions to compare your management estimate." : delta !== 0 ? `Your management estimate is ${baseline.annualRevenue > 0 ? `${Math.abs(delta / baseline.annualRevenue * 100).toFixed(1)}%` : formatCurrency(Math.abs(delta))} ${delta > 0 ? "above" : "below"} this benchmark.` : "Your management estimate matches this benchmark."}</p>
                        <p>The benchmark may already include professional operators.</p>
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    <label htmlFor="str-uplift" className="font-semibold">Management uplift (%)</label>
                    <p id="str-uplift-help" className="text-sm text-muted-foreground">Estimated gross revenue change from the market benchmark.</p>
                    <input id="str-uplift" type="number" inputMode="decimal" min="-100" max="300" step="0.1" className="du-input w-full text-lg tabular-nums" aria-describedby="str-uplift-help" value={upliftValue} disabled={!baseline?.annualRevenue || baseline.annualRevenue <= 0}
                      onChange={(event) => changeUplift(event.target.value)} />
                    <p className="text-sm text-muted-foreground">{parsed.success ? <>Working assumptions: <strong>{formatCurrency(parsed.data.nightlyRate)} ADR</strong> · <strong>{formatPercent(parsed.data.occupancyRate)} occupancy</strong>.</> : "Fine-tune the rates below to review this estimate."}</p>
                    <p className="text-xs text-muted-foreground">Management uplift reflects operating assumptions, not a measured management premium.</p>
                    <details className="rounded-xl border border-base-300 px-3 text-xs text-muted-foreground">
                      <summary className="min-h-11 cursor-pointer content-center py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">How uplift works</summary>
                      <p className="pb-3 leading-relaxed">The uplift is shared across ADR and occupancy. Occupancy is capped by available nights; ADR supplies any remainder.</p>
                    </details>
                    {canSetDefault && <div className="rounded-lg bg-base-200/60 p-4 space-y-3">
                      <p className="text-sm font-medium">{report.final_report_json ? "Use this approach for future appraisals" : "Set your company’s approach on this first appraisal"}</p>
                      <p className="text-xs text-muted-foreground">Save this approach immediately for future STR appraisals, including the availability and report wording below. This is separate from applying changes to the current estimate.</p>
                      <button type="button" className="du-btn du-btn-outline min-h-11 h-auto whitespace-normal" disabled={!valid || !upliftValue.trim() || !strUpliftPercentSchema.safeParse(Number(upliftValue)).success} onClick={() => void saveCompanyDefault()}>{savingDefault ? "Saving…" : `Save ${upliftValue || "0"}% as company default`}</button>
                    </div>}
                    {defaultSaved && <p role="status" className="text-sm">Company default saved for future appraisals. Apply changes to keep these figures for the current estimate; Cancel will not undo the company default.</p>}
                    {!canManageDefaults && !companyDefault && <p className="text-xs text-muted-foreground">This uplift applies to this report. A company owner or admin can set the default for future appraisals.</p>}
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="str-adr" className="text-sm font-medium">Average daily rate · ADR ($)</label>
                      <input id="str-adr" type="number" inputMode="decimal" min="0.01" max="100000" step="0.01"
                        className="du-input du-input-sm min-h-11 w-full tabular-nums" aria-describedby="str-adr-help"
                        {...register("nightlyRate", { onChange: () => setUpliftDraft(null) })} />
                      <input type="range" aria-label="Adjust ADR" min="1"
                        max={Math.max(1000, Math.ceil((baseline?.nightlyRate ?? 500) * 2 / 100) * 100, Number(nightlyRate) || 0)} step="1"
                        value={Number(nightlyRate) || 1} onChange={(event) => { setUpliftDraft(null); setValue("nightlyRate", event.target.value); }}
                        className="du-range du-range-sm w-full" />
                      <p id="str-adr-help" className="text-xs text-muted-foreground">Gross revenue per booked night.</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="str-occupancy" className="text-sm font-medium">Estimated occupancy (%)</label>
                      <input id="str-occupancy" type="number" inputMode="decimal" min="0" max="100" step="0.01"
                        className="du-input du-input-sm min-h-11 w-full tabular-nums" aria-describedby="str-occupancy-help"
                        {...register("occupancyRate", { onChange: () => setUpliftDraft(null) })} />
                      <input type="range" aria-label="Adjust estimated occupancy" min="0" max="100" step="0.5"
                        value={Number(occupancy) || 0} onChange={(event) => { setUpliftDraft(null); setValue("occupancyRate", event.target.value); }}
                        className="du-range du-range-sm w-full" />
                      <p id="str-occupancy-help" className="text-xs text-muted-foreground">Percentage of all 365 nights booked.</p>
                    </div>
                  </div>
                  {values.presetUpliftPercent != null && <p className="text-xs text-muted-foreground">Starting preset: {values.presetUpliftPercent}% management uplift.</p>}
                  {values.presetAdjustment && <p className="text-xs text-muted-foreground">Starting preset: ADR {Number(values.presetAdjustment.adrPercent) >= 0 ? "+" : ""}{values.presetAdjustment.adrPercent}%; occupancy {Number(values.presetAdjustment.occupancyPoints) >= 0 ? "+" : ""}{values.presetAdjustment.occupancyPoints} percentage points.</p>}
                  {!!agency?.str_management_presets?.length && <div className="space-y-2">
                    <label htmlFor="str-preset" className="text-sm font-medium">Use a different preset</label>
                    <div className="flex flex-wrap gap-2">
                      <select id="str-preset" className="du-select du-select-sm min-h-11 min-w-0 flex-1 basis-48" value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                        <option value="">Choose assumptions for this property</option>
                        {agency.str_management_presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                      </select>
                      <button type="button" className="du-btn du-btn-sm du-btn-outline min-h-11" disabled={!presetId} onClick={() => {
                        const preset = agency.str_management_presets?.find((item) => item.id === presetId);
                        if (preset && baseline) applyScenario(resolveStrManagementPreset(baseline, preset));
                      }}>Apply preset</button>
                    </div>
                  </div>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">Unavailable nights / year
                    <input type="number" min="0" max="365" step="1" className="du-input du-input-sm min-h-11 mt-1 w-full" {...register("unavailableNights", { onChange: (event) => {
                      if (upliftDraft !== null) changeUplift(upliftDraft, event.target.value.trim() ? Number(event.target.value) : NaN);
                    } })} />
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">Owner stays, maintenance and time before launch. Leaves {Number.isFinite(assumptions.unavailableNights) ? 365 - assumptions.unavailableNights : "—"} nights available.</span>
                  </label>
                  <label className="text-sm font-medium">Operating stage
                    <select className="du-select du-select-sm min-h-11 mt-1 w-full" {...register("listingStage")}><option value="established">Established listing</option><option value="launch_year">Launch year</option></select>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">Allow for time to build reviews in the launch year.</span>
                  </label>
                </div>
                <label className="block text-sm font-medium">Basis for your management estimate
                  <textarea className="du-textarea du-textarea-sm mt-1 w-full resize-y" rows={3} maxLength={300} {...register("rationale")} />
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">Report wording: explain the presentation, pricing and availability assumed.</span>
                </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className="du-btn du-btn-sm du-btn-outline min-h-11" onClick={() => {
                      if (baseline) applyScenario(initialStrManagementScenario(baseline, agency?.str_management_presets));
                      setPresetId("");
                    }}>{companyDefault ? "Restore company defaults" : "Reset assumptions"}</button>
                    <Link href="/settings/agency#str-management-presets" target="_blank" className="text-xs underline">Manage company defaults</Link>
                  </div>
                  </fieldset>
                  </div>
                  <div className="shrink-0 space-y-3 border-t border-base-300 bg-base-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    {!valid && <p role="alert" className="text-sm text-destructive">{upliftIssue ?? (!managementInput.success ? managementInput.error.issues[0]?.message : "Enter a valid nightly rate and occupancy.")}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div aria-live="polite">
                        <p className="text-xs text-muted-foreground">Estimated gross STR revenue</p>
                        <p className="text-lg font-semibold tabular-nums">{valid ? `${formatCurrency(adjusted.annualRevenue)} / year` : "—"}</p>
                      </div>
                      <div className="flex w-full gap-2 sm:w-auto">
                        <DialogClose className="du-btn du-btn-sm du-btn-ghost min-h-11 flex-1 sm:flex-none">Cancel</DialogClose>
                        <button type="button" className="du-btn du-btn-sm du-btn-primary min-h-11 flex-1 sm:flex-none" disabled={!valid || busy || savingDefault} onClick={() => {
                          assumptionsSnapshot.current = null;
                          setAssumptionsOpen(false);
                        }}>Apply changes</button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              {!baseline ? <p className="text-sm text-muted-foreground">This older report has no saved market baseline for adjustments.</p> : null}
            </fieldset>
          </div>
        </div>
      </div>
      </AppraisalStepPanel>
      <AppraisalStepPanel value="comparables">
      <section className="space-y-4" aria-label="Comparable evidence">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Comparables for your proposal</h3>
            {comps.length > 0 && <span role="status" aria-label="Included comparables" className="du-badge du-badge-sm du-badge-ghost">{selectedIds.length} of {MAX_STR_FEATURED_COMPS} included</span>}
          </div>
          {(enrichment?.radius_m || browsingComps) && <p className="mt-1 text-sm text-muted-foreground">
            {enrichment?.radius_m ? `Within ${(enrichment.radius_m / 1000).toLocaleString("en-AU", { maximumFractionDigits: 1 })} km${browsingComps ? " · " : ""}` : ""}
            {browsingComps && "Choose up to six. Deselect one to replace it."}
          </p>}
          <p className="mt-1 text-xs text-muted-foreground">Changing comparables won’t change the revenue estimate.</p>
        </div>
        {comps.length > 0 && <button type="button" className="du-btn du-btn-sm du-btn-outline min-h-11 h-auto whitespace-normal" aria-expanded={browsingComps} onClick={() => {
          setBrowsingComps(!browsingComps); setQuery(""); setManagedOnly(false); setSelectedOnly(false); setSelectionLimitId(null);
        }}>{browsingComps ? "Show included comparables" : "Browse other comparables"}</button>}
        {comps.length > 0 && browsingComps && <ComparableFilters compact query={query} onQueryChange={setQuery} selectedOnly={selectedOnly} onSelectedOnlyChange={setSelectedOnly} totalCount={comps.length} selectedCount={selectedIds.length} visibleCount={shownComps.length}>
          <button
            type="button"
            aria-pressed={managedOnly}
            className="du-btn du-btn-sm min-h-11 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-content"
            onClick={() => setManagedOnly(!managedOnly)}
          >
            Professionally managed ({managedIds.size})
          </button>
        </ComparableFilters>}
        {comps.length > 0 && shownComps.length === 0 && <p className="rounded-xl border border-base-300 p-5 text-sm">{browsingComps ? "No saved comparables match these filters. Clear a filter to review the remaining evidence." : "No comparables are included. Browse other comparables to choose at least one."}</p>}
        {comps.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shownComps.map((comp) => (
              <article
                key={comp.listing_id}
                className="du-card du-card-border min-w-0 overflow-hidden bg-base-100"
              >
                {comp.thumbnail_url ? (
                  <figure className="aspect-[16/9] bg-base-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={comp.thumbnail_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </figure>
                ) : null}
                <div className="du-card-body gap-2 p-4">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="du-checkbox du-checkbox-sm" checked={selectedIds.includes(comp.listing_id)} disabled={busy || savingDefault} onChange={() => toggleComp(comp.listing_id)} aria-label={`Feature ${comp.name}`} aria-describedby={selectionLimitId === comp.listing_id ? `comp-limit-${comp.listing_id}` : undefined} />
                    {selectedIds.includes(comp.listing_id) ? "Included" : "Feature in report"}
                  </label>
                  {selectionLimitId === comp.listing_id && <p id={`comp-limit-${comp.listing_id}`} role="alert" className="du-alert du-alert-error du-alert-soft text-sm">All {MAX_STR_FEATURED_COMPS} places are filled. Deselect an included comparable, then select this property.</p>}
                  <h4 className="du-card-title text-base break-words">
                    {comp.name || "Comparable property"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {comp.bedrooms ?? "—"} bed · {comp.bathrooms ?? "—"} bath ·{" "}
                    {comp.accommodates ?? "—"} guests
                    {comp.distance_m != null
                      ? ` · ${(comp.distance_m / 1000).toFixed(1)} km away`
                      : ""}
                  </p>
                  {comp.property_type && <p className="text-xs text-muted-foreground">{comp.property_type}{comp.suburb ? ` · ${comp.suburb}` : ""}</p>}
                  {propertyContext.amenities.length > 0 && <p className="text-xs text-base-content/70">{matchingStrAmenities(propertyContext.amenities, comp.amenities).length ? `Shared amenities: ${matchingStrAmenities(propertyContext.amenities, comp.amenities).map((item) => item.label).join(", ")}` : "No matching amenities recorded"}</p>}
                  <p className="text-xs text-muted-foreground">{comp.professional_management === true ? "Professionally managed" : comp.professional_management === false ? "Not flagged as professionally managed" : "Management status unknown"}{comp.superhost ? " · Superhost" : ""}</p>
                  {comp.match_notes?.length ? <p className="text-xs text-amber-700">{comp.match_notes.join(" · ")}</p> : null}
                  <p className="mt-1 text-lg font-semibold">
                    {formatCurrency(comp.annual_revenue)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      est. gross / year
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPercent(comp.occupancy_rate)} occupancy ·{" "}
                    {formatCurrency(comp.nightly_rate)} / night
                  </p>
                  {comp.reviews != null && <p className="text-xs text-muted-foreground">{comp.reviews} reviews{comp.rating != null ? ` · ${comp.rating.toFixed(1)} / 5` : ""}</p>}
                  {(comp.reserved_nights != null || comp.blocked_nights != null) && <p className="text-xs text-muted-foreground">{comp.reserved_nights ?? "—"} nights booked · {comp.blocked_nights ?? "—"} blocked in the last year</p>}
                  {comp.amenities?.length || comp.recent_occupancy_rate != null ? <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium">More property evidence</summary>
                    <div className="mt-2 space-y-2">
                      {comp.recent_occupancy_rate != null && <p>Last 90 days: {formatPercent(comp.recent_occupancy_rate)} occupancy{comp.recent_revenue != null ? ` · ${formatCurrency(comp.recent_revenue)} estimated gross revenue` : ""}. This is a shorter, seasonally different period.</p>}
                      {(comp.minimum_nights != null || comp.average_length_of_stay != null) && <p>Minimum stay: {comp.minimum_nights ?? "—"} nights · Average stay: {comp.average_length_of_stay?.toFixed(1) ?? "—"} nights</p>}
                      {(comp.superhost || comp.professional_management || comp.guest_favorite) && <p>{[comp.superhost && "Superhost", comp.professional_management && "Professionally managed", comp.guest_favorite && "Guest favourite"].filter(Boolean).join(" · ")}</p>}
                      {!!comp.amenities?.length && <p>Amenities: {comp.amenities.map((amenity) => amenity.replaceAll("_", " ")).join(", ")}</p>}
                    </div>
                  </details> : null}
                  {/^https?:\/\//i.test(comp.listing_url) ? (
                    <a
                      className="du-btn du-btn-sm du-btn-ghost mt-2 min-h-11 self-start"
                      href={comp.listing_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View property
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="du-alert text-sm">
            Individual comparable listings are unavailable. Review the estimate
            carefully before using it in a report.
          </p>
        )}
      </section>
      </AppraisalStepPanel>
      </AppraisalStepTabs>
      <p className="text-xs leading-relaxed text-muted-foreground">{DEFAULT_DISCLAIMER}</p>
      <div role="group" aria-label="Estimate step actions" className="flex flex-wrap items-center justify-end gap-3 border-t border-base-300 pt-5 [&>button]:w-full sm:[&>button]:w-auto">
        {stepActions}
      </div>
    </section>
  );
});
