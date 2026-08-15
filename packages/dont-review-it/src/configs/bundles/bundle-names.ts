/** @canonical-values dont-review-it.lint-bundle */
const LINT_BUNDLES = [
  "governance",
  "writing",
  "testing",
  "single-ownership",
  "mutation-and-failure",
  "toolchain",
  "publishing",
  "ci",
] as const;

export type LintBundle = (typeof LINT_BUNDLES)[number];

export const LINT_BUNDLE = {
  governance: LINT_BUNDLES[0],
  writing: LINT_BUNDLES[1],
  testing: LINT_BUNDLES[2],
  singleOwnership: LINT_BUNDLES[3],
  mutationAndFailure: LINT_BUNDLES[4],
  toolchain: LINT_BUNDLES[5],
  publishing: LINT_BUNDLES[6],
  ci: LINT_BUNDLES[7],
} as const satisfies Record<string, LintBundle>;

export const SELECTABLE_LINT_BUNDLES: readonly LintBundle[] = LINT_BUNDLES.filter(
  (bundle) => bundle !== LINT_BUNDLE.governance,
);

export type LintBundleSelection = "all" | readonly LintBundle[];

export const selectedLintBundles = (selection: LintBundleSelection): readonly LintBundle[] => [
  LINT_BUNDLE.governance,
  ...(selection === "all" ? SELECTABLE_LINT_BUNDLES : selection).filter(
    (bundle) => bundle !== LINT_BUNDLE.governance,
  ),
];
