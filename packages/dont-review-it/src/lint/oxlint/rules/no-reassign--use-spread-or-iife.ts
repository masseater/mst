import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const AMBIENT_ONLY_FILE_NAME = /\.d\.[cm]?ts$/u;

const PLATFORM_ASSIGN_ONLY_TARGETS = ["process.exitCode"];

const assignOnlyTargetsFrom = (ruleOptions: Readonly<Options>): readonly string[] => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return PLATFORM_ASSIGN_ONLY_TARGETS;
  }

  const { assignOnlyTargets } = first;
  if (!Array.isArray(assignOnlyTargets)) return PLATFORM_ASSIGN_ONLY_TARGETS;
  return [
    ...PLATFORM_ASSIGN_ONLY_TARGETS,
    ...assignOnlyTargets.filter((candidate): candidate is string => typeof candidate === "string"),
  ];
};

const REASSIGNABLE_DECLARATION_KINDS: ReadonlySet<string> = new Set(["let", "var"]);

const PER_ITERATION_HEAD_STATEMENTS: ReadonlySet<string> = new Set([
  "ForInStatement",
  "ForOfStatement",
]);

const MUTATING_PROPERTY_CALLS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["Object", new Set(["assign", "defineProperties", "defineProperty", "setPrototypeOf"])],
  ["Reflect", new Set(["set"])],
]);

const unwrapSugar = (node: ESTree.Node): ESTree.Node => {
  switch (node.type) {
    case "ChainExpression":
    case "TSAsExpression":
    case "TSNonNullExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
      return unwrapSugar(node.expression);
    default:
      return node;
  }
};

const isClassMemberScope = (node: ESTree.Node): boolean => {
  switch (node.type) {
    case "Program":
      return false;
    case "FunctionDeclaration":
    case "FunctionExpression":
      return node.parent.type === "MethodDefinition";
    case "AccessorProperty":
    case "PropertyDefinition":
    case "StaticBlock":
      return true;
    default:
      return isClassMemberScope(node.parent);
  }
};

const isDirectClassStateTarget = (node: ESTree.MemberExpression): boolean => {
  const receiver = unwrapSugar(node.object);
  if (receiver.type !== "Super" && receiver.type !== "ThisExpression") return false;
  return isClassMemberScope(node);
};

const staticMemberPath = (node: ESTree.MemberExpression): string | null => {
  if (node.computed) return null;
  const receiver = unwrapSugar(node.object);
  if (receiver.type !== "Identifier" || node.property.type !== "Identifier") return null;
  return `${receiver.name}.${node.property.name}`;
};

const assignmentMessageId = (
  node: ESTree.Node,
  assignOnlyTargets: readonly string[],
): string | null => {
  const stripped = unwrapSugar(node);
  if (stripped.type === "MemberExpression") {
    if (isDirectClassStateTarget(stripped)) return null;
    const path = staticMemberPath(stripped);
    return path !== null && assignOnlyTargets.includes(path) ? null : "propertyAssignment";
  }
  return stripped.type === "Identifier" ? "identifierAssignment" : "patternAssignment";
};

const updateMessageId = (node: ESTree.Node): string | null => {
  const stripped = unwrapSugar(node);
  if (stripped.type !== "MemberExpression") return "identifierUpdate";
  return isDirectClassStateTarget(stripped) ? null : "propertyUpdate";
};

const isAmbientDeclaration = (node: ESTree.Node): boolean => {
  switch (node.type) {
    case "Program":
      return false;
    case "TSModuleDeclaration":
      return node.declare || isAmbientDeclaration(node.parent);
    case "VariableDeclaration":
      return node.declare === true || isAmbientDeclaration(node.parent);
    default:
      return isAmbientDeclaration(node.parent);
  }
};

const mutatingCalleeName = (node: ESTree.CallExpression): string | null => {
  const { callee } = node;
  if (callee.type !== "MemberExpression") return null;
  if (callee.computed) return null;
  if (callee.object.type !== "Identifier") return null;
  if (callee.property.type !== "Identifier") return null;
  const members = MUTATING_PROPERTY_CALLS.get(callee.object.name);
  if (members === undefined || !members.has(callee.property.name)) return null;
  return `${callee.object.name}.${callee.property.name}`;
};

