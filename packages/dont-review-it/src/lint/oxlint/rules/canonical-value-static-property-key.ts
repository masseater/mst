import {
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  mapCandidateSet,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValuePropertyKeyOf,
  type CanonicalValueBindingIndex,
  type CanonicalValuePropertyKey,
} from "./canonical-value-binding-index.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type { CanonicalValueStaticQuery } from "./canonical-value-static-query.ts";

const SYMBOL_TO_PRIMITIVE = Symbol("Symbol.toPrimitive");

type StaticPropertyKeyEnvironment = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly resolveOrigins: (query: CanonicalValueStaticQuery) => CandidateSet<CanonicalValueOrigin>;
  readonly resolvePrimitives: (
    query: CanonicalValueStaticQuery,
  ) => CandidateSet<CanonicalValueStaticPrimitive>;
};

const conversionKey = (value: string | symbol): string =>
  typeof value === "symbol" ? "symbol-to-primitive" : `string:${value}`;

const stringPropertyKeys = (
  primitives: CandidateSet<CanonicalValueStaticPrimitive>,
): CandidateSet<string> =>
  mapCandidateSet(primitives, {
    candidateKey: String,
    mapCandidate: String,
  });

const exactGlobalPath = (
  environment: StaticPropertyKeyEnvironment,
  input: { readonly name: string; readonly origin: CanonicalValueOrigin },
): readonly string[] | null =>
  input.origin.kind === "absent"
    ? null
    : canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
        name: input.name,
        origin: input.origin,
      });

const globalWrapperName = (
  environment: StaticPropertyKeyEnvironment,
  origin: CanonicalValueOrigin,
): string | null => {
  if (exactGlobalPath(environment, { name: "String", origin })?.length === 0) return "String";
  if (exactGlobalPath(environment, { name: "Number", origin })?.length === 0) return "Number";
  if (exactGlobalPath(environment, { name: "Boolean", origin })?.length === 0) return "Boolean";
  return exactGlobalPath(environment, { name: "Object", origin })?.length === 0 ? "Object" : null;
};

