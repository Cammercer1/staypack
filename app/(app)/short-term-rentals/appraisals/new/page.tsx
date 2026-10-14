import { notFound } from "next/navigation";
import { z } from "zod";
import { NewStrAppraisalFlow } from "@/components/str-appraisals/NewStrAppraisalFlow";
import { requireStrWorkspaceAccess } from "@/lib/str-appraisals/service";
import type { Listing } from "@/lib/types";

export default async function NewStrAppraisalPage({ searchParams }: { searchParams: Promise<{ listing_id?: string }> }) {
  const { supabase,agency,user } = await requireStrWorkspaceAccess();
  const { listing_id } = await searchParams;
  let listing: Listing | null = null;
  if (listing_id) {
    if (!z.string().uuid().safeParse(listing_id).success) notFound();
    const { data,error } = await supabase.from("listings").select("*").eq("id",listing_id).eq("agency_id",agency.id).neq("status","archived").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) notFound();
    listing = data as Listing;
  }
  return <NewStrAppraisalFlow initialListing={listing} storageKey={`property-import:${agency.id}:${user.id}`} />;
}
