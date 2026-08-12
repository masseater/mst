import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { setupModuleReachedBy, spelledPathOf } from "./setup-module-verdict.ts";

const it = test
  .extend("directoryOutsideAnyPackage", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "setup-modules-verdict-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return root;
  })
  .extend("spelledPath", ({ directoryOutsideAnyPackage }) =>
    spelledPathOf({
      file: join(directoryOutsideAnyPackage, "held.ts"),
      workspaceRoot: "/elsewhere",
    }),
  )
  .extend("verdictOnForbiddenName", ({ directoryOutsideAnyPackage }) => {
    writeFileSync(
      join(directoryOutsideAnyPackage, "helpers.ts"),
      "export const build = () => 1;\n",
    );
    return setupModuleReachedBy({
      specifier: "./helpers.ts",
      fromFile: join(directoryOutsideAnyPackage, "loose.test.ts"),
      policy: {
        workspaceRoot: "/elsewhere",
        namePatterns: ["*helper*"],
        allowedPackageSpecifiers: [],
        assetsNameMarkers: new Set(["assets"]),
      },
    });
  })
  .extend("verdictOnNeutralName", ({ directoryOutsideAnyPackage }) => {
    writeFileSync(join(directoryOutsideAnyPackage, "neutral.ts"), "export const held = () => 1;\n");
    return setupModuleReachedBy({
      specifier: "./neutral.ts",
      fromFile: join(directoryOutsideAnyPackage, "loose.test.ts"),
      policy: {
        workspaceRoot: "/elsewhere",
        namePatterns: ["*helper*"],
        allowedPackageSpecifiers: [],
        assetsNameMarkers: new Set(["assets"]),
      },
    });
  });

describe("setup-modules/setup-module-verdict", () => {
  it("a file outside the workspace is spelled by the whole path to it", ({
    spelledPath,
    directoryOutsideAnyPackage,
  }) => {
    expect(spelledPath).toBe(join(directoryOutsideAnyPackage, "held.ts"));
  });

  it("a module belonging to no package at all is judged by its name alone", ({
    verdictOnForbiddenName,
    directoryOutsideAnyPackage,
  }) => {
    expect(verdictOnForbiddenName).toStrictEqual({
      path: join(directoryOutsideAnyPackage, "helpers.ts"),
      relays: [],
      reason: "forbiddenName",
    });
  });

  it("a module belonging to no package and named as nothing in particular is left undecided", ({
    verdictOnNeutralName,
  }) => {
    expect(verdictOnNeutralName).toBe(null);
  });
});
