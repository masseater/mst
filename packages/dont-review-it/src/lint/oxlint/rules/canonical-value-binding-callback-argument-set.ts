import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCallbackRuntime as CanonicalValueBaseCallbackRuntime,
  CanonicalValueResultCallbackRuntime,
} from "./canonical-value-binding-call-types.ts";
import type { CanonicalValueCallArgumentSegment } from "./canonical-value-binding-types.ts";
import type { CanonicalValueCallArgumentSource } from "./canonical-value-call-arguments.ts";

export type CanonicalValueCallbackArguments = {
  readonly arguments: readonly (readonly CanonicalValueCallArgumentSegment[])[];
  readonly recognized: boolean;
};

export type CanonicalValueCallbackRuntime = CanonicalValueResultCallbackRuntime;

export const canonicalValueCallbackAliasExpressions = (
  input: CanonicalValueBaseCallbackRuntime,
  identifier: ESTree.IdentifierReference,
): readonly ESTree.Expression[] =>
  input.identifierSources(input.runtime, identifier).map(({ source }) => source);

export const canonicalValueUnknownCallbackArguments =
  (): readonly CanonicalValueCallArgumentSegment[] => [{ kind: "unknown", width: 3 }];

export const canonicalValueElementCallbackArguments = (
  source: CanonicalValueCallArgumentSource,
  index: number,
): readonly CanonicalValueCallArgumentSegment[] => [
  { expression: source.expression, kind: "source", sourcePath: source.sourcePath },
  {
    expression: source.expression,
    kind: "source",
    sourcePath: [{ kind: "static-values", values: [index] }],
  },
  { kind: "unknown", width: 1 },
];

export const canonicalValueCallbackElementSegment = (
  arguments_: readonly CanonicalValueCallArgumentSegment[],
): CanonicalValueCallArgumentSegment => arguments_[0] ?? { kind: "unknown", width: 1 };

export const combineCanonicalValueCallbackArguments = (
  inputs: readonly CanonicalValueCallbackArguments[],
): CanonicalValueCallbackArguments => {
  const recognized = inputs.some((input) => input.recognized);
  return {
    arguments: [
      ...inputs.flatMap((input) => input.arguments),
      ...(recognized && inputs.some((input) => !input.recognized)
        ? [canonicalValueUnknownCallbackArguments()]
        : []),
    ],
    recognized,
  };
};
