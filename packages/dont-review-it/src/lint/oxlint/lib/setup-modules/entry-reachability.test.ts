import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { couplingEdgesOf, parsedProgramAt } from "./entry-reachability.ts";

const pathNothingWasWrittenTo = (): string => {
  const root = mkdtempSync(join(tmpdir(), "setup-modules-entry-reachability-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return join(root, "never-written.ts");
};

describe("setup-modules/entry-reachability", () => {
  test("a path holding no file parses into no program", () => {
    expect(parsedProgramAt(pathNothingWasWrittenTo())).toBe(null);
  });

  test("a path holding no file couples to nothing", () => {
    expect(couplingEdgesOf(pathNothingWasWrittenTo())).toStrictEqual([]);
  });
});
