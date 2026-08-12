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

const it = test
  .extend("nodesBelowAListDocument", () => descendants(parseMarkdown("- one\n")))
  .extend("lineTheProseParagraphStartsAt", () => {
    const paragraph = descendants(parseMarkdown("# title\n\nprose\n")).find(
      (node) => node.type === "paragraph",
    );
    if (paragraph === undefined) throw new Error("the document holds no paragraph");
    return lineOf(paragraph);
  })
  .extend("offsetTheProseParagraphStartsAt", () => {
    const paragraph = descendants(parseMarkdown("# title\n\nprose\n")).find(
      (node) => node.type === "paragraph",
    );
    if (paragraph === undefined) throw new Error("the document holds no paragraph");
    return offsetOf(paragraph);
  })
  .extend("proseOfAParagraphWithTheCodeDropped", () => {
    const paragraph = descendants(parseMarkdown("prose `code` more\n")).find(
      (node) => node.type === "paragraph",
    );
    if (paragraph === undefined) throw new Error("the document holds no paragraph");
    return flattenTextDroppingCode(paragraph);
  })
  .extend("proseOfAParagraphWithTheCodeKept", () => {
    const paragraph = descendants(parseMarkdown("prose `code` more\n")).find(
      (node) => node.type === "paragraph",
    );
    if (paragraph === undefined) throw new Error("the document holds no paragraph");
    return flattenTextKeepingCode(paragraph);
  })
  .extend("proseOfAnImageWithTheCodeDropped", () => {
    const image = descendants(parseMarkdown("![alt](a.png)\n")).find(
      (node) => node.type === "image",
    );
    if (image === undefined) throw new Error("the document holds no image");
    return flattenTextDroppingCode(image);
  })
  .extend("proseOfAnImageWithTheCodeKept", () => {
    const image = descendants(parseMarkdown("![alt](a.png)\n")).find(
      (node) => node.type === "image",
    );
    if (image === undefined) throw new Error("the document holds no image");
    return flattenTextKeepingCode(image);
  })
  .extend("leadingParagraphOfAnItemOpeningWithProse", () => {
    const item = descendants(parseMarkdown("- one\n")).find((node) => node.type === "listItem");
    if (item === undefined) throw new Error("the document holds no list item");
    return leadingParagraphOf(item);
  })
  .extend("leadingParagraphOfAnItemOpeningWithANestedList", () => {
    const item = descendants(parseMarkdown("- - nested\n")).find(
      (node) => node.type === "listItem",
    );
    if (item === undefined) throw new Error("the document holds no list item");
    return leadingParagraphOf(item);
  })
  .extend("leadingParagraphOfAnItemHoldingNothing", () => {
    const item = descendants(parseMarkdown("-\n")).find((node) => node.type === "listItem");
    if (item === undefined) throw new Error("the document holds no list item");
    return leadingParagraphOf(item);
  });

describe("markdown nodes", () => {
  it("a tree hands back every node below it", ({ nodesBelowAListDocument }) => {
    expect(nodesBelowAListDocument).toStrictEqual([
      {
        type: "list",
        ordered: false,
        start: null,
        spread: false,
        children: [
          {
            type: "listItem",
            checked: null,
            spread: false,
            children: [
              {
                type: "paragraph",
                children: [
                  {
                    type: "text",
                    value: "one",
                    position: {
                      start: { line: 1, column: 3, offset: 2 },
                      end: { line: 1, column: 6, offset: 5 },
                    },
                  },
                ],
                position: {
                  start: { line: 1, column: 3, offset: 2 },
                  end: { line: 1, column: 6, offset: 5 },
                },
              },
            ],
            position: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 6, offset: 5 },
            },
          },
        ],
        position: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 6, offset: 5 },
        },
      },
      {
        type: "listItem",
        checked: null,
        spread: false,
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "text",
                value: "one",
                position: {
                  start: { line: 1, column: 3, offset: 2 },
                  end: { line: 1, column: 6, offset: 5 },
                },
              },
            ],
            position: {
              start: { line: 1, column: 3, offset: 2 },
              end: { line: 1, column: 6, offset: 5 },
            },
          },
        ],
        position: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 6, offset: 5 },
        },
      },
      {
        type: "paragraph",
        children: [
          {
            type: "text",
            value: "one",
            position: {
              start: { line: 1, column: 3, offset: 2 },
              end: { line: 1, column: 6, offset: 5 },
            },
          },
        ],
        position: {
          start: { line: 1, column: 3, offset: 2 },
          end: { line: 1, column: 6, offset: 5 },
        },
      },
      {
        type: "text",
        value: "one",
        position: {
          start: { line: 1, column: 3, offset: 2 },
          end: { line: 1, column: 6, offset: 5 },
        },
      },
    ]);
  });

  it("a node knows the line it starts at", ({ lineTheProseParagraphStartsAt }) => {
    expect(lineTheProseParagraphStartsAt).toBe(3);
  });

  it("a node knows the offset it starts at", ({ offsetTheProseParagraphStartsAt }) => {
    expect(offsetTheProseParagraphStartsAt).toBe(9);
  });

  it("flattening drops the code it passes and keeps the prose", ({
    proseOfAParagraphWithTheCodeDropped,
  }) => {
    expect(proseOfAParagraphWithTheCodeDropped).toBe("prose   more");
  });

  it("flattening the other way keeps the code as it was written", ({
    proseOfAParagraphWithTheCodeKept,
  }) => {
    expect(proseOfAParagraphWithTheCodeKept).toBe("prose `code` more");
  });

  it("a node that carries neither text nor children drops to nothing", ({
    proseOfAnImageWithTheCodeDropped,
  }) => {
    expect(proseOfAnImageWithTheCodeDropped).toBe("");
  });

  it("a node that carries neither text nor children keeps nothing either", ({
    proseOfAnImageWithTheCodeKept,
  }) => {
    expect(proseOfAnImageWithTheCodeKept).toBe("");
  });

  it("a list item that opens with prose hands back that paragraph", ({
    leadingParagraphOfAnItemOpeningWithProse,
  }) => {
    expect(leadingParagraphOfAnItemOpeningWithProse).toStrictEqual({
      type: "paragraph",
      children: [
        {
          type: "text",
          value: "one",
          position: {
            start: { line: 1, column: 3, offset: 2 },
            end: { line: 1, column: 6, offset: 5 },
          },
        },
      ],
      position: {
        start: { line: 1, column: 3, offset: 2 },
        end: { line: 1, column: 6, offset: 5 },
      },
    });
  });

  it("a list item that opens with something else hands back nothing", ({
    leadingParagraphOfAnItemOpeningWithANestedList,
  }) => {
    expect(leadingParagraphOfAnItemOpeningWithANestedList).toBe(null);
  });

  it("a list item that holds nothing at all hands back nothing", ({
    leadingParagraphOfAnItemHoldingNothing,
  }) => {
    expect(leadingParagraphOfAnItemHoldingNothing).toBe(null);
  });
});
