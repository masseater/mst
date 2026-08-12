import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { runChecks } from "./run-checks.ts";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const SPEC_SOURCE = `describe("行の結合", () => {
  it("各要素を畳む", () => {});
});
`;

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([fileName, source]) => {
      const absolutePath = join(repositoryRoot, fileName);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, source, "utf-8");
    }),
  );
  return repositoryRoot;
};

const utilsRepository = async (extraFiles: Readonly<Record<string, string>>): Promise<string> =>
  repositoryWith({
    "pnpm-workspace.yaml": WORKSPACE_MANIFEST,
    "packages/repository-checks/package.json": '{ "name": "@mst/repository-checks" }',
    ...extraFiles,
  });

describe("runChecks", () => {
  test("reports a missing specification list", async () => {
    const repositoryRoot = await utilsRepository({
      "packages/repository-checks/specs/text-joining.spec.ts": SPEC_SOURCE,
    });
    const problems = await runChecks({ repositoryRoot, write: false });
    expect(problems.map((problem) => problem.message)).toStrictEqual([
      expect.stringContaining("must not fall behind"),
    ]);
  });

  test("writes the specification list when asked to", async () => {
    const repositoryRoot = await utilsRepository({
      "packages/repository-checks/specs/text-joining.spec.ts": SPEC_SOURCE,
    });
    await expect(runChecks({ repositoryRoot, write: true })).resolves.toStrictEqual([]);
    const written = await readFile(
      join(repositoryRoot, "packages/repository-checks/SPECIFICATIONS.md"),
      "utf-8",
    );
    expect(written).toContain("## 行の結合");
  });

  test("accepts a list that matches the tests", async () => {
    const repositoryRoot = await utilsRepository({
      "packages/repository-checks/specs/text-joining.spec.ts": SPEC_SOURCE,
    });
    await runChecks({ repositoryRoot, write: true });
    await expect(runChecks({ repositoryRoot, write: false })).resolves.toStrictEqual([]);
  });

  test("reports a stale list without touching it", async () => {
    const repositoryRoot = await utilsRepository({
      "packages/repository-checks/specs/text-joining.spec.ts": SPEC_SOURCE,
      "packages/repository-checks/SPECIFICATIONS.md": "# stale\n",
    });
    const problems = await runChecks({ repositoryRoot, write: false });
    expect(problems.map((problem) => problem.message)).toStrictEqual([
      expect.stringContaining("must not fall behind"),
    ]);
    const untouched = await readFile(
      join(repositoryRoot, "packages/repository-checks/SPECIFICATIONS.md"),
      "utf-8",
    );
    expect(untouched).toBe("# stale\n");
  });

  test("reports a list that outlived its tests", async () => {
    const repositoryRoot = await utilsRepository({
      "packages/repository-checks/SPECIFICATIONS.md": "# orphan\n",
    });
    const problems = await runChecks({ repositoryRoot, write: false });
    expect(problems.map((problem) => problem.message)).toStrictEqual([
      expect.stringContaining("must not outlive"),
    ]);
  });

  test("deletes an outlived list when asked to write", async () => {
    const repositoryRoot = await utilsRepository({
      "packages/repository-checks/SPECIFICATIONS.md": "# orphan\n",
    });
    await expect(runChecks({ repositoryRoot, write: true })).resolves.toStrictEqual([]);
    await expect(
      stat(join(repositoryRoot, "packages/repository-checks/SPECIFICATIONS.md")),
    ).rejects.toThrow("ENOENT");
  });

  test("stays silent for a workspace with neither tests nor list", async () => {
    const repositoryRoot = await utilsRepository({});
    await expect(runChecks({ repositoryRoot, write: false })).resolves.toStrictEqual([]);
  });

  test("reports the structure of a spec file before the state of the list", async () => {
    const repositoryRoot = await utilsRepository({
      "packages/repository-checks/specs/text-joining.spec.ts": "describe('s', () => {});\n",
    });
    const problems = await runChecks({ repositoryRoot, write: false });
    expect(problems.map((problem) => problem.message)).toStrictEqual([
      expect.stringContaining("must not stand without claims"),
    ]);
  });

  test("reports a tsconfig that narrows the program alongside spec problems", async () => {
    const repositoryRoot = await utilsRepository({
      "packages/repository-checks/specs/text-joining.spec.ts": SPEC_SOURCE,
      "packages/repository-checks/tsconfig.json": '{ "include": ["src"] }',
    });
    await runChecks({ repositoryRoot, write: true });
    const problems = await runChecks({ repositoryRoot, write: false });
    expect(problems.map((problem) => problem.message)).toStrictEqual([
      expect.stringContaining("must not narrow the files"),
    ]);
  });

  test("keeps the problems of every workspace sorted by file", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_MANIFEST,
      "packages/b-utils/package.json": '{ "name": "@mst/b-utils" }',
      "packages/b-utils/specs/one.spec.ts": SPEC_SOURCE,
      "packages/a-utils/package.json": '{ "name": "@mst/a-utils" }',
      "packages/a-utils/specs/one.spec.ts": SPEC_SOURCE,
    });
    const problems = await runChecks({ repositoryRoot, write: false });
    expect(problems.map((problem) => problem.file)).toStrictEqual([
      "packages/a-utils/SPECIFICATIONS.md",
      "packages/b-utils/SPECIFICATIONS.md",
    ]);
  });

  test("keeps problems without a line ahead of nothing in their file", async () => {
    const repositoryRoot = await utilsRepository({
      "packages/repository-checks/specs/text-joining.spec.ts": SPEC_SOURCE,
      "packages/repository-checks/tsconfig.json":
        '{ "include": ["src"], "files": ["src/index.ts"] }',
    });
    await runChecks({ repositoryRoot, write: true });
    const problems = await runChecks({ repositoryRoot, write: false });
    expect(problems.map((problem) => problem.line)).toStrictEqual([null, null]);
  });

  test("orders problems in one file by line", async () => {
    const repositoryRoot = await utilsRepository({
      "packages/repository-checks/specs/text-joining.spec.ts":
        "describe('s', () => {\n  test('a', () => {});\n  test('b', () => {});\n});\n",
    });
    const problems = await runChecks({ repositoryRoot, write: false });
    expect(problems.map((problem) => problem.line)).toStrictEqual([2, 3]);
  });
});
