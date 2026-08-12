import { take } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { resolveBinding, type ScopeLookup } from "../lib/resolved-bindings.ts";
import { fixtureDeclarationsOf } from "../lib/spec-syntax/fixture-declarations.ts";
import {
  DEFAULT_MOCK_NAMESPACE_SPELLINGS,
  spellsMockNamespace,
  type NamespaceLookup,
} from "../lib/spec-syntax/mock-namespace.ts";
import { moduleExportSpelling } from "../lib/spec-syntax/module-declarations.ts";
import { DESTRUCTIVE_OPERATIONS } from "../lib/spec-syntax/normalizing-operations.ts";
import { DEFAULT_SPEC_FILE_SUFFIXES, isSpecFile } from "../lib/spec-syntax/spec-files.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import { memberRootOf, unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";
import {
  declaresTestBlock,
  testBlockBindings,
  testCallbacksOf,
} from "../lib/spec-syntax/test-block-declarations.ts";
import { INJECTED_TEST_HOOK_SPELLINGS } from "../lib/spec-syntax/test-hook-declarations.ts";

import type { Definition, ESTree } from "@oxlint/plugins";

const TEST_HOOK_SPELLINGS: ReadonlySet<string> = new Set(INJECTED_TEST_HOOK_SPELLINGS);

const REBINDING_MESSAGE = "sharedBindingRebound";

const WRITING_MESSAGE = "sharedValueWritten";

const OPERATION_MESSAGE = "sharedValueChangedByCall";

type StateWrite = {
  readonly node: ESTree.Node;
  readonly root: { readonly name: string; readonly at: ESTree.Node };
  readonly messageId: string;
  readonly member: string;
};

const standsInsideTest = (node: ESTree.Node, regions: readonly ESTree.Node[]): boolean =>
  regions.some((region) => region.start <= node.start && node.end <= region.end);

const writtenLeavesOf = (
  target:
    | ESTree.AssignmentTargetMaybeDefault
    | ESTree.AssignmentTargetProperty
    | ESTree.AssignmentTargetRest,
): readonly ESTree.Expression[] => {
  if (target.type === "ArrayPattern") {
    return target.elements.flatMap((element) => (element === null ? [] : writtenLeavesOf(element)));
  }
  if (target.type === "ObjectPattern") return target.properties.flatMap(writtenLeavesOf);
  if (target.type === "Property") return writtenLeavesOf(target.value);
  if (target.type === "RestElement") return writtenLeavesOf(target.argument);
  if (target.type === "AssignmentPattern") return writtenLeavesOf(target.left);
  return [unwrapSubject(target)];
};

const memberWriteOf = (node: ESTree.Node, leaf: ESTree.Expression): readonly StateWrite[] => {
  if (leaf.type !== "MemberExpression") return [];

  const root = memberRootOf(leaf);
  if (root === null) return [];
  return [{ node, root: { name: root.name, at: root }, messageId: WRITING_MESSAGE, member: "" }];
};

const writeOfLeaf = (node: ESTree.Node, leaf: ESTree.Expression): readonly StateWrite[] =>
  leaf.type === "Identifier"
    ? [{ node, root: { name: leaf.name, at: leaf }, messageId: REBINDING_MESSAGE, member: "" }]
    : memberWriteOf(node, leaf);

const standsOnMockNamespace = (node: ESTree.Expression, lookup: NamespaceLookup): boolean => {
  const written = unwrapSubject(node);
  if (spellsMockNamespace(written, lookup)) return true;
  if (written.type === "CallExpression") return standsOnMockNamespace(written.callee, lookup);
  if (written.type === "MemberExpression") return standsOnMockNamespace(written.object, lookup);
  return false;
};

const assignmentWrites = (
  node: ESTree.AssignmentExpression,
  lookup: NamespaceLookup,
): readonly StateWrite[] =>
  standsOnMockNamespace(node.right, lookup)
    ? []
    : writtenLeavesOf(node.left).flatMap((leaf) => writeOfLeaf(node, leaf));

const updateWrites = (node: ESTree.UpdateExpression): readonly StateWrite[] =>
  writeOfLeaf(node, unwrapSubject(node.argument));

const deletionWrites = (node: ESTree.UnaryExpression): readonly StateWrite[] =>
  node.operator === "delete" ? memberWriteOf(node, unwrapSubject(node.argument)) : [];

const operationWrites = (node: ESTree.CallExpression): readonly StateWrite[] => {
  const callee = unwrapSubject(node.callee);
  if (callee.type !== "MemberExpression") return [];

  const member = staticMemberName(callee);
  if (member === null || !DESTRUCTIVE_OPERATIONS.has(member)) return [];

  const root = memberRootOf(callee.object);
  if (root === null) return [];
  return [{ node, root: { name: root.name, at: root }, messageId: OPERATION_MESSAGE, member }];
};

const importedFrom = (definition: Definition): string | null => {
  const declaration = definition.parent;
  if (declaration?.type !== "ImportDeclaration") return null;
  return `the module \`${declaration.source.value}\` this file takes it from`;
};

const originOf = (definition: Definition): string =>
  importedFrom(definition) ?? `line ${String(definition.name.loc.start.line)} of this file`;

