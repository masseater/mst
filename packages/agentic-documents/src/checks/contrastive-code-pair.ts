import { isInsideGeneratedRegion } from "../markdown/generated-region.ts";
import { flattenTextKeepingCode, lineOf, offsetOf } from "../markdown/nodes.ts";

import type { Code, Nodes } from "mdast";
import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const MESSAGE =
  "同じ節に良い例と悪い例のコードを対で置くことは禁止されている。差を機械が判別できるなら検査を作り、例はその検査の説明文書へ移す。判別できないなら例を消し、何を見て判断するのかを条件と行動として書く。";

const COMMENT_PREFIXES = ["//", "#", "--", ";;", "%"];

const leadingCommentOf = (code: string): string | null => {
  const [firstLine = ""] = code.split("\n");
  const trimmed = firstLine.trim();

  const prefix = COMMENT_PREFIXES.find((candidate) => trimmed.startsWith(candidate));
  if (prefix !== undefined) return trimmed.slice(prefix.length).trim();

  if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) return trimmed.slice(4, -3).trim();
  if (trimmed.startsWith("/*") && trimmed.endsWith("*/")) return trimmed.slice(2, -2).trim();

  return null;
};

const markerOf = ({
  text,
  config,
}: {
  readonly text: string | null;
  readonly config: AgenticDocumentsConfig;
}): "negative" | "positive" | null => {
  if (text === null) return null;

  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (config.contrastiveNegativeMarkers.some((marker) => trimmed.includes(marker)))
    return "negative";
  if (config.contrastivePositiveMarkers.some((marker) => trimmed.includes(marker)))
    return "positive";

  return null;
};

const captionCarrierText = (node: Nodes | null): string | null =>
  node !== null && (node.type === "heading" || node.type === "paragraph")
    ? flattenTextKeepingCode(node)
    : null;

type MarkedCode = {
  readonly sectionKey: number;
  readonly marker: "negative" | "positive";
  readonly node: Code;
};

type Scan = {
  readonly sectionKey: number;
  readonly nearestHeading: string | null;
  readonly previous: Nodes | null;
  readonly marked: readonly MarkedCode[];
};

const visitSiblings = ({
  siblings,
  state,
  document,
  config,
}: {
  readonly siblings: readonly Nodes[];
  readonly state: Scan;
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): Scan =>
  siblings.reduce<Scan>((carried, node): Scan => {
    const withSelf = ((): Scan => {
      if (node.type === "heading") {
        return {
          ...carried,
          sectionKey:
            node.depth <= config.sectionBoundaryHeadingDepth
              ? carried.sectionKey + 1
              : carried.sectionKey,
          nearestHeading: flattenTextKeepingCode(node),
        };
      }

      if (node.type !== "code" || isInsideGeneratedRegion(offsetOf(node), document.generated)) {
        return carried;
      }

      const marker =
        markerOf({ text: captionCarrierText(carried.previous), config }) ??
        markerOf({ text: carried.nearestHeading, config }) ??
        markerOf({ text: leadingCommentOf(node.value), config });

      return marker === null
        ? carried
        : {
            ...carried,
            marked: [...carried.marked, { sectionKey: carried.sectionKey, marker, node }],
          };
    })();

    const descended =
      "children" in node
        ? visitSiblings({ siblings: node.children, state: withSelf, document, config })
        : withSelf;

    return { ...descended, previous: node };
  }, state);

const scanDocument = ({
  document,
  config,
}: {
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): readonly MarkedCode[] =>
  visitSiblings({
    siblings: document.tree.children,
    state: { sectionKey: 0, nearestHeading: null, previous: null, marked: [] },
    document,
    config,
  }).marked;

export const contrastiveCodePairs = ({
  document,
  config,
}: {
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): readonly DocumentProblem[] => {
  const marked = scanDocument({ document, config });

  const pairedSections = new Set(
    marked
      .filter((site) =>
        marked.some(
          (other) => other.sectionKey === site.sectionKey && other.marker !== site.marker,
        ),
      )
      .map((site) => site.sectionKey),
  );

  return marked
    .filter((site) => pairedSections.has(site.sectionKey))
    .map((site) => ({ file: document.file, line: lineOf(site.node), message: MESSAGE }));
};
