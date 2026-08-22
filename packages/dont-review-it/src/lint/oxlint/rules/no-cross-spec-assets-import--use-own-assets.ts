import { dirname, relative, resolve } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { toPosixPath } from "../lib/posix-path.ts";
import { constantSpecifiersIn, couplingEdgeOf } from "../lib/setup-modules/coupling-edges.ts";
import { assetsNameMarkersFrom, assetsStemOf } from "../lib/spec-syntax/assets-files.ts";
import { assetsReachedBy } from "../lib/spec-syntax/reached-assets.ts";
import { specFileSuffixesFrom, specStemOf } from "../lib/spec-syntax/spec-files.ts";

import type { ESTree } from "@oxlint/plugins";

export const noCrossSpecAssetsImport = createDontReviewItRule({
  name: "no-cross-spec-assets-import--use-own-assets",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reading a test data file from anywhere but the spec of its own stem in its own directory, so the one spec that owns the data can rewrite it without silently changing what another file expects",
      relatedGuidelines: [],
    },
    messages: {
      crossSpecAssetsImport:
        "A spec must not read the test data file of another spec. `{{specifier}}` reaches `{{assetsPath}}`. Create a test data file of the stem `{{ownStem}}` beside this spec and write the values this spec needs into it.",
      foreignAssetsImport:
        "A file that owns no test data file must not read one. `{{specifier}}` reaches `{{assetsPath}}`. Move the values this file needs into a module of its own and read them from there.",
    },
    schema: [
      {
        type: "object",
        properties: {
          assetsNameMarkers: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const readerPath = resolve(inspection.cwd, inspection.filename);
    const markers = assetsNameMarkersFrom(inspection.options);
    if (assetsStemOf(readerPath, markers) !== null) return {};

    const readerStem = specStemOf(readerPath, specFileSuffixesFrom(inspection.options));
    const workspaceRoot = findWorkspaceRoot(dirname(readerPath));

    const isOwnedByReader = (assetsPath: string): boolean =>
      readerStem !== null &&
      readerStem === assetsStemOf(assetsPath, markers) &&
      dirname(assetsPath) === dirname(readerPath);

    const reportEdge = (node: ESTree.Node, specifier: string): void => {
      const assetsPath = assetsReachedBy({
        specifier,
        fromFile: readerPath,
        workspaceRoot,
        markers,
      });
      if (assetsPath === null || isOwnedByReader(assetsPath)) return;

      const reached = {
        specifier,
        assetsPath: toPosixPath(relative(workspaceRoot, assetsPath)),
      };
      if (readerStem === null) {
        inspection.report({ node, messageId: "foreignAssetsImport", data: reached });
        return;
      }
      inspection.report({
        node,
        messageId: "crossSpecAssetsImport",
        data: { ...reached, ownStem: readerStem },
      });
    };

    const inspectCoupling = (node: ESTree.Node, constants: ReadonlyMap<string, string>): void => {
      const edge = couplingEdgeOf(node, constants);
      if (edge !== null) reportEdge(node, edge.specifier);
    };

    return {
      "Program:exit"(program: ESTree.Program) {
        const constants = constantSpecifiersIn(program.body);
        const coupled: readonly ESTree.Node[] = [
          ...nodesOfType(program, "ImportDeclaration"),
          ...nodesOfType(program, "ExportNamedDeclaration"),
          ...nodesOfType(program, "ExportAllDeclaration"),
          ...nodesOfType(program, "ImportExpression"),
          ...nodesOfType(program, "CallExpression"),
        ];

        for (const node of coupled) inspectCoupling(node, constants);
      },
    };
  },
});
