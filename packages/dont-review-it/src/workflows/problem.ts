import type { LocatedProblem } from "@mst/utils";

export type WorkflowProblem = LocatedProblem;

export const formatWorkflowProblem = ({ file, line, message }: WorkflowProblem): string =>
  `${file}:${line} ${message}`;
