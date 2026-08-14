import { readlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { readTextOrNull, statOrNull } from "../scan/read-file.ts";

import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const missing = (checked: string): string =>
  `規範文書の隣に \`${checked}\` が無い。この名前を期待して読む主体には指示が届かない。規範文書への結び付きとして作る。`;

const wrongTarget = ({
  target: checked,
  linkTarget,
}: {
  readonly target: string;
  readonly linkTarget: string;
}): string =>
  `\`${checked}\` の結び付きが \`${linkTarget}\` を指しており、隣の規範文書ではない。同じ場所の規範文書を指すよう作り直す。`;

const linkProblem = async ({
  repositoryRoot,
  directory,
  companionFile,
  companionFileName,
  config,
}: {
  readonly repositoryRoot: string;
  readonly directory: string;
  readonly companionFile: string;
  readonly companionFileName: string;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly DocumentProblem[]> => {
  const linkTarget = await readlink(join(repositoryRoot, companionFile));
  const wanted = resolve(repositoryRoot, directory, config.normativeDocumentFileName);
  if (resolve(repositoryRoot, directory, linkTarget) === wanted) return [];

  return [
    {
      file: companionFile,
      line: null,
      message: wrongTarget({ target: companionFileName, linkTarget }),
    },
  ];
};

const notALink = (checked: string): string =>
  `\`${checked}\` が通常のファイルとして中身を持っている。同じ指示の実体が 2 つある状態になる。中身を規範文書へ移してから、規範文書への結び付きに置き換える。`;

const pointerOnly = (checked: string): string =>
  `\`${checked}\` が規範文書を指す参照 1 つだけを中身として持っている。読み手によっては参照として解釈されず、その 1 行だけが指示として読まれる。規範文書への結び付きに置き換える。`;

const isPointerOnly = ({
  content,
  normativeFileName,
}: {
  readonly content: string;
  readonly normativeFileName: string;
}): boolean => {
  const writtenBody = content.replace(/^---\n[\s\S]*?\n---\n/u, "").trim();

  return (
    writtenBody !== "" && !writtenBody.includes("\n") && writtenBody.includes(normativeFileName)
  );
};

const regularFileProblem = async ({
  repositoryRoot,
  companionFile,
  companionFileName,
  config,
}: {
  readonly repositoryRoot: string;
  readonly companionFile: string;
  readonly companionFileName: string;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly DocumentProblem[]> => {
  const writtenContent = String(await readTextOrNull(join(repositoryRoot, companionFile)));
  const complaint = isPointerOnly({
    content: writtenContent,
    normativeFileName: config.normativeDocumentFileName,
  })
    ? pointerOnly(companionFileName)
    : notALink(companionFileName);

  return [{ file: companionFile, line: null, message: complaint }];
};

const companionProblem = async ({
  repositoryRoot,
  document,
  companionFileName,
  config,
}: {
  readonly repositoryRoot: string;
  readonly document: NormativeDocument;
  readonly companionFileName: string;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly DocumentProblem[]> => {
  const directory = dirname(document.file);
  const companionFile = join(directory === "." ? "" : directory, companionFileName);

  const stats = await statOrNull(join(repositoryRoot, companionFile));
  if (stats === null) {
    return [{ file: companionFile, line: null, message: missing(companionFileName) }];
  }

  return stats.isSymbolicLink()
    ? linkProblem({ repositoryRoot, directory, companionFile, companionFileName, config })
    : regularFileProblem({ repositoryRoot, companionFile, companionFileName, config });
};

export const companionFileProblems = async ({
  repositoryRoot,
  documents,
  config,
}: {
  readonly repositoryRoot: string;
  readonly documents: readonly NormativeDocument[];
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly DocumentProblem[]> => {
  const nested = await Promise.all(
    documents.flatMap((document) =>
      config.companionFileNames.map((companionFileName) =>
        companionProblem({ repositoryRoot, document, companionFileName, config }),
      ),
    ),
  );

  return nested.flat();
};
