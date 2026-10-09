"use client";

import type { UseFormReturn } from "react-hook-form";
import { Check, ImageIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ListingAgentsEditor } from "@/components/reports/ListingAgentsEditor";
import type { NewListingValues } from "@/lib/listings/newListingDraft";
import type { LookupMedia } from "@/lib/listings/propertyLookupTypes";
import type { ListingAgentDraft } from "@/lib/reports/listingAgents";
import type { AgentProfile, Listing } from "@/lib/types";

function photoDate(date?: string) {
  return date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Date unknown";
}

function PropertyPhotos({
  draft,
  onChange,
}: {
  draft: Listing;
  onChange: (draft: Listing) => void;
}) {
  const media = draft.scraped_listing_json?.propertyLookup?.media ?? [];
  const photos = media.filter((item) => item.role === "photo");
  const plans = media.filter((item) => item.role === "floor_plan");
  const selected = draft.selected_image_urls ?? [];
  const dates = [...new Set(photos.map((item) => item.date ?? ""))]
    .sort()
    .reverse();
  const latest = photos.filter((item) => (item.date ?? "") === dates[0]);
  const older = photos.filter((item) => (item.date ?? "") !== dates[0]);
  const historical = media.length > 0 && !media.some((item) => item.current);

  function select(urls: string[], hero = draft.hero_image_url) {
    const next = [...new Set(urls)].slice(0, 25);
    onChange({
      ...draft,
      selected_image_urls: next,
      hero_image_url: hero && next.includes(hero) ? hero : (next[0] ?? null),
    });
  }
  function grid(items: LookupMedia[]) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => {
          const picked = selected.includes(item.url);
          return (
            <div
              key={item.url}
              className={`overflow-hidden rounded-xl border ${picked ? "border-primary ring-1 ring-primary" : "border-border"}`}
            >
              <button
                type="button"
                aria-pressed={picked}
                aria-label={`${picked ? "Deselect" : "Select"} photo ${index + 1}${item.date ? ` from ${photoDate(item.date)}` : ""}`}
                disabled={!picked && selected.length >= 25}
                onClick={() =>
                  select(
                    picked
                      ? selected.filter((url) => url !== item.url)
                      : [...selected, item.url],
                  )
                }
                className="relative block aspect-[4/3] w-full bg-muted disabled:opacity-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={`Property photo ${index + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {picked && (
                  <span className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
              <div className="flex min-h-10 items-center justify-between gap-1 px-2 py-1 text-xs">
                <span className="text-muted-foreground">
                  {item.current ? "Listing photo" : photoDate(item.date)}
                </span>
                {picked && (
                  <button
                    type="button"
                    onClick={() => select(selected, item.url)}
                    aria-label={`Make photo ${index + 1} the cover`}
                    aria-pressed={draft.hero_image_url === item.url}
                    className="flex items-center gap-1 rounded p-1 hover:bg-muted"
                  >
                    <Star
                      className={`h-3 w-3 ${draft.hero_image_url === item.url ? "fill-primary text-primary" : ""}`}
                    />
                    {draft.hero_image_url === item.url ? "Cover" : "Set cover"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section
      className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6"
      aria-labelledby="new-photos-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="new-photos-heading" className="font-semibold">
            Property photos
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected.length} of 25 selected. Choose a cover photo using the
            star.
          </p>
        </div>
        {selected.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => select([])}
          >
            Clear selection
          </Button>
        )}
      </div>
      {historical && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          <p>
            These are historical photos
            {dates[0] ? `, most recently dated ${photoDate(dates[0])}` : ""}.
            Check that they still represent the property before using them.
          </p>
          {latest.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => select(latest.map((item) => item.url))}
            >
              Select latest photos
            </Button>
          )}
        </div>
      )}
      {photos.length ? (
        grid(latest)
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <ImageIcon className="mx-auto mb-2 h-6 w-6" />
          No property photos found. You can upload photos after creating the
          listing.
        </div>
      )}
      {older.length > 0 && (
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm font-medium">
            Older photos ({older.length})
          </summary>
          <div className="pt-3">{grid(older)}</div>
        </details>
      )}
      {plans.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Floor plans ({plans.length})
          </summary>
          <p className="my-3 text-sm text-muted-foreground">
            Saved separately from your photo selection. Review historical plans
            before using them.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {plans.map((item, index) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={`Floor plan ${index + 1}`}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-contain"
                />
                <span className="text-xs text-muted-foreground">
                  {item.current ? "Listing floor plan" : photoDate(item.date)}
                </span>
              </a>
            ))}
          </div>
        </details>
      )}
      <p className="text-xs text-muted-foreground">
        You can create the listing now and finish photos later. At least 5
        selected property photos are needed to create marketing material.
      </p>
    </section>
  );
}

