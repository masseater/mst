import { createDontReviewItRule } from "../../../create-rule.ts";
import { resolveBinding } from "../lib/resolved-bindings.ts";
import { isAssertionEntryCall } from "../lib/spec-syntax/assertion-entries.ts";
import { isFixtureBuilderCall } from "../lib/spec-syntax/fixture-declarations.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";
import {
  carriesSpelledTitle,
  INJECTED_TEST_BLOCK_SPELLINGS,
  testBlockBindings,
  testCallbacksOf,
} from "../lib/spec-syntax/test-block-declarations.ts";
import { testBlockRootIdentifier } from "../lib/spec-syntax/test-block-modifiers.ts";

import type { ESTree, FixFn, Options, Variable } from "@oxlint/plugins";

const blockSpellingFrom = (ruleOptions: Readonly<Options>): string => {
  const [first] = ruleOptions;
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

  return testCallbacksOf(call).map((testCallback) => ({
    root,
    start: testCallback.start,
    end: testCallback.end,
  }));
};

const innermostBodyAround = (
  assertion: ESTree.CallExpression,
  blockBodies: readonly BlockBody[],
): BlockBody | null =>
  blockBodies
    .filter((blockBody) => blockBody.start <= assertion.start && assertion.end <= blockBody.end)
    .toSorted((held, later) => later.start - held.start)
    .at(0) ?? null;

const derivedFactoryBase = (initializer: ESTree.Expression): ESTree.Expression | null => {
  const written = unwrapSubject(initializer);
  if (written.type !== "CallExpression") return null;

  const callee = unwrapSubject(written.callee);
  if (callee.type !== "MemberExpression") return null;
  return isFixtureBuilderCall(written) ? callee.object : null;
};

const namesRootedAt = (
  reached: Set<string>,
  bases: ReadonlyMap<string, string>,
): ReadonlySet<string> => {
  const gained = [...bases].filter(([derived, base]) => !reached.has(derived) && reached.has(base));
  if (gained.length === 0) return reached;

  for (const [derived] of gained) reached.add(derived);
  return namesRootedAt(reached, bases);
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

const renamedSpots = (variable: Variable): readonly ESTree.Node[] => {
  const spots = new Map<number, ESTree.Node>();
  for (const identifier of variable.identifiers) spots.set(identifier.start, identifier);
  for (const reference of variable.references) {
    spots.set(reference.identifier.start, reference.identifier);
  }
  return [...spots.values()];
};

export const noExpectOutsideIt = createDontReviewItRule({
  name: "no-expect-outside-it--move-into-it-block",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow an assertion standing anywhere other than inside a test block declared through the configured spelling, so every assertion a suite runs answers for the behaviour one named block describes",
      relatedGuidelines: [],
    },
    messages: {
      foreignTestBlockAssertion:
        "An assertion must not stand in a test block declared through `{{written}}`. Rename the root of that declaration to `{{required}}`.",
      groupingBlockAssertion:
        "An assertion must not stand in the block declared through `{{written}}`. Move this assertion into an `{{required}}` block that names the behaviour it checks.",
      detachedAssertion:
        "An assertion must not stand outside a test block. Move this assertion into the `{{required}}` block that names the behaviour it checks.",
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
  create(inspection) {
    const required = blockSpellingFrom(inspection.options);
    const bindings = testBlockBindings();
    const calls = new Set<ESTree.CallExpression>();
    const harvested = {
      chainBases: new Map<string, string>(),
      factoryNames: new Set<string>(),
      exportedNames: new Set<string>(),
    };
    const fixedRoots = new Set<number>();

    const takeDerivation = (declarator: ESTree.VariableDeclarator): void => {
      bindings.takeLocalBinding(declarator);
      if (declarator.id.type !== "Identifier" || declarator.init === null) return;

      const factoryBase = derivedFactoryBase(declarator.init);
      const written = unwrapSubject(factoryBase ?? declarator.init);
      if (written.type !== "Identifier") return;

      harvested.chainBases.set(declarator.id.name, written.name);
      if (factoryBase !== null) harvested.factoryNames.add(declarator.id.name);
    };

    const renameFixOf = (root: ESTree.IdentifierReference): FixFn | null => {
      const scope = inspection.sourceCode.getScope(root);
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

    const reportPlacement = (assertion: ESTree.CallExpression, blockBody: BlockBody): void => {
      const written = blockBody.root.name;
      if (written === required) return;

      const spelling = { written, required };
      if (!bindings.rootNames().has(written)) {
        inspection.report({ node: assertion, messageId: "groupingBlockAssertion", data: spelling });
        return;
      }

      const fix = fixedRoots.has(blockBody.root.start) ? null : renameFixOf(blockBody.root);
      if (fix !== null) fixedRoots.add(blockBody.root.start);
      inspection.report({
        node: assertion,
        messageId: "foreignTestBlockAssertion",
        data: spelling,
        ...(fix === null ? {} : { fix }),
      });
    };

    return {
      ImportDeclaration: bindings.takeImport,
      VariableDeclarator: takeDerivation,
      ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
        for (const exportedName of exportedNamesOf(node)) harvested.exportedNames.add(exportedName);
      },
      CallExpression(node: ESTree.CallExpression) {
        calls.add(node);
      },
      "Program:exit"() {
        const blockBodies = [...calls].flatMap((call) => blockBodiesOf(call));

        for (const call of calls) {
          if (!isAssertionEntryCall(call)) continue;

          const blockBody = innermostBodyAround(call, blockBodies);
          if (blockBody === null) {
            inspection.report({ node: call, messageId: "detachedAssertion", data: { required } });
            continue;
          }
          reportPlacement(call, blockBody);
        }
      },
    };
  },
});