export const noReassign = createDontReviewItRule({
  name: "no-reassign--use-spread-or-iife",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow every assignment-shaped mutation - a re-bindable declaration, a write to an existing binding or property, an index or length write, a property-writing standard call, a property deletion, a pattern assignment - so the value a name holds is fixed where the name is declared",
      relatedGuidelines: [],
    },
    messages: {
      identifierAssignment:
        "An existing binding must not be written to. Decide the value where the name is bound: a conditional expression for two branches, an immediately invoked function that returns from each branch or from `try` / `catch` for more, `reduce` for an accumulation. Derive a new `const` from a parameter rather than overwriting it.",
      identifierUpdate:
        "An existing binding must not be incremented or decremented. Replace the counting with a derivation: `reduce` for a running total, the length of a `filter` for a count of matches, an iteration method that receives the index instead of a hand-advanced cursor.",
      mutatingCall:
        "`{{callee}}` must not be called. Build the value in one expression: spread the sources into a new object literal and write the fixed keys in that literal.",
      patternAssignment:
        "An array or object pattern must not be assigned to without a declaration. Move the pattern to the binding site: `const [first, second] = pair;`.",
      propertyAssignment:
        "A property of an existing object must not be written to. Build a new object: spread the original and override the keys, drop a key with a rest element, or `map` a collection into a new one.",
      propertyUpdate:
        "A property of an existing object must not be incremented or decremented. Derive the next object from the current one with a spread that overrides the key, or compute the total with `reduce`.",
      propertyDeletion:
        "A property must not be deleted from an existing object. Take the keys to keep: destructure with a rest element (`const { dropped, ...kept } = source;`) and use `kept`.",
      reassignableDeclaration:
        "A `{{kind}}` declaration must not be used. Declare the name with `const` and produce the value in a single expression: a conditional expression for two branches, an immediately invoked function returning from each branch or from `try` / `catch` for more, `reduce` for an accumulation, `filter` / `map` for a collection, a return from inside a loop for a search.",
    },
    schema: [
      {
        type: "object",
        properties: {
          assignOnlyTargets: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (AMBIENT_ONLY_FILE_NAME.test(inspection.filename)) return {};

    const assignOnlyTargets = assignOnlyTargetsFrom(inspection.options);

    const reportWrite = (node: ESTree.Node, messageId: string | null): void => {
      if (messageId === null) return;
      inspection.report({ node, messageId });
    };

    const reportLoopHead = (node: ESTree.Node): void => {
      if (node.type === "VariableDeclaration") return;
      reportWrite(node, assignmentMessageId(node, assignOnlyTargets));
    };

    return {
      AssignmentExpression(node: ESTree.AssignmentExpression) {
        reportWrite(node.left, assignmentMessageId(node.left, assignOnlyTargets));
      },
      CallExpression(node: ESTree.CallExpression) {
        const callee = mutatingCalleeName(node);
        if (callee === null) return;
        inspection.report({ node, messageId: "mutatingCall", data: { callee } });
      },
      ForInStatement(node: ESTree.ForInStatement) {
        reportLoopHead(node.left);
      },
      ForOfStatement(node: ESTree.ForOfStatement) {
        reportLoopHead(node.left);
      },
      UnaryExpression(node: ESTree.UnaryExpression) {
        if (node.operator !== "delete") return;
        if (unwrapSugar(node.argument).type !== "MemberExpression") return;
        inspection.report({ node, messageId: "propertyDeletion" });
      },
      UpdateExpression(node: ESTree.UpdateExpression) {
        reportWrite(node.argument, updateMessageId(node.argument));
      },
      VariableDeclaration(node: ESTree.VariableDeclaration) {
        if (!REASSIGNABLE_DECLARATION_KINDS.has(node.kind)) return;
        if (isAmbientDeclaration(node)) return;
        if (node.kind === "let" && PER_ITERATION_HEAD_STATEMENTS.has(node.parent.type)) return;
        inspection.report({
          node,
          messageId: "reassignableDeclaration",
          data: { kind: node.kind },
        });
      },
    };
  },
});
