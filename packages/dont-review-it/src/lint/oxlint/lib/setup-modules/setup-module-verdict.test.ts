import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import {
  setupModuleReachedBy,
  spelledPathOf,
  type SetupModulePolicy,
} from "./setup-module-verdict.ts";

const directoryOutsideAnyPackage = (): string => {
  const root = mkdtempSync(join(tmpdir(), "setup-modules-verdict-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
};

const policyReading = (workspaceRoot: string): SetupModulePolicy => ({
  workspaceRoot,
  namePatterns: ["*helper*"],
  allowedPackageSpecifiers: [],
  assetsNameMarkers: new Set(["assets"]),
});

describe("setup-modules/setup-module-verdict", () => {
  test("a file outside the workspace is spelled by the whole path to it", () => {
    const outside = directoryOutsideAnyPackage();

    expect(spelledPathOf({ file: join(outside, "held.ts"), workspaceRoot: "/elsewhere" })).toBe(
      join(outside, "held.ts"),
    );
  });

  test("a module belonging to no package at all is judged by its name alone", () => {
    const outside = directoryOutsideAnyPackage();
    writeFileSync(join(outside, "helpers.ts"), "export const build = () => 1;\n");

    expect(
      setupModuleReachedBy({
        specifier: "./helpers.ts",
        fromFile: join(outside, "loose.test.ts"),
        policy: policyReading("/elsewhere"),
      }),
    ).toStrictEqual({
      path: join(outside, "helpers.ts"),
      relays: [],
      reason: "forbiddenName",
    });
  });

  test("a module belonging to no package and named as nothing in particular is left undecided", () => {
    const outside = directoryOutsideAnyPackage();
    writeFileSync(join(outside, "neutral.ts"), "export const held = () => 1;\n");

    expect(
      setupModuleReachedBy({
        specifier: "./neutral.ts",
        fromFile: join(outside, "loose.test.ts"),
        policy: policyReading("/elsewhere"),
      }),
    ).toBe(null);
  });
});
