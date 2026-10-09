"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";
import { BrochureGenerationStatus } from "@/components/collateral/sales-brochure/BrochureGenerationStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BlurbVariantsEditor } from "@/components/collateral/sales-brochure/BlurbVariantsEditor";
import { BlurbLengthMappingPanel } from "@/components/dev/BlurbLengthMappingPanel";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { BrochureImagePickerDialog } from "@/components/collateral/sales-brochure/inline/BrochureImagePickerDialog";
import type { BrochureImageSlot } from "@/components/collateral/sales-brochure/inline/EditableContext";
import {
  getBrochureEditorBlurb,
  setBrochureEditorBlurb,
} from "@/lib/collateral/sales-brochure/brochureEditorBlurb";
import { pagesFromTemplateId } from "@/lib/reports/templates/playgroundResolve";
import { SALES_BROCHURE_COPY_LIMITS } from "@/lib/collateral/sales-brochure/copyLimits";
import {
  setCopyValueAtPath,
  type BrochureCopyFieldPath,
} from "@/lib/collateral/sales-brochure/editablePaths";
import { replaceBrochureImageAtSlot } from "@/lib/collateral/sales-brochure/brochureImageSlots";
import { normalizeBlurbBlocksForEditor } from "@/lib/collateral/sales-brochure/blurbBlocks";
import { coerceSalesBrochureCopyForEditor } from "@/lib/collateral/sales-brochure/propertyHighlights";
import type { BrochureBlurbBlock } from "@/lib/collateral/templates/types";
import { getBrochureImageUrlAtSlot } from "@/lib/collateral/sales-brochure/brochureImageSlots";
import {
  isBrochureDocument,
  type SalesBrochureCopyJson,
  type BrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { resolveListingImageMetaForPool } from "@/lib/listings/syncListingImageMeta";
import {
  resolveAdvertisedPrice,
  avmPriceSuggestion,
} from "@/lib/listings/pricing";
import { cn } from "@/lib/utils";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
} from "@/lib/types";

type Props = {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  agencyAgents?: AgentProfile[];
  agentProfile?: AgentProfile | null;
  onCollateralChange: (collateral: CollateralItem) => void;
  onContinueToPreview?: () => void;
  onBusyChange?: (busy: boolean) => void;
};

type ApiError = {
  error?: string;
  code?: string;
};

export type BrochureCopyEditorHandle = {
  flushPendingEdits: () => void;
  savePendingEdits: () => Promise<boolean>;
  getPreviewDocument: () => BrochureDocumentJson | null;
};

export const GeneratedBrochureCopyEditor = forwardRef<
  BrochureCopyEditorHandle,
  Props
