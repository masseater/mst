import { relative, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { findWorkspaceRoot } from "../../lib/canonical-values/workspace-root.ts";
import { isOutOfScopeSource } from "../../lib/out-of-scope-source.ts";
import { toPosixPath } from "../../lib/posix-path.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { ESTree } from "@oxlint/plugins";
import type {
  CellClassFinding,
  CellClassIndexLoader,
} from "../../lib/mutable-cell-classes/cell-class-index.ts";

const FIELD_SEPARATOR = ", ";

export const createNoClassAsMutableCell = ({
  loadIndex,
}: {
  readonly loadIndex: CellClassIndexLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-class-as-mutable-cell--decide-in-an-iife",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow a class whose only instance is built inside one function and never leaves it while its fields keep being written after construction, so a local mutable variable cannot be laundered into class syntax",
        relatedGuidelines: ["docs/guidelines/writing-code.md"],
      },
      messages: {
        containedMutableCell:
          "A class must not stand in for a mutable local variable. `{{className}}` writes {{fields}} after construction, its only instance is built inside `{{scope}}`, and that instance never leaves that scope. Decide the value this class stands in for inside an immediately invoked function that returns from each branch, or fold the iteration into a `reduce`. Keep a mutable boundary as a reused part that leaves this scope and hands its users a read-only face. Take this report as an instruction to write the derivation, not as a verdict on the design.",
        containedMutableCellInPlace:
          "A class must not stand in for a mutable local variable. `{{className}}` writes {{fields}} after construction, its only instance is built inside a single unnamed function, and that instance never leaves that scope. Decide the value this class stands in for inside an immediately invoked function that returns from each branch, or fold the iteration into a `reduce`. Keep a mutable boundary as a reused part that leaves this scope and hands its users a read-only face. Take this report as an instruction to write the derivation, not as a verdict on the design.",
      },
      schema: [],
    },
    create(inspection) {
      if (isOutOfScopeSource(inspection.filename)) return {};

      const findingsOf = memoize((): readonly CellClassFinding[] => {
        const repositoryRoot = findWorkspaceRoot(inspection.cwd);
        const relativePath = toPosixPath(relative(repositoryRoot, resolve(inspection.filename)));
        return loadIndex({ repositoryRoot }).findingsByPath.get(relativePath) ?? [];
      });

      return {
        ClassDeclaration(node: ESTree.Class) {
          const declared = node.id;
          if (declared === null) return;

          const finding = findingsOf().find((held) => held.className === declared.name);
          if (finding === undefined) return;

          const fields = finding.fields.map((field) => `\`${field}\``).join(FIELD_SEPARATOR);
          if (finding.scopeName === null) {
            inspection.report({
              node: declared,
              messageId: "containedMutableCellInPlace",
              data: { className: declared.name, fields },
            });
            return;
          }

          inspection.report({
            node: declared,
            messageId: "containedMutableCell",
            data: { className: declared.name, fields, scope: finding.scopeName },
          });
        },
      };
    },
  });
