import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireRegisteredFile } from "./require-registered-file--restore-it-at-the-registered-path.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-require-registered-file-"));

const MODULE_SOURCE = "export const shipped = true;\n";

const RELEASE_REASON = "the release notes are read from it";

const UNCHECKED_CONTENT =
  "What this file holds is read by no check, so this row asks only that it exists and holds something.";

const writeFixture = (fixtureName: string, source: string): string => {
  const path = join(fixtureDir, fixtureName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source, "utf8");
  return path;
};

const writeRepository = (fixtureName: string): void => {
  writeFixture(`${fixtureName}/pnpm-workspace.yaml`, "packages:\n  - packages/*\n");
  writeFixture(`${fixtureName}/package.json`, '{ "name": "fixture" }\n');
};

writeRepository("held");
writeFixture("held/CHANGELOG.md", "nothing a check reads, and enough to hold the row\n");
const heldEntry = writeFixture("held/entry.ts", MODULE_SOURCE);

writeRepository("absent");
const absentEntry = writeFixture("absent/entry.ts", MODULE_SOURCE);

writeRepository("emptied");
writeFixture("emptied/CHANGELOG.md", "");
const emptiedEntry = writeFixture("emptied/entry.ts", MODULE_SOURCE);

writeRepository("owned");
writeFixture("owned/packages/alpha/package.json", '{ "name": "alpha" }\n');
writeFixture("owned/packages/alpha/README.md", "what alpha publishes\n");
writeFixture("owned/packages/beta/package.json", '{ "name": "beta" }\n');
const alphaEntry = writeFixture("owned/packages/alpha/entry.ts", MODULE_SOURCE);
const betaEntry = writeFixture("owned/packages/beta/entry.ts", MODULE_SOURCE);

writeRepository("retired");
const retiredEntry = writeFixture("retired/entry.ts", MODULE_SOURCE);

writeRepository("unregistered");
writeFixture("unregistered/CHANGELOG.md", "what shipped\n");
const unregisteredEntry = writeFixture("unregistered/entry.ts", MODULE_SOURCE);

writeFixture("unmanaged/pnpm-workspace.yaml", "packages: []\n");
const looseEntry = writeFixture("unmanaged/loose.ts", MODULE_SOURCE);

const CHANGELOG_ROW = [{ requiredFiles: [{ pattern: "CHANGELOG.md", reason: RELEASE_REASON }] }];

const README_ROW = [
  {
    requiredFiles: [
      {
        pattern: "README.md",
        owner: "packages/*",
        reason: RELEASE_REASON,
        contentChecks: ["no-lenient-coverage-threshold"],
      },
    ],
  },
];

describe("dont-review-it/require-registered-file--restore-it-at-the-registered-path", () => {
  testLintRule(requireRegisteredFile, {
    valid: [
      {
        name: "a table that registers nothing asks for nothing",
        code: MODULE_SOURCE,
        filename: absentEntry,
      },
      {
        name: "an empty table asks for nothing",
        code: MODULE_SOURCE,
        filename: absentEntry,
        options: [{ requiredFiles: [] }],
      },
      {
        name: "a registered path holding a file leaves the row met, whatever the file holds",
        code: MODULE_SOURCE,
        filename: heldEntry,
        options: CHANGELOG_ROW,
      },
      {
        name: "a path the table does not register is not asked for, absent though it is",
        code: MODULE_SOURCE,
        filename: unregisteredEntry,
        options: CHANGELOG_ROW,
      },
      {
        name: "a workspace that holds what its owner registered is left alone",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: README_ROW,
      },
      {
        name: "a file no manifest governs belongs to no workspace",
        code: MODULE_SOURCE,
        filename: looseEntry,
        options: CHANGELOG_ROW,
      },
    ],
    invalid: [
      {
        name: "a registered path with nothing at it is reported against the repository root",
        code: MODULE_SOURCE,
        filename: absentEntry,
        options: CHANGELOG_ROW,
        errors: [
          {
            messageId: "missingRegisteredFile",
            data: {
              registeredPath: "CHANGELOG.md",
              holder: "the repository root",
              reason: RELEASE_REASON,
              contentGuarantee: UNCHECKED_CONTENT,
            },
          },
        ],
      },
      {
        name: "a registered path holding an empty file is reported as unmet as well",
        code: MODULE_SOURCE,
        filename: emptiedEntry,
        options: CHANGELOG_ROW,
        errors: [
          {
            messageId: "emptyRegisteredFile",
            data: {
              registeredPath: "CHANGELOG.md",
              holder: "the repository root",
              reason: RELEASE_REASON,
              contentGuarantee: UNCHECKED_CONTENT,
            },
          },
        ],
      },
      {
        name: "the workspace that lacks what its owner registered carries the report",
        code: MODULE_SOURCE,
        filename: betaEntry,
        options: README_ROW,
        errors: [
          {
            messageId: "missingRegisteredFile",
            data: {
              registeredPath: "packages/beta/README.md",
              holder: "`packages/beta`",
              reason: RELEASE_REASON,
              contentGuarantee:
                "What this file holds is read by `no-lenient-coverage-threshold`, so a file that merely exists leaves the row unmet.",
            },
          },
        ],
      },
      {
        name: "an owner that names no workspace is reported as a stale row",
        code: MODULE_SOURCE,
        filename: retiredEntry,
        options: README_ROW,
        errors: [
          {
            messageId: "deadOwnerRegistration",
            data: {
              registeredPath: "README.md",
              holder: "`packages/*`",
              reason: RELEASE_REASON,
            },
          },
        ],
      },
    ],
  });
});
