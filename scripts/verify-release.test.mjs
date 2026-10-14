import assert from "node:assert/strict";
import { test } from "node:test";
import { requiredRoutes, verifyReleaseRoutes } from "./verify-release.mjs";

const complete = () => Object.fromEntries(requiredRoutes.map(route => [route, `app${route}.js`]));

test("accepts a build containing the complete workspace and existing proposals", () => {
  assert.doesNotThrow(() => verifyReleaseRoutes(complete()));
});

for (const route of requiredRoutes) {
  test(`blocks a release missing ${route}`, () => {
    const manifest = complete();
    delete manifest[route];
    assert.throws(() => verifyReleaseRoutes(manifest), error => error.message.includes(route));
  });
}
