import { staticMemberName } from "./static-names.ts";
import { unwrapSubject } from "./subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

const TEST_BLOCK_MODIFIERS: ReadonlySet<string> = new Set([
  "concurrent",
  "each",
  "fails",
  "for",
  "only",
  "runIf",
  "sequential",
  "shuffle",
  "skip",
  "skipIf",
  "todo",
]);

const isTestBlockModifier = (name: string): boolean => TEST_BLOCK_MODIFIERS.has(name);

export const testBlockRootIdentifier = (
  callee: ESTree.Expression,
): ESTree.IdentifierReference | null => {
  const written = unwrapSubject(callee);
  if (written.type === "Identifier") return written;
  if (written.type === "CallExpression") return testBlockRootIdentifier(written.callee);
  if (written.type === "TaggedTemplateExpression") return testBlockRootIdentifier(written.tag);
  if (written.type !== "MemberExpression") return null;

  const member = staticMemberName(written);
  if (member === null || !isTestBlockModifier(member)) return null;
  return testBlockRootIdentifier(written.object);
};

export const testBlockRootName = (callee: ESTree.Expression): string | null =>
  testBlockRootIdentifier(callee)?.name ?? null;

export type TestBlockModifierUse = {
  readonly name: string;
  readonly handed: readonly ESTree.Expression[] | null;
};

const spelledOutArguments = (call: ESTree.CallExpression): readonly ESTree.Expression[] | null => {
  const handed = call.arguments.flatMap((argument) =>
    argument.type === "SpreadElement" ? [] : [argument],
  );
  return handed.length === call.arguments.length ? handed : null;
};

const modifierUsesReaching = (
  callee: ESTree.Expression,
  handed: readonly ESTree.Expression[] | null,
): readonly TestBlockModifierUse[] => {
  const written = unwrapSubject(callee);
  if (written.type === "CallExpression") {
    return modifierUsesReaching(written.callee, spelledOutArguments(written));
  }
  if (written.type === "TaggedTemplateExpression") return modifierUsesReaching(written.tag, null);
  if (written.type !== "MemberExpression") return [];

  const member = staticMemberName(written);
  if (member === null || !isTestBlockModifier(member)) return [];
  return [{ name: member, handed }, ...modifierUsesReaching(written.object, null)];
};

export const testBlockModifiersOf = (callee: ESTree.Expression): readonly TestBlockModifierUse[] =>
  modifierUsesReaching(callee, null);
