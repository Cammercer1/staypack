import { requireAgency } from "@/lib/auth/requireUser";
import { NewListingFlow } from "@/components/listings/NewListingFlow";

export default async function NewListingPage() {
  await requireAgency();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-gradient text-3xl font-semibold">New listing</h1>
        <p className="text-muted-foreground">
          Import or enter property details, choose photos, and assign listing agents.
          Short-term rental appraisals and other marketing assets are created from the property page.
        </p>
      </div>
      <NewListingFlow />
    </div>
  );
}
