import type { RepositoryProblem } from "@mst/utils";

export type DocumentProblem = RepositoryProblem;

export const formatProblem = ({ file, line, message }: DocumentProblem): string =>
  line === null ? `${file} ${message}` : `${file}:${line} ${message}`;
