export type ForbiddenNamePattern = {
  readonly pattern: string;
};

export const FORBIDDEN_AMBIGUOUS_NAMES: readonly ForbiddenNamePattern[] = [
  { pattern: "outcome$" },
  { pattern: "result$" },
  { pattern: "^vals?$" },
  { pattern: "^values?$" },
  { pattern: "^res$" },
  { pattern: "^ret$" },
  { pattern: "^data$" },
  { pattern: "^actual$" },
];

export const createForbiddenNameMatcher = (
  patterns: readonly ForbiddenNamePattern[],
): ((name: string) => boolean) => {
  const matchers = patterns.map(({ pattern }) => new RegExp(pattern, "iu"));
  return (name) => matchers.some((matcher) => matcher.test(name));
};
