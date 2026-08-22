import { describe, expect, test } from "vite-plus/test";

describe("github-reader runtime surface", () => {
  const it = test.extend("runtimeSurface", async () =>
    Object.fromEntries(Object.entries(await import("./github-reader.ts"))));

  it("exports the canonical check buckets", ({ runtimeSurface }) => {
    expect(runtimeSurface).toStrictEqual({
      CHECK_BUCKET: {
        pass: "pass",
        fail: "fail",
        pending: "pending",
        cancel: "cancel",
        skipping: "skipping",
      },
    });
  });
});
