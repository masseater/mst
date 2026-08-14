import { describe, expect, test } from "vite-plus/test";

describe("github-reader runtime surface", () => {
  test("contains no runtime exports", async () => {
    expect(Object.keys(await import("./github-reader.ts"))).toStrictEqual([]);
  });
});
