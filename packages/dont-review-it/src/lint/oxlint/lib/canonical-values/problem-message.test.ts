import { describe, expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { formatCanonicalValuesProblem, formatEquivalentConceptGroup } from "./problem-message.ts";

describe("formatCanonicalValuesProblem", () => {
  describe("a retired tag", () => {
    const it = test.extend("message", () =>
      formatCanonicalValuesProblem({
        kind: "retired-annotation-tag",
        filePath: "src/order.ts",
        line: 4,
        tag: RETIRED_ANNOTATION_TAGS[0] ?? "",
      }));

    it("is reported with the location and the tag it found", ({ message }) => {
      expect(message).toBe(
        `src/order.ts:4 The retired annotation tag ${RETIRED_ANNOTATION_TAGS[0]} must not stay in the source, because opting a value set out of the canonical vocabulary is no longer possible. Delete the tag, and declare the concept it belonged to so every use derives from that declaration.`,
      );
    });
  });

  describe("an annotation that names no concept", () => {
    const it = test.extend("message", () =>
      formatCanonicalValuesProblem({
        kind: "unparsable-annotation",
        filePath: "src/order.ts",
        line: 1,
      }));

    it("is reported with the shape a concept id takes", ({ message }) => {
      expect(message).toBe(
        'src/order.ts:1 A canonical values annotation must name the concept it declares. Write the tag followed by a concept id built from lowercase words joined by "-" or ".".',
      );
    });
  });

  describe("an annotation that sits on nothing", () => {
    const it = test.extend("message", () =>
      formatCanonicalValuesProblem({
        kind: "vocabulary-without-values",
        filePath: "src/order.ts",
        line: 3,
        conceptId: "order.status",
      }));

    it("is reported with the concept it named", ({ message }) => {
      expect(message).toBe(
        "src/order.ts:3 A canonical values annotation must sit on a declaration that spells out the values of order.status. Move the annotation onto the declaration that lists them, or delete it.",
      );
    });
  });

  describe("a second declaration of a concept", () => {
    const it = test.extend("message", () =>
      formatCanonicalValuesProblem({
        kind: "duplicate-concept",
        filePath: "src/b.ts",
        line: 7,
        conceptId: "order.status",
        declaredFilePath: "src/a.ts",
        declaredLine: 2,
      }));

    it("is reported with both locations", ({ message }) => {
      expect(message).toBe(
        "src/b.ts:7 A concept must be declared in one place. order.status is already declared at src/a.ts:2. Delete one of the two declarations, and derive from the one that stays.",
      );
    });
  });
});

describe("formatEquivalentConceptGroup", () => {
  describe("a group of equivalent concepts", () => {
    const it = test.extend("message", () =>
      formatEquivalentConceptGroup([
        {
          conceptId: "article.status",
          declarationPath: "src/article.ts",
          exportPath: null,
          values: ["published", "draft"],
          fingerprint: "fingerprint-of-draft-and-published",
        },
        {
          conceptId: "order.status",
          declarationPath: "src/order.ts",
          exportPath: null,
          values: ["draft", "published"],
          fingerprint: "fingerprint-of-draft-and-published",
        },
      ]));

    it("is reported with its shared values", ({ message }) => {
      expect(message).toBe(
        `src/article.ts src/order.ts One set of values must belong to one concept, because two names for the same set let each of them drift on its own. "draft", "published" is declared by article.status (src/article.ts), order.status (src/order.ts). Keep one of the concepts, and derive the others from the declaration that stays.`,
      );
    });
  });
});
