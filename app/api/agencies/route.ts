import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAgency,
  requireAgencyAdmin,
  requireUser,
} from "@/lib/auth/requireUser";
import { agencySchema } from "@/lib/validation/schemas";
import {
  discoverStaleAgencySlugsInPublicUrls,
  syncAgencyPublicUrls,
} from "@/lib/agencies/syncAgencyPublicUrls";
import { normalizeAgencyBrandPayload } from "@/lib/branding/normalize";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = agencySchema.parse(await request.json());
    const admin = createAdminClient();
    const payload = normalizeAgencyBrandPayload(body);

    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .insert(payload)
      .select("*")
      .single();

    if (agencyError) {
      return NextResponse.json({ error: agencyError.message }, { status: 400 });
    }

    const { error: memberError } = await admin.from("agency_members").insert({
      agency_id: agency.id,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) {
      await admin.from("agencies").delete().eq("id", agency.id);
      return NextResponse.json({ error: memberError.message }, { status: 400 });
    }

    return NextResponse.json({ agency });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create agency",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, agency } = await requireAgencyAdmin();
    const body = agencySchema.parse(await request.json());
    const payload = normalizeAgencyBrandPayload(body);
    const slugChanged = payload.slug !== agency.slug;
    const staleSlugs = await discoverStaleAgencySlugsInPublicUrls(
      supabase,
      agency.id,
      payload.slug,
    );
    const slugAliases = [
      ...new Set([
        ...(agency.slug_aliases ?? []),
        ...(slugChanged ? [agency.slug] : []),
        ...staleSlugs,
      ]),
    ];
    const updatePayload =
      slugAliases.length > (agency.slug_aliases?.length ?? 0) || slugChanged
        ? { ...payload, slug_aliases: slugAliases }
        : payload;

    const { data, error } = await supabase
      .from("agencies")
      .update(updatePayload)
      .eq("id", agency.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await syncAgencyPublicUrls(supabase, agency.id, data.slug);

    return NextResponse.json({ agency: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update agency" },
      { status: 400 },
    );
  }
}

export async function GET() {
  try {
    const { agency } = await requireAgency();
    return NextResponse.json({ agency });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load agency" },
      { status: 400 },
    );
  }
}
