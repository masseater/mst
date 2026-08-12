import { ASSERTION_ENTRY_NAME } from "./assertion-entries.ts";
import { staticMemberName } from "./static-names.ts";
import { unwrapSubject, type SpecFunction } from "./subject-expressions.ts";
import { testBlockRootName } from "./test-block-modifiers.ts";

import type { ESTree } from "@oxlint/plugins";

export const INJECTED_TEST_BLOCK_SPELLINGS: ReadonlySet<string> = new Set(["it", "test"]);

const INJECTED_GROUPING_BLOCK_SPELLINGS: ReadonlySet<string> = new Set(["describe"]);

const INJECTED_ASSERTION_ENTRY_SPELLINGS: ReadonlySet<string> = new Set([ASSERTION_ENTRY_NAME]);

const DERIVED_BUILDER_MEMBER = "extend";

export type TestBlockBindings = {
  readonly takeImport: (declaration: ESTree.ImportDeclaration) => void;
  readonly takeLocalBinding: (declarator: ESTree.VariableDeclarator) => void;
  readonly rootNames: () => ReadonlySet<string>;
};

const importedBlockNames = (
  declaration: ESTree.ImportDeclaration,
  spellings: ReadonlySet<string>,
): readonly string[] =>
  declaration.specifiers.flatMap((specifier) => {
    if (specifier.type !== "ImportSpecifier") return [];
    const exported =
      specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
    return spellings.has(exported) ? [specifier.local.name] : [];
  });

const boundRootName = (initializer: ESTree.Expression): string | null => {
  const written = unwrapSubject(initializer);
  if (written.type === "Identifier") return written.name;
  if (written.type !== "CallExpression") return null;

  const builder = unwrapSubject(written.callee);
  if (builder.type !== "MemberExpression") return null;
  if (staticMemberName(builder) !== DERIVED_BUILDER_MEMBER) return null;
  return boundRootName(builder.object);
};

const settledNames = (
  reached: Set<string>,
  initializers: ReadonlyMap<string, ESTree.Expression>,
): ReadonlySet<string> => {
  const gained = [...initializers].filter(
    ([spelled, initializer]) =>
      !reached.has(spelled) && reached.has(boundRootName(initializer) ?? ""),
  );
  if (gained.length === 0) return reached;

  for (const [spelled] of gained) reached.add(spelled);
  return settledNames(reached, initializers);
};

const blockBindingsOf = (spellings: ReadonlySet<string>): TestBlockBindings => {
  const imported = new Set<string>();
  const initializers = new Map<string, ESTree.Expression>();

  return {
    takeImport: (declaration) => {
      for (const spelled of importedBlockNames(declaration, spellings)) imported.add(spelled);
    },
    takeLocalBinding: (declarator) => {
      if (declarator.id.type !== "Identifier") return;
      if (declarator.init === null) return;
      initializers.set(declarator.id.name, declarator.init);
    },
    rootNames: () => settledNames(new Set([...spellings, ...imported]), initializers),
  };
};

export const testBlockBindings = (): TestBlockBindings =>
  blockBindingsOf(INJECTED_TEST_BLOCK_SPELLINGS);

export const groupingBlockBindings = (): TestBlockBindings =>
  blockBindingsOf(INJECTED_GROUPING_BLOCK_SPELLINGS);

export const assertionEntryBindings = (): TestBlockBindings =>
  blockBindingsOf(INJECTED_ASSERTION_ENTRY_SPELLINGS);

export const declaresTestBlock = (
  call: ESTree.CallExpression,
  rootNames: ReadonlySet<string>,
): boolean => rootNames.has(testBlockRootName(call.callee) ?? "");

const functionsHandedTo = (handed: ESTree.Expression): readonly SpecFunction[] => {
  const written = unwrapSubject(handed);
  if (written.type === "ArrowFunctionExpression") return [written];
  if (written.type === "FunctionExpression") return [written];
  if (written.type !== "CallExpression") return [];

  return written.arguments.flatMap((argument) =>
    argument.type === "SpreadElement" ? [] : functionsHandedTo(argument),
  );
};

export const testCallbacksOf = (call: ESTree.CallExpression): readonly SpecFunction[] =>
  call.arguments.flatMap((argument) =>
    argument.type === "SpreadElement" ? [] : functionsHandedTo(argument),
  );

export const carriesSpelledTitle = (call: ESTree.CallExpression): boolean => {
  const [first] = call.arguments;
  if (first === undefined || first.type === "SpreadElement") return false;

  const written = unwrapSubject(first);
  if (written.type === "TemplateLiteral") return true;
  return written.type === "Literal" && typeof written.value === "string";
};

export const testBlockBodyOf = (
  call: ESTree.CallExpression,
  rootNames: ReadonlySet<string>,
): SpecFunction | null => {
  if (!declaresTestBlock(call, rootNames) || !carriesSpelledTitle(call)) return null;
  return testCallbacksOf(call).at(-1) ?? null;
};
