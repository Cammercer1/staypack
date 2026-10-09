"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Car,
  FileText,
  Plus,
  ArrowUpRight,
  Images,
  SlidersHorizontal,
  FolderOpen,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";
import { CollateralPdfButton } from "@/components/collateral/CollateralPdfButton";
import { CopyLinkButton } from "@/components/reports/CopyLinkButton";
import { ListingAgentsStrip } from "./ListingAgentsStrip";
import { ListingThumbnail } from "./ListingThumbnail";
import { CollateralImageEditor } from "./CollateralImageEditor";
import { PropertyDetailsForm } from "./PropertyDetailsForm";
import { UnsavedListingGuard } from "./UnsavedListingGuard";
import { CreateLeaseAppraisalButton } from "./CreateLeaseAppraisalButton";
import { CreateSalesAppraisalButton } from "./CreateSalesAppraisalButton";
import { CreateStrReportButton } from "./CreateStrReportButton";
import { getCollateralPhotoRequirement } from "@/lib/listings/collateralPhotoRequirements";
import {
  COLLATERAL_TYPE_META,
  collateralEditorPath,
  collateralOrderForPurpose,
} from "@/lib/listings/collateralTypes";
import { listingDocuments } from "@/lib/listings/documents";
import { toast } from "sonner";
import type {
  Listing,
  Report,
  CollateralItem,
  CollateralType,
  Lead,
  ListingStats,
} from "@/lib/types";

