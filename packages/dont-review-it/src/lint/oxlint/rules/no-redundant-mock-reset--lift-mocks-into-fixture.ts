import { isNotNil } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { mockNamespaceFrom, spellingsFrom } from "../lib/configured-spellings.ts";
import { SUGARED_NODE_TYPES } from "../lib/node-kinds.ts";
import { resolveBinding } from "../lib/resolved-bindings.ts";
import { moduleExportSpelling } from "../lib/spec-syntax/module-declarations.ts";
import { staticMemberName, staticPropertyName } from "../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";

import type { Definition, ESTree, Options, Scope, Variable } from "@oxlint/plugins";
import type { RuleMessage } from "../lib/rule-message.ts";

type CleanupMembers = {
  readonly perMock: ReadonlySet<string>;
  readonly bulkReset: ReadonlySet<string>;
  readonly bulkRelease: ReadonlySet<string>;
};

const PER_MOCK_RESET_MEMBERS_OPTION = "perMockResetMembers";

const BULK_RESET_MEMBERS_OPTION = "bulkResetMembers";

const BULK_STUB_RELEASE_MEMBERS_OPTION = "bulkStubReleaseMembers";

const DEFAULT_PER_MOCK_RESET_MEMBERS: readonly string[] = ["mockClear", "mockReset", "mockRestore"];

const DEFAULT_BULK_RESET_MEMBERS: readonly string[] = [
  "clearAllMocks",
  "resetAllMocks",
  "restoreAllMocks",
];

const DEFAULT_BULK_STUB_RELEASE_MEMBERS: readonly string[] = ["unstubAllEnvs", "unstubAllGlobals"];

const cleanupMembersFrom = (ruleOptions: Readonly<Options>): CleanupMembers => ({
  perMock: spellingsFrom(ruleOptions, {
    option: PER_MOCK_RESET_MEMBERS_OPTION,
    fallback: DEFAULT_PER_MOCK_RESET_MEMBERS,
  }),
  bulkReset: spellingsFrom(ruleOptions, {
    option: BULK_RESET_MEMBERS_OPTION,
    fallback: DEFAULT_BULK_RESET_MEMBERS,
  }),
  bulkRelease: spellingsFrom(ruleOptions, {
    option: BULK_STUB_RELEASE_MEMBERS_OPTION,
    fallback: DEFAULT_BULK_STUB_RELEASE_MEMBERS,
  }),
});

const receiverOf = (member: ESTree.MemberExpression): ESTree.Expression | null => {
  const receiver = member.object;
  return receiver.type === "Super" ? null : receiver;
};

type ReachLookup = {
  readonly scopeAt: (node: ESTree.Node) => Scope;
  readonly seen: ReadonlySet<Variable>;
  readonly isSource: (written: ESTree.Expression) => boolean;
  readonly isImportedSource: (exported: string) => boolean;
};

const definitionReaches = (definition: Definition, lookup: ReachLookup): boolean => {
  const declared = definition.node;
  if (declared.type === "ImportSpecifier") {
    return lookup.isImportedSource(moduleExportSpelling(declared.imported));
  }
  if (declared.type !== "VariableDeclarator" || declared.init === null) return false;
  return declared.id.type === "Identifier" && reaches(declared.init, lookup);
};

const bindingReaches = (binding: Variable, lookup: ReachLookup): boolean => {
  if (lookup.seen.has(binding)) return false;

  const traced = { ...lookup, seen: new Set([...lookup.seen, binding]) };
  const declared = binding.defs.some((definition) => definitionReaches(definition, traced));
  const assigned = binding.references
    .map((reference) => reference.writeExpr)
    .filter(isNotNil)
    .some((written) => reaches(written, traced));
  return declared || assigned;
};

const reaches = (node: ESTree.Expression, lookup: ReachLookup): boolean => {
  const written = unwrapSubject(node);
  if (lookup.isSource(written)) return true;
  if (written.type !== "Identifier") return false;

  const binding = resolveBinding(lookup.scopeAt(written), written.name);
  return binding !== null && bindingReaches(binding, lookup);
};

const MOCK_FACTORY_MEMBERS: ReadonlySet<string> = new Set(["fn", "mocked", "spyOn"]);

const producesMock = (call: ESTree.CallExpression, namespace: ReachLookup): boolean => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return false;

  const factory = staticMemberName(callee);
  if (factory === null || !MOCK_FACTORY_MEMBERS.has(factory)) return false;

  const receiver = receiverOf(callee);
  return receiver !== null && reaches(receiver, namespace);
};

const bulkMessageOf = (member: string, members: CleanupMembers): string | null => {
  if (members.bulkReset.has(member)) return "bulkMockReset";
  return members.bulkRelease.has(member) ? "bulkStubRelease" : null;
};

type Reading = {
  readonly members: CleanupMembers;
  readonly namespace: ReachLookup;
  readonly mock: ReachLookup;
};

const namedCallMessage = (
  called: { readonly receiver: ESTree.Expression; readonly member: string },
  reading: Reading,
): RuleMessage | null => {
  const { member } = called;
  if (reading.members.perMock.has(member)) {
    return { messageId: "perMockReset", data: { member } };
  }

  const messageId = bulkMessageOf(member, reading.members);
  if (messageId === null || !reaches(called.receiver, reading.namespace)) return null;
  return { messageId, data: { member } };
};

const computedCallMessage = (receiver: ESTree.Expression, reading: Reading): RuleMessage | null => {
  const carriesMock = reaches(receiver, reading.namespace) || reaches(receiver, reading.mock);
  return carriesMock ? { messageId: "computedMockMember", data: {} } : null;
};

