const CANONICAL_VALUES_TAG = "@canonical-values";

export const RETIRED_ANNOTATION_TAGS: readonly string[] = [
  "@canonical-values-exempt",
  "@canonical-values-ignore",
  "@canonical-values-skip",
];

export type CanonicalValuesAnnotation = {
  readonly conceptId: string;
};

const CONCEPT_ID_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/u;

export const parseCanonicalValuesAnnotation = (
  commentValue: string,
): CanonicalValuesAnnotation | null => {
  const line = commentValue
    .split("\n")
    .map((each) => each.replace(/^\s*\*?\s?/u, "").trim())
    .find((each) => each.startsWith(`${CANONICAL_VALUES_TAG} `) || each === CANONICAL_VALUES_TAG);
  if (line === undefined) return null;

  const conceptId = line.slice(CANONICAL_VALUES_TAG.length).trim();
  return CONCEPT_ID_PATTERN.test(conceptId) ? { conceptId } : null;
};

export const containsCanonicalValuesAnnotation = (sourceText: string): boolean =>
  sourceText.includes(CANONICAL_VALUES_TAG);

export const findRetiredAnnotationTags = (sourceText: string): readonly string[] =>
  RETIRED_ANNOTATION_TAGS.filter((tag) => sourceText.includes(tag));
