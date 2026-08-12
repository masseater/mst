import { declarationEntriesAt } from "./declaration-path.ts";
import { scanCanonicalValuesText } from "./declarations.ts";

import type { CanonicalValuesCatalog } from "./catalog.ts";
import type { CanonicalValue } from "./fingerprint.ts";

export type AnnotatedDeclarationRange = {
  readonly binding: string;
  readonly conceptId: string;
  readonly fingerprint: string;
  readonly start: number;
  readonly end: number;
  readonly values: readonly CanonicalValue[];
};

export const registeredDeclarationRanges = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly filename: string;
  readonly repositoryRoot: string;
  readonly sourceText: string;
}): readonly AnnotatedDeclarationRange[] => {
  const declarations = scanCanonicalValuesText(input.sourceText, input.filename).declarations;
  return declarationEntriesAt(input.catalog, {
    path: input.filename,
    repositoryRoot: input.repositoryRoot,
  }).flatMap((entry) => {
    const matchesCurrentSource = declarations.some(
      (declaration) =>
        declaration.annotationStart === entry.annotationStart &&
        declaration.binding === entry.binding &&
        declaration.bindingStart === entry.bindingStart &&
        declaration.conceptId === entry.conceptId &&
        declaration.declarationStart === entry.declarationStart &&
        declaration.declarationEnd === entry.declarationEnd,
    );
    if (!matchesCurrentSource) return [];
    return [
      {
        binding: entry.binding,
        conceptId: entry.conceptId,
        fingerprint: entry.fingerprint,
        start: entry.declarationStart,
        end: entry.declarationEnd,
        values: entry.values,
      },
    ];
  });
};
