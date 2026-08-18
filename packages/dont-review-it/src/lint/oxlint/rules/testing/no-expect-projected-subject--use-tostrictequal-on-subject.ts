import { createDontReviewItRule } from "../../../../create-rule.ts";
import { nodesOfType } from "../../lib/nodes-of-type.ts";
import { isAssertionEntryCall } from "../../lib/spec-syntax/assertion-entries.ts";
import { fixtureDependenciesOf } from "../../lib/spec-syntax/fixture-declarations.ts";
import {
  ASSERTION_CHAIN_MODIFIERS,
  SNAPSHOT_MATCHERS,
} from "../../lib/spec-syntax/matcher-vocabulary.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";
import { staticMemberName } from "../../lib/spec-syntax/static-names.ts";
import { memberRootOf, unwrapSubject } from "../../lib/spec-syntax/subject-expressions.ts";
import {
  declaresTestBlock,
  testBlockRootNames,
  testCallbacksOf,
} from "../../lib/spec-syntax/test-block-declarations.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const SNAPSHOT_MATCHERS_OPTION = "snapshotMatchers";

const snapshotMatchersFrom = (ruleOptions: Readonly<Options>): ReadonlySet<string> => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return SNAPSHOT_MATCHERS;

  const configured = first[SNAPSHOT_MATCHERS_OPTION];
  if (!Array.isArray(configured)) return SNAPSHOT_MATCHERS;
  return new Set(
    configured.filter(
      (configuredMatcher): configuredMatcher is string => typeof configuredMatcher === "string",
    ),
  );
};

const matcherCalledOn = (node: ESTree.Node): string | null => {
  const { parent } = node;
  if (parent?.type !== "MemberExpression") return null;

  const member = staticMemberName(parent);
  if (member === null) return null;
  if (ASSERTION_CHAIN_MODIFIERS.has(member)) return matcherCalledOn(parent);

  const called = parent.parent;
  return called.type === "CallExpression" && called.callee === parent ? member : null;
};

const DERIVED_SUBJECT = "derivedSubject";

const OWNED_BY_ANOTHER_RULE: ReadonlySet<string> = new Set([
  "CallExpression",
  "NewExpression",
  "ObjectExpression",
  "TaggedTemplateExpression",
]);

const SUBJECT_SHAPES: ReadonlyMap<string, string> = new Map([
  ["ArrayExpression", "bundledSubject"],
  ["ArrowFunctionExpression", "inlineFunctionSubject"],
  ["FunctionExpression", "inlineFunctionSubject"],
  ["Literal", "writtenOutSubject"],
  ["MemberExpression", "projectedSubject"],
]);

const messageIdFor = (subject: ESTree.Expression): string | null => {
  if (subject.type === "Identifier") return null;
  if (OWNED_BY_ANOTHER_RULE.has(subject.type)) return null;
  if (subject.type === "TemplateLiteral" && subject.expressions.length === 0) {
    return "writtenOutSubject";
  }
  return SUBJECT_SHAPES.get(subject.type) ?? DERIVED_SUBJECT;
};

const siblingListOf = (call: ESTree.CallExpression): ESTree.Node | null => {
  const statement = call.parent;
  return statement.type === "ExpressionStatement" ? statement.parent : null;
};

type BlockSite = {
  readonly block: ESTree.CallExpression;
  readonly siblings: ESTree.Node | null;
};

const blockSiteAround = (node: ESTree.Node, rootNames: ReadonlySet<string>): BlockSite | null => {
  const { parent } = node;
  if (parent === null) return null;
  if (parent.type === "CallExpression" && declaresTestBlock(parent, rootNames)) {
    return { block: parent, siblings: siblingListOf(parent) };
  }
  return blockSiteAround(parent, rootNames);
};

const fixtureBoundName = (block: ESTree.CallExpression, local: string): string | null =>
  testCallbacksOf(block)
    .flatMap((testCallback) => fixtureDependenciesOf(testCallback) ?? [])
    .find((dependency) => dependency.boundAs === local)?.name ?? null;

const fixtureRootOf = (subject: ESTree.Expression, site: BlockSite | null): string | null => {
  if (site === null || subject.type !== "MemberExpression") return null;

  const root = memberRootOf(subject);
  return root === null ? null : fixtureBoundName(site.block, root.name);
};

