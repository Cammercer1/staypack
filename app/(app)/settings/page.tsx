import Link from "next/link";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Settings"
        highlight="Manage"
        title="your agency setup."
        description="Configure branding, agent profiles and account preferences for every report you publish."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card className="surface-card border-0 shadow-none ring-0">
          <CardHeader>
            <CardTitle className="font-display text-xl">Brand</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-5 text-sm leading-6 text-muted-foreground">
              Logo, colours, default report title and disclaimer.
            </p>
            <Link href="/settings/brand" className="text-sm font-medium underline-offset-4 hover:underline">
              Edit brand settings
            </Link>
          </CardContent>
        </Card>
        <Card className="surface-card border-0 shadow-none ring-0">
          <CardHeader>
            <CardTitle className="font-display text-xl">Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-5 text-sm leading-6 text-muted-foreground">
              Manage agent profiles used on reports.
            </p>
            <Link href="/settings/agents" className="text-sm font-medium underline-offset-4 hover:underline">
              Manage agents
            </Link>
          </CardContent>
        </Card>
        <Card className="surface-card border-0 shadow-none ring-0 opacity-60">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2 text-xl">
              Business cards
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">
                Coming soon
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Design reusable front-and-back agent cards with optional property QR codes.
            </p>
          </CardContent>
        </Card>
        <Card className="surface-card border-0 shadow-none ring-0">
          <CardHeader>
            <CardTitle className="font-display text-xl">Billing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Billing integration coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
