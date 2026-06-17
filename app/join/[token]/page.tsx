import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AcceptInvitationButton } from "@/components/team/AcceptInvitationButton";
import { AuthLayout } from "@/components/app-shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getInvitationByToken,
  invitationIsAcceptable,
  normalizeInvitationEmail,
} from "@/lib/team/invitations";

export default async function JoinAgencyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const invitation = await getInvitationByToken(admin, token);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextPath = `/join/${token}`;
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;
  const signupHref = `/signup?next=${encodeURIComponent(nextPath)}`;
  const agencyName = invitation?.agency?.name ?? "this agency";
  const acceptable = invitationIsAcceptable(invitation);
  const signedInEmail = user?.email ? normalizeInvitationEmail(user.email) : null;
  const invitedEmail = invitation?.email
    ? normalizeInvitationEmail(invitation.email)
    : null;
  const emailMatches =
    signedInEmail != null && invitedEmail != null && signedInEmail === invitedEmail;

  return (
    <AuthLayout
      highlight="Join"
      title="your agency workspace."
      description="Accept your StayPacks invitation to collaborate on listings, reports and collateral."
    >
      <div className="surface-card p-8">
        <div className="mb-8 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Agency invitation
          </p>
          <h1 className="font-display text-3xl tracking-tight">
            {acceptable ? agencyName : "Invitation unavailable"}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {acceptable
              ? `This invitation is for ${invitation!.email}.`
              : "This invitation has expired, been revoked, or already been used."}
          </p>
        </div>

        {!acceptable ? (
          <Link href="/login">
            <Button variant="outline">Back to sign in</Button>
          </Link>
        ) : !user ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={loginHref}>
              <Button>Sign in to accept</Button>
            </Link>
            <Link href={signupHref}>
              <Button variant="outline">Create account</Button>
            </Link>
          </div>
        ) : !emailMatches ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
              You are signed in as {user.email}. Sign out and use {invitation!.email}
              {" "}to accept this invitation.
            </p>
            <LogoutButton redirectTo={loginHref} />
          </div>
        ) : (
          <AcceptInvitationButton token={token} />
        )}
      </div>
    </AuthLayout>
  );
}