type Props = {
  listing: Listing;
  reports: Report[];
  collateral: CollateralItem[];
  agencySlug: string;
  leads: Lead[];
  stats: ListingStats;
};
const descriptions: Partial<Record<CollateralType, string>> = {
  sales_appraisal: "Present an estimated sale price and comparable sales.",
  lease_appraisal: "Compare long-term rental potential and local evidence.",
  str_report: "Explore estimated gross short-term rental revenue.",
  sales_brochure: "Create a property brochure for prospective buyers.",
  rental_brochure: "Create a property brochure for prospective tenants.",
  social_posts: "Prepare branded posts for social media.",
};
function CreateMarketingDocument({
  listingId,
  type,
}: {
  listingId: string;
  type: CollateralType;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try {
      const response = await fetch(`/api/listings/${listingId}/collateral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Unable to create collateral");
      const href = collateralEditorPath(listingId, type);
      if (href) {
        router.push(href);
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create collateral",
      );
      setBusy(false);
    }
  }
  return (
    <Button size="sm" disabled={busy} onClick={create}>
      {busy ? "Creating…" : "Create"}
    </Button>
  );
}
export function ListingWorkspace({
  listing: initialListing,
  reports,
  collateral,
}: Props) {
  const [listing, setListing] = useState(initialListing);
  const [tab, setTab] = useState("documents");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [photosDirty, setPhotosDirty] = useState(false);
  const documents = listingDocuments(listing, reports, collateral);
  const requirement = getCollateralPhotoRequirement(listing);
  const address = listing.property_address || "Untitled property";
  return (
    <div
      data-theme="staypack-workspace"
      className="space-y-7 text-base-content"
    >
      <UnsavedListingGuard dirty={detailsDirty || photosDirty} />
      <Link
        href="/listings"
        className="inline-flex items-center gap-2 text-sm text-base-content/65 hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        Listings
      </Link>
      <header className="space-y-5">
        <div className="flex items-center gap-5">
          <ListingThumbnail
            src={
              listing.hero_image_url || listing.selected_image_urls?.[0] || null
            }
            address={address}
            eager
            className="size-20 sm:h-28 sm:w-36"
          />
          <div className="min-w-0 space-y-2">
            <h1 className="font-display text-2xl leading-tight sm:text-3xl">
              {address}
            </h1>
            <p className="text-sm text-base-content/65">
              {[listing.state, listing.postcode].filter(Boolean).join(" ")}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {listing.bedrooms != null && (
                <span className="flex items-center gap-1.5">
                  <BedDouble className="size-4" />
                  {listing.bedrooms}
                  <span className="sr-only">bedrooms</span>
                </span>
              )}
              {listing.bathrooms != null && (
                <span className="flex items-center gap-1.5">
                  <Bath className="size-4" />
                  {listing.bathrooms}
                  <span className="sr-only">bathrooms</span>
                </span>
              )}
              {listing.car_spaces != null && (
                <span className="flex items-center gap-1.5">
                  <Car className="size-4" />
                  {listing.car_spaces}
                  <span className="sr-only">car spaces</span>
                </span>
              )}
              {listing.display_price && (
                <span className="font-medium">{listing.display_price}</span>
              )}
            </div>
          </div>
        </div>
        <ListingAgentsStrip listing={listing} onUpdated={setListing} />
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          variant="line"
          className="w-full justify-start gap-3 border-b border-base-300 pb-3 sm:gap-6"
        >
          <TabsTrigger
            value="documents"
            className="min-h-10 flex-none gap-2 px-1"
          >
            <FileText />
            Collateral{" "}
            <span className="text-xs text-base-content/50">
              {documents.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="photos" className="min-h-10 flex-none gap-2 px-1">
            <Images />
            Photos
            {photosDirty && <span aria-label="Unsaved photo changes">•</span>}
          </TabsTrigger>
          <TabsTrigger
            value="details"
            className="min-h-10 flex-none gap-2 px-1"
          >
            <SlidersHorizontal className="hidden sm:block" />
            Property details
            {detailsDirty && (
              <span aria-label="Unsaved property changes">•</span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="documents" className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl">Your collateral</h2>
              <p className="mt-1 text-sm text-base-content/65">
                Reports and marketing material for this property.
              </p>
            </div>
            <button
              className="du-btn du-btn-sm du-btn-primary min-h-10"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Create collateral
            </button>
          </div>
          {detailsDirty || photosDirty ? (
            <p
              role="status"
              className="rounded-xl bg-warning/35 px-4 py-3 text-sm text-warning-content"
            >
              You have unsaved changes. Save them before opening or creating
              collateral.
            </p>
          ) : null}
          {documents.length ? (
            <ul className="du-list divide-y divide-base-300 overflow-hidden rounded-2xl border border-base-300 bg-base-100">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center gap-4 p-5 sm:p-6"
                >
                  <div
                    className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-200/55"
                    aria-hidden="true"
                  >
                    <FileText className="size-6 text-primary/65" />
                  </div>
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{doc.name}</h3>
                      <span
                        className={
                          doc.status === "Needs updating" ||
                          doc.status === "Needs attention"
                            ? "du-badge du-badge-sm du-badge-warning"
                            : "du-badge du-badge-sm du-badge-ghost"
                        }
                      >
                        {doc.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-base-content/60">
                      Updated{" "}
                      {new Date(doc.updatedAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    {doc.status === "Needs updating" && (
                      <p className="mt-1 text-xs text-warning-content">
                        Property details changed. Review the appraisal evidence.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:pl-18">
                    <Link
                      href={doc.href}
                      className="du-btn du-btn-sm du-btn-outline min-h-10"
                      aria-label={`Open ${doc.name}`}
                    >
                      Open
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                    {doc.report?.pdf_url && (
                      <DownloadPdfButton
                        reportId={doc.id}
                        url={doc.report.pdf_url}
                        cacheVersion={doc.updatedAt}
                        canGenerate={false}
                        downloadLabel="Download PDF"
                      />
                    )}
                    {doc.collateral?.pdf_url && (
                      <CollateralPdfButton
                        collateralId={doc.id}
                        url={doc.collateral.pdf_url}
                        cacheVersion={doc.updatedAt}
                        canGenerate={false}
                        downloadLabel="Download PDF"
                      />
                    )}
                    {doc.publicUrl && <CopyLinkButton url={doc.publicUrl} />}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 px-6 py-14 text-center">
              <FolderOpen className="mx-auto mb-4 size-8 text-primary/60" />
              <h3 className="font-display text-xl">Create your first collateral</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-base-content/65">
                Create a sales, rental or short-term rental appraisal, or
                prepare a brochure or social media post. They all stay together here.
              </p>
            </div>
          )}
        </TabsContent>
        <TabsContent
          value="photos"
          keepMounted
          hidden={tab !== "photos"}
          className="mt-5"
        >
          <CollateralImageEditor
            listing={listing}
            onUpdated={setListing}
            onDirtyChange={setPhotosDirty}
          />
        </TabsContent>
        <TabsContent
          value="details"
          keepMounted
          hidden={tab !== "details"}
          className="mt-5"
        >
          <PropertyDetailsForm
            listing={listing}
            onSaved={setListing}
            onDirtyChange={setDetailsDirty}
          />
        </TabsContent>
      </Tabs>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className="max-h-[85dvh] overflow-y-auto sm:max-w-xl"
          data-theme="staypack-workspace"
        >
          <DialogHeader>
            <DialogTitle>Create collateral</DialogTitle>
            <DialogDescription>
              Explore every option for this property. Existing collateral remains
              available in your library.
            </DialogDescription>
          </DialogHeader>
          {detailsDirty || photosDirty ? (
            <p role="alert" className="text-sm">
              Save your property and photo changes first.
            </p>
          ) : !requirement.met ? (
            <div className="space-y-3">
              <p>
                Add {requirement.minimum - requirement.count} more photos to
                create collateral.
              </p>
              <Button
                onClick={() => {
                  setCreateOpen(false);
                  setTab("photos");
                }}
              >
                Add photos
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-base-300">
              {collateralOrderForPurpose(listing.listing_purpose)
                .filter((type) => !COLLATERAL_TYPE_META[type].comingSoon)
                .map((type) => {
                  const existing = documents.find((doc) => doc.type === type);
                  return (
                    <li key={type} className="flex items-center gap-4 py-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium">
                          {COLLATERAL_TYPE_META[type].label}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-base-content/65">
                          {descriptions[type]}
                        </p>
                      </div>
                      {existing ? (
                        <Link
                          className="du-btn du-btn-sm du-btn-outline min-h-10"
                          href={existing.href}
                        >
                          Open existing
                        </Link>
                      ) : type === "sales_appraisal" ? (
                        <CreateSalesAppraisalButton
                          listingId={listing.id}
                          photoRequirement={requirement}
                          label="Create"
                        />
                      ) : type === "lease_appraisal" ? (
                        <CreateLeaseAppraisalButton
                          listingId={listing.id}
                          photoRequirement={requirement}
                          label="Create"
                        />
                      ) : type === "str_report" ? (
                        <CreateStrReportButton
                          listingId={listing.id}
                          photoRequirement={requirement}
                          label="Create"
                        />
                      ) : (
                        <CreateMarketingDocument
                          listingId={listing.id}
                          type={type}
                        />
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
