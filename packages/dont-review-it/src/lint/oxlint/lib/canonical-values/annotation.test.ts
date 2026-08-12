import { describe, expect, test } from "vite-plus/test";

import {
  containsCanonicalValuesAnnotation,
  findRetiredAnnotationTags,
  parseCanonicalValuesAnnotation,
  RETIRED_ANNOTATION_TAGS,
} from "./annotation.ts";

const CANONICAL_VALUES_TAG = "@canonical-values";

const it = test
  .extend("annotationOnItsOwnLine", () =>
    parseCanonicalValuesAnnotation(`*\n * ${CANONICAL_VALUES_TAG} order.status\n `))
  .extend("annotationOnASingleLineBlock", () =>
    parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG} order-status `),
  )
  .extend("annotationInACommentWithoutTheTag", () =>
    parseCanonicalValuesAnnotation("* @returns the order status"),
  )
  .extend("annotationWithoutAConcept", () =>
    parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG}`),
  )
  .extend("annotationWithAConceptOutsideTheVocabulary", () =>
    parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG} Order Status`),
  )
  .extend("annotationBehindATagSharingThePrefix", () =>
    parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG}-exempt order.status`),
  )
  .extend("prefilterOnASourceMentioningTheTag", () =>
    containsCanonicalValuesAnnotation(`/** ${CANONICAL_VALUES_TAG} order.status */`),
  )
  .extend("prefilterOnASourceWithoutTheTag", () =>
    containsCanonicalValuesAnnotation("export const status = 1;"),
  )
  .extend("retiredTagsInASourceCarryingOne", () =>
    findRetiredAnnotationTags(`/** ${RETIRED_ANNOTATION_TAGS[0]} */`),
  )
  .extend("retiredTagsInASourceCarryingNone", () =>
    findRetiredAnnotationTags(`/** ${CANONICAL_VALUES_TAG} order.status */`),
  );

describe("annotation", () => {
  it("an annotation on its own line yields the concept it declares", ({
    annotationOnItsOwnLine,
  }) => {
    expect(annotationOnItsOwnLine).toStrictEqual({ conceptId: "order.status" });
  });

  it("an annotation written on a single line block yields the concept", ({
    annotationOnASingleLineBlock,
  }) => {
    expect(annotationOnASingleLineBlock).toStrictEqual({ conceptId: "order-status" });
  });

  it("a comment without the tag declares nothing", ({ annotationInACommentWithoutTheTag }) => {
    expect(annotationInACommentWithoutTheTag).toBe(null);
  });

  it("a tag without a concept declares nothing", ({ annotationWithoutAConcept }) => {
    expect(annotationWithoutAConcept).toBe(null);
  });

  it("a concept written with characters outside the vocabulary declares nothing", ({
    annotationWithAConceptOutsideTheVocabulary,
  }) => {
    expect(annotationWithAConceptOutsideTheVocabulary).toBe(null);
  });

  it("a tag that only shares a prefix with the annotation declares nothing", ({
    annotationBehindATagSharingThePrefix,
  }) => {
    expect(annotationBehindATagSharingThePrefix).toBe(null);
  });

  it("the prefilter accepts any source that mentions the tag", ({
    prefilterOnASourceMentioningTheTag,
  }) => {
    expect(prefilterOnASourceMentioningTheTag).toBe(true);
  });

  it("the prefilter rejects a source that never mentions the tag", ({
    prefilterOnASourceWithoutTheTag,
  }) => {
    expect(prefilterOnASourceWithoutTheTag).toBe(false);
  });

  it("a retired tag left in the source is reported by name", ({
    retiredTagsInASourceCarryingOne,
  }) => {
    expect(retiredTagsInASourceCarryingOne).toStrictEqual([RETIRED_ANNOTATION_TAGS[0]]);
  });

  it("a source without retired tags reports none", ({ retiredTagsInASourceCarryingNone }) => {
    expect(retiredTagsInASourceCarryingNone).toStrictEqual([]);
  });
});