const declaresRebindableName = (definition: Definition): boolean => {
  const declaration = definition.parent;
  if (declaration?.type !== "VariableDeclaration") return false;
  return declaration.kind === "let" || declaration.kind === "var";
};

const hookLocalNamesIn = (declaration: ESTree.ImportDeclaration): readonly string[] =>
  declaration.specifiers.flatMap((specifier) =>
    specifier.type === "ImportSpecifier" &&
    TEST_HOOK_SPELLINGS.has(moduleExportSpelling(specifier.imported))
      ? [specifier.local.name]
      : [],
  );

const namesSetupHook = (node: ESTree.CallExpression, hookNames: ReadonlySet<string>): boolean => {
  const callee = unwrapSubject(node.callee);
  return callee.type === "Identifier" && hookNames.has(callee.name);
};

export const noModuleScopeMutableState = createDontReviewItRule({
  name: "no-module-scope-mutable-state--lift-into-fixture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a test writing to a binding declared outside every fixture, test block and setup hook, so the state a test changes belongs to that test alone rather than to the whole file",
      relatedGuidelines: [],
    },
    messages: {
      sharedBindingRebound:
        "A binding declared outside every test must not be reassigned from inside one. `{{name}}` is declared at {{origin}}, and the whole file shares the single instance it names: what this test leaves behind is what the next test starts from, in an order that changes from run to run. Move the declaration into the body of the fixture the test takes its subject from and return it, leaving every test to receive its own through a parameter. Declaring it `const`, packing it into an object, hiding the write behind a setter, and moving the declaration into another module all keep the single instance and are reported the same way. A count meant to add up across tests belongs inside the one test that reads the number.",
      sharedValueWritten:
        "A value declared outside every test must not be written into from inside one. `{{name}}` is declared at {{origin}}, and every test in this file reads and writes the one value it names: a property this test adds, replaces or deletes is still there for the next test, in an order that changes from run to run. Move the declaration into the body of the fixture the test takes its subject from and return it, leaving every test to receive its own through a parameter. `const` on the declaration does not stop this write, freezing the value only turns it into a failure at run time, and moving the declaration into another module leaves the sharing exactly where it stood.",
      sharedValueChangedByCall:
        "`{{member}}` must not be called on a value declared outside every test. `{{name}}` is declared at {{origin}}, and the elements or entries this call adds, removes or reorders stay in the one value the whole file shares: the next test starts from whatever this test left behind, in an order that changes from run to run. Move the declaration into the body of the fixture the test takes its subject from and return it, leaving every test to receive its own through a parameter. Declaring it `const` and freezing it both keep the single instance; build the value this test needs inside the fixture instead.",
    },
    schema: [],
  },
  create(context) {
    if (!isSpecFile(context.filename, DEFAULT_SPEC_FILE_SUFFIXES)) return {};

    const scopeAt: ScopeLookup = (node) => context.sourceCode.getScope(node);
    const namespaces: NamespaceLookup = {
      scopeAt,
      spellings: new Set(DEFAULT_MOCK_NAMESPACE_SPELLINGS),
      seenBindings: new Set(),
    };

    const blocks = testBlockBindings();
    const hookNames = new Set<string>(TEST_HOOK_SPELLINGS);
    const calls = new Set<ESTree.CallExpression>();
    const writes = new Set<StateWrite>();

    const testRegions = (): readonly ESTree.Node[] => {
      const rootNames = blocks.rootNames();
      return [...calls].flatMap((call) => [
        ...fixtureDeclarationsOf(call).flatMap(({ factory }) => factory ?? []),
        ...(declaresTestBlock(call, rootNames) || namesSetupHook(call, hookNames)
          ? testCallbacksOf(call)
          : []),
      ]);
    };

    const declarationsOutsideTests = (
      write: StateWrite,
      regions: readonly ESTree.Node[],
    ): readonly Definition[] => {
      const binding = resolveBinding(scopeAt(write.root.at), write.root.name);
      if (binding === null) return [];
      return binding.defs.some((definition) => standsInsideTest(definition.name, regions))
        ? []
        : binding.defs;
    };

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        blocks.takeImport(node);
        for (const name of hookLocalNamesIn(node)) hookNames.add(name);
      },
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        blocks.takeLocalBinding(node);
      },
      AssignmentExpression(node: ESTree.AssignmentExpression) {
        for (const write of assignmentWrites(node, namespaces)) writes.add(write);
      },
      UpdateExpression(node: ESTree.UpdateExpression) {
        for (const write of updateWrites(node)) writes.add(write);
      },
      UnaryExpression(node: ESTree.UnaryExpression) {
        for (const write of deletionWrites(node)) writes.add(write);
      },
      CallExpression(node: ESTree.CallExpression) {
        calls.add(node);
        for (const write of operationWrites(node)) writes.add(write);
      },
      "Program:exit"() {
        const regions = testRegions();

        for (const write of writes) {
          if (!standsInsideTest(write.node, regions)) continue;

          for (const definition of take(declarationsOutsideTests(write, regions), 1)) {
            if (write.messageId === REBINDING_MESSAGE && !declaresRebindableName(definition)) {
              continue;
            }
            context.report({
              node: write.node,
              messageId: write.messageId,
              data: { name: write.root.name, origin: originOf(definition), member: write.member },
            });
          }
        }
      },
    };
  },
});