const calledMessage = (call: ESTree.CallExpression, reading: Reading): RuleMessage | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression" || callee.property.type === "PrivateIdentifier") {
    return null;
  }

  const receiver = receiverOf(callee);
  if (receiver === null) return null;

  const member = staticMemberName(callee);
  if (member === null) return computedCallMessage(receiver, reading);
  return namedCallMessage({ receiver, member }, reading);
};

const namesCleanup = (member: string, members: CleanupMembers): boolean =>
  members.perMock.has(member) || bulkMessageOf(member, members) !== null;

const isWrapping = (
  node: ESTree.Node,
): node is
  | ESTree.ChainExpression
  | ESTree.ParenthesizedExpression
  | ESTree.TSAsExpression
  | ESTree.TSNonNullExpression
  | ESTree.TSSatisfiesExpression
  | ESTree.TSTypeAssertion => SUGARED_NODE_TYPES.has(node.type);

const settledHolder = (holder: ESTree.Node): ESTree.Node =>
  isWrapping(holder) ? settledHolder(holder.parent) : holder;

const isCalledHere = (reference: ESTree.MemberExpression): boolean => {
  const holder = settledHolder(reference.parent);
  return holder.type === "CallExpression" && unwrapSubject(holder.callee) === reference;
};

const TYPEOF_OPERATOR = "typeof";

const isTypeofOperandHere = (reference: ESTree.MemberExpression): boolean => {
  const holder = settledHolder(reference.parent);
  return holder.type === "UnaryExpression" && holder.operator === TYPEOF_OPERATOR;
};

const TAKEN_AS_VALUE_MESSAGE = "resetTakenAsValue";

const takenMemberMessage = (
  reference: ESTree.MemberExpression,
  reading: Reading,
): RuleMessage | null => {
  const receiver = receiverOf(reference);
  if (receiver === null || reference.property.type === "PrivateIdentifier") return null;

  const member = staticMemberName(reference);
  if (member === null || !namesCleanup(member, reading.members)) return null;
  if (isCalledHere(reference) || isTypeofOperandHere(reference)) return null;

  const taken = reading.members.perMock.has(member) || reaches(receiver, reading.namespace);
  return taken ? { messageId: TAKEN_AS_VALUE_MESSAGE, data: { member } } : null;
};

const destructuredSource = (holder: ESTree.Node): ESTree.Expression | null => {
  if (holder.type === "VariableDeclarator") return holder.init;
  return holder.type === "AssignmentExpression" ? holder.right : null;
};

const takenKeyMessage = (
  property: ESTree.BindingProperty | ESTree.ObjectProperty,
  reading: Reading,
): RuleMessage | null => {
  const holder = property.parent;
  if (holder.type !== "ObjectPattern") return null;

  const member = staticPropertyName(property);
  if (member === null || !namesCleanup(member, reading.members)) return null;

  const source = destructuredSource(holder.parent);
  const taken =
    reading.members.perMock.has(member) || (source !== null && reaches(source, reading.namespace));
  return taken ? { messageId: TAKEN_AS_VALUE_MESSAGE, data: { member } } : null;
};

export const noRedundantMockReset = createDontReviewItRule({
  name: "no-redundant-mock-reset--lift-mocks-into-fixture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow clearing, resetting, restoring or releasing mock state by hand, so the state a test starts from is decided by one shared runner configuration instead of by cleanup calls spread across the specs",
      relatedGuidelines: [],
    },
    messages: {
      perMockReset:
        "Clearing, resetting or restoring a mock by hand is forbidden. Delete this `{{member}}` call and move the mock into a fixture that hands its binding to the test.",
      bulkMockReset:
        "Clearing, resetting or restoring every mock by hand is forbidden. Delete this `{{member}}` call and move each mock into a fixture that hands its binding to the test.",
      bulkStubRelease:
        "Releasing stubbed globals or environment variables by hand is forbidden. Delete this `{{member}}` call and move each stub into the fixture that needs it.",
      resetTakenAsValue:
        "Taking `{{member}}` as a value is forbidden. Delete the reference and move the mock into a fixture that hands its binding to the test.",
      computedMockMember:
        "Reaching a member of a mock or of the mock namespace through a computed key is forbidden. Write the member name out at this call site.",
    },
    schema: [
      {
        type: "object",
        properties: {
          mockNamespace: { type: "string" },
          perMockResetMembers: { type: "array", items: { type: "string" } },
          bulkResetMembers: { type: "array", items: { type: "string" } },
          bulkStubReleaseMembers: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const scopeAt = (node: ESTree.Node): Scope => inspection.sourceCode.getScope(node);
    const namespace = mockNamespaceFrom(inspection.options);
    const namespaceLookup: ReachLookup = {
      scopeAt,
      seen: new Set(),
      isSource: (written) => written.type === "Identifier" && written.name === namespace,
      isImportedSource: (exported) => exported === namespace,
    };
    const reading: Reading = {
      members: cleanupMembersFrom(inspection.options),
      namespace: namespaceLookup,
      mock: {
        scopeAt,
        seen: new Set(),
        isSource: (written) =>
          written.type === "CallExpression" && producesMock(written, namespaceLookup),
        isImportedSource: () => false,
      },
    };
    const reportFound = (node: ESTree.Node, complaint: RuleMessage | null): void => {
      if (complaint === null) return;
      inspection.report({ node, messageId: complaint.messageId, data: complaint.data });
    };

    return {
      CallExpression(node: ESTree.CallExpression) {
        reportFound(node, calledMessage(node, reading));
      },

      MemberExpression(node: ESTree.MemberExpression) {
        reportFound(node, takenMemberMessage(node, reading));
      },

      Property(node: ESTree.BindingProperty | ESTree.ObjectProperty) {
        reportFound(node, takenKeyMessage(node, reading));
      },
    };
  },
});
