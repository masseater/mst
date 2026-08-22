import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { cacheInputFingerprint } from "./catalog-cache-fingerprint.ts";
import { listRepositoryFiles } from "./source-files.ts";

const LINKED_SOURCE_TEXT = 'export const status = "draft";\n';

describe("cacheInputFingerprint", () => {
  describe("a cache input problem beside a scan that reported none", () => {
    const it = test
      .extend("fingerprintOfAScanWithoutProblems", () => cacheInputFingerprint([]))
      .extend("fingerprintOfAnUnsafeSymbolicLinkProblem", () =>
        cacheInputFingerprint(
          [],
          [{ filePath: "src/link.ts", kind: "unsafe-symbolic-link", line: 1 }],
        ),
      );

    it("gets a different fingerprint, because problems participate in it", ({
      fingerprintOfAnUnsafeSymbolicLinkProblem,
      fingerprintOfAScanWithoutProblems,
    }) => {
      expect(fingerprintOfAnUnsafeSymbolicLinkProblem).not.toBe(fingerprintOfAScanWithoutProblems);
    });
  });

  describe("a source symlink aimed at the second of two files holding identical text", () => {
    const it = test
      .extend("fingerprintOfTheTreeAimingAtTheFirstFile", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "first.ts"), LINKED_SOURCE_TEXT, "utf8");
        writeFileSync(join(repositoryRoot, "src", "second.ts"), LINKED_SOURCE_TEXT, "utf8");
        symlinkSync("first.ts", join(repositoryRoot, "src", "public.ts"));
        return cacheInputFingerprint(listRepositoryFiles(repositoryRoot).cacheInputs);
      })
      .extend("fingerprintOfTheTreeAimingAtTheSecondFile", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "first.ts"), LINKED_SOURCE_TEXT, "utf8");
        writeFileSync(join(repositoryRoot, "src", "second.ts"), LINKED_SOURCE_TEXT, "utf8");
        symlinkSync("second.ts", join(repositoryRoot, "src", "public.ts"));
        return cacheInputFingerprint(listRepositoryFiles(repositoryRoot).cacheInputs);
      });

    it("gets a different fingerprint from the tree aimed at the first file", ({
      fingerprintOfTheTreeAimingAtTheSecondFile,
      fingerprintOfTheTreeAimingAtTheFirstFile,
    }) => {
      expect(fingerprintOfTheTreeAimingAtTheSecondFile).not.toBe(
        fingerprintOfTheTreeAimingAtTheFirstFile,
      );
    });
  });
});
