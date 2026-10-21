import { expect, it } from "vitest";
import { proposalEventSchema } from "./activity";

const event = { id: "00000000-0000-4000-8000-000000000001", session: "00000000-0000-4000-8000-000000000002", kind: "open", target: "proposal" };

it("accepts a rendered version ID while retaining the legacy event shape", () => {
  expect(proposalEventSchema.parse(event).versionId).toBeUndefined();
  expect(proposalEventSchema.parse({ ...event, versionId: event.id }).versionId).toBe(event.id);
});

it("rejects malformed rendered version IDs", () => {
  expect(proposalEventSchema.safeParse({ ...event, versionId: "not-a-version" }).success).toBe(false);
});
