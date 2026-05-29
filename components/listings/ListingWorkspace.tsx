"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Bath,
  BedDouble,
  Car,
  Check,
  ExternalLink,
  BookOpen,
  Eye,
  FileText,
  Globe,
  IdCard,
  Link2,
  Loader2,
  PieChart,
  RefreshCw,
  ScrollText,
  Share2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/reports/StatusBadge";
import { CopyLinkButton } from "@/components/reports/CopyLinkButton";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";
import { ScrapedListingReviewStep } from "@/components/reports/ScrapedListingReviewStep";
import { CreateStrReportButton } from "@/components/listings/CreateStrReportButton";
import { ListingAgentsStrip } from "@/components/listings/ListingAgentsStrip";
import { CollateralPdfButton } from "@/components/collateral/CollateralPdfButton";
import { CollateralImageEditor } from "@/components/listings/CollateralImageEditor";
import { CollateralPhotoRequirementNotice } from "@/components/listings/CollateralPhotoRequirementNotice";
import { LandingTemplatePreviewModal } from "@/components/listings/LandingTemplatePreviewModal";
import { LeadStatusControl } from "@/components/leads/LeadStatusControl";
import { resolveCollateralImageSelection } from "@/lib/listings/collateralImages";
import { resolveEffectiveListingPageUrl } from "@/lib/listings/listingUrls";
import { getCollateralPhotoRequirement } from "@/lib/listings/collateralPhotoRequirements";
import {
  COLLATERAL_TYPE_META,
  collateralOrderForPurpose,
} from "@/lib/listings/collateralTypes";
import { formatCurrency } from "@/lib/reports/formatters";
import type {
  CollateralItem,
  CollateralType,
  Lead,
  LeadStatus,
  Listing,
  ListingStats,
  Report,
} from "@/lib/types";

const COLLATERAL_ICONS: Record<CollateralType, typeof FileText> = {
  str_report: FileText,
  sales_brochure: ScrollText,
  rental_brochure: BookOpen,
  social_posts: Share2,
  investor_snapshot: PieChart,
  agent_business_card: IdCard,
};

type Props = {
  agencySlug: string;
  listing: Listing;
  collateral: CollateralItem[];
  leads: Lead[];
  reports: Report[];
  stats: ListingStats;
};

