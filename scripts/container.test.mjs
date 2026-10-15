import assert from "node:assert/strict";
import test from "node:test";
import { assertContainerSource, containerSettings } from "./container.mjs";

test("primary checkout retains its existing project and port", () => {
  assert.deepEqual(containerSettings("/code/StayPacks", "/code/StayPacks/.git"), { project: "staypacks", port: "3000" });
});

test("worktree previews require their own port and have distinct stable projects", () => {
  const common = "/code/StayPacks/.git";
  assert.throws(() => containerSettings("/worktrees/one", common), /STAYPACK_DEV_PORT/);
  assert.throws(() => containerSettings("/worktrees/one", common, "3000"), /reserved/);
  assert.throws(() => containerSettings("/worktrees/one", common, "03000"), /reserved/);
  const first = containerSettings("/worktrees/one", common, "3101");
  assert.notEqual(first.project, "staypacks");
  assert.notEqual(first.project, containerSettings("/worktrees/two", common, "3102").project);
  assert.deepEqual(first, containerSettings("/worktrees/one", common, "3101"));
});

test("rejects invalid ports and refuses to operate on another checkout's container", () => {
  for (const port of ["abc", "1000", "65536", "3000:3000"]) {
    assert.throws(() => containerSettings("/code/StayPacks", "/code/StayPacks/.git", port), /STAYPACK_DEV_PORT/);
  }
  assert.throws(() => assertContainerSource("/code/StayPacks", [{ Mounts: [{ Destination: "/workspace", Source: "/worktrees/old" }] }]), /worktrees\/old/);
  assert.throws(() => assertContainerSource("/code/StayPacks", [{ Mounts: [] }]), /unknown source/);
  assert.doesNotThrow(() => assertContainerSource("/code/StayPacks", [{ Mounts: [{ Destination: "/workspace", Source: "/code/StayPacks" }] }]));
});
