import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireSpecOrAssetsOnlyInSpecDirectory } from "./require-spec-or-assets-only-in-spec-directory--move-out-or-inline.ts";

const fixtureDir = join(tmpdir(), "dont-review-it-require-spec-or-assets-only-in-spec-directory");
rmSync(fixtureDir, { recursive: true, force: true });
mkdirSync(fixtureDir, { recursive: true });

const MODULE_SOURCE = "export const held = true;\n";

const SPEC_NAMES = "`*.test.ts`, `*.test.tsx`";

const ASSETS_NAMES = "`*.assets.*`";

const writeFixture = (name: string, source: string): string => {
  const path = join(fixtureDir, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source, "utf8");
  return path;
};

const writeRepository = (name: string): void => {
  writeFixture(`${name}/pnpm-workspace.yaml`, "packages:\n  - packages/*\n");
  writeFixture(`${name}/package.json`, '{ "name": "fixture" }\n');
};

writeRepository("held");
writeFixture("held/packages/alpha/package.json", '{ "name": "alpha" }\n');
writeFixture("held/packages/alpha/test/order.test.ts", MODULE_SOURCE);
writeFixture("held/packages/alpha/test/order.assets.ts", MODULE_SOURCE);
const heldSource = writeFixture("held/packages/alpha/src/order.ts", MODULE_SOURCE);

writeRepository("carved");
writeFixture("carved/packages/alpha/package.json", '{ "name": "alpha" }\n');
writeFixture("carved/packages/alpha/test/order.test.ts", MODULE_SOURCE);
writeFixture("carved/packages/alpha/test/helpers.ts", MODULE_SOURCE);
const carvedSource = writeFixture("carved/packages/alpha/src/order.ts", MODULE_SOURCE);
writeFixture("carved/packages/beta/package.json", '{ "name": "beta" }\n');
const untouchedSource = writeFixture("carved/packages/beta/src/price.ts", MODULE_SOURCE);

writeRepository("nested");
writeFixture("nested/test/orders/held.ts", MODULE_SOURCE);
const nestedSource = writeFixture("nested/src/entry.ts", MODULE_SOURCE);

writeRepository("stemless");
writeFixture("stemless/test/assets.ts", MODULE_SOURCE);
const stemlessSource = writeFixture("stemless/src/entry.ts", MODULE_SOURCE);

writeRepository("renamed");
writeFixture("renamed/cases/order.spec.ts", MODULE_SOURCE);
writeFixture("renamed/cases/order.data.ts", MODULE_SOURCE);
writeFixture("renamed/cases/helpers.ts", MODULE_SOURCE);
const renamedSource = writeFixture("renamed/src/entry.ts", MODULE_SOURCE);

writeRepository("generated");
writeFixture("generated/build/test/helpers.ts", MODULE_SOURCE);
const generatedSource = writeFixture("generated/src/entry.ts", MODULE_SOURCE);

const RENAMED_CONVENTION = [
  {
    specDirectoryNames: ["cases"],
    specFileSuffixes: [".spec.ts"],
    assetsNameMarkers: ["data"],
  },
];

describe("dont-review-it/require-spec-or-assets-only-in-spec-directory--move-out-or-inline", () => {
  testLintRule(requireSpecOrAssetsOnlyInSpecDirectory, {
    valid: [
      {
        name: "a spec directory holding only specs and their test data asks for nothing",
        code: MODULE_SOURCE,
        filename: heldSource,
      },
      {
        name: "a workspace apart from the one holding the carved file is left alone",
        code: MODULE_SOURCE,
        filename: untouchedSource,
      },
      {
        name: "a directory named outside the spec directory names holds what it likes",
        code: MODULE_SOURCE,
        filename: renamedSource,
      },
      {
        name: "a repository that spells its spec directory and its specs differently keeps its own spelling",
        code: MODULE_SOURCE,
        filename: heldSource,
        options: RENAMED_CONVENTION,
      },
      {
        name: "a directory declared unscanned is walked past",
        code: MODULE_SOURCE,
        filename: generatedSource,
        options: [{ unscannedDirectories: ["build"] }],
      },
    ],
    invalid: [
      {
        name: "a file that is neither a spec nor test data is reported against the workspace holding it",
        code: MODULE_SOURCE,
        filename: carvedSource,
        errors: [
          {
            messageId: "foreignFileInSpecDirectory",
            data: {
              specDirectory: "packages/alpha/test",
              foreignPath: "packages/alpha/test/helpers.ts",
              specNames: SPEC_NAMES,
              assetsNames: ASSETS_NAMES,
            },
          },
        ],
      },
      {
        name: "a file nested under a directory inside a spec directory is reported as well",
        code: MODULE_SOURCE,
        filename: nestedSource,
        errors: [
          {
            messageId: "foreignFileInSpecDirectory",
            data: {
              specDirectory: "test",
              foreignPath: "test/orders/held.ts",
              specNames: SPEC_NAMES,
              assetsNames: ASSETS_NAMES,
            },
          },
        ],
      },
      {
        name: "a file carrying the test data marker without a stem in front of it is a third kind",
        code: MODULE_SOURCE,
        filename: stemlessSource,
        errors: [
          {
            messageId: "foreignFileInSpecDirectory",
            data: {
              specDirectory: "test",
              foreignPath: "test/assets.ts",
              specNames: SPEC_NAMES,
              assetsNames: ASSETS_NAMES,
            },
          },
        ],
      },
      {
        name: "the spec directory names a repository declares decide what is walked",
        code: MODULE_SOURCE,
        filename: renamedSource,
        options: RENAMED_CONVENTION,
        errors: [
          {
            messageId: "foreignFileInSpecDirectory",
            data: {
              specDirectory: "cases",
              foreignPath: "cases/helpers.ts",
              specNames: "`*.spec.ts`",
              assetsNames: "`*.data.*`",
            },
          },
        ],
      },
      {
        name: "a directory left in the walk carries its spec directory into the report",
        code: MODULE_SOURCE,
        filename: generatedSource,
        errors: [
          {
            messageId: "foreignFileInSpecDirectory",
            data: {
              specDirectory: "build/test",
              foreignPath: "build/test/helpers.ts",
              specNames: SPEC_NAMES,
              assetsNames: ASSETS_NAMES,
            },
          },
        ],
      },
    ],
  });
});