const handedTo = (
  assertionEntry: ESTree.CallExpression,
): ESTree.Expression | ESTree.SpreadElement | null => {
  const [handed] = assertionEntry.arguments;
  return handed ?? null;
};

type Projection = {
  readonly at: ESTree.Node;
  readonly messageId: string;
  readonly root: string | null;
  readonly site: BlockSite | null;
};

const projectionOf = (
  assertionEntry: ESTree.CallExpression,
  rootNames: ReadonlySet<string>,
): Projection | null => {
  const handed = handedTo(assertionEntry);
  if (handed === null) return null;
  if (handed.type === "SpreadElement") {
    return { at: handed, messageId: DERIVED_SUBJECT, root: null, site: null };
  }

  const subject = unwrapSubject(handed);
  const messageId = messageIdFor(subject);
  if (messageId === null) return null;

  const site = blockSiteAround(assertionEntry, rootNames);
  return { at: subject, messageId, root: fixtureRootOf(subject, site), site };
};

type SnapshotPin = {
  readonly root: string;
  readonly site: BlockSite;
};

const excusedBy = (pin: SnapshotPin, projection: Projection): boolean =>
  projection.root !== null &&
  projection.site !== null &&
  projection.site.siblings !== null &&
  pin.root === projection.root &&
  pin.site.siblings === projection.site.siblings &&
  pin.site.block !== projection.site.block;

export const noExpectProjectedSubject = createDontReviewItRule({
  name: "no-expect-projected-subject--use-tostrictequal-on-subject",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow handing an assertion anything other than the bare binding a fixture produced, so one comparison of the whole subject catches a missing field, an added field and a renamed field alike",
      relatedGuidelines: ["docs/guidelines/tests.md"],
    },
    messages: {
      projectedSubject:
        "The subject of an assertion must not be a member read off the binding a fixture handed back. Assert the whole binding with `toStrictEqual`. Pin a mock by having its fixture hand the mock binding itself back and stating the calls with `toHaveBeenCalledWith`.",
      bundledSubject:
        "The subject of an assertion must not be a list built inside the assertion out of the parts of a binding. Assert the whole binding a fixture handed back with `toStrictEqual`.",
      inlineFunctionSubject:
        "The subject of an assertion must not be a function written inside the assertion. Move that function into a fixture and hand the assertion the binding the fixture returns.",
      writtenOutSubject:
        "The subject of an assertion must not be a value spelled out in the spec. Bind the value the code under test produced in a fixture and assert that binding.",
      derivedSubject:
        "The subject of an assertion must not be an expression evaluated inside the assertion. Move that expression into a fixture and hand the assertion the binding the fixture returns.",
    },
    schema: [
      {
        type: "object",
        properties: {
          snapshotMatchers: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const snapshotMatchers = snapshotMatchersFrom(inspection.options);

    const pinOf = (
      assertionEntry: ESTree.CallExpression,
      rootNames: ReadonlySet<string>,
    ): SnapshotPin | null => {
      const handed = handedTo(assertionEntry);
      if (handed === null || handed.type === "SpreadElement") return null;

      const subject = unwrapSubject(handed);
      if (subject.type !== "Identifier") return null;

      const matcher = matcherCalledOn(assertionEntry);
      if (matcher === null || !snapshotMatchers.has(matcher)) return null;

      const site = blockSiteAround(assertionEntry, rootNames);
      if (site === null) return null;

      const root = fixtureBoundName(site.block, subject.name);
      return root === null ? null : { root, site };
    };

    return {
      "Program:exit"(program: ESTree.Program) {
        const rootNames = testBlockRootNames(program);
        const assertionEntries = nodesOfType(program, "CallExpression").filter((call) =>
          isAssertionEntryCall(call),
        );
        const pins = assertionEntries.flatMap((assertionEntry) => {
          const pin = pinOf(assertionEntry, rootNames);
          return pin === null ? [] : [pin];
        });

        for (const assertionEntry of assertionEntries) {
          const projection = projectionOf(assertionEntry, rootNames);
          if (projection === null) continue;
          if (pins.some((pin) => excusedBy(pin, projection))) continue;
          inspection.report({ node: projection.at, messageId: projection.messageId });
        }
      },
    };
  },
});
