import { lstatSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { normalize } from "node:path/posix";

import { readUnlessMissing } from "@mst/repository-checks";

import type { RepositoryProblem } from "../problem.ts";
import type { RequiredFileFormConfig } from "./config.ts";

const entryAt = (
  path: string,
):
  | { readonly kind: "missing" }
  | { readonly kind: "regularFile" }
  | { readonly kind: "symbolicLink"; readonly pointsAt: string }
  | { readonly kind: "other" } => {
  const stats = readUnlessMissing(() => lstatSync(path));
  if (stats === null) return { kind: "missing" };
  if (stats.isSymbolicLink()) {
    return { kind: "symbolicLink", pointsAt: readlinkSync(path) };
  }
  return stats.isFile() ? { kind: "regularFile" } : { kind: "other" };
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
  const instruction = entryAt(join(repositoryRoot, packageRoot, config.agentInstructionFileName));
  const linked = entryAt(join(repositoryRoot, packageRoot, config.linkedAgentInstructionFileName));

  if (instruction.kind === "missing" && linked.kind === "missing") return [];

  if (instruction.kind !== "regularFile") {
    return [
      {
        file: normalize(`${packageRoot}/${config.agentInstructionFileName}`),
        line: null,
        message: `Agent instructions must live in ${config.agentInstructionFileName} as a regular file. Write that file here and leave ${config.linkedAgentInstructionFileName} pointing at it.`,
      },
    ];
  }

  if (linked.kind === "missing") {
    return [
      {
        file: normalize(`${packageRoot}/${config.linkedAgentInstructionFileName}`),
        line: null,
        message: `A directory that instructs agents must not leave the second name unreachable. Create it here as a symbolic link to ${config.agentInstructionFileName}.`,
      },
    ];
  }

  return linked.kind === "symbolicLink" && linked.pointsAt === config.agentInstructionFileName
    ? []
    : [
        {
          file: normalize(`${packageRoot}/${config.linkedAgentInstructionFileName}`),
          line: null,
          message: `${config.linkedAgentInstructionFileName} must be a symbolic link whose target is exactly ${config.agentInstructionFileName}. Replace this entry with that link.`,
        },
      ];
};
