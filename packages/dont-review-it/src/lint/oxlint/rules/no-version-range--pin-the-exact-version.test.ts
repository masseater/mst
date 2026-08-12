import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { loadCatalogEntries } from "../lib/dependency-catalog/catalog-entries.ts";
import { loadWorkspaceDependencies } from "../lib/dependency-catalog/workspace-manifests.ts";
import { createNoVersionRange } from "./no-version-range--pin-the-exact-version.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-no-version-range-"));

const MODULE_SOURCE = "export const shipped = true;\n";

const writeFixture = (spelled: string, source: string): string => {
  const path = join(fixtureDir, spelled);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
};

const writeManifest = (spelled: string, manifest: unknown): void => {
  writeFixture(`${spelled}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`);
};

writeFixture(
  "ranged/pnpm-workspace.yaml",
  "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n  typescript: 7.0.2\n",
);
writeManifest("ranged", {
  name: "root",
  devDependencies: { knip: "^6.32.0", citty: "0.2.2" },
});
writeManifest("ranged/packages/alpha", {
  name: "alpha",
  dependencies: {
    "es-toolkit": "catalog:",
    "@fixture/utils": "workspace:*",
    linked: "link:../shared-lib",
    filed: "file:../shared-lib",
    pad: "npm:left-pad@^1.0.0",
    aliased: "npm:right-pad@2.0.0",
    tagged: "latest",
    hosted: "github:owner/repo",
  },
  peerDependencies: { "peer-only": "^1.0.0" },
});
writeManifest("ranged/packages/beta", {
  name: "beta",
  dependencies: { solid: "1.9.9" },
  optionalDependencies: { opt: "~4.0.0" },
});

const rangedRootEntry = writeFixture("ranged/entry.ts", MODULE_SOURCE);
const alphaEntry = writeFixture("ranged/packages/alpha/entry.ts", MODULE_SOURCE);
const betaEntry = writeFixture("ranged/packages/beta/entry.ts", MODULE_SOURCE);

writeFixture(
  "exact/pnpm-workspace.yaml",
  "packages:\n  - packages/*\ncatalog:\n  typescript: 7.0.2\n  oxfmt: 0.61.0-beta.1\n",
);
writeManifest("exact", { name: "exact-root", devDependencies: { citty: "0.2.2" } });
writeManifest("exact/packages/one", {
  name: "one",
  dependencies: { "es-toolkit": "1.50.0", yaml: "2.9.0" },
});
const exactRootEntry = writeFixture("exact/entry.ts", MODULE_SOURCE);

writeManifest("no-definition", {
  name: "definitionless",
  workspaces: [],
  devDependencies: { citty: "0.2.2" },
});
const definitionlessEntry = writeFixture("no-definition/entry.ts", MODULE_SOURCE);

writeFixture("unparsable/pnpm-workspace.yaml", "packages: [packages/*\n");
writeManifest("unparsable", { name: "unparsable-root", devDependencies: { citty: "0.2.2" } });
const unparsableEntry = writeFixture("unparsable/entry.ts", MODULE_SOURCE);

writeFixture("manifestless/pnpm-workspace.yaml", "packages: []\n");
const manifestlessEntry = writeFixture("manifestless/loose.ts", MODULE_SOURCE);

const INTENTIONAL = [{ intentionalRanges: ["knip", "react"] }];

const noVersionRange = createNoVersionRange({
  loadWorkspaces: loadWorkspaceDependencies,
  loadCatalog: loadCatalogEntries,
});

describe("dont-review-it/no-version-range--pin-the-exact-version", () => {
  testLintRule(noVersionRange, {
    valid: [
      {
        name: "a repository whose manifests and catalog all spelled one release passes",
        code: MODULE_SOURCE,
        filename: exactRootEntry,
      },
      {
        name: "a workspace declaring references, an exact alias, a tag and a host passes",
        code: MODULE_SOURCE,
        filename: writeFixture("exact/packages/one/entry.ts", MODULE_SOURCE),
      },
      {
        name: "names registered as intentional ranges are not asked to be pinned",
        code: MODULE_SOURCE,
        filename: rangedRootEntry,
        options: INTENTIONAL,
      },
      {
        name: "a repository without a workspace definition holds no catalog to read",
        code: MODULE_SOURCE,
        filename: definitionlessEntry,
      },
      {
        name: "a workspace definition that does not parse yields no catalog entries",
        code: MODULE_SOURCE,
        filename: unparsableEntry,
      },
      {
        name: "a file no manifest governs belongs to no workspace",
        code: MODULE_SOURCE,
        filename: manifestlessEntry,
      },
    ],
    invalid: [
      {
        name: "the root workspace carries both its own ranges and the ones the catalog registers",
        code: MODULE_SOURCE,
        filename: rangedRootEntry,
        errors: [
          {
            messageId: "rangedManifestVersion",
            data: { packageName: "knip", declaredVersion: "^6.32.0", workspace: "." },
          },
          {
            messageId: "rangedCatalogVersion",
            data: { packageName: "react", declaredVersion: "^19.0.0" },
          },
        ],
      },
      {
        name: "an alias carrying a range is reported under the package it resolves to",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        errors: [
          {
            messageId: "rangedManifestVersion",
            data: {
              packageName: "left-pad",
              declaredVersion: "npm:left-pad@^1.0.0",
              workspace: "packages/alpha",
            },
          },
        ],
      },
      {
        name: "an optional dependency carries the same demand and brings no catalog report",
        code: MODULE_SOURCE,
        filename: betaEntry,
        errors: [
          {
            messageId: "rangedManifestVersion",
            data: {
              packageName: "opt",
              declaredVersion: "~4.0.0",
              workspace: "packages/beta",
            },
          },
        ],
      },
    ],
  });
});
