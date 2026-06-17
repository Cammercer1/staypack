import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyAdmin } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgencyRole } from "@/lib/types";

const updateMemberSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["owner", "admin", "member"]),
});

const deleteMemberSchema = z.object({
  id: z.string().uuid(),
});

type MemberRow = {
  id: string;
  agency_id: string;
  user_id: string;
  role: AgencyRole;
};

async function loadMember(
  admin: ReturnType<typeof createAdminClient>,
  agencyId: string,
  memberId: string,
) {
  const { data, error } = await admin
    .from("agency_members")
    .select("id, agency_id, user_id, role")
    .eq("id", memberId)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as MemberRow | null;
}

async function countOwners(
  admin: ReturnType<typeof createAdminClient>,
  agencyId: string,
) {
  const { count, error } = await admin
    .from("agency_members")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("role", "owner");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function PATCH(request: Request) {
  try {
    const { agency, role: actorRole } = await requireAgencyAdmin();
    const body = updateMemberSchema.parse(await request.json());
    const admin = createAdminClient();
    const member = await loadMember(admin, agency.id, body.id);

    if (!member) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    if (
      actorRole !== "owner" &&
      (member.role === "owner" || body.role === "owner")
    ) {
      return forbidden("Only owners can manage owner access");
    }

    if (member.role === "owner" && body.role !== "owner") {
      const owners = await countOwners(admin, agency.id);
      if (owners <= 1) {
        return forbidden("Add another owner before changing the last owner");
      }
    }

    const { data, error } = await admin
      .from("agency_members")
      .update({ role: body.role })
      .eq("id", member.id)
      .eq("agency_id", agency.id)
      .select("id, agency_id, user_id, role, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ member: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update member" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { agency, role: actorRole, user } = await requireAgencyAdmin();
    const body = deleteMemberSchema.parse(await request.json());
    const admin = createAdminClient();
    const member = await loadMember(admin, agency.id, body.id);

    if (!member) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    if (member.user_id === user.id) {
      return forbidden("You cannot remove your own access");
    }

    if (member.role === "owner") {
      if (actorRole !== "owner") {
        return forbidden("Only owners can remove owners");
      }

      const owners = await countOwners(admin, agency.id);
      if (owners <= 1) {
        return forbidden("Add another owner before removing the last owner");
      }
    }

    const { error } = await admin
      .from("agency_members")
      .delete()
      .eq("id", member.id)
      .eq("agency_id", agency.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove member" },
      { status: 400 },
    );
  }
}
