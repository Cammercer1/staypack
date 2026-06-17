import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyAdmin } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildInviteUrl,
  createInviteToken,
  findAuthUserByEmail,
  hashInviteToken,
  isInvitationExpired,
  normalizeInvitationEmail,
} from "@/lib/team/invitations";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

const revokeSchema = z.object({
  id: z.string().uuid(),
});

function expiresInDays(days: number) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString();
}

export async function POST(request: Request) {
  try {
    const { agency, user } = await requireAgencyAdmin();
    const body = inviteSchema.parse(await request.json());
    const admin = createAdminClient();
    const email = normalizeInvitationEmail(body.email);

    const existingUser = await findAuthUserByEmail(admin, email);
    if (existingUser) {
      const { data: membership, error: membershipError } = await admin
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (membershipError) {
        return NextResponse.json(
          { error: membershipError.message },
          { status: 400 },
        );
      }

      if (membership?.agency_id === agency.id) {
        return NextResponse.json(
          { error: "That user is already a team member" },
          { status: 409 },
        );
      }

      if (membership?.agency_id) {
        return NextResponse.json(
          { error: "That email already belongs to another agency" },
          { status: 409 },
        );
      }
    }

    const { data: pending, error: pendingError } = await admin
      .from("agency_invitations")
      .select("*")
      .eq("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .maybeSingle();

    if (pendingError) {
      return NextResponse.json({ error: pendingError.message }, { status: 400 });
    }

    if (pending && isInvitationExpired(pending)) {
      const { error: expireError } = await admin
        .from("agency_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", pending.id);

      if (expireError) {
        return NextResponse.json({ error: expireError.message }, { status: 400 });
      }
    } else if (pending && pending.agency_id !== agency.id) {
      return NextResponse.json(
        { error: "That email already has a pending invitation" },
        { status: 409 },
      );
    }

    const token = createInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = expiresInDays(14);

    const mutation = pending && pending.agency_id === agency.id
      ? admin
          .from("agency_invitations")
          .update({
            role: body.role,
            token_hash: tokenHash,
            invited_by: user.id,
            expires_at: expiresAt,
            revoked_at: null,
          })
          .eq("id", pending.id)
          .select("id, email, role, expires_at, created_at")
          .single()
      : admin
          .from("agency_invitations")
          .insert({
            agency_id: agency.id,
            email,
            role: body.role,
            token_hash: tokenHash,
            invited_by: user.id,
            expires_at: expiresAt,
          })
          .select("id, email, role, expires_at, created_at")
          .single();

    const { data, error } = await mutation;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      invitation: data,
      invite_url: buildInviteUrl(token),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create invite" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { agency } = await requireAgencyAdmin();
    const body = revokeSchema.parse(await request.json());
    const admin = createAdminClient();

    const { error } = await admin
      .from("agency_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("agency_id", agency.id)
      .is("accepted_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to revoke invite" },
      { status: 400 },
    );
  }
}
