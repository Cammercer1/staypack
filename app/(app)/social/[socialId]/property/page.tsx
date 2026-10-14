import { notFound, unstable_rethrow } from "next/navigation";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { PropertyEditor } from "@/components/properties/PropertyEditor";
export default async function SocialPropertyPage({ params }: { params: Promise<{ socialId: string }> }) {
  const { socialId } = await params;
  const { listing, collateral } = await requireCollateralAccess(socialId).catch(error => { unstable_rethrow(error); if (error instanceof Error && ["Collateral not found", "Listing not found"].includes(error.message)) notFound(); throw error; });
  if (!listing || collateral.type !== "social_posts") notFound();
  return <PropertyEditor initialListing={listing} returnPath={`/social/${socialId}`} returnLabel="social editor" />;
}
