import { env } from "cloudflare:workers";
import type { AppraisalQueueMessage } from "../lib/hosting/jobQueue";

export async function enqueueAppraisalJob(message: AppraisalQueueMessage): Promise<boolean> {
  const queue = (env as unknown as { APPRAISAL_JOBS?: { send(body: AppraisalQueueMessage): Promise<void> } }).APPRAISAL_JOBS;
  if (!queue) throw new Error("Background job queue is not configured");
  await queue.send(message);
  return true;
}
