import { createHash, randomBytes } from "crypto";
import { getSiteUrl } from "@/lib/env";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { AgencyRole } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export type TeamInviteRole = Extract<AgencyRole, "admin" | "member">;

export type AgencyInvitationRow = {
  id: string;
  agency_id: string;
  email: string;
  role: TeamInviteRole;
  token_hash: string;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  agency?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildInviteUrl(token: string) {
  return `${getSiteUrl()}/join/${token}`;
}

export function isInvitationExpired(invitation: Pick<AgencyInvitationRow, "expires_at">) {
  return new Date(invitation.expires_at).getTime() <= Date.now();
}

export function invitationIsAcceptable(
  invitation: Pick<
    AgencyInvitationRow,
    "accepted_at" | "revoked_at" | "expires_at"
  > | null,
) {
  return Boolean(
    invitation &&
      !invitation.accepted_at &&
      !invitation.revoked_at &&
      !isInvitationExpired(invitation),
  );
}

export async function findAuthUserByEmail(
  admin: AdminClient,
  email: string,
): Promise<User | null> {
  const normalized = normalizeInvitationEmail(email);
  let page = 1;
  const perPage = 1000;

  while (page < 20) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(error.message);
    }

    const match =
      data.users.find(
        (user) => normalizeInvitationEmail(user.email ?? "") === normalized,
      ) ?? null;
    if (match) {
      return match;
    }

    if (!data.nextPage) {
      return null;
    }

    page = data.nextPage;
  }

  return null;
}

export async function getInvitationByToken(
  admin: AdminClient,
  token: string,
): Promise<AgencyInvitationRow | null> {
  const tokenHash = hashInviteToken(token);
  const { data, error } = await admin
    .from("agency_invitations")
    .select("*, agency:agencies(id, name, slug)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AgencyInvitationRow | null;
}
