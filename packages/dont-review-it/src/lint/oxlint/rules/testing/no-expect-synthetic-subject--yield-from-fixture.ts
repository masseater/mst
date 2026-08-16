import { createDontReviewItRule } from "../../../../create-rule.ts";
import { resolveBinding } from "../../lib/resolved-bindings.ts";
import { assembledShapeOf } from "../../lib/spec-syntax/assembled-values.ts";
import { isAssertionEntryCall } from "../../lib/spec-syntax/assertion-entries.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";
import { unwrapSubject } from "../../lib/spec-syntax/subject-expressions.ts";

import type { ESTree, Variable } from "@oxlint/plugins";

const boundInitialiserOf = (bound: Variable): ESTree.Expression | null =>
  bound.defs
    .flatMap((definition) =>
      definition.node.type === "VariableDeclarator" ? [definition.node.init] : [],
    )
    .find((initialiser) => initialiser !== null) ?? null;

export const noExpectSyntheticSubject = createDontReviewItRule({
  name: "no-expect-synthetic-subject--yield-from-fixture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow assembling the subject of an assertion in the assertion itself or in a binding the spec filled with a value it wrote, so a comparison pins the shape the code under test produced rather than the bag the spec packed for it",
      relatedGuidelines: [],
    },
    messages: {
      syntheticSubject:
        "The subject of an assertion must not be a value assembled inside `expect`. This one is {{shape}}. Move the value into a fixture, return it from there, and assert the binding the fixture hands over. Respelling the same value as an array literal, a template without substitutions or a `new` call is read the same way, and a type assertion, a non-null assertion or a chain modifier around it is stripped before this reading.",
      boundSyntheticSubject:
        "The subject of an assertion must not be a binding the spec filled with a value it wrote itself. `{{name}}` holds {{shape}}. Return that value from a fixture and assert the binding the fixture hands over. Splitting the value across further bindings leaves the same written-out value at the end of the chain.",
    },
    schema: [
      {
        type: "object",
        properties: {
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const syntheticSubjectOf = (
      node: ESTree.Expression,
      walked: ReadonlySet<Variable> = new Set(),
    ): { readonly boundAs: string | null; readonly shape: string } | null => {
      const written = unwrapSubject(node);
      const shape = assembledShapeOf(written);
      if (shape !== null) return { boundAs: null, shape };
      if (written.type !== "Identifier") return null;

      const bound = resolveBinding(inspection.sourceCode.getScope(written), written.name);
      if (bound === null || walked.has(bound)) return null;

      const initialiser = boundInitialiserOf(bound);
      if (initialiser === null) return null;

      const carried = syntheticSubjectOf(initialiser, new Set([...walked, bound]));
      return carried === null ? null : { boundAs: written.name, shape: carried.shape };
    };

    return {
      CallExpression(node: ESTree.CallExpression) {
        if (!isAssertionEntryCall(node)) return;

        const [handed] = node.arguments;
        if (handed === undefined || handed.type === "SpreadElement") return;

        const subject = unwrapSubject(handed);
        const synthetic = syntheticSubjectOf(subject);
        if (synthetic === null) return;

        const { boundAs, shape } = synthetic;
        inspection.report(
          boundAs === null
            ? { node: subject, messageId: "syntheticSubject", data: { shape } }
            : { node: subject, messageId: "boundSyntheticSubject", data: { name: boundAs, shape } },
        );
      },
    };
  },
});
