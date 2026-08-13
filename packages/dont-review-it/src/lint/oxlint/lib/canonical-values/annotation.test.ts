import { describe, expect, test } from "vite-plus/test";

import {
  containsCanonicalValuesAnnotation,
  findRetiredAnnotationTags,
  parseCanonicalValuesAnnotation,
  RETIRED_ANNOTATION_TAGS,
} from "./annotation.ts";

const CANONICAL_VALUES_TAG = "@canonical-values";

describe("parseCanonicalValuesAnnotation", () => {
  describe("an annotation on its own line", () => {
    const it = test.extend("annotationOnItsOwnLine", () =>
      parseCanonicalValuesAnnotation(`*\n * ${CANONICAL_VALUES_TAG} order.status\n `));

    it("yields the concept it declares", ({ annotationOnItsOwnLine }) => {
      expect(annotationOnItsOwnLine).toStrictEqual({ conceptId: "order.status" });
    });
  });

  describe("an annotation written on a single line block", () => {
    const it = test.extend("annotationOnASingleLineBlock", () =>
      parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG} order-status `));

    it("yields the concept", ({ annotationOnASingleLineBlock }) => {
      expect(annotationOnASingleLineBlock).toStrictEqual({ conceptId: "order-status" });
    });
  });

  describe("a comment without the tag", () => {
    const it = test.extend("annotationInACommentWithoutTheTag", () =>
      parseCanonicalValuesAnnotation("* @returns the order status"));

    it("declares nothing", ({ annotationInACommentWithoutTheTag }) => {
      expect(annotationInACommentWithoutTheTag).toBe(null);
    });
  });

  describe("a tag without a concept", () => {
    const it = test.extend("annotationWithoutAConcept", () =>
      parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG}`));

    it("declares nothing", ({ annotationWithoutAConcept }) => {
      expect(annotationWithoutAConcept).toBe(null);
    });
  });

  describe("a concept written with characters outside the vocabulary", () => {
    const it = test.extend("annotationWithAConceptOutsideTheVocabulary", () =>
      parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG} Order Status`));

    it("declares nothing", ({ annotationWithAConceptOutsideTheVocabulary }) => {
      expect(annotationWithAConceptOutsideTheVocabulary).toBe(null);
    });
  });

  describe("a tag that only shares a prefix with the annotation", () => {
    const it = test.extend("annotationBehindATagSharingThePrefix", () =>
      parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG}-exempt order.status`));

    it("declares nothing", ({ annotationBehindATagSharingThePrefix }) => {
      expect(annotationBehindATagSharingThePrefix).toBe(null);
    });
  });
});

describe("containsCanonicalValuesAnnotation", () => {
  describe("a source that mentions the tag", () => {
    const it = test.extend("prefilterOnASourceMentioningTheTag", () =>
      containsCanonicalValuesAnnotation(`/** ${CANONICAL_VALUES_TAG} order.status */`));

    it("is accepted by the prefilter", ({ prefilterOnASourceMentioningTheTag }) => {
      expect(prefilterOnASourceMentioningTheTag).toBe(true);
    });
  });

  describe("a source that never mentions the tag", () => {
    const it = test.extend("prefilterOnASourceWithoutTheTag", () =>
      containsCanonicalValuesAnnotation("export const status = 1;"));

    it("is rejected by the prefilter", ({ prefilterOnASourceWithoutTheTag }) => {
      expect(prefilterOnASourceWithoutTheTag).toBe(false);
    });
  });
});

describe("findRetiredAnnotationTags", () => {
  describe("a retired tag left in the source", () => {
    const it = test.extend("retiredTagsInASourceCarryingOne", () =>
      findRetiredAnnotationTags(`/** ${RETIRED_ANNOTATION_TAGS[0]} */`));

    it("is reported by name", ({ retiredTagsInASourceCarryingOne }) => {
      expect(retiredTagsInASourceCarryingOne).toStrictEqual([RETIRED_ANNOTATION_TAGS[0]]);
    });
  });

  describe("a source without retired tags", () => {
    const it = test.extend("retiredTagsInASourceCarryingNone", () =>
      findRetiredAnnotationTags(`/** ${CANONICAL_VALUES_TAG} order.status */`));

    it("reports none", ({ retiredTagsInASourceCarryingNone }) => {
      expect(retiredTagsInASourceCarryingNone).toStrictEqual([]);
    });
  });
});
