import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const AMBIENT_ONLY_FILE_NAME = /\.d\.[cm]?ts$/u;

const PLATFORM_ASSIGN_ONLY_TARGETS = ["process.exitCode"];

const assignOnlyTargetsFrom = (options: Readonly<Options>): readonly string[] => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return PLATFORM_ASSIGN_ONLY_TARGETS;
  }

  const { assignOnlyTargets } = first;
  if (!Array.isArray(assignOnlyTargets)) return PLATFORM_ASSIGN_ONLY_TARGETS;
  return [
    ...PLATFORM_ASSIGN_ONLY_TARGETS,
    ...assignOnlyTargets.filter((entry): entry is string => typeof entry === "string"),
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
        "An existing binding must not be written to, because the declaration then stops showing what the name holds and every line between the declaration and the read becomes part of the answer. Decide the value where the name is bound: a conditional expression when there are two branches, an immediately invoked function that returns from each branch or from `try` / `catch` when there are more, `reduce` when the value accumulates. A parameter is an existing binding too, so derive a new `const` from it instead of overwriting it. This rule accepts no suppression comment, so a write that truly cannot be avoided stays reported and goes to review.",
      identifierUpdate:
        "An existing binding must not be incremented or decremented, because the name then means something different depending on how many times the surrounding code has run. Replace the counting with a derivation: `reduce` for a running total, the length of a `filter` for a count of matches, an iteration method that receives the index instead of a hand-advanced cursor. Moving the counter into a one-element array or any other mutable container is the same mutable state written differently and does not satisfy this rule.",
      mutatingCall:
        "`{{callee}}` must not be called, because it performs the same property write as an assignment with the operator hidden behind a call; the call shape alone is reported and the first argument is not inspected. Build the value in one expression instead: spread the sources into a new object literal and write the fixed keys in that literal rather than defining them afterwards. To attach context to an error, declare a subclass that takes the extra fields as constructor arguments; to replace a method in a test, use the spy or mock API of the test framework, which checks the replacement against the real signature and restores it afterwards.",
      patternAssignment:
        "An array or object pattern must not be assigned to without a declaration, because it re-binds names that already exist while reading like a new declaration. Move the pattern to the binding site (`const [first, second] = pair;`) so each name is bound exactly once. A pattern that writes to `this.x` is not covered by the class exception either: that exception is limited to a single write whose target is directly `this` or `super`.",
      propertyAssignment:
        "A property of an existing object must not be written to, because the object a reader saw at its declaration is no longer the object later code receives, and every caller holding the same reference observes the change depending on call order. Build a new object instead: spread the original and override the keys, drop a key with a rest element, or `map` a collection into a new one. Writing through an index (`items[0] = next`) or through `length` is the same write under a different syntax, and wrapping the target in a type assertion or a non-null assertion does not change it. The only exception is a write whose target is directly `this` or `super` inside a class member, so `this.a.b = next` and every deeper path are reported; that exception exists to let a class hold state mechanically, not to certify that holding it here is right.",
      propertyUpdate:
        "A property of an existing object must not be incremented or decremented, because the stored number then depends on how many times the surrounding code has run and every holder of that object sees the change. Derive the next object from the current one with a spread that overrides the key, or compute the total with `reduce` instead of accumulating in place. The only exception is an update whose target is directly `this` or `super` inside a class member, so `this.a.b++` and every deeper path are reported.",
      propertyDeletion:
        "A property must not be deleted from an existing object, because the shape a reader saw at the declaration is not the shape later code receives. Take the keys you want to keep instead: destructure with a rest element (`const { dropped, ...kept } = source;`) and use `kept`. Deletion has no class exception, so `delete this.x` is reported like any other deletion.",
      reassignableDeclaration:
        "A `{{kind}}` declaration must not be used, whether or not the binding is ever written to again, because a name that can be re-bound leaves its final value undecided at the declaration and forces a reader to scan the rest of the scope. Bind it once with `const` and produce the value in a single expression: a conditional expression for two branches, an immediately invoked function returning from each branch or from `try` / `catch` for more, `reduce` for an accumulation, `filter` / `map` for a collection, a return from inside a loop for a search. Hiding the same declaration inside an immediately invoked function only shrinks its scope; the immediately invoked function is there to remove the declaration, not to store it. This rule accepts no suppression comment, so a declaration that truly cannot be avoided stays reported and goes to review.",
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
  create(context) {
    if (AMBIENT_ONLY_FILE_NAME.test(context.filename)) return {};

    const assignOnlyTargets = assignOnlyTargetsFrom(context.options);

    const reportWrite = (node: ESTree.Node, messageId: string | null): void => {
      if (messageId === null) return;
      context.report({ node, messageId });
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
        context.report({ node, messageId: "mutatingCall", data: { callee } });
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
        context.report({ node, messageId: "propertyDeletion" });
      },
      UpdateExpression(node: ESTree.UpdateExpression) {
        reportWrite(node.argument, updateMessageId(node.argument));
      },
      VariableDeclaration(node: ESTree.VariableDeclaration) {
        if (!REASSIGNABLE_DECLARATION_KINDS.has(node.kind)) return;
        if (isAmbientDeclaration(node)) return;
        if (node.kind === "let" && PER_ITERATION_HEAD_STATEMENTS.has(node.parent.type)) return;
        context.report({ node, messageId: "reassignableDeclaration", data: { kind: node.kind } });
      },
    };
  },
});
