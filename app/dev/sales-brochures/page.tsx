import Link from "next/link";
import { notFound } from "next/navigation";
import { SalesBrochurePlayground } from "@/components/dev/SalesBrochurePlayground";
import { Button } from "@/components/ui/button";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { loadDevListingAccess } from "@/lib/dev/loadDevListingAccess";
import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import { resolvePlaygroundSalesBrochure } from "@/lib/collateral/sales-brochure/resolvePlaygroundSalesBrochure";
import type { Agency, CollateralItem, Listing } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadSalesBrochureListingAccess(listingId: string): Promise<{
  supabase: SupabaseClient;
  agency: Agency;
  listing: Listing;
} | null> {
  try {
    return await requireListingAccess(listingId);
  } catch {
    return loadDevListingAccess(listingId);
  }
}

export default async function DevSalesBrochuresPage({
  searchParams,
}: {
  searchParams: Promise<{ listingId?: string; collateralId?: string; templateId?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { listingId, collateralId, templateId } = await searchParams;

  if (listingId) {
    const access = await loadSalesBrochureListingAccess(listingId);

    if (!access) {
      return (
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-xl font-semibold">Listing not found</h1>
            <p className="text-sm text-muted-foreground">
              Check <code className="text-xs">listingId</code> or open the playground
              without params to use mock fixture data.
            </p>
            <Link href="/dev/sales-brochures">
              <Button variant="outline">Mock fixture preview</Button>
            </Link>
          </div>
        </div>
      );
    }

    const { supabase, agency, listing } = access;

      let collateral: CollateralItem | null = null;

      if (collateralId) {
        const { data } = await supabase
          .from("collateral_items")
          .select("*")
          .eq("id", collateralId)
          .eq("listing_id", listing.id)
          .maybeSingle();
        collateral = data as CollateralItem | null;
      } else {
        const { data } = await supabase
          .from("collateral_items")
          .select("*")
          .eq("listing_id", listing.id)
          .eq("type", "sales_brochure")
          .neq("status", "archived")
          .maybeSingle();
        collateral = data as CollateralItem | null;
      }

      const document = await resolvePlaygroundSalesBrochure({
        supabase,
        agency,
        listing,
        collateral,
      });

      if (templateId) {
        document.template_id = templateId;
      }

      return (
        <SalesBrochurePlayground
          baseDocument={document}
          agency={agency}
          listingId={listing.id}
          collateralId={collateral?.id ?? null}
        />
      );
  }

  const document = createPlaygroundSalesBrochureDocument(
    templateId ?? undefined,
  );

  return (
    <SalesBrochurePlayground
      baseDocument={document}
      agency={{
        id: "playground",
        name: document.agency.name,
        slug: "playground",
        slug_aliases: [],
        website_url: document.agency.website_url,
        email: document.agency.email,
        phone: document.agency.phone,
        logo_url: document.agency.logo_url,
        logo_light_url: document.agency.logo_light_url,
        logo_dark_url: document.agency.logo_dark_url,
        primary_colour: document.agency.primary_colour,
        secondary_colour: document.agency.secondary_colour,
        accent_colour: document.agency.accent_colour,
        text_colour: document.agency.text_colour,
        callout_heading_colour: document.agency.callout_heading_colour ?? null,
        callout_text_colour: document.agency.callout_text_colour ?? null,
        background_colour: document.agency.background_colour,
        heading_font_family: document.agency.heading_font_family,
        body_font_family: document.agency.body_font_family,
        font_family: document.agency.font_family,
        heading_font_file_url: null,
        body_font_file_url: null,
        font_file_url: null,
        default_report_title: "",
        default_cta: "",
        default_disclaimer: null,
        report_template_id: "",
        collateral_template_defaults: {},
        brand_advanced_json: null,
        created_at: "",
        updated_at: "",
      }}
    />
  );
}
