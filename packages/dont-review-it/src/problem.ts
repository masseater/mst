export type RepositoryProblem = {
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

export const formatRepositoryProblem = ({ file, line, message }: RepositoryProblem): string =>
  `${file}:${line} ${message}`;
