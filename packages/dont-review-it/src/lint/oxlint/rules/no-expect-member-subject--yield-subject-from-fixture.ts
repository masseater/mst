import { createDontReviewItRule } from "../../../create-rule.ts";
import { resolveBinding, type ScopeLookup } from "../lib/resolved-bindings.ts";
import { isAssertionEntryCall } from "../lib/spec-syntax/assertion-entries.ts";
import { destructuredBindingsOf } from "../lib/spec-syntax/destructured-bindings.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { unwrapSubject, type SpecFunction } from "../lib/spec-syntax/subject-expressions.ts";
import { TABLE_DRIVEN_MEMBERS } from "../lib/spec-syntax/table-driven-titles.ts";
import {
  declaresTestBlock,
  testBlockBindings,
  testCallbacksOf,
} from "../lib/spec-syntax/test-block-declarations.ts";
import { testBlockModifiersOf } from "../lib/spec-syntax/test-block-modifiers.ts";

import type { ESTree, Variable } from "@oxlint/plugins";

const HANDED_SUBJECT_DEPTH = 1;

type HandedSite =
  | { readonly name: ESTree.BindingIdentifier; readonly depth: number; readonly kind: "handed" }
  | {
      readonly name: ESTree.BindingIdentifier;
      readonly depth: number;
      readonly kind: "declared";
      readonly init: ESTree.Expression | null;
    };

const MESSAGE_IDS: Readonly<Record<HandedSite["kind"], string>> = {
  handed: "destructuredMemberSubject",
  declared: "boundMemberSubject",
};

type SubjectReading = {
  readonly depth: number;
  readonly messageId: string;
};

type Lookup = {
  readonly sites: readonly HandedSite[];
  readonly scopeAt: ScopeLookup;
};

type Reading = {
  readonly lookup: Lookup;
  readonly walked: ReadonlySet<Variable>;
};

const handsRowsToCallback = (call: ESTree.CallExpression): boolean =>
  testBlockModifiersOf(call.callee).some((modifier) => TABLE_DRIVEN_MEMBERS.has(modifier.name));

const contextSitesOf = (taken: SpecFunction): readonly HandedSite[] => {
  const [parameter] = taken.params;
  if (parameter === undefined) return [];
  return destructuredBindingsOf(parameter).map((binding) => ({
    name: binding.name,
    depth: binding.depth,
    kind: "handed",
  }));
};

const declaredSitesOf = (declarator: ESTree.VariableDeclarator): readonly HandedSite[] =>
  destructuredBindingsOf(declarator.id).map((binding) => ({
    name: binding.name,
    depth: binding.depth,
    kind: "declared",
    init: declarator.init,
  }));

const depthOf = (at: ESTree.Expression, reading: Reading): number | null => {
  const written = unwrapSubject(at);
  if (written.type === "MemberExpression") {
    const carried = depthOf(written.object, reading);
    return carried === null ? null : carried + 1;
  }
  if (written.type !== "Identifier") return null;
  return readingOfName(written, reading)?.depth ?? null;
};

const carriedDepthOf = (site: HandedSite, reading: Reading): number | null => {
  if (site.kind === "handed") return site.depth;
  if (site.init === null) return null;

  const carried = depthOf(site.init, reading);
  return carried === null ? null : carried + site.depth;
};

const readingOfName = (
  identifier: ESTree.IdentifierReference,
  reading: Reading,
): SubjectReading | null => {
  const bound = resolveBinding(reading.lookup.scopeAt(identifier), identifier.name);
  if (bound === null || reading.walked.has(bound)) return null;

  const reached = { ...reading, walked: new Set([...reading.walked, bound]) };
  return (
    bound.defs
      .flatMap((definition) => reading.lookup.sites.filter((site) => site.name === definition.name))
      .flatMap((site) => {
        const depth = carriedDepthOf(site, reached);
        return depth === null ? [] : [{ depth, messageId: MESSAGE_IDS[site.kind] }];
      })[0] ?? null
  );
};

const readingOfSubject = (subject: ESTree.Expression, lookup: Lookup): SubjectReading | null => {
  const reading = { lookup, walked: new Set<Variable>() };
  if (subject.type === "MemberExpression") {
    const depth = depthOf(subject, reading);
    return depth === null ? null : { depth, messageId: "memberSubject" };
  }
  return subject.type === "Identifier" ? readingOfName(subject, reading) : null;
};

const reportedSubjectIn = (
  assertionEntry: ESTree.CallExpression,
  lookup: Lookup,
): { readonly node: ESTree.Expression; readonly messageId: string } | null => {
  const [handed] = assertionEntry.arguments;
  if (handed === undefined || handed.type === "SpreadElement") return null;

  const subject = unwrapSubject(handed);
  const reading = readingOfSubject(subject, lookup);
  if (reading === null || reading.depth <= HANDED_SUBJECT_DEPTH) return null;
  return { node: subject, messageId: reading.messageId };
};

export const noExpectMemberSubject = createDontReviewItRule({
  name: "no-expect-member-subject--yield-subject-from-fixture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow handing an assertion a member reached off the value a fixture handed over, so the faces of that value the spec never names cannot pass unread",
      relatedGuidelines: [],
    },
    messages: {
      memberSubject:
        "The subject of an assertion must not be a member reached off the value a fixture handed over. `{{subject}}` names one face of that value, and every face left unnamed here passes unread. Split the fixture into one fixture per face, or assert the whole value the fixture hands over with an exact matcher. Pushing the member read into the fixture leaves the same narrowed subject standing.",
      boundMemberSubject:
        "The subject of an assertion must not be a binding that holds a member reached off the value a fixture handed over. `{{subject}}` arrives at that member through the bindings this spec declares, and every face left unnamed here passes unread. Split the fixture into one fixture per face, or assert the whole value the fixture hands over with an exact matcher.",
      destructuredMemberSubject:
        "The subject of an assertion must not be a binding taken out of a pattern nested inside the test context. `{{subject}}` names one face of the value a fixture handed over, and every face left unnamed here passes unread. Take the fixture value whole in the taken parameter, and split the fixture into one fixture per face or assert the whole value with an exact matcher. Renaming the binding in the pattern leaves the face it names unchanged.",
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

    const blockBindings = testBlockBindings();
    const calls = new Set<ESTree.CallExpression>();
    const listedEntries = new Set<ESTree.CallExpression>();
    const declarators = new Set<ESTree.VariableDeclarator>();

    return {
      ImportDeclaration: blockBindings.takeImport,
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        blockBindings.takeLocalBinding(node);
        declarators.add(node);
      },
      CallExpression(node: ESTree.CallExpression) {
        calls.add(node);
        if (isAssertionEntryCall(node)) listedEntries.add(node);
      },
      "Program:exit"() {
        const rootNames = blockBindings.rootNames();
        const specCallbacks = [...calls]
          .filter((call) => declaresTestBlock(call, rootNames) && !handsRowsToCallback(call))
          .flatMap((call) => testCallbacksOf(call));

        const lookup: Lookup = {
          sites: [
            ...specCallbacks.flatMap((taken: SpecFunction) => contextSitesOf(taken)),
            ...[...declarators].flatMap((declarator) => declaredSitesOf(declarator)),
          ],
          scopeAt: (node: ESTree.Node) => inspection.sourceCode.getScope(node),
        };

        for (const assertionEntry of listedEntries) {
          const reported = reportedSubjectIn(assertionEntry, lookup);
          if (reported === null) continue;
          inspection.report({
            node: reported.node,
            messageId: reported.messageId,
            data: { subject: inspection.sourceCode.getText(reported.node) },
          });
        }
      },
    };
  },
});
