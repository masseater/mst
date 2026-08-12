const MATCHER_FAMILIES = [
  "containment",
  "loose-structure",
  "magnitude",
  "partial-shape",
  "runtime-type",
  "thrown-value",
  "truthiness",
] as const;

export type WeakMatcher = {
  readonly name: string;
  readonly family: (typeof MATCHER_FAMILIES)[number];
  readonly unverified: string;
};

export type RedundantMatcher = {
  readonly name: string;
  readonly writeInstead: string;
};

export const EXACT_MATCHERS: ReadonlySet<string> = new Set(["toBe", "toStrictEqual"]);

export const STRUCTURAL_MATCHERS: ReadonlySet<string> = new Set(["toEqual", "toStrictEqual"]);

export const CALL_CONTRACT_MATCHERS: ReadonlySet<string> = new Set([
  "toHaveBeenCalled",
  "toHaveBeenCalledAfter",
  "toHaveBeenCalledBefore",
  "toHaveBeenCalledExactlyOnceWith",
  "toHaveBeenCalledOnce",
  "toHaveBeenCalledTimes",
  "toHaveBeenCalledWith",
  "toHaveBeenLastCalledWith",
  "toHaveBeenNthCalledWith",
]);

export const SNAPSHOT_MATCHERS: ReadonlySet<string> = new Set([
  "matchSnapshot",
  "toMatchFileSnapshot",
  "toMatchInlineSnapshot",
  "toMatchSnapshot",
  "toThrowErrorMatchingInlineSnapshot",
  "toThrowErrorMatchingSnapshot",
]);

export const ASSERTION_CHAIN_MODIFIERS: ReadonlySet<string> = new Set([
  "not",
  "rejects",
  "resolves",
]);

export const THROW_EXPECTING_MATCHERS: ReadonlySet<string> = new Set([
  "toThrow",
  "toThrowError",
  "toThrowErrorMatchingInlineSnapshot",
  "toThrowErrorMatchingSnapshot",
]);

export const THROW_EXPECTING_MODIFIERS: ReadonlySet<string> = new Set(["rejects"]);

export const DERIVED_ASSERTION_RECEIVERS: ReadonlySet<string> = new Set(["poll", "soft"]);

export const ASSERTION_COUNT_DECLARATIONS: ReadonlySet<string> = new Set([
  "assertions",
  "hasAssertions",
]);

export const WEAK_MATCHERS: readonly WeakMatcher[] = [
  {
    name: "toBeTruthy",
    family: "truthiness",
    unverified: "which of the many values that coerce to true the subject is",
  },
  {
    name: "toBeFalsy",
    family: "truthiness",
    unverified: "which of the many values that coerce to false the subject is",
  },
  {
    name: "toBeDefined",
    family: "truthiness",
    unverified: "everything about the subject other than that it is not undefined",
  },
  {
    name: "toBeNullable",
    family: "truthiness",
    unverified: "whether the subject is null or undefined, and everything else about it",
  },
  {
    name: "toEqual",
    family: "loose-structure",
    unverified:
      "whether a property is absent or present holding undefined, and which class the subject was built from",
  },
  {
    name: "toMatchObject",
    family: "partial-shape",
    unverified: "every property the subject carries that the expected object does not name",
  },
  {
    name: "toHaveProperty",
    family: "partial-shape",
    unverified: "everything the subject carries outside the property path that was named",
  },
  {
    name: "toHaveLength",
    family: "partial-shape",
    unverified: "every element the subject holds, since only how many there are is pinned",
  },
  {
    name: "toContain",
    family: "containment",
    unverified:
      "everything the subject holds beside the named element, and where that element sits",
  },
  {
    name: "toContainEqual",
    family: "containment",
    unverified: "everything the subject holds beside an element equal to the named one",
  },
  {
    name: "toMatch",
    family: "containment",
    unverified: "every character of the subject outside the part the pattern matched",
  },
  {
    name: "toBeInstanceOf",
    family: "runtime-type",
    unverified:
      "every field the subject carries, since only the prototype it was built on is pinned",
  },
  {
    name: "toBeTypeOf",
    family: "runtime-type",
    unverified: "which of the many values of that runtime type the subject is",
  },
  {
    name: "toSatisfy",
    family: "runtime-type",
    unverified: "everything the predicate does not read",
  },
  {
    name: "toBeOneOf",
    family: "runtime-type",
    unverified: "which member of the named set the subject is",
  },
  {
    name: "toBeGreaterThan",
    family: "magnitude",
    unverified: "which of the many numbers above the bound the subject is",
  },
  {
    name: "toBeGreaterThanOrEqual",
    family: "magnitude",
    unverified: "which of the many numbers at or above the bound the subject is",
  },
  {
    name: "toBeLessThan",
    family: "magnitude",
    unverified: "which of the many numbers below the bound the subject is",
  },
  {
    name: "toBeLessThanOrEqual",
    family: "magnitude",
    unverified: "which of the many numbers at or below the bound the subject is",
  },
  {
    name: "toBeCloseTo",
    family: "magnitude",
    unverified: "every digit of the subject past the precision that was compared",
  },
  {
    name: "toThrow",
    family: "thrown-value",
    unverified:
      "which error was thrown, and with a string argument only that the message contains that text rather than equals it",
  },
  {
    name: "toThrowError",
    family: "thrown-value",
    unverified:
      "which error was thrown, and with a string argument only that the message contains that text rather than equals it",
  },
];

export const WEAK_ASYMMETRIC_MATCHERS: readonly WeakMatcher[] = [
  {
    name: "anything",
    family: "runtime-type",
    unverified: "everything about the subject other than that it is neither null nor undefined",
  },
  {
    name: "any",
    family: "runtime-type",
    unverified: "which of the many values that constructor produces the subject is",
  },
  {
    name: "schemaMatching",
    family: "runtime-type",
    unverified: "everything the schema leaves open",
  },
  {
    name: "toSatisfy",
    family: "runtime-type",
    unverified: "everything the predicate does not read",
  },
  {
    name: "toBeOneOf",
    family: "runtime-type",
    unverified: "which member of the named set the subject is",
  },
  {
    name: "objectContaining",
    family: "partial-shape",
    unverified: "every property the subject carries that the expected object does not name",
  },
  {
    name: "arrayContaining",
    family: "partial-shape",
    unverified:
      "every element the subject holds that the expected array does not name, and their order",
  },
  {
    name: "stringContaining",
    family: "containment",
    unverified: "every character of the subject outside the expected substring",
  },
  {
    name: "stringMatching",
    family: "containment",
    unverified: "every character of the subject outside the part the pattern matched",
  },
  {
    name: "closeTo",
    family: "magnitude",
    unverified: "every digit of the subject past the precision that was compared",
  },
];

export const REDUNDANT_MATCHERS: readonly RedundantMatcher[] = [
  { name: "toBeNull", writeInstead: "toBe(null)" },
  { name: "toBeUndefined", writeInstead: "toBe(undefined)" },
  { name: "toBeNaN", writeInstead: "toBe(Number.NaN)" },
  { name: "toBeCalled", writeInstead: "toHaveBeenCalled()" },
  { name: "toBeCalledTimes", writeInstead: "toHaveBeenCalledTimes()" },
  { name: "toBeCalledWith", writeInstead: "toHaveBeenCalledWith()" },
  { name: "matchSnapshot", writeInstead: "toMatchSnapshot()" },
];
