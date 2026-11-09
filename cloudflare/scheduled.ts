import cleanup from "../lib/hosting/cacheCleanup";
import billing from "../lib/hosting/billingSync";

/** Enable only after the old host's schedules have been stopped. */
export async function scheduledMaintenance(event: { scheduledTime: number }, env: { SCHEDULES_ENABLED?: string }) {
  if (env.SCHEDULES_ENABLED !== "1") return;
  const tasks = [billing()];
  if (new Date(event.scheduledTime).getUTCMinutes() % 5 === 0) tasks.push(cleanup());
  const results = await Promise.allSettled(tasks);
  if (results.some(result => result.status === "rejected")) throw new Error("Scheduled maintenance failed; inspect billing ledger and cache cleanup");
}
