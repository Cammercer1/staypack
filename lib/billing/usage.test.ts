import { expect, it } from "vitest";
import { meterEventParams, requiresUsageReview } from "./usage";
const event = { id: "event-1", event_name: "staypack_report_v1", stripe_customer_id: "cus_1", quantity: 1,
  occurred_at: "2026-10-14T00:00:00Z", first_attempt_at: "2026-10-14T00:00:00Z" };
it("uses the persistent ledger ID and original occurrence time on every retry", () => {
  const params = meterEventParams(event);
  expect(params).toEqual({ identifier: "event-1", event_name: "staypack_report_v1", timestamp: Date.parse(event.occurred_at) / 1000,
    payload: { stripe_customer_id: "cus_1", value: "1" } });
  expect(meterEventParams({ ...event })).toEqual(params);
});
it("quarantines ambiguous events before Stripe's deduplication window expires", () => {
  expect(requiresUsageReview(event, Date.parse("2026-10-14T22:59:00Z"))).toBe(false);
  expect(requiresUsageReview(event, Date.parse("2026-10-14T23:00:00Z"))).toBe(true);
});
