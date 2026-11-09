import { z } from "zod";
import { createAdminClient } from "../lib/supabase/admin";
import { runLeaseAppraisalJob } from "../lib/lease-appraisal/runLeaseAppraisalJob";
import { runSalesAppraisalJob } from "../lib/sales-appraisal/runSalesAppraisalJob";
import { AppraisalJobBusyError } from "../lib/appraisals/claimJob";

export type QueueBatch = { messages: Array<{
  body: unknown; attempts: number; ack(): void; retry(options?: { delaySeconds: number }): void;
}> };
const messageSchema = z.object({ kind: z.enum(["lease", "sales"]), jobId: z.uuid(), agencyId: z.uuid() }).strict();

export async function consumeAppraisalJobs(batch: QueueBatch, allowedAgencyId?: string) {
  for (const message of batch.messages) {
    const parsed = messageSchema.safeParse(message.body);
    if (!parsed.success || (allowedAgencyId && parsed.data.agencyId !== allowedAgencyId)) {
      message.ack();
      continue;
    }
    const { kind, jobId, agencyId } = parsed.data;
    try {
      const supabase = createAdminClient();
      const job = await supabase.from(`${kind}_appraisal_jobs`).select("agency_id").eq("id", jobId).maybeSingle();
      if (job.error) throw new Error("Unable to load queued job");
      if (!job.data || job.data.agency_id !== agencyId) { message.ack(); continue; }
      await (kind === "lease" ? runLeaseAppraisalJob : runSalesAppraisalJob)({ supabase, jobId });
      message.ack();
    } catch (error) {
      // No provider bodies or customer input in Worker logs. Durable queue retries
      // recover transient failures; exhausted deliveries are kept in a DLQ.
      console.warn("Appraisal queue delivery deferred", { kind, jobId, attempt: message.attempts, busy: error instanceof AppraisalJobBusyError });
      message.retry({ delaySeconds: error instanceof AppraisalJobBusyError ? 601 : Math.min(300, 15 * 2 ** (message.attempts - 1)) });
    }
  }
}
