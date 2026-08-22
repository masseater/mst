import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireRegisteredFile } from "./require-registered-file--restore-it-at-the-registered-path.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-require-registered-file-"));

const MODULE_SOURCE = "export const shipped = true;\n";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const ROOT_PACKAGE_MANIFEST = '{ "name": "fixture" }\n';

const RELEASE_REASON = "the release notes are read from it";

const UNCHECKED_CONTENT =
  "What this file holds is read by no check, so this row asks only that it exists and holds something.";

const heldRepository = join(fixtureDir, "held");
mkdirSync(heldRepository, { recursive: true });
writeFileSync(join(heldRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(heldRepository, "package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
writeFileSync(
  join(heldRepository, "CHANGELOG.md"),
  "nothing a check reads, and enough to hold the row\n",
  "utf8",
);
const heldEntry = join(heldRepository, "entry.ts");
writeFileSync(heldEntry, MODULE_SOURCE, "utf8");

const absentRepository = join(fixtureDir, "absent");
mkdirSync(absentRepository, { recursive: true });
writeFileSync(join(absentRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(absentRepository, "package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
const absentEntry = join(absentRepository, "entry.ts");
writeFileSync(absentEntry, MODULE_SOURCE, "utf8");

const emptiedRepository = join(fixtureDir, "emptied");
mkdirSync(emptiedRepository, { recursive: true });
writeFileSync(join(emptiedRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(emptiedRepository, "package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
writeFileSync(join(emptiedRepository, "CHANGELOG.md"), "", "utf8");
const emptiedEntry = join(emptiedRepository, "entry.ts");
writeFileSync(emptiedEntry, MODULE_SOURCE, "utf8");

const ownedRepository = join(fixtureDir, "owned");
const alphaWorkspace = join(ownedRepository, "packages/alpha");
const betaWorkspace = join(ownedRepository, "packages/beta");
mkdirSync(alphaWorkspace, { recursive: true });
mkdirSync(betaWorkspace, { recursive: true });
writeFileSync(join(ownedRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(ownedRepository, "package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
writeFileSync(join(alphaWorkspace, "package.json"), '{ "name": "alpha" }\n', "utf8");
writeFileSync(join(alphaWorkspace, "README.md"), "what alpha publishes\n", "utf8");
writeFileSync(join(betaWorkspace, "package.json"), '{ "name": "beta" }\n', "utf8");
const alphaEntry = join(alphaWorkspace, "entry.ts");
writeFileSync(alphaEntry, MODULE_SOURCE, "utf8");
const betaEntry = join(betaWorkspace, "entry.ts");
writeFileSync(betaEntry, MODULE_SOURCE, "utf8");

const retiredRepository = join(fixtureDir, "retired");
mkdirSync(retiredRepository, { recursive: true });
writeFileSync(join(retiredRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(retiredRepository, "package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
const retiredEntry = join(retiredRepository, "entry.ts");
writeFileSync(retiredEntry, MODULE_SOURCE, "utf8");

const unregisteredRepository = join(fixtureDir, "unregistered");
mkdirSync(unregisteredRepository, { recursive: true });
writeFileSync(join(unregisteredRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(unregisteredRepository, "package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
writeFileSync(join(unregisteredRepository, "CHANGELOG.md"), "what shipped\n", "utf8");
const unregisteredEntry = join(unregisteredRepository, "entry.ts");
writeFileSync(unregisteredEntry, MODULE_SOURCE, "utf8");

const unmanagedDirectory = join(fixtureDir, "unmanaged");
mkdirSync(unmanagedDirectory, { recursive: true });
writeFileSync(join(unmanagedDirectory, "pnpm-workspace.yaml"), "packages: []\n", "utf8");
const looseEntry = join(unmanagedDirectory, "loose.ts");
writeFileSync(looseEntry, MODULE_SOURCE, "utf8");

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
