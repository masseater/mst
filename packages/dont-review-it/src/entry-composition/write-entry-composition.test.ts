import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultEntryCompositionConfig } from "./config.ts";
import { entryCompositionProblems } from "./entry-composition-problems.ts";
import { writeEntryComposition } from "./write-entry-composition.ts";

const config = defaultEntryCompositionConfig;

const ROOT_PREFIX = "throttle --timeout 1800 -- spool -- ";

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
  onTestFinished(() => {
    rmSync(repositoryRoot, { recursive: true, force: true });
  });
  for (const [relativePath, text] of Object.entries(files)) {
    const target = join(repositoryRoot, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }
  return repositoryRoot;
};

const manifestTextIn = (repositoryRoot: string, relativePath: string): string =>
  readFileSync(join(repositoryRoot, relativePath), "utf8");

const guardValueIn = (repositoryRoot: string): unknown => {
  const parsed: unknown = JSON.parse(manifestTextIn(repositoryRoot, "package.json"));
  return (parsed as { scripts: Record<string, unknown> }).scripts.guard;
};

describe("writeEntryComposition", () => {
  test("leaves a missing required entry for the caller to define", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{\n  "scripts": {\n    "lint": "vp lint"\n  }\n}\n`,
    });
    const original = manifestTextIn(repositoryRoot, "package.json");

    expect(writeEntryComposition({ repositoryRoot, config }).failures).toStrictEqual([]);
    expect(manifestTextIn(repositoryRoot, "package.json")).toBe(original);
    expect(entryCompositionProblems({ repositoryRoot, config }).problems).toHaveLength(1);
  });

  test("leaves a missing scripts section for the caller to define", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{\n  "name": "x"\n}\n`,
    });

    writeEntryComposition({ repositoryRoot, config });

    expect(manifestTextIn(repositoryRoot, "package.json")).toBe(`{\n  "name": "x"\n}\n`);
    expect(entryCompositionProblems({ repositoryRoot, config }).problems).toHaveLength(1);
  });

  test("leaves a non-string entry for the caller to replace with an intended command", () => {
    const original = `{ "scripts": { "guard": false } }`;
    const repositoryRoot = repositoryWith({ "package.json": original });

    expect(writeEntryComposition({ repositoryRoot, config }).failures).toStrictEqual([]);
    expect(manifestTextIn(repositoryRoot, "package.json")).toBe(original);
    expect(entryCompositionProblems({ repositoryRoot, config }).problems).toHaveLength(1);
  });

  test.each(["", ROOT_PREFIX, "spool -- ", "spool --"])(
    "leaves a missing command body for the caller to define: %s",
    (guard) => {
      const original = JSON.stringify({ scripts: { guard } });
      const repositoryRoot = repositoryWith({ "package.json": original });

      expect(writeEntryComposition({ repositoryRoot, config }).failures).toStrictEqual([]);
      expect(manifestTextIn(repositoryRoot, "package.json")).toBe(original);
      expect(entryCompositionProblems({ repositoryRoot, config }).problems).toHaveLength(1);
    },
  );

  test("prepends only the missing part of the wrapper column", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "spool -- vp check" } }`,
    });

    writeEntryComposition({ repositoryRoot, config });

    expect(guardValueIn(repositoryRoot)).toBe(`${ROOT_PREFIX}vp check`);
  });

  test("removes a column element by name even when its options differ", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "throttle --timeout 900 -- spool -- vp check" } }`,
    });

    writeEntryComposition({ repositoryRoot, config });

    expect(guardValueIn(repositoryRoot)).toBe(`${ROOT_PREFIX}vp check`);
  });

  test("keeps a non-wrapper head that contains the separator and only prepends the prefix", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "vp exec tool -- --flag" } }`,
    });

    writeEntryComposition({ repositoryRoot, config });

    expect(guardValueIn(repositoryRoot)).toBe(`${ROOT_PREFIX}vp exec tool -- --flag`);
  });

  test("keeps a non-wrapper command that ends with the separator text", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "echo --" } }`,
    });

    writeEntryComposition({ repositoryRoot, config });

    expect(guardValueIn(repositoryRoot)).toBe(`${ROOT_PREFIX}echo --`);
  });

  test("normalizes a complete column whose order is reversed", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "spool -- throttle --timeout 1800 -- vp check" } }`,
    });

    writeEntryComposition({ repositoryRoot, config });

    expect(guardValueIn(repositoryRoot)).toBe(`${ROOT_PREFIX}vp check`);
  });

  test("changes nothing on the second run over what the first run repaired", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/web/package.json": `{ "scripts": { "test": "vp test" } }`,
    });

    writeEntryComposition({ repositoryRoot, config });
    const repairedRoot = manifestTextIn(repositoryRoot, "package.json");
    const repairedWorkspace = manifestTextIn(repositoryRoot, "packages/web/package.json");

    expect(writeEntryComposition({ repositoryRoot, config }).failures).toStrictEqual([]);
    expect(manifestTextIn(repositoryRoot, "package.json")).toBe(repairedRoot);
    expect(manifestTextIn(repositoryRoot, "packages/web/package.json")).toBe(repairedWorkspace);
    expect(entryCompositionProblems({ repositoryRoot, config }).problems).toStrictEqual([]);
  });

  test("rewrites a declared workspace entry to carry the workspace prefix", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/web/package.json": `{ "scripts": { "test": "vp test", "check": "spool -- vp check" } }`,
    });

    writeEntryComposition({ repositoryRoot, config });

    const parsed: unknown = JSON.parse(manifestTextIn(repositoryRoot, "packages/web/package.json"));
    expect((parsed as { scripts: Record<string, unknown> }).scripts).toStrictEqual({
      test: "spool -- vp test",
      check: "spool -- vp check",
    });
  });

  test("leaves a foreign wrapper head untouched and keeps its report", () => {
    const workspaceManifest = `{ "scripts": { "test": "throttle -- spool -- vp test" } }`;
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/web/package.json": workspaceManifest,
    });

    expect(writeEntryComposition({ repositoryRoot, config }).failures).toStrictEqual([]);
    expect(manifestTextIn(repositoryRoot, "packages/web/package.json")).toBe(workspaceManifest);
    expect(entryCompositionProblems({ repositoryRoot, config }).problems).toHaveLength(1);
  });

  test("changes nothing in a repository that already satisfies the composition", () => {
    const compliant = `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`;
    const repositoryRoot = repositoryWith({ "package.json": compliant });

    expect(writeEntryComposition({ repositoryRoot, config }).failures).toStrictEqual([]);
    expect(manifestTextIn(repositoryRoot, "package.json")).toBe(compliant);
  });

  test("returns the write failure instead of pretending the repair happened", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "vp check" } }`,
    });
    chmodSync(join(repositoryRoot, "package.json"), 0o444);

    const { failures } = writeEntryComposition({ repositoryRoot, config });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("package.json could not be rewritten");
  });

  test("passes a listing failure through without writing anything", () => {
    const repositoryRoot = repositoryWith({ "package.json": "{ oops" });

    expect(writeEntryComposition({ repositoryRoot, config }).failures).toStrictEqual([
      "package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
    ]);
    expect(manifestTextIn(repositoryRoot, "package.json")).toBe("{ oops");
  });
});
