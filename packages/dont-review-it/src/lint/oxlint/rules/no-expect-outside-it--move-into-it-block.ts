import { uniqBy } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { resolveBinding } from "../lib/resolved-bindings.ts";
import { isFixtureBuilderCall } from "../lib/spec-syntax/fixture-declarations.ts";
import {
  ASSERTION_COUNT_DECLARATIONS,
  DERIVED_ASSERTION_RECEIVERS,
} from "../lib/spec-syntax/matcher-vocabulary.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";
import {
  assertionEntryRootNames,
  carriesSpelledTitle,
  INJECTED_TEST_BLOCK_SPELLINGS,
  runnerRootedTestBlockRootNames,
  testCallbacksOf,
} from "../lib/spec-syntax/test-block-declarations.ts";
import { testBlockRootIdentifier } from "../lib/spec-syntax/test-block-modifiers.ts";

import type { ESTree, FixFn, Options, Variable } from "@oxlint/plugins";

const blockSpellingFrom = (options: Readonly<Options>): string => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return "it";

  const { blockSpelling } = first;
  return typeof blockSpelling === "string" ? blockSpelling : "it";
};

type BlockBody = {
  readonly root: ESTree.IdentifierReference;
  readonly start: number;
  readonly end: number;
};

const blockBodiesOf = (call: ESTree.CallExpression): readonly BlockBody[] => {
  const root = testBlockRootIdentifier(call.callee);
  if (root === null || !carriesSpelledTitle(call)) return [];

  return testCallbacksOf(call).map((callback) => ({
    root,
    start: callback.start,
    end: callback.end,
  }));
};

const innermostBodyAround = (
  assertion: ESTree.CallExpression,
  bodies: readonly BlockBody[],
): BlockBody | null =>
  bodies
    .filter((body) => body.start <= assertion.start && assertion.end <= body.end)
    .toSorted((held, other) => other.start - held.start)
    .at(0) ?? null;

const receiverRootName = (
  call: ESTree.CallExpression,
  members: ReadonlySet<string>,
): string | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;

  const member = staticMemberName(callee);
  if (member === null || !members.has(member)) return null;

  const receiver = unwrapSubject(callee.object);
  return receiver.type === "Identifier" ? receiver.name : null;
};

const entryRootName = (call: ESTree.CallExpression): string | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type === "Identifier") return callee.name;
  return receiverRootName(call, DERIVED_ASSERTION_RECEIVERS);
};

const assertionKindOf = (
  call: ESTree.CallExpression,
  entryNames: ReadonlySet<string>,
): "assertion" | "count" | null => {
  if (entryNames.has(entryRootName(call) ?? "")) return "assertion";
  return entryNames.has(receiverRootName(call, ASSERTION_COUNT_DECLARATIONS) ?? "")
    ? "count"
    : null;
};

const placementMessageId = (
  canonical: boolean,
  rooted: boolean,
): "foreignTestBlockAssertion" | "shadowedTestBlockAssertion" | "groupingBlockAssertion" | null => {
  if (!rooted) return canonical ? "shadowedTestBlockAssertion" : "groupingBlockAssertion";
  return canonical ? null : "foreignTestBlockAssertion";
};

const derivedFactoryBase = (initializer: ESTree.Expression): ESTree.Expression | null => {
  const written = unwrapSubject(initializer);
  if (written.type !== "CallExpression") return null;

  const callee = unwrapSubject(written.callee);
  if (callee.type !== "MemberExpression") return null;
  return isFixtureBuilderCall(written) ? callee.object : null;
};

const namesRootedAt = (
  reached: ReadonlySet<string>,
  bases: ReadonlyMap<string, string>,
): ReadonlySet<string> => {
  const gained = [...bases].filter(([name, base]) => !reached.has(name) && reached.has(base));
  if (gained.length === 0) return reached;

  return namesRootedAt(new Set([...reached, ...gained.map(([name]) => name)]), bases);
};

const exportedNamesOf = (declaration: ESTree.ExportNamedDeclaration): readonly string[] => {
  const declared = declaration.declaration;
  const bound =
    declared?.type === "VariableDeclaration"
      ? declared.declarations.flatMap((declarator) =>
          declarator.id.type === "Identifier" ? [declarator.id.name] : [],
        )
      : [];
  const forwarded = declaration.specifiers.flatMap((specifier) =>
    specifier.local.type === "Identifier" ? [specifier.local.name] : [],
  );
  return [...bound, ...forwarded];
};

const renamedSpots = (variable: Variable): readonly ESTree.Node[] =>
  uniqBy(
    [...variable.identifiers, ...variable.references.map((reference) => reference.identifier)],
    (spot) => spot.start,
  );

