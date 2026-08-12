import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { listWorkspaces } from "./workspaces.ts";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([name, source]) => {
      const target = join(repositoryRoot, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source, "utf-8");
    }),
  );
  return repositoryRoot;
};

describe("listWorkspaces", () => {
  test("names each workspace after its package.json", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_MANIFEST,
      "packages/utils/package.json": '{ "name": "@mst/utils" }',
      "packages/other/package.json": '{ "name": "@mst/other" }',
    });
    const listed = await listWorkspaces({ repositoryRoot });
    expect(listed.workspaces.map((entry) => entry.packageName)).toStrictEqual([
      "@mst/other",
      "@mst/utils",
    ]);
  });

  test("skips a workspace directory that has no package.json", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_MANIFEST,
      "packages/utils/package.json": '{ "name": "@mst/utils" }',
      "packages/empty/notes.txt": "not a workspace",
    });
    const listed = await listWorkspaces({ repositoryRoot });
    expect(listed.workspaces.map((entry) => entry.packageName)).toStrictEqual(["@mst/utils"]);
  });

  test("reports a workspace whose package.json has no name", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_MANIFEST,
      "packages/utils/package.json": '{ "private": true }',
    });
    const listed = await listWorkspaces({ repositoryRoot });
    expect(listed.problems.map((problem) => problem.message)).toStrictEqual([
      expect.stringContaining("must not go without a name"),
    ]);
  });

  test("reports a workspace whose package.json is not a mapping", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_MANIFEST,
      "packages/utils/package.json": '["not a mapping"]',
    });
    const listed = await listWorkspaces({ repositoryRoot });
    expect(listed.problems.map((problem) => problem.message)).toStrictEqual([
      expect.stringContaining("must not go without a name"),
    ]);
  });

  test("treats the repository root as the sole workspace when no manifest exists", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
    });
    const listed = await listWorkspaces({ repositoryRoot });
    expect(listed.workspaces.map((entry) => entry.packageName)).toStrictEqual(["standalone"]);
  });

  test("lists nothing when the sole root workspace has no package.json", async () => {
    const repositoryRoot = await repositoryWith({});
    const listed = await listWorkspaces({ repositoryRoot });
    expect(listed).toStrictEqual({ workspaces: [], problems: [] });
  });

  test("reports a workspace manifest that cannot be read", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml/placeholder.txt": "the manifest path is a directory",
    });
    const listed = await listWorkspaces({ repositoryRoot });
    expect(listed.problems.map((problem) => problem.message)).toStrictEqual([
      expect.stringContaining("must not be unreadable"),
    ]);
  });

  test("lists nothing for a manifest that holds no packages list", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "catalogMode: strict\n",
      "packages/utils/package.json": '{ "name": "@mst/utils" }',
    });
    const listed = await listWorkspaces({ repositoryRoot });
    expect(listed.workspaces).toStrictEqual([]);
  });

  test("lists nothing for a manifest that is not a mapping", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "- one\n",
    });
    const listed = await listWorkspaces({ repositoryRoot });
    expect(listed.workspaces).toStrictEqual([]);
  });

  test("keeps only the string entries of the packages list", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n  - 5\n",
      "packages/utils/package.json": '{ "name": "@mst/utils" }',
    });
    const listed = await listWorkspaces({ repositoryRoot });
    expect(listed.workspaces.map((entry) => entry.packageName)).toStrictEqual(["@mst/utils"]);
  });
});
