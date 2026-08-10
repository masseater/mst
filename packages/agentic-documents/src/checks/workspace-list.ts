import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { readTextOrNull } from "../scan/read-file.ts";
import { collectWorkspaces, type WorkspaceEntry } from "../scan/workspaces.ts";

import type { AgenticDocumentsConfig, WorkspaceListConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";

const missingDocument = (path: string): string =>
  `ワークスペースの一覧 \`${path}\` が無い。文書を作り、生成の境界を置く。境界の内側は機械が書くので、人は前後の散文だけを書く。`;

const missingRegion = (path: string): string =>
  `\`${path}\` に生成の境界が無い。開始と終了の記述を置く。境界が無いと、機械がどこへ書けばよいかを決められない。`;

const staleRegion = (path: string): string =>
  `\`${path}\` の一覧が、ワークスペース定義から生成した内容と一致していない。書き込む様態で走らせて更新する。手で書き換えると次に増えたときに同じことが起きる。`;

const incompleteWorkspace = ({
  directory,
  reason,
}: {
  readonly directory: string;
  readonly reason: string;
}): string =>
  `ワークスペース \`${directory}\` の一覧を生成できない: ${reason}。空欄や欠落した行を出すと、存在するものが見えなくなったまま固定される。`;

const renderList = (entries: readonly WorkspaceEntry[]): string =>
  entries.map((entry) => `- \`${entry.directory}\` — ${entry.description}`).join("\n");

type Region = {
  readonly before: string;
  readonly content: string;
  readonly after: string;
};

const regionOf = ({
  source,
  begin,
  end,
}: {
  readonly source: string;
  readonly begin: string;
  readonly end: string;
}): Region | null => {
  const beginIndex = source.indexOf(begin);
  const endIndex = source.indexOf(end, beginIndex);
  if (beginIndex === -1 || endIndex === -1) return null;

  return {
    before: source.slice(0, beginIndex + begin.length),
    content: source.slice(beginIndex + begin.length, endIndex).trim(),
    after: source.slice(endIndex),
  };
};

const loadRegion = async ({
  repositoryRoot,
  listConfig,
}: {
  readonly repositoryRoot: string;
  readonly listConfig: WorkspaceListConfig;
}): Promise<{ readonly region: Region } | { readonly problem: DocumentProblem }> => {
  const source = await readTextOrNull(join(repositoryRoot, listConfig.path));
  if (source === null) {
    return {
      problem: { file: listConfig.path, line: null, message: missingDocument(listConfig.path) },
    };
  }

  const region = regionOf({
    source,
    begin: listConfig.region.begin,
    end: listConfig.region.end,
  });

  return region === null
    ? {
        problem: { file: listConfig.path, line: null, message: missingRegion(listConfig.path) },
      }
    : { region };
};

const reconcileRegion = async ({
  repositoryRoot,
  listConfig,
  expected,
  write,
}: {
  readonly repositoryRoot: string;
  readonly listConfig: WorkspaceListConfig;
  readonly expected: string;
  readonly write: boolean;
}): Promise<readonly DocumentProblem[]> => {
  const loaded = await loadRegion({ repositoryRoot, listConfig });
  if ("problem" in loaded) return [loaded.problem];

  const { region } = loaded;
  if (region.content === expected) return [];
  if (!write) {
    return [{ file: listConfig.path, line: null, message: staleRegion(listConfig.path) }];
  }

  await writeFile(
    join(repositoryRoot, listConfig.path),
    `${region.before}\n\n${expected}\n\n${region.after}`,
  );
  return [];
};

export const workspaceListProblems = async ({
  repositoryRoot,
  config,
  write,
}: {
  readonly repositoryRoot: string;
  readonly config: AgenticDocumentsConfig;
  readonly write: boolean;
}): Promise<readonly DocumentProblem[]> => {
  const listConfig = config.workspaceList;
  if (listConfig === null) return [];

  const collection = await collectWorkspaces({
    repositoryRoot,
    definitionFile: config.workspaceDefinition.file,
    definitionField: config.workspaceDefinition.field,
  });

  if (collection.incomplete.length > 0) {
    return collection.incomplete.map((item) => ({
      file: join(item.directory, "package.json"),
      line: null,
      message: incompleteWorkspace(item),
    }));
  }

  return reconcileRegion({
    repositoryRoot,
    listConfig,
    expected: renderList(collection.entries),
    write,
  });
};
