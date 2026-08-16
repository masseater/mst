import { isNotNil } from "es-toolkit";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { resolveBinding } from "../../lib/resolved-bindings.ts";
import { isAssertionEntryCall } from "../../lib/spec-syntax/assertion-entries.ts";
import { fixtureDeclarationsOf } from "../../lib/spec-syntax/fixture-declarations.ts";
import { ASSERTION_CHAIN_MODIFIERS } from "../../lib/spec-syntax/matcher-vocabulary.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";
import { staticMemberName, staticPropertyName } from "../../lib/spec-syntax/static-names.ts";
import { unwrapSubject, type SpecFunction } from "../../lib/spec-syntax/subject-expressions.ts";

import type { Definition, ESTree, Options, Reference, Scope, Variable } from "@oxlint/plugins";

const CALL_RECORD_MEMBERS_OPTION = "callRecordMembers";

const DEFAULT_CALL_RECORD_MEMBERS: readonly string[] = [
  "calls",
  "contexts",
  "instances",
  "invocationCallOrder",
  "lastCall",
];

const callRecordMembersFrom = (ruleOptions: Readonly<Options>): ReadonlySet<string> => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return new Set(DEFAULT_CALL_RECORD_MEMBERS);
  }

  const configured = first[CALL_RECORD_MEMBERS_OPTION];
  if (!Array.isArray(configured)) return new Set(DEFAULT_CALL_RECORD_MEMBERS);

  const spelled = configured.filter(
    (candidate): candidate is string => typeof candidate === "string",
  );
  return new Set(spelled.length === 0 ? DEFAULT_CALL_RECORD_MEMBERS : spelled);
};

type MockReach = {
  readonly namespace: boolean;
  readonly record: boolean;
};

const NOTHING_REACHED: MockReach = { namespace: false, record: false };

const firstReach = (reached: readonly MockReach[]): MockReach =>
  reached.find((reach) => reach.namespace || reach.record) ?? NOTHING_REACHED;

const boundName = (checked: ESTree.Node): string | null => {
  if (checked.type === "Identifier") return checked.name;
  if (checked.type === "AssignmentPattern") return boundName(checked.left);
  return null;
};

const destructuredMemberOf = (pattern: ESTree.ObjectPattern, spelled: string): string | null =>
  pattern.properties
    .flatMap((property) => (property.type === "Property" ? [property] : []))
    .filter((property) => boundName(property.value) === spelled)
    .flatMap((property) => {
      const member = staticPropertyName(property);
      return member === null ? [] : [member];
    })
    .at(0) ?? null;

const listsName = (pattern: ESTree.ArrayPattern, spelled: string): boolean =>
  pattern.elements.some((held) => held !== null && boundName(held) === spelled);

const patternBinds = (pattern: ESTree.BindingPattern, spelled: string): boolean => {
  if (boundName(pattern) === spelled) return true;
  if (pattern.type === "ObjectPattern") return destructuredMemberOf(pattern, spelled) !== null;
  return pattern.type === "ArrayPattern" && listsName(pattern, spelled);
};

const callableOf = (node: ESTree.Node): SpecFunction | null => {
  if (node.type === "ArrowFunctionExpression") return node;
  if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") return node;
  return null;
};

const declaredParametersOf = (callable: SpecFunction): readonly (ESTree.BindingPattern | null)[] =>
  callable.params.map((parameter) =>
    parameter.type === "RestElement" || parameter.type === "TSParameterProperty" ? null : parameter,
  );

const MOCK_NAMESPACE_MEMBER = "mock";

const NAMESPACE_REACHED: MockReach = { namespace: true, record: false };

const RECORD_REACHED: MockReach = { namespace: false, record: true };

const memberOfReach = (
  member: string,
  reached: { readonly source: MockReach; readonly recordMembers: ReadonlySet<string> },
): MockReach => {
  if (reached.source.record) return RECORD_REACHED;
  if (reached.source.namespace) {
    return reached.recordMembers.has(member) ? RECORD_REACHED : NOTHING_REACHED;
  }
  return member === MOCK_NAMESPACE_MEMBER ? NAMESPACE_REACHED : NOTHING_REACHED;
};

