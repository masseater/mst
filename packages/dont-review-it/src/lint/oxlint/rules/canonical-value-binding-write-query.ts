import type {
  CanonicalValueWriteBase,
  CanonicalValueWriteQuery,
} from "./canonical-value-binding-types.ts";

export const filterCanonicalValueWrites = <Write extends CanonicalValueWriteBase>(
  writes: readonly Write[],
  query: CanonicalValueWriteQuery,
): readonly Write[] =>
  writes.filter(
    (write) =>
      (query.before === undefined || write.start < query.before) &&
      (query.executionContext === undefined || write.executionContext === query.executionContext),
  );
