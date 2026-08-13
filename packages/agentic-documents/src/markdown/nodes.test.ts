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

const A_LIST_HOLDING_ONE_ITEM = "- one\n";

const A_HEADING_FOLLOWED_BY_PROSE = "# title\n\nprose\n";

const PROSE_AROUND_INLINE_CODE = "prose `code` more\n";

const AN_IMAGE_ON_ITS_OWN = "![alt](a.png)\n";

const A_LIST_WHOSE_ITEM_OPENS_WITH_A_NESTED_LIST = "- - nested\n";

const A_LIST_WHOSE_ITEM_HOLDS_NOTHING = "-\n";

describe("descendants", () => {
  describe("a document holding one list with one item", () => {
    const it = test.extend("nodesBelowTheDocument", () =>
      descendants(parseMarkdown(A_LIST_HOLDING_ONE_ITEM)));

    it("hands back every node below the document, each one before its own children", ({
      nodesBelowTheDocument,
    }) => {
      expect(nodesBelowTheDocument).toStrictEqual([
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
  });
});

describe("lineOf", () => {
  describe("a paragraph standing under a heading and a blank line", () => {
    const it = test.extend("lineTheProseParagraphStartsAt", () => {
      const paragraph = descendants(parseMarkdown(A_HEADING_FOLLOWED_BY_PROSE)).find(
        (node) => node.type === "paragraph",
      );
      if (paragraph === undefined) throw new Error("the document holds no paragraph");
      return lineOf(paragraph);
    });

    it("hands back the line the paragraph starts at", ({ lineTheProseParagraphStartsAt }) => {
      expect(lineTheProseParagraphStartsAt).toBe(3);
    });
  });
});

describe("offsetOf", () => {
  describe("a paragraph standing under a heading and a blank line", () => {
    const it = test.extend("offsetTheProseParagraphStartsAt", () => {
      const paragraph = descendants(parseMarkdown(A_HEADING_FOLLOWED_BY_PROSE)).find(
        (node) => node.type === "paragraph",
      );
      if (paragraph === undefined) throw new Error("the document holds no paragraph");
      return offsetOf(paragraph);
    });

    it("hands back the offset the paragraph starts at", ({ offsetTheProseParagraphStartsAt }) => {
      expect(offsetTheProseParagraphStartsAt).toBe(9);
    });
  });
});

describe("flattenTextDroppingCode", () => {
  describe("a paragraph carrying inline code between two runs of prose", () => {
    const it = test.extend("proseOfTheParagraph", () => {
      const paragraph = descendants(parseMarkdown(PROSE_AROUND_INLINE_CODE)).find(
        (node) => node.type === "paragraph",
      );
      if (paragraph === undefined) throw new Error("the document holds no paragraph");
      return flattenTextDroppingCode(paragraph);
    });

    it("keeps the prose and leaves a blank where the code stood", ({ proseOfTheParagraph }) => {
      expect(proseOfTheParagraph).toBe("prose   more");
    });
  });

  describe("an image, which carries neither text nor children", () => {
    const it = test.extend("proseOfTheImage", () => {
      const image = descendants(parseMarkdown(AN_IMAGE_ON_ITS_OWN)).find(
        (node) => node.type === "image",
      );
      if (image === undefined) throw new Error("the document holds no image");
      return flattenTextDroppingCode(image);
    });

    it("flattens to nothing at all", ({ proseOfTheImage }) => {
      expect(proseOfTheImage).toBe("");
    });
  });
});

describe("flattenTextKeepingCode", () => {
  describe("a paragraph carrying inline code between two runs of prose", () => {
    const it = test.extend("proseOfTheParagraph", () => {
      const paragraph = descendants(parseMarkdown(PROSE_AROUND_INLINE_CODE)).find(
        (node) => node.type === "paragraph",
      );
      if (paragraph === undefined) throw new Error("the document holds no paragraph");
      return flattenTextKeepingCode(paragraph);
    });

    it("keeps the code spelled the way it was written", ({ proseOfTheParagraph }) => {
      expect(proseOfTheParagraph).toBe("prose `code` more");
    });
  });

  describe("an image, which carries neither text nor children", () => {
    const it = test.extend("proseOfTheImage", () => {
      const image = descendants(parseMarkdown(AN_IMAGE_ON_ITS_OWN)).find(
        (node) => node.type === "image",
      );
      if (image === undefined) throw new Error("the document holds no image");
      return flattenTextKeepingCode(image);
    });

    it("flattens to nothing at all", ({ proseOfTheImage }) => {
      expect(proseOfTheImage).toBe("");
    });
  });
});

describe("leadingParagraphOf", () => {
  describe("a list item that opens with prose", () => {
    const it = test.extend("leadingParagraphOfTheItem", () => {
      const item = descendants(parseMarkdown(A_LIST_HOLDING_ONE_ITEM)).find(
        (node) => node.type === "listItem",
      );
      if (item === undefined) throw new Error("the document holds no list item");
      return leadingParagraphOf(item);
    });

    it("hands back that paragraph", ({ leadingParagraphOfTheItem }) => {
      expect(leadingParagraphOfTheItem).toStrictEqual({
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
  });

  describe("a list item that opens with a nested list", () => {
    const it = test.extend("leadingParagraphOfTheItem", () => {
      const item = descendants(parseMarkdown(A_LIST_WHOSE_ITEM_OPENS_WITH_A_NESTED_LIST)).find(
        (node) => node.type === "listItem",
      );
      if (item === undefined) throw new Error("the document holds no list item");
      return leadingParagraphOf(item);
    });

    it("hands back nothing", ({ leadingParagraphOfTheItem }) => {
      expect(leadingParagraphOfTheItem).toBe(null);
    });
  });

  describe("a list item that holds nothing at all", () => {
    const it = test.extend("leadingParagraphOfTheItem", () => {
      const item = descendants(parseMarkdown(A_LIST_WHOSE_ITEM_HOLDS_NOTHING)).find(
        (node) => node.type === "listItem",
      );
      if (item === undefined) throw new Error("the document holds no list item");
      return leadingParagraphOf(item);
    });

    it("hands back nothing", ({ leadingParagraphOfTheItem }) => {
      expect(leadingParagraphOfTheItem).toBe(null);
    });
  });
});
