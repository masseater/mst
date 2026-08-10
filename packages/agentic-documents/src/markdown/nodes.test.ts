import { describe, expect, test } from "vite-plus/test";

import {
  descendants,
  flattenTextDroppingCode,
  flattenTextKeepingCode,
  leadingParagraphOf,
  lineOf,
  offsetOf,
} from "./nodes.ts";
import { parseMarkdown } from "./parse.ts";

import type { Nodes, Parent } from "mdast";

const nodesIn = (source: string): readonly Nodes[] => descendants(parseMarkdown(source));

const firstOfType = (source: string, type: string): Nodes => {
  const found = nodesIn(source).find((node) => node.type === type);
  if (found === undefined) throw new Error(`no ${type} in: ${source}`);
  return found;
};

describe("markdown nodes", () => {
  test("a tree hands back every node below it", () => {
    expect(nodesIn("- one\n").map((node) => node.type)).toStrictEqual([
      "list",
      "listItem",
      "paragraph",
      "text",
    ]);
  });

  test("a node knows the line and the offset it starts at", () => {
    const paragraph = firstOfType("# title\n\nprose\n", "paragraph");

    expect(lineOf(paragraph)).toBe(3);
    expect(offsetOf(paragraph)).toBe(9);
  });

  test("flattening drops the code it passes and keeps the prose", () => {
    const paragraph = firstOfType("prose `code` more\n", "paragraph");

    expect(flattenTextDroppingCode(paragraph)).toBe("prose   more");
  });

  test("flattening the other way keeps the code as it was written", () => {
    const paragraph = firstOfType("prose `code` more\n", "paragraph");

    expect(flattenTextKeepingCode(paragraph)).toBe("prose `code` more");
  });

  test("a node that carries neither text nor children flattens to nothing", () => {
    const image = firstOfType("![alt](a.png)\n", "image");

    expect(flattenTextDroppingCode(image)).toBe("");
    expect(flattenTextKeepingCode(image)).toBe("");
  });

  test("a list item that opens with prose hands back that paragraph", () => {
    const item = firstOfType("- one\n", "listItem") as Nodes & Parent;

    expect(leadingParagraphOf(item)?.type).toBe("paragraph");
  });

  test("a list item that opens with something else hands back nothing", () => {
    const item = firstOfType("- - nested\n", "listItem") as Nodes & Parent;

    expect(leadingParagraphOf(item)).toBe(null);
  });

  test("a list item that holds nothing at all hands back nothing", () => {
    const item = firstOfType("-\n", "listItem") as Nodes & Parent;

    expect(leadingParagraphOf(item)).toBe(null);
  });
});
