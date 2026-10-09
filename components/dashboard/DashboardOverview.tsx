import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CircleAlert,
  FileText,
  House,
  Palette,
  Plus,
} from "lucide-react";
import { WorkspaceHeader } from "@/components/app-shell/WorkspaceHeader";
import { ListingThumbnail } from "@/components/listings/ListingThumbnail";
import { resolveMasterPhotoSelection } from "@/lib/listings/collateralImages";
import type { Listing } from "@/lib/types";

export function DashboardOverview({
  agencyName,
  listings,
  listingCount,
  loadError,
}: {
  agencyName: string;
  listings: Listing[];
  listingCount: number | null;
  loadError: boolean;
}) {
  return (
    <div
      data-theme="staypack-workspace"
      className="space-y-8 text-base-content"
    >
      <WorkspaceHeader
        eyebrow={agencyName}
        title="Welcome back."
        description="Your properties, appraisals and marketing material. Pick up where you left off."
      />

      <div className="flex items-center gap-2 text-sm text-base-content/70">
        <Building2 className="size-4" aria-hidden="true" />
        {listingCount == null
          ? "Listing count unavailable"
          : `${listingCount} ${listingCount === 1 ? "listing" : "listings"} in your library`}
      </div>

      {loadError && (
        <div role="alert" className="du-alert du-alert-warning du-alert-soft">
          <CircleAlert className="size-5" aria-hidden="true" />
          <span>
            Some listing information could not be loaded. Please refresh to try
            again.
          </span>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section
          className="min-w-0 overflow-hidden rounded-2xl border border-base-300 bg-base-100"
          aria-labelledby="recent-listings-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 px-5 py-5 sm:px-6">
            <div>
              <h2 id="recent-listings-title" className="text-2xl">
                Recent listings
              </h2>
              <p className="mt-1 text-sm text-base-content/65">
                Continue working on your latest properties.
              </p>
            </div>
            <Link
              href="/listings"
              className="du-btn du-btn-ghost du-btn-sm min-h-11"
            >
              View all <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          {listings.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <House
                className="mx-auto mb-4 size-8 text-base-content/40"
                aria-hidden="true"
              />
              <h3 className="text-xl">
                {loadError
                  ? "Your listings are unavailable"
                  : "Make room for your first property"}
              </h3>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-base-content/65">
                {loadError
                  ? "Refresh the page to try loading your library again."
                  : "Add a listing to bring its appraisals, brochures and property page together."}
              </p>
              {!loadError && (
                <Link
                  href="/listings/new"
                  prefetch={false}
                  className="du-btn du-btn-primary mt-6 min-h-11"
                >
                  <Plus className="size-4" aria-hidden="true" /> Add a listing
                </Link>
              )}
            </div>
          ) : (
            <ul className="du-list">
              {listings.map((listing, index) => {
                const address = listing.property_address || "Untitled listing";
                return (
                  <li
                    key={listing.id}
                    className="du-list-row grid-cols-[auto_minmax(0,1fr)] items-start gap-4 p-5 sm:p-6"
                  >
                    <ListingThumbnail
                      src={resolveMasterPhotoSelection(listing).hero_image_url}
                      address={address}
                      eager={index === 0}
                    />
                    <div className="min-w-0">
                      <h3 className="font-sans text-sm font-semibold leading-6 sm:text-base">
                        <Link
                          href={`/listings/${listing.id}`}
                          className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                        >
                          {address}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-xs text-base-content/65">
                        {[listing.suburb, listing.state]
                          .filter(Boolean)
                          .join(", ") || "Location not added"}
                      </p>
                      <div className="mt-3 flex justify-end">
                        <Link
                          href={`/listings/${listing.id}`}
                          aria-label={`Open ${address}`}
                          className="du-btn du-btn-ghost du-btn-sm min-h-11"
                        >
                          Open listing{" "}
                          <ArrowUpRight className="size-4" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-5" aria-label="Workspace shortcuts">
          <div className="du-card bg-neutral text-neutral-content">
            <div className="du-card-body gap-4 p-6">
              <FileText className="size-7 opacity-70" aria-hidden="true" />
              <h2 className="du-card-title font-display text-2xl font-normal">
                One property.
                <br />
                Everything in place.
              </h2>
              <p className="text-sm leading-6 opacity-80">
                Start with a listing, then prepare appraisals, brochures and a
                branded property page from the same details.
              </p>
              <div className="du-card-actions mt-2">
                <Link
                  href="/listings/new"
                  prefetch={false}
                  className="du-btn du-btn-sm min-h-11 w-full"
                >
                  Create a listing{" "}
                  <Plus className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
          <Link
            href="/settings/brand"
            className="group flex items-start gap-3 rounded-xl border border-base-300 p-5 transition-colors hover:bg-base-100 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <Palette
              className="mt-0.5 size-5 shrink-0 text-base-content/60"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-sans text-sm font-semibold">
                Make it your own
              </h2>
              <p className="mt-1 text-xs leading-5 text-base-content/65">
                Manage your agency’s logo, colours and report branding.
              </p>
            </div>
            <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
