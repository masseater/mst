import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative } from "node:path";

import { attempt } from "es-toolkit";

import { isInsideGeneratedRegion } from "../markdown/generated-region.ts";
import { descendants, lineOf, offsetOf } from "../markdown/nodes.ts";

import type { Nodes } from "mdast";
import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const DOCUMENT_EXTENSION = ".md";

const PLACEHOLDER_MARKS = ["*", "<", ">", "..."];

const withoutAnchor = (checked: string): string => {
  const index = checked.indexOf("#");
  return index === -1 ? checked : checked.slice(0, index);
};

const isSkippable = (checked: string): boolean =>
  checked === "" ||
  checked.startsWith("#") ||
  checked.startsWith("http://") ||
  checked.startsWith("https://") ||
  checked.startsWith("mailto:") ||
  isAbsolute(checked) ||
  !withoutAnchor(checked).endsWith(DOCUMENT_EXTENSION) ||
  PLACEHOLDER_MARKS.some((mark) => checked.includes(mark));

type Reference = {
  readonly target: string;
  readonly fromRepositoryRoot: boolean;
  readonly line: number | null;
};

const referencesIn = ({
  document,
  config,
}: {
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): readonly Reference[] => {
  const pointerPattern = new RegExp(
    `(?:^|\\s)${config.pointerMark}([A-Za-z0-9._/-]+\\.md(?:#[^\\s]+)?)(?=$|\\s|[),.;:])`,
    "gu",
  );

  return descendants(document.tree)
    .filter((node) => !isInsideGeneratedRegion(offsetOf(node), document.generated))
    .flatMap((node: Nodes): readonly Reference[] => {
      if (node.type === "link") {
        return [{ target: node.url, fromRepositoryRoot: false, line: lineOf(node) }];
      }

      if (node.type === "inlineCode") {
        return config.repositoryRelativePrefixes.some((prefix) => node.value.startsWith(prefix))
          ? [{ target: node.value, fromRepositoryRoot: true, line: lineOf(node) }]
          : [];
      }

      if (node.type !== "text") return [];

      const baseOffset = offsetOf(node);
      return [...node.value.matchAll(pointerPattern)].map((match) => ({
        target: String(match[1]),
        fromRepositoryRoot: true,
        line: document.source.slice(0, baseOffset + match.index).split("\n").length,
      }));
    });
};

const missingAnchor = ({
  reference,
  resolved,
}: {
  readonly reference: string;
  readonly resolved: string;
}): string =>
  `参照 \`${reference}\` が指す位置が \`${resolved}\` に無い。現在の見出しを指すか、位置の指定を消す。指していた節の内容が今どこにあるかを確かめる。`;

const anchorOf = (checked: string): string | null => {
  const index = checked.indexOf("#");
  if (index === -1 || index === checked.length - 1) return null;

  const encoded = checked.slice(index + 1);
  const [failure, decoded] = attempt(() => decodeURIComponent(encoded));

  return failure === null ? decoded : encoded;
};

const headingAnchor = (heading: string): string =>
  heading
    .replaceAll("`", "")
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replaceAll(/\s+/gu, "-");

const headingAnchorsOf = (source: string): ReadonlySet<string> =>
  new Set(
    source
      .split("\n")
      .filter((line) => /^#{1,6}\s+/u.test(line))
      .map((line) => headingAnchor(line.replace(/^#{1,6}\s+/u, ""))),
  );

const anchorProblem = async ({
  reference,
  document,
  repositoryRoot,
  existing,
}: {
  readonly reference: Reference;
  readonly document: NormativeDocument;
  readonly repositoryRoot: string;
  readonly existing: readonly string[];
}): Promise<readonly DocumentProblem[]> => {
  const anchor = anchorOf(reference.target);
  if (anchor === null) return [];

  const sources = await Promise.all(existing.map((candidate) => readFile(candidate, "utf-8")));
  if (sources.some((source) => headingAnchorsOf(source).has(headingAnchor(anchor)))) return [];

  return [
    {
      file: document.file,
      line: reference.line,
      message: missingAnchor({
        reference: reference.target,
        resolved: relative(repositoryRoot, String(existing[0])),
      }),
    },
  ];
};

const owningWorkspaceOf = ({
  document,
  workspaceDirectories,
}: {
  readonly document: NormativeDocument;
  readonly workspaceDirectories: readonly string[];
}): string | null =>
  workspaceDirectories
    .filter((workspaceDirectory) => document.file.startsWith(`${workspaceDirectory}/`))
    .toSorted((left, right) => right.length - left.length)
    .at(0) ?? null;

const resolvedCandidates = ({
  reference,
  document,
  repositoryRoot,
  workspaceDirectories,
}: {
  readonly reference: Reference;
  readonly document: NormativeDocument;
  readonly repositoryRoot: string;
  readonly workspaceDirectories: readonly string[];
}): readonly string[] => {
  const relativeTarget = withoutAnchor(reference.target);

  if (!reference.fromRepositoryRoot) {
    return [normalize(join(repositoryRoot, dirname(document.file), relativeTarget))];
  }

  const owningWorkspace = owningWorkspaceOf({ document, workspaceDirectories });

  return [
    normalize(join(repositoryRoot, relativeTarget)),
    ...(owningWorkspace === null
      ? []
      : [normalize(join(repositoryRoot, owningWorkspace, relativeTarget))]),
  ];
};

const missingFile = ({
  reference,
  resolved,
}: {
  readonly reference: string;
  readonly resolved: string;
}): string =>
  `参照 \`${reference}\` の指し先 \`${resolved}\` が実在しない。参照を更新するか、参照ごと消す。`;

const referenceProblem = async ({
  reference,
  document,
  repositoryRoot,
  workspaceDirectories,
}: {
  readonly reference: Reference;
  readonly document: NormativeDocument;
  readonly repositoryRoot: string;
  readonly workspaceDirectories: readonly string[];
}): Promise<readonly DocumentProblem[]> => {
  const candidates = resolvedCandidates({
    reference,
    document,
    repositoryRoot,
    workspaceDirectories,
  });
  const existing = candidates.filter((candidate) => existsSync(candidate));

  if (existing.length === 0) {
    return [
      {
        file: document.file,
        line: reference.line,
        message: missingFile({
          reference: reference.target,
          resolved: relative(repositoryRoot, String(candidates[0])),
        }),
      },
    ];
  }

  return anchorProblem({ reference, document, repositoryRoot, existing });
};

export const brokenReferences = async ({
  repositoryRoot,
  document,
  config,
  workspaceDirectories,
}: {
  readonly repositoryRoot: string;
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
  readonly workspaceDirectories: readonly string[];
}): Promise<readonly DocumentProblem[]> => {
  const references = referencesIn({ document, config }).filter(
    (reference) => !isSkippable(reference.target),
  );

  const problems = await Promise.all(
    references.map((reference) =>
      referenceProblem({ reference, document, repositoryRoot, workspaceDirectories }),
    ),
  );

  return problems.flat();
};
