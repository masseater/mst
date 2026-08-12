import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Node, type Pair } from "yaml";

export type WorkflowDocument = {
  readonly relativePath: string;
  readonly root: Node | null;
  readonly lineCounter: LineCounter;
  readonly parseFailureOffsets: readonly number[];
};

export const parseWorkflowDocument = ({
  relativePath,
  source,
}: {
  readonly relativePath: string;
  readonly source: string;
}): WorkflowDocument => {
  const lineCounter = new LineCounter();
  const parsedDocument = parseDocument(source, { lineCounter });

  return {
    relativePath,
    root: parsedDocument.contents,
    lineCounter,
    parseFailureOffsets: parsedDocument.errors.map((failure) => failure.pos[0]),
  };
};

export const lineAtOffset = (document: WorkflowDocument, offset: number): number =>
  document.lineCounter.linePos(offset).line;

export const lineOf = (document: WorkflowDocument, node: unknown): number => {
  const range = (node as { readonly range?: readonly [number, number, number] } | null)?.range;
  return range === undefined ? 1 : lineAtOffset(document, range[0]);
};

export const entriesOf = (node: unknown): readonly Pair[] => (isMap(node) ? node.items : []);

export const itemsOf = (node: unknown): readonly unknown[] => (isSeq(node) ? node.items : []);

export const keyOf = (pair: Pair): string | null =>
  isScalar(pair.key) ? String(pair.key.value) : null;

export const entryOf = (node: unknown, named: string): Pair | null =>
  entriesOf(node).find((pair) => keyOf(pair) === named) ?? null;

export const valueOf = (node: unknown, named: string): unknown =>
  entryOf(node, named)?.value ?? null;

export const scalarText = (node: unknown): string | null =>
  isScalar(node) && typeof node.value === "string" ? node.value : null;

export const scalarValueText = (node: unknown): string | null => {
  if (!isScalar(node)) return null;

  const { value } = node;
  if (typeof value === "string") return value;
  return typeof value === "number" || typeof value === "boolean" ? String(value) : null;
};

export const trailingComment = (node: unknown): string | null =>
  isScalar(node) ? (node.comment ?? null) : null;

export const isTruthyScalar = (node: unknown): boolean => isScalar(node) && node.value === true;

export const keysOf = (node: unknown): readonly string[] =>
  entriesOf(node).flatMap((pair) => {
    const pairKey = keyOf(pair);
    return pairKey === null ? [] : [pairKey];
  });
