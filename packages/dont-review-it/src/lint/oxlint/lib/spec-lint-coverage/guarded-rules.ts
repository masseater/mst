export const SPEC_DISCIPLINE_RULES: readonly string[] = [
  "require-test-block-spelling--use-configured-fn",
  "forbid-it-extend--use-test-extend",
  "no-vitest-context-expect--import-expect-from-vitest",
  "no-computed-test-api-member--use-static-member",
  "no-test-context-escape--destructure-fixtures-by-name",
  "no-expect-synthetic-subject--yield-from-fixture",
  "no-fixture-construct-in-use--yield-sut-output",
  "no-fixture-copy-subject--yield-sut-output",
  "no-fixture-forward-subject--yield-sut-output",
  "no-fixture-factory-function--inline-owned-setup",
  "require-vitest-extend-builder--infer-fixture-type",
  "no-lint-suppression-in-spec--fix-the-violation",
  "require-spec-lint-coverage--lint-every-spec-file",
];

export const SHARED_SETTING_KEYS: ReadonlySet<string> = new Set([
  "blockSpelling",
  "mockNamespace",
  "runnerModules",
  "specFileSuffixes",
]);
