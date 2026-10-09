import Link from "next/link";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { BrandSettingsForm } from "@/components/settings/BrandSettingsForm";
import { Button } from "@/components/ui/button";
import { requireAgency } from "@/lib/auth/requireUser";

export default async function BrandSettingsPage() {
  const { agency, role } = await requireAgency();

  if (!["owner", "admin"].includes(role)) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Brand"
          highlight="Admin"
          title="access required."
          description="Only agency owners and admins can update agency branding."
        />
        <div className="surface-card max-w-2xl p-6 md:p-8">
          <h2 className="font-display text-xl tracking-tight">
            Ask an admin to update brand settings
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            You can keep using the agency workspace with the current branding.
            Brand changes are restricted to admins.
          </p>
          <Link href="/dashboard" className="mt-5 inline-block">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Brand"
        highlight="Shape"
        title="your agency’s brand."
        description="Make reports, brochures and listing pages feel like your agency. Preview your changes before saving."
      />
      <BrandSettingsForm agency={agency} />
    </div>
  );
}
