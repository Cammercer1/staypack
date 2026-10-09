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
          Use this property record to create appraisals, reports and marketing material.
        </p>
      </div>
      <NewListingFlow />
    </div>
  );
}
