"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bath,
  BedDouble,
  CalendarDays,
  CarFront,
  House,
  MapPin,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { DeleteListingButton } from "@/components/listings/DeleteListingButton";
import { ListingThumbnail } from "@/components/listings/ListingThumbnail";
import { resolveMasterPhotoSelection } from "@/lib/listings/collateralImages";
import {
  filterListings,
  formatListingDate,
  listingAgentsLabel,
  type ListingSort,
} from "@/lib/listings/listingLibrary";
import type { Listing } from "@/lib/types";

export function ListingLibrary({ listings }: { listings: Listing[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListingSort>("newest");
  const visibleListings = useMemo(
    () => filterListings(listings, { query, sort }),
    [listings, query, sort],
  );
  const hasSearch = query.trim() !== "";

  function clearSearch() {
    setQuery("");
  }

  return (
    <section aria-label="Listing library" className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-base-300 bg-base-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row lg:flex-1">
          <label className="du-input min-h-11 w-full sm:flex-1 lg:max-w-sm">
            <Search className="size-4 shrink-0 opacity-60" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search listings"
              placeholder="Search address, suburb or agent"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0"
            />
          </label>
          <select
            aria-label="Sort listings"
            value={sort}
            onChange={(event) => setSort(event.target.value as ListingSort)}
            className="du-select min-h-11 w-full sm:w-40"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="address">Address A–Z</option>
          </select>
        </div>
      </div>

      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 px-1">
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-base-content/70"
        >
          <span className="font-semibold text-base-content">
            {visibleListings.length}
          </span>{" "}
          {visibleListings.length === 1 ? "listing" : "listings"}
          {hasSearch ? ` of ${listings.length}` : " in your library"}
        </p>
        {hasSearch && (
          <button
            type="button"
            onClick={clearSearch}
            className="du-btn du-btn-ghost du-btn-sm min-h-11"
          >
            <X className="size-3.5" aria-hidden="true" /> Clear search
          </button>
        )}
      </div>

      {visibleListings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 px-6 py-16 text-center">
          <House
            className="mx-auto mb-5 size-8 text-base-content/45"
            aria-hidden="true"
          />
          <h2 className="text-2xl">
            {listings.length
              ? "No matching properties"
              : "Your first listing starts here"}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-base-content/70">
            {listings.length
              ? "Try another address, suburb or agent, or clear your search to see every listing."
              : "Add a property to prepare appraisals, create brochures and share a branded property page."}
          </p>
          {listings.length ? (
            <button
              type="button"
              onClick={clearSearch}
              className="du-btn du-btn-sm mt-6 min-h-11"
            >
              Clear search
            </button>
          ) : (
            <Link
              href="/listings/new"
              prefetch={false}
              className="du-btn du-btn-primary mt-6 min-h-11"
            >
              <Plus className="size-4" aria-hidden="true" /> Create your first
              listing
            </Link>
          )}
        </div>
      ) : (
        <ul className="du-list overflow-hidden rounded-2xl border border-base-300 bg-base-100">
          {visibleListings.map((listing, index) => {
            const address = listing.property_address || "Untitled listing";
            const agents = listingAgentsLabel(listing);
            const location = [listing.suburb, listing.state, listing.postcode]
              .filter(Boolean)
              .join(" ");
            return (
              <li
                key={listing.id}
                className="du-list-row flex flex-col gap-5 p-5 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center lg:p-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <ListingThumbnail
                    src={resolveMasterPhotoSelection(listing).hero_image_url}
                    address={address}
                    eager={index === 0}
                    className="sm:h-24 sm:w-28"
                  />
                  <div className="min-w-0">
                    <h2 className="font-sans text-base font-semibold leading-snug">
                      <Link
                        href={`/listings/${listing.id}`}
                        className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                      >
                        {address}
                      </Link>
                    </h2>
                    <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-base-content/65">
                      <MapPin
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {location || "Location not added"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/70">
                      {listing.bedrooms != null && (
                        <span className="flex items-center gap-1.5">
                          <BedDouble className="size-3.5" aria-hidden="true" />
                          {listing.bedrooms}
                          <span className="sr-only"> bedrooms</span>
                        </span>
                      )}
                      {listing.bathrooms != null && (
                        <span className="flex items-center gap-1.5">
                          <Bath className="size-3.5" aria-hidden="true" />
                          {listing.bathrooms}
                          <span className="sr-only"> bathrooms</span>
                        </span>
                      )}
                      {listing.car_spaces != null && (
                        <span className="flex items-center gap-1.5">
                          <CarFront className="size-3.5" aria-hidden="true" />
                          {listing.car_spaces}
                          <span className="sr-only"> car spaces</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-xs text-base-content/70 md:col-start-1 xl:col-auto">
                  <p className="flex items-start gap-2">
                    <Users className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="break-words">
                      {agents || "No agents added"}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarDays
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    Added {formatListingDate(listing.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:col-start-2 md:row-span-2 md:row-start-1 xl:col-start-3 xl:row-span-1">
                  <Link
                    href={`/listings/${listing.id}`}
                    aria-label={`Open ${address}`}
                    className="du-btn du-btn-sm min-h-11"
                  >
                    Open listing{" "}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                  <DeleteListingButton
                    listingId={listing.id}
                    propertyAddress={listing.property_address}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
