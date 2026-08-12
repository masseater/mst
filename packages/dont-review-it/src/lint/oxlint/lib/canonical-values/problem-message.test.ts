import { describe, expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { formatCanonicalValuesProblem, formatEquivalentConceptGroup } from "./problem-message.ts";

const it = test
  .extend("messageOfARetiredTag", () =>
    formatCanonicalValuesProblem({
      kind: "retired-annotation-tag",
      filePath: "src/order.ts",
      line: 4,
      tag: RETIRED_ANNOTATION_TAGS[0] ?? "",
    }))
  .extend("messageOfAnUnparsableAnnotation", () =>
    formatCanonicalValuesProblem({
      kind: "unparsable-annotation",
      filePath: "src/order.ts",
      line: 1,
    }),
  )
  .extend("messageOfAVocabularyWithoutValues", () =>
    formatCanonicalValuesProblem({
      kind: "vocabulary-without-values",
      filePath: "src/order.ts",
      line: 3,
      conceptId: "order.status",
    }),
  )
  .extend("messageOfADuplicateConcept", () =>
    formatCanonicalValuesProblem({
      kind: "duplicate-concept",
      filePath: "src/b.ts",
      line: 7,
      conceptId: "order.status",
      declaredFilePath: "src/a.ts",
      declaredLine: 2,
    }),
  )
  .extend("messageOfAnEquivalentConceptGroup", () =>
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
    ]),
  );

describe("problem-message", () => {
  it("a retired tag is reported with the location and the tag it found", ({
    messageOfARetiredTag,
  }) => {
    expect(messageOfARetiredTag).toBe(
      `src/order.ts:4 The retired annotation tag ${RETIRED_ANNOTATION_TAGS[0]} must not stay in the source, because opting a value set out of the canonical vocabulary is no longer possible. Delete the tag, and declare the concept it belonged to so every use derives from that declaration.`,
    );
  });

  it("an annotation that names no concept is reported with the shape a concept id takes", ({
    messageOfAnUnparsableAnnotation,
  }) => {
    expect(messageOfAnUnparsableAnnotation).toBe(
      'src/order.ts:1 A canonical values annotation must name the concept it declares. Write the tag followed by a concept id built from lowercase words joined by "-" or ".".',
    );
  });

  it("an annotation that sits on nothing is reported with the concept it named", ({
    messageOfAVocabularyWithoutValues,
  }) => {
    expect(messageOfAVocabularyWithoutValues).toBe(
      "src/order.ts:3 A canonical values annotation must sit on a declaration that spells out the values of order.status. Move the annotation onto the declaration that lists them, or delete it.",
    );
  });

  it("a second declaration of a concept is reported with both locations", ({
    messageOfADuplicateConcept,
  }) => {
    expect(messageOfADuplicateConcept).toBe(
      "src/b.ts:7 A concept must be declared in one place. order.status is already declared at src/a.ts:2. Delete one of the two declarations, and derive from the one that stays.",
    );
  });

  it("a group of equivalent concepts is reported with its shared values", ({
    messageOfAnEquivalentConceptGroup,
  }) => {
    expect(messageOfAnEquivalentConceptGroup).toBe(
      `"draft", "published" is declared by more than one concept: article.status (src/article.ts), order.status (src/order.ts)`,
    );
  });
});
