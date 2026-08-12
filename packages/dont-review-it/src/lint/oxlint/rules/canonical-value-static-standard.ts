import {
  closedCandidateSet,
  flatMapCandidateSet,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import {
  resolveCanonicalValueStaticArrayVectors,
  resolveCanonicalValueStaticInvocationArgumentVectors,
  type CanonicalValueStaticPrimitiveVector,
} from "./canonical-value-static-array.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";
import {
  type CanonicalValueStaticInvocationEnvironment,
  type CanonicalValueStaticInvocationInput,
} from "./canonical-value-static-invocation-types.ts";
import { resolveCanonicalValueStaticObjectPredicateInvocation } from "./canonical-value-static-object-predicate-evaluation.ts";
import { resolveCanonicalValueStaticPrimitiveStandardInvocation } from "./canonical-value-static-primitive-standard.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";
import { canonicalValueStaticRegexp } from "./canonical-value-static-regexp.ts";
import {
  canonicalValueStaticGlobalFunctionTarget,
  canonicalValueStaticGlobalTarget,
  canonicalValueStaticStandardPathIsStable,
} from "./canonical-value-static-standard-target.ts";
import { resolveCanonicalValueStaticToStringInvocation } from "./canonical-value-static-to-string.ts";

import type { CanonicalValueInvocationFact } from "./canonical-value-invocation.ts";
import type { CanonicalValueExpressionOrigin } from "./canonical-value-property-origin.ts";

const ARRAY_PRIMITIVE_METHODS: readonly string[] = ["at", "includes", "indexOf", "lastIndexOf"];

const arrayMethodTarget = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: { readonly fact: CanonicalValueInvocationFact; readonly method: string },
): boolean => {
  const directPath = canonicalValueInvocationPropertyPath(input.fact.target);
  if (directPath?.length === 1 && directPath[0] === input.method) return true;
  const globalPath = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
    name: "Array",
    origin: input.fact.target,
  });
  return (
    globalPath?.length === 2 && globalPath[0] === "prototype" && globalPath[1] === input.method
  );
};

const arrayMethodOf = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): string | null =>
  ARRAY_PRIMITIVE_METHODS.find((method) =>
    arrayMethodTarget(environment, { fact: input.fact, method }),
  ) ?? null;

const arrayMethodPrimitive = (input: {
  readonly arguments: CanonicalValueStaticPrimitiveVector;
  readonly elements: CanonicalValueStaticPrimitiveVector;
  readonly method: string;
}): CandidateSet<CanonicalValueStaticPrimitive> => {
  const position = input.arguments[1];
  if (typeof position === "bigint") return unknownCandidateSet();
  if (input.method === "at") {
    const index = input.arguments.length === 0 ? 0 : Number(input.arguments[0]);
    if (typeof input.arguments[0] === "bigint") return unknownCandidateSet();
    return closedCandidateSet([input.elements.at(index)], canonicalValueStaticPrimitiveKey);
  }
  const search = input.arguments[0];
  const fromIndex = input.arguments.length < 2 ? undefined : Number(position);
  return closedCandidateSet(
    [
      input.method === "includes"
        ? input.elements.includes(search, fromIndex)
        : input.method === "indexOf"
          ? input.elements.indexOf(search, fromIndex)
          : input.elements.lastIndexOf(search, fromIndex),
    ],
    canonicalValueStaticPrimitiveKey,
  );
};

const arrayMethod = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & { readonly method: string },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  if (input.fact.thisArgument === null) return unknownCandidateSet();
  return flatMapCandidateSet(
    resolveCanonicalValueStaticArrayVectors(environment, {
      ...input,
      expression: input.fact.thisArgument,
      seen: new Set(),
    }),
    {
      candidateKey: canonicalValueStaticPrimitiveKey,
      mapCandidate: (elements) =>
        flatMapCandidateSet(
          resolveCanonicalValueStaticInvocationArgumentVectors(environment, input),
          {
            candidateKey: canonicalValueStaticPrimitiveKey,
            mapCandidate: (arguments_) =>
              arrayMethodPrimitive({ arguments: arguments_, elements, method: input.method }),
          },
        ),
    },
  );
};

const parsedPrimitive = (
  primitive: CanonicalValueStaticPrimitive,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  if (primitive === undefined || typeof primitive === "bigint") return unknownCandidateSet();
  try {
    const parsed = JSON.parse(String(primitive)) as unknown;
    return parsed === null ||
      typeof parsed === "string" ||
      typeof parsed === "number" ||
      typeof parsed === "boolean"
      ? closedCandidateSet([parsed], canonicalValueStaticPrimitiveKey)
      : unknownCandidateSet();
  } catch (error) {
    if (error instanceof SyntaxError) return unknownCandidateSet();
    throw error;
  }
};

const decodedPrimitive = (
  primitive: CanonicalValueStaticPrimitive,
  component: boolean,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  try {
    const decoded = component
      ? decodeURIComponent(String(primitive))
      : decodeURI(String(primitive));
    return closedCandidateSet([decoded], canonicalValueStaticPrimitiveKey);
  } catch (error) {
    if (error instanceof URIError) return unknownCandidateSet();
    throw error;
  }
};

