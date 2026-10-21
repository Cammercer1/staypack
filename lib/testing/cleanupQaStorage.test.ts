import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { cleanupQaStorage } from "./cleanupQaStorage";

const mocks = vi.hoisted(() => ({ send: vi.fn(), usesR2: vi.fn() }));
vi.mock("../storage/r2", () => ({
  usesR2Storage: mocks.usesR2,
  r2Configuration: () => ({ publicBucket: "qa-public", privateBucket: "qa-private" }),
  r2Client: () => ({ send: mocks.send }),
}));
const agencyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function setup(record: { name: string; slug: string } | null = { name: "Appraisal Integration", slug: `appraisal-${agencyId}` }) {
  const list = vi.fn().mockResolvedValue({ data: [], error: null });
  const remove = vi.fn().mockResolvedValue({ data: [], error: null });
  const storageFrom = vi.fn(() => ({ list, remove }));
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: vi.fn().mockResolvedValue({ data: record, error: null }) };
  return { admin: { from: vi.fn(() => query), storage: { from: storageFrom } } as unknown as SupabaseClient, query, list, remove, storageFrom };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.usesR2.mockReturnValue(true);
  mocks.send.mockResolvedValue({});
});

it("refuses ordinary agencies even if a caller supplies a valid UUID", async () => {
  const { admin, storageFrom } = setup({ name: "Customer agency", slug: "customer" });
  await expect(cleanupQaStorage(admin, agencyId)).rejects.toThrow("not a disposable QA fixture");
  expect(mocks.send).not.toHaveBeenCalled();
  expect(storageFrom).not.toHaveBeenCalled();
});

it("does nothing when fixture setup failed before agency creation", async () => {
  const { admin, storageFrom } = setup(null);
  await cleanupQaStorage(admin, agencyId);
  expect(mocks.send).not.toHaveBeenCalled();
  expect(storageFrom).not.toHaveBeenCalled();
});

it("paginates R2 and nested Supabase assets while deleting only the exact agency prefix", async () => {
  const { admin, query, list, remove } = setup();
  const prefix = `report-assets/${agencyId}/`;
  mocks.send.mockImplementation(async command => {
    if (command instanceof ListObjectsV2Command && command.input.Prefix === prefix) {
      return command.input.ContinuationToken
        ? { Contents: [{ Key: `${prefix}published-images/second.webp` }] }
        : { Contents: [{ Key: `${prefix}published-images/first.webp` }], NextContinuationToken: "next-page" };
    }
    return {};
  });
  // Only the report-assets scan returns a folder; the other buckets are empty.
  list.mockResolvedValueOnce({ data: [{ name: "version", id: null }], error: null })
    .mockResolvedValueOnce({ data: [{ name: "image.webp", id: "file" }], error: null });
  await cleanupQaStorage(admin, agencyId);
  expect(query.eq).toHaveBeenCalledWith("id", agencyId);
  const commands = mocks.send.mock.calls.map(([command]) => command);
  const deleted = commands.filter(command => command instanceof DeleteObjectCommand);
  expect(deleted.map(command => command.input)).toEqual([
    { Bucket: "qa-public", Key: `${prefix}published-images/first.webp` },
    { Bucket: "qa-public", Key: `${prefix}published-images/second.webp` },
  ]);
  expect(commands[0]).toBeInstanceOf(ListObjectsV2Command);
  expect(commands[1]).toBeInstanceOf(ListObjectsV2Command);
  expect(commands.filter(command => command instanceof ListObjectsV2Command).every(command => command.input.Prefix?.endsWith(`/${agencyId}/`) === true)).toBe(true);
  expect(list).toHaveBeenCalledWith(`${agencyId}/version`, { limit: 100, offset: 0 });
  expect(remove).toHaveBeenCalledExactlyOnceWith([`${agencyId}/version/image.webp`]);
});

it("rejects an R2 response outside the requested agency before deleting anything", async () => {
  const { admin, storageFrom } = setup();
  mocks.send.mockResolvedValue({ Contents: [{ Key: "report-assets/another-agency/image.webp" }] });
  await expect(cleanupQaStorage(admin, agencyId)).rejects.toThrow("outside the QA agency prefix");
  expect(mocks.send.mock.calls.every(([command]) => command instanceof ListObjectsV2Command)).toBe(true);
  expect(storageFrom).not.toHaveBeenCalled();
});
