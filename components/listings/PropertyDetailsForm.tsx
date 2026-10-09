"use client";
import { resolveAdvertisedPrice } from "@/lib/listings/pricing";
import { useEffect, useState } from "react";
import { useForm, useFormState, type FieldErrors } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calculateAccommodates } from "@/lib/reports/formatters";
import type { Listing } from "@/lib/types";

const count = z
  .string()
  .refine(
    (v) => !v || (/^\d+$/.test(v) && Number(v) <= 100),
    "Enter a whole number from 0 to 100",
  );
const schema = z.object({
  property_address: z.string().trim().min(1, "Enter the property address"),
  suburb: z.string(),
  state: z.string(),
  postcode: z
    .string()
    .refine((v) => !v || /^\d{4}$/.test(v), "Enter a four-digit postcode"),
  property_type: z.string(),
  bedrooms: count,
  bathrooms: count,
  car_spaces: count,
  accommodates: count,
  listing_title: z.string(),
  advertised_sale_price: z.string(),
  advertised_weekly_rent: z.string(),
  listing_description: z.string(),
});
type Values = z.infer<typeof schema>;
function defaults(listing: Listing): Values {
  return {
    property_address: listing.property_address || "",
    suburb: listing.suburb || "",
    state: listing.state || "",
    postcode: listing.postcode || "",
    property_type: listing.property_type || "",
    bedrooms: String(listing.bedrooms ?? ""),
    bathrooms: String(listing.bathrooms ?? ""),
    car_spaces: String(listing.car_spaces ?? ""),
    accommodates: String(listing.accommodates ?? ""),
    listing_title: listing.listing_title || "",
    advertised_sale_price: resolveAdvertisedPrice(listing, "sale") ?? "",
    advertised_weekly_rent: resolveAdvertisedPrice(listing, "lease") ?? "",
    listing_description: listing.listing_description || "",
  };
}
const fields = [
  ["property_address", "Street address"],
  ["suburb", "Suburb"],
  ["state", "State"],
  ["postcode", "Postcode"],
  ["property_type", "Property type"],
  ["bedrooms", "Bedrooms"],
  ["bathrooms", "Bathrooms"],
  ["car_spaces", "Car spaces"],
  ["advertised_sale_price", "Advertised sale price"],
  ["advertised_weekly_rent", "Advertised weekly rent"],
] as const;
export function PropertyDetailsForm({
  listing,
  onSaved,
  onDirtyChange,
}: {
  listing: Listing;
  onSaved: (listing: Listing) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const form = useForm<Values>({
    defaultValues: defaults(listing),
    resolver: async (values) => {
      const result = schema.safeParse(values);
      if (result.success) return { values: result.data, errors: {} };
      return {
        values: {},
        errors: Object.fromEntries(
          result.error.issues.map((issue) => [
            issue.path[0],
            { type: issue.code, message: issue.message },
          ]),
        ) as FieldErrors<Values>,
      };
    },
  });
  const { isDirty, isSubmitting, errors } = useFormState({
    control: form.control,
  });
  useEffect(() => {
    onDirtyChange(isDirty || isSubmitting || generating);
    return () => onDirtyChange(false);
  }, [isDirty, isSubmitting, generating, onDirtyChange]);
  async function save(values: Values) {
    setError("");
    try {
      const body = {
        ...values,
        bedrooms: values.bedrooms === "" ? null : Number(values.bedrooms),
        bathrooms: values.bathrooms === "" ? null : Number(values.bathrooms),
        car_spaces: values.car_spaces === "" ? null : Number(values.car_spaces),
        accommodates: calculateAccommodates(
          values.bedrooms === "" ? null : Number(values.bedrooms),
          values.accommodates === "" ? null : Number(values.accommodates),
        ),
      };
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to save property details");
      form.reset(defaults(result.listing));
      onSaved(result.listing);
      toast.success("Property details saved");
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to save. Your changes are still here.",
      );
    }
  }
  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const response = await fetch(
        `/api/listings/${listing.id}/generate-description`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to generate description");
      form.setValue("listing_description", result.description, {
        shouldDirty: true,
      });
      toast.success("Description ready to review. Save to apply it.");
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to generate description",
      );
    } finally {
      setGenerating(false);
    }
  }
  return (
    <form
      aria-label="Property details"
      onSubmit={form.handleSubmit(save)}
      className="space-y-6"
    >
      <section className="rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-6">
        <h2 className="font-display text-xl">Property details</h2>
        <p className="mt-1 text-sm text-base-content/65">
          Shared information for new collateral. Published collateral keeps its
          saved content.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([key, label]) => (
            <div
              key={key}
              className={
                key === "property_address" ? "sm:col-span-2 lg:col-span-3" : ""
              }
            >
              <Label htmlFor={`property-${key}`}>{label}</Label>
              <Input
                id={`property-${key}`}
                  aria-label={label}
                {...form.register(key)}
                aria-invalid={!!errors[key]}
                aria-describedby={errors[key] ? `error-${key}` : undefined}
                className="mt-2"
                inputMode={
                  ["bedrooms", "bathrooms", "car_spaces", "postcode"].includes(
                    key,
                  )
                    ? "numeric"
                    : "text"
                }
              />
              {errors[key] && (
                <p
                  id={`error-${key}`}
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {errors[key]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-5 rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-xl">Property description</h2>
          <p className="mt-1 text-sm text-base-content/65">
            A starting point for brochures and reports. Each document can have
            its own copy.
          </p>
        </div>
        <div>
          <Label htmlFor="property-title">Headline</Label>
          <Input
            id="property-title"
            className="mt-2"
            {...form.register("listing_title")}
          />
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="property-description">Description</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isDirty || isSubmitting || generating}
              onClick={generate}
            >
              {generating ? "Writing…" : "Suggest description"}
            </Button>
          </div>
          {isDirty && (
            <p className="mb-2 text-xs text-base-content/60">
              Save property changes before requesting a fresh description.
            </p>
          )}
          <Textarea
            id="property-description"
            className="min-h-64"
            {...form.register("listing_description")}
          />
        </div>
      </section>
      <details className="rounded-xl border border-base-300 bg-base-100 p-5">
        <summary className="cursor-pointer text-sm font-medium">
          Short-term rental details
        </summary>
        <div className="mt-4 max-w-sm">
          <Label htmlFor="property-guests">Maximum guests</Label>
          <Input
            id="property-guests"
            inputMode="numeric"
            {...form.register("accommodates")}
            className="mt-2"
            aria-invalid={!!errors.accommodates}
          />
          <p className="mt-2 text-xs text-base-content/65">
            Leave blank to use two guests per bedroom.
          </p>
          {errors.accommodates && (
            <p role="alert" className="text-xs text-destructive">
              {errors.accommodates.message}
            </p>
          )}
        </div>
      </details>
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <div>
          <p role="status" className="text-sm text-base-content/65">
            {isSubmitting
              ? "Saving…"
              : isDirty
                ? "Unsaved changes"
                : "All changes saved"}
          </p>
          {error && (
            <p role="alert" className="mt-1 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || isSubmitting || generating}
            onClick={() => {
              form.reset();
              setError("");
            }}
          >
            Discard
          </Button>
          <Button
            type="submit"
            disabled={!isDirty || isSubmitting || generating}
          >
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}
