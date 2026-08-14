import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireSpecOrAssetsOnlyInSpecDirectory } from "./require-spec-or-assets-only-in-spec-directory--move-out-or-inline.ts";

const fixtureDir = mkdtempSync(
  join(tmpdir(), "dont-review-it-require-spec-or-assets-only-in-spec-directory-"),
);

const MODULE_SOURCE = "export const held = true;\n";

const SPEC_NAMES = "`*.test.ts`, `*.test.tsx`";

const ASSETS_NAMES = "`*.assets.*`";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const ROOT_PACKAGE_MANIFEST = '{ "name": "fixture" }\n';

mkdirSync(join(fixtureDir, "held/packages/alpha/test"), { recursive: true });
mkdirSync(join(fixtureDir, "held/packages/alpha/src"), { recursive: true });
writeFileSync(join(fixtureDir, "held/pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(fixtureDir, "held/package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
writeFileSync(
  join(fixtureDir, "held/packages/alpha/package.json"),
  '{ "name": "alpha" }\n',
  "utf8",
);
writeFileSync(join(fixtureDir, "held/packages/alpha/test/order.test.ts"), MODULE_SOURCE, "utf8");
writeFileSync(join(fixtureDir, "held/packages/alpha/test/order.assets.ts"), MODULE_SOURCE, "utf8");
const heldSource = join(fixtureDir, "held/packages/alpha/src/order.ts");
writeFileSync(heldSource, MODULE_SOURCE, "utf8");

mkdirSync(join(fixtureDir, "carved/packages/alpha/test"), { recursive: true });
mkdirSync(join(fixtureDir, "carved/packages/alpha/src"), { recursive: true });
mkdirSync(join(fixtureDir, "carved/packages/beta/src"), { recursive: true });
writeFileSync(join(fixtureDir, "carved/pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(fixtureDir, "carved/package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
writeFileSync(
  join(fixtureDir, "carved/packages/alpha/package.json"),
  '{ "name": "alpha" }\n',
  "utf8",
);
writeFileSync(join(fixtureDir, "carved/packages/alpha/test/order.test.ts"), MODULE_SOURCE, "utf8");
writeFileSync(join(fixtureDir, "carved/packages/alpha/test/helpers.ts"), MODULE_SOURCE, "utf8");
const carvedSource = join(fixtureDir, "carved/packages/alpha/src/order.ts");
writeFileSync(carvedSource, MODULE_SOURCE, "utf8");
writeFileSync(
  join(fixtureDir, "carved/packages/beta/package.json"),
  '{ "name": "beta" }\n',
  "utf8",
);
const untouchedSource = join(fixtureDir, "carved/packages/beta/src/price.ts");
writeFileSync(untouchedSource, MODULE_SOURCE, "utf8");

mkdirSync(join(fixtureDir, "nested/test/orders"), { recursive: true });
mkdirSync(join(fixtureDir, "nested/src"), { recursive: true });
writeFileSync(join(fixtureDir, "nested/pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(fixtureDir, "nested/package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
writeFileSync(join(fixtureDir, "nested/test/orders/held.ts"), MODULE_SOURCE, "utf8");
const nestedSource = join(fixtureDir, "nested/src/entry.ts");
writeFileSync(nestedSource, MODULE_SOURCE, "utf8");

mkdirSync(join(fixtureDir, "stemless/test"), { recursive: true });
mkdirSync(join(fixtureDir, "stemless/src"), { recursive: true });
writeFileSync(join(fixtureDir, "stemless/pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(fixtureDir, "stemless/package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
writeFileSync(join(fixtureDir, "stemless/test/assets.ts"), MODULE_SOURCE, "utf8");
const stemlessSource = join(fixtureDir, "stemless/src/entry.ts");
writeFileSync(stemlessSource, MODULE_SOURCE, "utf8");

mkdirSync(join(fixtureDir, "renamed/cases"), { recursive: true });
mkdirSync(join(fixtureDir, "renamed/src"), { recursive: true });
writeFileSync(join(fixtureDir, "renamed/pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(fixtureDir, "renamed/package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
writeFileSync(join(fixtureDir, "renamed/cases/order.spec.ts"), MODULE_SOURCE, "utf8");
writeFileSync(join(fixtureDir, "renamed/cases/order.data.ts"), MODULE_SOURCE, "utf8");
writeFileSync(join(fixtureDir, "renamed/cases/helpers.ts"), MODULE_SOURCE, "utf8");
const renamedSource = join(fixtureDir, "renamed/src/entry.ts");
writeFileSync(renamedSource, MODULE_SOURCE, "utf8");

mkdirSync(join(fixtureDir, "generated/build/test"), { recursive: true });
mkdirSync(join(fixtureDir, "generated/src"), { recursive: true });
writeFileSync(join(fixtureDir, "generated/pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
writeFileSync(join(fixtureDir, "generated/package.json"), ROOT_PACKAGE_MANIFEST, "utf8");
writeFileSync(join(fixtureDir, "generated/build/test/helpers.ts"), MODULE_SOURCE, "utf8");
const generatedSource = join(fixtureDir, "generated/src/entry.ts");
writeFileSync(generatedSource, MODULE_SOURCE, "utf8");

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
        documented: true,
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
        documented: true,
        code: MODULE_SOURCE,
        filename: generatedSource,
        options: [{ unscannedDirectories: ["build"] }],
      },
    ],
    invalid: [
      {
        name: "a file that is neither a spec nor test data is reported against the workspace holding it",
        documented: true,
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
        documented: true,
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
