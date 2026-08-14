export type CanonicalValuesAnnotation = {
  readonly conceptId: string;
};

export const CANONICAL_VALUES_TAG = "@canonical-values";

const ANNOTATED_CONCEPT_PATTERN = new RegExp(
  String.raw`(?<=(?:^|\n)[^\S\n]*\*?[^\S\n]*${CANONICAL_VALUES_TAG}[^\S\n]+)[a-z0-9]+(?:[-.][a-z0-9]+)*(?=[^\S\n]*(?:\n|$))`,
  "u",
);

export const parseCanonicalValuesAnnotation = (
  commentValue: string,
): CanonicalValuesAnnotation | null => {
  const annotated = ANNOTATED_CONCEPT_PATTERN.exec(commentValue);
  return annotated === null ? null : { conceptId: annotated[0] };
};

export const containsCanonicalValuesAnnotation = (sourceText: string): boolean =>
  sourceText.includes(CANONICAL_VALUES_TAG);

export const RETIRED_ANNOTATION_TAGS: readonly string[] = [
  "@canonical-values-exempt",
  "@canonical-values-ignore",
  "@canonical-values-skip",
];

export const findRetiredAnnotationTags = (sourceText: string): readonly string[] =>
  RETIRED_ANNOTATION_TAGS.filter((tag) => sourceText.includes(tag));