export function NewListingReview({
  draft,
  onDraftChange,
  form,
  agents,
  onAgentsChange,
  agencyAgents,
}: {
  draft: Listing;
  onDraftChange: (draft: Listing) => void;
  form: UseFormReturn<NewListingValues>;
  agents: ListingAgentDraft[];
  onAgentsChange: (agents: ListingAgentDraft[]) => void;
  agencyAgents: AgentProfile[];
}) {
  const source = draft.scraped_listing_json?.propertyLookup;
  const purpose = draft.listing_purpose;
  function field(
    name: keyof NewListingValues,
    label: string,
    placeholder = "",
    numeric = false,
  ) {
    const error = form.formState.errors[name];
    return (
      <div className="space-y-1.5" key={name}>
        <Label htmlFor={`new-${name}`}>{label}</Label>
        <Input
          id={`new-${name}`}
          {...form.register(name)}
          placeholder={placeholder}
          inputMode={numeric ? "numeric" : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `new-${name}-error` : undefined}
        />
        {error && (
          <p id={`new-${name}-error`} className="text-sm text-destructive">
            {error.message}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <section
        className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6"
        aria-labelledby="new-details-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="new-details-heading" className="font-semibold">
            Property details
          </h3>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {source?.activeListingId
              ? "Active listing found"
              : source?.source === "domain"
                ? "Property profile found"
                : source?.source === "url"
                  ? "Listing imported"
                  : source
                    ? "Address found"
                    : "Manual entry"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Check the unit and street number, then confirm or correct the details
          below. Only the street address is required to get started.
        </p>
        {draft.scraped_listing_json?.warnings.map((warning, index) => (
          <p
            key={index}
            className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950"
          >
            {warning}
          </p>
        ))}
        {field(
          "property_address",
          "Street address",
          "e.g. 18/8–12 Ascot Street",
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {field("suburb", "Suburb")}
          {field("state", "State", "NSW")}
          {field("postcode", "Postcode", "2033", true)}
        </div>
        {field("property_type", "Property type", "e.g. Apartment")}
        <div className="grid grid-cols-3 gap-3">
          {field("bedrooms", "Bedrooms", "Unknown", true)}
          {field("bathrooms", "Bathrooms", "Unknown", true)}
          {field("car_spaces", "Car spaces", "Unknown", true)}
        </div>
        {draft.scraped_listing_json?.floorAreaSqm && (
          <p className="text-sm text-muted-foreground">
            Property profile: {draft.scraped_listing_json.floorAreaSqm} m²
            internal area
            {source?.features?.length ? ` · ${source.features.join(", ")}` : ""}
          </p>
        )}
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Listing copy and price (optional)
            {draft.listing_title || draft.display_price ? " · Imported" : ""}
          </summary>
          <div className="mt-4 space-y-4">
            {field("listing_title", "Headline")}
            <div className="space-y-1.5">
              <Label htmlFor="new-listing_description">Description</Label>
              <Textarea
                id="new-listing_description"
                {...form.register("listing_description")}
                className="max-h-80"
              />
            </div>
            {field("advertised_sale_price", "Advertised sale price", "e.g. $1,175,000")}
            {field("advertised_weekly_rent", "Advertised weekly rent", "e.g. $850 per week")}
            {purpose === "lease" && field("bond", "Bond", "Optional")}
          </div>
        </details>
      </section>
      <PropertyPhotos draft={draft} onChange={onDraftChange} />
      <ListingAgentsEditor
        agents={agents}
        agencyAgents={agencyAgents}
        onChange={onAgentsChange}
        description={
          source?.activeListingId
            ? `Imported from the active listing${source.agencyName ? ` with ${source.agencyName}` : ""}, including available agent photos. Review the contacts, or choose your own team.`
            : source?.source === "url"
              ? "Review any contacts imported from the listing URL, or choose up to two agents from your own team."
              : "Optional. Choose up to two agents from your team or enter their details. Historical listing agents are not assigned automatically."
        }
      />
    </div>
  );
}
