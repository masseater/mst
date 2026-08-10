import type { Nodes, Paragraph, Parent } from "mdast";

const isParent = (node: Nodes): node is Nodes & Parent => "children" in node;

export const descendants = (node: Nodes): readonly Nodes[] =>
  isParent(node) ? node.children.flatMap((child) => [child, ...descendants(child)]) : [];

const startOf = (node: Nodes): { readonly line: number; readonly offset: number } =>
  (
    node as Nodes & {
      readonly position: { readonly start: { readonly line: number; readonly offset: number } };
    }
  ).position.start;

export const lineOf = (node: Nodes): number => startOf(node).line;

export const offsetOf = (node: Nodes): number => startOf(node).offset;

export const endOffsetOf = (node: Nodes): number =>
  (node as Nodes & { readonly position: { readonly end: { readonly offset: number } } }).position
    .end.offset;

export const flattenTextDroppingCode = (node: Nodes): string => {
  if (node.type === "text") return node.value;
  if (node.type === "inlineCode") return " ";
  return isParent(node) ? node.children.map(flattenTextDroppingCode).join("") : "";
};

export const flattenTextKeepingCode = (node: Nodes): string => {
  if (node.type === "text") return node.value;
  if (node.type === "inlineCode") return `\`${node.value}\``;
  return isParent(node) ? node.children.map(flattenTextKeepingCode).join("") : "";
};

export const leadingParagraphOf = (item: Nodes & Parent): Paragraph | null => {
  const [first] = item.children;
  return first?.type === "paragraph" ? first : null;
};
