import { expect, it } from "vitest";
import { currentProposalPublication, parsePublicationReceipt, publicationReceiptKey, proposalPublicationState } from "./shareState";
import type { ProposalVersionSummary } from "./workspace";

const workspace = { revision: 4, sourceFingerprint: "current-source" };
const version: ProposalVersionSummary = { id: "v1", path: "/proposal/token", draft_revision: 4, source_fingerprint: "current-source", created_at: "2026-10-21", revoked_at: null };

it("confirms current only when draft and source match an active publication", () => {
  expect(proposalPublicationState(workspace, version)).toBe("current");
  expect(proposalPublicationState(workspace, undefined)).toBe("private");
  expect(proposalPublicationState(workspace, { ...version, revoked_at: "2026-10-22" })).toBe("private");
  expect(proposalPublicationState(workspace, version, true)).toBe("changes");
  expect(proposalPublicationState(workspace, { ...version, draft_revision: 3 })).toBe("changes");
  expect(proposalPublicationState(workspace, { ...version, source_fingerprint: "old" })).toBe("changes");
  expect(proposalPublicationState(workspace, { ...version, source_fingerprint: undefined })).toBe("unverified");
});

it("uses a successful publication confirmation only for that exact saved state and link", () => {
  const old = { ...version, draft_revision: 1, source_fingerprint: "old" };
  const confirmation = { versionId: version.id, path: version.path, revision: 4, sourceFingerprint: "current-source" };
  expect(proposalPublicationState(workspace, old, false, confirmation)).toBe("current");
  expect(proposalPublicationState(workspace, old, true, confirmation)).toBe("changes");
  expect(proposalPublicationState({ ...workspace, revision: 5 }, old, false, confirmation)).toBe("changes");
  expect(proposalPublicationState({ ...workspace, sourceFingerprint: "new" }, old, false, confirmation)).toBe("changes");
  expect(proposalPublicationState(workspace, { ...old, path: "/proposal/other" }, false, confirmation)).toBe("changes");
});

it("accepts only a minimal, valid publication receipt", () => {
  const receipt = { versionId: "v1", path: `/proposal/${"a".repeat(64)}`, revision: 4, sourceFingerprint: "current-source" };
  expect(parsePublicationReceipt(JSON.stringify(receipt))).toEqual(receipt);
  for (const raw of [null, "bad json", "null", "[]", "{}", JSON.stringify({ ...receipt, revision: -1 }), JSON.stringify({ ...receipt, revision: "4" }), JSON.stringify({ ...receipt, path: "https://example.com" }), JSON.stringify({ ...receipt, sourceFingerprint: "" }), JSON.stringify({ ...receipt, draft: {} })]) {
    expect(parsePublicationReceipt(raw)).toBeNull();
  }
  expect(parsePublicationReceipt(" ".repeat(2049))).toBeNull();
  expect(publicationReceiptKey("/appraisals/one")).not.toBe(publicationReceiptKey("/appraisals/two"));
});

it("uses the stable link's published revision when an older snapshot is deliberately reused", () => {
  const older = { ...version, draft_revision: 1, source_fingerprint: "old", path: `/proposal/${"a".repeat(64)}?version=v1` };
  const newer = { ...version, id: "v2", draft_revision: 3, source_fingerprint: "other" };
  const shareLink = { id: "link", path: `/proposal/${"a".repeat(64)}`, versionId: older.id, draft_revision: 4, source_fingerprint: "current-source", created_at: "2026-10-21", updated_at: "2026-10-22", revoked_at: null };
  const published = currentProposalPublication({ versions: [newer, older], shareLink });
  expect(published).toMatchObject({ id: older.id, path: shareLink.path, draft_revision: 4, source_fingerprint: "current-source", link_id: "link" });
  expect(proposalPublicationState(workspace, published)).toBe("current");
  expect(proposalPublicationState({ ...workspace, revision: 5 }, published)).toBe("changes");
  expect(currentProposalPublication({ versions: [newer, older], shareLink: { ...shareLink, revoked_at: "2026-10-23" } })).toBeUndefined();
  expect(currentProposalPublication({ versions: [newer], shareLink })).toBeUndefined();
});
