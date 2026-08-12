import { describe, expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { INVALID_CANONICAL_DECLARATION_REASONS } from "./declarations.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { formatCanonicalValuesProblem, formatEquivalentConceptGroup } from "./verify-format.ts";

import type { CanonicalValuesRepositoryProblem } from "./builder.ts";

describe("verify format", () => {
  test.each([
    {
      problem: { kind: "unsafe-symbolic-link", filePath: "src/order.ts", line: 1 },
      expected: "A symbolic link in the repository source walk must resolve",
    },
    {
      problem: { kind: "canonical-rule-suppression", filePath: "src/order.ts", line: 4 },
      expected: "Canonical vocabulary rules must not be suppressed",
    },
    {
      problem: { kind: "unparsable-annotation", filePath: "src/order.ts", line: 4 },
      expected: "A canonical values annotation must name the concept",
    },
    {
      problem: { kind: "unparsable-source", filePath: "src/order.ts", line: 4 },
      expected: "A source containing a canonical values annotation must parse",
    },
  ] satisfies readonly {
    readonly problem: CanonicalValuesRepositoryProblem;
    readonly expected: string;
  }[])("formats the $problem.kind source problem", ({ problem, expected }) => {
    expect(formatCanonicalValuesProblem(problem)).toContain(expected);
  });

  test.each(Object.values(INVALID_CANONICAL_DECLARATION_REASONS))(
    "formats the invalid declaration reason %s",
    (reason) => {
      expect(
        formatCanonicalValuesProblem({
          kind: "invalid-declaration",
          filePath: "src/order.ts",
          line: 4,
          conceptId: null,
          reason,
        }),
      ).toContain("A canonical values annotation does not declare an owner here:");
    },
  );

  test("formats out-of-scope and valueless declarations", () => {
    expect(
      formatCanonicalValuesProblem({
        kind: "out-of-scope-declaration",
        filePath: "src/order.test.ts",
        line: 4,
        conceptId: "order.status",
      }),
    ).toContain("is annotated in a non-production source");
    expect(
      formatCanonicalValuesProblem({
        kind: "vocabulary-without-values",
        filePath: "src/order.ts",
        line: 4,
        conceptId: "order.status",
      }),
    ).toContain("must sit on a variable whose resolved type exposes only finite");
  });

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
