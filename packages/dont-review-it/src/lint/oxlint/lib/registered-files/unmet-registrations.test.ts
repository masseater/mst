import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { UNSCANNED_DIRECTORY_NAMES } from "../repository-scan/worktree-files.ts";
import { unmetRegistrationsIn } from "./unmet-registrations.ts";

const REASON = "the release job reads it";

const UNCHECKED_CONTENT =
  "What this file holds is read by no check, so this row asks only that it exists and holds something.";

describe("unmetRegistrationsIn", () => {
  describe("a registered path holding a file", () => {
    const it = test.extend("registrationsOfAPathHoldingAFile", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "CHANGELOG.md"), "released\n", "utf8");
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it("leaves the row met", ({ registrationsOfAPathHoldingAFile }) => {
      expect(registrationsOfAPathHoldingAFile).toStrictEqual(new Map());
    });
  });

  describe("a registered path with nothing at it", () => {
    const it = test.extend("registrationsOfAPathWithNothingAtIt", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it("is reported against the repository root", ({ registrationsOfAPathWithNothingAtIt }) => {
      expect(registrationsOfAPathWithNothingAtIt).toStrictEqual(
        new Map([
          [
            ".",
            [
              {
                workspace: ".",
                messageId: "missingRegisteredFile",
                data: {
                  registeredPath: "CHANGELOG.md",
                  holder: "the repository root",
                  reason: REASON,
                  contentGuarantee: UNCHECKED_CONTENT,
                },
              },
            ],
          ],
        ]),
      );
    });
  });

  describe("a registered path holding an empty file", () => {
    const it = test.extend("registrationsOfAPathHoldingAnEmptyFile", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "CHANGELOG.md"), "", "utf8");
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it("is reported as unmet as well", ({ registrationsOfAPathHoldingAnEmptyFile }) => {
      expect(registrationsOfAPathHoldingAnEmptyFile).toStrictEqual(
        new Map([
          [
            ".",
            [
              {
                workspace: ".",
                messageId: "emptyRegisteredFile",
                data: {
                  registeredPath: "CHANGELOG.md",
                  holder: "the repository root",
                  reason: REASON,
                  contentGuarantee: UNCHECKED_CONTENT,
                },
              },
            ],
          ],
        ]),
      );
    });
  });

  describe("a registered path holding nothing but blank space", () => {
    const it = test.extend("registrationsOfAPathHoldingBlankSpace", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "CHANGELOG.md"), "\n  \n", "utf8");
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it("holds nothing", ({ registrationsOfAPathHoldingBlankSpace }) => {
      expect(registrationsOfAPathHoldingBlankSpace).toStrictEqual(
        new Map([
          [
            ".",
            [
              {
                workspace: ".",
                messageId: "emptyRegisteredFile",
                data: {
                  registeredPath: "CHANGELOG.md",
                  holder: "the repository root",
                  reason: REASON,
                  contentGuarantee: UNCHECKED_CONTENT,
                },
              },
            ],
          ],
        ]),
      );
    });
  });

  describe("a pattern one matched file holds something at", () => {
    const it = test.extend("registrationsOfAPatternOneFileHolds", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "docs", "lint"), { recursive: true });
      writeFileSync(join(root, "docs", "lint", "first.md"), "", "utf8");
      writeFileSync(join(root, "docs", "lint", "second.md"), "written\n", "utf8");
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "docs/lint/*.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it("is met, whatever else the pattern matches", ({ registrationsOfAPatternOneFileHolds }) => {
      expect(registrationsOfAPatternOneFileHolds).toStrictEqual(new Map());
    });
  });

  describe("a pattern matched only by empty files", () => {
    const it = test.extend("registrationsOfAPatternOnlyEmptyFilesMatch", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "docs", "lint"), { recursive: true });
      writeFileSync(join(root, "docs", "lint", "first.md"), "", "utf8");
      writeFileSync(join(root, "docs", "lint", "second.md"), "", "utf8");
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "docs/lint/*.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it("reports each path it matched", ({ registrationsOfAPatternOnlyEmptyFilesMatch }) => {
      expect(registrationsOfAPatternOnlyEmptyFilesMatch).toStrictEqual(
        new Map([
          [
            ".",
            [
              {
                workspace: ".",
                messageId: "emptyRegisteredFile",
                data: {
                  registeredPath: "docs/lint/first.md",
                  holder: "the repository root",
                  reason: REASON,
                  contentGuarantee: UNCHECKED_CONTENT,
                },
              },
              {
                workspace: ".",
                messageId: "emptyRegisteredFile",
                data: {
                  registeredPath: "docs/lint/second.md",
                  holder: "the repository root",
                  reason: REASON,
                  contentGuarantee: UNCHECKED_CONTENT,
                },
              },
            ],
          ],
        ]),
      );
    });
  });

  describe("an owner naming two workspaces", () => {
    const it = test.extend("registrationsOfAnOwnerNamingTwoWorkspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages", "alpha"), { recursive: true });
      writeFileSync(join(root, "packages", "alpha", "package.json"), "{}\n", "utf8");
      writeFileSync(join(root, "packages", "alpha", "README.md"), "alpha\n", "utf8");
      mkdirSync(join(root, "packages", "beta"), { recursive: true });
      writeFileSync(join(root, "packages", "beta", "package.json"), "{}\n", "utf8");
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "README.md", owner: "packages/*", reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it("asks the registered path of every workspace it names", ({
      registrationsOfAnOwnerNamingTwoWorkspaces,
    }) => {
      expect(registrationsOfAnOwnerNamingTwoWorkspaces).toStrictEqual(
        new Map([
          [
            "packages/beta",
            [
              {
                workspace: "packages/beta",
                messageId: "missingRegisteredFile",
                data: {
                  registeredPath: "packages/beta/README.md",
                  holder: "`packages/beta`",
                  reason: REASON,
                  contentGuarantee: UNCHECKED_CONTENT,
                },
              },
            ],
          ],
        ]),
      );
    });
  });

  describe("an owner that names no workspace", () => {
    const it = test.extend("registrationsOfAnOwnerNamingNoWorkspace", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "README.md", owner: "packages/*", reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it("is a stale row rather than an absence", ({ registrationsOfAnOwnerNamingNoWorkspace }) => {
      expect(registrationsOfAnOwnerNamingNoWorkspace).toStrictEqual(
        new Map([
          [
            ".",
            [
              {
                workspace: ".",
                messageId: "deadOwnerRegistration",
                data: {
                  registeredPath: "README.md",
                  holder: "`packages/*`",
                  reason: REASON,
                  contentGuarantee: UNCHECKED_CONTENT,
                },
              },
            ],
          ],
        ]),
      );
    });
  });

  describe("a row naming content checks", () => {
    const it = test.extend("registrationsOfARowNamingContentChecks", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [
          {
            pattern: "CHANGELOG.md",
            owner: null,
            reason: REASON,
            contentChecks: ["no-lenient-coverage-threshold", "no-empty-section"],
          },
        ],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it("names those checks in what the row guarantees", ({
      registrationsOfARowNamingContentChecks,
    }) => {
      expect(registrationsOfARowNamingContentChecks).toStrictEqual(
        new Map([
          [
            ".",
            [
              {
                workspace: ".",
                messageId: "missingRegisteredFile",
                data: {
                  registeredPath: "CHANGELOG.md",
                  holder: "the repository root",
                  reason: REASON,
                  contentGuarantee:
                    "What this file holds is read by `no-lenient-coverage-threshold`, `no-empty-section`, so a file that merely exists leaves the row unmet.",
                },
              },
            ],
          ],
        ]),
      );
    });
  });

  describe("a file that left after the walk", () => {
    const it = test.extend("registrationsReadAfterTheFileLeft", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "CHANGELOG.md"), "released\n", "utf8");
      unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
      rmSync(join(root, "CHANGELOG.md"));
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [
          {
            pattern: "CHANGELOG.md",
            owner: null,
            reason: "the tag message is copied from it",
            contentChecks: [],
          },
        ],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it("holds nothing left to read", ({ registrationsReadAfterTheFileLeft }) => {
      expect(registrationsReadAfterTheFileLeft).toStrictEqual(
        new Map([
          [
            ".",
            [
              {
                workspace: ".",
                messageId: "emptyRegisteredFile",
                data: {
                  registeredPath: "CHANGELOG.md",
                  holder: "the repository root",
                  reason: "the tag message is copied from it",
                  contentGuarantee: UNCHECKED_CONTENT,
                },
              },
            ],
          ],
        ]),
      );
    });
  });

  describe("the same registry read twice", () => {
    const it = test
      .extend("rootOfARegistryReadTwice", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "CHANGELOG.md"), "released\n", "utf8");
        return root;
      })
      .extend("registrationsReadFirstFromTheRegistry", ({ rootOfARegistryReadTwice }) =>
        unmetRegistrationsIn({
          repositoryRoot: rootOfARegistryReadTwice,
          entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }),
      )
      .extend("registrationsReadAgainFromTheSameRegistry", ({ rootOfARegistryReadTwice }) =>
        unmetRegistrationsIn({
          repositoryRoot: rootOfARegistryReadTwice,
          entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }),
      );

    it("is read once and answered from what was read", ({
      registrationsReadAgainFromTheSameRegistry,
      registrationsReadFirstFromTheRegistry,
    }) => {
      expect(registrationsReadAgainFromTheSameRegistry).toBe(registrationsReadFirstFromTheRegistry);
    });
  });
});
