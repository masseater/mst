import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { couplingEdgesOf, parsedProgramAt } from "./entry-reachability.ts";

const it = test
  .extend("parsedProgram", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "setup-modules-entry-reachability-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return parsedProgramAt(join(root, "never-written.ts"));
  })
  .extend("couplingEdges", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "setup-modules-entry-reachability-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return couplingEdgesOf(join(root, "never-written.ts"));
  });

describe("setup-modules/entry-reachability", () => {
  it("a path holding no file parses into no program", ({ parsedProgram }) => {
    expect(parsedProgram).toBe(null);
  });

  it("a path holding no file couples to nothing", ({ couplingEdges }) => {
    expect(couplingEdges).toStrictEqual([]);
  });
});
