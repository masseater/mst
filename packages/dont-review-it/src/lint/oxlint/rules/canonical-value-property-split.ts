import type { CanonicalValueStaticPrimitive } from "./canonical-value-static-primitive.ts";

export const canonicalValueSplitVector = (input: {
  readonly limit: CanonicalValueStaticPrimitive;
  readonly receiver: string;
  readonly separator: CanonicalValueStaticPrimitive;
}): readonly string[] | null => {
  if (typeof input.limit === "bigint") return null;
  const limit = input.limit === undefined ? 4_294_967_295 : Number(input.limit) >>> 0;
  if (limit === 0) return [];
  const separator = input.separator === undefined ? undefined : String(input.separator);
  return separator === undefined
    ? [input.receiver]
    : input.receiver.split(separator).slice(0, limit);
};
