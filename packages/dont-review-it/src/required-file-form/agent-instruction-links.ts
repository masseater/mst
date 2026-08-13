import { lstatSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { normalize } from "node:path/posix";

import { readUnlessMissing } from "@mst/repository-checks";

import { isFile } from "../lint/oxlint/lib/canonical-values/source-files.ts";

import type { RepositoryProblem } from "../problem.ts";
import type { RequiredFileFormConfig } from "./config.ts";

const linkedEntryAt = (
  path: string,
):
  | { readonly kind: "missing" }
  | { readonly kind: "link"; readonly pointsAt: string }
  | { readonly kind: "copy" } => {
  const linkedFileStats = readUnlessMissing(() => lstatSync(path));
  if (linkedFileStats === null) return { kind: "missing" };
  return linkedFileStats.isSymbolicLink()
    ? { kind: "link", pointsAt: readlinkSync(path) }
    : { kind: "copy" };
};

export const agentInstructionLinksIn = ({
  repositoryRoot,
  packageRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly packageRoot: string;
  readonly config: RequiredFileFormConfig;
}): readonly RepositoryProblem[] => {
  const instructionExists = isFile(
    join(repositoryRoot, packageRoot, config.agentInstructionFileName),
  );
  const linked = linkedEntryAt(
    join(repositoryRoot, packageRoot, config.linkedAgentInstructionFileName),
  );

  if (linked.kind === "missing") {
    return instructionExists
      ? [
          {
            file: normalize(`${packageRoot}/${config.linkedAgentInstructionFileName}`),
            line: null,
            message: `A directory that instructs agents must not leave the second name unreachable. Create it here as a symbolic link to ${config.agentInstructionFileName}.`,
          },
        ]
      : [];
  }

  if (!instructionExists) {
    return [
      {
        file: normalize(`${packageRoot}/${config.agentInstructionFileName}`),
        line: null,
        message: `Agent instructions must not live under ${config.linkedAgentInstructionFileName} alone. Write them here and leave ${config.linkedAgentInstructionFileName} pointing at this file.`,
      },
    ];
  }

  return linked.kind === "link" && linked.pointsAt === config.agentInstructionFileName
    ? []
    : [
        {
          file: normalize(`${packageRoot}/${config.linkedAgentInstructionFileName}`),
          line: null,
          message: `Agent instructions must not be spelled twice. Replace this file with a symbolic link to ${config.agentInstructionFileName}.`,
        },
      ];
};
