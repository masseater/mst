export type DependencyCatalogProblem = {
  readonly file: string;
  readonly message: string;
};

export type DependencyCatalogFindings = {
  readonly problems: readonly DependencyCatalogProblem[];
  readonly warnings: readonly DependencyCatalogProblem[];
};

export const NO_DEPENDENCY_CATALOG_FINDINGS: DependencyCatalogFindings = {
  problems: [],
  warnings: [],
};

export const formatDependencyCatalogProblem = ({
  file,
  message,
}: DependencyCatalogProblem): string => `${file} ${message}`;
