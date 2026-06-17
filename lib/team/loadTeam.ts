import { createAdminClient } from "@/lib/supabase/admin";
import type { AgencyRole } from "@/lib/types";

export type TeamMemberForUi = {
  id: string;
  agency_id: string;
  user_id: string;
  role: AgencyRole;
  created_at: string;
  email: string | null;
};

export type TeamInvitationForUi = {
  id: string;
  email: string;
  role: Extract<AgencyRole, "admin" | "member">;
  expires_at: string;
  created_at: string;
};

type MemberRow = Omit<TeamMemberForUi, "email">;

async function loadUserEmail(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error) {
    return null;
  }

  return data.user?.email ?? null;
}

export async function loadAgencyTeam(agencyId: string) {
  const admin = createAdminClient();
  const [{ data: members, error: membersError }, { data: invitations, error: invitesError }] =
    await Promise.all([
      admin
        .from("agency_members")
        .select("id, agency_id, user_id, role, created_at")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: true }),
      admin
        .from("agency_invitations")
        .select("id, email, role, expires_at, created_at")
        .eq("agency_id", agencyId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
    ]);

  if (membersError) {
    throw new Error(membersError.message);
  }

  if (invitesError) {
    throw new Error(invitesError.message);
  }

  const memberRows = (members ?? []) as MemberRow[];
  const emails = await Promise.all(
    memberRows.map((member) => loadUserEmail(admin, member.user_id)),
  );

  return {
    members: memberRows.map((member, index) => ({
      ...member,
      email: emails[index],
    })) satisfies TeamMemberForUi[],
    invitations: (invitations ?? []) as TeamInvitationForUi[],
  };
}
