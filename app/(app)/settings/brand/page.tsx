import { requireAgencyAdmin } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { BrandSettingsForm } from "@/components/settings/BrandSettingsForm";

export default async function BrandSettingsPage() {
  const { agency } = await requireAgencyAdmin();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Brand"
        highlight="Shape"
        title="how your reports look."
        description="Set logo, colours, default copy and disclaimers used across every STR potential report."
      />
      <BrandSettingsForm agency={agency} />
    </div>
  );
}
