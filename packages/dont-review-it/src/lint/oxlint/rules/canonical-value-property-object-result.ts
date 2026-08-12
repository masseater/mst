import {
  appendCandidateSets,
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { isCanonicalValue, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { propertyPathsEqual } from "../lib/canonical-values/property-path.ts";
import { canonicalValuePropertyKeyOf } from "./canonical-value-binding-index.ts";
import { canonicalValueArgumentExpression } from "./canonical-value-call-arguments.ts";
import {
  canonicalValueExpressionOrigin,
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import {
  canonicalValueAbsentOriginSet,
  type CanonicalValuePropertyInternals,
  type CanonicalValueResolvedPropertyQuery,
} from "./canonical-value-property-runtime.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";

import type { ESTree } from "@oxlint/plugins";

type ObjectResultInput = CanonicalValueResolvedPropertyQuery;

const invocationMatch = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput & {
    readonly callee: ESTree.Expression;
    readonly globalName: string;
    readonly path: readonly string[];
  },
): { readonly complete: boolean } | null => {
  const origins = input.resolve(state, { ...input, expression: input.callee, path: [] });
  const paths = origins.candidates.flatMap((origin) => {
    if (origin.kind !== "expression") return [];
    const path = canonicalValueStaticGlobalPropertyPath(state.bindingIndex, {
      name: input.globalName,
      origin,
    });
    return path === null ? [] : [{ origin, path }];
  });
  const matching = paths.filter((candidate) => propertyPathsEqual(candidate.path, input.path));
  if (matching.length === 0) return null;
  return {
    complete:
      origins.complete &&
      paths.length === origins.candidates.length &&
      matching.length === paths.length,
  };
};

const expressionSequenceKey = (expressions: readonly ESTree.Expression[]): string =>
  expressions.map((expression) => `${expression.start}:${expression.end}`).join(",");

const expressionKey = (expression: ESTree.Expression): string =>
  `${expression.start}:${expression.end}`;

const appendExpressionSequences = (
  accumulated: CandidateSet<readonly ESTree.Expression[]>,
  next: CandidateSet<readonly ESTree.Expression[]>,
): CandidateSet<readonly ESTree.Expression[]> =>
  appendCandidateSets({
    accumulated,
    append: (left, right) => [...left, ...right],
    candidateKey: expressionSequenceKey,
    next,
  });

const arrayEntrySequences = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput & {
    readonly expression: ESTree.ArrayExpression;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<readonly ESTree.Expression[]> =>
  input.expression.elements.reduce<CandidateSet<readonly ESTree.Expression[]>>(
    (sequences, element) => {
      if (element === null) return closedCandidateSet([], expressionSequenceKey);
      const next =
        element.type === "SpreadElement"
          ? entrySequences(state, { ...input, expression: element.argument })
          : closedCandidateSet([[element]], expressionSequenceKey);
      return appendExpressionSequences(sequences, next);
    },
    closedCandidateSet([[]], expressionSequenceKey),
  );

const mapEntrySequences = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput & {
    readonly expression: ESTree.NewExpression;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<readonly ESTree.Expression[]> | null => {
  const match = invocationMatch(state, {
    ...input,
    callee: input.expression.callee,
    globalName: "Map",
    path: [],
  });
  const argument = canonicalValueArgumentExpression(input.expression.arguments[0]);
  if (match === null || argument === null) return null;
  const sequences = entrySequences(state, { ...input, expression: argument });
  return match.complete ? sequences : openCandidateSet(sequences.candidates, expressionSequenceKey);
};

const entrySequences = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput & {
    readonly expression: ESTree.Expression;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<readonly ESTree.Expression[]> => {
  const expression = unwrapExpression(input.expression);
  if (input.seen.has(expression)) return unknownCandidateSet();
  const seen = new Set([...input.seen, expression]);
  if (expression.type === "ArrayExpression") {
    return arrayEntrySequences(state, { ...input, expression, seen });
  }
  if (expression.type === "NewExpression") {
    const sequences = mapEntrySequences(state, { ...input, expression, seen });
    if (sequences !== null) return sequences;
  }
  const origins = input.resolve(state, { ...input, expression, path: [] });
  return flatMapCandidateSet(origins, {
    candidateKey: expressionSequenceKey,
    mapCandidate: (origin) => {
      if (origin.kind !== "expression" || origin.projections.length !== 0) {
        return unknownCandidateSet();
      }
      return entrySequences(state, { ...input, expression: origin.expression, seen });
    },
  });
};

const entryTuples = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput & {
    readonly expression: ESTree.Expression;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<ESTree.ArrayExpression> => {
  const expression = unwrapExpression(input.expression);
  if (input.seen.has(expression)) return unknownCandidateSet();
  if (expression.type === "ArrayExpression") {
    return closedCandidateSet<ESTree.ArrayExpression>([expression], expressionKey);
  }
  const seen = new Set([...input.seen, expression]);
  return flatMapCandidateSet(input.resolve(state, { ...input, expression, path: [] }), {
    candidateKey: expressionKey,
    mapCandidate: (origin) => {
      if (origin.kind !== "expression" || origin.projections.length !== 0) {
        return unknownCandidateSet<ESTree.ArrayExpression>();
      }
      return entryTuples(state, { ...input, expression: origin.expression, seen });
    },
  });
};

const openOrigins = (
  origins: CandidateSet<CanonicalValueOrigin>,
): CandidateSet<CanonicalValueOrigin> =>
  openCandidateSet(origins.candidates, canonicalValueOriginKey);

const unmatchedEntryOrigins = (
  input: { readonly earlier: () => CandidateSet<CanonicalValueOrigin> },
  complete: boolean,
): CandidateSet<CanonicalValueOrigin> => {
  const earlier = input.earlier();
  return complete ? earlier : openOrigins(earlier);
};

const matchedEntryOrigins = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput & {
    readonly complete: boolean;
    readonly earlier: () => CandidateSet<CanonicalValueOrigin>;
    readonly exact: boolean;
    readonly tuple: ESTree.ArrayExpression;
  },
): CandidateSet<CanonicalValueOrigin> => {
  const valueOrigins = input.resolve(state, {
    ...input,
    expression: input.tuple,
    path: ["1", ...input.path.slice(1)],
  });
  if (input.complete && input.exact) return valueOrigins;
  const origins = joinCandidateSets([valueOrigins, input.earlier()], canonicalValueOriginKey);
  return input.complete ? origins : openOrigins(origins);
};

const resolveEntryTuple = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput & {
    readonly earlier: () => CandidateSet<CanonicalValueOrigin>;
    readonly target: string;
    readonly tuple: ESTree.ArrayExpression;
  },
): CandidateSet<CanonicalValueOrigin> => {
  const key = input.tuple.elements[0];
  if (key === null || key === undefined || key.type === "SpreadElement") {
    return openOrigins(input.earlier());
  }
  const keys = state.staticResolver.propertyKeys(canonicalValuePropertyKeyOf(key, true), {
    cutoff: key.start,
    executionContext: input.executionContext,
  });
  const targets = keys.candidates.filter((candidate) => candidate === input.target);
  return targets.length === 0
    ? unmatchedEntryOrigins(input, keys.complete)
    : matchedEntryOrigins(state, {
        ...input,
        complete: keys.complete,
        exact: targets.length === keys.candidates.length,
      });
};

const resolveEntrySequence = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput & {
    readonly entries: readonly ESTree.Expression[];
    readonly index: number;
    readonly target: string;
  },
): CandidateSet<CanonicalValueOrigin> => {
  const entry = input.entries[input.index];
  if (entry === undefined) return canonicalValueAbsentOriginSet();
  const earlier = (): CandidateSet<CanonicalValueOrigin> =>
    resolveEntrySequence(state, { ...input, index: input.index - 1 });
  const tuples = entryTuples(state, { ...input, expression: entry, seen: new Set() });
  const resolved = joinCandidateSets(
    tuples.candidates.map((tuple) =>
      resolveEntryTuple(state, { ...input, earlier, target: input.target, tuple }),
    ),
    canonicalValueOriginKey,
  );
  if (tuples.complete) return resolved;
  return openOrigins(joinCandidateSets([resolved, earlier()], canonicalValueOriginKey));
};

const fromEntriesOrigins = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput & { readonly call: ESTree.CallExpression },
): CandidateSet<CanonicalValueOrigin> | null => {
  if (input.path.length === 0 || typeof input.path[0] !== "string") return null;
  const callee = input.call.callee;
  if (callee.type === "Super") return null;
  const match = invocationMatch(state, {
    ...input,
    callee,
    globalName: "Object",
    path: ["fromEntries"],
  });
  const entries = canonicalValueArgumentExpression(input.call.arguments[0]);
  if (match === null || entries === null) return null;
  const sequences = entrySequences(state, { ...input, expression: entries, seen: new Set() });
  const origins = flatMapCandidateSet(sequences, {
    candidateKey: canonicalValueOriginKey,
    mapCandidate: (sequence) =>
      resolveEntrySequence(state, {
        ...input,
        entries: sequence,
        index: sequence.length - 1,
        target: input.path[0] as string,
      }),
  });
  return match.complete ? origins : openOrigins(origins);
};

const objectCreateOrigins = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput & { readonly call: ESTree.CallExpression },
): CandidateSet<CanonicalValueOrigin> | null => {
  if (input.path.length === 0 || typeof input.path[0] !== "string") return null;
  const callee = input.call.callee;
  if (callee.type === "Super") return null;
  const match = invocationMatch(state, {
    ...input,
    callee,
    globalName: "Object",
    path: ["create"],
  });
  const descriptors = canonicalValueArgumentExpression(input.call.arguments[1]);
  if (match === null || descriptors === null) return null;
  const origins = input.resolve(state, {
    ...input,
    expression: descriptors,
    path: [input.path[0], "value", ...input.path.slice(1)],
  });
  return match.complete ? origins : openOrigins(origins);
};

type PathSelection =
  | { readonly found: false }
  | { readonly found: true; readonly selected: unknown };

const valueAtPath = (value: unknown, path: readonly string[]): PathSelection =>
  path.reduce<PathSelection>(
    (selection, key) => {
      if (!selection.found) return selection;
      const selected = selection.selected;
      if ((typeof selected !== "object" && typeof selected !== "function") || selected === null) {
        return { found: false };
      }
      return Object.prototype.hasOwnProperty.call(selected, key)
        ? { found: true, selected: (selected as Record<string, unknown>)[key] }
        : { found: false };
    },
    { found: true, selected: value },
  );

const parsedOrigin = (
  expression: ESTree.CallExpression,
  input: { readonly parsed: unknown; readonly path: readonly string[] },
): CandidateSet<CanonicalValueOrigin> => {
  const selection = valueAtPath(input.parsed, input.path);
  if (!selection.found) return canonicalValueAbsentOriginSet();
  if (!Array.isArray(selection.selected)) return unknownCandidateSet();
  const canonicalDomain = selection.selected.filter(isCanonicalValue);
  const origins = closedCandidateSet(
    [
      canonicalValueExpressionOrigin(expression, [
        { kind: "static-values", values: canonicalDomain },
      ]),
    ],
    canonicalValueOriginKey,
  );
  return canonicalDomain.length === selection.selected.length ? origins : openOrigins(origins);
};

const parsePrimitive = (
  expression: ESTree.CallExpression,
  input: {
    readonly path: readonly string[];
    readonly primitive: CanonicalValue | bigint | undefined;
  },
): CandidateSet<CanonicalValueOrigin> => {
  if (input.primitive === undefined || typeof input.primitive === "bigint") {
    return unknownCandidateSet();
  }
  try {
    return parsedOrigin(expression, {
      parsed: JSON.parse(String(input.primitive)) as unknown,
      path: input.path,
    });
  } catch (error) {
    if (error instanceof SyntaxError) return closedCandidateSet([], canonicalValueOriginKey);
    throw error;
  }
};

const jsonParseOrigins = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput & { readonly call: ESTree.CallExpression },
): CandidateSet<CanonicalValueOrigin> | null => {
  if (input.path.length === 0 || input.path.some((segment) => typeof segment !== "string")) {
    return null;
  }
  const callee = input.call.callee;
  if (callee.type === "Super") return null;
  const match = invocationMatch(state, {
    ...input,
    callee,
    globalName: "JSON",
    path: ["parse"],
  });
  const argument = canonicalValueArgumentExpression(input.call.arguments[0]);
  if (match === null || argument === null) return null;
  const primitives = state.staticResolver.primitives({
    cutoff: input.cutoff,
    executionContext: input.executionContext,
    expression: argument,
  });
  const origins = flatMapCandidateSet(primitives, {
    candidateKey: canonicalValueOriginKey,
    mapCandidate: (primitive) =>
      parsePrimitive(input.call, {
        path: input.path as readonly string[],
        primitive,
      }),
  });
  return match.complete ? origins : openOrigins(origins);
};

export const canonicalValueObjectResultOrigins = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResultInput,
): CandidateSet<CanonicalValueOrigin> | null => {
  if (input.expression.type !== "CallExpression") return null;
  return (
    fromEntriesOrigins(state, { ...input, call: input.expression }) ??
    objectCreateOrigins(state, { ...input, call: input.expression }) ??
    jsonParseOrigins(state, { ...input, call: input.expression })
  );
};
