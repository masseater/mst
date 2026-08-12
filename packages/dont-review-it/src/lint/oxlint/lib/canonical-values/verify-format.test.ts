import { describe, expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { formatCanonicalValuesProblem, formatEquivalentConceptGroup } from "./verify-format.ts";

describe("verify format", () => {
  test("a retired tag is reported with the location and the tag it found", () => {
    const [retired] = RETIRED_ANNOTATION_TAGS;
    if (retired === undefined) throw new Error("the retired tag vocabulary must not be empty");

    expect(
      formatCanonicalValuesProblem({
        kind: "retired-annotation-tag",
        filePath: "src/order.ts",
        line: 4,
        tag: retired,
      }),
    ).toBe(
      `src/order.ts:4 The retired annotation tag ${retired} must not stay in the source, because opting a value set out of the canonical vocabulary is no longer possible. Delete the tag, and declare the concept it belonged to so every use derives from that declaration.`,
    );
  });

  test("a canonical suppression is reported with an actionable replacement", () => {
    expect(
      formatCanonicalValuesProblem({
        kind: "canonical-rule-suppression",
        filePath: "src/order.ts",
        line: 4,
      }),
    ).toBe(
      "src/order.ts:4 Canonical vocabulary rules must not be suppressed with a lint-disable directive. Delete the directive, then derive the use site from its registered runtime owner or register the missing owner.",
    );
  });

  test("a second declaration of a concept is reported with both locations", () => {
    expect(
      formatCanonicalValuesProblem({
        kind: "duplicate-concept",
        filePath: "src/b.ts",
        line: 7,
        conceptId: "order.status",
        declaredFilePath: "src/a.ts",
        declaredLine: 2,
      }),
    ).toBe(
      "src/b.ts:7 A concept must be declared in one place. order.status is already declared at src/a.ts:2. Delete one of the two declarations, and derive from the one that stays.",
    );
  });

  test("a group of equivalent concepts is reported with its shared values", () => {
    expect(
      formatEquivalentConceptGroup([
        {
          annotationStart: 0,
          binding: "ARTICLE_STATUSES",
          bindingStart: 1,
          conceptId: "article.status",
          declarationEnd: 2,
          declarationPath: "src/article.ts",
          declarationStart: 1,
          importRoutes: [],
          packageName: null,
          values: ["published", "draft"],
          fingerprint: fingerprintValues(["published", "draft"]),
        },
        {
          annotationStart: 0,
          binding: "ORDER_STATUSES",
          bindingStart: 1,
          conceptId: "order.status",
          declarationEnd: 2,
          declarationPath: "src/order.ts",
          declarationStart: 1,
          importRoutes: [],
          packageName: null,
          values: ["draft", "published"],
          fingerprint: fingerprintValues(["draft", "published"]),
        },
      ]),
    ).toBe(
      `"draft", "published" is declared by more than one concept: article.status (src/article.ts), order.status (src/order.ts)`,
    );
  });
});
