import {
  closedCandidateSet,
  flatMapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { canonicalValueIntegerOrInfinity } from "./canonical-value-number-conversion.ts";
import { resolveCanonicalValueStaticInvocationArgumentVectors } from "./canonical-value-static-array.ts";
import {
  type CanonicalValueStaticInvocationEnvironment,
  type CanonicalValueStaticInvocationInput,
} from "./canonical-value-static-invocation-types.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";
import { canonicalValueStaticRegexp } from "./canonical-value-static-regexp.ts";
import { canonicalValueStaticStandardPathIsStable } from "./canonical-value-static-standard-target.ts";
import {
  canonicalValueStringMethodName,
  canonicalValueStaticStringReceivers,
} from "./canonical-value-static-string.ts";

import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";

type StringTransformInput = {
  readonly arguments: readonly CanonicalValueStaticPrimitive[];
  readonly method: string;
  readonly receiver: string;
};

type StringTransform = (
  input: StringTransformInput,
) => CanonicalValueStaticPrimitive | symbol | null;

const isIndexedMethod = (method: string): boolean =>
  method === "at" || method === "charAt" || method === "charCodeAt" || method === "codePointAt";

const isSearchedMethod = (method: string): boolean =>
  method === "endsWith" ||
  method === "includes" ||
  method === "indexOf" ||
  method === "lastIndexOf" ||
  method === "startsWith";

const isCasingMethod = (method: string): boolean =>
  method === "toLocaleLowerCase" ||
  method === "toLocaleUpperCase" ||
  method === "toLowerCase" ||
  method === "toUpperCase";

const isTrimmingMethod = (method: string): boolean =>
  method === "trim" || method === "trimEnd" || method === "trimStart";

const isLengthTransformMethod = (method: string): boolean =>
  method === "normalize" || method === "padEnd" || method === "padStart" || method === "repeat";

const isPatternTransformMethod = (method: string): boolean =>
  method === "replace" ||
  method === "replaceAll" ||
  method === "search" ||
  method === "substr" ||
  method === "substring";

const isStandardStringMethod = (method: string): boolean =>
  isIndexedMethod(method) ||
  isSearchedMethod(method) ||
  isCasingMethod(method) ||
  isTrimmingMethod(method) ||
  isLengthTransformMethod(method) ||
  isPatternTransformMethod(method);

const methodOf = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): string | null => {
  const method = canonicalValueStringMethodName(environment, input.fact);
  return method !== null && isStandardStringMethod(method) ? method : null;
};

const numberArgument = (primitive: CanonicalValueStaticPrimitive | undefined): number | null =>
  typeof primitive === "bigint" ? null : Number(primitive);

const stringArgument = (primitive: CanonicalValueStaticPrimitive | undefined): string =>
  String(primitive);

const normalizationForm = (
  primitive: CanonicalValueStaticPrimitive | undefined,
): "NFC" | "NFD" | "NFKC" | "NFKD" | undefined => {
  if (primitive === undefined) return undefined;
  const form = String(primitive);
  return form === "NFC" || form === "NFD" || form === "NFKC" || form === "NFKD" ? form : undefined;
};

const indexedString: StringTransform = (input) => {
  if (!isIndexedMethod(input.method)) return null;
  const index = numberArgument(input.arguments[0]);
  if (index === null) return Symbol.for("unknown-string-index");
  if (input.method === "at") return input.receiver.at(index);
  if (input.method === "charAt") return input.receiver.charAt(index);
  return input.method === "charCodeAt"
    ? input.receiver.charCodeAt(index)
    : input.receiver.codePointAt(index);
};

const searchedString: StringTransform = (input) => {
  if (!isSearchedMethod(input.method)) return null;
  const search = stringArgument(input.arguments[0]);
  const position = input.arguments.length < 2 ? undefined : numberArgument(input.arguments[1]);
  if (position === null) return Symbol.for("unknown-string-search-position");
  if (input.method === "endsWith") return input.receiver.endsWith(search, position);
  if (input.method === "includes") return input.receiver.includes(search, position);
  if (input.method === "indexOf") return input.receiver.indexOf(search, position);
  if (input.method === "lastIndexOf") return input.receiver.lastIndexOf(search, position);
  return input.receiver.startsWith(search, position);
};

const substrString = (input: {
  readonly length: number | undefined;
  readonly receiver: string;
  readonly start: number | undefined;
}): string => {
  const start = canonicalValueIntegerOrInfinity(input.start ?? 0);
  const actualStart =
    start < 0 ? Math.max(input.receiver.length + start, 0) : Math.min(start, input.receiver.length);
  const length =
    input.length === undefined
      ? input.receiver.length - actualStart
      : Math.max(canonicalValueIntegerOrInfinity(input.length), 0);
  return input.receiver.slice(actualStart, Math.min(actualStart + length, input.receiver.length));
};

const boundedString: StringTransform = (input) => {
  if (input.method !== "substr" && input.method !== "substring") return null;
  const start = input.arguments.length === 0 ? undefined : numberArgument(input.arguments[0]);
  const end = input.arguments.length < 2 ? undefined : numberArgument(input.arguments[1]);
  if (start === null || end === null) return Symbol.for("unknown-string-boundary");
  return input.method === "substr"
    ? substrString({ length: end, receiver: input.receiver, start })
    : input.receiver.substring(start ?? 0, end);
};

