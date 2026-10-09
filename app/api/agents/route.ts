import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgency, requireAgencyAdmin } from "@/lib/auth/requireUser";
import { agentProfileSchema } from "@/lib/validation/schemas";
import { loadAgentDirectory } from "@/lib/agents/loadDirectory";

function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof z.ZodError
          ? error.issues[0]?.message
          : error instanceof Error
            ? error.message
            : "Unable to save agent. Please try again.",
    },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  try {
    const { supabase, agency } = await requireAgency();
    if (new URL(request.url).searchParams.get("directory") === "true") {
      return NextResponse.json({
        agents: await loadAgentDirectory(supabase, agency.id),
      });
    }
    const { data, error } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("agency_id", agency.id)
      .is("archived_at", null)
      .order("name");
    if (error) throw new Error("Unable to load agents. Please try again.");
    return NextResponse.json({ agents: data ?? [] });
  } catch (error) {
    return failure(error);
  }
}

async function mutate(request: Request, create: boolean) {
  try {
    const { supabase, agency } = await requireAgencyAdmin();
    const payload = await request.json();
    const id = create ? null : z.string().uuid().parse(payload.id);
    const action = create
      ? "create"
      : z
          .enum(["save", "archive", "restore", "default"])
          .parse(payload.action ?? "save");
    const values =
      action === "save" || create ? agentProfileSchema.parse(payload) : {};
    const expected = payload.updated_at
      ? z.string().datetime({ offset: true }).parse(payload.updated_at)
      : null;
    const { data, error } = await supabase.rpc("manage_agent_profile", {
      target_agency: agency.id,
      target_id: id,
      operation: action,
      values_json: values,
      expected_updated_at: expected,
    });
    if (error?.code === "23505") {
      let matchId: string | undefined;
      try {
        matchId = z
          .string()
          .uuid()
          .parse(JSON.parse(error.details ?? "{}").agent_id);
      } catch {
        /* A different unique constraint may have failed. */
      }
      if (matchId) {
        const directory = await loadAgentDirectory(supabase, agency.id);
        return NextResponse.json(
          {
            error: error.message,
            duplicateAgent: directory.find((agent) => agent.id === matchId),
          },
          { status: 409 },
        );
      }
    }
    if (error)
      return NextResponse.json(
        { error: error.message },
        { status: ["40001", "23505"].includes(error.code) ? 409 : 400 },
      );
    return NextResponse.json({ agent: data });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  return mutate(request, true);
}
export async function PATCH(request: Request) {
  return mutate(request, false);
}
// Older clients use DELETE. Preserve their intent as a reversible archive.
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}));
  return mutate(
    new Request(request.url, {
      method: "PATCH",
      body: JSON.stringify({ ...body, action: "archive" }),
    }),
    false,
  );
}
