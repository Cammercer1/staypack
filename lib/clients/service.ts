import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { clientQuerySchema, clientSchema, updateClientSchema } from "./schema";
import { clientPayload } from "./schema";
import type { Client, ClientDetail, ClientListResult } from "./types";

export const CLIENT_PAGE_SIZE = 30;

export class ClientError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function throwDatabaseError(error: { message: string; code?: string }) {
  throw new ClientError(error.message, error.code === "PT409" || error.code === "23505" ? 409
    : error.code === "PT404" ? 404 : error.code === "42501" ? 403 : 400);
}

export async function listClients(supabase: SupabaseClient, agencyId: string, filters: z.infer<typeof clientQuerySchema>) {
  const { data, error } = await supabase.rpc("list_agency_clients", {
    p_agency_id: agencyId, p_search: filters.q, p_archived: filters.archived,
    p_page: filters.page, p_page_size: CLIENT_PAGE_SIZE,
  });
  if (error) throwDatabaseError(error);
  return { ...(data as Pick<ClientListResult, "clients" | "total">), page: filters.page, pageSize: CLIENT_PAGE_SIZE };
}

export async function createClient(supabase: SupabaseClient, agencyId: string, value: z.infer<typeof clientSchema>) {
  const { data, error } = await supabase.rpc("save_agency_client", {
    p_agency_id: agencyId, p_client_id: null, p_client: clientPayload(value),
    p_archived: false, p_expected_updated_at: null,
  });
  if (error) throwDatabaseError(error);
  return data as Client;
}

export async function updateClient(supabase: SupabaseClient, agencyId: string, clientId: string, value: z.infer<typeof updateClientSchema>) {
  const { data, error } = await supabase.rpc("save_agency_client", {
    p_agency_id: agencyId, p_client_id: clientId, p_client: clientPayload(value),
    p_archived: value.archived, p_expected_updated_at: value.expected_updated_at,
  });
  if (error) throwDatabaseError(error);
  return data as Client;
}

export async function loadClient(supabase: SupabaseClient, agencyId: string, clientId: string) {
  const { data, error } = await supabase.rpc("get_agency_client", { p_agency_id: agencyId, p_client_id: clientId });
  if (error) throwDatabaseError(error);
  if (!data) throw new ClientError("Client not found.", 404);
  return data as ClientDetail;
}
