import { describe, expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { INVALID_CANONICAL_DECLARATION_REASONS } from "./declarations.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { formatCanonicalValuesProblem, formatEquivalentConceptGroup } from "./verify-format.ts";

describe("verify format", () => {
  describe("a symbolic link that leaves the repository", () => {
    const it = test.extend("theSymbolicLinkReport", () =>
      formatCanonicalValuesProblem({
        kind: "unsafe-symbolic-link",
        filePath: "src/order.ts",
        line: 1,
      }));

    it("asks for a repository-owned source path at the link location", ({
      theSymbolicLinkReport,
    }) => {
      expect(theSymbolicLinkReport).toBe(
        "src/order.ts:1 A symbolic link in the repository source walk must resolve to a readable target inside the repository. Replace the broken or external link with a repository-owned source path.",
      );
    });
  });

  describe("a suppressed canonical rule met while walking the sources", () => {
    const it = test.extend("theWalkSuppressionReport", () =>
      formatCanonicalValuesProblem({
        kind: "canonical-rule-suppression",
        filePath: "src/checkout.ts",
        line: 12,
      }));

    it("names the suppression at the location the walk reached", ({ theWalkSuppressionReport }) => {
      expect(theWalkSuppressionReport).toBe(
        "src/checkout.ts:12 Canonical vocabulary rules must not be suppressed with a lint-disable directive. Delete the directive, then derive the use site from its registered runtime owner or register the missing owner.",
      );
    });
  });

  describe("an annotation whose concept id cannot be read", () => {
    const it = test.extend("theUnparsableAnnotationReport", () =>
      formatCanonicalValuesProblem({
        kind: "unparsable-annotation",
        filePath: "src/order.ts",
        line: 4,
      }));

    it("spells out the concept id shape the tag must carry", ({
      theUnparsableAnnotationReport,
    }) => {
      expect(theUnparsableAnnotationReport).toBe(
        'src/order.ts:4 A canonical values annotation must name the concept it declares. Write the tag followed by a concept id built from lowercase words joined by "-" or ".".',
      );
    });
  });

  describe("an annotated source that does not parse", () => {
    const it = test.extend("theUnparsableSourceReport", () =>
      formatCanonicalValuesProblem({
        kind: "unparsable-source",
        filePath: "src/order.ts",
        line: 4,
      }));

    it("offers fixing the syntax or dropping the annotation", ({ theUnparsableSourceReport }) => {
      expect(theUnparsableSourceReport).toBe(
        "src/order.ts:4 A source containing a canonical values annotation must parse successfully before it can declare an owner. Fix the source syntax or delete the annotation.",
      );
    });
  });

  describe("an annotation separated from the declaration it should sit on", () => {
    const it = test.extend("theAdjacentDeclarationReport", () =>
      formatCanonicalValuesProblem({
        kind: "invalid-declaration",
        filePath: "src/order.ts",
        line: 4,
        conceptId: null,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.adjacentDeclarationRequired,
      }));

    it("says nothing may sit between the JSDoc and its declaration", ({
      theAdjacentDeclarationReport,
    }) => {
      expect(theAdjacentDeclarationReport).toBe(
        "src/order.ts:4 A canonical values annotation does not declare an owner here: the JSDoc must be followed directly by its declaration without another comment or token in between. Move it onto one module-scope variable statement with one identifier binding, or delete it.",
      );
    });
  });

  describe("an annotation sitting on a destructuring pattern", () => {
    const it = test.extend("theIdentifierBindingReport", () =>
      formatCanonicalValuesProblem({
        kind: "invalid-declaration",
        filePath: "src/order.ts",
        line: 4,
        conceptId: null,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.identifierBindingRequired,
      }));

    it("says the annotated variable must bind one identifier", ({ theIdentifierBindingReport }) => {
      expect(theIdentifierBindingReport).toBe(
        "src/order.ts:4 A canonical values annotation does not declare an owner here: the annotated variable must bind one identifier. Move it onto one module-scope variable statement with one identifier binding, or delete it.",
      );
    });
  });

  describe("an annotation written in a line comment", () => {
    const it = test.extend("theJsdocRequiredReport", () =>
      formatCanonicalValuesProblem({
        kind: "invalid-declaration",
        filePath: "src/order.ts",
        line: 4,
        conceptId: null,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.jsdocRequired,
      }));

    it("says the annotation belongs in a JSDoc block", ({ theJsdocRequiredReport }) => {
      expect(theJsdocRequiredReport).toBe(
        "src/order.ts:4 A canonical values annotation does not declare an owner here: the annotation must be written in a JSDoc block. Move it onto one module-scope variable statement with one identifier binding, or delete it.",
      );
    });
  });

  describe("an annotation nested inside a function body", () => {
    const it = test.extend("theModuleScopeReport", () =>
      formatCanonicalValuesProblem({
        kind: "invalid-declaration",
        filePath: "src/order.ts",
        line: 4,
        conceptId: null,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.moduleScopeRequired,
      }));

    it("says the annotation must be at module scope", ({ theModuleScopeReport }) => {
      expect(theModuleScopeReport).toBe(
        "src/order.ts:4 A canonical values annotation does not declare an owner here: the annotation must be at module scope. Move it onto one module-scope variable statement with one identifier binding, or delete it.",
      );
    });
  });

  describe("an annotation on an ambient declaration", () => {
    const it = test.extend("theRuntimeInitializerReport", () =>
      formatCanonicalValuesProblem({
        kind: "invalid-declaration",
        filePath: "src/order.ts",
        line: 4,
        conceptId: null,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.runtimeInitializerRequired,
      }));

    it("says the annotated variable needs a runtime initializer", ({
      theRuntimeInitializerReport,
    }) => {
      expect(theRuntimeInitializerReport).toBe(
        "src/order.ts:4 A canonical values annotation does not declare an owner here: the annotated variable must have a runtime initializer and must not be ambient. Move it onto one module-scope variable statement with one identifier binding, or delete it.",
      );
    });
  });

  describe("a JSDoc carrying the canonical values tag twice", () => {
    const it = test.extend("theSingleAnnotationReport", () =>
      formatCanonicalValuesProblem({
        kind: "invalid-declaration",
        filePath: "src/order.ts",
        line: 4,
        conceptId: null,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.singleAnnotationRequired,
      }));

    it("says exactly one tag may sit in the JSDoc", ({ theSingleAnnotationReport }) => {
      expect(theSingleAnnotationReport).toBe(
        "src/order.ts:4 A canonical values annotation does not declare an owner here: the JSDoc must contain exactly one @canonical-values tag. Move it onto one module-scope variable statement with one identifier binding, or delete it.",
      );
    });
  });

  describe("an annotation on a statement declaring several bindings", () => {
    const it = test.extend("theSingleBindingReport", () =>
      formatCanonicalValuesProblem({
        kind: "invalid-declaration",
        filePath: "src/order.ts",
        line: 4,
        conceptId: null,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.singleBindingRequired,
      }));

    it("says the statement must declare exactly one binding", ({ theSingleBindingReport }) => {
      expect(theSingleBindingReport).toBe(
        "src/order.ts:4 A canonical values annotation does not declare an owner here: the annotated variable statement must declare exactly one binding. Move it onto one module-scope variable statement with one identifier binding, or delete it.",
      );
    });
  });

  describe("an annotation attached to something other than a variable statement", () => {
    const it = test.extend("theVariableStatementReport", () =>
      formatCanonicalValuesProblem({
        kind: "invalid-declaration",
        filePath: "src/order.ts",
        line: 4,
        conceptId: null,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.variableStatementRequired,
      }));

    it("says the annotation must attach to a variable statement", ({
      theVariableStatementReport,
    }) => {
      expect(theVariableStatementReport).toBe(
        "src/order.ts:4 A canonical values annotation does not declare an owner here: the annotation must be attached to a variable statement. Move it onto one module-scope variable statement with one identifier binding, or delete it.",
      );
    });
  });

  describe("a concept declared inside a spec file", () => {
    const it = test.extend("theOutOfScopeDeclarationReport", () =>
      formatCanonicalValuesProblem({
        kind: "out-of-scope-declaration",
        filePath: "src/order.test.ts",
        line: 4,
        conceptId: "order.status",
      }));

    it("asks for the owner to move into production source", ({
      theOutOfScopeDeclarationReport,
    }) => {
      expect(theOutOfScopeDeclarationReport).toBe(
        "src/order.test.ts:4 order.status is annotated in a non-production source. Move the canonical owner into production source, or delete the annotation.",
      );
    });
  });

  describe("a concept whose binding exposes no finite literal domain", () => {
    const it = test.extend("theVocabularyWithoutValuesReport", () =>
      formatCanonicalValuesProblem({
        kind: "vocabulary-without-values",
        filePath: "src/order.ts",
        line: 4,
        conceptId: "order.status",
      }));

    it("names the literal kinds the binding has to expose", ({
      theVocabularyWithoutValuesReport,
    }) => {
      expect(theVocabularyWithoutValuesReport).toBe(
        "src/order.ts:4 A canonical values annotation must sit on a variable whose resolved type exposes only finite string, number, boolean, or null values for order.status. Make the binding expose that literal domain, or delete the annotation.",
      );
    });
  });

  describe("a retired annotation tag left in the source", () => {
    const [retiredTag = "@canonical-values-retired"] = RETIRED_ANNOTATION_TAGS;
    const it = test.extend("theRetiredTagReport", () =>
      formatCanonicalValuesProblem({
        kind: "retired-annotation-tag",
        filePath: "src/order.ts",
        line: 4,
        tag: retiredTag,
      }));

    it("names the location and the tag it found", ({ theRetiredTagReport }) => {
      expect(theRetiredTagReport).toBe(
        `src/order.ts:4 The retired annotation tag ${retiredTag} must not stay in the source, because opting a value set out of the canonical vocabulary is no longer possible. Delete the tag, and declare the concept it belonged to so every use derives from that declaration.`,
      );
    });
  });

  describe("a canonical rule silenced by a lint-disable directive", () => {
    const it = test.extend("theSuppressionReport", () =>
      formatCanonicalValuesProblem({
        kind: "canonical-rule-suppression",
        filePath: "src/order.ts",
        line: 4,
      }));

    it("offers deriving from the owner instead of the directive", ({ theSuppressionReport }) => {
      expect(theSuppressionReport).toBe(
        "src/order.ts:4 Canonical vocabulary rules must not be suppressed with a lint-disable directive. Delete the directive, then derive the use site from its registered runtime owner or register the missing owner.",
      );
    });
  });

  describe("a concept declared a second time", () => {
    const it = test.extend("theDuplicateConceptReport", () =>
      formatCanonicalValuesProblem({
        kind: "duplicate-concept",
        filePath: "src/b.ts",
        line: 7,
        conceptId: "order.status",
        declaredFilePath: "src/a.ts",
        declaredLine: 2,
      }));

    it("names both the second location and the first one", ({ theDuplicateConceptReport }) => {
      expect(theDuplicateConceptReport).toBe(
        "src/b.ts:7 A concept must be declared in one place. order.status is already declared at src/a.ts:2. Delete one of the two declarations, and derive from the one that stays.",
      );
    });
  });

  describe("two concepts declaring the same values in a different order", () => {
    const it = test.extend("theEquivalentConceptGroupReport", () =>
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
      ]));

    it("lists the shared values once and every concept that declares them", ({
      theEquivalentConceptGroupReport,
    }) => {
      expect(theEquivalentConceptGroupReport).toBe(
        `"draft", "published" is declared by more than one concept: article.status (src/article.ts), order.status (src/order.ts)`,
      );
    });
  });
});
