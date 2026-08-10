import { describe, expect, test } from "vite-plus/test";

import {
  containsCanonicalValuesAnnotation,
  findRetiredAnnotationTags,
  parseCanonicalValuesAnnotation,
  RETIRED_ANNOTATION_TAGS,
} from "./annotation.ts";

describe("annotation", () => {
  const CANONICAL_VALUES_TAG = "@canonical-values";

  test("an annotation on its own line yields the concept it declares", () => {
    expect(
      parseCanonicalValuesAnnotation(`*\n * ${CANONICAL_VALUES_TAG} order.status\n `),
    ).toStrictEqual({ conceptId: "order.status" });
  });

  test("an annotation written on a single line block yields the concept", () => {
    expect(parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG} order-status `)).toStrictEqual(
      {
        conceptId: "order-status",
      },
    );
  });

  test("a comment without the tag declares nothing", () => {
    expect(parseCanonicalValuesAnnotation("* @returns the order status")).toBeNull();
  });

  test("a tag without a concept declares nothing", () => {
    expect(parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG}`)).toBeNull();
  });

  test("a concept written with characters outside the vocabulary declares nothing", () => {
    expect(parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG} Order Status`)).toBeNull();
  });

  test("a tag that only shares a prefix with the annotation declares nothing", () => {
    expect(
      parseCanonicalValuesAnnotation(`* ${CANONICAL_VALUES_TAG}-exempt order.status`),
    ).toBeNull();
  });

  test("the prefilter accepts any source that mentions the tag", () => {
    expect(containsCanonicalValuesAnnotation(`/** ${CANONICAL_VALUES_TAG} order.status */`)).toBe(
      true,
    );
  });

  test("the prefilter rejects a source that never mentions the tag", () => {
    expect(containsCanonicalValuesAnnotation("export const status = 1;")).toBe(false);
  });

  test("a retired tag left in the source is reported by name", () => {
    const retired = RETIRED_ANNOTATION_TAGS[0];

    expect(findRetiredAnnotationTags(`/** ${retired} */`)).toStrictEqual([retired]);
  });

  test("a source without retired tags reports none", () => {
    expect(findRetiredAnnotationTags(`/** ${CANONICAL_VALUES_TAG} order.status */`)).toStrictEqual(
      [],
    );
  });
});
