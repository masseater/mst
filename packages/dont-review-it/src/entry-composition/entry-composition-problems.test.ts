import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultEntryCompositionConfig } from "./config.ts";
import { entryCompositionProblems } from "./entry-composition-problems.ts";

const config = defaultEntryCompositionConfig;

const ROOT_PREFIX = "throttle --timeout 1800 -- spool -- ";

const WORKSPACE_PREFIX = "spool -- ";

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
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

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

describe("entryCompositionProblems", () => {
  test("says nothing about a repository whose entries all carry their layer prefix", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/web/package.json": `{ "scripts": { "test": "${WORKSPACE_PREFIX}vp test", "build": "${WORKSPACE_PREFIX}vp pack" } }`,
    });

    const { problems, failures } = entryCompositionProblems({ repositoryRoot, config });

    expect(problems).toStrictEqual([]);
    expect(failures).toStrictEqual([]);
  });

  test("reports the required entry that is missing from an existing scripts section", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{\n  "name": "x",\n  "scripts": {\n    "lint": "vp lint"\n  }\n}\n`,
    });

    expect(entryCompositionProblems({ repositoryRoot, config }).problems).toStrictEqual([
      {
        file: "package.json",
        line: 3,
        message: `The required "guard" script must not be missing. Add "guard" with a value that starts with "${ROOT_PREFIX}".`,
      },
    ]);
  });

  test("reports the missing scripts section apart from a missing entry", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{\n  "name": "x"\n}\n`,
    });

    expect(entryCompositionProblems({ repositoryRoot, config }).problems).toStrictEqual([
      {
        file: "package.json",
        line: null,
        message: `The scripts section holding the required "guard" entry must not be missing. Add a scripts section whose "guard" value starts with "${ROOT_PREFIX}".`,
      },
    ]);
  });

  test("reports a mismatched head with the required prefix and the actual head", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{\n  "name": "x",\n  "scripts": {\n    "guard": "vp check"\n  }\n}\n`,
    });

    expect(entryCompositionProblems({ repositoryRoot, config }).problems).toStrictEqual([
      {
        file: "package.json",
        line: 4,
        message: `The "guard" script must not start with "vp check". Rewrite the value to start with the required prefix "${ROOT_PREFIX}".`,
      },
    ]);
  });

  test("reports a value whose wrapper column is complete but reversed", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "spool -- throttle --timeout 1800 -- vp check" } }`,
    });

    const { problems } = entryCompositionProblems({ repositoryRoot, config });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('must not start with "spool -- throttle --timeout 1800');
  });

  test("says nothing about a workspace that does not declare the guarded names", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/web/package.json": `{ "scripts": { "lint": "vp lint" } }`,
    });

    expect(entryCompositionProblems({ repositoryRoot, config }).problems).toStrictEqual([]);
  });

  test("reports a declared workspace entry that lacks the workspace prefix", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/web/package.json": `{ "scripts": { "check": "vp check" } }`,
    });

    expect(entryCompositionProblems({ repositoryRoot, config }).problems).toStrictEqual([
      {
        file: "packages/web/package.json",
        line: 1,
        message: `The "check" script must not start with "vp check". Rewrite the value to start with the required prefix "${WORKSPACE_PREFIX}".`,
      },
    ]);
  });

  test("reports a workspace entry that puts the upper wrapper at its head", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/web/package.json": `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
    });

    const { problems } = entryCompositionProblems({ repositoryRoot, config });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.file).toBe("packages/web/package.json");
    expect(problems[0]?.message).toContain('must not start with "throttle "');
  });

  test("reports a script whose value is not a string as an empty head", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": 1 } }`,
    });

    const { problems } = entryCompositionProblems({ repositoryRoot, config });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('must not start with ""');
  });

  test("leaves a missing root manifest out of the enumeration and still walks the workspaces", () => {
    const repositoryRoot = repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/web/package.json": `{ "scripts": { "check": "vp check" } }`,
    });

    const { problems, failures } = entryCompositionProblems({ repositoryRoot, config });
    expect(failures).toStrictEqual([]);
    expect(problems.map((problem) => problem.file)).toStrictEqual(["packages/web/package.json"]);
  });

  test("leaves definitions outside the manifests and unmatched patterns out of its sight", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n  - docs\n  - '!ignored'\n  - .\n  - 1\n",
      "scripts/heavy.sh": "vp run -r test --coverage\n",
    });
    mkdirSync(join(repositoryRoot, "packages", "empty"), { recursive: true });

    const { problems, failures } = entryCompositionProblems({ repositoryRoot, config });

    expect(problems).toStrictEqual([]);
    expect(failures).toStrictEqual([]);
  });

  test("treats a root manifest that does not parse as a failure of the check itself", () => {
    const repositoryRoot = repositoryWith({ "package.json": "{ oops" });

    const { problems, failures } = entryCompositionProblems({ repositoryRoot, config });

    expect(problems).toStrictEqual([]);
    expect(failures).toStrictEqual([
      "package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
    ]);
  });

  test("treats an empty manifest and a non-object manifest as failures of the check itself", () => {
    const empty = entryCompositionProblems({
      repositoryRoot: repositoryWith({ "package.json": "" }),
      config,
    });
    const nonObject = entryCompositionProblems({
      repositoryRoot: repositoryWith({ "package.json": "[]" }),
      config,
    });

    expect(empty.failures).toHaveLength(1);
    expect(nonObject.failures).toHaveLength(1);
  });

  test("treats a manifest that exists but cannot be read as a failure of the check itself", () => {
    const repositoryRoot = repositoryWith({});
    mkdirSync(join(repositoryRoot, "package.json"));

    expect(entryCompositionProblems({ repositoryRoot, config }).failures).toStrictEqual([
      "package.json exists but cannot be read, so the entry composition check did not run.",
    ]);
  });

  test("treats a broken workspace manifest as a failure without silencing the other layers", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "vp check" } }`,
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/web/package.json": "{ oops",
    });

    const { problems, failures } = entryCompositionProblems({ repositoryRoot, config });
    expect(problems.map((problem) => problem.file)).toStrictEqual(["package.json"]);
    expect(failures).toStrictEqual([
      "packages/web/package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
    ]);
  });

  test("treats a workspace definition that does not parse as YAML as a failure", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      "pnpm-workspace.yaml": "packages: [\n",
    });

    expect(entryCompositionProblems({ repositoryRoot, config }).failures).toStrictEqual([
      "pnpm-workspace.yaml exists but does not parse as YAML, so the entry composition check did not run.",
    ]);
  });

  test("treats a workspace definition that cannot be read as a failure", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
    });
    mkdirSync(join(repositoryRoot, "pnpm-workspace.yaml"));

    expect(entryCompositionProblems({ repositoryRoot, config }).failures).toStrictEqual([
      "pnpm-workspace.yaml exists but cannot be read, so the entry composition check did not run.",
    ]);
  });

  test("reads a workspace definition without patterns as an empty workspace layer", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      "pnpm-workspace.yaml": "catalog: {}\n",
    });

    const { problems, failures } = entryCompositionProblems({ repositoryRoot, config });

    expect(problems).toStrictEqual([]);
    expect(failures).toStrictEqual([]);
  });
});
