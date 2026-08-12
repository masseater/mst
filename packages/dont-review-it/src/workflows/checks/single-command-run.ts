import { entriesNamedInSteps } from "../steps.ts";
import { lineOf, scalarText, type WorkflowDocument } from "../workflow-document.ts";

import type { RepositoryProblem } from "../../problem.ts";
import type { WorkflowChecksConfig } from "../config.ts";

const CONTINUATION_PATTERN = /\\\n/gu;

const commandLinesOf = (script: string): readonly string[] =>
  script
    .replace(CONTINUATION_PATTERN, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

const startsWithControlFlow = (line: string, config: WorkflowChecksConfig): boolean =>
  config.controlFlowKeywords.some((keyword) => line === keyword || line.startsWith(`${keyword} `));

const isSingleCommand = (script: string, config: WorkflowChecksConfig): boolean => {
  const lines = commandLinesOf(script);
  if (lines.length > 1) return false;

  return !lines.some(
    (line) =>
      startsWithControlFlow(line, config) ||
      config.statementSeparators.some((separator) => line.includes(separator)),
  );
};

export const multiCommandRuns = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly RepositoryProblem[] =>
  entriesNamedInSteps({ document, config, key: config.runKey }).flatMap((listed) => {
    const script = scalarText(listed.value);
    if (script === null || isSingleCommand(script, config)) return [];

    return [
      {
        file: document.relativePath,
        line: lineOf(document, listed.key),
        message: `A run block must not hold more than one command call, because branching, retrying, looping and target discovery placed here run only inside this file and carry neither types nor tests. Move the logic into a command in this repository, and call that command once from here.`,
      },
    ];
  });
