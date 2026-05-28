import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SocialPostsEditor } from "@/components/collateral/social/SocialPostsEditor";
import { Button } from "@/components/ui/button";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { generateCollateralDocument } from "@/lib/collateral/generateCollateralDocument";
import { isSocialPostsDocument } from "@/lib/collateral/templates/types";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import type { CollateralItem } from "@/lib/types";

export default async function ListingSocialPostsPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;

  let agency;
  let listing;
  let supabase;

  try {
    ({ agency, listing, supabase } = await requireListingAccess(listingId));
  } catch {
    notFound();
  }

  const photoError = collateralPhotoRequirementError(listing);
  if (photoError) {
    redirect(`/listings/${listingId}`);
  }

  let { data: collateral } = await supabase
    .from("collateral_items")
    .select("*")
    .eq("listing_id", listing.id)
    .eq("type", "social_posts")
    .neq("status", "archived")
    .maybeSingle();

  if (!collateral) {
    const { data: created, error } = await supabase
      .from("collateral_items")
      .insert({
        listing_id: listing.id,
        agency_id: agency.id,
        type: "social_posts",
        status: "draft",
      })
      .select("*")
      .single();

    if (error || !created) {
      notFound();
    }

    collateral = created;
  }

  let item = collateral as CollateralItem;

  if (!item.document_json) {
    const { data: agencyAgents } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("agency_id", agency.id);

    const agentProfile =
      listing.agent_profile_id != null
        ? agencyAgents?.find((agent) => agent.id === listing.agent_profile_id) ??
          null
        : null;

    const documentJson = await generateCollateralDocument({
      agency,
      listing,
      collateral: item,
      supabase,
      agentProfile,
      agencyAgents: agencyAgents ?? [],
    });

    const templateId = resolveCollateralTemplateId(agency, item);
    const generatedAt = new Date().toISOString();

    const { data: generated } = await supabase
      .from("collateral_items")
      .update({
        document_json: documentJson,
        template_id: templateId,
        status: "generated",
        generated_at: generatedAt,
      })
      .eq("id", item.id)
      .select("*")
      .single();

    if (!generated) {
      notFound();
    }

    item = generated as CollateralItem;
  }

  const document = item.document_json;

  if (!document || !isSocialPostsDocument(document)) {
    notFound();
  }

  return (
    <SocialPostsEditor
      listing={listing}
      agency={agency}
      collateral={item}
    />
  );
}
