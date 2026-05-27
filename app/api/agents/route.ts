import { NextResponse } from "next/server";
import { requireAgency, requireAgencyAdmin } from "@/lib/auth/requireUser";
import { agentProfileSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const { supabase, agency } = await requireAgency();
    const { data, error } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ agents: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load agents" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, agency } = await requireAgencyAdmin();
    const body = agentProfileSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("agent_profiles")
      .insert({
        agency_id: agency.id,
        ...body,
        email: body.email || null,
        phone: body.phone || null,
        role_title: body.role_title || null,
        photo_url: body.photo_url || null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ agent: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create agent" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, agency } = await requireAgencyAdmin();
    const payload = await request.json();
    const { id, ...values } = payload;
    const body = agentProfileSchema.parse(values);

    const { data, error } = await supabase
      .from("agent_profiles")
      .update({
        ...body,
        email: body.email || null,
        phone: body.phone || null,
        role_title: body.role_title || null,
        photo_url: body.photo_url || null,
      })
      .eq("id", id)
      .eq("agency_id", agency.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ agent: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update agent" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, agency } = await requireAgencyAdmin();
    const { id } = await request.json();

    const { error } = await supabase
      .from("agent_profiles")
      .delete()
      .eq("id", id)
      .eq("agency_id", agency.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete agent" },
      { status: 400 },
    );
  }
}
