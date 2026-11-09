import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { AppraisalJobBusyError, claimAppraisalJob } from "./claimJob";

it("allows exactly one concurrent claim and recovers an expired attempt", async () => {
  const initial = { id: "job", status: "pending", attempts: 0, started_at: null, heartbeat_at: null };
  let row: Record<string, unknown> = { ...initial };
  const db = { from: () => ({ update: (values: Record<string, unknown>) => {
    const filters: Record<string, unknown> = {};
    const query = { eq: (key: string, value: unknown) => { filters[key] = value; return query; }, select: () => query,
      maybeSingle: async () => {
        if (!Object.entries(filters).every(([key, value]) => row[key] === value)) return { data: null, error: null };
        row = { ...row, ...values };
        return { data: { ...row }, error: null };
      } };
    return query;
  } }) } as unknown as SupabaseClient;
  const attempts = await Promise.allSettled([claimAppraisalJob(db, "jobs", initial), claimAppraisalJob(db, "jobs", initial)]);
  expect(attempts.map(a => a.status).sort()).toEqual(["fulfilled", "rejected"]);
  expect(row.attempts).toBe(1);
  await expect(claimAppraisalJob(db, "jobs", row as unknown as typeof initial)).rejects.toBeInstanceOf(AppraisalJobBusyError);
  row.heartbeat_at = new Date(Date.now() - 11 * 60_000).toISOString();
  await claimAppraisalJob(db, "jobs", row as unknown as typeof initial);
  expect(row.attempts).toBe(2);
});
