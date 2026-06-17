import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getInvitationByToken,
  invitationIsAcceptable,
  normalizeInvitationEmail,
} from "@/lib/team/invitations";

const acceptSchema = z.object({
  token: z.string().min(20),
});

export async function POST(request: Request) {
  try {
    const body = acceptSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sign in before accepting this invitation" },
        { status: 401 },
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "Your account needs an email address to accept this invitation" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const invitation = await getInvitationByToken(admin, body.token);

    if (!invitationIsAcceptable(invitation)) {
      return NextResponse.json(
        { error: "This invitation is expired or has already been used" },
        { status: 410 },
      );
    }

    if (
      normalizeInvitationEmail(user.email) !==
      normalizeInvitationEmail(invitation!.email)
    ) {
      return NextResponse.json(
        { error: `Sign in as ${invitation!.email} to accept this invitation` },
        { status: 403 },
      );
    }

    const { data: existingMembership, error: membershipError } = await admin
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 400 });
    }

    if (
      existingMembership?.agency_id &&
      existingMembership.agency_id !== invitation!.agency_id
    ) {
      return NextResponse.json(
        { error: "Your account already belongs to another agency" },
        { status: 409 },
      );
    }

    if (!existingMembership) {
      const { error: insertError } = await admin.from("agency_members").insert({
        agency_id: invitation!.agency_id,
        user_id: user.id,
        role: invitation!.role,
      });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }
    }

    const { error: acceptError } = await admin
      .from("agency_invitations")
      .update({
        accepted_by: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation!.id);

    if (acceptError) {
      return NextResponse.json({ error: acceptError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      agency: invitation!.agency ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to accept invite" },
      { status: 400 },
    );
  }
}
