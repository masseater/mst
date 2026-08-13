import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { repositoryModuleLocation } from "./import-route-source-identity.ts";

describe("repositoryModuleLocation", () => {
  describe("a symlink standing outside the repository and pointing into it", () => {
    const it = test
      .extend("theRootHoldingAnExternalSymlink", ({}, { onCleanup }) => {
        const fixtureRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(fixtureRoot, { recursive: true, force: true });
        });
        mkdirSync(join(fixtureRoot, "repository", "src"), { recursive: true });
        writeFileSync(
          join(fixtureRoot, "repository", "src", "status.ts"),
          "export const status = 1;\n",
          "utf8",
        );
        symlinkSync(
          join(fixtureRoot, "repository", "src", "status.ts"),
          join(fixtureRoot, "status.ts"),
        );
        return fixtureRoot;
      })
      .extend("theLocationOfAnExternalSymlink", ({ theRootHoldingAnExternalSymlink }) =>
        repositoryModuleLocation({
          repositoryRoot: join(theRootHoldingAnExternalSymlink, "repository"),
          resolvedPath: join(theRootHoldingAnExternalSymlink, "status.ts"),
        }),
      );

    it("keeps the physical repository identity of the module", ({
      theRootHoldingAnExternalSymlink,
      theLocationOfAnExternalSymlink,
    }) => {
      expect(theLocationOfAnExternalSymlink).toStrictEqual({
        kind: "repository",
        path: join(
          realpathSync.native(theRootHoldingAnExternalSymlink),
          "repository",
          "src",
          "status.ts",
        ),
        sourcePaths: [
          join(
            realpathSync.native(theRootHoldingAnExternalSymlink),
            "repository",
            "src",
            "status.ts",
          ),
        ],
      });
    });
  });

  describe("a symlink standing inside the repository and pointing into it", () => {
    const it = test
      .extend("theRootHoldingALexicalSymlink", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "src", "status.ts"),
          "export const status = 1;\n",
          "utf8",
        );
        symlinkSync(join(repositoryRoot, "src", "status.ts"), join(repositoryRoot, "status.ts"));
        return repositoryRoot;
      })
      .extend("theLocationOfALexicalSymlink", ({ theRootHoldingALexicalSymlink }) =>
        repositoryModuleLocation({
          repositoryRoot: theRootHoldingALexicalSymlink,
          resolvedPath: join(theRootHoldingALexicalSymlink, "status.ts"),
        }),
      );

    it("keeps both the physical and the lexical source identity", ({
      theRootHoldingALexicalSymlink,
      theLocationOfALexicalSymlink,
    }) => {
      expect(theLocationOfALexicalSymlink).toStrictEqual({
        kind: "repository",
        path: join(realpathSync.native(theRootHoldingALexicalSymlink), "src", "status.ts"),
        sourcePaths: [
          join(realpathSync.native(theRootHoldingALexicalSymlink), "src", "status.ts"),
          join(theRootHoldingALexicalSymlink, "status.ts"),
        ],
      });
    });
  });
});