function MetricsStrip({ stats }: { stats: ListingStats }) {
  const conversionPct =
    stats.total_views > 0
      ? ((stats.total_leads / stats.total_views) * 100).toFixed(1)
      : null;

  const tiles = [
    {
      icon: Eye,
      label: "Total views",
      value: stats.total_views.toLocaleString(),
    },
    {
      icon: TrendingUp,
      label: "Views (30d)",
      value: stats.views_last_30d.toLocaleString(),
    },
    {
      icon: Users,
      label: "Leads",
      value: stats.total_leads.toLocaleString(),
    },
    {
      icon: PieChart,
      label: "Conversion",
      value: conversionPct != null ? `${conversionPct}%` : "—",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="surface-card flex flex-col gap-1 px-4 py-3"
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </div>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ListingSummary({ listing }: { listing: Listing }) {
  const landingImages = resolveCollateralImageSelection(listing, "landing");
  const summaryImage =
    landingImages.hero_image_url ??
    listing.hero_image_url ??
    landingImages.selected_image_urls[0] ??
    null;
  const suburb = [listing.suburb, listing.state, listing.postcode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex items-center gap-5 rounded-2xl bg-background/70 p-4 shadow-sm ring-1 ring-border/60">
      {summaryImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={summaryImage}
          alt={listing.property_address ?? "Listing"}
          className="h-28 w-36 shrink-0 rounded-xl object-cover shadow-sm"
        />
      ) : (
        <div className="flex h-28 w-36 shrink-0 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground shadow-sm">
          No image
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h2 className="font-display text-xl font-semibold leading-snug tracking-tight">
            {listing.property_address ?? "Untitled listing"}
          </h2>
          {suburb ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{suburb}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          {listing.bedrooms != null ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <BedDouble className="h-4 w-4 shrink-0" />
              {listing.bedrooms}
            </span>
          ) : null}
          {listing.bathrooms != null ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Bath className="h-4 w-4 shrink-0" />
              {listing.bathrooms}
            </span>
          ) : null}
          {listing.car_spaces != null ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Car className="h-4 w-4 shrink-0" />
              {listing.car_spaces}
            </span>
          ) : null}
          {listing.display_price ? (
            <span className="font-semibold text-foreground">
              {listing.display_price}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LandingPageCard({
  listing,
  agencySlug,
}: {
  listing: Listing;
  agencySlug: string;
}) {
  const router = useRouter();
  const [customUrl, setCustomUrl] = useState(listing.custom_landing_url ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regeneratingQr, setRegeneratingQr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function regenerateQr() {
    setRegeneratingQr(true);
    try {
      const res = await fetch(`/api/listings/${listing.id}/regenerate-qr`, { method: "POST" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to regenerate QR code");
      toast.success("QR code updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate QR code");
    } finally {
      setRegeneratingQr(false);
    }
  }

  // The URL used for Copy Link and View buttons (canonical when DB has localhost)
  const effectiveUrl = resolveEffectiveListingPageUrl(agencySlug, listing);

  function startEditing() {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEditing() {
    setCustomUrl(listing.custom_landing_url ?? "");
    setEditing(false);
  }

  async function saveCustomUrl() {
    setSaving(true);
    try {
      const value = customUrl.trim() || null;
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_landing_url: value }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Unable to save");
      toast.success(value ? "Custom URL saved" : "Custom URL removed — using StayPacks URL");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface-card p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Globe className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Listing landing page</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Public page with property summary and lead capture form. Report QR
            codes link here.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {listing.landing_qr_code_url ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.landing_qr_code_url}
              alt="Landing page QR code"
              className="h-16 w-16 shrink-0 rounded-md border border-border/70 bg-white p-1"
            />
            <p className="text-xs text-muted-foreground">
              Scans are tracked, then visitors are sent to your{" "}
              {listing.custom_landing_url ? "custom" : "StayPacks"} listing page.
            </p>
          </div>
        ) : null}

        <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto">
          <CopyLinkButton url={effectiveUrl} />
          {effectiveUrl ? (
            <Link href={effectiveUrl} target="_blank">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4" />
                View public page
              </Button>
            </Link>
          ) : null}
          {listing.public_slug && !listing.custom_landing_url ? (
            <LandingTemplatePreviewModal
              listingId={listing.id}
              agencySlug={agencySlug}
              listingSlug={listing.public_slug}
              savedTemplate={listing.landing_template}
            />
          ) : null}
          {listing.landing_qr_code_url ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={regenerateQr}
              disabled={regeneratingQr}
            >
              {regeneratingQr ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate QR
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── Custom URL override ───────────────────────────────────────── */}
      <div className="mt-6 border-t border-border/60 pt-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Custom listing URL</p>
            <p className="text-xs text-muted-foreground">
              Send visitors to your own listing page. QR codes still track scans
              through StayPacks, then redirect here.
            </p>
          </div>
          {!editing && (
            <Button variant="ghost" size="sm" onClick={startEditing}>
              <Link2 className="h-3.5 w-3.5" />
              {listing.custom_landing_url ? "Edit" : "Set URL"}
            </Button>
          )}
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://youragency.com.au/listings/123"
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCustomUrl();
                if (e.key === "Escape") cancelEditing();
              }}
            />
            <Button size="sm" onClick={saveCustomUrl} disabled={saving}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : listing.custom_landing_url ? (
          <p className="truncate text-sm text-muted-foreground">
            {listing.custom_landing_url}
          </p>
        ) : (
          <p className="text-xs italic text-muted-foreground/60">
            Not set — using StayPacks hosted page.
          </p>
        )}

        {listing.custom_landing_url && !editing ? (
          <button
            type="button"
            onClick={() => {
              setCustomUrl("");
              setEditing(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="mt-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Remove custom URL
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CreateCollateralDraftButton({
  listingId,
  type,
  photoRequirement,
  onCreated,
}: {
  listingId: string;
  type: CollateralType;
  photoRequirement: ReturnType<typeof getCollateralPhotoRequirement>;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function createDraft() {
    if (!photoRequirement.met) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/listings/${listingId}/collateral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create collateral");
      }

      toast.success(`${COLLATERAL_TYPE_META[type].label} draft created`);
      setLoading(false);
      onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create collateral",
      );
      setLoading(false);
    }
  }

  if (!photoRequirement.met) {
    return null;
  }

  return (
    <Button onClick={createDraft} disabled={loading} size="sm">
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          Creating...
        </>
      ) : (
        "Create"
      )}
    </Button>
  );
}

function CollateralTab({
  agencySlug,
  listing,
  collateral,
  reports,
  photoRequirement,
  onGoToPhotos,
  onRefresh,
}: {
  agencySlug: string;
  listing: Listing;
  collateral: CollateralItem[];
  reports: Report[];
  photoRequirement: ReturnType<typeof getCollateralPhotoRequirement>;
  onGoToPhotos: () => void;
  onRefresh: () => void;
}) {
  const reportsById = new Map(reports.map((report) => [report.id, report]));
  const collateralByType = new Map(collateral.map((item) => [item.type, item]));

  return (
    <div className="space-y-6">
      <CollateralPhotoRequirementNotice
        requirement={photoRequirement}
        onGoToPhotos={onGoToPhotos}
      />

      <LandingPageCard listing={listing} agencySlug={agencySlug} />

      <div className="grid gap-4 md:grid-cols-2">
        {collateralOrderForPurpose(listing.listing_purpose).map((type) => {
          const meta = COLLATERAL_TYPE_META[type];
          const item = collateralByType.get(type);
          const Icon = COLLATERAL_ICONS[type];
          const strReport =
            type === "str_report" && item?.report_id
              ? reportsById.get(item.report_id) ?? null
              : type === "str_report"
                ? reports.find((report) => report.status !== "archived") ?? null
                : null;
          const hasCollateral =
            type === "str_report" ? Boolean(strReport) : Boolean(item);
          const photosRemaining = Math.max(
            photoRequirement.minimum - photoRequirement.count,
            1,
          );

          return (
            <div key={type} className="surface-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{meta.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                </div>
                {strReport ? (
                  <StatusBadge status={strReport.status} />
                ) : item ? (
                  <Badge variant="secondary">{item.status}</Badge>
                ) : null}
              </div>

              {meta.comingSoon ? (
                <p className="mt-3">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Coming soon
                  </span>
                </p>
              ) : null}

              {type === "agent_business_card" && item?.document_json ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Branded card with agent details and a QR code to the listing
                  landing page.
                </p>
              ) : null}

              {type === "social_posts" && item?.document_json ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Branded graphics for Instagram, Facebook and LinkedIn with your
                  logo and property address.
                </p>
              ) : null}

              {type === "sales_brochure" && item?.document_json ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Print-ready A4 brochure with property photos, copy and a QR code
                  to your listing page.
                </p>
              ) : null}
              {type === "sales_brochure" && !item?.document_json ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {meta.description}
                </p>
              ) : null}

              {strReport?.final_estimate_json?.annualRevenue != null ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Estimated annual STR revenue:{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(strReport.final_estimate_json.annualRevenue)}
                  </span>
                </p>
              ) : null}

              {!meta.comingSoon ? (
                !photoRequirement.met && !hasCollateral ? (
                <div className="mt-6">
                  <p className="text-sm text-muted-foreground">
                    Add {photosRemaining} more photo
                    {photosRemaining === 1 ? "" : "s"} to use this feature.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={onGoToPhotos}
                  >
                    Add photos
                  </Button>
                </div>
                ) : (
                <div className="mt-6 flex flex-wrap gap-2">
                {type === "str_report" ? (
                  strReport ? (
                    <>
                      <Link href={`/listings/${listing.id}/reports/${strReport.id}`}>
                        <Button size="sm">Edit</Button>
                      </Link>
                      {strReport.pdf_url ? (
                        <DownloadPdfButton
                          url={strReport.pdf_url}
                          reportId={strReport.id}
                          cacheVersion={strReport.updated_at}
                          canGenerate={false}
                          downloadLabel="Download asset"
                        />
                      ) : null}
                    </>
                  ) : (
                    <CreateStrReportButton
                      listingId={listing.id}
                      photoRequirement={photoRequirement}
                    />
                  )
                ) : type === "sales_brochure" ? (
                  item ? (
                    <>
                      <Link href={`/listings/${listing.id}/brochure`}>
                        <Button size="sm">Edit</Button>
                      </Link>
                      {item.pdf_url ? (
                        <CollateralPdfButton
                          collateralId={item.id}
                          url={item.pdf_url}
                          canGenerate={false}
                          cacheVersion={item.updated_at}
                          downloadLabel="Download asset"
                        />
                      ) : null}
                    </>
                  ) : (
                    <CreateCollateralDraftButton
                      listingId={listing.id}
                      type={type}
                      photoRequirement={photoRequirement}
                      onCreated={onRefresh}
                    />
                  )
                ) : type === "social_posts" ? (
                  item ? (
                    <>
                      <Link href={`/listings/${listing.id}/social`}>
                        <Button size="sm">Edit</Button>
                      </Link>
                      {item.pdf_url ? (
                        <CollateralPdfButton
                          collateralId={item.id}
                          url={item.pdf_url}
                          canGenerate={false}
                          cacheVersion={item.updated_at}
                          downloadLabel="Download asset"
                        />
                      ) : null}
                    </>
                  ) : (
                    <CreateCollateralDraftButton
                      listingId={listing.id}
                      type={type}
                      photoRequirement={photoRequirement}
                      onCreated={onRefresh}
                    />
                  )
                ) : item ? (
                  <Badge variant="outline">Draft saved</Badge>
                ) : (
                  <CreateCollateralDraftButton
                    listingId={listing.id}
                    type={type}
                    photoRequirement={photoRequirement}
                    onCreated={onRefresh}
                  />
                )}
                </div>
                )
              ) : null}

              {type === "str_report" ? (
                <div className="mt-4 flex justify-end">
                  <div className="flex items-center gap-1.5 opacity-40">
                    <span className="text-[10px] text-muted-foreground">Powered by</span>
                    <img src="/airbtics-logo.png" alt="Airbtics" className="h-3.5 w-auto" />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeadsTab({
  listingId,
  leads: initialLeads,
}: {
  listingId: string;
  leads: Lead[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function updateStatus(lead: Lead, nextStatus: LeadStatus) {
    const previousStatus = lead.status;
    setUpdatingId(lead.id);
    setLeads((current) =>
      current.map((item) =>
        item.id === lead.id ? { ...item, status: nextStatus } : item,
      ),
    );

    try {
      const response = await fetch(
        `/api/listings/${listingId}/leads/${lead.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update lead");
      }

      setLeads((current) =>
        current.map((item) =>
          item.id === lead.id ? (payload.lead as Lead) : item,
        ),
      );
    } catch (error) {
      setLeads((current) =>
        current.map((item) =>
          item.id === lead.id ? { ...item, status: previousStatus } : item,
        ),
      );
      toast.error(
        error instanceof Error ? error.message : "Unable to update lead",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (leads.length === 0) {
    return (
      <div className="surface-card p-8 text-center">
        <p className="font-medium">No leads yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Enquiries from the public landing page will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Received</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-border/40 last:border-0">
              <td className="px-4 py-3 font-medium">{lead.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {lead.email ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {lead.phone ?? "—"}
              </td>
              <td className="px-4 py-3">
                <LeadStatusControl
                  status={lead.status}
                  updating={updatingId === lead.id}
                  onChange={(status) => updateStatus(lead, status)}
                  size="sm"
                />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {format(new Date(lead.created_at), "dd MMM yyyy")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab({
  listing,
  onListingUpdated,
}: {
  listing: Listing;
  onListingUpdated: (listing: Listing) => void;
}) {
  return (
    <div className="surface-card p-6">
      <ScrapedListingReviewStep
        listing={listing}
        listingSetup
        onSaved={({ listing: savedListing }) => {
          onListingUpdated(savedListing);
        }}
      />
    </div>
  );
}

export function ListingWorkspace({
  agencySlug,
  listing: initialListing,
  collateral: initialCollateral,
  leads: initialLeads,
  reports: initialReports,
  stats,
}: Props) {
  const router = useRouter();
  const [listing, setListing] = useState(initialListing);
  const [activeTab, setActiveTab] = useState("collateral");
  const photoRequirement = getCollateralPhotoRequirement(listing);

  function refreshWorkspace() {
    router.refresh();
  }

  function handleListingUpdated(nextListing: Listing) {
    setListing(nextListing);
  }

  return (
    <div className="space-y-6">
      <MetricsStrip stats={stats} />

      <div className="space-y-3">
        <ListingSummary listing={listing} />
        <ListingAgentsStrip listing={listing} onUpdated={handleListingUpdated} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="collateral">Collateral</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="collateral" className="mt-6">
          <CollateralTab
            agencySlug={agencySlug}
            listing={listing}
            collateral={initialCollateral}
            reports={initialReports}
            photoRequirement={photoRequirement}
            onGoToPhotos={() => setActiveTab("photos")}
            onRefresh={refreshWorkspace}
          />
        </TabsContent>

        <TabsContent value="photos" className="mt-6">
          <div className="surface-card p-6">
            <CollateralImageEditor
              listing={listing}
              onUpdated={handleListingUpdated}
            />
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-6">
          <LeadsTab listingId={listing.id} leads={initialLeads} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <SettingsTab listing={listing} onListingUpdated={setListing} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