const paddedString: StringTransform = (input) => {
  if (input.method !== "padEnd" && input.method !== "padStart") return null;
  const length = numberArgument(input.arguments[0]);
  if (length === null) return Symbol.for("unknown-string-padding");
  const fill = input.arguments.length < 2 ? undefined : stringArgument(input.arguments[1]);
  return input.method === "padEnd"
    ? input.receiver.padEnd(length, fill)
    : input.receiver.padStart(length, fill);
};

const replacedString: StringTransform = (input) => {
  if (input.method !== "replace" && input.method !== "replaceAll") return null;
  const search = stringArgument(input.arguments[0]);
  const replacement = stringArgument(input.arguments[1]);
  return input.method === "replace"
    ? input.receiver.replace(search, replacement)
    : input.receiver.replaceAll(search, replacement);
};

const repeatedOrNormalizedString: StringTransform = (input) => {
  if (input.method === "repeat") {
    const count = numberArgument(input.arguments[0]);
    return count === null ? Symbol.for("unknown-string-repeat") : input.receiver.repeat(count);
  }
  if (input.method !== "normalize") return null;
  if (input.arguments.length === 0) return input.receiver.normalize();
  const form = normalizationForm(input.arguments[0]);
  return form === undefined
    ? Symbol.for("unknown-normalization-form")
    : input.receiver.normalize(form);
};

const casedString: StringTransform = (input) => {
  if (!isCasingMethod(input.method)) return null;
  if (input.method === "toLowerCase") return input.receiver.toLowerCase();
  if (input.method === "toUpperCase") return input.receiver.toUpperCase();
  const locales = input.arguments.length === 0 ? undefined : stringArgument(input.arguments[0]);
  return input.method === "toLocaleLowerCase"
    ? input.receiver.toLocaleLowerCase(locales)
    : input.receiver.toLocaleUpperCase(locales);
};

const trimmedString: StringTransform = (input) => {
  if (!isTrimmingMethod(input.method)) return null;
  if (input.method === "trim") return input.receiver.trim();
  return input.method === "trimEnd" ? input.receiver.trimEnd() : input.receiver.trimStart();
};

const STRING_TRANSFORMS: readonly StringTransform[] = [
  indexedString,
  searchedString,
  boundedString,
  paddedString,
  replacedString,
  repeatedOrNormalizedString,
  casedString,
  trimmedString,
];

const transformedString = (input: StringTransformInput): CanonicalValueStaticPrimitive | symbol => {
  for (const transform of STRING_TRANSFORMS) {
    const transformed = transform(input);
    if (transformed !== null) return transformed;
  }
  return Symbol.for("unsupported-string-method");
};

const safeTransformedString = (
  input: StringTransformInput,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  try {
    const transformed = transformedString(input);
    return typeof transformed === "symbol"
      ? unknownCandidateSet()
      : closedCandidateSet([transformed], canonicalValueStaticPrimitiveKey);
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) return unknownCandidateSet();
    throw error;
  }
};

const regexpKey = (regexp: RegExp): string => `${regexp.source}/${regexp.flags}`;

const primitiveRegexp = (primitive: CanonicalValueStaticPrimitive): CandidateSet<RegExp> => {
  try {
    return closedCandidateSet([new RegExp(String(primitive))], regexpKey);
  } catch (error) {
    if (error instanceof SyntaxError) return unknownCandidateSet();
    throw error;
  }
};

const searchRegexpForOrigin = (
  input: CanonicalValueStaticInvocationInput & {
    readonly origin: CanonicalValueOrigin;
  },
): CandidateSet<RegExp> => {
  if (input.origin.kind === "absent") {
    return closedCandidateSet([new RegExp("")], regexpKey);
  }
  if (input.origin.projections.length !== 0) return unknownCandidateSet();
  const regexp = canonicalValueStaticRegexp(input.origin.expression);
  if (regexp !== null) return closedCandidateSet([regexp], regexpKey);
  return flatMapCandidateSet(
    input.resolve({ ...input.query, expression: input.origin.expression }),
    {
      candidateKey: regexpKey,
      mapCandidate: primitiveRegexp,
    },
  );
};

const searchInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(canonicalValueStaticStringReceivers(input), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (receiver) =>
      flatMapCandidateSet(environment.invocationState.argumentOrigins(input.fact, 0), {
        candidateKey: canonicalValueStaticPrimitiveKey,
        mapCandidate: (origin) =>
          flatMapCandidateSet(searchRegexpForOrigin({ ...input, origin }), {
            candidateKey: canonicalValueStaticPrimitiveKey,
            mapCandidate: (regexp) =>
              closedCandidateSet([receiver.search(regexp)], canonicalValueStaticPrimitiveKey),
          }),
      }),
  });

export const resolveCanonicalValueStaticStandardStringInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const method = methodOf(environment, input);
  if (method === null) return null;
  if (
    !canonicalValueStaticStandardPathIsStable(environment, {
      path: ["String", "prototype", method],
      query: input.query,
    })
  ) {
    return unknownCandidateSet();
  }
  const receivers = canonicalValueStaticStringReceivers(input);
  if (receivers.candidates.length === 0) return null;
  if (method === "search") return searchInvocation(environment, input);
  return flatMapCandidateSet(receivers, {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (receiver) =>
      flatMapCandidateSet(
        resolveCanonicalValueStaticInvocationArgumentVectors(environment, input),
        {
          candidateKey: canonicalValueStaticPrimitiveKey,
          mapCandidate: (arguments_) =>
            safeTransformedString({ arguments: arguments_, method, receiver }),
        },
      ),
  });
};
