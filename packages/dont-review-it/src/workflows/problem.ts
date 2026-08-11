export type WorkflowProblem = {
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

export const formatWorkflowProblem = ({ file, line, message }: WorkflowProblem): string =>
  `${file}:${line} ${message}`;
