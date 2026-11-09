import { beforeEach, expect, it, vi } from "vitest";
import { scheduledMaintenance } from "./scheduled";
import cleanup from "../lib/hosting/cacheCleanup";
import billing from "../lib/hosting/billingSync";
vi.mock("../lib/hosting/cacheCleanup", () => ({ default: vi.fn() }));
vi.mock("../lib/hosting/billingSync", () => ({ default: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("keeps schedules paused until cutover and preserves each cadence", async () => {
  await scheduledMaintenance({ scheduledTime: 0 }, {});
  expect(billing).not.toHaveBeenCalled(); expect(cleanup).not.toHaveBeenCalled();
  await scheduledMaintenance({ scheduledTime: 60_000 }, { SCHEDULES_ENABLED: "1" });
  expect(billing).toHaveBeenCalledTimes(1); expect(cleanup).not.toHaveBeenCalled();
  await scheduledMaintenance({ scheduledTime: 300_000 }, { SCHEDULES_ENABLED: "1" });
  expect(billing).toHaveBeenCalledTimes(2); expect(cleanup).toHaveBeenCalledTimes(1);
});
it("reports failures without skipping the other scheduled work", async () => {
  vi.mocked(billing).mockRejectedValueOnce(new Error("failure"));
  await expect(scheduledMaintenance({ scheduledTime: 0 }, { SCHEDULES_ENABLED: "1" })).rejects.toThrow("Scheduled maintenance failed");
  expect(cleanup).toHaveBeenCalledTimes(1);
});
