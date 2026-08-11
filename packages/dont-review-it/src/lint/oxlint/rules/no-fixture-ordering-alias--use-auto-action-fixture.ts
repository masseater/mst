import { createDontReviewItRule } from "../../../create-rule.ts";
import { resolveBinding, type ScopeLookup } from "../lib/resolved-bindings.ts";
import {
  fixtureDeclarationsOf,
  fixtureDependenciesOf,
  type FixtureDependency,
} from "../lib/spec-syntax/fixture-declarations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";

import type { ESTree, Options, Reference, Variable } from "@oxlint/plugins";

const DEFAULT_ORDERING_ALIAS_PREFIXES: readonly string[] = ["_"];

const ORDERING_ALIAS_PREFIXES_OPTION = "orderingAliasPrefixes";

const DISCARDING_OPERATOR = "void";

type Placement = {
  readonly holder: ESTree.Node;
  readonly held: ESTree.Node;
};

type OrderingReport = {
  readonly node: ESTree.Node;
  readonly messageId: string;
  readonly data: { readonly dependency: string; readonly bound: string };
};

const orderingAliasPrefixesFrom = (options: Readonly<Options>): readonly string[] => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return DEFAULT_ORDERING_ALIAS_PREFIXES;
  }

  const configured = first[ORDERING_ALIAS_PREFIXES_OPTION];
  if (!Array.isArray(configured)) return DEFAULT_ORDERING_ALIAS_PREFIXES;
  return configured.filter((entry): entry is string => typeof entry === "string");
};

const isOrderingAlias = (input: {
  readonly boundAs: string;
  readonly name: string;
  readonly prefixes: readonly string[];
}): boolean => {
  const { boundAs, name, prefixes } = input;
  return boundAs !== name && prefixes.some((prefix) => boundAs.startsWith(prefix));
};

const placementOf = (reference: Reference): Placement => {
  const held = reference.identifier;
  const holder = held.parent;
  return holder.type === "AwaitExpression"
    ? { holder: holder.parent, held: holder }
    : { holder, held };
};

const isDiscarded = ({ holder }: Placement): boolean =>
  holder.type === "ExpressionStatement" ||
  (holder.type === "UnaryExpression" && holder.operator === DISCARDING_OPERATOR);

const handedOnAt = ({
  holder,
  held,
}: Placement): { readonly name: string; readonly at: ESTree.Node } | null => {
  if (holder.type === "VariableDeclarator") {
    return holder.id.type === "Identifier" ? { name: holder.id.name, at: holder.id } : null;
  }
  if (holder.type === "AssignmentExpression" && holder.right === held) {
    return holder.left.type === "Identifier" ? { name: holder.left.name, at: holder.left } : null;
  }
  return null;
};

const consumesValue = (input: {
  readonly scopeAt: ScopeLookup;
  readonly binding: Variable | null;
  readonly reached: Set<Variable>;
}): boolean => {
  const { scopeAt, binding, reached } = input;
  if (binding === null) return true;
  if (reached.has(binding)) return false;

  reached.add(binding);
  return binding.references
    .filter((reference) => reference.isRead())
    .some((reference) => {
      const placement = placementOf(reference);
      if (isDiscarded(placement)) return false;

      const handoff = handedOnAt(placement);
      if (handoff === null) return true;
      return consumesValue({
        scopeAt,
        binding: resolveBinding(scopeAt(handoff.at), handoff.name),
        reached,
      });
    });
};

const reportFor = (input: {
  readonly scopeAt: ScopeLookup;
  readonly dependency: FixtureDependency;
  readonly prefixes: readonly string[];
}): OrderingReport | null => {
  const { scopeAt, dependency, prefixes } = input;
  const { name, boundAs, property } = dependency;
  if (boundAs === null) return null;

  const spelling = { dependency: name, bound: boundAs };
  if (isOrderingAlias({ boundAs, name, prefixes })) {
    return { node: property, messageId: "orderingAlias", data: spelling };
  }

  const binding = resolveBinding(scopeAt(property.value), boundAs);
  if (consumesValue({ scopeAt, binding, reached: new Set() })) return null;
  return { node: property, messageId: "unconsumedDependency", data: spelling };
};

const reportsFor = (input: {
  readonly scopeAt: ScopeLookup;
  readonly call: ESTree.CallExpression;
  readonly prefixes: readonly string[];
}): readonly OrderingReport[] => {
  const { scopeAt, call, prefixes } = input;
  return fixtureDeclarationsOf(call).flatMap(({ factory }) => {
    if (factory === null) return [];

    return (fixtureDependenciesOf(factory) ?? []).flatMap((dependency) => {
      const report = reportFor({ scopeAt, dependency, prefixes });
      return report === null ? [] : [report];
    });
  });
};

export const noFixtureOrderingAlias = createDontReviewItRule({
  name: "no-fixture-ordering-alias--use-auto-action-fixture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a fixture taking apart a dependency whose value it never consumes, so the dependency graph a spec declares is the data flow it has rather than an order somebody wanted the fixtures to run in",
      relatedGuidelines: [],
    },
    messages: {
      orderingAlias:
        "A fixture must not take a dependency apart into a name marked as unused. `{{dependency}}` is bound as `{{bound}}`. Delete the dependency, move the work it was ordering into one action fixture declared with `{ auto: true }`, and take apart only the values a fixture hands back for the assertions. Dropping the prefix and leaving the dependency unread, and spelling the same unread dependency without a prefix from the start, are reported all the same.",
      unconsumedDependency:
        "A fixture must not declare a dependency whose value it never consumes. `{{dependency}}` is bound as `{{bound}}`, and every reference to it drops the value. Delete the dependency, move the work it was ordering into one action fixture declared with `{ auto: true }`, and take apart only the values a fixture hands back for the assertions. Naming the binding on a line of its own, handing it to `void`, and assigning it to another binding that is dropped the same way all leave it unconsumed.",
    },
    schema: [
      {
        type: "object",
        properties: {
          orderingAliasPrefixes: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (!isSpecFile(context.filename, specFileSuffixesFrom(context.options))) return {};

    const scopeAt: ScopeLookup = (node) => context.sourceCode.getScope(node);
    const prefixes = orderingAliasPrefixesFrom(context.options);

    return {
      CallExpression(node: ESTree.CallExpression) {
        for (const report of reportsFor({ scopeAt, call: node, prefixes })) {
          context.report(report);
        }
      },
    };
  },
});
