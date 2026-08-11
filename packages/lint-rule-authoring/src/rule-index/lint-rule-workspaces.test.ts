import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { lintRuleWorkspacesIn } from "./lint-rule-workspaces.ts";

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  for (const [path, text] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }
  return root;
};

const declaringManifest = JSON.stringify({ name: "example", lintRules: ["src/rules"] });

describe("lintRuleWorkspacesIn", () => {
  test("a repository without a workspace definition declares nothing", () => {
    expect(lintRuleWorkspacesIn(repositoryWith({}))).toStrictEqual([]);
  });

  test("a workspace definition that is a bare scalar declares nothing", () => {
    expect(lintRuleWorkspacesIn(repositoryWith({ "pnpm-workspace.yaml": "42\n" }))).toStrictEqual(
      [],
    );
  });

  test("an empty workspace definition declares nothing", () => {
    expect(lintRuleWorkspacesIn(repositoryWith({ "pnpm-workspace.yaml": "" }))).toStrictEqual([]);
  });

  test("a workspace definition that does not parse is raised instead of being skipped", () => {
    const root = repositoryWith({ "pnpm-workspace.yaml": "packages: [packages/*\n" });

    expect(() => lintRuleWorkspacesIn(root)).toThrow(
      "pnpm-workspace.yaml exists but does not parse as YAML",
    );
  });

  test("a definition whose packages field is not a list declares nothing", () => {
    expect(
      lintRuleWorkspacesIn(repositoryWith({ "pnpm-workspace.yaml": "packages: 7\n" })),
    ).toStrictEqual([]);
  });

  test("a pattern that is not a word is left out while the others expand", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - 7\n  - packages/*\n",
      "packages/example/package.json": declaringManifest,
    });

    expect(lintRuleWorkspacesIn(root)).toStrictEqual([
      { workspaceDir: "packages/example", ruleDirectories: ["src/rules"] },
    ]);
  });

  test("a pattern naming one directory is taken as it stands", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - tools/single\n",
      "tools/single/package.json": declaringManifest,
    });

    expect(lintRuleWorkspacesIn(root)).toStrictEqual([
      { workspaceDir: "tools/single", ruleDirectories: ["src/rules"] },
    ]);
  });

  test("a pattern whose parent directory does not exist expands to nothing", () => {
    const root = repositoryWith({ "pnpm-workspace.yaml": "packages:\n  - missing/*\n" });

    expect(lintRuleWorkspacesIn(root)).toStrictEqual([]);
  });

  test("a file sitting beside the workspaces is not taken for one", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/stray.txt": "not a workspace",
      "packages/example/package.json": declaringManifest,
    });

    expect(lintRuleWorkspacesIn(root)).toStrictEqual([
      { workspaceDir: "packages/example", ruleDirectories: ["src/rules"] },
    ]);
  });

  test("a workspace without a manifest declares nothing", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/example/readme.md": "no manifest here",
    });

    expect(lintRuleWorkspacesIn(root)).toStrictEqual([]);
  });

  test("a manifest that is not an object declares nothing", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/scalar/package.json": "42",
      "packages/nothing/package.json": "null",
    });

    expect(lintRuleWorkspacesIn(root)).toStrictEqual([]);
  });

  test("a manifest that cannot be parsed is raised instead of being skipped", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/broken/package.json": "{ not json",
    });

    expect(() => lintRuleWorkspacesIn(root)).toThrow(SyntaxError);
  });

  test("a manifest without a lintRules list declares nothing", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/plain/package.json": JSON.stringify({ name: "plain" }),
      "packages/wrong/package.json": JSON.stringify({ name: "wrong", lintRules: "src/rules" }),
    });

    expect(lintRuleWorkspacesIn(root)).toStrictEqual([]);
  });

  test("entries that are not words are dropped from the declared directories", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/mixed/package.json": JSON.stringify({ lintRules: [7, "src/rules"] }),
      "packages/hollow/package.json": JSON.stringify({ lintRules: [7] }),
    });

    expect(lintRuleWorkspacesIn(root)).toStrictEqual([
      { workspaceDir: "packages/mixed", ruleDirectories: ["src/rules"] },
    ]);
  });

  test("workspaces come back sorted by their directory", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/zebra/package.json": declaringManifest,
      "packages/alpha/package.json": declaringManifest,
    });

    expect(lintRuleWorkspacesIn(root).map((workspace) => workspace.workspaceDir)).toStrictEqual([
      "packages/alpha",
      "packages/zebra",
    ]);
  });
});
