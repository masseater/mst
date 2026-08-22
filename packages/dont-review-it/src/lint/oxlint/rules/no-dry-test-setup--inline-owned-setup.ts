import { dirname, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { misplacedFixturePackages } from "../lib/setup-modules/allowlist-entries.ts";
import { constantSpecifiersIn, couplingEdgeOf } from "../lib/setup-modules/coupling-edges.ts";
import {
  setupModuleReachedBy,
  type SetupModulePolicy,
} from "../lib/setup-modules/setup-module-verdict.ts";
import { assetsNameMarkersFrom } from "../lib/spec-syntax/assets-files.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const DEFAULT_SETUP_MODULE_NAME_PATTERNS: readonly string[] = [
  "_*",
  "*fixtures*",
  "*harness*",
  "*helper*",
  "*.setup.*",
  "setup.*",
];

const configuredStrings = (
  ruleOptions: Readonly<Options>,
  named: "allowedFixturePackages" | "setupModuleNamePatterns",
): readonly string[] | null => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return null;

  const configured = first[named];
  if (!Array.isArray(configured)) return null;
  return configured.filter((candidate): candidate is string => typeof candidate === "string");
};

export const noDryTestSetup = createDontReviewItRule({
  name: "no-dry-test-setup--inline-owned-setup",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a spec file coupling to a module that its own package's public entry cannot reach or that is named as shared setup, so the setup a spec runs on stays written in the spec that runs it",
      relatedGuidelines: [],
    },
    messages: {
      setupModuleCoupling:
        "A spec file must not take its setup from another module. This file couples to `{{path}}`. Write the setup that module provides into a fixture in this file.",
      relayedSetupModuleCoupling:
        "A spec file must not take its setup from another module. This file couples to `{{path}}` through `{{relays}}`. Write the setup that module provides into a fixture in this file.",
      misplacedFixturePackage:
        "An allowed fixture package must not name anything other than a package read through that package's own public entry. `{{entry}}` is configured as one. Drop that entry and write the setup it provides into a fixture in each spec that needs it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedFixturePackages: { type: "array", items: { type: "string" } },
          assetsNameMarkers: { type: "array", items: { type: "string" } },
          setupModuleNamePatterns: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const fromFile = resolve(inspection.cwd, inspection.filename);

    const policyOf = memoize(
      (): SetupModulePolicy => ({
        workspaceRoot: findWorkspaceRoot(dirname(fromFile)),
        namePatterns:
          configuredStrings(inspection.options, "setupModuleNamePatterns") ??
          DEFAULT_SETUP_MODULE_NAME_PATTERNS,
        allowedPackageSpecifiers:
          configuredStrings(inspection.options, "allowedFixturePackages") ?? [],
        assetsNameMarkers: assetsNameMarkersFrom(inspection.options),
      }),
    );

    const constantsOf = memoize(
      (): ReadonlyMap<string, string> => constantSpecifiersIn(inspection.sourceCode.ast.body),
    );

    const reportCoupling = (node: ESTree.Node): void => {
      const edge = couplingEdgeOf(node, constantsOf());
      if (edge === null || !edge.carriesValues) return;

      const reached = setupModuleReachedBy({
        specifier: edge.specifier,
        fromFile,
        policy: policyOf(),
      });
      if (reached === null) return;
      if (reached.relays.length === 0) {
        inspection.report({ node, messageId: "setupModuleCoupling", data: { path: reached.path } });
        return;
      }
      inspection.report({
        node,
        messageId: "relayedSetupModuleCoupling",
        data: { path: reached.path, relays: reached.relays.join(", ") },
      });
    };

    return {
      Program(node: ESTree.Program) {
        const policy = policyOf();
        const misplaced = misplacedFixturePackages({
          allowed: policy.allowedPackageSpecifiers,
          fromFile,
          workspaceRoot: policy.workspaceRoot,
        });
        for (const listed of misplaced) {
          inspection.report({
            node,
            messageId: "misplacedFixturePackage",
            data: { entry: listed },
          });
        }
      },
      ImportDeclaration: reportCoupling,
      ExportNamedDeclaration: reportCoupling,
      ExportAllDeclaration: reportCoupling,
      ImportExpression: reportCoupling,
      CallExpression: reportCoupling,
    };
  },
});
