import Link from "next/link";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { TeamManager } from "@/components/settings/TeamManager";
import { Button } from "@/components/ui/button";
import { requireAgency } from "@/lib/auth/requireUser";
import { loadAgencyTeam } from "@/lib/team/loadTeam";

export default async function TeamSettingsPage() {
  const { agency, user, role } = await requireAgency();

  if (!["owner", "admin"].includes(role)) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Team"
          highlight="Admin"
          title="access required."
          description="Only agency owners and admins can invite users or manage team access."
        />
        <div className="surface-card max-w-2xl p-6 md:p-8">
          <h2 className="font-display text-xl tracking-tight">
            Ask an admin to manage team access
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            You can still use the agency workspace, listings and reports available
            to your role. Team invitations are restricted to admins.
          </p>
          <Link href="/settings" className="mt-5 inline-block">
            <Button variant="outline">Back to settings</Button>
          </Link>
        </div>
      </div>
    );
  }

  const team = await loadAgencyTeam(agency.id);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Team"
        highlight="Invite"
        title="people into your agency."
        description="Manage login access for the agency workspace. Agent profiles remain separate from user accounts."
      />
      <TeamManager
        initialMembers={team.members}
        initialInvitations={team.invitations}
        currentUserId={user.id}
      />
    </div>
  );
}
