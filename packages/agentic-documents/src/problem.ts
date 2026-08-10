export type DocumentProblem = {
  readonly file: string;
  readonly line: number | null;
  readonly message: string;
};

export const formatProblem = ({ file, line, message }: DocumentProblem): string =>
  line === null ? `${file} ${message}` : `${file}:${line} ${message}`;
