import { listRepositoryFiles } from "../lint/oxlint/lib/canonical-values/source-files.ts";

import type { RepositoryProblem } from "../problem.ts";
import type { RequiredFileFormConfig, ToolConfigFormats } from "./config.ts";

const toolFor = (
  fileName: string,
  config: RequiredFileFormConfig,
): ToolConfigFormats | undefined =>
  config.tools.find((tool) => tool.foreignFileNames.includes(fileName));

export const foreignToolConfigsUnder = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: RequiredFileFormConfig;
}): readonly RepositoryProblem[] =>
  listRepositoryFiles(repositoryRoot).cacheInputs.flatMap((sourceFile) => {
    const fileName = sourceFile.relativePath.split("/").at(-1) ?? sourceFile.relativePath;
    const tool = toolFor(fileName, config);
    return tool === undefined
      ? []
      : [
          {
            file: sourceFile.relativePath,
            line: null,
            message: `A configuration for ${tool.toolName} must not stay in a format the type checker never reads. Move what it declares into ${tool.typeScriptFileName}.`,
          },
        ];
  });
