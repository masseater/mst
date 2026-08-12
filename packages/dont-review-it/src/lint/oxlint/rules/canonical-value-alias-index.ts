import {
  joinCandidateSets,
  openCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { createCycleMemo } from "../lib/canonical-values/cycle-memo.ts";
import { propertyPathIsPrefixOf } from "../lib/canonical-values/property-path.ts";
import {
  appendCanonicalValueAliasAddressPath,
  canonicalValueAliasAddressKey,
  type CanonicalValueAliasAddress,
  type CanonicalValueAliasedAddress,
  type CanonicalValueAliasRuntime,
} from "./canonical-value-alias-address.ts";
import {
  canonicalValueActiveAliasRelations,
  type CanonicalValueAliasRelation,
} from "./canonical-value-alias-relation.ts";

import type { Variable } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type {
  CanonicalValuePropertyInternalQuery,
  CanonicalValuePropertyInternals,
} from "./canonical-value-property-runtime.ts";

export type CanonicalValueAliasIndex = {
  readonly addresses: (
    state: CanonicalValuePropertyInternals,
    query: CanonicalValuePropertyInternalQuery & { readonly binding: Variable },
  ) => CandidateSet<CanonicalValueAliasedAddress>;
};

type CanonicalValueAliasTransition = {
  readonly address: CanonicalValueAliasedAddress;
  readonly edgeKey: string;
};

type CanonicalValueAliasTraversal = {
  readonly address: CanonicalValueAliasedAddress;
  readonly visitedEdges: ReadonlySet<string>;
};

type CanonicalValueAliasClosure = {
  readonly complete: boolean;
  readonly found: readonly CanonicalValueAliasedAddress[];
  readonly frontier: readonly CanonicalValueAliasTraversal[];
};

const translatedAddress = (input: {
  readonly address: CanonicalValueAliasAddress;
  readonly from: CanonicalValueAliasAddress;
  readonly to: CanonicalValueAliasAddress;
}): CanonicalValueAliasAddress | null => {
  if (
    input.address.binding !== input.from.binding ||
    !propertyPathIsPrefixOf(input.from.path, input.address.path)
  ) {
    return null;
  }
  return appendCanonicalValueAliasAddressPath(
    input.to,
    input.address.path.slice(input.from.path.length),
  );
};

const relationTransitions = (
  address: CanonicalValueAliasedAddress,
  input: { readonly index: number; readonly relation: CanonicalValueAliasRelation },
): CandidateSet<CanonicalValueAliasTransition> => {
  const { index: relationIndex, relation } = input;
  const targetMatches = translatedAddress({ address, from: relation.target, to: relation.target });
  const forward =
    targetMatches === null
      ? []
      : relation.sources.candidates.flatMap((source) => {
          const translated = translatedAddress({ address, from: relation.target, to: source });
          return translated === null
            ? []
            : [
                {
                  address: { ...translated, definite: address.definite && relation.definite },
                  edgeKey: `${relationIndex}:forward:${canonicalValueAliasAddressKey(source)}`,
                },
              ];
        });
  const reverse = relation.sources.candidates.flatMap((source) => {
    const translated = translatedAddress({ address, from: source, to: relation.target });
    return translated === null
      ? []
      : [
          {
            address: { ...translated, definite: address.definite && relation.definite },
            edgeKey: `${relationIndex}:reverse:${canonicalValueAliasAddressKey(source)}`,
          },
        ];
  });
  const incident = targetMatches !== null || reverse.length !== 0;
  return {
    candidates: [...forward, ...reverse],
    complete: !incident || relation.sources.complete,
  };
};

const addressTransitions = (
  relations: readonly CanonicalValueAliasRelation[],
  address: CanonicalValueAliasedAddress,
): CandidateSet<CanonicalValueAliasTransition> =>
  joinCandidateSets(
    relations.map((relation, index) => relationTransitions(address, { index, relation })),
    (transition) =>
      `${transition.edgeKey}:${canonicalValueAliasAddressKey(transition.address)}:${transition.address.definite}`,
  );

const mergeFoundAddress = (
  found: readonly CanonicalValueAliasedAddress[],
  address: CanonicalValueAliasedAddress,
): readonly CanonicalValueAliasedAddress[] => {
  const previous = found.find(
    (candidate) =>
      canonicalValueAliasAddressKey(candidate) === canonicalValueAliasAddressKey(address),
  );
  if (previous === undefined) return [...found, address];
  return !previous.definite && address.definite
    ? found.map((candidate) => (candidate === previous ? address : candidate))
    : found;
};

const addressAlreadyFound = (
  found: readonly CanonicalValueAliasedAddress[],
  address: CanonicalValueAliasedAddress,
): boolean => {
  const previous = found.find(
    (candidate) =>
      canonicalValueAliasAddressKey(candidate) === canonicalValueAliasAddressKey(address),
  );
  return previous !== undefined && (previous.definite || !address.definite);
};

const advanceAliasTraversal = (
  relations: readonly CanonicalValueAliasRelation[],
  input: {
    readonly closure: CanonicalValueAliasClosure;
    readonly traversal: CanonicalValueAliasTraversal;
  },
): CanonicalValueAliasClosure => {
  if (addressAlreadyFound(input.closure.found, input.traversal.address)) return input.closure;
  const transitions = addressTransitions(relations, input.traversal.address);
  const found = mergeFoundAddress(input.closure.found, input.traversal.address);
  const available = transitions.candidates.filter(
    (transition) => !input.traversal.visitedEdges.has(transition.edgeKey),
  );
  const cyclic = transitions.candidates.filter((transition) =>
    input.traversal.visitedEdges.has(transition.edgeKey),
  );
  return {
    complete:
      input.closure.complete &&
      transitions.complete &&
      cyclic.every((transition) => addressAlreadyFound(found, transition.address)),
    found,
    frontier: [
      ...input.closure.frontier,
      ...available.map((transition) => ({
        address: transition.address,
        visitedEdges: new Set([...input.traversal.visitedEdges, transition.edgeKey]),
      })),
    ],
  };
};

const closeAliasGraph = (
  relations: readonly CanonicalValueAliasRelation[],
  closure: CanonicalValueAliasClosure,
): CandidateSet<CanonicalValueAliasedAddress> => {
  if (closure.frontier.length === 0) {
    return { candidates: closure.found, complete: closure.complete };
  }
  const next = closure.frontier.reduce<CanonicalValueAliasClosure>(
    (state, traversal) => advanceAliasTraversal(relations, { closure: state, traversal }),
    { complete: closure.complete, found: closure.found, frontier: [] },
  );
  return closeAliasGraph(relations, next);
};

const equivalentAddresses = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & { readonly binding: Variable },
): CandidateSet<CanonicalValueAliasedAddress> =>
  closeAliasGraph(canonicalValueActiveAliasRelations(runtime, input), {
    complete: true,
    found: [],
    frontier: [
      {
        address: { binding: input.binding, definite: true, path: input.path },
        visitedEdges: new Set(),
      },
    ],
  });

