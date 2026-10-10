import Link from "next/link";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { BrandSettingsForm } from "@/components/settings/BrandSettingsForm";
import { requireAgency } from "@/lib/auth/requireUser";
import { StrManagementPresetsForm } from "@/components/settings/StrManagementPresetsForm";

export default async function AgencyDetailsPage() {
  const { agency, role } = await requireAgency();
  if (!["owner", "admin"].includes(role)) {
    return (
      <div className="space-y-6">
        <PageHeader
          highlight="Admin"
          title="access required."
          description="Only agency owners and admins can update agency details."
        />
        <Link
          href="/dashboard"
          className="inline-block text-sm font-medium underline underline-offset-4"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-10">
      <PageHeader
        highlight="Agency"
        title="details."
        description="Manage your agency’s name, contact details and public listing links."
      />
      <BrandSettingsForm agency={agency} mode="details" />
      <StrManagementPresetsForm presets={agency.str_management_presets} />
    </div>
  );
}