type RecordLookup = {
  readonly scopeAt: (node: ESTree.Node) => Scope;
  readonly recordMembers: ReadonlySet<string>;
  readonly seenBindings: ReadonlySet<Variable>;
};

const memberReach = (node: ESTree.MemberExpression, lookup: RecordLookup): MockReach => {
  const source = mockReachOf(node.object, lookup);
  if (source.record) return RECORD_REACHED;

  const member = staticMemberName(node);
  if (member === null) return NOTHING_REACHED;
  return memberOfReach(member, { source, recordMembers: lookup.recordMembers });
};

const patternReach = (
  bound: {
    readonly pattern: ESTree.BindingPattern;
    readonly name: string;
    readonly source: ESTree.Expression;
  },
  lookup: RecordLookup,
): MockReach => {
  const { pattern, name: spelled } = bound;
  if (pattern.type === "Identifier") return mockReachOf(bound.source, lookup);
  if (pattern.type === "AssignmentPattern") {
    return patternReach({ ...bound, pattern: pattern.left }, lookup);
  }

  const source = mockReachOf(bound.source, lookup);
  if (pattern.type === "ArrayPattern") {
    return source.record && listsName(pattern, spelled) ? RECORD_REACHED : NOTHING_REACHED;
  }

  const member = destructuredMemberOf(pattern, spelled);
  if (member === null) return NOTHING_REACHED;
  return memberOfReach(member, { source, recordMembers: lookup.recordMembers });
};

const callableBindingName = (callable: SpecFunction): string | null => {
  if (callable.id !== null) return callable.id.name;

  const holder = callable.parent;
  return holder.type === "VariableDeclarator" ? boundName(holder.id) : null;
};

const argumentsAt = (reference: Reference, index: number): readonly ESTree.Expression[] => {
  const site = reference.identifier.parent;
  if (site.type !== "CallExpression" || site.callee !== reference.identifier) return [];

  const handed = site.arguments[index];
  return handed === undefined || handed.type === "SpreadElement" ? [] : [handed];
};

const handedToParameter = (
  taken: { readonly callable: SpecFunction; readonly index: number },
  lookup: RecordLookup,
): readonly ESTree.Expression[] => {
  const named = callableBindingName(taken.callable);
  const binding = named === null ? null : resolveBinding(lookup.scopeAt(taken.callable), named);
  if (binding === null) return [];
  return binding.references.flatMap((reference) => argumentsAt(reference, taken.index));
};

const parameterReach = (
  taken: { readonly callable: SpecFunction; readonly name: string },
  lookup: RecordLookup,
): MockReach => {
  const { callable, name: spelled } = taken;
  const declared = declaredParametersOf(callable);
  const index = declared.findIndex(
    (parameter) => parameter !== null && patternBinds(parameter, spelled),
  );
  const pattern = declared[index];
  if (!isNotNil(pattern)) return NOTHING_REACHED;

  return firstReach(
    handedToParameter({ callable, index }, lookup).map((source) =>
      patternReach({ pattern, name: spelled, source }, lookup),
    ),
  );
};

const definitionReach = (
  bound: { readonly definition: Definition; readonly name: string },
  lookup: RecordLookup,
): MockReach => {
  const { definition, name: spelled } = bound;
  const callable = callableOf(definition.node);
  if (callable !== null) return parameterReach({ callable, name: spelled }, lookup);

  const declarator = definition.node;
  if (declarator.type !== "VariableDeclarator" || declarator.init === null) return NOTHING_REACHED;
  return patternReach({ pattern: declarator.id, name: spelled, source: declarator.init }, lookup);
};

const bindingReach = (binding: Variable, lookup: RecordLookup): MockReach => {
  if (lookup.seenBindings.has(binding)) return NOTHING_REACHED;

  const traced = { ...lookup, seenBindings: new Set([...lookup.seenBindings, binding]) };
  const declared = binding.defs.map((definition) =>
    definitionReach({ definition, name: binding.name }, traced),
  );
  const assigned = binding.references
    .map((reference) => reference.writeExpr)
    .filter(isNotNil)
    .map((written) => mockReachOf(written, traced));

  return firstReach([...declared, ...assigned]);
};

