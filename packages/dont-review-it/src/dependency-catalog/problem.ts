import type { RepositoryProblem } from "@mst/repository-checks";

export type DependencyCatalogProblem = RepositoryProblem;

export type DependencyCatalogFindings = {
  readonly problems: readonly DependencyCatalogProblem[];
};

export type DependencyCatalogReport = DependencyCatalogFindings & {
  readonly definitionUnreadable: boolean;
};

export const NO_DEPENDENCY_CATALOG_FINDINGS: DependencyCatalogFindings = {
  problems: [],
};

export const formatDependencyCatalogProblem = ({
  file,
  message,
}: DependencyCatalogProblem): string => `${file} ${message}`;
