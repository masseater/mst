import { createDontReviewItRule } from "../../../../create-rule.ts";
import { isAssertionEntryCall } from "../../lib/spec-syntax/assertion-entries.ts";
import { CALL_CONTRACT_MATCHERS } from "../../lib/spec-syntax/matcher-vocabulary.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";
import { staticMemberName } from "../../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../../lib/spec-syntax/subject-expressions.ts";

import type { Definition, ESTree, Scope, Variable } from "@oxlint/plugins";

const PRODUCED_SUBJECT_FORMS: ReadonlyMap<string, string> = new Map([
  ["CallExpression", "calling a function"],
  ["NewExpression", "running a constructor"],
  ["TaggedTemplateExpression", "running a template tag"],
]);

type AssertedSubject = {
  readonly matcher: string;
  readonly subject: ESTree.Expression;
};

const chainRootOf = (node: ESTree.Expression): ESTree.Expression => {
  const written = unwrapSubject(node);
  return written.type === "MemberExpression" ? chainRootOf(written.object) : written;
};

const assertedSubjectOf = (node: ESTree.CallExpression): AssertedSubject | null => {
  const callee = unwrapSubject(node.callee);
  if (callee.type !== "MemberExpression") return null;

  const matcher = staticMemberName(callee);
  if (matcher === null) return null;

  const listed = chainRootOf(callee.object);
  if (listed.type !== "CallExpression" || !isAssertionEntryCall(listed)) return null;

  const [handed] = listed.arguments;
  if (handed === undefined || handed.type === "SpreadElement") return null;
  return { matcher, subject: unwrapSubject(handed) };
};

const annotatedParameterCount = (definition: Definition): number | null => {
  const annotation = definition.name.typeAnnotation;
  if (annotation === null || annotation === undefined) return null;

  const declared = annotation.typeAnnotation;
  return declared.type === "TSFunctionType" ? declared.params.length : null;
};

const writtenParameterCount = (definition: Definition): number | null => {
  const { node } = definition;
  if (node.type === "FunctionDeclaration") return node.params.length;
  if (node.type !== "VariableDeclarator" || node.init === null) return null;

  const written = unwrapSubject(node.init);
  if (written.type === "ArrowFunctionExpression") return written.params.length;
  return written.type === "FunctionExpression" ? written.params.length : null;
};

const VISIBLE_DECLARATIONS: ReadonlySet<string> = new Set(["FunctionName", "Variable"]);

const declaresParameters = (definition: Definition): boolean => {
  if (!VISIBLE_DECLARATIONS.has(definition.type)) return false;

  const annotated = annotatedParameterCount(definition);
  if (annotated !== null) return annotated > 0;

  const written = writtenParameterCount(definition);
  return written !== null && written > 0;
};

const bindingOf = (scope: Scope | null, spelled: string): Variable | null =>
  scope === null ? null : (scope.set.get(spelled) ?? bindingOf(scope.upper, spelled));

const hidesArguments = (
  { matcher, subject }: AssertedSubject,
  scopeAt: (node: ESTree.Node) => Scope,
): boolean => {
  if (subject.type !== "Identifier") return false;
  if (CALL_CONTRACT_MATCHERS.has(matcher)) return false;
  return bindingOf(scopeAt(subject), subject.name)?.defs.some(declaresParameters) ?? false;
};

export const noExpectCallExpression = createDontReviewItRule({
  name: "no-expect-call-expression--yield-from-fixture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow producing the subject of an assertion inside `expect`, so an assertion states a property of a value the fixture handed over rather than the outcome of an expression the assertion itself runs",
      relatedGuidelines: [],
    },
    messages: {
      producedSubject:
        "The value handed to `expect` must not be produced inside the assertion. This one is {{production}}. Move the production into the fixture, return the value from there, and write the assertion against that binding. Give a thrown-message assertion a thunk that takes no arguments, handed back by the same fixture. Lifting the production into a statement at the top of the `it` lands on `require-it-only-expect--move-setup-into-fixture`. Wrapping it in a type assertion, a non-null assertion, parentheses or `await` is stripped before this reading, and respelling it as `new` or as a tagged template is read the same way.",
      argumentTakingSubject:
        "A callable handed to `expect` must not declare parameters. `{{subject}}` declares them, and the matcher calls it inside the assertion with whatever was bound into it. Move the values the call needs into the fixture, return a thunk that takes no arguments, and give that binding to the matcher. Binding the arguments into another callable first leaves the same call standing behind another spelled.",
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

    const scopeAt = (node: ESTree.Node): Scope => inspection.sourceCode.getScope(node);

    return {
      CallExpression(node: ESTree.CallExpression) {
        const asserted = assertedSubjectOf(node);
        if (asserted === null) return;

        const { subject } = asserted;
        const production = PRODUCED_SUBJECT_FORMS.get(subject.type);
        if (production !== undefined) {
          inspection.report({ node: subject, messageId: "producedSubject", data: { production } });
        } else if (hidesArguments(asserted, scopeAt)) {
          inspection.report({
            node: subject,
            messageId: "argumentTakingSubject",
            data: { subject: inspection.sourceCode.getText(subject) },
          });
        }
      },
    };
  },
});
