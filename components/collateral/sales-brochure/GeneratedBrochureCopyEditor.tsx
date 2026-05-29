"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BlurbBlockEditor } from "@/components/collateral/sales-brochure/BlurbBlockEditor";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { BrochureImagePickerDialog } from "@/components/collateral/sales-brochure/inline/BrochureImagePickerDialog";
import type { BrochureImageSlot } from "@/components/collateral/sales-brochure/inline/EditableContext";
import { enforceSalesBrochureCopyLimits } from "@/lib/collateral/sales-brochure/copyLimits";
import { SALES_BROCHURE_COPY_LIMITS } from "@/lib/collateral/sales-brochure/copyLimits";
import {
  setCopyValueAtPath,
  type BrochureCopyFieldPath,
} from "@/lib/collateral/sales-brochure/editablePaths";
import { replaceBrochureImageAtSlot } from "@/lib/collateral/sales-brochure/brochureImageSlots";
import {
  blurbBlocksToPlainText,
  getBlurbBlocksForEditor,
  normalizeBlurbBlocksForEditor,
} from "@/lib/collateral/sales-brochure/blurbBlocks";
import { coerceSalesBrochureCopyForEditor } from "@/lib/collateral/sales-brochure/propertyHighlights";
import type { BrochureBlurbBlock } from "@/lib/collateral/templates/types";
import { getBrochureImageUrlAtSlot } from "@/lib/collateral/sales-brochure/brochureImageSlots";
import {
  isSalesBrochureDocument,
  type SalesBrochureCopyJson,
  type SalesBrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { resolveReportDisplayPrice } from "@/lib/reports/resolveReportDisplayPrice";
import { cn } from "@/lib/utils";
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
      return coerceSalesBrochureCopyForEditor(document.copy);
    }
    return null;
  }, [collateral.document_json]);

  const [copy, setCopy] = useState<SalesBrochureCopyJson | null>(initialCopy);
  const [propertyImages, setPropertyImages] = useState<
    SalesBrochureDocumentJson["property"] | null
  >(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const document = collateral.document_json;
    if (document && isSalesBrochureDocument(document)) {
      setCopy(coerceSalesBrochureCopyForEditor(document.copy));
      setPropertyImages(document.property);
    }
  }, [collateral.document_json]);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saved" | "error">(
    "idle",
  );
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [imagePickerSlot, setImagePickerSlot] = useState<BrochureImageSlot | null>(
    null,
  );
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutosave = useRef(true);

  const displayPrice = useMemo(
    () => resolveReportDisplayPrice(listing),
    [listing],
  );

  const scrapedPrice = useMemo(() => {
    const document = collateral.document_json;
    return document && isSalesBrochureDocument(document)
      ? document.property.display_price
      : "";
  }, [collateral.document_json]);

  const previewDocument = useMemo((): SalesBrochureDocumentJson | null => {
    const document = collateral.document_json;
    if (!document || !isSalesBrochureDocument(document) || !copy || !propertyImages) {
      return null;
    }

    return {
      ...document,
      copy: coerceSalesBrochureCopyForEditor(copy),
      property: propertyImages,
    };
  }, [collateral.document_json, copy, propertyImages]);

  const persistBrochure = useCallback(
    async (options?: { silent?: boolean }) => {
    if (!copy || !propertyImages) {
      return true;
    }

    setSaving(true);
    setSaveState("pending");
    const response = await fetch(`/api/collateral/${collateral.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        copy,
        property: {
          hero_image_url: propertyImages.hero_image_url,
          selected_image_urls: propertyImages.selected_image_urls,
          page_one_image_urls: propertyImages.page_one_image_urls,
          page_two_image_urls: propertyImages.page_two_image_urls,
        },
      }),
    });
    const payload = (await response.json()) as ApiError & {
      collateral?: CollateralItem;
    };

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to save brochure");
      setSaving(false);
      setSaveState("error");
      return false;
    }

    if (payload.collateral) {
      onCollateralChange(payload.collateral);
    }

    if (!options?.silent) {
      toast.success("Brochure saved");
    }

    setSaving(false);
    setSaveState("saved");
    return true;
  },
    [collateral.id, copy, onCollateralChange, propertyImages],
  );

  useEffect(() => {
    if (!copy || !propertyImages) {
      return;
    }

    if (skipAutosave.current) {
      skipAutosave.current = false;
      return;
    }

    setSaveState("pending");
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }

    autosaveTimer.current = setTimeout(() => {
      void persistBrochure({ silent: true });
    }, 800);

    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, [copy, propertyImages, persistBrochure]);

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
      const doc = payload.collateral.document_json;
      if (doc && isSalesBrochureDocument(doc)) {
        setPropertyImages(doc.property);
      }
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
    // Keep raw input while typing (spaces and length are not clamped).
    setCopy((current) => (current ? { ...current, [field]: value } : current));
  }

  const updateBlurbBlocks = useCallback((blocks: BrochureBlurbBlock[]) => {
    const blurb_blocks = normalizeBlurbBlocksForEditor(blocks);
    const blurb = blurbBlocksToPlainText(blurb_blocks);
    setCopy((current) =>
      current ? { ...current, blurb_blocks, blurb } : current,
    );
  }, []);

  const handleInlineSetField = useCallback(
    (path: BrochureCopyFieldPath, value: string) => {
      setCopy((current) =>
        current ? setCopyValueAtPath(current, path, value) : current,
      );
    },
    [],
  );

  const handleOpenImagePicker = useCallback((slot: BrochureImageSlot) => {
    setImagePickerSlot(slot);
  }, []);

  const handleImageSelect = useCallback(
    (url: string) => {
      if (!previewDocument || !imagePickerSlot) {
        return;
      }
      const next = replaceBrochureImageAtSlot(previewDocument, imagePickerSlot, url);
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

  const saveStatusLabel =
    saveState === "pending" || saving
      ? "Saving…"
      : saveState === "saved"
        ? "All changes saved"
        : saveState === "error"
          ? "Save failed — will retry on your next edit"
          : copy
            ? "Edits autosave"
            : null;

  return (
    <AsyncLoadingOverlay
      active={generating}
      title="Generating collateral"
      description="Writing buyer-facing brochure copy from your listing. This usually takes 10–20 seconds."
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">
              {copy ? "Edit brochure" : "Content generation"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy
                ? "Click the description on the brochure to edit. A small format menu appears above your cursor for paragraphs and section headings."
                : "Generate buyer-facing copy from your listing, then edit directly on the brochure."}
            </p>
            {addressLine ? (
              <p className="mt-1 truncate text-sm font-medium text-foreground">
                {addressLine}
              </p>
            ) : null}
            {copy && listingContextSummary(listing, displayPrice) ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {listingContextSummary(listing, displayPrice)}
              </p>
            ) : null}
            {saveStatusLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">{saveStatusLabel}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
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
              <Button
                variant="outline"
                onClick={continueToPreview}
                disabled={generating || saving}
              >
                Continue to preview
              </Button>
            ) : null}
          </div>
        </div>

        {!copy ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-6 text-sm">
            <p className="font-medium">Listing context</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
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
        ) : null}

        {previewDocument && copy ? (
          <>
            <FittedBrochurePreview
              document={previewDocument}
              maxHeight="min(85vh, 960px)"
              editable={{
                blurbBlocks: getBlurbBlocksForEditor(copy),
                setField: handleInlineSetField,
                setBlurbBlocks: updateBlurbBlocks,
                openImagePicker: handleOpenImagePicker,
              }}
            />

            <details className="group rounded-xl border border-border/70 bg-muted/10">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span>More options</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Headings, highlights, price, legal
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-border/70 px-4 py-4">
                <BlurbBlockEditor
                  blocks={getBlurbBlocksForEditor(copy)}
                  onChange={updateBlurbBlocks}
                />
                <StringListField
                  label={limits.property_highlights.label}
                  hint={limits.property_highlights.hint}
                  values={copy.property_highlights ?? []}
                  maxItems={limits.property_highlights.max}
                  onChange={(values) => updateField("property_highlights", values)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <CopyField
                    id="price_label"
                    label={limits.price_label.label}
                    hint={limits.price_label.hint}
                    value={copy.price_label ?? ""}
                    placeholder="Price"
                    recommendedMax={limits.price_label.max}
                    onChange={(value) => updateField("price_label", value)}
                  />
                  <CopyField
                    id="price_value"
                    label={limits.price_value.label}
                    hint={
                      scrapedPrice
                        ? `${limits.price_value.hint} Listing: ${scrapedPrice}`
                        : limits.price_value.hint
                    }
                    value={copy.price_value ?? ""}
                    placeholder={scrapedPrice || "e.g. $750,000 or Contact Agent"}
                    recommendedMax={limits.price_value.max}
                    onChange={(value) => updateField("price_value", value)}
                  />
                </div>
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
      </div>
    </AsyncLoadingOverlay>
  );
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
  const price = displayPrice ?? listing.display_price;
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
          overRecommended ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
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
  const filled = values
    .map((item) => item.trim())
    .filter(Boolean);
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
          No bullet points yet. Optional — add some if you want a quick list on the
          brochure.
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
