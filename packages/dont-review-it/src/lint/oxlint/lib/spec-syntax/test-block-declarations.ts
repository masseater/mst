import { nodesOfType } from "../nodes-of-type.ts";
import { ASSERTION_ENTRY_NAME } from "./assertion-entries.ts";
import { staticMemberName } from "./static-names.ts";
import { unwrapSubject, type SpecFunction } from "./subject-expressions.ts";
import { testBlockRootName } from "./test-block-modifiers.ts";

import type { ESTree } from "@oxlint/plugins";

export const INJECTED_TEST_BLOCK_SPELLINGS: ReadonlySet<string> = new Set(["it", "test"]);

const INJECTED_GROUPING_BLOCK_SPELLINGS: ReadonlySet<string> = new Set(["describe"]);

const INJECTED_ASSERTION_ENTRY_SPELLINGS: ReadonlySet<string> = new Set([ASSERTION_ENTRY_NAME]);

const DERIVED_BUILDER_MEMBER = "extend";

export const RUNNER_MODULES: readonly string[] = ["vitest", "vite-plus/test"];

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
  reached: ReadonlySet<string>,
  initializers: ReadonlyMap<string, ESTree.Expression>,
): ReadonlySet<string> => {
  const gained = [...initializers].filter(
    ([name, initializer]) => !reached.has(name) && reached.has(boundRootName(initializer) ?? ""),
  );
  if (gained.length === 0) return reached;

  return settledNames(new Set([...reached, ...gained.map(([name]) => name)]), initializers);
};

const initializersIn = (program: ESTree.Program): ReadonlyMap<string, ESTree.Expression> =>
  new Map(
    nodesOfType(program, "VariableDeclarator").flatMap((declarator) =>
      declarator.id.type === "Identifier" && declarator.init !== null
        ? [[declarator.id.name, declarator.init] as const]
        : [],
    ),
  );

const rootNamesIn = (
  program: ESTree.Program,
  spellings: ReadonlySet<string>,
): ReadonlySet<string> => {
  const imported = nodesOfType(program, "ImportDeclaration").flatMap((declaration) =>
    importedBlockNames(declaration, spellings),
  );
  return settledNames(new Set([...spellings, ...imported]), initializersIn(program));
};

export const testBlockRootNames = (program: ESTree.Program): ReadonlySet<string> =>
  rootNamesIn(program, INJECTED_TEST_BLOCK_SPELLINGS);

export const groupingBlockRootNames = (program: ESTree.Program): ReadonlySet<string> =>
  rootNamesIn(program, INJECTED_GROUPING_BLOCK_SPELLINGS);

export const assertionEntryRootNames = (program: ESTree.Program): ReadonlySet<string> =>
  rootNamesIn(program, INJECTED_ASSERTION_ENTRY_SPELLINGS);

const shadowedNamesIn = (program: ESTree.Program): ReadonlySet<string> =>
  new Set([
    ...nodesOfType(program, "ImportDeclaration").flatMap((declaration) =>
      declaration.specifiers.map((specifier) => specifier.local.name),
    ),
    ...nodesOfType(program, "VariableDeclarator").flatMap((declarator) =>
      declarator.id.type === "Identifier" ? [declarator.id.name] : [],
    ),
    ...nodesOfType(program, "FunctionDeclaration").flatMap((declaration) =>
      declaration.id === null ? [] : [declaration.id.name],
    ),
  ]);

const importedNamesIn = (program: ESTree.Program): ReadonlySet<string> =>
  new Set(
    nodesOfType(program, "ImportDeclaration").flatMap((declaration) =>
      declaration.specifiers.flatMap((specifier) =>
        specifier.type === "ImportSpecifier" ? [specifier.local.name] : [],
      ),
    ),
  );

const derivedRootName = (initializer: ESTree.Expression): string | null => {
  const written = unwrapSubject(initializer);
  if (written.type !== "CallExpression") return null;

  const builder = unwrapSubject(written.callee);
  if (builder.type !== "MemberExpression") return null;
  if (staticMemberName(builder) !== DERIVED_BUILDER_MEMBER) return null;
  return boundRootName(builder.object);
};

const namesDerivedFromImports = (program: ESTree.Program): readonly string[] => {
  const imported = importedNamesIn(program);
  return [...initializersIn(program)].flatMap(([name, initializer]) =>
    imported.has(derivedRootName(initializer) ?? "") ? [name] : [],
  );
};

export const runnerRootedTestBlockRootNames = (program: ESTree.Program): ReadonlySet<string> => {
  const shadowed = shadowedNamesIn(program);
  const imported = nodesOfType(program, "ImportDeclaration")
    .filter((declaration) => RUNNER_MODULES.includes(declaration.source.value))
    .flatMap((declaration) => importedBlockNames(declaration, INJECTED_TEST_BLOCK_SPELLINGS));
  const injected = [...INJECTED_TEST_BLOCK_SPELLINGS].filter((name) => !shadowed.has(name));
  const handedOn = namesDerivedFromImports(program);

  return settledNames(new Set([...injected, ...imported, ...handedOn]), initializersIn(program));
};

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
