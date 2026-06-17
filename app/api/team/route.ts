import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/auth/requireUser";
import { loadAgencyTeam } from "@/lib/team/loadTeam";

export async function GET() {
  try {
    const { agency, user } = await requireAgencyAdmin();
    const team = await loadAgencyTeam(agency.id);

    return NextResponse.json({
      current_user_id: user.id,
      members: team.members,
      invitations: team.invitations,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load team" },
      { status: 400 },
    );
  }
}