const mappedPrimitiveArgument = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & {
    readonly map: (
      primitive: CanonicalValueStaticPrimitive,
    ) => CandidateSet<CanonicalValueStaticPrimitive>;
  },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(resolveCanonicalValueStaticInvocationArgumentVectors(environment, input), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (arguments_) =>
      arguments_[0] === undefined ? unknownCandidateSet() : input.map(arguments_[0]),
  });

const originIsArray = (origin: CanonicalValueExpressionOrigin): boolean | "unknown" => {
  if (
    origin.projections.some(
      (projection) =>
        projection.kind === "array-slice" ||
        projection.kind === "array-transform" ||
        projection.kind === "call-arguments" ||
        projection.kind === "static-values",
    )
  ) {
    return true;
  }
  const expression = unwrapExpression(origin.expression);
  if (expression.type === "ArrayExpression") return true;
  if (
    expression.type === "Literal" ||
    expression.type === "ObjectExpression" ||
    expression.type === "FunctionExpression" ||
    expression.type === "ArrowFunctionExpression" ||
    expression.type === "ClassExpression"
  ) {
    return false;
  }
  return "unknown";
};

const arrayIsArray = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const origins = environment.invocationState.argumentOrigins(input.fact, 0);
  const candidates = origins.candidates.map((origin): boolean | "unknown" =>
    origin.kind === "absent" ? false : originIsArray(origin),
  );
  const booleans = candidates.filter((candidate): candidate is boolean => candidate !== "unknown");
  return origins.complete && booleans.length === candidates.length
    ? closedCandidateSet(booleans, canonicalValueStaticPrimitiveKey)
    : openCandidateSet(booleans, canonicalValueStaticPrimitiveKey);
};

const objectIs = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(resolveCanonicalValueStaticInvocationArgumentVectors(environment, input), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (arguments_) =>
      closedCandidateSet(
        [Object.is(arguments_[0], arguments_[1])],
        canonicalValueStaticPrimitiveKey,
      ),
  });

const regexpTest = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const path = canonicalValueInvocationPropertyPath(input.fact.target);
  if (path?.length !== 1 || path[0] !== "test" || input.fact.thisArgument === null) return null;
  const regexp = canonicalValueStaticRegexp(input.fact.thisArgument);
  if (regexp === null) return null;
  if (
    !canonicalValueStaticStandardPathIsStable(environment, {
      path: ["RegExp", "prototype", "test"],
      query: input.query,
    })
  ) {
    return unknownCandidateSet();
  }
  return flatMapCandidateSet(
    resolveCanonicalValueStaticInvocationArgumentVectors(environment, input),
    {
      candidateKey: canonicalValueStaticPrimitiveKey,
      mapCandidate: (arguments_) =>
        closedCandidateSet([regexp.test(String(arguments_[0]))], canonicalValueStaticPrimitiveKey),
    },
  );
};

const arrayInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const method = arrayMethodOf(environment, input);
  if (method === null) return null;
  return canonicalValueStaticStandardPathIsStable(environment, {
    path: ["Array", "prototype", method],
    query: input.query,
  })
    ? arrayMethod(environment, { ...input, method })
    : unknownCandidateSet();
};

const decodingInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (
    canonicalValueStaticGlobalTarget(environment, {
      fact: input.fact,
      globalName: "JSON",
      path: ["parse"],
      query: input.query,
    })
  ) {
    return mappedPrimitiveArgument(environment, { ...input, map: parsedPrimitive });
  }
  if (
    canonicalValueStaticGlobalFunctionTarget(environment, {
      fact: input.fact,
      name: "decodeURIComponent",
      query: input.query,
    })
  ) {
    return mappedPrimitiveArgument(environment, {
      ...input,
      map: (primitive) => decodedPrimitive(primitive, true),
    });
  }
  return canonicalValueStaticGlobalFunctionTarget(environment, {
    fact: input.fact,
    name: "decodeURI",
    query: input.query,
  })
    ? mappedPrimitiveArgument(environment, {
        ...input,
        map: (primitive) => decodedPrimitive(primitive, false),
      })
    : null;
};

const structuralInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (
    canonicalValueStaticGlobalTarget(environment, {
      fact: input.fact,
      globalName: "Array",
      path: ["isArray"],
      query: input.query,
    })
  ) {
    return arrayIsArray(environment, input);
  }
  return canonicalValueStaticGlobalTarget(environment, {
    fact: input.fact,
    globalName: "Object",
    path: ["is"],
    query: input.query,
  })
    ? objectIs(environment, input)
    : null;
};

export const resolveCanonicalValueStaticStandardInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null =>
  resolveCanonicalValueStaticToStringInvocation(environment, input) ??
  resolveCanonicalValueStaticPrimitiveStandardInvocation(environment, input) ??
  resolveCanonicalValueStaticObjectPredicateInvocation(environment, input) ??
  arrayInvocation(environment, input) ??
  decodingInvocation(environment, input) ??
  structuralInvocation(environment, input) ??
  regexpTest(environment, input);
