import { range } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { resolveBinding } from "../lib/resolved-bindings.ts";
import { isAssertionCall } from "../lib/spec-syntax/assertion-entries.ts";
import {
  fixtureDeclarationsOf,
  fixtureDependenciesOf,
} from "../lib/spec-syntax/fixture-declarations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import {
  asSpecFunction,
  unwrapSubject,
  type SpecFunction,
} from "../lib/spec-syntax/subject-expressions.ts";
import {
  declaresTestBlock,
  testBlockRootNames,
  testCallbacksOf,
} from "../lib/spec-syntax/test-block-declarations.ts";

import type { Definition, ESTree, Node, Options, SourceCode } from "@oxlint/plugins";

const DEFAULT_MAX_ASSERTIONS = 1;

const MAX_ASSERTIONS_OPTION = "maxAssertions";

const maxAssertionsFrom = (ruleSettings: Readonly<Options>): number => {
  const [first] = ruleSettings;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return DEFAULT_MAX_ASSERTIONS;
  }
  const configured = first[MAX_ASSERTIONS_OPTION];
  return typeof configured === "number" ? configured : DEFAULT_MAX_ASSERTIONS;
};

const declaredFunctionOf = (definition: Definition): SpecFunction | null => {
  const declared = definition.node;
  if (declared.type === "FunctionDeclaration") return declared;
  if (declared.type !== "VariableDeclarator" || declared.init === null) return null;
  return asSpecFunction(declared.init);
};

type Callee = {
  readonly kind: "fixture" | "helper";
  readonly label: string;
  readonly body: SpecFunction;
};

const helperCalledBy = (sourceCode: SourceCode, call: ESTree.CallExpression): Callee | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "Identifier") return null;

  const binding = resolveBinding(sourceCode.getScope(call), callee.name);
  if (binding === null) return null;

  const declaredHelper = binding.defs
    .flatMap((definition) => {
      const declared = declaredFunctionOf(definition);
      return declared === null ? [] : [declared];
    })
    .at(-1);
  return declaredHelper === undefined
    ? null
    : { kind: "helper", label: callee.name, body: declaredHelper };
};

type Owner =
  | { readonly kind: "block"; readonly block: ESTree.CallExpression }
  | { readonly kind: "callee"; readonly callee: Callee };

type Reading = {
  readonly assertions: ReadonlySet<ESTree.CallExpression>;
  readonly blocks: ReadonlyMap<ESTree.CallExpression, SpecFunction>;
  readonly calleeByCall: ReadonlyMap<ESTree.CallExpression, Callee>;
  readonly fixtures: ReadonlyMap<string, Callee>;
  readonly ownerByCall: ReadonlyMap<ESTree.CallExpression, Owner | null>;
};

const readingOf = (collected: {
  readonly assertions: ReadonlySet<ESTree.CallExpression>;
  readonly calls: ReadonlySet<ESTree.CallExpression>;
  readonly fixtures: ReadonlyMap<string, Callee>;
  readonly rootNames: ReadonlySet<string>;
  readonly sourceCode: SourceCode;
}): Reading => {
  const { assertions, calls, fixtures, rootNames, sourceCode } = collected;
  const blocks = new Map<ESTree.CallExpression, SpecFunction>(
    [...calls].flatMap((call): readonly (readonly [ESTree.CallExpression, SpecFunction])[] => {
      if (!declaresTestBlock(call, rootNames)) return [];
      const blockFunction = testCallbacksOf(call).at(-1);
      return blockFunction === undefined ? [] : [[call, blockFunction]];
    }),
  );
  const calleeByCall = new Map<ESTree.CallExpression, Callee>(
    [...calls].flatMap((call): readonly (readonly [ESTree.CallExpression, Callee])[] => {
      if (blocks.has(call)) return [];
      const reached = helperCalledBy(sourceCode, call);
      return reached === null ? [] : [[call, reached]];
    }),
  );
  const owners = new Map<Node, Owner>([
    ...[...blocks.keys()].map((block): readonly [Node, Owner] => [block, { kind: "block", block }]),
    ...[...fixtures.values(), ...calleeByCall.values()].map((callee): readonly [Node, Owner] => [
      callee.body,
      { kind: "callee", callee },
    ]),
  ]);
  const ownerByCall = new Map<ESTree.CallExpression, Owner | null>(
    [...assertions, ...calleeByCall.keys()].map((call) => [
      call,
      sourceCode
        .getAncestors(call)
        .flatMap((ancestor) => {
          const owner = owners.get(ancestor);
          return owner === undefined ? [] : [owner];
        })
        .at(-1) ?? null,
    ]),
  );
  return { assertions, blocks, calleeByCall, fixtures, ownerByCall };
};

type Report = {
  readonly node: ESTree.Node;
  readonly messageId: string;
  readonly data: Readonly<Record<string, number | string>>;
};

type Placed = {
  readonly at: ESTree.Node;
  readonly count: number;
};

const inSourceOrder = <Held extends Placed>(placed: readonly Held[]): readonly Held[] =>
  placed.toSorted((earlier, later) => earlier.at.start - later.at.start);

const beyondBudget = (placed: readonly Placed[], budget: number): readonly Placed[] =>
  inSourceOrder(placed)
    .flatMap((placement) => range(0, placement.count).map(() => placement))
    .slice(budget);

const isUnder = (owner: Owner | null, enclosingNode: ESTree.Node): boolean => {
  if (owner === null) return false;
  return owner.kind === "block"
    ? owner.block === enclosingNode
    : owner.callee.body === enclosingNode;
};

