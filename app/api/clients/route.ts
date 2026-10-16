import { requireAgency } from "@/lib/auth/requireUser";
import { privateJson } from "@/lib/str-appraisals/api";
import { clientApiError } from "@/lib/clients/api";
import { clientQuerySchema, clientSchema } from "@/lib/clients/schema";
import { createClient, listClients } from "@/lib/clients/service";

export async function GET(request: Request) {
  try {
    const { supabase, agency } = await requireAgency();
    const query = clientQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return privateJson(await listClients(supabase, agency.id, query));
  } catch (error) { return clientApiError(error); }
}

export async function POST(request: Request) {
  try {
    const { supabase, agency } = await requireAgency();
    const value = clientSchema.parse(await request.json());
    return privateJson({ client: await createClient(supabase, agency.id, value) }, 201);
  } catch (error) { return clientApiError(error); }
}
