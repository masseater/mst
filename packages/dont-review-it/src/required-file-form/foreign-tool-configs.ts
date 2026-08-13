import { join } from "node:path";
import { normalize } from "node:path/posix";

import { isFile } from "../lint/oxlint/lib/canonical-values/source-files.ts";

import type { RepositoryProblem } from "../problem.ts";
import type { RequiredFileFormConfig, ToolConfigFormats } from "./config.ts";

const configsOf = ({
  repositoryRoot,
  packageRoot,
  tool,
}: {
  readonly repositoryRoot: string;
  readonly packageRoot: string;
  readonly tool: ToolConfigFormats;
}): readonly RepositoryProblem[] =>
  tool.foreignFileNames
    .filter((fileName) => isFile(join(repositoryRoot, packageRoot, fileName)))
    .map((fileName) => ({
      file: normalize(`${packageRoot}/${fileName}`),
      line: null,
      message: `A configuration for ${tool.toolName} must not stay in a format the type checker never reads. Move what it declares into ${tool.typeScriptFileName}.`,
    }));

export const foreignToolConfigsIn = ({
  repositoryRoot,
  packageRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly packageRoot: string;
  readonly config: RequiredFileFormConfig;
}): readonly RepositoryProblem[] =>
  config.tools.flatMap((tool) => configsOf({ repositoryRoot, packageRoot, tool }));
