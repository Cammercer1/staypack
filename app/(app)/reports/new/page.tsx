import { requireAgency } from "@/lib/auth/requireUser";
import { NewReportFlow } from "@/components/reports/NewReportFlow";

export default async function NewReportPage() {
  const { agency } = await requireAgency();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-gradient text-3xl font-semibold">Create report</h1>
        <p className="text-muted-foreground">
          Paste a listing URL to import details, or enter the property manually.
        </p>
      </div>
      <NewReportFlow agency={agency} />
    </div>
  );
}
