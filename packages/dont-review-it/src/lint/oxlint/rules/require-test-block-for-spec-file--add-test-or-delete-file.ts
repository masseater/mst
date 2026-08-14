import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";
import { TABLE_DRIVEN_MEMBERS } from "../lib/spec-syntax/table-driven-titles.ts";
import {
  declaresTestBlock,
  groupingBlockRootNames,
  testBlockRootNames,
  testCallbacksOf,
} from "../lib/spec-syntax/test-block-declarations.ts";
import {
  testBlockModifiersOf,
  type TestBlockModifierUse,
} from "../lib/spec-syntax/test-block-modifiers.ts";

import type { ESTree } from "@oxlint/plugins";

type NameOrigins = {
  readonly imported: ReadonlySet<string>;
  readonly initializers: ReadonlyMap<string, ESTree.Expression>;
};

const originsIn = (program: ESTree.Program): NameOrigins => ({
  imported: new Set(
    nodesOfType(program, "ImportDeclaration").flatMap((declaration) =>
      declaration.specifiers.map((specifier) => specifier.local.name),
    ),
  ),
  initializers: new Map(
    nodesOfType(program, "VariableDeclarator").flatMap(
      (declarator): readonly (readonly [string, ESTree.Expression])[] =>
        declarator.id.type === "Identifier" && declarator.init !== null
          ? [[declarator.id.name, declarator.init]]
          : [],
    ),
  ),
});

const rootNameOf = (expression: ESTree.Expression): string | null => {
  const written = unwrapSubject(expression);
  if (written.type === "Identifier") return written.name;
  if (written.type === "MemberExpression") return rootNameOf(written.object);
  if (written.type === "CallExpression") return rootNameOf(written.callee);
  if (written.type === "TaggedTemplateExpression") return rootNameOf(written.tag);
  return null;
};

const isImportBound = ({
  name,
  origins,
  seen,
}: {
  readonly name: string;
  readonly origins: NameOrigins;
  readonly seen: ReadonlySet<string>;
}): boolean => {
  if (origins.imported.has(name)) return true;
  if (seen.has(name)) return false;

  const initializer = origins.initializers.get(name);
  const root = initializer === undefined ? null : rootNameOf(initializer);
  return root !== null && isImportBound({ name: root, origins, seen: new Set([...seen, name]) });
};

const isInside = (
  call: ESTree.CallExpression,
  holders: readonly ESTree.CallExpression[],
): boolean => holders.some((holder) => holder.start <= call.start && call.end <= holder.end);

const reachesAnotherModule = ({
  calls,
  origins,
  testApiNames,
  testTimeCalls,
}: {
  readonly calls: readonly ESTree.CallExpression[];
  readonly origins: NameOrigins;
  readonly testApiNames: ReadonlySet<string>;
  readonly testTimeCalls: readonly ESTree.CallExpression[];
}): boolean =>
  calls.some((call) => {
    const root = rootNameOf(call.callee);
    if (root === null || testApiNames.has(root)) return false;
    if (!isImportBound({ name: root, origins, seen: new Set() })) return false;
    return !isInside(call, testTimeCalls);
  });

const verdictOf = ({
  runs,
  groups,
}: {
  readonly runs: readonly (boolean | null)[];
  readonly groups: readonly ESTree.CallExpression[];
}): string | null => {
  if (runs.some((run) => run !== false)) return null;
  if (runs.length !== 0) return "heldBackTestBlocks";
  return groups.length === 0 ? "noTestBlock" : "onlyGroupingBlocks";
};

const HELD_BACK_MODIFIERS: ReadonlySet<string> = new Set(["skip", "todo"]);

const isHeldBack = (modifiers: readonly TestBlockModifierUse[]): boolean =>
  modifiers.some((modifier) => HELD_BACK_MODIFIERS.has(modifier.name));

const rowCountOf = (table: ESTree.Expression): number | null => {
  const written = unwrapSubject(table);
  if (written.type !== "ArrayExpression") return null;
  const spread = written.elements.some((held) => held?.type === "SpreadElement");
  return spread ? null : written.elements.length;
};

