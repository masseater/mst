import { join } from "node:path";

import { statOrNull } from "../scan/read-file.ts";
import { collectWorkspaces } from "../scan/workspaces.ts";

import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";

const complaint = (fileName: string): string =>
  `この場所に \`${fileName}\` が無い。ここで作業する読み手は、固有の規約が無いのか書かれていないだけなのかを区別できない。この場所が守るものを書く。見出しだけの空の文書で通すと、無いことすら読み取れなくなる。`;

const REPOSITORY_ROOT_LOCATION = ".";

const locationsRequiringDocument = async ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly string[]> => {
  const listedCollection = await collectWorkspaces({
    repositoryRoot,
    definitionFile: config.workspaceDefinition.file,
    definitionField: config.workspaceDefinition.field,
  });

  return [REPOSITORY_ROOT_LOCATION, ...listedCollection.entries.map((listed) => listed.directory)];
};

export const missingNormativeDocuments = async ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly DocumentProblem[]> => {
  const locations = await locationsRequiringDocument({ repositoryRoot, config });

  const found = await Promise.all(
    locations.map(async (location): Promise<readonly DocumentProblem[]> => {
      const relativePath =
        location === REPOSITORY_ROOT_LOCATION
          ? config.normativeDocumentFileName
          : join(location, config.normativeDocumentFileName);

      const stats = await statOrNull(join(repositoryRoot, relativePath));

      return stats === null
        ? [
            {
              file: relativePath,
              line: null,
              message: complaint(config.normativeDocumentFileName),
            },
          ]
        : [];
    }),
  );

  return found.flat();
};
