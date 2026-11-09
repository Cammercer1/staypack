import type { SupabaseClient } from "@supabase/supabase-js";

export class AppraisalJobBusyError extends Error {
  constructor() { super("Appraisal job is already being processed"); }
}

/** Compare-and-swap the attempt so queue redelivery cannot run a job twice. */
export async function claimAppraisalJob<T extends {
  id: string; status: string; attempts: number; started_at: string | null; heartbeat_at: string | null;
}>(supabase: SupabaseClient, table: string, job: T): Promise<T> {
  const lastHeartbeat = Date.parse(job.heartbeat_at ?? job.started_at ?? "");
  if (job.status === "processing" && (!Number.isFinite(lastHeartbeat) || Date.now() - lastHeartbeat < 10 * 60_000)) {
    throw new AppraisalJobBusyError();
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase.from(table).update({
    status: "processing", attempts: job.attempts + 1, started_at: now,
    heartbeat_at: now, error_message: null, failed_at: null,
  }).eq("id", job.id).eq("status", job.status).eq("attempts", job.attempts).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new AppraisalJobBusyError();
  return data as T;
}
