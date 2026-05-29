import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Agency, AgencyRole, CollateralItem, Listing, Report } from "@/lib/types";

// Deduped per server render so multiple requireUser/requireAgency calls in a
// single request share one Supabase Auth round-trip instead of re-validating.
const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
});

export async function requireUser() {
  const { supabase, user } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export const getAgencyMembership = cache(async (userId: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agency_members")
    .select("role, agency:agencies(*)")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.agency) {
    return null;
  }

  const agency = Array.isArray(data.agency) ? data.agency[0] : data.agency;

  if (!agency) {
    return null;
  }

  return {
    role: data.role as AgencyRole,
    agency: agency as Agency,
  };
});

export async function requireAgency() {
  const { supabase, user } = await requireUser();
  const membership = await getAgencyMembership(user.id);

  if (!membership) {
    redirect("/onboarding");
  }

  return { supabase, user, ...membership };
}

export async function requireAgencyAdmin() {
  const context = await requireAgency();

  if (!["owner", "admin"].includes(context.role)) {
    throw new Error("Admin access required");
  }

  return context;
}

export async function requireListingAccess(listingId: string) {
  const context = await requireAgency();
  const { data: listing, error } = await context.supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("agency_id", context.agency.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!listing) {
    throw new Error("Listing not found");
  }

  return { ...context, listing: listing as Listing };
}

export async function requireReportAccess(reportId: string) {
  const context = await requireAgency();
  const { data: report, error } = await context.supabase
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .eq("agency_id", context.agency.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!report) {
    throw new Error("Report not found");
  }

  return { ...context, report: report as Report };
}

export async function requireCollateralAccess(collateralId: string) {
  const context = await requireAgency();
  const { data: collateral, error } = await context.supabase
    .from("collateral_items")
    .select("*")
    .eq("id", collateralId)
    .eq("agency_id", context.agency.id)
    .neq("status", "archived")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!collateral) {
    throw new Error("Collateral not found");
  }

  if (!collateral.listing_id) {
    return {
      ...context,
      collateral: collateral as CollateralItem,
      listing: null,
    };
  }

  const { data: listing, error: listingError } = await context.supabase
    .from("listings")
    .select("*")
    .eq("id", collateral.listing_id)
    .eq("agency_id", context.agency.id)
    .maybeSingle();

  if (listingError) {
    throw new Error(listingError.message);
  }

  if (!listing) {
    throw new Error("Listing not found");
  }

  return {
    ...context,
    collateral: collateral as CollateralItem,
    listing: listing as Listing,
  };
}

export async function requireReportWithListing(reportId: string) {
  const { report, ...context } = await requireReportAccess(reportId);
  const { data: listing, error } = await context.supabase
    .from("listings")
    .select("*")
    .eq("id", report.listing_id)
    .eq("agency_id", context.agency.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!listing) {
    throw new Error("Listing not found");
  }

  return { ...context, report, listing: listing as Listing };
}

export async function requireListingReportAccess(
  listingId: string,
  reportId: string,
) {
  const context = await requireListingAccess(listingId);
  const { data: report, error } = await context.supabase
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .eq("listing_id", listingId)
    .eq("agency_id", context.agency.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!report) {
    throw new Error("Report not found");
  }

  return { ...context, report: report as Report };
}