const mockReachOf = (node: ESTree.Expression, lookup: RecordLookup): MockReach => {
  const written = unwrapSubject(node);
  if (written.type === "MemberExpression") return memberReach(written, lookup);
  if (written.type === "CallExpression") {
    return mockReachOf(written.callee, lookup).record ? RECORD_REACHED : NOTHING_REACHED;
  }
  if (written.type !== "Identifier") return NOTHING_REACHED;

  const binding = resolveBinding(lookup.scopeAt(written), written.name);
  return binding === null ? NOTHING_REACHED : bindingReach(binding, lookup);
};

const assertionEntryOf = (node: ESTree.Expression): ESTree.CallExpression | null => {
  const written = unwrapSubject(node);
  if (written.type === "CallExpression") return isAssertionEntryCall(written) ? written : null;
  if (written.type !== "MemberExpression") return null;

  const member = staticMemberName(written);
  if (member === null || !ASSERTION_CHAIN_MODIFIERS.has(member)) return null;
  return assertionEntryOf(written.object);
};

const assertionOf = (
  call: ESTree.CallExpression,
): { readonly matcher: string; readonly subject: ESTree.Expression } | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;

  const matcher = staticMemberName(callee);
  if (matcher === null) return null;

  const listed = assertionEntryOf(callee.object);
  if (listed === null) return null;

  const [handed] = listed.arguments;
  if (handed === undefined || handed.type === "SpreadElement") return null;
  return { matcher, subject: handed };
};

export const noExpectMockCallInspection = createDontReviewItRule({
  name: "no-expect-mock-call-inspection--use-to-have-been-called-family",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reading the call record of a mock as a value, in the subject of an assertion or in what a fixture hands back, so a claim about how a function was called is stated by the matcher that names it",
      relatedGuidelines: [],
    },
    messages: {
      inspectedCallRecord:
        "The call record of a mock must not be the subject of an assertion. Pass the mock itself to `expect` and put the claim in the matcher that names it: `toHaveBeenCalledWith` or `toHaveBeenCalledExactlyOnceWith` for the arguments, `toHaveBeenCalledTimes` or `toHaveBeenCalledOnce` for the count, `toHaveBeenCalled` for the call itself, and the same names behind `not` for the absence of a call. `{{matcher}}` is receiving that record. Names bound to the record, destructurings, parameters, reassignments and other matchers carrying the same comparison are forbidden detours; each is followed back to the record.",
      fixtureYieldsCallRecord:
        "A fixture must not hand back the call record of a mock. Return the mock binding itself and leave the claim to `toHaveBeenCalledWith`, `toHaveBeenCalledTimes` or `toHaveBeenCalled` in the assertion. The fixture `{{fixture}}` is handing that record back. Names bound in the factory, destructurings, parameters and reassignments between the mock and the value handed back are forbidden detours; each is followed back to the record.",
    },
    schema: [
      {
        type: "object",
        properties: {
          callRecordMembers: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const lookup: RecordLookup = {
      scopeAt: (node) => inspection.sourceCode.getScope(node),
      recordMembers: callRecordMembersFrom(inspection.options),
      seenBindings: new Set(),
    };

    const reportFixtures = (call: ESTree.CallExpression): void => {
      for (const declaration of fixtureDeclarationsOf(call)) {
        for (const subject of declaration.subjects) {
          if (!mockReachOf(subject, lookup).record) continue;
          inspection.report({
            node: subject,
            messageId: "fixtureYieldsCallRecord",
            data: { fixture: declaration.name },
          });
        }
      }
    };

    return {
      CallExpression(node: ESTree.CallExpression) {
        reportFixtures(node);

        const assertion = assertionOf(node);
        if (assertion === null) return;
        if (!mockReachOf(assertion.subject, lookup).record) return;
        inspection.report({
          node: assertion.subject,
          messageId: "inspectedCallRecord",
          data: { matcher: assertion.matcher },
        });
      },
    };
  },
});
