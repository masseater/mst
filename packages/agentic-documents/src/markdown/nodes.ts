import type { Nodes, Paragraph, Parent } from "mdast";

const isParent = (node: Nodes): node is Nodes & Parent => "children" in node;

export const descendants = (node: Nodes): readonly Nodes[] =>
  isParent(node) ? node.children.flatMap((child) => [child, ...descendants(child)]) : [];

export const lineOf = (node: Nodes): number | null => node.position?.start.line ?? null;

export const offsetOf = (node: Nodes): number | undefined => node.position?.start.offset;

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
