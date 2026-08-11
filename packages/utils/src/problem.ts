export type RepositoryProblem = {
  readonly file: string;
  readonly line: number | null;
  readonly message: string;
};