const runsFromTable = (use: TestBlockModifierUse): boolean | null => {
  const [table] = use.handed ?? [];
  if (table === undefined) return null;

  const linedRows = rowCountOf(table);
  return linedRows === null ? null : linedRows !== 0;
};

const runsIn = (call: ESTree.CallExpression): boolean | null => {
  const modifiers = testBlockModifiersOf(call.callee);
  if (isHeldBack(modifiers)) return false;
  if (call.arguments.some((argument) => argument.type === "SpreadElement")) return null;

  const table = modifiers.find((modifier) => TABLE_DRIVEN_MEMBERS.has(modifier.name));
  const linedRows = table === undefined ? true : runsFromTable(table);
  if (linedRows !== true) return linedRows;

  if (testCallbacksOf(call).length !== 0) return true;

  const [, ...beyondTitle] = call.arguments;
  return beyondTitle.length === 0 ? false : null;
};

const calleeCallsOf = (call: ESTree.CallExpression): readonly ESTree.CallExpression[] => {
  const written = unwrapSubject(call.callee);
  return written.type === "CallExpression" ? [written, ...calleeCallsOf(written)] : [];
};

const messageIdFor = ({
  calls,
  blockNames,
  groupNames,
  origins,
}: {
  readonly calls: readonly ESTree.CallExpression[];
  readonly blockNames: ReadonlySet<string>;
  readonly groupNames: ReadonlySet<string>;
  readonly origins: NameOrigins;
}): string | null => {
  const testTimeCalls = calls.filter((call) => blockNames.has(rootNameOf(call.callee) ?? ""));
  const beyondReading = reachesAnotherModule({
    calls,
    origins,
    testApiNames: new Set([...blockNames, ...groupNames]),
    testTimeCalls,
  });
  if (beyondReading) return null;

  const carriedModifiers = new Set(calls.flatMap((call) => calleeCallsOf(call)));
  const declared = calls.filter((call) => !carriedModifiers.has(call));

  const groupedSets = declared.filter((call) => declaresTestBlock(call, groupNames));
  const heldBackGroups = groupedSets.filter((call) =>
    isHeldBack(testBlockModifiersOf(call.callee)),
  );
  const runs = declared
    .filter((call) => declaresTestBlock(call, blockNames))
    .map((call) => (isInside(call, heldBackGroups) ? false : runsIn(call)));

  return verdictOf({ runs, groups: groupedSets });
};

export const requireTestBlockForSpecFile = createDontReviewItRule({
  name: "require-test-block-for-spec-file--add-test-or-delete-file",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a file named as a spec to declare at least one test block that runs, so naming a file a spec costs a check that actually executes rather than buying the standing of a spec for free",
      relatedGuidelines: [],
    },
    messages: {
      noTestBlock:
        "A file named as a spec must not stand without a test block that runs. This one declares no block at all. Write the block that checks what the subject is expected to do, or delete this file together with the test data named after its stem.",
      onlyGroupingBlocks:
        "A file named as a spec must not stand on grouping blocks alone. The groups here hold no test block, and a group checks nothing of its own. Write the block each group promises, or delete this file together with the test data named after its stem.",
      heldBackTestBlocks:
        "A file named as a spec must not stand on test blocks that are all held back. Every block here is marked as skipped or as todo, left standing without a body, or driven by a table written out empty. Write a block that runs, or delete this file together with the test data named after its stem.",
    },
    schema: [
      {
        type: "object",
        properties: {
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    return {
      "Program:exit"(node: ESTree.Program) {
        const messageId = messageIdFor({
          calls: nodesOfType(node, "CallExpression"),
          blockNames: testBlockRootNames(node),
          groupNames: groupingBlockRootNames(node),
          origins: originsIn(node),
        });
        if (messageId === null) return;
        inspection.report({ node, messageId });
      },
    };
  },
});
