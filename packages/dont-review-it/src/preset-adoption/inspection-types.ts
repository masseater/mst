import type { RepositoryProblem } from "@mst/repository-checks";
import type { ESTree } from "@oxlint/plugins";

export type DisabledRuleDeclaration = {
  readonly ruleId: string;
  readonly line: number;
  readonly filePatterns: readonly string[];
  readonly excludeFilePatterns: readonly string[];
  readonly pathReachInspectable: boolean;
};

export type PresetAdoptionInspection = {
  readonly disabledDeclarations: readonly DisabledRuleDeclaration[];
  readonly problems: readonly RepositoryProblem[];
};

export type RuleBlockInspection = {
  readonly disabledDeclarations: readonly Omit<
    DisabledRuleDeclaration,
    "filePatterns" | "excludeFilePatterns" | "pathReachInspectable"
  >[];
  readonly problems: readonly RepositoryProblem[];
};

export type StaticPropertyResolution =
  | { readonly kind: "missing" }
  | { readonly kind: "problem"; readonly problem: RepositoryProblem }
  | { readonly kind: "present"; readonly property: ESTree.ObjectProperty };
