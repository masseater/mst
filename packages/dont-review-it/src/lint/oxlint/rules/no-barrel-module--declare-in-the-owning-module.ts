import { resolve, sep } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { reExportCarriesValues } from "../lib/carried-values.ts";
import { matchesGlobPath } from "../lib/glob-path-match.ts";
import { listedTexts } from "../lib/listed-texts.ts";
import { segmentsOf } from "../lib/path-segments.ts";
import { optionsRecord } from "../lib/rule-options.ts";

import type { ESTree, Options } from "@oxlint/plugins";

type Statement = ESTree.Program["body"][number];

const isReExport = (statement: Statement): boolean =>
  statement.type === "ExportAllDeclaration" ||
  (statement.type === "ExportNamedDeclaration" && statement.source !== null);

const forwardsValues = (statement: Statement): boolean =>
  (statement.type === "ExportAllDeclaration" || statement.type === "ExportNamedDeclaration") &&
  reExportCarriesValues(statement);

const excludedPatternsIn = (ruleOptions: Readonly<Options>): readonly string[] =>
  listedTexts(optionsRecord(ruleOptions)?.exclude);

export const noBarrelModule = createDontReviewItRule({
  name: "no-barrel-module--declare-in-the-owning-module",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a module whose every statement is a re-export and which forwards at least one value, so the module a binding is taken from is the module that declares it",
      relatedGuidelines: [],
      shipped: false,
    },
    messages: {
      barrelModule:
        "A module that carries re-exports and nothing else is forbidden. Delete it and let every importer name the module that declares the binding it takes.",
    },
    schema: [
      {
        type: "object",
        properties: { exclude: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const exclude = excludedPatternsIn(inspection.options);

    return {
      Program(node: ESTree.Program) {
        if (node.body.length === 0) return;
        if (!node.body.every(isReExport)) return;
        if (!node.body.some(forwardsValues)) return;

        const pathSegments = segmentsOf({
          path: resolve(inspection.cwd, inspection.filename),
          separator: sep,
        });
        const { cwd } = inspection;
        if (exclude.some((pattern) => matchesGlobPath({ pathSegments, pattern, cwd }))) return;

        inspection.report({ node, messageId: "barrelModule" });
      },
    };
  },
});
