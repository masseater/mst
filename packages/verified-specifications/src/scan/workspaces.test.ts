import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { listWorkspaces } from "./workspaces.ts";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const UNREADABLE_MANIFEST =
  "A workspace definition must not be unreadable while it exists, because a scan that silently covers fewer workspaces reports the same green as a scan that covers them all.";

const NAMELESS_PACKAGE =
  "A workspace must not go without a name in its package.json, because the generated specification list is titled with it. Name the package.";

describe("listWorkspaces", () => {
  const repositoryTest = test.extend("repositoryRoot", async ({}, { onCleanup }) => {
    const temporaryRepositoryDirectory = await mkdtemp(join(tmpdir(), "verified-specifications-"));
    onCleanup(async () => rm(temporaryRepositoryDirectory, { recursive: true, force: true }));
    return temporaryRepositoryDirectory;
  });

  describe("a manifest whose glob reaches two package directories", () => {
    const it = repositoryTest.extend("theNamesOfTwoWorkspaces", async ({ repositoryRoot }) => {
      await mkdir(join(repositoryRoot, "packages/repository-checks"), { recursive: true });
      await mkdir(join(repositoryRoot, "packages/other"), { recursive: true });
      await writeFile(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf-8");
      await writeFile(
        join(repositoryRoot, "packages/repository-checks/package.json"),
        '{ "name": "@mst/repository-checks" }',
        "utf-8",
      );
      await writeFile(
        join(repositoryRoot, "packages/other/package.json"),
        '{ "name": "@mst/other" }',
        "utf-8",
      );
      const listed = await listWorkspaces({ repositoryRoot });
      return listed.workspaces.map((listedWorkspace) => listedWorkspace.packageName);
    });

    it("names each workspace after its package.json", ({ theNamesOfTwoWorkspaces }) => {
      expect(theNamesOfTwoWorkspaces).toStrictEqual(["@mst/other", "@mst/repository-checks"]);
    });
  });

  describe("a glob that reaches a directory holding no package.json", () => {
    const it = repositoryTest.extend(
      "theNamesBesideADirectoryWithoutAManifest",
      async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks"), { recursive: true });
        await mkdir(join(repositoryRoot, "packages/empty"), { recursive: true });
        await writeFile(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf-8");
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/package.json"),
          '{ "name": "@mst/repository-checks" }',
          "utf-8",
        );
        await writeFile(
          join(repositoryRoot, "packages/empty/notes.txt"),
          "not a workspace",
          "utf-8",
        );
        const listed = await listWorkspaces({ repositoryRoot });
        return listed.workspaces.map((listedWorkspace) => listedWorkspace.packageName);
      },
    );

    it("skips that directory instead of listing it", ({
      theNamesBesideADirectoryWithoutAManifest,
    }) => {
      expect(theNamesBesideADirectoryWithoutAManifest).toStrictEqual(["@mst/repository-checks"]);
    });
  });

  describe("a workspace whose package.json carries no name", () => {
    const it = repositoryTest.extend(
      "theMessagesOfAManifestWithoutAName",
      async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks"), { recursive: true });
        await writeFile(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf-8");
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/package.json"),
          '{ "private": true }',
          "utf-8",
        );
        const listed = await listWorkspaces({ repositoryRoot });
        return listed.problems.map((problem) => problem.message);
      },
    );

    it("reports it as a workspace that must be named", ({ theMessagesOfAManifestWithoutAName }) => {
      expect(theMessagesOfAManifestWithoutAName).toStrictEqual([NAMELESS_PACKAGE]);
    });
  });

  describe("a workspace whose package.json parses into something other than a mapping", () => {
    const it = repositoryTest.extend(
      "theMessagesOfAManifestThatIsNotAMapping",
      async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks"), { recursive: true });
        await writeFile(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf-8");
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/package.json"),
          '["not a mapping"]',
          "utf-8",
        );
        const listed = await listWorkspaces({ repositoryRoot });
        return listed.problems.map((problem) => problem.message);
      },
    );

    it("reports it as a workspace that must be named", ({
      theMessagesOfAManifestThatIsNotAMapping,
    }) => {
      expect(theMessagesOfAManifestThatIsNotAMapping).toStrictEqual([NAMELESS_PACKAGE]);
    });
  });

  describe("a repository carrying no workspace manifest", () => {
    const it = repositoryTest.extend(
      "theNamesOfARepositoryWithoutAWorkspaceManifest",
      async ({ repositoryRoot }) => {
        await writeFile(join(repositoryRoot, "package.json"), '{ "name": "standalone" }', "utf-8");
        const listed = await listWorkspaces({ repositoryRoot });
        return listed.workspaces.map((listedWorkspace) => listedWorkspace.packageName);
      },
    );

    it("treats the repository root as the sole workspace", ({
      theNamesOfARepositoryWithoutAWorkspaceManifest,
    }) => {
      expect(theNamesOfARepositoryWithoutAWorkspaceManifest).toStrictEqual(["standalone"]);
    });
  });

  describe("a repository holding neither a manifest nor a package.json", () => {
    const it = repositoryTest.extend(
      "theListingOfARepositoryHoldingNothing",
      async ({ repositoryRoot }) => listWorkspaces({ repositoryRoot }),
    );

    it("lists no workspace and reports no problem", ({ theListingOfARepositoryHoldingNothing }) => {
      expect(theListingOfARepositoryHoldingNothing).toStrictEqual({ workspaces: [], problems: [] });
    });
  });

  describe("a workspace manifest path that cannot be read as a file", () => {
    const it = repositoryTest.extend(
      "theMessagesOfAnUnreadableManifest",
      async ({ repositoryRoot }) => {
        const placeholder = join(repositoryRoot, "pnpm-workspace.yaml/placeholder.txt");
        await mkdir(dirname(placeholder), { recursive: true });
        await writeFile(placeholder, "the manifest path is a directory", "utf-8");
        const listed = await listWorkspaces({ repositoryRoot });
        return listed.problems.map((problem) => problem.message);
      },
    );

    it("reports the manifest as unreadable", ({ theMessagesOfAnUnreadableManifest }) => {
      expect(theMessagesOfAnUnreadableManifest).toStrictEqual([UNREADABLE_MANIFEST]);
    });
  });

  describe("a manifest carrying no packages list", () => {
    const it = repositoryTest.extend(
      "theListingOfAManifestWithoutAPackagesList",
      async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "pnpm-workspace.yaml"),
          "catalogMode: strict\n",
          "utf-8",
        );
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/package.json"),
          '{ "name": "@mst/repository-checks" }',
          "utf-8",
        );
        return listWorkspaces({ repositoryRoot });
      },
    );

    it("lists no workspace and reports no problem", ({
      theListingOfAManifestWithoutAPackagesList,
    }) => {
      expect(theListingOfAManifestWithoutAPackagesList).toStrictEqual({
        workspaces: [],
        problems: [],
      });
    });
  });

  describe("a manifest that parses into something other than a mapping", () => {
    const it = repositoryTest.extend(
      "theListingOfAManifestThatIsNotAMapping",
      async ({ repositoryRoot }) => {
        await writeFile(join(repositoryRoot, "pnpm-workspace.yaml"), "- one\n", "utf-8");
        return listWorkspaces({ repositoryRoot });
      },
    );

    it("lists no workspace and reports no problem", ({
      theListingOfAManifestThatIsNotAMapping,
    }) => {
      expect(theListingOfAManifestThatIsNotAMapping).toStrictEqual({
        workspaces: [],
        problems: [],
      });
    });
  });

  describe("a packages list holding an entry that is not a string", () => {
    const it = repositoryTest.extend(
      "theNamesOfAPackagesListHoldingANonString",
      async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "pnpm-workspace.yaml"),
          "packages:\n  - packages/*\n  - 5\n",
          "utf-8",
        );
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/package.json"),
          '{ "name": "@mst/repository-checks" }',
          "utf-8",
        );
        const listed = await listWorkspaces({ repositoryRoot });
        return listed.workspaces.map((listedWorkspace) => listedWorkspace.packageName);
      },
    );

    it("keeps only the string entries of that list", ({
      theNamesOfAPackagesListHoldingANonString,
    }) => {
      expect(theNamesOfAPackagesListHoldingANonString).toStrictEqual(["@mst/repository-checks"]);
    });
  });
});
