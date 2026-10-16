import { z } from "zod";
import { requireAgency } from "@/lib/auth/requireUser";
import { privateJson } from "@/lib/str-appraisals/api";
import { clientApiError } from "@/lib/clients/api";
import { updateClientSchema } from "@/lib/clients/schema";
import { loadClient, updateClient } from "@/lib/clients/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { supabase, agency } = await requireAgency();
    const id = z.uuid().parse((await params).id);
    return privateJson(await loadClient(supabase, agency.id, id));
  } catch (error) { return clientApiError(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { supabase, agency } = await requireAgency();
    const id = z.uuid().parse((await params).id);
    const value = updateClientSchema.parse(await request.json());
    return privateJson({ client: await updateClient(supabase, agency.id, id, value) });
  } catch (error) { return clientApiError(error); }
}
