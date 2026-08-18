import { resolve, sep } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { spellingsFrom } from "../../lib/configured-spellings.ts";
import { segmentsOf } from "../../lib/path-segments.ts";
import {
  constantSpecifiersIn,
  requestedSpecifierOf,
  staticSpecifierOf,
} from "../../lib/setup-modules/coupling-edges.ts";
import {
  carriesGrounds,
  exceptionsCovering,
  specifierExceptionsIn,
  SPECIFIER_EXCEPTION_SCHEMA,
} from "../../lib/specifier-exceptions.ts";
import {
  namesStaticallyResolvedForm,
  STATICALLY_RESOLVED_FORMS,
} from "../../lib/statically-resolved-forms.ts";

import type { ESTree, Range } from "@oxlint/plugins";

const STATICALLY_RESOLVED_FORMS_OPTION = "staticallyResolvedForms";

export const forbidUnresolvableModuleSpecifier = createDontReviewItRule({
  name: "forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a module specifier whose value is decided while the program runs, so every specifier in the source is one string the checks that read specifiers can match",
      relatedGuidelines: ["docs/guidelines/enforcement.md"],
    },
    messages: {
      unresolvableModuleSpecifier:
        "A module specifier must not be an expression decided while the program runs. `{{written}}` leaves this request unchecked against the modules this repository refuses. Write one literal specifier in each branch, or import every implementation and pick one by name from a table. Register a specifier that has to stay this way in this rule's `exceptions` option with the grounds it stays, never in a suppression comment.",
      groundlessSpecifierException:
        "A registered exception must not stand without grounds. `{{path}}` carries none. Write what decides the candidates outside this repository into that entry, or delete the entry and write specifiers the source spells out.",
    },
    schema: [
      {
        type: "object",
        properties: {
          [STATICALLY_RESOLVED_FORMS_OPTION]: { type: "array", items: { type: "string" } },
          exceptions: SPECIFIER_EXCEPTION_SCHEMA,
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const covering = exceptionsCovering({
      exceptions: specifierExceptionsIn(inspection.options),
      pathSegments: segmentsOf({
        path: resolve(inspection.cwd, inspection.filename),
        separator: sep,
      }),
      cwd: inspection.cwd,
    });
    const groundless = covering.filter((exception) => !carriesGrounds(exception));

    const reportRegistrations = (node: ESTree.Program): void => {
      for (const exception of groundless) {
        inspection.report({
          node,
          messageId: "groundlessSpecifierException",
          data: { path: exception.path },
        });
      }
    };

    if (groundless.length < covering.length) return { Program: reportRegistrations };

    const forms = spellingsFrom(inspection.options, {
      option: STATICALLY_RESOLVED_FORMS_OPTION,
      fallback: STATICALLY_RESOLVED_FORMS,
    });
    const constantsOf = memoize(
      (): ReadonlyMap<string, string> => constantSpecifiersIn(inspection.sourceCode.ast.body),
    );

    const reportRequested = (node: ESTree.Node): void => {
      const requested = requestedSpecifierOf(node);
      if (requested === null) return;

      const constants = constantsOf();
      if (staticSpecifierOf(requested, constants) !== null) return;
      if (namesStaticallyResolvedForm({ node: requested, forms, constants })) return;

      inspection.report({
        node,
        messageId: "unresolvableModuleSpecifier",
        data: { written: inspection.sourceCode.getText({ range: requested.range as Range }) },
      });
    };

    return {
      Program: reportRegistrations,
      ImportExpression: reportRequested,
      CallExpression: reportRequested,
    };
  },
});