export const noExpectOutsideIt = createDontReviewItRule({
  name: "no-expect-outside-it--move-into-it-block",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow an assertion standing anywhere other than inside a test block the runner handed over under the configured spelling, so every assertion a suite runs answers for the behaviour one named block describes",
      relatedGuidelines: [],
    },
    messages: {
      foreignTestBlockAssertion:
        "An assertion must not stand in a test block declared through `{{written}}`. Rename the root of that declaration to `{{required}}`.",
      shadowedTestBlockAssertion:
        "An assertion must not stand in a block declared through a binding of `{{required}}` that the test runner never handed over. Declare the block through the `{{required}}` the runner injects, or through a fixture derived from it.",
      groupingBlockAssertion:
        "An assertion must not stand in the block declared through `{{written}}`. Move this assertion into an `{{required}}` block that names the behaviour it checks.",
      detachedAssertion:
        "An assertion must not stand outside a test block. Move this assertion into the `{{required}}` block that names the behaviour it checks.",
      strayAssertionCount:
        "An assertion count must not be declared outside a test block. Move this declaration into the `{{required}}` block whose assertions it counts, or delete it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          blockSpelling: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
    fixable: "code",
  },
  create(context) {
    const required = blockSpellingFrom(context.options);
    const harvested = {
      chainBases: new Map<string, string>(),
      factoryNames: new Set<string>(),
      exportedNames: new Set<string>(),
      fixedRoots: new Set<number>(),
    };

    const takeDerivation = (declarator: ESTree.VariableDeclarator): void => {
      if (declarator.id.type !== "Identifier" || declarator.init === null) return;

      const factoryBase = derivedFactoryBase(declarator.init);
      const written = unwrapSubject(factoryBase ?? declarator.init);
      if (written.type !== "Identifier") return;

      harvested.chainBases.set(declarator.id.name, written.name);
      if (factoryBase !== null) harvested.factoryNames.add(declarator.id.name);
    };

    const runnerRooted = (
      root: ESTree.IdentifierReference,
      blockRootNames: ReadonlySet<string>,
    ): boolean => {
      const bound = resolveBinding(context.sourceCode.getScope(root), root.name);
      if (bound !== null) return blockRootNames.has(root.name);
      return INJECTED_TEST_BLOCK_SPELLINGS.has(root.name) || root.name === required;
    };

    const renameFixOf = (root: ESTree.IdentifierReference): FixFn | null => {
      const scope = context.sourceCode.getScope(root);
      const bound = resolveBinding(scope, root.name);
      if (bound === null) {
        return INJECTED_TEST_BLOCK_SPELLINGS.has(required)
          ? (fixer) => fixer.replaceText(root, required)
          : null;
      }

      const canonical = namesRootedAt(new Set([required]), harvested.chainBases);
      if (!harvested.factoryNames.has(root.name) || canonical.has(root.name)) return null;
      if (harvested.exportedNames.has(root.name)) return null;
      if (resolveBinding(scope, required) !== null) return null;
      return (fixer) => renamedSpots(bound).map((spot) => fixer.replaceText(spot, required));
    };

    const reportPlacement = (asked: {
      readonly assertion: ESTree.CallExpression;
      readonly body: BlockBody;
      readonly blockRootNames: ReadonlySet<string>;
    }): void => {
      const root = asked.body.root;
      const written = root.name;
      const messageId = placementMessageId(
        written === required,
        runnerRooted(root, asked.blockRootNames),
      );
      if (messageId === null) return;

      const rewritable =
        messageId === "foreignTestBlockAssertion" && !harvested.fixedRoots.has(root.start);
      const fix = rewritable ? renameFixOf(root) : null;
      if (fix !== null) harvested.fixedRoots.add(root.start);
      context.report({
        node: asked.assertion,
        messageId,
        data: { written, required },
        ...(fix === null ? {} : { fix }),
      });
    };

    const reportCall = (asked: {
      readonly call: ESTree.CallExpression;
      readonly body: BlockBody | null;
      readonly blockRootNames: ReadonlySet<string>;
      readonly entryRootNames: ReadonlySet<string>;
    }): void => {
      const kind = assertionKindOf(asked.call, asked.entryRootNames);
      if (kind === null) return;
      if (asked.body !== null && kind === "assertion") {
        reportPlacement({
          assertion: asked.call,
          body: asked.body,
          blockRootNames: asked.blockRootNames,
        });
        return;
      }
      if (asked.body !== null && runnerRooted(asked.body.root, asked.blockRootNames)) return;

      const messageId = kind === "assertion" ? "detachedAssertion" : "strayAssertionCount";
      context.report({ node: asked.call, messageId, data: { required } });
    };

    return {
      VariableDeclarator: takeDerivation,
      ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
        for (const name of exportedNamesOf(node)) harvested.exportedNames.add(name);
      },
      "Program:exit"(program: ESTree.Program) {
        const blockRootNames = runnerRootedTestBlockRootNames(program);
        const entryRootNames = assertionEntryRootNames(program);
        const calls = nodesOfType(program, "CallExpression");
        const bodies = calls.flatMap((call) => blockBodiesOf(call));

        for (const call of calls) {
          reportCall({
            call,
            body: innermostBodyAround(call, bodies),
            blockRootNames,
            entryRootNames,
          });
        }
      },
    };
  },
});
