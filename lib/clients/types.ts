/** Agency-private directory data. Public reports only receive a saved display name. */
export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone_e164: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientListResult = { clients: Client[]; total: number; page: number; pageSize: number };
export type ClientReport = {
  id: string;
  kind: "str" | "lease" | "sales";
  status: string;
  address: string | null;
  created_at: string;
};
export type ClientLead = {
  id: string;
  address: string;
  status: string;
  created_at: string;
  report_id: string | null;
};
export type ClientDetail = {
  client: Client;
  reports: ClientReport[];
  leads: ClientLead[];
  reportsTotal: number;
  leadsTotal: number;
};

export type PendingClient = {
  name: string | null;
  email: string | null;
  phone: string | null;
  reason: "missing_name" | "identity_conflict";
};
