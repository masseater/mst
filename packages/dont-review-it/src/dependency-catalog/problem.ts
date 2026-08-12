import type { RepositoryProblem } from "@mst/utils";

export type DependencyCatalogProblem = RepositoryProblem;

export type DependencyCatalogFindings = readonly DependencyCatalogProblem[];

export const NO_DEPENDENCY_CATALOG_FINDINGS: DependencyCatalogFindings = [];

export const formatDependencyCatalogProblem = ({
  file,
  message,
}: DependencyCatalogProblem): string => `${file} ${message}`;
