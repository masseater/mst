import { join } from "node:path";

import { normativeDocumentsIn } from "@mst/repository-checks";

import { statOrNull } from "../scan/read-file.ts";
import { collectWorkspaces } from "../scan/workspaces.ts";

import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";

const complaint = (fileName: string): string =>
  `この場所に \`${fileName}\` が無い。ここで作業する読み手は、固有の規約が無いのか書かれていないだけなのかを区別できない。この場所が守るものを書く。見出しだけの空の文書で通すと、無いことすら読み取れなくなる。`;

const emptyDeclaredDirectory = (directory: string): string =>
  `\`${directory}\` が規範文書の置き場として宣言されているのに、そこに文書が 1 つも無い。文書を置くか、宣言から外す。宣言だけが残ると、この置き場は検査されているのに何も見ていない状態になり、報告が 0 件であることが根拠として読めなくなる。`;

const emptyDeclaredDirectories = ({
  repositoryRoot,
  config,
  workspaceDirectories,
}: {
  readonly repositoryRoot: string;
  readonly config: AgenticDocumentsConfig;
  readonly workspaceDirectories: readonly string[];
}): readonly DocumentProblem[] =>
  config.normativeDocumentDirectories.flatMap((directory): readonly DocumentProblem[] =>
    normativeDocumentsIn({
      repositoryRoot,
      places: { fileName: config.normativeDocumentFileName, directories: [directory] },
      workspaceDirectories,
    }).length === 0
      ? [{ file: directory, line: null, message: emptyDeclaredDirectory(directory) }]
      : [],
  );

const REPOSITORY_ROOT_LOCATION = ".";

export const missingNormativeDocuments = async ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly DocumentProblem[]> => {
  const listedCollection = await collectWorkspaces({
    repositoryRoot,
    definitionFile: config.workspaceDefinition.file,
    definitionField: config.workspaceDefinition.field,
  });
  const workspaceDirectories = listedCollection.entries.map((listed) => listed.directory);
  const locations = [REPOSITORY_ROOT_LOCATION, ...workspaceDirectories];

  const declaredDirectoryProblems = emptyDeclaredDirectories({
    repositoryRoot,
    config,
    workspaceDirectories,
  });

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

  return [...declaredDirectoryProblems, ...found.flat()];
};
