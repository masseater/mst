import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { UNSCANNED_DIRECTORY_NAMES } from "../repository-scan/worktree-files.ts";
import { unmetRegistrationsIn, type UnmetRegistration } from "./unmet-registrations.ts";

import type { RequiredFileEntry } from "./required-file-entries.ts";

const REASON = "the release job reads it";

const UNCHECKED_CONTENT =
  "What this file holds is read by no check, so this row asks only that it exists and holds something.";

const createRepository = (): string => {
  const root = mkdtempSync(join(tmpdir(), "unmet-registrations-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
};

const writeAt = (written: {
  readonly root: string;
  readonly relativePath: string;
  readonly held: string;
}): void => {
  const path = join(written.root, written.relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, written.held, "utf8");
};

const rowFor = (registered: Partial<RequiredFileEntry>): RequiredFileEntry => ({
  pattern: "CHANGELOG.md",
  owner: null,
  reason: REASON,
  contentChecks: [],
  ...registered,
});

const unmetIn = (asked: {
  readonly root: string;
  readonly entries: readonly RequiredFileEntry[];
}): ReadonlyMap<string, readonly UnmetRegistration[]> =>
  unmetRegistrationsIn({
    repositoryRoot: asked.root,
    entries: asked.entries,
    unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
  });

describe("unmet-registrations", () => {
  test("a registered path holding a file leaves the row met", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "CHANGELOG.md", held: "released\n" });

    expect([...unmetIn({ root, entries: [rowFor({})] })]).toStrictEqual([]);
  });

  test("a registered path with nothing at it is reported against the repository root", () => {
    const root = createRepository();

    expect(unmetIn({ root, entries: [rowFor({})] }).get(".")).toStrictEqual([
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
    ]);
  });

  test("a registered path holding an empty file is reported as unmet as well", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "CHANGELOG.md", held: "" });

    expect(unmetIn({ root, entries: [rowFor({})] }).get(".")).toStrictEqual([
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
    ]);
  });

  test("a file holding nothing but blank space holds nothing", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "CHANGELOG.md", held: "\n  \n" });

    expect(
      unmetIn({ root, entries: [rowFor({})] })
        .get(".")
        ?.at(0)?.messageId,
    ).toBe("emptyRegisteredFile");
  });

  test("one file holding something meets a pattern, whatever else the pattern matches", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "docs/lint/first.md", held: "" });
    writeAt({ root, relativePath: "docs/lint/second.md", held: "written\n" });

    expect([...unmetIn({ root, entries: [rowFor({ pattern: "docs/lint/*.md" })] })]).toStrictEqual(
      [],
    );
  });

  test("a pattern matched only by empty files reports each path it matched", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "docs/lint/first.md", held: "" });
    writeAt({ root, relativePath: "docs/lint/second.md", held: "" });

    expect(
      unmetIn({ root, entries: [rowFor({ pattern: "docs/lint/*.md" })] })
        .get(".")
        ?.map((report) => report.data.registeredPath),
    ).toStrictEqual(["docs/lint/first.md", "docs/lint/second.md"]);
  });

  test("an owner asks the registered path of every workspace it names", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "packages/alpha/package.json", held: "{}\n" });
    writeAt({ root, relativePath: "packages/alpha/README.md", held: "alpha\n" });
    writeAt({ root, relativePath: "packages/beta/package.json", held: "{}\n" });

    expect(
      unmetIn({
        root,
        entries: [rowFor({ pattern: "README.md", owner: "packages/*" })],
      }).get("packages/beta"),
    ).toStrictEqual([
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
    ]);
  });

  test("an owner that names no workspace is a stale row rather than an absence", () => {
    const root = createRepository();

    expect(
      unmetIn({ root, entries: [rowFor({ pattern: "README.md", owner: "packages/*" })] }).get("."),
    ).toStrictEqual([
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
    ]);
  });

  test("the checks registered on a row are named in what the row guarantees", () => {
    const root = createRepository();

    expect(
      unmetIn({
        root,
        entries: [rowFor({ contentChecks: ["no-lenient-coverage-threshold", "no-empty-section"] })],
      })
        .get(".")
        ?.at(0)?.data.contentGuarantee,
    ).toBe(
      "What this file holds is read by `no-lenient-coverage-threshold`, `no-empty-section`, so a file that merely exists leaves the row unmet.",
    );
  });

  test("a file that left after the walk holds nothing left to read", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "CHANGELOG.md", held: "released\n" });
    unmetIn({ root, entries: [rowFor({})] });
    rmSync(join(root, "CHANGELOG.md"));

    expect(
      unmetIn({ root, entries: [rowFor({ reason: "the tag message is copied from it" })] })
        .get(".")
        ?.at(0)?.messageId,
    ).toBe("emptyRegisteredFile");
  });

  test("the same registry is read once and answered from what was read", () => {
    const root = createRepository();
    const listedEntries = [rowFor({})];
    const read = unmetIn({ root, entries: listedEntries });

    expect(unmetIn({ root, entries: listedEntries })).toBe(read);
  });
});