type Traversal = {
  readonly total: number;
  readonly seen: ReadonlySet<SpecFunction>;
};

type Reached = Placed & { readonly through: Callee };

const throughText = (reached: readonly Reached[]): string =>
  reached
    .filter((contribution) => contribution.count !== 0)
    .map(
      (contribution) =>
        `${contribution.count} through the ${contribution.through.kind} \`${contribution.through.label}\``,
    )
    .join(", ");

const overflowingIn = (reading: Reading, budget: number): readonly Report[] => {
  const carriedBy = (enclosingNode: ESTree.Node): readonly ESTree.CallExpression[] =>
    [...reading.assertions].filter((assertion) =>
      isUnder(reading.ownerByCall.get(assertion) ?? null, enclosingNode),
    );
  const rootsUnder = (enclosingNode: ESTree.Node): readonly Reached[] =>
    [...reading.calleeByCall].flatMap(([call, through]) =>
      isUnder(reading.ownerByCall.get(call) ?? null, enclosingNode)
        ? [{ at: call, through, count: 0 }]
        : [],
    );
  const fixtureRootsOf = (specFunction: SpecFunction): readonly Reached[] =>
    (fixtureDependenciesOf(specFunction) ?? []).flatMap((dependency) => {
      const through = reading.fixtures.get(dependency.name);
      return through === undefined ? [] : [{ at: dependency.property, through, count: 0 }];
    });
  const reachedFrom = (source: Callee): readonly Callee[] =>
    source.kind === "fixture"
      ? [
          ...rootsUnder(source.body).map((root) => root.through),
          ...fixtureRootsOf(source.body).map((root) => root.through),
        ]
      : rootsUnder(source.body).map((root) => root.through);
  const assertionsThrough = (source: Callee, seen: ReadonlySet<SpecFunction>): Traversal =>
    seen.has(source.body)
      ? { total: 0, seen }
      : reachedFrom(source).reduce<Traversal>(
          (carried, reachedCallee) => {
            const through = assertionsThrough(reachedCallee, carried.seen);
            return { total: carried.total + through.total, seen: through.seen };
          },
          { total: carriedBy(source.body).length, seen: new Set([...seen, source.body]) },
        );

  return [...reading.blocks].flatMap(([block, blockFunction]) => {
    const { counted: reached } = inSourceOrder([
      ...fixtureRootsOf(blockFunction),
      ...rootsUnder(block),
    ]).reduce<{ readonly counted: readonly Reached[]; readonly seen: ReadonlySet<SpecFunction> }>(
      (carried, root) => {
        const through = assertionsThrough(root.through, carried.seen);
        return {
          counted: [...carried.counted, { ...root, count: through.total }],
          seen: through.seen,
        };
      },
      { counted: [], seen: new Set() },
    );
    const direct = carriedBy(block);
    const placed: readonly Placed[] = [
      ...direct.map((assertion) => ({ at: assertion, count: 1 })),
      ...reached,
    ];
    const attributed = placed.reduce(
      (carriedCount, placement) => carriedCount + placement.count,
      0,
    );
    const elsewhere = throughText(reached);
    return beyondBudget(placed, budget).map(
      (overflowing): Report => ({
        node: overflowing.at,
        messageId: elsewhere === "" ? "multiExpectIt" : "multiExpectItThroughCallees",
        data: { attributed, direct: direct.length, elsewhere, limit: budget },
      }),
    );
  });
};

const fixturesIn = (calls: readonly ESTree.CallExpression[]): ReadonlyMap<string, Callee> =>
  new Map(
    calls.flatMap((call) =>
      fixtureDeclarationsOf(call).flatMap((declaration): readonly (readonly [string, Callee])[] =>
        declaration.factory === null
          ? []
          : [
              [
                declaration.name,
                { kind: "fixture", label: declaration.name, body: declaration.factory },
              ],
            ],
      ),
    ),
  );

export const forbidMultiExpectIt = createDontReviewItRule({
  name: "forbid-multi-expect-it--split-into-separate-it",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a test block reaching more assertions than the budget set for it, counting the ones its callees carry as well, so a failing block names one behaviour and one cause",
      relatedGuidelines: [],
    },
    messages: {
      multiExpectIt:
        "A test block must not reach more than {{limit}} assertion. This block reaches {{attributed}}. Split it into one block per behaviour and name each block after the behaviour it pins. Merge the claims that all speak about a single returned value: have the fixture hand that value back and pin it whole with one exact comparison.",
      multiExpectItThroughCallees:
        "A test block must not reach more than {{limit}} assertion, counting the assertions carried by every helper and fixture it reaches. This block reaches {{attributed}}: {{direct}} written in its body and {{elsewhere}}. Split it into one block per behaviour and name each block after the behaviour it pins. Keep every assertion in the block that claims it; assertions parked in a helper or a fixture still run under this block's name.",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxAssertions: { type: "integer", minimum: 1 },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const budget = maxAssertionsFrom(inspection.options);

    return {
      "Program:exit"(program: ESTree.Program) {
        const found = nodesOfType(program, "CallExpression");
        const reading = readingOf({
          assertions: new Set(found.filter((call) => isAssertionCall(call))),
          calls: new Set(found.filter((call) => !isAssertionCall(call))),
          fixtures: fixturesIn(found),
          rootNames: testBlockRootNames(program),
          sourceCode: inspection.sourceCode,
        });
        for (const report of overflowingIn(reading, budget)) inspection.report(report);
      },
    };
  },
});