const wrapperArgumentPrimitives = (
  environment: StaticPropertyKeyEnvironment,
  input: {
    readonly expression: ESTree.CallExpression | ESTree.NewExpression;
    readonly query: CanonicalValueStaticQuery;
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const first = input.expression.arguments[0];
  if (first === undefined) return closedCandidateSet([undefined], canonicalValueStaticPrimitiveKey);
  return first.type === "SpreadElement"
    ? unknownCandidateSet()
    : environment.resolvePrimitives({ ...input.query, expression: first });
};

const convertedWrapperPrimitive = (
  name: string,
  primitive: CanonicalValueStaticPrimitive,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  if (name === "String") {
    return closedCandidateSet(
      [primitive === undefined ? "" : String(primitive)],
      canonicalValueStaticPrimitiveKey,
    );
  }
  if (name === "Number") {
    return closedCandidateSet(
      [primitive === undefined ? 0 : Number(primitive)],
      canonicalValueStaticPrimitiveKey,
    );
  }
  if (name === "Boolean") {
    return closedCandidateSet([Boolean(primitive)], canonicalValueStaticPrimitiveKey);
  }
  return primitive === null || primitive === undefined
    ? unknownCandidateSet()
    : closedCandidateSet([primitive], canonicalValueStaticPrimitiveKey);
};

const wrapperPrimitivesForOrigin = (
  environment: StaticPropertyKeyEnvironment,
  input: {
    readonly expression: ESTree.CallExpression | ESTree.NewExpression;
    readonly origin: CanonicalValueOrigin;
    readonly query: CanonicalValueStaticQuery;
  },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const name = globalWrapperName(environment, input.origin);
  if (name === null) return null;
  return flatMapCandidateSet(
    wrapperArgumentPrimitives(environment, {
      expression: input.expression,
      query: input.query,
    }),
    {
      candidateKey: canonicalValueStaticPrimitiveKey,
      mapCandidate: (primitive) => convertedWrapperPrimitive(name, primitive),
    },
  );
};

const wrapperExpressionPrimitives = (
  environment: StaticPropertyKeyEnvironment,
  input: { readonly expression: ESTree.Expression; readonly query: CanonicalValueStaticQuery },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const expression = unwrapExpression(input.expression);
  if (expression.type !== "CallExpression" && expression.type !== "NewExpression") return null;
  const callee = expression.callee;
  if (callee.type === "Super") return null;
  const origins = environment.resolveOrigins({ ...input.query, expression: callee });
  const resolutions = origins.candidates
    .map((origin) =>
      wrapperPrimitivesForOrigin(environment, {
        expression,
        origin,
        query: input.query,
      }),
    )
    .filter(
      (resolution): resolution is CandidateSet<CanonicalValueStaticPrimitive> =>
        resolution !== null,
    );
  if (resolutions.length === 0) return null;
  const joined = joinCandidateSets(resolutions, canonicalValueStaticPrimitiveKey);
  return origins.complete && resolutions.length === origins.candidates.length
    ? joined
    : openCandidateSet(joined.candidates, canonicalValueStaticPrimitiveKey);
};

const wrapperPrimitives = (
  environment: StaticPropertyKeyEnvironment,
  query: CanonicalValueStaticQuery,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const origins = environment.resolveOrigins(query);
  const resolutions = origins.candidates
    .map((origin) =>
      origin.kind === "absent" || origin.projections.length !== 0
        ? null
        : wrapperExpressionPrimitives(environment, {
            expression: origin.expression,
            query,
          }),
    )
    .filter(
      (resolution): resolution is CandidateSet<CanonicalValueStaticPrimitive> =>
        resolution !== null,
    );
  if (resolutions.length === 0)
    return wrapperExpressionPrimitives(environment, {
      expression: query.expression,
      query,
    });
  const joined = joinCandidateSets(resolutions, canonicalValueStaticPrimitiveKey);
  return origins.complete && resolutions.length === origins.candidates.length
    ? joined
    : openCandidateSet(joined.candidates, canonicalValueStaticPrimitiveKey);
};

const symbolToPrimitiveKey = (
  environment: StaticPropertyKeyEnvironment,
  query: CanonicalValueStaticQuery,
): CandidateSet<string | symbol> | null => {
  const origins = environment.resolveOrigins(query);
  const matches = origins.candidates.filter(
    (origin) =>
      exactGlobalPath(environment, { name: "Symbol", origin })?.join(".") === "toPrimitive",
  );
  if (matches.length === 0) return null;
  return origins.complete && matches.length === origins.candidates.length
    ? closedCandidateSet([SYMBOL_TO_PRIMITIVE], conversionKey)
    : openCandidateSet([SYMBOL_TO_PRIMITIVE], conversionKey);
};

const conversionPropertyKeys = (
  environment: StaticPropertyKeyEnvironment,
  query: CanonicalValueStaticQuery,
): CandidateSet<string | symbol> => {
  const symbolKey = symbolToPrimitiveKey(environment, query);
  if (symbolKey?.complete === true) return symbolKey;
  const primitives = stringPropertyKeys(environment.resolvePrimitives(query));
  if (symbolKey === null) return primitives;
  return {
    candidates: [...symbolKey.candidates, ...primitives.candidates],
    complete: false,
  };
};

const directFunctionResults = (
  function_: ESTree.ArrowFunctionExpression | ESTree.Function,
): { readonly complete: boolean; readonly expressions: readonly ESTree.Expression[] } => {
  if (function_.type === "ArrowFunctionExpression" && function_.body.type !== "BlockStatement") {
    return { complete: true, expressions: [function_.body] };
  }
  if (function_.body === null) return { complete: false, expressions: [] };
  const statements = function_.body.type === "BlockStatement" ? function_.body.body : [];
  const expressions = statements.flatMap((statement) =>
    statement.type === "ReturnStatement" && statement.argument !== null ? [statement.argument] : [],
  );
  return {
    complete:
      statements.length !== 0 &&
      statements.every((statement) => statement.type === "ReturnStatement"),
    expressions,
  };
};

const callableOriginPrimitives = (
  environment: StaticPropertyKeyEnvironment,
  input: { readonly origin: CanonicalValueOrigin; readonly query: CanonicalValueStaticQuery },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  if (input.origin.kind === "absent" || input.origin.projections.length !== 0) {
    return unknownCandidateSet();
  }
  const expression = unwrapExpression(input.origin.expression);
  if (expression.type !== "ArrowFunctionExpression" && expression.type !== "FunctionExpression") {
    return unknownCandidateSet();
  }
  const results = directFunctionResults(expression);
  if (results.expressions.length === 0) return unknownCandidateSet();
  const primitives = joinCandidateSets(
    results.expressions.map((returned) =>
      environment.resolvePrimitives({ ...input.query, expression: returned }),
    ),
    canonicalValueStaticPrimitiveKey,
  );
  return results.complete
    ? primitives
    : openCandidateSet(primitives.candidates, canonicalValueStaticPrimitiveKey);
};

const callablePrimitives = (
  environment: StaticPropertyKeyEnvironment,
  input: { readonly expression: ESTree.Expression; readonly query: CanonicalValueStaticQuery },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(
    environment.resolveOrigins({ ...input.query, expression: input.expression }),
    {
      candidateKey: canonicalValueStaticPrimitiveKey,
      mapCandidate: (origin) =>
        callableOriginPrimitives(environment, { origin, query: input.query }),
    },
  );

const objectConversionPropertyKeys = (
  environment: StaticPropertyKeyEnvironment,
  input: {
    readonly property: ESTree.ObjectProperty;
    readonly query: CanonicalValueStaticQuery;
  },
): CandidateSet<string | symbol> => {
  const propertyKey = canonicalValuePropertyKeyOf(input.property.key, input.property.computed);
  return propertyKey.kind === "static"
    ? closedCandidateSet([propertyKey.value], conversionKey)
    : conversionPropertyKeys(environment, {
        ...input.query,
        expression: propertyKey.expression as ESTree.Expression,
      });
};

const objectConversionProperty = (
  environment: StaticPropertyKeyEnvironment,
  input: {
    readonly object: ESTree.ObjectExpression;
    readonly query: CanonicalValueStaticQuery;
    readonly target: string | symbol;
  },
): { readonly complete: boolean; readonly property: ESTree.ObjectProperty } | null => {
  const propertyMatch = input.object.properties.toReversed().reduce<{
    readonly complete: boolean;
    readonly property: ESTree.ObjectProperty | null;
  }>(
    (accumulated, property) => {
      if (accumulated.property !== null) return accumulated;
      if (property.type === "SpreadElement") return { complete: false, property: null };
      const keys = objectConversionPropertyKeys(environment, {
        property,
        query: input.query,
      });
      return keys.candidates.includes(input.target)
        ? { complete: accumulated.complete && keys.complete, property }
        : { complete: accumulated.complete && keys.complete, property: null };
    },
    { complete: true, property: null },
  );
  return propertyMatch.property === null
    ? null
    : { complete: propertyMatch.complete, property: propertyMatch.property };
};

const selectedObjectConversion = (
  environment: StaticPropertyKeyEnvironment,
  input: {
    readonly object: ESTree.ObjectExpression;
    readonly query: CanonicalValueStaticQuery;
  },
): { readonly complete: boolean; readonly property: ESTree.ObjectProperty } | null =>
  objectConversionProperty(environment, { ...input, target: SYMBOL_TO_PRIMITIVE }) ??
  objectConversionProperty(environment, { ...input, target: "toString" }) ??
  objectConversionProperty(environment, { ...input, target: "valueOf" });

const objectOriginPrimitives = (
  environment: StaticPropertyKeyEnvironment,
  input: { readonly origin: CanonicalValueOrigin; readonly query: CanonicalValueStaticQuery },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (input.origin.kind === "absent" || input.origin.projections.length !== 0) return null;
  const expression = unwrapExpression(input.origin.expression);
  if (expression.type !== "ObjectExpression") return null;
  const conversion = selectedObjectConversion(environment, {
    object: expression,
    query: input.query,
  });
  if (conversion === null) return unknownCandidateSet();
  const primitives = callablePrimitives(environment, {
    expression: conversion.property.value,
    query: input.query,
  });
  return conversion.complete
    ? primitives
    : openCandidateSet(primitives.candidates, canonicalValueStaticPrimitiveKey);
};

const objectPrimitives = (
  environment: StaticPropertyKeyEnvironment,
  query: CanonicalValueStaticQuery,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const origins = environment.resolveOrigins(query);
  const resolutions = origins.candidates
    .map((origin) => objectOriginPrimitives(environment, { origin, query }))
    .filter(
      (resolution): resolution is CandidateSet<CanonicalValueStaticPrimitive> =>
        resolution !== null,
    );
  if (resolutions.length === 0) return null;
  const joined = joinCandidateSets(resolutions, canonicalValueStaticPrimitiveKey);
  return origins.complete && resolutions.length === origins.candidates.length
    ? joined
    : openCandidateSet(joined.candidates, canonicalValueStaticPrimitiveKey);
};

const appendRecognizedPrimitives = (
  direct: CandidateSet<CanonicalValueStaticPrimitive>,
  recognized: CandidateSet<CanonicalValueStaticPrimitive> | null,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  if (recognized === null) return direct;
  if (!direct.complete && direct.candidates.length === 0) return recognized;
  return joinCandidateSets([direct, recognized], canonicalValueStaticPrimitiveKey);
};

export const resolveCanonicalValueStaticPropertyKey = (
  environment: StaticPropertyKeyEnvironment,
  input: {
    readonly propertyKey: CanonicalValuePropertyKey;
    readonly query: Omit<CanonicalValueStaticQuery, "expression">;
  },
): CandidateSet<string> => {
  if (input.propertyKey.kind === "static") {
    return closedCandidateSet([input.propertyKey.value], String);
  }
  const keyQuery = {
    ...input.query,
    expression: input.propertyKey.expression as ESTree.Expression,
  };
  const direct = environment.resolvePrimitives(keyQuery);
  if (direct.complete && direct.candidates.length !== 0) return stringPropertyKeys(direct);
  const withWrapper = appendRecognizedPrimitives(direct, wrapperPrimitives(environment, keyQuery));
  return stringPropertyKeys(
    appendRecognizedPrimitives(withWrapper, objectPrimitives(environment, keyQuery)),
  );
};