>(function GeneratedBrochureCopyEditor(
  {
    listing,
    collateral,
    agencyAgents = [],
    agentProfile = null,
    onCollateralChange,
    onContinueToPreview,
    onBusyChange,
  }: Props,
  ref,
) {
  const initialCopy = useMemo(() => {
    const document = collateral.document_json;
    if (document && isBrochureDocument(document)) {
      return coerceSalesBrochureCopyForEditor(document.copy);
    }
    return null;
  }, [collateral.document_json]);

  const [copy, setCopy] = useState<SalesBrochureCopyJson | null>(initialCopy);
  const copyRef = useRef(initialCopy);
  const templateId =
    collateral.template_id ??
    (collateral.document_json && isBrochureDocument(collateral.document_json)
      ? collateral.document_json.template_id
      : "");
  const blurbFlushRef = useRef<(() => BrochureBlurbBlock[] | null) | null>(
    null,
  );
  const [propertyImages, setPropertyImages] = useState<
    BrochureDocumentJson["property"] | null
  >(() => {
    const document = collateral.document_json;
    return document && isBrochureDocument(document) ? document.property : null;
  });
  const propertyImagesRef = useRef(propertyImages);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(
    () =>
      initialCopy && propertyImages
        ? brochureEditorSnapshot(initialCopy, propertyImages)
        : null,
  );

  const commitCopy = useCallback(
    (updater: (current: SalesBrochureCopyJson) => SalesBrochureCopyJson) => {
      const current = copyRef.current;
      if (!current) return;
      const next = updater(current);
      copyRef.current = next;
      setCopy(next);
    },
    [],
  );

  const flushPendingEdits = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const flushedBlocks = blurbFlushRef.current?.();
    if (flushedBlocks && copyRef.current) {
      const blurb_blocks = normalizeBlurbBlocksForEditor(flushedBlocks);
      if (
        JSON.stringify(blurb_blocks) ===
        JSON.stringify(
          normalizeBlurbBlocksForEditor(
            getBrochureEditorBlurb(copyRef.current, templateId),
          ),
        )
      )
        return;
      const next = setBrochureEditorBlurb(
        copyRef.current,
        blurb_blocks,
        templateId,
      );
      copyRef.current = next;
      setCopy(next);
    }
  }, [templateId]);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [previousDocument, setPreviousDocument] = useState(
    collateral.document_json,
  );
  if (previousDocument !== collateral.document_json) {
    setPreviousDocument(collateral.document_json);
    const document = collateral.document_json;
    if (document && isBrochureDocument(document)) {
      const nextCopy = coerceSalesBrochureCopyForEditor(document.copy);
      setCopy(nextCopy);
      setPropertyImages(document.property);
      setLastSavedSnapshot(brochureEditorSnapshot(nextCopy, document.property));
      setSaveFailed(false);
    }
  }

  const savedSnapshotRef = useRef(lastSavedSnapshot);
  const saveInFlightRef = useRef(false);
  useEffect(() => {
    onBusyChange?.(saving || generating);
    return () => onBusyChange?.(false);
  }, [saving, generating, onBusyChange]);

  // Imperative preview/save handlers read the last committed editor state.
  useLayoutEffect(() => {
    copyRef.current = copy;
    propertyImagesRef.current = propertyImages;
    savedSnapshotRef.current = lastSavedSnapshot;
  }, [copy, propertyImages, lastSavedSnapshot]);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [imagePickerSlot, setImagePickerSlot] =
    useState<BrochureImageSlot | null>(null);

  const displayPrice = useMemo(
    () =>
      resolveAdvertisedPrice(
        listing,
        collateral.type === "rental_brochure" ? "lease" : "sale",
      ),
    [listing, collateral.type],
  );

  const estimate = avmPriceSuggestion(
    listing,
    collateral.type === "rental_brochure" ? "lease" : "sale",
  );

  const scrapedPrice = useMemo(() => {
    const document = collateral.document_json;
    return document && isBrochureDocument(document)
      ? document.property.display_price
      : "";
  }, [collateral.document_json]);

  const currentSnapshot = useMemo(() => {
    if (!copy || !propertyImages) {
      return null;
    }
    return brochureEditorSnapshot(copy, propertyImages);
  }, [copy, propertyImages]);

  const isDirty =
    currentSnapshot != null &&
    lastSavedSnapshot != null &&
    currentSnapshot !== lastSavedSnapshot;

  const previewDocument = useMemo((): BrochureDocumentJson | null => {
    const document = collateral.document_json;
    if (
      !document ||
      !isBrochureDocument(document) ||
      !copy ||
      !propertyImages
    ) {
      return null;
    }

    return {
      ...document,
      copy: coerceSalesBrochureCopyForEditor(copy),
      property: propertyImages,
      listing_image_meta: resolveListingImageMetaForPool(listing),
    };
  }, [collateral.document_json, copy, listing, propertyImages]);

  const buildPreviewDocument = useCallback((): BrochureDocumentJson | null => {
    const document = collateral.document_json;
    const copyToUse = copyRef.current;
    const propertyToUse = propertyImagesRef.current;
    if (
      !document ||
      !isBrochureDocument(document) ||
      !copyToUse ||
      !propertyToUse
    ) {
      return null;
    }

    return {
      ...document,
      copy: coerceSalesBrochureCopyForEditor(copyToUse),
      property: propertyToUse,
      listing_image_meta: resolveListingImageMetaForPool(listing),
    };
  }, [collateral.document_json, listing]);

  const persistBrochure = useCallback(
    async (options?: { silent?: boolean }) => {
      if (saveInFlightRef.current) return false;
      flushPendingEdits();
      const copyToSave = copyRef.current;
      const propertyToSave = propertyImagesRef.current;
      if (!copyToSave || !propertyToSave) return true;
      const snapshotToSave = brochureEditorSnapshot(copyToSave, propertyToSave);
      if (snapshotToSave === savedSnapshotRef.current) return true;
      saveInFlightRef.current = true;
      setSaving(true);
      setSaveFailed(false);
      try {
        const response = await fetch(`/api/collateral/${collateral.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            copy: copyToSave,
            property: {
              hero_image_url: propertyToSave.hero_image_url,
              selected_image_urls: propertyToSave.selected_image_urls,
              page_one_image_urls: propertyToSave.page_one_image_urls,
              page_two_image_urls: propertyToSave.page_two_image_urls,
            },
          }),
        });
        const payload = (await response.json()) as ApiError & {
          collateral?: CollateralItem;
        };
        if (!response.ok || !payload.collateral)
          throw new Error(payload.error ?? "Unable to save brochure");
        savedSnapshotRef.current = snapshotToSave;
        setLastSavedSnapshot(snapshotToSave);
        onCollateralChange(payload.collateral);
        if (!options?.silent) toast.success("Brochure saved");
        return true;
      } catch (err) {
        setSaveFailed(true);
        toast.error(
          err instanceof Error ? err.message : "Unable to save brochure",
        );
        return false;
      } finally {
        setSaving(false);
        saveInFlightRef.current = false;
      }
    },
    [collateral.id, flushPendingEdits, onCollateralChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      flushPendingEdits,
      getPreviewDocument: buildPreviewDocument,
      savePendingEdits: () => persistBrochure({ silent: true }),
    }),
    [buildPreviewDocument, flushPendingEdits, persistBrochure],
  );

  async function generateCopy() {
    if (generating || saving) return;
    if (copy && !confirmRegenerate) {
      setConfirmRegenerate(true);
      return;
    }
    if (!(await persistBrochure({ silent: true }))) return;
    setConfirmRegenerate(false);
    setGenerating(true);
    setGenerationError(null);
    try {
      const response = await fetch(
        `/api/collateral/${collateral.id}/generate-copy`,
        { method: "POST" },
      );
      const payload = (await response.json()) as ApiError & {
        collateral?: CollateralItem;
      };
      if (
        !response.ok ||
        !payload.collateral?.document_json ||
        !isBrochureDocument(payload.collateral.document_json)
      )
        throw new Error(
          payload.error ?? "Unable to write your brochure. Try again.",
        );
      onCollateralChange(payload.collateral);
    } catch (err) {
      setGenerationError(
        err instanceof Error
          ? err.message
          : "Unable to write your brochure. Try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function continueToPreview() {
    if (await persistBrochure({ silent: true })) onContinueToPreview?.();
  }

  function updateField(
    field: keyof SalesBrochureCopyJson,
    value: string | string[],
  ) {
    commitCopy((current) => ({ ...current, [field]: value }));
  }

  const updateBlurbBlocks = useCallback(
    (blocks: BrochureBlurbBlock[]) => {
      commitCopy((current) => {
        const normalized = normalizeBlurbBlocksForEditor(blocks);
        if (
          JSON.stringify(normalized) ===
          JSON.stringify(getBrochureEditorBlurb(current, templateId))
        )
          return current;
        return setBrochureEditorBlurb(current, normalized, templateId);
      });
    },
    [commitCopy, templateId],
  );

  const handleInlineSetField = useCallback(
    (path: BrochureCopyFieldPath, value: string) => {
      commitCopy((current) => setCopyValueAtPath(current, path, value));
    },
    [commitCopy],
  );

  const handleOpenImagePicker = useCallback((slot: BrochureImageSlot) => {
    setImagePickerSlot(slot);
  }, []);

  const handleImageSelect = useCallback(
    (url: string) => {
      if (!previewDocument || !imagePickerSlot) {
        return;
      }
      const next = replaceBrochureImageAtSlot(
        previewDocument,
        imagePickerSlot,
        url,
      );
      propertyImagesRef.current = next.property;
      setPropertyImages(next.property);
      setImagePickerSlot(null);
    },
    [imagePickerSlot, previewDocument],
  );

  const addressLine = [
    listing.property_address,
    listing.suburb,
    listing.state,
    listing.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const limits = SALES_BROCHURE_COPY_LIMITS;

  if (generating) return <BrochureGenerationStatus />;
  return (
    <section data-theme="staypack-workspace" className="space-y-5">
      <DocumentStepHeader
        title={copy ? "Edit your brochure" : "Create your brochure"}
        description={
          copy
            ? "Click the text to edit, or a photo to replace it. Your changes save when you continue."
            : "Your design is saved. Generate the wording to start editing."
        }
        status={
          <span role="status" className="du-badge du-badge-sm">
            {saving
              ? "Saving…"
              : saveFailed
                ? "Save failed"
                : isDirty
                  ? "Unsaved changes"
                  : copy
                    ? "All changes saved"
                    : "Ready to generate"}
          </span>
        }
      >
        <button
          type="button"
          className="du-btn du-btn-sm du-btn-primary min-h-11"
          disabled={saving}
          onClick={() => void (copy ? continueToPreview() : generateCopy())}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {saving
            ? "Saving…"
            : copy
              ? isDirty || saveFailed
                ? "Save & preview"
                : "Review & download"
              : "Generate brochure"}
          {!saving ? (
            <ArrowRight className="size-4" aria-hidden="true" />
          ) : null}
        </button>
      </DocumentStepHeader>
      {saveFailed ? (
        <p role="alert" className="du-alert du-alert-error du-alert-soft">
          Your changes couldn’t be saved. Try Save & preview again.
        </p>
      ) : null}
      {generationError ? (
        <p role="alert" className="du-alert du-alert-error du-alert-soft">
          {generationError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium">{addressLine}</p>
          <p className="text-xs text-muted-foreground">
            {listingContextSummary(listing, displayPrice)}
          </p>
        </div>
        {copy ? (
          <details className="group rounded-xl border border-base-300 bg-base-100 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Rewrite brochure copy
            </summary>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Generate fresh wording from the listing. This replaces your
              current copy; your selected photos and price are kept.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="du-btn du-btn-sm min-h-11"
                disabled={saving}
                onClick={() => void generateCopy()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {confirmRegenerate ? "Confirm rewrite" : "Rewrite copy"}
              </button>
              {confirmRegenerate ? (
                <button
                  type="button"
                  className="du-btn du-btn-sm du-btn-ghost min-h-11"
                  onClick={() => setConfirmRegenerate(false)}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
      <fieldset
        disabled={saving}
        className="mx-auto flex w-full max-w-4xl flex-col gap-5 disabled:pointer-events-none disabled:opacity-70"
      >
        {!copy ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-6 text-sm">
            <p className="font-medium">Listing context</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <ContextMetric
                label="Bedrooms"
                value={
                  listing.bedrooms != null ? String(listing.bedrooms) : "—"
                }
              />
              <ContextMetric
                label="Bathrooms"
                value={
                  listing.bathrooms != null ? String(listing.bathrooms) : "—"
                }
              />
              <ContextMetric label="Guide price" value={displayPrice ?? "—"} />
            </div>
          </div>
        ) : null}

        {previewDocument && copy ? (
          <>
            <FittedBrochurePreview
              document={previewDocument}
              listing={listing}
              agencyAgents={agencyAgents}
              agentProfile={agentProfile}
              collateralType={
                collateral.type === "rental_brochure"
                  ? "rental_brochure"
                  : "sales_brochure"
              }
              useDocumentBrand
              pageLabels={["Cover", "Property details"]}
              maxHeight="min(85vh, 960px)"
              editable={{
                blurbBlocks: getBrochureEditorBlurb(copy, templateId),
                setField: handleInlineSetField,
                setBlurbBlocks: updateBlurbBlocks,
                openImagePicker: handleOpenImagePicker,
                blurbFlushRef,
              }}
            />

            <details className="group rounded-xl border border-border/70 bg-muted/10">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span>Text and property details</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Headings, highlights,{" "}
                  {collateral.type === "rental_brochure"
                    ? "rent, bond, legal"
                    : "price, legal"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-border/70 px-4 py-4">
                <BlurbVariantsEditor
                  copy={copy}
                  onChange={(next) => commitCopy(() => next)}
                />
                <BlurbLengthMappingPanel
                  copy={copy}
                  collateral="sale"
                  pages={
                    previewDocument
                      ? pagesFromTemplateId(previewDocument.template_id, "sale")
                      : 1
                  }
                  onChange={(next) => commitCopy(() => next)}
                />
                <StringListField
                  label={limits.property_highlights.label}
                  hint={limits.property_highlights.hint}
                  values={copy.property_highlights ?? []}
                  maxItems={limits.property_highlights.max}
                  onChange={(values) =>
                    updateField("property_highlights", values)
                  }
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <CopyField
                    id="price_label"
                    label={
                      collateral.type === "rental_brochure"
                        ? "Rent label"
                        : limits.price_label.label
                    }
                    hint={
                      collateral.type === "rental_brochure"
                        ? "Wording shown above the weekly rent. Leave blank for For lease."
                        : limits.price_label.hint
                    }
                    value={copy.price_label ?? ""}
                    placeholder={
                      collateral.type === "rental_brochure"
                        ? "For lease"
                        : "Price"
                    }
                    recommendedMax={limits.price_label.max}
                    onChange={(value) => updateField("price_label", value)}
                  />
                  <CopyField
                    id="price_value"
                    label={
                      collateral.type === "rental_brochure"
                        ? "Rent"
                        : limits.price_value.label
                    }
                    hint={
                      collateral.type === "rental_brochure"
                        ? `Only this rental brochure. Leave blank to use advertised weekly rent${scrapedPrice ? `: ${scrapedPrice}` : ", if available"}.`
                        : scrapedPrice
                          ? `${limits.price_value.hint} Advertised sale price: ${scrapedPrice}`
                          : limits.price_value.hint
                    }
                    value={copy.price_value ?? ""}
                    placeholder={
                      scrapedPrice ||
                      (collateral.type === "rental_brochure"
                        ? "e.g. $850 per week"
                        : "e.g. $750,000 or Contact Agent")
                    }
                    recommendedMax={limits.price_value.max}
                    onChange={(value) => updateField("price_value", value)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {copy.price_value?.trim()
                    ? "Your override"
                    : scrapedPrice
                      ? "Advertised price"
                      : "No advertised price available"}
                  . Changes here apply only to this brochure.
                </p>
                {!scrapedPrice && estimate && (
                  <div className="rounded-xl border p-4 text-sm space-y-2">
                    <p>
                      Automated estimate: {estimate.display}
                      {estimate.date ? ` · ${estimate.date}` : ""}
                      {estimate.confidence
                        ? ` · ${estimate.confidence} confidence`
                        : ""}
                      . Review before using as an advertised price.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updateField("price_value", estimate.display)
                      }
                    >
                      {collateral.type === "rental_brochure"
                        ? "Use estimated rent"
                        : "Use estimated sale price"}
                    </Button>
                  </div>
                )}
                {collateral.type === "rental_brochure" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CopyField
                      id="bond_label"
                      label={limits.bond_label.label}
                      hint={limits.bond_label.hint}
                      value={copy.bond_label ?? ""}
                      placeholder="Bond"
                      recommendedMax={limits.bond_label.max}
                      onChange={(value) => updateField("bond_label", value)}
                    />
                    <CopyField
                      id="bond_value"
                      label={limits.bond_value.label}
                      hint={limits.bond_value.hint}
                      value={copy.bond_value ?? ""}
                      placeholder="e.g. $4,320"
                      recommendedMax={limits.bond_value.max}
                      onChange={(value) => updateField("bond_value", value)}
                    />
                  </div>
                ) : null}
                <CopyField
                  id="page_two_note"
                  label={limits.page_two_note.label}
                  hint={limits.page_two_note.hint}
                  value={copy.page_two_note ?? ""}
                  recommendedMax={limits.page_two_note.max}
                  multiline
                  onChange={(value) => updateField("page_two_note", value)}
                />
                <CopyField
                  id="disclaimer"
                  label={limits.disclaimer.label}
                  hint={limits.disclaimer.hint}
                  value={copy.disclaimer}
                  recommendedMax={limits.disclaimer.max}
                  multiline
                  onChange={(value) => updateField("disclaimer", value)}
                />
              </div>
            </details>

            <BrochureImagePickerDialog
              open={imagePickerSlot != null}
              onOpenChange={(open) => {
                if (!open) {
                  setImagePickerSlot(null);
                }
              }}
              listing={listing}
              slot={imagePickerSlot}
              currentUrl={
                previewDocument && imagePickerSlot
                  ? getBrochureImageUrlAtSlot(previewDocument, imagePickerSlot)
                  : undefined
              }
              onSelect={handleImageSelect}
            />
          </>
        ) : (
          <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            Generate collateral to preview and edit your brochure here.
          </div>
        )}
      </fieldset>
    </section>
  );
});

function brochureEditorSnapshot(
  copy: SalesBrochureCopyJson,
  property: BrochureDocumentJson["property"],
) {
  return JSON.stringify({
    copy,
    property: {
      hero_image_url: property.hero_image_url,
      selected_image_urls: property.selected_image_urls,
      page_one_image_urls: property.page_one_image_urls,
      page_two_image_urls: property.page_two_image_urls,
    },
  });
}

function listingContextSummary(
  listing: Listing,
  displayPrice: string | null | undefined,
) {
  const parts: string[] = [];
  if (listing.bedrooms != null) {
    parts.push(`${listing.bedrooms} bed`);
  }
  if (listing.bathrooms != null) {
    parts.push(`${listing.bathrooms} bath`);
  }
  const price = displayPrice;
  if (price) {
    parts.push(`Listing price: ${price}`);
  }
  return parts.length ? parts.join(" · ") : null;
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
  recommendedMax,
  multiline,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  recommendedMax: number;
  multiline?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const overRecommended = value.length > recommendedMax;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={4}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <p
        className={cn(
          "text-xs",
          overRecommended
            ? "text-amber-700 dark:text-amber-400"
            : "text-muted-foreground",
        )}
      >
        {value.length} characters
        {overRecommended
          ? ` (recommended ${recommendedMax} — layout may overflow)`
          : ` (recommended ${recommendedMax})`}
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
  const filled = values.map((item) => item.trim()).filter(Boolean);
  const canAdd = values.length < maxItems;

  function updateAt(index: number, text: string) {
    const next = [...values];
    while (next.length <= index) {
      next.push("");
    }
    next[index] = text;
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>

      {values.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
          No bullet points yet. Optional — add some if you want a quick list on
          the brochure.
        </p>
      ) : (
        <div className="space-y-2">
          {values.map((value, index) => (
            <div key={`${label}-${index}`} className="flex gap-2">
              <Input
                className="flex-1"
                value={value}
                placeholder={`Highlight ${index + 1}`}
                onChange={(event) => updateAt(index, event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                aria-label={`Remove highlight ${index + 1}`}
                onClick={() => removeAt(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {canAdd ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...values, ""])}
        >
          Add highlight
        </Button>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {filled.length}/{maxItems} highlights
      </p>
    </div>
  );
}
