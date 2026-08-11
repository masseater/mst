import type { Options } from "@oxlint/plugins";

export const NORMALIZING_METHODS: ReadonlySet<string> = new Set([
  "normalize",
  "reduce",
  "reduceRight",
  "replace",
  "replaceAll",
  "reverse",
  "sort",
  "toLocaleLowerCase",
  "toLocaleUpperCase",
  "toLowerCase",
  "toReversed",
  "toSorted",
  "toUpperCase",
  "trim",
  "trimEnd",
  "trimStart",
]);

const DEFAULT_NORMALIZING_FUNCTIONS: readonly string[] = [
  "orderBy",
  "reduceAsync",
  "sortBy",
  "uniq",
  "uniqBy",
  "uniqWith",
];

export const DESTRUCTIVE_OPERATIONS: ReadonlySet<string> = new Set([
  "add",
  "clear",
  "copyWithin",
  "delete",
  "fill",
  "pop",
  "push",
  "reverse",
  "set",
  "shift",
  "sort",
  "splice",
  "unshift",
]);

export const SPREADING_ASSIGNMENT = "assign";

export const SPREADING_ASSIGNMENT_NAMESPACE = "Object";

const NORMALIZING_FUNCTIONS_OPTION = "normalizingFunctions";

export const normalizingFunctionsFrom = (options: Readonly<Options>): ReadonlySet<string> => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return new Set(DEFAULT_NORMALIZING_FUNCTIONS);
  }

  const configured = first[NORMALIZING_FUNCTIONS_OPTION];
  if (!Array.isArray(configured)) return new Set(DEFAULT_NORMALIZING_FUNCTIONS);
  return new Set(configured.filter((entry): entry is string => typeof entry === "string"));
};
