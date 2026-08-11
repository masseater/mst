import { dirname, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { classModulesFor } from "../lib/receiver-mutation/class-modules.ts";
import { mutatingMethodNamesIn } from "../lib/receiver-mutation/mutating-class-methods.ts";
import {
  mutatingBuiltinMemberOf,
  MUTATING_BUILTIN_METHOD_NAMES,
  MUTATING_BUILTIN_TYPE_NAMES,
} from "../lib/receiver-mutation/mutating-members.ts";
import {
  declaredTypeNamesIn,
  importedNamesIn,
  judgedReceiverOf,
  type JudgedReceiver,
} from "../lib/receiver-mutation/receiver-types.ts";
import { resolveBinding, type ScopeLookup } from "../lib/resolved-bindings.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";

import type { ESTree } from "@oxlint/plugins";

const NUMBER_TYPE_NODE = "TSNumberKeyword";

const namesNumberKey = (node: ESTree.MemberExpression, scopeAt: ScopeLookup): boolean => {
  const key = node.property;
  if (key.type === "Literal") return typeof key.value === "number";
  if (key.type !== "Identifier") return false;

  const binding = resolveBinding(scopeAt(key), key.name);
  return (
    binding?.defs.some((definition) => {
      if (definition.name.typeAnnotation?.typeAnnotation.type === NUMBER_TYPE_NODE) return true;
      const declared = definition.node;
      if (declared.type !== "VariableDeclarator" || declared.init === null) return false;
      return declared.init.type === "Literal" && typeof declared.init.value === "number";
    }) === true
  );
};

const isCalledMember = (node: ESTree.MemberExpression): boolean =>
  node.parent.type === "CallExpression" && node.parent.callee === node;

export const noReceiverMutation = createDontReviewItRule({
  name: "no-receiver-mutation--derive-new-value",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow calling a method that writes to a receiver which is not an array - a collection, a moment, a query string, a form, a sink, or a class of one's own whose body writes to `this` - so a changed value always appears as a newly derived binding",
      relatedGuidelines: [],
    },
    messages: {
      builtinReceiverMutation:
        "`{{method}}` must not be called on a `{{type}}`: it writes to the receiver in place of handing back a new value. Derive the value you need and bind it. {{derivation}} The pair of the type and the method name settles this report, not the name on its own. Carrying the same write over to an array or to an index write is reported by `no-array-mutation--derive-new-array` and `no-reassign--use-spread-or-iife`.",
      sinkReceiverMutation:
        "`{{method}}` must not be called on a `{{type}}`: it writes to the receiver, and a write that leaves the program has no new value to derive. Build the whole payload and hand it to whoever owns the sink.",
      declaredClassMutation:
        "`{{method}}` must not be called on a `{{type}}`: its body writes to `this`, and the call changes the receiver where it stands. Return a new `{{type}}` from that method and bind what it returns. The judgement follows the body, so moving the write into a method that one calls leaves this report standing, and holding the same state in a collection is reported too.",
      collapsedReceiverMutation:
        "`{{method}}` names a method that writes to its receiver, and a receiver typed `any` or `unknown` must not carry a name from that list. Give the receiver a settled type, and derive a new value in place of writing to the one at hand. This report stands on a receiver that could not be settled, not on one settled as a writer.",
      runtimeKeyReceiverMutation:
        "A method of a `{{type}}` must not be reached through a key that settles only while the program runs: the name being called cannot be read here, and the writing methods of `{{type}}` are reachable this way. Write the method name out, or derive a new value in place of writing to the one at hand.",
    },
    schema: [],
  },
  create(context) {
    const scopeAt: ScopeLookup = (node) => context.sourceCode.getScope(node);
    const file = resolve(context.cwd, context.filename);

    const importedNames = memoize(() => importedNamesIn(context.sourceCode.ast.body));
    const ownedNames = memoize(
      () =>
        new Set([...declaredTypeNamesIn(context.sourceCode.ast.body), ...importedNames().keys()]),
    );

    const mutatingNamesOf = memoize((type: string): ReadonlySet<string> | null => {
      const imported = importedNames().get(type) ?? null;
      const className = imported === null ? type : imported.name;
      const found = classModulesFor({
        file,
        source: context.sourceCode.text,
        workspaceRoot: findWorkspaceRoot(dirname(file)),
        imported,
      }).flatMap((module) => {
        const names = mutatingMethodNamesIn({ ...module, className });
        return names === null ? [] : [...names];
      });
      return found.length === 0 ? null : new Set(found);
    });

    const writesReceiverThrough = (type: string): boolean =>
      ownedNames().has(type)
        ? (mutatingNamesOf(type)?.size ?? 0) > 0
        : MUTATING_BUILTIN_TYPE_NAMES.has(type);

    const reportNamedReceiver = (request: {
      readonly node: ESTree.MemberExpression;
      readonly type: string;
      readonly method: string;
    }): void => {
      const { node, type, method } = request;
      if (ownedNames().has(type)) {
        if (mutatingNamesOf(type)?.has(method) !== true) return;
        context.report({
          node: node.property,
          messageId: "declaredClassMutation",
          data: { type, method },
        });
        return;
      }

      const member = mutatingBuiltinMemberOf({ type, method });
      if (member === null) return;
      context.report({
        node: node.property,
        messageId: member.sink ? "sinkReceiverMutation" : "builtinReceiverMutation",
        data: { type, method, derivation: member.derivation },
      });
    };

    const reportRuntimeKey = (node: ESTree.MemberExpression, receiver: JudgedReceiver): void => {
      if (receiver.kind !== "named" || !isCalledMember(node)) return;
      if (namesNumberKey(node, scopeAt)) return;
      if (!writesReceiverThrough(receiver.type)) return;
      context.report({
        node: node.property,
        messageId: "runtimeKeyReceiverMutation",
        data: { type: receiver.type },
      });
    };

    const reportCollapsedReceiver = (node: ESTree.MemberExpression, method: string): void => {
      if (!MUTATING_BUILTIN_METHOD_NAMES.has(method)) return;
      context.report({
        node: node.property,
        messageId: "collapsedReceiverMutation",
        data: { method },
      });
    };

    return {
      MemberExpression(node: ESTree.MemberExpression) {
        const receiver = judgedReceiverOf(node.object, { scopeAt, seenBindings: new Set() });
        if (receiver === null) return;

        const method = staticMemberName(node);
        if (method === null) {
          reportRuntimeKey(node, receiver);
          return;
        }
        if (receiver.kind === "collapsed") {
          reportCollapsedReceiver(node, method);
          return;
        }
        reportNamedReceiver({ node, type: receiver.type, method });
      },
    };
  },
});