const activeAliasAddresses = (input: {
  readonly active: Set<Variable>;
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly propertyState: CanonicalValuePropertyInternals;
  readonly query: CanonicalValuePropertyInternalQuery & { readonly binding: Variable };
}): CandidateSet<CanonicalValueAliasedAddress> => {
  input.active.add(input.query.binding);
  try {
    return equivalentAddresses(
      { bindingIndex: input.bindingIndex, propertyState: input.propertyState },
      input.query,
    );
  } finally {
    input.active.delete(input.query.binding);
  }
};

export const createCanonicalValueAliasIndex = (
  bindingIndex: CanonicalValueBindingIndex,
): CanonicalValueAliasIndex => {
  const active = new Set<Variable>();
  const memo = createCycleMemo<
    CandidateSet<CanonicalValueAliasedAddress>,
    Variable,
    "alias",
    CanonicalValuePropertyInternalQuery["executionContext"]
  >();
  return {
    addresses: (propertyState, query) => {
      if (active.has(query.binding)) {
        return openCandidateSet<CanonicalValueAliasedAddress>([], canonicalValueAliasAddressKey);
      }
      const entry = memo.enter({
        cutoff: query.cutoff,
        domain: "alias",
        executionContext: query.executionContext,
        identity: query.binding,
        path: query.path,
      });
      if (entry.kind === "cycle") {
        return openCandidateSet<CanonicalValueAliasedAddress>([], canonicalValueAliasAddressKey);
      }
      if (entry.kind === "cached") return entry.value;
      const addresses = activeAliasAddresses({ active, bindingIndex, propertyState, query });
      entry.complete(addresses);
      return addresses;
    },
  };
};
