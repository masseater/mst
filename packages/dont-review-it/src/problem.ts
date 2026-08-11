import type { RepositoryProblem } from "@mst/repository-checks";

export type { RepositoryProblem } from "@mst/repository-checks";

export const formatRepositoryProblem = ({ file, line, message }: RepositoryProblem): string =>
  line === null ? `${file} ${message}` : `${file}:${line} ${message}`;
