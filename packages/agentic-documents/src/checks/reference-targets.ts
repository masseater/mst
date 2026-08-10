import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative } from "node:path";

import { lineAtOffset } from "@mst/utils";
import { attempt } from "es-toolkit";

import { isInsideGeneratedRegion } from "../markdown/generated-region.ts";
import { descendants, lineOf, offsetOf } from "../markdown/nodes.ts";

import type { Nodes } from "mdast";
import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const missingFile = ({
  reference,
  resolved,
}: {
  readonly reference: string;
  readonly resolved: string;
}): string =>
  `参照 \`${reference}\` の指し先 \`${resolved}\` が実在しない。参照を更新するか、参照ごと消す。`;

const missingAnchor = ({
  reference,
  resolved,
}: {
  readonly reference: string;
  readonly resolved: string;
}): string =>
  `参照 \`${reference}\` が指す位置が \`${resolved}\` に無い。現在の見出しを指すか、位置の指定を消す。指していた節の内容が今どこにあるかを確かめる。`;

const DOCUMENT_EXTENSION = ".md";

const PLACEHOLDER_MARKS = ["*", "<", ">", "..."];

type Reference = {
  readonly target: string;
  readonly fromRepositoryRoot: boolean;
  readonly line: number | null;
};

const anchorOf = (target: string): string | null => {
  const index = target.indexOf("#");
  if (index === -1 || index === target.length - 1) return null;

  const encoded = target.slice(index + 1);
  const [failure, decoded] = attempt(() => decodeURIComponent(encoded));

  return failure === null ? decoded : encoded;
};

const withoutAnchor = (target: string): string => {
  const index = target.indexOf("#");
  return index === -1 ? target : target.slice(0, index);
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

const isSkippable = (target: string): boolean =>
  target === "" ||
  target.startsWith("#") ||
  target.startsWith("http://") ||
  target.startsWith("https://") ||
  target.startsWith("mailto:") ||
  isAbsolute(target) ||
  !withoutAnchor(target).endsWith(DOCUMENT_EXTENSION) ||
  PLACEHOLDER_MARKS.some((mark) => target.includes(mark));

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
        line: lineAtOffset(document.source, baseOffset + match.index),
      }));
    });
};

export const brokenReferences = async ({
  repositoryRoot,
  document,
  config,
}: {
  readonly repositoryRoot: string;
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly DocumentProblem[]> => {
  const references = referencesIn({ document, config }).filter(
    (reference) => !isSkippable(reference.target),
  );

  const problems = await Promise.all(
    references.map(async (reference): Promise<readonly DocumentProblem[]> => {
      const relativeTarget = withoutAnchor(reference.target);
      const resolvedAbsolute = normalize(
        reference.fromRepositoryRoot
          ? join(repositoryRoot, relativeTarget)
          : join(repositoryRoot, dirname(document.file), relativeTarget),
      );
      const resolved = relative(repositoryRoot, resolvedAbsolute);

      if (!existsSync(resolvedAbsolute)) {
        return [
          {
            file: document.file,
            line: reference.line,
            message: missingFile({ reference: reference.target, resolved }),
          },
        ];
      }

      const anchor = anchorOf(reference.target);
      if (anchor === null) return [];

      const targetSource = await readFile(resolvedAbsolute, "utf-8");
      if (headingAnchorsOf(targetSource).has(headingAnchor(anchor))) return [];

      return [
        {
          file: document.file,
          line: reference.line,
          message: missingAnchor({ reference: reference.target, resolved }),
        },
      ];
    }),
  );

  return problems.flat();
};
