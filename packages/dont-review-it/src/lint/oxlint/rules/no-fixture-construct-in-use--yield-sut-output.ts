import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { resolveBinding, type ScopeLookup } from "../lib/resolved-bindings.ts";
import { assembledShapeOf, isEmptyContainer } from "../lib/spec-syntax/assembled-values.ts";
import { fixtureDeclarationsOf } from "../lib/spec-syntax/fixture-declarations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import {
  asSpecFunction,
  memberRootOf,
  returnedExpressionsOf,
  unwrapSubject,
} from "../lib/spec-syntax/subject-expressions.ts";

import type { ESTree, Variable } from "@oxlint/plugins";

const INSTANCE_FACTORY_SHAPES: ReadonlyMap<string, string> = new Map([
  ["Object.create", "a value `Object.create` built here"],
  ["Reflect.construct", "a value `Reflect.construct` built here"],
]);

const qualifiedCalleeOf = (call: ESTree.CallExpression): string | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;

  const member = staticMemberName(callee);
  const namespace = unwrapSubject(callee.object);
  if (member === null || namespace.type !== "Identifier") return null;
  return `${namespace.name}.${member}`;
};

const COMPOSING_CALL = "Object.assign";

const composedValueOf = (call: ESTree.CallExpression): ESTree.Expression | null => {
  if (qualifiedCalleeOf(call) !== COMPOSING_CALL) return null;

  const [composed] = call.arguments;
  return composed === undefined || composed.type === "SpreadElement" ? null : composed;
};

type Reading = {
  readonly written: ESTree.Expression;
  readonly scopeAt: ScopeLookup;
  readonly walked: ReadonlySet<Variable>;
  readonly calls: readonly ESTree.CallExpression[];
};

const filledByCall = (bound: Variable, reading: Reading): boolean =>
  reading.calls.some((call) => {
    const callee = unwrapSubject(call.callee);
    if (callee.type !== "MemberExpression") return false;

    const root = memberRootOf(callee.object);
    return root !== null && resolveBinding(reading.scopeAt(root), root.name) === bound;
  });

const declaredValueOf = (bound: Variable): ESTree.Expression | null => {
  const [definition] = bound.defs;
  if (definition?.node.type !== "VariableDeclarator") return null;
  return definition.node.init;
};

type Assembly =
  | { readonly kind: "built"; readonly shape: string; readonly boundAs: string | null }
  | { readonly kind: "read"; readonly root: string };

const assemblyInMemberRead = (
  member: ESTree.MemberExpression,
  reading: Reading,
): Assembly | null => {
  const root = memberRootOf(member.object);
  if (root === null) return null;

  const bound = resolveBinding(reading.scopeAt(root), root.name);
  if (bound === null || declaredValueOf(bound) === null) return null;
  return { kind: "read", root: root.name };
};

const assemblyOf = (reading: Reading): Assembly | null => {
  const written = unwrapSubject(reading.written);
  const shape = assembledShapeOf(written);
  if (shape !== null) return { kind: "built", shape, boundAs: null };
  if (written.type === "CallExpression") return assemblyInCall(written, reading);
  if (written.type === "MemberExpression") return assemblyInMemberRead(written, reading);
  return written.type === "Identifier" ? assemblyBehindName(written, reading) : null;
};

const assemblyInCall = (call: ESTree.CallExpression, reading: Reading): Assembly | null => {
  const inlined = asSpecFunction(call.callee);
  if (inlined !== null) {
    return (
      returnedExpressionsOf(inlined)
        .map((returned) => assemblyOf({ ...reading, written: returned }))
        .find((assembly) => assembly !== null) ?? null
    );
  }

  const composed = composedValueOf(call);
  if (composed !== null) return assemblyOf({ ...reading, written: composed });

  const qualified = qualifiedCalleeOf(call);
  const shape = qualified === null ? undefined : INSTANCE_FACTORY_SHAPES.get(qualified);
  return shape === undefined ? null : { kind: "built", shape, boundAs: null };
};

const assemblyBehindName = (
  identifier: ESTree.IdentifierReference,
  reading: Reading,
): Assembly | null => {
  const bound = resolveBinding(reading.scopeAt(identifier), identifier.name);
  if (bound === null || reading.walked.has(bound)) return null;

  const declared = declaredValueOf(bound);
  if (declared === null) return null;
  if (isEmptyContainer(declared) && filledByCall(bound, reading)) return null;

  const carried = assemblyOf({
    ...reading,
    written: declared,
    walked: new Set([...reading.walked, bound]),
  });
  if (carried === null) return null;
  return carried.kind === "built" ? { ...carried, boundAs: identifier.name } : carried;
};

const findingFor = (
  subject: ESTree.Expression,
  assembly: Assembly,
): {
  readonly node: ESTree.Node;
  readonly messageId: string;
  readonly data: Readonly<Record<string, string>>;
} => {
  if (assembly.kind === "read") {
    return { node: subject, messageId: "readSubject", data: { root: assembly.root } };
  }
  return assembly.boundAs === null
    ? { node: subject, messageId: "builtSubject", data: { shape: assembly.shape } }
    : {
        node: subject,
        messageId: "boundBuiltSubject",
        data: { name: assembly.boundAs, shape: assembly.shape },
      };
};

export const noFixtureConstructInUse = createDontReviewItRule({
  name: "no-fixture-construct-in-use--yield-sut-output",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a fixture factory handing back a value the spec built instead of the value the code under test produced, so a green assertion says something about the production and not about the stand-in the spec packed for it",
      relatedGuidelines: [],
    },
    messages: {
      builtSubject:
        "A fixture must not hand back a value it built itself. This one is {{shape}}. Return the value the code under test produced, untouched.",
      boundBuiltSubject:
        "A fixture must not hand back a value it built itself. `{{name}}` holds {{shape}}. Return the value the code under test produced, untouched. Spreading the building across further bindings, an immediately invoked function or `Object.assign` leaves the same built value at the end of the chain.",
      readSubject:
        "A fixture must not hand back a part read off a binding it already holds. Return `{{root}}` whole and read the part in the assertion.",
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

    const scopeAt: ScopeLookup = (node: ESTree.Node) => inspection.sourceCode.getScope(node);

    return {
      "Program:exit"(program: ESTree.Program) {
        const calls = nodesOfType(program, "CallExpression");
        const fixtures = calls.filter((call) => fixtureDeclarationsOf(call).length > 0);

        for (const fixture of fixtures) {
          for (const declaration of fixtureDeclarationsOf(fixture)) {
            if (declaration.factory === null) continue;

            for (const subject of declaration.subjects) {
              const assembly = assemblyOf({
                written: subject,
                scopeAt,
                walked: new Set(),
                calls,
              });
              if (assembly === null) continue;
              inspection.report(findingFor(subject, assembly));
            }
          }
        }
      },
    };
  },
});
