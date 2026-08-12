import { resolve } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { restrictedTargetReachedBy } from "./relayed-reach.ts";

const it = test
  .extend("reachOfASpecifierThatResolvesToNoFile", () =>
    restrictedTargetReachedBy({
      specifier: "./never-written-relay.ts",
      fromFile: resolve("/repository", "reader.ts"),
      policy: { workspaceRoot: resolve("/repository"), entries: [], aliases: [] },
    }))
  .extend("reachOfAPublishedPathThePackageNeverWrote", () =>
    restrictedTargetReachedBy({
      specifier: "@mst/dont-review-it/tsconfig/*",
      fromFile: resolve(import.meta.dirname, "relayed-reach.ts"),
      policy: {
        workspaceRoot: resolve(import.meta.dirname, "..", "..", "..", "..", "..", "..", ".."),
        entries: [],
        aliases: [],
      },
    }),
  );

describe("restricted-targets/relayed-reach", () => {
  it("a specifier that resolves to no file in the repository reaches no restricted target", ({
    reachOfASpecifierThatResolvesToNoFile,
  }) => {
    expect(reachOfASpecifierThatResolvesToNoFile).toBe(null);
  });

  it("a published path the package never wrote reaches no restricted target", ({
    reachOfAPublishedPathThePackageNeverWrote,
  }) => {
    expect(reachOfAPublishedPathThePackageNeverWrote).toBe(null);
  });
});
