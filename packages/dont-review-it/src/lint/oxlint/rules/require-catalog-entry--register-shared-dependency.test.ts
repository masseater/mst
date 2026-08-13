import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { loadWorkspaceDependencies } from "../lib/dependency-catalog/workspace-manifests.ts";
import { createRequireCatalogEntry } from "./require-catalog-entry--register-shared-dependency.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-require-catalog-entry-"));

const MODULE_SOURCE = "export const shipped = true;\n";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const sharedDir = join(fixtureDir, "shared");
const aliasedDir = join(fixtureDir, "aliased");

mkdirSync(join(sharedDir, "packages/alpha"), { recursive: true });
mkdirSync(join(sharedDir, "packages/beta"), { recursive: true });
mkdirSync(join(sharedDir, "packages/gamma"), { recursive: true });
mkdirSync(join(aliasedDir, "packages/one"), { recursive: true });
mkdirSync(join(aliasedDir, "packages/two"), { recursive: true });
mkdirSync(join(aliasedDir, "sectionless"), { recursive: true });
mkdirSync(join(aliasedDir, "manifestless"), { recursive: true });
mkdirSync(join(fixtureDir, "no-manifest"), { recursive: true });

writeFileSync(join(sharedDir, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(
  join(sharedDir, "package.json"),
  `${JSON.stringify({ name: "root", devDependencies: { "left-pad": "^1.0.0" } }, null, 2)}\n`,
);
writeFileSync(
  join(sharedDir, "packages/alpha/package.json"),
  `${JSON.stringify(
    {
      name: "alpha",
      dependencies: {
        "es-toolkit": "catalog:",
        "@fixture/utils": "workspace:*",
        linked: "link:../shared-lib",
        filed: "file:../shared-lib",
        "left-pad": "^1.0.0",
        "only-here": "^2.0.0",
      },
      peerDependencies: { "peer-only": "^1.0.0" },
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  join(sharedDir, "packages/beta/package.json"),
  `${JSON.stringify(
    {
      name: "beta",
      dependencies: {
        "@fixture/utils": "workspace:*",
        linked: "link:../shared-lib",
        filed: "file:../shared-lib",
      },
      devDependencies: { "left-pad": "1.3.0" },
      peerDependencies: { "peer-only": "^1.0.0" },
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  join(sharedDir, "packages/gamma/package.json"),
  `${JSON.stringify({ name: "gamma", dependencies: { "es-toolkit": "catalog:" } }, null, 2)}\n`,
);

const rootEntry = join(sharedDir, "entry.ts");
writeFileSync(rootEntry, MODULE_SOURCE);
const alphaEntry = join(sharedDir, "packages/alpha/entry.ts");
writeFileSync(alphaEntry, MODULE_SOURCE);
const betaEntry = join(sharedDir, "packages/beta/entry.ts");
writeFileSync(betaEntry, MODULE_SOURCE);
const gammaEntry = join(sharedDir, "packages/gamma/entry.ts");
writeFileSync(gammaEntry, MODULE_SOURCE);
mkdirSync(join(sharedDir, "packages/gamma/nested"), { recursive: true });
const nestedGammaEntry = join(sharedDir, "packages/gamma/nested/deep.ts");
writeFileSync(nestedGammaEntry, MODULE_SOURCE);

writeFileSync(join(aliasedDir, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(
  join(aliasedDir, "package.json"),
  `${JSON.stringify({ name: "aliased-root" }, null, 2)}\n`,
);
writeFileSync(
  join(aliasedDir, "packages/one/package.json"),
  `${JSON.stringify(
    {
      name: "one",
      dependencies: {
        pad: "npm:left-pad@^1.0.0",
        scoped: "npm:@fixture/tool",
        broken: "npm:",
        count: 5,
      },
      optionalDependencies: { "opt-shared": "^4.0.0" },
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  join(aliasedDir, "packages/two/package.json"),
  `${JSON.stringify(
    {
      name: "two",
      dependencies: { "left-pad": "^1.0.0", "@fixture/tool": "^3.0.0" },
      devDependencies: { "left-pad": "^9.9.9" },
      optionalDependencies: { "opt-shared": "4.1.0" },
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  join(aliasedDir, "sectionless/package.json"),
  `${JSON.stringify({ name: "sectionless", dependencies: "oops" }, null, 2)}\n`,
);
writeFileSync(join(aliasedDir, "manifestless/package.json"), "[]\n");

const oneEntry = join(aliasedDir, "packages/one/entry.ts");
writeFileSync(oneEntry, MODULE_SOURCE);
const twoEntry = join(aliasedDir, "packages/two/entry.ts");
writeFileSync(twoEntry, MODULE_SOURCE);

writeFileSync(join(fixtureDir, "no-manifest/pnpm-workspace.yaml"), "packages: []\n");
const looseEntry = join(fixtureDir, "no-manifest/loose.ts");
writeFileSync(looseEntry, MODULE_SOURCE);

const CATALOG = [{ catalog: ["es-toolkit"] }];

const LEFT_PAD_SITES = "`.` at `^1.0.0`, `packages/alpha` at `^1.0.0`, `packages/beta` at `1.3.0`";

const ALIASED_TOOL_SITES = "`packages/one` at `npm:@fixture/tool`, `packages/two` at `^3.0.0`";

const ALIASED_LEFT_PAD_SITES =
  "`packages/one` at `npm:left-pad@^1.0.0`, `packages/two` at `^1.0.0`";

const OPTIONAL_SITES = "`packages/one` at `^4.0.0`, `packages/two` at `4.1.0`";

const requireCatalogEntry = createRequireCatalogEntry({
  loadWorkspaces: loadWorkspaceDependencies,
});

describe("dont-review-it/require-catalog-entry--register-shared-dependency", () => {
  testLintRule(requireCatalogEntry, {
    valid: [
      {
        name: "without a catalog the rule holds no answer about what is registered",
        code: MODULE_SOURCE,
        filename: alphaEntry,
      },
      {
        name: "options that carry deviations but no catalog leave the rule without a catalog",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: [{ deviations: [] }],
      },
      {
        name: "an empty catalog registers nothing and compares against nothing",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: [{ catalog: [] }],
      },
      {
        name: "a workspace whose every dependency is registered passes",
        code: MODULE_SOURCE,
        filename: gammaEntry,
        options: CATALOG,
      },
      {
        name: "a package the catalog registers is left to the rule on catalog references",
        code: MODULE_SOURCE,
        filename: nestedGammaEntry,
        options: CATALOG,
      },
      {
        name: "a name registered as a deviation for this workspace is not asked for again",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: [
          {
            catalog: ["es-toolkit"],
            deviations: [{ workspace: "packages/alpha", packages: ["left-pad"] }],
          },
        ],
      },
      {
        name: "a file no manifest governs belongs to no workspace",
        code: MODULE_SOURCE,
        filename: looseEntry,
        options: CATALOG,
      },
    ],
    invalid: [
      {
        name: "a name shared with two other workspaces is reported in the root workspace",
        code: MODULE_SOURCE,
        filename: rootEntry,
        options: CATALOG,
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: LEFT_PAD_SITES },
          },
        ],
      },
      {
        name: "the same name is reported again in the workspace that shares it",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: CATALOG,
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: LEFT_PAD_SITES },
          },
        ],
      },
      {
        name: "a development dependency counts as a workspace declaring the name",
        code: MODULE_SOURCE,
        filename: betaEntry,
        options: CATALOG,
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: LEFT_PAD_SITES },
          },
        ],
      },
      {
        name: "a deviation registered for another workspace does not cover this one",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: [
          {
            catalog: ["es-toolkit"],
            deviations: [{ workspace: "packages/beta", packages: ["left-pad"] }],
          },
        ],
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: LEFT_PAD_SITES },
          },
        ],
      },
      {
        name: "an alias is counted under the package it resolves to",
        code: MODULE_SOURCE,
        filename: oneEntry,
        options: CATALOG,
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "@fixture/tool", sites: ALIASED_TOOL_SITES },
          },
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: ALIASED_LEFT_PAD_SITES },
          },
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "opt-shared", sites: OPTIONAL_SITES },
          },
        ],
      },
      {
        name: "the workspace on the other side of the alias carries the version it declared once",
        code: MODULE_SOURCE,
        filename: twoEntry,
        options: CATALOG,
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "@fixture/tool", sites: ALIASED_TOOL_SITES },
          },
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: ALIASED_LEFT_PAD_SITES },
          },
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "opt-shared", sites: OPTIONAL_SITES },
          },
        ],
      },
    ],
  });
});
