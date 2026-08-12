import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { ruleSourceFilesIn } from "./rule-source-files.ts";

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "rule-source-files-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  for (const [path, source] of Object.entries(files)) {
    const absolutePath = join(root, path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, source, "utf8");
  }
  return root;
};

const workspace = { workspaceDir: "packages/example", ruleDirectories: ["src/rules"] };

describe("ruleSourceFilesIn", () => {
  test("a declared directory that does not exist yields nothing", () => {
    expect(ruleSourceFilesIn({ repositoryRoot: repositoryWith({}), workspace })).toStrictEqual([]);
  });

  test("tests, type declarations, and prose are left out of the candidates", () => {
    const root = repositoryWith({
      "packages/example/src/rules/keep.ts": "",
      "packages/example/src/rules/keep.test.ts": "",
      "packages/example/src/rules/ambient.d.ts": "",
      "packages/example/src/rules/notes.md": "",
    });

    expect(ruleSourceFilesIn({ repositoryRoot: root, workspace })).toStrictEqual([
      "src/rules/keep.ts",
    ]);
  });

  test("directories holding builds, dependencies, coverage, or shared code are not walked", () => {
    const root = repositoryWith({
      "packages/example/src/rules/nested/inner.ts": "",
      "packages/example/src/rules/node_modules/vendored.ts": "",
      "packages/example/src/rules/dist/built.ts": "",
      "packages/example/src/rules/coverage/report.ts": "",
      "packages/example/src/rules/lib/shared.ts": "",
    });

    expect(ruleSourceFilesIn({ repositoryRoot: root, workspace })).toStrictEqual([
      "src/rules/nested/inner.ts",
    ]);
  });

  test("every declared directory contributes and the candidates come back sorted", () => {
    const root = repositoryWith({
      "packages/example/src/rules/zebra.ts": "",
      "packages/example/src/rules/alpha.ts": "",
      "packages/example/src/more-rules/extra.ts": "",
    });

    expect(
      ruleSourceFilesIn({
        repositoryRoot: root,
        workspace: { ...workspace, ruleDirectories: ["src/rules", "src/more-rules"] },
      }),
    ).toStrictEqual(["src/more-rules/extra.ts", "src/rules/alpha.ts", "src/rules/zebra.ts"]);
  });
});
