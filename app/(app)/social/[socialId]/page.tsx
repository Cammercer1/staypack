import { notFound, unstable_rethrow } from "next/navigation";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { SocialPostsEditor } from "@/components/collateral/social/SocialPostsEditor";
import { NewSocialFlow } from "@/components/social/NewSocialFlow";
import { isSocialPostsDocument } from "@/lib/collateral/templates/types";
export default async function SocialPage({ params }: { params: Promise<{ socialId: string }> }) {
  const { socialId } = await params;
  const { agency, user, listing, collateral } = await requireCollateralAccess(socialId).catch(error => { unstable_rethrow(error); if (error instanceof Error && ["Collateral not found", "Listing not found"].includes(error.message)) notFound(); throw error; });
  if (!listing || collateral.type !== "social_posts") notFound();
  if (!collateral.document_json) return <NewSocialFlow initialListing={listing} storageKey={`property-import:${agency.id}:${user.id}`} />;
  if (!isSocialPostsDocument(collateral.document_json)) throw new Error("This social design could not be read. Your saved design has been preserved.");
  return <SocialPostsEditor listing={listing} agency={agency} collateral={collateral} />;
}
