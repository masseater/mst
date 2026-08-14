import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noMixedPackageSurface } from "./no-mixed-package-surface--declare-one-surface.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-no-mixed-package-surface-"));

const MODULE_SOURCE = "export const shipped = true;\n";

const packagesDir = join(fixtureDir, "repo/packages");

mkdirSync(join(packagesDir, "both"), { recursive: true });
mkdirSync(join(packagesDir, "runnable"), { recursive: true });
mkdirSync(join(packagesDir, "library"), { recursive: true });
mkdirSync(join(packagesDir, "many-bins"), { recursive: true });
mkdirSync(join(packagesDir, "legacy"), { recursive: true });
mkdirSync(join(packagesDir, "nameless"), { recursive: true });
mkdirSync(join(fixtureDir, "no-manifest"), { recursive: true });

writeFileSync(join(fixtureDir, "repo/pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
writeFileSync(join(fixtureDir, "repo/package.json"), '{ "name": "@fixture/root" }\n');

writeFileSync(
  join(packagesDir, "both/package.json"),
  `${JSON.stringify(
    {
      name: "@fixture/both",
      bin: { "fixture-both": "./cli.ts" },
      exports: { ".": "./src/index.ts" },
    },
    null,
    2,
  )}\n`,
);
const bothEntry = join(packagesDir, "both/entry.ts");
writeFileSync(bothEntry, MODULE_SOURCE);

writeFileSync(
  join(packagesDir, "runnable/package.json"),
  `${JSON.stringify(
    {
      name: "@fixture/runnable",
      bin: { "fixture-runnable": "./cli.ts" },
      exports: { "./package.json": "./package.json" },
      scripts: { build: "vp pack", test: "vp test" },
    },
    null,
    2,
  )}\n`,
);
const runnableEntry = join(packagesDir, "runnable/entry.ts");
writeFileSync(runnableEntry, MODULE_SOURCE);

writeFileSync(
  join(packagesDir, "library/package.json"),
  `${JSON.stringify(
    {
      name: "@fixture/library",
      exports: { ".": "./src/index.ts", "./plugin": "./src/plugin.ts" },
    },
    null,
    2,
  )}\n`,
);
const libraryEntry = join(packagesDir, "library/entry.ts");
writeFileSync(libraryEntry, MODULE_SOURCE);

writeFileSync(
  join(packagesDir, "many-bins/package.json"),
  `${JSON.stringify(
    {
      name: "@fixture/many-bins",
      bin: { "fixture-check": "./check.ts", "fixture-report": "./report.ts" },
    },
    null,
    2,
  )}\n`,
);
const manyBinsEntry = join(packagesDir, "many-bins/entry.ts");
writeFileSync(manyBinsEntry, MODULE_SOURCE);

writeFileSync(
  join(packagesDir, "legacy/package.json"),
  `${JSON.stringify(
    {
      name: "@fixture/legacy",
      bin: "./cli.ts",
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
    },
    null,
    2,
  )}\n`,
);
const legacyEntry = join(packagesDir, "legacy/entry.ts");
writeFileSync(legacyEntry, MODULE_SOURCE);

writeFileSync(
  join(packagesDir, "nameless/package.json"),
  `${JSON.stringify({ bin: "./cli.ts", module: "./dist/index.js" }, null, 2)}\n`,
);
const namelessEntry = join(packagesDir, "nameless/entry.ts");
writeFileSync(namelessEntry, MODULE_SOURCE);

writeFileSync(join(fixtureDir, "no-manifest/pnpm-workspace.yaml"), "packages: []\n");
const looseEntry = join(fixtureDir, "no-manifest/loose.ts");
writeFileSync(looseEntry, MODULE_SOURCE);

const EXCUSED_BOTH = [
  { exceptions: [{ packageName: "@fixture/both", reason: "the split lands in the next release" }] },
];

const UNJUSTIFIED_EXCUSE = [{ exceptions: [{ packageName: "@fixture/both", reason: "  " }] }];

const EXCUSED_ELSEWHERE = [
  { exceptions: [{ packageName: "@fixture/library", reason: "a library keeps its own surface" }] },
];

const BOTH_AS_RUNNABLE = [
  { runnablePackages: [{ packageName: "@fixture/both", reason: "the pipeline invokes it" }] },
];

const BOTH_AS_IMPORTABLE = [
  { importablePackages: [{ packageName: "@fixture/both", reason: "other packages build on it" }] },
];

const LIBRARY_AS_RUNNABLE = [
  { runnablePackages: [{ packageName: "@fixture/library", reason: "it was meant to be a task" }] },
];

const MANY_BINS_AS_IMPORTABLE = [
  {
    importablePackages: [
      { packageName: "@fixture/many-bins", reason: "it was meant to be a library" },
    ],
  },
];

const RUNNABLE_AS_RUNNABLE = [
  { runnablePackages: [{ packageName: "@fixture/runnable", reason: "the pipeline runs it" }] },
];

const LIBRARY_AS_IMPORTABLE = [
  { importablePackages: [{ packageName: "@fixture/library", reason: "everything imports it" }] },
];

describe("dont-review-it/no-mixed-package-surface--declare-one-surface", () => {
  testLintRule(noMixedPackageSurface, {
    valid: [
      {
        name: "a package that declares one runnable entry and no import surface is the asked-for shape",
        code: MODULE_SOURCE,
        filename: runnableEntry,
      },
      {
        name: "a package that declares only import entries carries one surface",
        code: MODULE_SOURCE,
        filename: libraryEntry,
      },
      {
        name: "several runnable entries are still one kind of surface",
        code: MODULE_SOURCE,
        filename: manyBinsEntry,
      },
      {
        name: "task definitions are not a surface",
        code: MODULE_SOURCE,
        filename: runnableEntry,
        options: RUNNABLE_AS_RUNNABLE,
      },
      {
        name: "a package registered as importable that declares no runnable entry is left alone",
        code: MODULE_SOURCE,
        filename: libraryEntry,
        options: LIBRARY_AS_IMPORTABLE,
      },
      {
        name: "a package excused with a written reason is left alone",
        code: MODULE_SOURCE,
        filename: bothEntry,
        options: EXCUSED_BOTH,
      },
      {
        name: "a file no manifest governs belongs to no package",
        code: MODULE_SOURCE,
        filename: looseEntry,
      },
    ],
    invalid: [
      {
        name: "a manifest that declares a runnable entry and an import surface carries both",
        documented: true,
        code: MODULE_SOURCE,
        filename: bothEntry,
        errors: [
          {
            messageId: "mixedPackageSurface",
            data: {
              packageName: "@fixture/both",
              manifestPath: "packages/both/package.json",
              runnableFields: "`bin`",
              importableFields: "`exports`",
            },
          },
        ],
      },
      {
        name: "the older import entries count as the second surface too",
        code: MODULE_SOURCE,
        filename: legacyEntry,
        errors: [
          {
            messageId: "mixedPackageSurface",
            data: {
              packageName: "@fixture/legacy",
              manifestPath: "packages/legacy/package.json",
              runnableFields: "`bin`",
              importableFields: "`main`, `types`",
            },
          },
        ],
      },
      {
        name: "a package that declares no name is named by the directory it sits in",
        code: MODULE_SOURCE,
        filename: namelessEntry,
        errors: [
          {
            messageId: "mixedPackageSurface",
            data: {
              packageName: "packages/nameless",
              manifestPath: "packages/nameless/package.json",
              runnableFields: "`bin`",
              importableFields: "`module`",
            },
          },
        ],
      },
      {
        name: "an excuse without a reason excuses nothing",
        code: MODULE_SOURCE,
        filename: bothEntry,
        options: UNJUSTIFIED_EXCUSE,
        errors: [{ messageId: "mixedPackageSurface" }],
      },
      {
        name: "an excuse written for another package does not reach this one",
        code: MODULE_SOURCE,
        filename: bothEntry,
        options: EXCUSED_ELSEWHERE,
        errors: [{ messageId: "mixedPackageSurface" }],
      },
      {
        name: "a package registered as run-only is asked about its import surface first",
        code: MODULE_SOURCE,
        filename: bothEntry,
        options: BOTH_AS_RUNNABLE,
        errors: [
          {
            messageId: "importSurfaceOnRunnablePackage",
            data: {
              packageName: "@fixture/both",
              manifestPath: "packages/both/package.json",
              importableFields: "`exports`",
            },
          },
        ],
      },
      {
        name: "a package registered as run-only is reported for an import surface it declares alone",
        code: MODULE_SOURCE,
        filename: libraryEntry,
        options: LIBRARY_AS_RUNNABLE,
        errors: [
          {
            messageId: "importSurfaceOnRunnablePackage",
            data: {
              packageName: "@fixture/library",
              manifestPath: "packages/library/package.json",
              importableFields: "`exports`",
            },
          },
        ],
      },
      {
        name: "a package registered as importable is reported for the runnable entry it declares",
        code: MODULE_SOURCE,
        filename: manyBinsEntry,
        options: MANY_BINS_AS_IMPORTABLE,
        errors: [
          {
            messageId: "runnableEntryOnImportablePackage",
            data: {
              packageName: "@fixture/many-bins",
              manifestPath: "packages/many-bins/package.json",
              runnableFields: "`bin`",
            },
          },
        ],
      },
      {
        name: "a package registered as importable is reported for the runnable entry it declares beside its exports",
        code: MODULE_SOURCE,
        filename: bothEntry,
        options: BOTH_AS_IMPORTABLE,
        errors: [{ messageId: "runnableEntryOnImportablePackage" }],
      },
    ],
  });
});
