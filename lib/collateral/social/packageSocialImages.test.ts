import { expect, it } from "vitest";
import { unzipSync } from "fflate";
import { packageSocialImages } from "./packageSocialImages";

it("bundles all formats into one ZIP without altering the image bytes", async () => {
  const { blob, filename } = await packageSocialImages("1/102 Brighton Boulevard", new Map([
    ["square", new Blob([new Uint8Array([1, 2, 3])])],
    ["wide", new Blob([new Uint8Array([4, 5])])],
    ["story", new Blob([new Uint8Array([6])])],
  ]));
  expect(filename).toBe("1_102 Brighton Boulevard-social-media.zip");
  expect(blob.type).toBe("application/zip");
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  expect(Object.keys(files)).toHaveLength(3);
  expect([...files["1_102 Brighton Boulevard-square.png"]]).toEqual([1, 2, 3]);
  expect([...files["1_102 Brighton Boulevard-wide.png"]]).toEqual([4, 5]);
  expect([...files["1_102 Brighton Boulevard-story.png"]]).toEqual([6]);
});
it("keeps a single format as a PNG", async () => {
  const png = new Blob(["png"], { type: "image/png" });
  expect(await packageSocialImages("Property", new Map([["square", png]]))).toEqual({ blob: png, filename: "Property-square.png" });
});
