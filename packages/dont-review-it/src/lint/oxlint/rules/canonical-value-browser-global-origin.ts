import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";

import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type { CanonicalValueExpressionOrigin } from "./canonical-value-property-origin.ts";

const GLOBAL_OBJECT_NAMES: ReadonlySet<string> = new Set(["globalThis", "self", "window"]);

export const canonicalValueOriginUsesGlobalObject = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly origin: CanonicalValueExpressionOrigin;
  readonly path: readonly string[];
}): boolean => {
  const originPath = canonicalValueInvocationPropertyPath(input.origin);
  return (
    originPath?.length === input.path.length &&
    originPath.every((segment, index) => segment === input.path[index]) &&
    [...GLOBAL_OBJECT_NAMES].some((name) =>
      canonicalValueIsGlobalIdentifier(input.bindingIndex, {
        expression: input.origin.expression,
        name,
      }),
    )
  );
};

export const canonicalValueExpressionUsesGlobalObject = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly expression: Parameters<typeof canonicalValueIsGlobalIdentifier>[1]["expression"];
  readonly name: string;
}): boolean =>
  [...GLOBAL_OBJECT_NAMES].some((objectName) =>
    canonicalValueIsGlobalIdentifier(input.bindingIndex, {
      expression: input.expression,
      name: objectName,
    }),
  );
