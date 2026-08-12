import type { RepositoryProblem } from "@mst/repository-checks";

export type DependencyCatalogProblem = RepositoryProblem;

export type DependencyCatalogFindings = {
  readonly problems: readonly DependencyCatalogProblem[];
  readonly warnings: readonly DependencyCatalogProblem[];
};

export type DependencyCatalogReport = DependencyCatalogFindings & {
  readonly definitionUnreadable: boolean;
  readonly definitionMissing: boolean;
  readonly scanned: number;
};

export const NO_DEPENDENCY_CATALOG_FINDINGS: DependencyCatalogFindings = {
  problems: [],
  warnings: [],
};

export const formatDependencyCatalogProblem = ({
  file,
  message,
}: DependencyCatalogProblem): string => `${file} ${message}`;
