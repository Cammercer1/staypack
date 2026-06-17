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
            You can keep using the agency workspace with the current branding. Brand
            changes are restricted to admins.
          </p>
          <Link href="/settings" className="mt-5 inline-block">
            <Button variant="outline">Back to settings</Button>
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
        title="how your reports look."
        description="Set logo, colours, default copy and disclaimers used across every STR potential report."
      />
      <BrandSettingsForm agency={agency} />
    </div>
  );
}
